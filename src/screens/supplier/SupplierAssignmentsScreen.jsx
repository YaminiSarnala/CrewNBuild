// An Equipment Supplier's Assignments tab: port of the web
// SupplierEquipmentSections EquipmentAssignmentsSection.
//
//   Active rentals   accepted RENT requests: Mark Returned frees the units
//   Purchases        accepted BUY requests: Mark Delivered
//   Completed        returned rentals and delivered purchases
//
// A rental's card opens the Site Engineer's daily usage log (GET
// /equipment-requests/{id}/usage), re-read on every reload so a new entry
// shows through the same live refresh as everything else.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import PianoLoader from '../../components/PianoLoader'
import { useFocusEffect } from '@react-navigation/native'
import { CalendarDays, ShoppingCart, Truck, Undo2 } from 'lucide-react-native'
import DashboardShell, { PanelState } from '../../components/DashboardShell'
import { ConfirmDialog, Notice } from '../../components/builder/BuilderUi'
import { completeEquipmentRequest, equipmentErrorMessage, fetchEquipmentUsage } from '../../api/equipment'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { COLORS } from '../../theme/tokens'
import { ink } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'
import { useSupplierCountry } from './products/productParts'
import { CountTabs } from './orders/orderParts'
import { useEquipment } from './equipment/EquipmentContext'
import { EquipmentRequestFacts, RequestStatusPill, equipmentDate } from './equipment/equipmentParts'

export const ASSIGNMENT_TABS = [
  { id: 'rentals', labelKey: 'equipment.tab.activeRentals', match: (request) => request.request_kind === 'RENT' && request.status === 'ACCEPTED' },
  { id: 'purchases', labelKey: 'equipment.tab.purchases', match: (request) => request.request_kind === 'BUY' && request.status === 'ACCEPTED' },
  { id: 'completed', labelKey: 'labor.tab.completed', match: (request) => request.status === 'COMPLETED' },
]

