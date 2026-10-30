// The builder's read-only view of one site day — the Builder side of web
// pages/contractor/SiteEngineerDashboard.jsx (where `readOnly` is true for
// every role except ENGINEER) plus SiteDayResources.jsx and
// subscription/BuilderCostAdjustments.jsx.
//
//   GET /cost-tool/projects/{id}/summary?work_date=   the day's register
//   GET /cost-tool/projects/{id}/summary              every recorded date
//   GET /timelines/project/{id}                       the day's photos / videos
//   GET /projects/{id}/labor-requests, /equipment-requests (+ daily records / usage)
//   GET|POST /cost-tool/registers/{id}/builder-adjustments  audited cost corrections
//
// A builder whose plan has lapsed gets the server's 403; it is shown as the
// locked notice, not an error.
// Visible text uses the web's keys (se.*, subscription.adjust.*) via t().
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, Modal } from 'react-native'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { ChevronLeft, ChevronRight, ClipboardList, X, CirclePlay } from 'lucide-react-native'
import { fetchCostToolSummary } from '../../api/costTool'
import { fetchProjectTimelineEntries } from '../../api/projects'
import {
  fetchEquipmentUsage, fetchLaborDailyRecords, fetchProjectEquipmentRequests, fetchProjectLaborRequests,
} from '../../api/siteResources'
import { fetchCostAdjustments, saveCostAdjustment } from '../../api/subscription'
import { imageUrl } from '../../api/client'
import useBuilderSubscription from '../../hooks/useBuilderSubscription'
import { formatMoney } from '../../utils/countryConfig'
import { formatDisplayDate, todayCalendarDate, isCalendarDate, apiErrorText } from '../../utils/builderHelpers'
import { formatPlanDate, hasFeature, lockedReason, subscriptionErrorMessage } from '../../utils/subscriptionFormat'
import { ActionButton, InfoRow, LabeledInput, LockedFeature, Notice, SegmentTabs, Badge } from './BuilderUi'
import { COLORS } from '../../theme/tokens'
import { useLanguage } from '../../i18n/LanguageContext'
import { createStyles } from '../../theme/createStyles'

// [field, labelKey] — the label is translated at render time.
const COST_FIELDS = [
  ['labour_cost', 'se.form.labourCost'],
  ['material_cost', 'se.form.materialCost'],
  ['equipment_cost', 'se.form.equipmentCost'],
  ['total_expenses', 'se.form.otherExpenses'],
]

const AGREED = new Set(['ACCEPTED', 'COMPLETED'])
const dateKey = (value) => String(value || '').slice(0, 10)
const covers = (request, day) => {
  const start = dateKey(request?.start_date)
  const end = dateKey(request?.end_date)
  return Boolean(day && start && day >= start && (!end || day <= end))
}

function shiftDate(value, days) {
  const [y, m, d] = String(value).split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return todayCalendarDate(date)
}

