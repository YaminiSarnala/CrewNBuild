// Site Engineers' equipment requests to this supplier: port of the web
// SupplierEquipmentSections EquipmentRequestsSection, AcceptDialog and
// RejectDialog.
//
// Accept and Reject send the request id only; the backend decides (it may
// refuse, e.g. not enough units free on those dates) and its message is shown
// as sent, never retried. `compact`: the dashboard's short list of pending
// requests, with no status filter.
import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { CheckCircle2, ClipboardList, ShoppingCart, Truck, XCircle } from 'lucide-react-native'
import { PanelState } from '../../../components/DashboardShell'
import { ActionButton, LabeledInput, SheetModal } from '../../../components/builder/BuilderUi'
import { toast } from '../../../components/Toast'
import { acceptEquipmentRequest, equipmentErrorMessage, rejectEquipmentRequest } from '../../../api/equipment'
import { useLanguage } from '../../../i18n/LanguageContext'
import { COLORS } from '../../../theme/tokens'
import { ink } from '../../../theme/tint'
import { createStyles } from '../../../theme/createStyles'
import { money, useSupplierCountry } from '../products/productParts'
import { CountTabs } from '../orders/orderParts'
import { useEquipment } from './EquipmentContext'
import { EquipmentRequestFacts, REQUEST_STATUSES, RequestStatusPill, equipmentDate, kindLabel, ratePer } from './equipmentParts'

const FILTERS = [...REQUEST_STATUSES, 'ALL']

