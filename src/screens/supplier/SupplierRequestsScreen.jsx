// The supplier's Requests tab: the web dashboard's Requests section for a
// Material Supplier -- a "Purchase Requests | Client Requests" strip.
//
//   Purchase Requests  port of web pages/supplier/SupplierPurchaseRequests.jsx:
//     what buyers bought from THIS supplier with "Buy" (GET
//     /supplier/material-requests, grouped by request code). Accept Order /
//     Reject Order decide the whole request at once (POST
//     /supplier/purchase-requests/{code}/respond); fulfilment stays in Orders.
//   Client Requests    partnership requests from House Owners and Builders,
//     accepted or rejected through the project-request endpoints.
//
// An Equipment or Labour Supplier has Site Engineers' Equipment / Labour
// Requests in place of Purchase Requests (equipment/EquipmentRequests,
// labour/LabourRequests), as on the web.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Check, CheckCircle2, ChevronRight, MapPin, PackageOpen, X, XCircle } from 'lucide-react-native'
import DashboardShell, { PanelState } from '../../components/DashboardShell'
import { Notice } from '../../components/builder/BuilderUi'
import { toast } from '../../components/Toast'
import { fetchSupplierMaterialRequests, respondPurchaseRequest } from '../../api/materialRequests'
import { fetchIncomingRequests } from '../../api/requests'
import { useProfileGate } from '../../hooks/useProfileGate'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { formatDate, formatDateTime } from '../../utils/formatters'
import { userAvatarSource } from '../../utils/avatars'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import { money, useSupplierCountry } from './products/productParts'
import { CountTabs, BuyerAvatar, OrderSheet, ROLE_LABEL, StatusPill, groupPurchaseRequests } from './orders/orderParts'
import { Avatar, CLIENT_ROLE_KEYS, RequestProfileSheet, RequestStatusLine, requestView, useClientRequestActions } from './clients/clientParts'
import { useSupplier } from './SupplierContext'
import { EQUIPMENT, LABOUR } from './supplierKinds'
import { useEquipment } from './equipment/EquipmentContext'
import EquipmentRequests from './equipment/EquipmentRequests'
import { useLabour } from './labour/LabourContext'
import LabourRequests from './labour/LabourRequests'

// A new Buy shows up without a pull, every 30 s while the tab is open.
const REFRESH_MS = 30000

export default function SupplierRequestsScreen() {
  const { t } = useLanguage()
  const { gutter } = useResponsive()
  const [kind, setKind] = useState('purchase')
  const [refreshing, setRefreshing] = useState(false)
  const supplierKind = useSupplier().kind
  const isEquipment = supplierKind === EQUIPMENT
  const isLabour = supplierKind === LABOUR
  const equipment = useEquipment()
  const labour = useLabour()
  const purchases = usePurchaseRequests(!isEquipment && !isLabour)
  const clients = useClientRequests()
  const reloadEquipment = equipment.reload
  const reloadLabour = labour.reload
  // New equipment / labour requests show up without a pull when the tab is opened.
  useFocusEffect(useCallback(() => {
    if (isEquipment) reloadEquipment()
    if (isLabour) reloadLabour()
  }, [isEquipment, isLabour, reloadEquipment, reloadLabour]))

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([isEquipment ? reloadEquipment() : isLabour ? reloadLabour() : purchases.load(), clients.load()])
    setRefreshing(false)
  }

  const pendingOf = (list) => list.filter((request) => request.status === 'PENDING').length
  const kinds = [
    isEquipment
      ? { id: 'purchase', label: t('equipment.supplier.requestsKind'), count: pendingOf(equipment.requests) }
      : isLabour
        ? { id: 'purchase', label: t('labor.supplier.requestsKind'), count: pendingOf(labour.requests) }
        : { id: 'purchase', label: 'Purchase Requests', count: purchases.pendingCount },
    { id: 'client', label: 'Client Requests', count: clients.pendingCount },
  ]

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ paddingHorizontal: gutter, gap: 12 }}>
        <Text style={styles.title}>{t('ui.requests')}</Text>
        <CountTabs tabs={kinds} active={kind} onChange={setKind} newBadge />
        {kind === 'client'
          ? <ClientRequests state={clients} />
          : isEquipment ? <EquipmentRequests /> : isLabour ? <LabourRequests /> : <PurchaseRequests state={purchases} />}
      </View>
    </DashboardShell>
  )
}

