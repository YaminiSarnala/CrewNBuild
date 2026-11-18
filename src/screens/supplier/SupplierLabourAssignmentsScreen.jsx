// A Labour Supplier's Assignments tab: port of the web SupplierLaborSections
// LaborAssignmentsSection.
//
//   figures      deployed workers, available workers, active assignments
//   Active       accepted requests: the workers on projects now
//   Completed    finished assignments
//
// Each assignment opens the Site Engineer's daily attendance (GET
// /labor/requests/{id}/daily-records), read-only here and re-read on every
// reload so a newly saved day shows up. The Site Engineer completes the job.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { CalendarDays, HardHat } from 'lucide-react-native'
import DashboardShell, { PanelState } from '../../components/DashboardShell'
import { Notice } from '../../components/builder/BuilderUi'
import { SkeletonRows } from '../../components/Skeleton'
import { fetchSupplierLabourDailyRecords, labourErrorMessage } from '../../api/labour'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { COLORS } from '../../theme/tokens'
import { ink } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'
import { CountTabs } from './orders/orderParts'
import { RequestStatusPill } from './equipment/equipmentParts'
import { useLabour } from './labour/LabourContext'
import { LabourRequestFacts, labourDate, labourTotals } from './labour/labourParts'

export default function SupplierLabourAssignmentsScreen({ route }) {
  const { t, td } = useLanguage()
  const { gutter } = useResponsive()
  const { services, requests, requestsStatus, refreshKey, reload } = useLabour()
  const [tab, setTab] = useState('active')
  const [openId, setOpenId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // A dashboard figure can open a given tab (`at` makes a repeat tap count).
  const wanted = route?.params?.tab
  const wantedAt = route?.params?.at
  useEffect(() => {
    if (wanted === 'active' || wanted === 'completed') {
      setTab(wanted)
      setOpenId(null)
    }
  }, [wanted, wantedAt])

  useFocusEffect(useCallback(() => { reload() }, [reload]))

  const onRefresh = async () => {
    setRefreshing(true)
    await reload()
    setRefreshing(false)
  }

  const active = requests.filter((request) => request.status === 'ACCEPTED')
  const completed = requests.filter((request) => request.status === 'COMPLETED')
  const list = tab === 'completed' ? completed : active
  const totals = labourTotals(services, requests)
  const tabs = [
    { id: 'active', label: t('labor.tab.active'), count: active.length },
    { id: 'completed', label: t('labor.tab.completed'), count: completed.length },
  ]

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ paddingHorizontal: gutter, gap: 12 }}>
        <Text style={styles.title}>{t('labor.nav.assignments')}</Text>

        <View style={styles.figures}>
          {[
            { id: 'deployed', label: t('labor.stats.deployedWorkers'), value: totals.deployed, color: ink('#ea580c') },
            { id: 'available', label: t('labor.stats.availableWorkers'), value: totals.available, color: ink('#047857') },
            { id: 'active', label: t('labor.stats.activeAssignments'), value: totals.active, color: undefined },
          ].map((item) => (
            <View key={item.id} style={styles.figure}>
              <Text style={styles.figureLabel} numberOfLines={2}>{item.label}</Text>
              <Text style={[styles.figureValue, item.color ? { color: item.color } : null]}>{item.value}</Text>
            </View>
          ))}
        </View>

        <CountTabs tabs={tabs} active={tab} onChange={(id) => { setTab(id); setOpenId(null) }} />

        {requestsStatus === 'idle' ? (
          <PanelState loading skeleton="cards" />
        ) : requestsStatus === 'error' && requests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('mobile.labour.requestsLoadError')}</Text>
            <Pressable onPress={reload} style={{ paddingVertical: 6 }}><Text style={styles.link}>{t('dash.engineer.liveCamera.retry')}</Text></Pressable>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <HardHat size={30} color={COLORS.slate[300]} />
            <Text style={styles.emptyTitle}>{tab === 'completed' ? t('labor.assignments.emptyCompletedTitle') : t('labor.assignments.emptyActiveTitle')}</Text>
            <Text style={styles.emptyText}>{tab === 'completed' ? t('labor.assignments.emptyCompletedMessage') : t('labor.assignments.emptyActiveMessage')}</Text>
          </View>
        ) : list.map((request) => {
          const open = openId === request.id
          return (
            <View key={request.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.project} numberOfLines={1}>{td(request.project_title) || t('labor.project')}</Text>
                  <Text style={styles.people} numberOfLines={1}>{t('labor.siteEngineerName', { name: request.engineer_name || '—' })}</Text>
                </View>
                <RequestStatusPill status={request.status} />
              </View>
              <View style={{ marginTop: 10 }}>
                <LabourRequestFacts request={request} showAllocated />
              </View>
              {request.status === 'ACCEPTED' && !request.supplier_assignment_active ? (
                <Text style={styles.warning}>{t('labor.assignments.unassignedContinues')}</Text>
              ) : null}
              <Pressable
                onPress={() => setOpenId(open ? null : request.id)}
                style={styles.outline}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
              >
                <CalendarDays size={15} color={COLORS.slate[600]} />
                <Text style={styles.outlineText}>{open ? t('labor.attendance.hide') : t('labor.attendance.view')}</Text>
              </Pressable>
              {open ? <Attendance requestId={request.id} refreshKey={refreshKey} /> : null}
            </View>
          )
        })}
      </View>
    </DashboardShell>
  )
}

