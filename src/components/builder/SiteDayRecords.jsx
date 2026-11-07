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
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, X, CirclePlay } from 'lucide-react-native'
import { fetchCostToolSummary } from '../../api/costTool'
import { fetchProjectTimelineEntries } from '../../api/projects'
import {
  fetchEquipmentUsage, fetchLaborDailyRecords, fetchProjectEquipmentRequests, fetchProjectLaborRequests,
} from '../../api/siteResources'
import { fetchCostAdjustments, saveCostAdjustment } from '../../api/subscription'
import { imageUrl } from '../../api/client'
import useBuilderSubscription from '../../hooks/useBuilderSubscription'
import { formatMoney } from '../../utils/countryConfig'
import { formatDisplayDate, todayCalendarDate, apiErrorText } from '../../utils/builderHelpers'
import { formatPlanDate, hasFeature, lockedReason, subscriptionErrorMessage } from '../../utils/subscriptionFormat'
import { ActionButton, LabeledInput, LockedFeature, Notice, SegmentTabs, Badge } from './BuilderUi'
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

// Calendar rules from web SiteEngineerDashboard: a cell is coloured by what the
// day holds (any video orange, photos blue, record text purple, today with
// nothing yet green); Sundays, future days and empty past days can't be opened.
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const CELL_TONES = { open: ['#CFEBDD', '#03572E'], video: ['#F6EADB', '#F58A00'], photo: ['#E7F0FD', '#1683E8'], text: ['#F3E8FD', '#9146D8'] }
const CONTENT_LABEL_KEYS = {
  '100': 'se.cal.text', '110': 'se.cal.textPhoto', '101': 'se.cal.textVideo', '111': 'se.cal.textMedia',
  '010': 'se.cal.photo', '001': 'se.cal.video', '011': 'se.cal.photoVideo',
}
const MEDIA_CAPTION = /Site Media:[^.]*\.?/gi
const hasEnteredText = (row) => Boolean(row && [row.work_type, row.progress_note, row.inspection_remarks, row.material_used, row.equipment_used]
  .some((value) => String(value || '').replace(MEDIA_CAPTION, '').trim()))
const formatQty = (value) => { const number = Number(value || 0); return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2))) }
const statusLabelKey = (status) => (
  { OPEN: 'ui.status.open', IN_PROGRESS: 'ui.status.inProgress', CLOSED: 'ui.status.closed', COMPLETED: 'ui.status.closed' }[status] || 'ui.status.open'
)