// ---------------------------------------------------------------- purchase requests

// `enabled` false (an Equipment Supplier): nothing is fetched.
function usePurchaseRequests(enabled = true) {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      setRows((await fetchSupplierMaterialRequests()) || [])
      setStatus('ready')
      setError('')
    } catch (failure) {
      setError(failure?.response?.data?.detail || 'Purchase requests could not be loaded.')
      setStatus((current) => (current === 'ready' ? 'ready' : 'error'))
    }
  }, [])
  useFocusEffect(useCallback(() => {
    if (!enabled) return undefined
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load, enabled]))
  useLiveRefresh(enabled ? load : null)
  const requests = useMemo(() => groupPurchaseRequests(rows), [rows])
  return { requests, status, error, load, pendingCount: requests.filter((request) => request.status === 'PENDING').length }
}

function PurchaseRequests({ state }) {
  const { t, td } = useLanguage()
  const country = useSupplierCountry()
  const { requireCompleteProfile } = useProfileGate()
  const [openCode, setOpenCode] = useState(null)
  const [busy, setBusy] = useState(false)
  const fmt = (value) => money(value, country)
  const open = state.requests.find((request) => request.code === openCode) || null

  // The whole request in one call: the server saves the status and notifies
  // the buyer together, or does neither. Accepting needs a complete profile.
  async function respond(request, action) {
    if (action === 'ACCEPT' && requireCompleteProfile(() => respond(request, action))) return
    setBusy(true)
    try {
      await respondPurchaseRequest(request.code, action)
      toast.success(`${action === 'ACCEPT' ? 'Order accepted successfully.' : 'Order rejected successfully.'} ${request.buyer || 'The buyer'} has been notified.`)
    } catch (failure) {
      toast.error(failure?.response?.data?.detail || 'The order could not be updated. Nothing was changed.')
    }
    await state.load()
    setBusy(false)
  }

  const decision = (request, compact = false) => (request.status === 'PENDING' ? (
    <View style={[styles.actions, compact ? null : { marginTop: 14 }]}>
      <Pressable onPress={() => respond(request, 'REJECT')} disabled={busy} style={[styles.button, styles.reject, busy ? styles.dim : null]}>
        <XCircle size={15} color="#be123c" />
        <Text style={[styles.buttonText, styles.rejectText]}>{compact ? 'Reject' : 'Reject Order'}</Text>
      </Pressable>
      <Pressable onPress={() => respond(request, 'ACCEPT')} disabled={busy} style={[styles.button, styles.accept, busy ? styles.dim : null]}>
        <CheckCircle2 size={15} color="#ffffff" />
        <Text style={[styles.buttonText, { color: '#ffffff' }]}>{compact ? 'Accept' : 'Accept Order'}</Text>
      </Pressable>
    </View>
  ) : !compact ? (
    <Text style={styles.decided}>
      {request.status === 'REJECTED' ? 'Order rejected. House Owner notified.' : `Order accepted. ${ROLE_LABEL[request.buyerRole] || 'Buyer'} notified. Fulfil accepted orders from Orders.`}
    </Text>
  ) : null)

  if (state.status === 'loading') return <PanelState loading skeleton="cards" />
  if (state.status === 'error') return <Notice tone="error" text={state.error} />

  return (
    <>
      {state.requests.length === 0 ? (
        <View style={styles.empty}>
          <PackageOpen size={30} color={COLORS.slate[300]} />
          <Text style={styles.emptyTitle}>No purchase requests yet</Text>
          <Text style={styles.emptyText}>When a buyer clicks Buy on your products, the request appears here.</Text>
        </View>
      ) : state.requests.map((request) => {
        const pending = request.status === 'PENDING'
        return (
          <View key={request.code} style={[styles.card, pending ? styles.cardPending : null]}>
            <Pressable onPress={() => setOpenCode(request.code)} accessibilityRole="button" accessibilityLabel="View Request">
              <View style={styles.cardTop}>
                <BuyerAvatar order={request} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.code}>
                    {pending ? '● ' : ''}{request.code.slice(0, 8).toUpperCase()}
                  </Text>
                  <Text style={styles.buyer} numberOfLines={1}>{request.buyer || 'Buyer'}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{ROLE_LABEL[request.buyerRole] || request.buyerRole || '—'}</Text>
                </View>
                <StatusPill status={request.status} label={request.status} />
              </View>
              <View style={styles.lines}>
                {request.items.map((line) => (
                  <View key={line.id} style={styles.lineRow}>
                    <Text style={styles.lineName} numberOfLines={1}>
                      {line.material_name}
                      {line.brand || line.size ? <Text style={styles.meta}>{` · ${[line.brand, line.size].filter(Boolean).join(' · ')}`}</Text> : null}
                    </Text>
                    <Text style={styles.lineQty}>{`${Number(line.quantity).toLocaleString('en-IN')} ${line.unit || ''}`}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.cardFoot}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.meta} numberOfLines={1}>{td(request.project) || '—'}</Text>
                  <View style={styles.place}>
                    <MapPin size={11} color={COLORS.brand[700]} />
                    <Text style={styles.meta} numberOfLines={1}>{[request.pincode, request.city].filter(Boolean).join(', ') || '—'}</Text>
                  </View>
                  <Text style={styles.metaFaint}>{formatDateTime(request.placedAt, '—')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.total}>{fmt(request.total)}</Text>
                  <View style={styles.viewLink}>
                    <Text style={styles.viewText}>View Request</Text>
                    <ChevronRight size={13} color={COLORS.brand[700]} />
                  </View>
                </View>
              </View>
            </Pressable>
            {pending ? <View style={{ marginTop: 10 }}>{decision(request, true)}</View> : null}
          </View>
        )
      })}

      <OrderSheet
        order={open}
        title={open ? `Purchase request ${open.code.slice(0, 8).toUpperCase()}` : ''}
        money={fmt}
        onClose={() => setOpenCode(null)}
      >
        {open ? decision(open) : null}
      </OrderSheet>
    </>
  )
}