/** The builder's audited corrections for one closed daily record. */
export function BuilderCostAdjustments({ registerId, country, onViewPlans }) {
  const { t } = useLanguage()
  const { status } = useBuilderSubscription()
  const [record, setRecord] = useState(null)
  const [field, setField] = useState('labour_cost')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState(null)
  const [locked, setLocked] = useState(null)
  const [busy, setBusy] = useState(false)
  const money = (value) => formatMoney(value, country)

  const load = useCallback(async () => {
    if (!registerId) return
    try { setRecord(await fetchCostAdjustments(registerId)) } catch { setRecord(null) }
  }, [registerId])
  useEffect(() => { load() }, [load])

  if (!registerId || !record) return null
  const entitled = hasFeature(status, 'bill_adjustments')

  const submit = async () => {
    if (amount === '' || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
      setMessage({ tone: 'error', text: t('mobile.projects.adjust.errAmount') })
      return
    }
    if (reason.trim().length < 3) {
      setMessage({ tone: 'error', text: t('mobile.projects.adjust.errReason') })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      setRecord(await saveCostAdjustment(registerId, { fieldName: field, adjustedValue: amount, reason: reason.trim() }))
      setAmount('')
      setReason('')
      setMessage({ tone: 'success', text: t('subscription.adjust.saved') })
    } catch (error) {
      const refused = lockedReason(error)
      if (refused) setLocked(refused)
      else setMessage({ tone: 'error', text: subscriptionErrorMessage(error, t('mobile.projects.adjust.saveFailed')) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.view}>
      <View style={styles.view2}>
        <ClipboardList size={14} color="#047857" />
        <Text style={styles.text}>{t('subscription.adjust.title')}</Text>
      </View>
      <View style={styles.view3}>
        <Text style={styles.text2}>{t('subscription.adjust.hint')}</Text>
        <View style={styles.view4}>
          {COST_FIELDS.map(([key, labelKey]) => {
            const values = record.fields?.[key] || {}
            return (
              <View key={key} style={styles.view5}>
                <Text style={styles.text3}>{t(labelKey)}</Text>
                <Text style={styles.text4}>{money(values.effective)}</Text>
                {values.effective !== values.original ? <Text style={styles.text5}>{t('subscription.adjust.recorded')}: {money(values.original)}</Text> : null}
              </View>
            )
          })}
        </View>
        {!record.locked ? <Text style={styles.text6}>{t('subscription.adjust.openDay')}</Text> : null}
        {record.locked && (locked || !entitled) ? (
          <View style={styles.view6}>
            <LockedFeature compact reason={locked || { kind: status?.status === 'EXPIRED' ? 'expired' : 'required', requiredPlan: 'PROFESSIONAL' }} onViewPlans={onViewPlans} />
          </View>
        ) : null}
        {record.locked && entitled && !locked ? (
          <View style={styles.view7}>
            <Text style={styles.text7}>{t('subscription.adjust.field')}</Text>
            <SegmentTabs dense tabs={COST_FIELDS.map(([id, labelKey]) => ({ id, label: t(labelKey) }))} active={field} onChange={setField} />
            <View style={styles.view6}>
              <LabeledInput label={t('subscription.adjust.newAmount')} value={amount} onChangeText={(value) => setAmount(value.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
              <LabeledInput label={t('subscription.adjust.reason')} value={reason} onChangeText={setReason} multiline maxLength={500} />
            </View>
            <ActionButton label={t('subscription.adjust.save')} busy={busy} onPress={submit} />
          </View>
        ) : null}
        {message ? <View style={styles.view6}><Notice tone={message.tone} text={message.text} /></View> : null}
        {(record.adjustments || []).length ? (
          <View style={styles.view6}>
            <Text style={styles.text8}>{t('subscription.adjust.history')}</Text>
            {record.adjustments.map((row) => (
              <View key={row.id} style={styles.view8}>
                <Text style={styles.text9}>
                  {t((COST_FIELDS.find(([key]) => key === row.field_name) || [null, 'se.form.otherExpenses'])[1])}: {money(row.original_value)} → {money(row.adjusted_value)}
                </Text>
                <Text style={styles.text10}>{row.reason}</Text>
                <Text style={styles.text11}>{t('subscription.adjust.by', { name: row.builder_name, date: formatPlanDate(`${row.created_at}Z`) })}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default function SiteDayRecords({ project, onViewPlans }) {
  const { t } = useLanguage()
  const projectId = project?.id
  const country = project?.project_country
  const money = (value) => formatMoney(value, country)
  const [workDate, setWorkDate] = useState(todayCalendarDate())
  const [day, setDay] = useState(null)
  const [all, setAll] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(null)
  const [supply, setSupply] = useState({ labour: [], equipment: [] })
  const [logs, setLogs] = useState({ labour: {}, equipment: {} })
  const [viewer, setViewer] = useState(null)
  const [videoViewer, setVideoViewer] = useState(null)
  const seq = useRef(0)

  const refresh = useCallback(async () => {
    if (!projectId || !isCalendarDate(workDate)) return
    const call = ++seq.current
    setLoading(true)
    setError('')
    setLocked(null)
    try {
      const [daySummary, allSummary, entries] = await Promise.all([
        fetchCostToolSummary(projectId, workDate),
        fetchCostToolSummary(projectId),
        fetchProjectTimelineEntries(projectId),
      ])
      if (call !== seq.current) return
      setDay(daySummary)
      setAll(allSummary)
      setTimeline(Array.isArray(entries) ? entries : [])
    } catch (failure) {
      if (call !== seq.current) return
      const reason = lockedReason(failure)
      if (reason) setLocked(reason)
      else setError(apiErrorText(failure, t('se.errLoad'), t))
      setDay(null)
    } finally {
      if (call === seq.current) setLoading(false)
    }
  }, [projectId, workDate])

  useEffect(() => { refresh() }, [refresh])

  // Labour and equipment are read once per project.
  useEffect(() => {
    if (!projectId) return undefined
    let current = true
    setLogs({ labour: {}, equipment: {} })
    Promise.allSettled([fetchProjectLaborRequests(projectId), fetchProjectEquipmentRequests(projectId)]).then(([labour, equipment]) => {
      if (!current) return
      setSupply({
        labour: labour.status === 'fulfilled' && Array.isArray(labour.value) ? labour.value : [],
        equipment: equipment.status === 'fulfilled' && Array.isArray(equipment.value) ? equipment.value : [],
      })
    })
    return () => { current = false }
  }, [projectId])

  const dayLabour = useMemo(() => supply.labour.filter((request) => AGREED.has(request.status) && covers(request, workDate)), [supply.labour, workDate])
  const dayRentals = useMemo(() => supply.equipment.filter((request) => request.request_kind === 'RENT' && AGREED.has(request.status) && covers(request, workDate)), [supply.equipment, workDate])

  useEffect(() => {
    dayLabour.filter((request) => !logs.labour[request.id]).forEach((request) => {
      fetchLaborDailyRecords(request.id)
        .then((records) => setLogs((current) => ({ ...current, labour: { ...current.labour, [request.id]: Array.isArray(records) ? records : [] } })))
        .catch(() => {})
    })
    dayRentals.filter((rental) => !logs.equipment[rental.id]).forEach((rental) => {
      fetchEquipmentUsage(rental.id)
        .then((records) => setLogs((current) => ({ ...current, equipment: { ...current.equipment, [rental.id]: Array.isArray(records) ? records : [] } })))
        .catch(() => {})
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayLabour, dayRentals])

  const register = day?.registers?.[0] || null
  const recordedDates = useMemo(
    () => (all?.registers || []).map((row) => dateKey(row.work_date)).filter(Boolean).sort().reverse(),
    [all],
  )
  const media = useMemo(() => timeline
    .filter((entry) => dateKey(entry.date || entry.work_date) === workDate)
    .flatMap((entry) => entry.images || []), [timeline, workDate])
  const photos = media.filter((item) => item.media_type !== 'video')
  const videos = media.filter((item) => item.media_type === 'video')
  const dayNotes = timeline.filter((entry) => dateKey(entry.date || entry.work_date) === workDate && (entry.description || entry.title))

  return (
    <View>
      {/* Date picker: step a day, or jump to a recorded date */}
      <View style={styles.view9}>
        <Pressable onPress={() => setWorkDate((value) => shiftDate(value, -1))} accessibilityLabel={t('mobile.projects.day.previous')} style={styles.pressable}>
          <ChevronLeft size={18} color={COLORS.brand[700]} />
        </Pressable>
        <View style={styles.view10}>
          <Text style={styles.text12}>{formatDisplayDate(workDate, undefined, t)}</Text>
          {workDate === todayCalendarDate() ? <Text style={styles.text13}>{t('se.cal.today')}</Text> : null}
        </View>
        <Pressable
          onPress={() => setWorkDate((value) => (value >= todayCalendarDate() ? value : shiftDate(value, 1)))}
          accessibilityLabel={t('mobile.projects.day.next')}
          style={styles.pressable}
        >
          <ChevronRight size={18} color={COLORS.brand[700]} />
        </Pressable>
      </View>
      {recordedDates.length ? (
        <View style={styles.view6}>
          <Text style={styles.text14}>{t('subscription.portfolio.recordedDays')}</Text>
          <SegmentTabs dense tabs={recordedDates.slice(0, 30).map((date) => ({ id: date, label: formatDisplayDate(date, undefined, t) }))} active={workDate} onChange={setWorkDate} />
        </View>
      ) : null}

      <View style={styles.view7}>
        {locked ? <LockedFeature reason={locked} onViewPlans={onViewPlans} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}
        {loading && !day ? <Text style={styles.text15}>{t('se.form.loadingDay')}</Text> : null}

        {!locked && !error && day ? (
          register ? (
            <View style={styles.view11}>
              <View style={styles.view12}>
                <Text style={styles.text16} numberOfLines={2}>{register.work_type || t('se.dailySiteRecord')}</Text>
                <Badge label={register.status === 'CLOSED' || register.status === 'COMPLETED' ? t('se.cal.closed') : register.status === 'IN_PROGRESS' ? t('ui.status.inProgress') : (register.status || t('ui.status.open'))} />
              </View>
              {register.activity_category || register.boq_reference ? (
                <InfoRow label={t('se.form.boqTitle')} value={[register.activity_category, register.boq_reference].filter(Boolean).join(' · ')} />
              ) : null}
              {register.planned_quantity != null || register.completed_quantity != null ? (
                <InfoRow label={t('dash.common.quantity')} value={`${register.completed_quantity ?? 0} / ${register.planned_quantity ?? 0} ${register.activity_unit || ''}`} />
              ) : null}
              <InfoRow label={t('se.glance.workers')} value={register.labour_worker_count ?? day.dashboard?.total_workers ?? 0} />
              {COST_FIELDS.map(([key, labelKey]) => <InfoRow key={key} label={t(labelKey)} value={money(register[key])} />)}
              {register.material_used ? <InfoRow label={t('se.glance.materials')} value={register.material_used} /> : null}
              {register.equipment_used ? <InfoRow label={t('se.form.equipmentUsed')} value={register.equipment_used} /> : null}
              {register.progress_note ? <InfoRow label={t('se.detailedRemarks')} value={register.progress_note} /> : null}
              {register.inspection_remarks ? <InfoRow label={t('se.inspectionRemarks')} value={register.inspection_remarks} /> : null}
              {register.created_by_name ? <Text style={styles.text17}>{t('mobile.projects.day.recordedBy', { name: register.created_by_name })}</Text> : null}
              <BuilderCostAdjustments registerId={register.id} country={country} onViewPlans={onViewPlans} />
            </View>
          ) : (
            <Text style={styles.text18}>
              {t('mobile.projects.day.noRecord')}
            </Text>
          )
        ) : null}

        {dayNotes.length ? (
          <View style={styles.view7}>
            {dayNotes.map((entry, index) => (
              <View key={entry.id || index} style={styles.view13}>
                <Text style={styles.text19}>{entry.title || t('mobile.projects.day.siteUpdate')}</Text>
                {entry.description ? <Text style={styles.text20}>{entry.description}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {photos.length ? (
          <View style={styles.view7}>
            <Text style={styles.text21}>{t('se.sitePhotos')} ({photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {photos.map((photo, index) => (
                <Pressable key={photo.id || photo.image_url || index} onPress={() => setViewer(photo)} style={styles.pressable2}>
                  <Image source={{ uri: imageUrl(photo.image_url) }} style={{ width: 120, height: 96 }} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {videos.length ? (
          <View style={styles.view7}>
            <Text style={styles.text21}>{t('se.siteVideos')} ({videos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {videos.map((video, index) => (
                <Pressable
                  key={video.id || video.image_url || index}
                  onPress={() => setVideoViewer(video)}
                  accessibilityLabel={t('mobile.projects.day.playVideo', { index: index + 1 })}
                  style={styles.pressable3}
                >
                  <CirclePlay size={30} color="#fff" />
                  <Text style={styles.text22}>{t('mobile.projects.day.videoN', { index: index + 1 })}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {dayLabour.length || dayRentals.length ? (
          <View style={styles.view14}>
            <Text style={styles.text23}>{t('mobile.projects.day.labourEquipment')}</Text>
            {dayLabour.map((request) => {
              const record = (logs.labour[request.id] || []).find((row) => dateKey(row.work_date) === workDate)
              return (
                <View key={`l-${request.id}`} style={styles.view13}>
                  <Text style={styles.text24}>{request.trade || t('dash.common.labour')} · {request.supplier_name || t('dash.common.supplier')}</Text>
                  <Text style={styles.text25}>
                    {record
                      ? `${t('mobile.projects.day.present')} ${record.present_count ?? 0} · ${t('mobile.projects.day.absent')} ${record.absent_count ?? 0} · ${t('mobile.projects.day.halfDay')} ${record.half_day_count ?? 0}${record.overtime_hours ? ` · ${t('mobile.projects.day.overtime', { hours: record.overtime_hours })}` : ''}`
                      : t('mobile.projects.day.noAttendance')}
                  </Text>
                </View>
              )
            })}
            {dayRentals.map((rental) => {
              const log = (logs.equipment[rental.id] || []).find((row) => dateKey(row.usage_date) === workDate)
              return (
                <View key={`e-${rental.id}`} style={styles.view13}>
                  <Text style={styles.text24}>{rental.item_name || t('se.res.glanceEquipment')} · {rental.supplier_name || t('dash.common.supplier')}</Text>
                  <Text style={styles.text25}>
                    {log ? t('mobile.projects.day.hoursUsed', { hours: log.hours_used }) : t('mobile.projects.day.noUsage')}
                    {rental.unit_price ? ` · ${money(rental.unit_price)} / ${String(rental.rate_unit || '').toLowerCase()}` : ''}
                  </Text>
                </View>
              )
            })}
            <Text style={styles.text26}>{t('mobile.projects.day.resourcesHint')}</Text>
          </View>
        ) : null}
      </View>

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.view15}>
          <Pressable onPress={() => setViewer(null)} accessibilityLabel={t('dash.common.close')} style={styles.pressable4}>
            <X size={20} color="#fff" />
          </Pressable>
          {viewer ? <Image source={{ uri: imageUrl(viewer.image_url) }} style={{ width: '100%', height: '75%' }} contentFit="contain" /> : null}
        </View>
      </Modal>
      <Modal visible={!!videoViewer} transparent animationType="fade" onRequestClose={() => setVideoViewer(null)}>
        <View style={styles.view15}>
          <Pressable onPress={() => setVideoViewer(null)} accessibilityLabel={t('dash.common.close')} style={styles.pressable4}>
            <X size={20} color="#fff" />
          </Pressable>
          {videoViewer ? <SiteVideo uri={imageUrl(videoViewer.image_url)} /> : null}
        </View>
      </Modal>
    </View>
  )
}

/** One site video, played in-app with native controls (web: <video controls>). */
function SiteVideo({ uri }) {
  const player = useVideoPlayer({ uri }, (instance) => { instance.loop = false; instance.play() })
  return <VideoView player={player} style={{ width: '100%', height: '70%' }} allowsFullscreen nativeControls contentFit="contain" />
}

const styles = createStyles((c) => ({
  view: { marginTop: 10.5, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: c.emeraldBorder },
  view2: { flexDirection: 'row', alignItems: 'center', gap: 7, borderBottomWidth: 1, borderColor: c.emeraldBorderSoft, backgroundColor: c.emeraldSoft, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  text: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: c.emeraldTextStrong },
  view3: { backgroundColor: c.card, padding: 10.5 },
  text2: { marginBottom: 7, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  view4: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 7 },
  view5: { width: '48%', borderRadius: 8, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7 },
  text3: { fontSize: 11, fontWeight: '700', color: c.textSecondary },
  text4: { fontSize: 13, fontWeight: '800', color: c.text },
  text5: { fontSize: 10, color: c.textMuted },
  text6: { marginTop: 7, borderRadius: 8, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  view6: { marginTop: 7 },
  view7: { marginTop: 10.5 },
  text7: { marginBottom: 5.25, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  text8: { marginBottom: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.textSoft },
  view8: { marginBottom: 5.25, borderRadius: 8, borderWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10.5, paddingVertical: 7 },
  text9: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.text },
  text10: { fontSize: 12, lineHeight: 16, color: c.textSecondary },
  text11: { fontSize: 10, color: c.textFaint },
  view9: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  pressable: { height: 35, width: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  view10: { flex: 1, alignItems: 'center' },
  text12: { fontSize: 15, fontWeight: '800', color: c.text },
  text13: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: c.brandText },
  text14: { marginBottom: 3.5, fontSize: 11, fontWeight: '700', color: c.textMuted },
  text15: { paddingVertical: 14, textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textFaint },
  view11: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  view12: { marginBottom: 3.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text16: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
  text17: { marginTop: 7, fontSize: 10, fontWeight: '600', color: c.textFaint },
  text18: { borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 21, textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textFaint },
  view13: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 7 },
  text19: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.brandText },
  text20: { marginTop: 1.75, fontSize: 13, fontWeight: '600', color: c.text },
  text21: { marginBottom: 5.25, fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.text },
  pressable2: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  pressable3: { height: 84, width: 112, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: '#0f172a' },
  text22: { marginTop: 3.5, fontSize: 10, fontWeight: '700', color: 'rgba(255, 255, 255, 0.8)' },
  view14: { marginTop: 10.5, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  text23: { marginBottom: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.text },
  text24: { fontSize: 13, fontWeight: '700', color: c.text },
  text25: { fontSize: 11, color: c.textMuted },
  text26: { marginTop: 3.5, fontSize: 10, fontWeight: '600', color: c.textFaint },
  view15: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.9)' },
  pressable4: { position: 'absolute', right: 17.5, top: 42, zIndex: 10, height: 35, width: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
}))