export default function SupplierAssignmentsScreen({ route }) {
  const { t } = useLanguage()
  const { gutter } = useResponsive()
  const country = useSupplierCountry()
  const { requests, requestsStatus, refreshKey, reload } = useEquipment()
  const [tab, setTab] = useState('rentals')
  const [openId, setOpenId] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // A dashboard figure can open a given tab.
  const wanted = route?.params?.tab
  const wantedAt = route?.params?.at
  useEffect(() => {
    if (wanted && ASSIGNMENT_TABS.some((item) => item.id === wanted)) {
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

  const lists = useMemo(() => Object.fromEntries(ASSIGNMENT_TABS.map((item) => [item.id, requests.filter(item.match)])), [requests])
  const list = lists[tab] || []
  const tabs = ASSIGNMENT_TABS.map((item) => ({ id: item.id, label: t(item.labelKey), count: lists[item.id].length }))

  const complete = async (request) => {
    const rent = request.request_kind === 'RENT'
    setBusyId(request.id)
    setNotice(null)
    try {
      await completeEquipmentRequest(request.id)
      setNotice({ tone: 'success', text: t(rent ? 'equipment.msg.returned' : 'equipment.msg.delivered', { name: request.item_name }) })
      await reload()
    } catch (failure) {
      setNotice({ tone: 'error', text: equipmentErrorMessage(failure, t('equipment.error.complete')) })
    } finally {
      setBusyId(null)
      setConfirming(null)
    }
  }

  const EmptyIcon = tab === 'purchases' ? ShoppingCart : Truck

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ paddingHorizontal: gutter, gap: 12 }}>
        <Text style={styles.title}>{t('labor.nav.assignments')}</Text>
        <CountTabs tabs={tabs} active={tab} onChange={(id) => { setTab(id); setOpenId(null) }} />
        {notice?.text ? <Pressable onPress={() => setNotice(null)}><Notice tone={notice.tone} text={notice.text} /></Pressable> : null}

        {requestsStatus === 'idle' ? (
          <PanelState loading skeleton="cards" />
        ) : requestsStatus === 'error' && requests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('mobile.equipment.requestsLoadError')}</Text>
            <Pressable onPress={reload} style={{ paddingVertical: 6 }}><Text style={styles.link}>{t('dash.engineer.liveCamera.retry')}</Text></Pressable>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.empty}>
            <EmptyIcon size={30} color={COLORS.slate[300]} />
            <Text style={styles.emptyTitle}>{t(`equipment.assignments.empty.${tab}.title`)}</Text>
            <Text style={styles.emptyText}>{t(`equipment.assignments.empty.${tab}.message`)}</Text>
          </View>
        ) : list.map((request) => {
          const rent = request.request_kind === 'RENT'
          const open = openId === request.id
          const busy = busyId === request.id
          return (
            <View key={request.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.project} numberOfLines={1}>{request.project_title || t('labor.project')}</Text>
                  <Text style={styles.people} numberOfLines={1}>{t('labor.siteEngineerName', { name: request.engineer_name || '—' })}</Text>
                </View>
                <RequestStatusPill status={request.status} />
              </View>
              <View style={{ marginTop: 10 }}>
                <EquipmentRequestFacts request={request} country={country} />
              </View>
              {request.status === 'COMPLETED' && request.completed_at ? (
                <Text style={styles.done}>{t(rent ? 'equipment.returnedOn' : 'equipment.deliveredOn', { date: equipmentDate(request.completed_at) })}</Text>
              ) : null}
              {request.status === 'ACCEPTED' && !request.supplier_assignment_active ? (
                <Text style={styles.warning}>{t('equipment.assignments.unassignedContinues')}</Text>
              ) : null}

              {rent || request.status === 'ACCEPTED' ? (
                <View style={styles.actions}>
                  {rent ? (
                    <Pressable onPress={() => setOpenId(open ? null : request.id)} style={[styles.button, styles.outline]} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                      <CalendarDays size={15} color={COLORS.slate[600]} />
                      <Text style={[styles.buttonText, styles.outlineText]} numberOfLines={1}>{open ? t('equipment.usage.hide') : t('equipment.usage.view')}</Text>
                    </Pressable>
                  ) : null}
                  {request.status === 'ACCEPTED' ? (
                    <Pressable
                      onPress={() => { setNotice(null); setConfirming(request) }}
                      disabled={busy}
                      style={[styles.button, styles.primary, busy ? { opacity: 0.6 } : null]}
                      accessibilityRole="button"
                    >
                      {busy ? <PianoLoader color="#ffffff" height={14} /> : rent ? <Undo2 size={15} color="#ffffff" /> : <Truck size={15} color="#ffffff" />}
                      <Text style={[styles.buttonText, { color: '#ffffff' }]} numberOfLines={1}>
                        {rent ? t('equipment.action.markReturned') : t('equipment.action.markDelivered')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {open ? <UsageHistory requestId={request.id} refreshKey={refreshKey} /> : null}
            </View>
          )
        })}
      </View>

      <ConfirmDialog
        visible={!!confirming}
        title={confirming?.request_kind === 'RENT' ? t('equipment.action.markReturned') : t('equipment.action.markDelivered')}
        body={confirming ? t(confirming.request_kind === 'RENT' ? 'equipment.confirm.returned' : 'equipment.confirm.delivered', { count: confirming.quantity, name: confirming.item_name }) : ''}
        confirmLabel={confirming?.request_kind === 'RENT' ? t('equipment.action.markReturned') : t('equipment.action.markDelivered')}
        busy={!!busyId}
        onConfirm={() => confirming && complete(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </DashboardShell>
  )
}

/** The Site Engineer's daily usage of one rental, newest as the backend orders it. */
function UsageHistory({ requestId, refreshKey }) {
  const { t } = useLanguage()
  const [state, setState] = useState({ loading: true, logs: [], error: '' })

  useEffect(() => {
    let current = true
    fetchEquipmentUsage(requestId)
      .then((logs) => { if (current) setState({ loading: false, logs: Array.isArray(logs) ? logs : [], error: '' }) })
      .catch((failure) => { if (current) setState({ loading: false, logs: [], error: equipmentErrorMessage(failure, t('equipment.error.usageLoad')) }) })
    return () => { current = false }
    // t is read only for the fallback message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, refreshKey])

  if (state.loading) {
    return (
      <View style={styles.usageLoading}>
        <ActivityIndicator size="small" color={COLORS.brand[700]} />
        <Text style={styles.emptyText}>{t('equipment.usage.loading')}</Text>
      </View>
    )
  }
  if (state.error) return <View style={{ marginTop: 10 }}><Notice tone="error" text={state.error} /></View>
  if (!state.logs.length) return <Text style={styles.usageNone}>{t('equipment.usage.none')}</Text>

  return (
    <View style={styles.usage}>
      <View style={[styles.usageRow, styles.usageHead]}>
        <Text style={[styles.usageDate, styles.usageHeadText]}>{t('labor.field.date')}</Text>
        <Text style={[styles.usageHours, styles.usageHeadText]}>{t('equipment.field.hoursUsed')}</Text>
        <Text style={[styles.usageNotes, styles.usageHeadText]}>{t('labor.field.notes')}</Text>
      </View>
      {state.logs.map((log) => (
        <View key={log.id || log.usage_date} style={styles.usageRow}>
          <Text style={[styles.usageDate, styles.usageStrong]}>{equipmentDate(log.usage_date)}</Text>
          <Text style={[styles.usageHours, styles.usageStrong, { color: ink('#1a5038') }]}>{log.hours_used ?? '—'}</Text>
          <Text style={styles.usageNotes}>{log.notes || '—'}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = createStyles((c) => ({
  title: { fontSize: 20, letterSpacing: -0.4, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  empty: { alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, backgroundColor: c.card, paddingHorizontal: 20, paddingVertical: 30 },
  emptyTitle: { marginTop: 6, textAlign: 'center', fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  emptyText: { textAlign: 'center', fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textMuted },
  link: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  project: { fontSize: 15.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  people: { marginTop: 2, fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textMuted },
  done: { marginTop: 8, fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.skyText },
  warning: { marginTop: 8, fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_700Bold', color: c.amberText },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  button: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, paddingHorizontal: 8 },
  buttonText: { flexShrink: 1, fontSize: 13, fontFamily: 'Inter_700Bold' },
  outline: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  outlineText: { color: c.textSecondary },
  primary: { backgroundColor: '#236645' },
  usageLoading: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  usageNone: { marginTop: 10, borderRadius: 10, backgroundColor: c.subtle, paddingVertical: 14, textAlign: 'center', fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.textFaint },
  usage: { marginTop: 10, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  usageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderTopWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10, paddingVertical: 8 },
  usageHead: { borderTopWidth: 0, backgroundColor: c.subtle },
  usageHeadText: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textFaint },
  usageDate: { width: 92, fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textSecondary },
  usageHours: { width: 58, textAlign: 'center', fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textSecondary },
  usageNotes: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', color: c.textSecondary },
  usageStrong: { fontFamily: 'Inter_700Bold', color: c.text },
}))