// ---------------------------------------------------------------- client requests

function useClientRequests() {
  const [list, setList] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const data = await fetchIncomingRequests()
      setList(Array.isArray(data) ? data : [])
      setStatus('ready')
      setError('')
    } catch (failure) {
      setError(failure?.response?.data?.detail || 'Requests could not be loaded.')
      setStatus((current) => (current === 'ready' ? 'ready' : 'error'))
    }
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(load)
  const pendingCount = list.filter((request) => requestView(request).canAct).length
  return { list, status, error, load, pendingCount }
}

function ClientRequests({ state }) {
  const { t, td } = useLanguage()
  const [tab, setTab] = useState('all')
  const [profile, setProfile] = useState(null)
  const actions = useClientRequestActions(state.load)

  const ownerList = state.list.filter((request) => String(request.request_type || '').includes('OWNER'))
  const builderList = state.list.filter((request) => String(request.request_type || '').includes('CONTRACTOR'))
  const tabs = [
    { id: 'all', label: t('dash.contractor.filter.all'), count: state.list.length },
    { id: 'owner', label: t('role.owner'), count: ownerList.length },
    { id: 'builder', label: t('role.builder'), count: builderList.length },
  ]
  const visible = tab === 'owner' ? ownerList : tab === 'builder' ? builderList : state.list

  if (state.status === 'loading') return <PanelState loading skeleton="cards" />
  if (state.status === 'error') return <Notice tone="error" text={state.error} />

  return (
    <>
      <CountTabs tabs={tabs} active={tab} onChange={setTab} />
      {visible.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No pending requests here right now.</Text></View>
      ) : visible.map((request) => {
        const { name, canAct, canOpen, canWithdraw } = requestView(request)
        const busy = actions.busyId === request.id
        const role = CLIENT_ROLE_KEYS[request.sender_role] ? t(CLIENT_ROLE_KEYS[request.sender_role]) : (request.sender_role || '—')
        const place = [request.project_address, request.project_pincode].filter(Boolean).map((value) => td(value)).join(', ')
        return (
          <Pressable key={request.id} onPress={canOpen ? () => setProfile(request) : undefined} disabled={!canOpen} style={styles.card}>
            <View style={styles.cardTop}>
              <Avatar source={userAvatarSource(request)} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.buyer} numberOfLines={1}>{td(name) || '—'}</Text>
                <Text style={styles.meta} numberOfLines={1}>{`#${request.id} · ${role}`}</Text>
              </View>
              {canOpen ? <ChevronRight size={16} color={COLORS.slate[400]} /> : null}
            </View>
            <View style={styles.lines}>
              <Text style={styles.lineName} numberOfLines={1}>{td(request.project_title) || '—'}</Text>
              {place ? (
                <View style={styles.place}>
                  <MapPin size={11} color={COLORS.brand[700]} />
                  <Text style={styles.meta} numberOfLines={1}>{place}</Text>
                </View>
              ) : null}
              <Text style={styles.metaFaint}>{formatDate(request.created_at, '—')}</Text>
            </View>
            <View style={styles.cardFoot}>
              <View style={{ flex: 1, minWidth: 0 }}><RequestStatusLine request={request} /></View>
              {canOpen ? <Text style={styles.viewText}>{t('dash.common.viewProfile')}</Text> : null}
              {canWithdraw ? (
                <Pressable onPress={() => actions.withdraw(request.id)} disabled={busy} style={[styles.smallButton, busy ? styles.dim : null]}>
                  <Text style={styles.smallButtonText}>{t('property.action.withdraw')}</Text>
                </Pressable>
              ) : null}
            </View>
            {canAct ? (
              <View style={[styles.actions, { marginTop: 10 }]}>
                <Pressable onPress={() => actions.reject(request.id)} disabled={busy} style={[styles.button, styles.reject]}>
                  <X size={14} color="#be123c" />
                  <Text style={[styles.buttonText, styles.rejectText]}>{t('dash.common.reject')}</Text>
                </Pressable>
                <Pressable onPress={() => actions.accept(request.id)} disabled={busy} style={[styles.button, styles.accept, busy ? styles.dim : null]}>
                  <Check size={14} color="#ffffff" />
                  <Text style={[styles.buttonText, { color: '#ffffff' }]}>{t('dash.common.accept')}</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        )
      })}
      {profile ? <RequestProfileSheet details={profile} onClose={() => setProfile(null)} /> : null}
    </>
  )
}

const styles = createStyles((c) => ({
  title: { fontSize: 20, letterSpacing: -0.4, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  empty: { alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, backgroundColor: c.card, paddingHorizontal: 20, paddingVertical: 30 },
  emptyTitle: { marginTop: 6, fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  emptyText: { textAlign: 'center', fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textMuted },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 13 },
  cardPending: { borderColor: '#fcd34d', backgroundColor: c.amberSoft },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: c.amberTextStrong },
  buyer: { fontSize: 14.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  meta: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  metaFaint: { marginTop: 1, fontSize: 11, fontFamily: 'Inter_500Medium', color: c.textFaint },
  lines: { marginTop: 10, gap: 4, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 9 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineName: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text },
  lineQty: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  cardFoot: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 9 },
  place: { marginTop: 1, flexDirection: 'row', alignItems: 'center', gap: 3 },
  total: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  viewLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  actions: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11 },
  buttonText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  reject: { borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft },
  rejectText: { color: c.roseText },
  accept: { backgroundColor: '#236645' },
  dim: { opacity: 0.6 },
  smallButton: { borderRadius: 9, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 11, paddingVertical: 6 },
  smallButtonText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  decided: { marginTop: 14, fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
}))