// The date's working day from the project start, Sundays excluded (web workingDayNumber).
function workingDayNumber(startDate, date) {
  if (!startDate || !date || date < dateKey(startDate)) return null
  const [y, m, d] = dateKey(startDate).split('-').map(Number)
  const cursor = new Date(y, m - 1, d)
  let count = 0
  while (todayCalendarDate(cursor) <= date) {
    if (cursor.getDay() !== 0) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count || null
}

function monthCells(month) {
  const year = month.getFullYear()
  const value = month.getMonth()
  const cells = []
  for (let blank = 0; blank < new Date(year, value, 1).getDay(); blank += 1) cells.push(null)
  for (let day = 1; day <= new Date(year, value + 1, 0).getDate(); day += 1) cells.push(new Date(year, value, day))
  return cells
}

/** One read-only field of the day's record, laid out like the web's disabled inputs. */
function ReadField({ label, value, wide }) {
  const { t } = useLanguage()
  const empty = value === null || value === undefined || value === ''
  return (
    <View style={[styles.field, wide ? styles.fieldWide : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, empty ? styles.fieldEmpty : null]}>{empty ? t('dash.common.notSet') : String(value)}</Text>
    </View>
  )
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
  // Nothing is open until a calendar date is tapped, as on the web.
  const [workDate, setWorkDate] = useState('')
  const [month, setMonth] = useState(() => new Date())
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
    if (!projectId) return
    const call = ++seq.current
    setLoading(true)
    setError('')
    setLocked(null)
    try {
      const [daySummary, allSummary, entries] = await Promise.all([
        workDate ? fetchCostToolSummary(projectId, workDate) : Promise.resolve(null),
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
  const recordsByDate = useMemo(
    () => Object.fromEntries((all?.registers || []).map((row) => [dateKey(row.work_date), row])),
    [all],
  )
  const photosByDate = useMemo(() => {
    const grouped = {}
    timeline.forEach((entry) => {
      const key = dateKey(entry.date || entry.work_date)
      const count = (entry.images || []).filter((item) => item.media_type !== 'video').length
      if (key && count) grouped[key] = (grouped[key] || 0) + count
    })
    return grouped
  }, [timeline])
  const videosByDate = useMemo(() => {
    const grouped = {}
    timeline.forEach((entry) => {
      const key = dateKey(entry.date || entry.work_date)
      const count = (entry.images || []).filter((item) => item.media_type === 'video').length
      if (key && count) grouped[key] = (grouped[key] || 0) + count
    })
    return grouped
  }, [timeline])
  const cells = useMemo(() => monthCells(month), [month])
  const workflow = all?.workflow || day?.workflow || {}
  const todayKey = workflow.local_date || todayCalendarDate()
  const recordDates = Object.keys(recordsByDate).sort()
  const dayNumber = project?.start_date
    ? workingDayNumber(project.start_date, workDate)
    : recordDates.includes(workDate) ? recordDates.indexOf(workDate) + 1 : null
  const dayStatus = register?.status || (workDate === todayKey ? 'OPEN' : 'CLOSED')
  const media = useMemo(() => timeline
    .filter((entry) => dateKey(entry.date || entry.work_date) === workDate)
    .flatMap((entry) => entry.images || []), [timeline, workDate])
  const sameDayEntry = timeline.find((entry) => dateKey(entry.date) === workDate && entry.title !== 'Material Request')
    || timeline.find((entry) => dateKey(entry.date) === workDate)
  const dash = day?.dashboard || {}
  const form = register ? {
    work_title: register.work_type || '',
    activity_category: register.activity_category || '',
    boq_reference: register.boq_reference || '',
    activity_unit: register.activity_unit || '',
    planned_quantity: register.planned_quantity ?? '',
    completed_quantity: register.completed_quantity ?? '',
    detailed_remarks: register.progress_note || '',
    labour_worker_count: Number(register.labour_worker_count || dash.total_workers || 0),
    labour_cost: Number(register.labour_cost || dash.labour_cost || 0),
    material_cost: Number(register.material_cost || dash.material_cost || 0),
    equipment_cost: Number(register.equipment_cost || dash.machinery_cost || 0),
    total_expenses: Number(register.total_expenses || dash.expenses || 0),
    material_used: register.material_used || (day?.material_usages || []).map((item) => `${item.material} ${item.quantity_used} ${item.unit}`).join(', '),
    equipment_used: register.equipment_used || (day?.machinery_usages || []).map((item) => `${item.machine} ${item.hours} hours`).join(', '),
    inspection_remarks: register.inspection_remarks || sameDayEntry?.description || '',
  } : {}
  const materials = ((day?.materials?.length ? day.materials : all?.materials) || []).map((item) => {
    const available = Number(item.available ?? item.remaining ?? 0) || 0
    const usedToday = Number(item.used_today ?? 0) || 0
    return { ...item, available, usedToday, remaining: available - usedToday }
  })
  // Remaining / progress for the day's BOQ item (web activitySummary).
  const activitySummary = (() => {
    const planned = Number(form.planned_quantity)
    const saved = register?.boq_activity
    const reference = String(form.boq_reference || '').trim()
    const priorDays = reference && saved?.boq_reference === reference
      ? Math.max(0, (Number(saved?.completed_to_date ?? 0) || 0) - (Number(saved?.completed_today ?? 0) || 0)) : 0
    const completedToDate = priorDays + (Number(form.completed_quantity) || 0)
    if (!Number.isFinite(planned) || planned <= 0) return { planned: null, completedToDate, remaining: null, percent: null }
    return { planned, completedToDate, remaining: Math.max(0, planned - completedToDate), percent: Math.min(100, Math.round((completedToDate / planned) * 100)) }
  })()
  const materialCostFromUsage = materials.reduce((sum, item) => sum + item.usedToday * (Number(item.rate ?? 0) || 0), 0)
  const materialCost = Number(form.material_cost || 0) > 0 ? Number(form.material_cost) : materialCostFromUsage
  const grandTotal = Number(form.labour_cost || 0) + materialCost + Number(form.equipment_cost || 0) + Number(form.total_expenses || 0)
  const photos = media.filter((item) => item.media_type !== 'video')
  const videos = media.filter((item) => item.media_type === 'video')
  const dayNotes = timeline.filter((entry) => dateKey(entry.date || entry.work_date) === workDate && (entry.description || entry.title))

  return (
    <View>
      {/* Month calendar (web SiteEngineerDashboard) — tap a date to open its record below */}
      <View style={styles.calendar}>
        <View style={styles.calendarHead}>
          <View style={styles.view9}>
            <CalendarDays size={15} color="#03572E" />
            <Text style={styles.monthTitle}>{`${t(`se.month.${month.getMonth()}`)} ${month.getFullYear()}`}</Text>
          </View>
          <View style={styles.view9}>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} accessibilityLabel={t('mobile.projects.day.previous')} style={styles.monthButton}>
              <ChevronLeft size={15} color={COLORS.graphite} />
            </Pressable>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} accessibilityLabel={t('mobile.projects.day.next')} style={styles.monthButton}>
              <ChevronRight size={15} color={COLORS.graphite} />
            </Pressable>
          </View>
        </View>
        <View style={styles.row}>
          {WEEKDAYS.map((weekday) => <Text key={weekday} style={styles.weekday}>{t(`se.weekday.${weekday}`)}</Text>)}
        </View>
        <View style={styles.grid}>
          {cells.map((date, index) => {
            if (!date) return <View key={`blank-${index}`} style={styles.cellSlot} />
            const key = todayCalendarDate(date)
            const row = recordsByDate[key]
            const hasPhotos = (photosByDate[key] || 0) > 0
            const hasVideo = (videosByDate[key] || 0) > 0
            const hasMedia = hasPhotos || hasVideo
            const hasText = hasEnteredText(row)
            const isSunday = date.getDay() === 0
            const future = key > todayKey
            const closed = key < todayKey || ['CLOSED', 'COMPLETED'].includes(row?.status)
            const isClosed = isSunday || (closed && !hasText && !hasMedia)
            const isOpen = key === todayKey && !isSunday && !hasText && !hasMedia
            const tone = isOpen ? CELL_TONES.open : hasVideo ? CELL_TONES.video : hasPhotos ? CELL_TONES.photo : hasText ? CELL_TONES.text : null
            const contentKey = CONTENT_LABEL_KEYS[`${hasText ? 1 : 0}${hasPhotos ? 1 : 0}${hasVideo ? 1 : 0}`]
            const label = isOpen ? t('ui.status.open') : contentKey ? t(contentKey) : ''
            const empty = key < todayKey && !row && !hasMedia
            const selected = key === workDate
            return (
              <View key={key} style={styles.cellSlot}>
                <Pressable
                  onPress={() => setWorkDate(key)}
                  disabled={future || isSunday || empty}
                  style={[styles.cell, selected ? styles.cellSelected : null, future || isSunday ? styles.cellDisabled : null]}
                >
                  <Text style={styles.cellDate}>{date.getDate()}</Text>
                  {tone ? (
                    <View style={styles.cellTag}>
                      <View style={[styles.cellDot, { backgroundColor: tone[1] }]} />
                      <Text style={[styles.cellLabel, { color: tone[1] }]} numberOfLines={2}>{label}</Text>
                    </View>
                  ) : isClosed ? (
                    <Text style={[styles.cellLabel, { color: '#8B929D' }]} numberOfLines={1}>{t('ui.status.closed')}</Text>
                  ) : null}
                </Pressable>
              </View>
            )
          })}
        </View>
        <View style={styles.legend}>
          {[['#F9F9F9', '#8B929D', t('se.cal.closed')], ['#F3E8FD', '#9146D8', t('se.cal.text')], ['#E7F0FD', '#1683E8', t('se.cal.photo')], ['#F6EADB', '#F58A00', t('se.cal.video')], ['#CFEBDD', '#03572E', t('ui.status.open')]].map(([box, ink, text]) => (
            <View key={text} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: box }]} />
              <Text style={[styles.legendText, { color: ink }]}>{text}</Text>
            </View>
          ))}
        </View>
      </View>

      {!workDate ? <Text style={[styles.text18, styles.view7]}>{t('se.clickAvailableDate')}</Text> : null}

      <View style={styles.view7}>
        {locked ? <LockedFeature reason={locked} onViewPlans={onViewPlans} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}
        {workDate && loading && !day ? <Text style={styles.text15}>{t('se.form.loadingDay')}</Text> : null}

        {/* The day's record opens for any selected date, filled from the
            register where one exists — web SiteEngineerDashboard, read-only. */}
        {workDate && !locked && !error && day ? (
          <View style={styles.view11}>
            <View style={styles.view12}>
              <View style={{ flex: 1 }}>
                <Text style={styles.text16} numberOfLines={2}>{`${t('se.project')}: ${project?.project_title || project?.title || ''}`}</Text>
                <Text style={styles.text17}>
                  {dayNumber ? `${t('se.day')} ${dayNumber} · ` : ''}{formatDisplayDate(workDate, undefined, t)}
                  {register?.created_by_name ? ` · ${t('se.siteEngineer')}: ${register.created_by_name}` : ''}
                </Text>
              </View>
              <Badge label={t(statusLabelKey(dayStatus))} />
            </View>
            <View style={styles.fields}>
              <ReadField wide label={t('se.workTitle')} value={form.work_title} />
              <ReadField wide label={t('se.projectCompletion')} value={`${project?.completion_percentage ?? 0}%`} />
              <ReadField label={t('se.activityCategory')} value={form.activity_category} />
              <ReadField label={t('se.boqReference')} value={form.boq_reference} />
              <ReadField label={t('se.plannedQuantity')} value={form.planned_quantity} />
              <ReadField label={t('se.completedQuantity')} value={form.completed_quantity} />
              <ReadField label={t('se.activityUnit')} value={form.activity_unit} />
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('se.activityProgress')}</Text>
                <View style={styles.progressRow}>
                  <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${activitySummary.percent ?? 0}%` }]} /></View>
                  <Text style={styles.fieldValue}>{activitySummary.percent === null ? '—' : `${activitySummary.percent}%`}</Text>
                </View>
              </View>
              <ReadField
                wide
                label={t('se.remainingQuantity')}
                value={activitySummary.remaining === null
                  ? t('se.remainingNotSet')
                  : t('se.remainingSummary', { done: formatQty(activitySummary.completedToDate), planned: formatQty(activitySummary.planned), remaining: formatQty(activitySummary.remaining), unit: form.activity_unit || '' })}
              />
              <ReadField wide label={t('se.detailedRemarks')} value={form.detailed_remarks} />
              <ReadField label={t('se.labourWorkerCount')} value={form.labour_worker_count} />
              <ReadField label={t('se.labourCost')} value={register ? money(form.labour_cost) : ''} />
              <ReadField wide label={t('se.otherExpenses')} value={register ? money(form.total_expenses) : ''} />
            </View>

            {/* Materials used today */}
            <View style={styles.box}>
              <View style={styles.boxHead}>
                <Text style={styles.boxTitle}>{t('se.materialsUsedToday')}</Text>
                <Text style={styles.text17}>{dayNumber ? `${t('se.day')} ${dayNumber} · ` : ''}{formatDisplayDate(workDate, undefined, t)}</Text>
              </View>
              {materials.length ? materials.map((item, index) => (
                <View key={item.material || index} style={styles.boxRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldValue}>{index + 1}. {item.material}</Text>
                    <Text style={styles.text26}>
                      {t('se.availableCol')}: {formatQty(item.available)} {item.unit || ''} · {t('se.remaining')}: {formatQty(item.remaining)} {item.unit || ''}
                      {Number(item.rate ?? 0) > 0 ? ` · ${t('se.rate')}: ${money(item.rate)}/${item.unit || ''}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.fieldValue}>{formatQty(item.usedToday)} {item.unit || ''}</Text>
                    <Text style={styles.text26}>{money(item.usedToday * (Number(item.rate ?? 0) || 0))}</Text>
                  </View>
                </View>
              )) : <Text style={[styles.text15, { paddingVertical: 10.5 }]}>{t('se.noMaterials')}</Text>}
            </View>

            <View style={styles.fields}>
              <ReadField wide label={t('se.materialUsed')} value={form.material_used} />
              <ReadField wide label={t('se.materialCost')} value={register ? money(materialCost) : ''} />
              <ReadField wide label={t('se.equipmentUsed')} value={form.equipment_used} />
              <ReadField wide label={t('se.equipmentCost')} value={register ? money(form.equipment_cost) : ''} />
              <ReadField wide label={t('se.inspectionRemarks')} value={form.inspection_remarks} />
            </View>

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
              ) : <Text style={[styles.text18, styles.view7]}>{t('se.noSitePhotos')}</Text>}
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
              ) : <Text style={[styles.text18, styles.view7]}>{t('se.noSiteVideos')}</Text>}

            {/* Grand total */}
            <View style={styles.box}>
              <View style={styles.boxHead}><Text style={styles.boxTitle}>{t('se.grandTotal')}</Text></View>
              {[
                [t('se.labourCost'), Number(form.labour_cost || 0)],
                [t('se.materialsUsedToday'), materialCost],
                [t('se.equipmentCost'), Number(form.equipment_cost || 0)],
                [t('se.otherExpenses'), Number(form.total_expenses || 0)],
              ].map(([label, value]) => (
                <View key={label} style={styles.boxRow}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <Text style={styles.fieldValue}>{money(value)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('se.grandTotal')}</Text>
                <Text style={styles.totalValue}>{money(grandTotal)}</Text>
              </View>
              <Text style={[styles.text26, { paddingHorizontal: 10.5, paddingBottom: 7 }]}>{t('se.grandTotalHint')}</Text>
            </View>

            {register ? <BuilderCostAdjustments registerId={register.id} country={country} onViewPlans={onViewPlans} /> : null}
          </View>
        ) : null}

        {workDate && dayNotes.length ? (
          <View style={styles.view7}>
            {dayNotes.map((entry, index) => (
              <View key={entry.id || index} style={styles.view13}>
                <Text style={styles.text19}>{entry.title || t('mobile.projects.day.siteUpdate')}</Text>
                {entry.description ? <Text style={styles.text20}>{entry.description}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}


        {workDate && (dayLabour.length || dayRentals.length) ? (
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
  calendar: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  calendarHead: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 13.5, fontWeight: '800', color: c.text },
  monthButton: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', color: '#03572E' },
  grid: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap' },
  cellSlot: { width: '14.28%', padding: 2 },
  cell: { minHeight: 62, borderRadius: 7, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: c.card, padding: 3.5 },
  cellSelected: { borderWidth: 2, borderColor: '#2e7d55' },
  cellDisabled: { opacity: 0.45 },
  cellDate: { fontSize: 11.5, fontWeight: '800', color: c.textSecondary },
  cellTag: { marginTop: 3.5, flexDirection: 'row', alignItems: 'flex-start', gap: 2.5 },
  cellDot: { marginTop: 4, height: 5, width: 5, borderRadius: 2.5 },
  cellLabel: { flex: 1, marginTop: 2, fontSize: 8, lineHeight: 10, fontWeight: '800' },
  legend: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap', gap: 10.5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { height: 11, width: 11, borderRadius: 3, borderWidth: 1, borderColor: c.borderSoft },
  legendText: { fontSize: 11, fontWeight: '600' },
  fields: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 7 },
  field: { width: '48.5%', borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7 },
  fieldWide: { width: '100%' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: c.textMuted },
  fieldValue: { marginTop: 1.75, fontSize: 13, fontWeight: '600', color: c.text },
  fieldEmpty: { color: c.textFaint },
  progressRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 7 },
  progressTrack: { height: 6, flex: 1, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.brandSoft },
  progressFill: { height: '100%', borderRadius: 9999, backgroundColor: '#2e7d55' },
  box: { marginTop: 10.5, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  boxHead: { borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 8 },
  boxTitle: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: c.brandText },
  boxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10.5, paddingVertical: 8 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 10 },
  totalLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: c.brandText },
  totalValue: { fontSize: 20, fontWeight: '800', color: c.text },
  pressable4: { position: 'absolute', right: 17.5, top: 42, zIndex: 10, height: 35, width: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
}))