/** The Site Engineer's daily records for one assignment, one row per day. */
function Attendance({ requestId, refreshKey }) {
  const { t, td } = useLanguage()
  const [state, setState] = useState({ loading: true, records: [], error: '' })

  useEffect(() => {
    let current = true
    fetchSupplierLabourDailyRecords(requestId)
      .then((records) => { if (current) setState({ loading: false, records: Array.isArray(records) ? records : [], error: '' }) })
      .catch((failure) => { if (current) setState({ loading: false, records: [], error: labourErrorMessage(failure, t('labor.error.attendanceLoad')) }) })
    return () => { current = false }
    // t is read only for the fallback message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, refreshKey])

  if (state.loading) return <SkeletonRows count={2} avatar={false} style={{ marginTop: 10 }} />
  if (state.error) return <View style={{ marginTop: 10 }}><Notice tone="error" text={state.error} /></View>
  if (!state.records.length) return <Text style={styles.none}>{t('labor.attendance.none')}</Text>

  const columns = [
    ['present_count', t('labor.field.present')],
    ['absent_count', t('labor.field.absent')],
    ['half_day_count', t('labor.field.halfDay')],
    ['overtime_workers', t('labor.field.otWorkers')],
    ['overtime_hours', t('labor.field.otHours')],
  ]
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
      <View style={styles.table}>
        <View style={[styles.row, styles.head]}>
          <Text style={[styles.date, styles.headText]}>{t('labor.field.date')}</Text>
          {columns.map(([key, label]) => <Text key={key} style={[styles.num, styles.headText]} numberOfLines={2}>{label}</Text>)}
          <Text style={[styles.text, styles.headText]}>{t('labor.field.activity')}</Text>
          <Text style={[styles.text, styles.headText]}>{t('labor.field.notes')}</Text>
        </View>
        {state.records.map((record) => (
          <View key={record.id || record.work_date} style={styles.row}>
            <Text style={[styles.date, styles.strong]}>{labourDate(record.work_date)}</Text>
            {columns.map(([key]) => <Text key={key} style={styles.num}>{record[key] ?? 0}</Text>)}
            <Text style={styles.text}>{record.activity ? td(record.activity) : '—'}</Text>
            <Text style={styles.text}>{record.notes ? td(record.notes) : '—'}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = createStyles((c) => ({
  title: { fontSize: 20, letterSpacing: -0.4, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  figures: { flexDirection: 'row', gap: 8 },
  figure: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10, paddingVertical: 10 },
  figureLabel: { fontSize: 11, lineHeight: 14, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  figureValue: { marginTop: 4, fontSize: 22, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  empty: { alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, backgroundColor: c.card, paddingHorizontal: 20, paddingVertical: 30 },
  emptyTitle: { marginTop: 6, textAlign: 'center', fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  emptyText: { textAlign: 'center', fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textMuted },
  link: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  project: { fontSize: 15.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  people: { marginTop: 2, fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textMuted },
  warning: { marginTop: 8, fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_700Bold', color: c.amberText },
  outline: { marginTop: 12, height: 38, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12 },
  outlineText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  none: { marginTop: 10, borderRadius: 10, backgroundColor: c.subtle, paddingVertical: 14, textAlign: 'center', fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.textFaint, overflow: 'hidden' },
  table: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  row: { flexDirection: 'row', alignItems: 'flex-start', borderTopWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10, paddingVertical: 8 },
  head: { borderTopWidth: 0, backgroundColor: c.subtle },
  headText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textFaint },
  date: { width: 92, fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textSecondary },
  num: { width: 62, textAlign: 'center', fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  text: { width: 140, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', color: c.textSecondary },
  strong: { fontFamily: 'Inter_700Bold', color: c.text },
}))