export default function EquipmentRequests({ compact = false }) {
  const { t } = useLanguage()
  const country = useSupplierCountry()
  const { requests, requestsStatus, reload } = useEquipment()
  const [filter, setFilter] = useState('PENDING')
  const [accepting, setAccepting] = useState(null)
  const [rejecting, setRejecting] = useState(null)

  const visible = compact
    ? requests.filter((request) => request.status === 'PENDING').slice(0, 4)
    : requests.filter((request) => filter === 'ALL' || request.status === filter)
  const tabs = FILTERS.map((id) => ({
    id,
    label: id === 'ALL' ? t('labor.filter.all') : t(`labor.status.${id}`),
    count: id === 'ALL' ? requests.length : requests.filter((request) => request.status === id).length,
  }))

  const finish = (result) => {
    setAccepting(null)
    setRejecting(null)
    if (result?.text) toast.show(result.text, result.tone || 'success')
    reload()
  }

  const heading = (request) => {
    const rent = request.request_kind === 'RENT'
    if (request.status === 'PENDING') return t(rent ? 'equipment.requests.newRental' : 'equipment.requests.newPurchase')
    return t(rent ? 'equipment.requests.rental' : 'equipment.requests.purchase')
  }

  if (requestsStatus === 'idle') return <PanelState loading skeleton="cards" count={compact ? 2 : 3} />
  if (requestsStatus === 'error' && requests.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('mobile.equipment.requestsLoadError')}</Text>
        <Pressable onPress={reload} style={{ paddingVertical: 6 }}><Text style={styles.link}>{t('dash.engineer.liveCamera.retry')}</Text></Pressable>
      </View>
    )
  }

  return (
    <View style={{ gap: 12 }}>
      {!compact ? <CountTabs tabs={tabs} active={filter} onChange={setFilter} /> : null}
      {visible.length === 0 ? (
        <View style={styles.empty}>
          <ClipboardList size={30} color={COLORS.slate[300]} />
          <Text style={styles.emptyTitle}>
            {compact || filter === 'PENDING' ? t('equipment.requests.emptyPending') : t('equipment.requests.emptyFiltered')}
          </Text>
          <Text style={styles.emptyText}>{t('equipment.requests.emptyMessage')}</Text>
        </View>
      ) : visible.map((request) => {
        const pending = request.status === 'PENDING'
        const KindIcon = request.request_kind === 'RENT' ? Truck : ShoppingCart
        return (
          <View key={request.id} style={[styles.card, pending ? styles.cardPending : null]}>
            <View style={styles.cardTop}>
              <View style={styles.kindRow}>
                <KindIcon size={14} color={ink('#1a5038')} />
                <Text style={styles.kind} numberOfLines={1}>{heading(request)}</Text>
              </View>
              <RequestStatusPill status={request.status} />
            </View>
            <Text style={styles.project} numberOfLines={1}>{request.project_title || t('labor.project')}</Text>
            <Text style={styles.people} numberOfLines={2}>
              {t('labor.siteEngineerName', { name: request.engineer_name || '—' })}
              {request.contractor_name ? ` · ${t('labor.builderName', { name: request.contractor_name })}` : ''}
            </Text>
            <View style={{ marginTop: 10 }}>
              <EquipmentRequestFacts request={request} country={country} />
            </View>
            {request.notes ? <Text style={styles.notes}>{request.notes}</Text> : null}
            {request.decision_note ? <Text style={styles.decision}>{t('labor.noteLine', { note: request.decision_note })}</Text> : null}
            {pending && !request.supplier_assignment_active ? <Text style={styles.warning}>{t('labor.requests.unassigned')}</Text> : null}
            {pending ? (
              <View style={styles.actions}>
                <Pressable onPress={() => setRejecting(request)} style={[styles.button, styles.reject]} accessibilityRole="button">
                  <XCircle size={15} color={ink('#be123c')} />
                  <Text style={[styles.buttonText, styles.rejectText]}>{t('labor.action.reject')}</Text>
                </Pressable>
                <Pressable onPress={() => setAccepting(request)} style={[styles.button, styles.accept]} accessibilityRole="button">
                  <CheckCircle2 size={15} color="#ffffff" />
                  <Text style={[styles.buttonText, { color: '#ffffff' }]}>{t('labor.action.accept')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )
      })}
      {accepting ? <AcceptSheet request={accepting} country={country} onClose={() => setAccepting(null)} onDone={finish} /> : null}
      {rejecting ? <RejectSheet request={rejecting} onClose={() => setRejecting(null)} onDone={finish} /> : null}
    </View>
  )
}

function AcceptSheet({ request, country, onClose, onDone }) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const rent = request.request_kind === 'RENT'
  const total = Number(request.unit_price || 0) * Number(request.quantity || 0)
  const rows = [
    [t('equipment.field.equipment'), request.item_name || '—'],
    [t('equipment.field.quantity'), String(request.quantity ?? '—')],
    ...(rent
      ? [
          [t('equipment.field.rate'), `${money(request.unit_price, country)} / ${ratePer(t, request.rate_unit)}`],
          [t('equipment.field.rentalPeriod'), `${equipmentDate(request.start_date)} – ${equipmentDate(request.end_date)}`],
          [t('equipment.field.forAllUnits'), `${money(total, country)} / ${ratePer(t, request.rate_unit)}`],
        ]
      : [
          [t('equipment.field.salePrice'), money(request.unit_price, country)],
          [t('equipment.field.total'), money(total, country)],
        ]),
  ]

  const accept = async () => {
    setBusy(true)
    try {
      await acceptEquipmentRequest(request.id)
      onDone({ tone: 'success', text: t(rent ? 'equipment.msg.rentalAccepted' : 'equipment.msg.purchaseAccepted', { count: request.quantity, name: request.item_name }) })
    } catch (failure) {
      toast.error(equipmentErrorMessage(failure, t('labor.error.accept')))
      setBusy(false)
    }
  }

  return (
    <SheetModal
      visible
      title={rent ? t('equipment.requests.acceptRentalTitle') : t('equipment.requests.acceptPurchaseTitle')}
      subtitle={request.project_title || undefined}
      onClose={busy ? () => {} : onClose}
      footer={(
        <View style={styles.sheetButtons}>
          <ActionButton label={t('labor.action.cancel')} tone="outline" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
          <ActionButton label={t('labor.action.accept')} icon={CheckCircle2} onPress={accept} busy={busy} style={{ flex: 1 }} />
        </View>
      )}
    >
      <View style={styles.rows}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>{rent ? t('equipment.requests.acceptRentalHint') : t('equipment.requests.acceptPurchaseHint')}</Text>
    </SheetModal>
  )
}

function RejectSheet({ request, onClose, onDone }) {
  const { t } = useLanguage()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const reject = async () => {
    setBusy(true)
    try {
      await rejectEquipmentRequest(request.id, note.trim())
      onDone({ tone: 'success', text: t('equipment.msg.rejected', { name: request.item_name }) })
    } catch (failure) {
      toast.error(equipmentErrorMessage(failure, t('labor.error.reject')))
      setBusy(false)
    }
  }

  return (
    <SheetModal
      visible
      title={t('equipment.requests.rejectTitle')}
      subtitle={`${request.project_title || t('labor.project')} · ${kindLabel(t, request.request_kind)} ${request.quantity} x ${request.item_name}`}
      onClose={busy ? () => {} : onClose}
      footer={(
        <View style={styles.sheetButtons}>
          <ActionButton label={t('labor.action.cancel')} tone="outline" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
          <ActionButton label={t('labor.action.reject')} icon={XCircle} tone="danger" onPress={reject} busy={busy} style={{ flex: 1 }} />
        </View>
      )}
    >
      <LabeledInput label={t('labor.field.reasonOptional')} value={note} onChangeText={setNote} multiline maxLength={500} />
    </SheetModal>
  )
}

const styles = createStyles((c) => ({
  empty: { alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, backgroundColor: c.card, paddingHorizontal: 20, paddingVertical: 30 },
  emptyTitle: { marginTop: 6, textAlign: 'center', fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  emptyText: { textAlign: 'center', fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textMuted },
  link: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 13 },
  cardPending: { borderColor: '#fcd34d', backgroundColor: c.amberSoft },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  kind: { flexShrink: 1, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, textTransform: 'uppercase', color: c.brandText },
  project: { marginTop: 8, fontSize: 15.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  people: { marginTop: 2, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', color: c.textMuted },
  notes: { marginTop: 8, borderRadius: 10, backgroundColor: c.subtle, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textSecondary },
  decision: { marginTop: 8, fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.textMuted },
  warning: { marginTop: 8, fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.amberText },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  button: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11 },
  buttonText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  reject: { borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft },
  rejectText: { color: c.roseText },
  accept: { backgroundColor: '#236645' },
  rows: { gap: 9, borderRadius: 12, backgroundColor: c.subtle, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowLabel: { width: '40%', fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  hint: { marginTop: 12, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', color: c.textMuted },
  sheetButtons: { flexDirection: 'row', gap: 10 },
}))
