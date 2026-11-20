// Site Engineers' labour requests to this supplier: port of the web
// SupplierLaborSections LaborRequestsSection, AcceptDialog and RejectDialog.
//
// Accept asks how many workers to allocate: at least 1, at most what was
// required and what this trade has free (fewer than required is allowed and
// shown as a partial allocation). The backend decides; its refusal is shown
// as sent. `compact`: the dashboard's short list of pending requests.
import { useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { CheckCircle2, ClipboardList, HardHat, XCircle } from 'lucide-react-native'
import { PanelState } from '../../../components/DashboardShell'
import { ActionButton, LabeledInput, SheetModal } from '../../../components/builder/BuilderUi'
import { toast } from '../../../components/Toast'
import { acceptLabourRequest, labourErrorMessage, rejectLabourRequest } from '../../../api/labour'
import { useLanguage } from '../../../i18n/LanguageContext'
import { COLORS } from '../../../theme/tokens'
import { ink } from '../../../theme/tint'
import { createStyles } from '../../../theme/createStyles'
import { CountTabs } from '../orders/orderParts'
import { NumberField } from '../products/productParts'
import { REQUEST_STATUSES, RequestStatusPill } from '../equipment/equipmentParts'
import { useLabour } from './LabourContext'
import { LabourRequestFacts, availabilityText } from './labourParts'

const FILTERS = [...REQUEST_STATUSES, 'ALL']

export default function LabourRequests({ compact = false }) {
  const { t, td } = useLanguage()
  const { requests, services, requestsStatus, reload } = useLabour()
  const [filter, setFilter] = useState('PENDING')
  const [accepting, setAccepting] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const serviceByTrade = useMemo(() => Object.fromEntries(services.map((service) => [service.trade, service])), [services])

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

  if (requestsStatus === 'idle') return <PanelState loading skeleton="cards" count={compact ? 2 : 3} />
  if (requestsStatus === 'error' && requests.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('mobile.labour.requestsLoadError')}</Text>
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
          <Text style={styles.emptyTitle}>{compact || filter === 'PENDING' ? t('labor.requests.emptyPending') : t('labor.requests.emptyFiltered')}</Text>
          <Text style={styles.emptyText}>{t('labor.requests.emptyMessage')}</Text>
        </View>
      ) : visible.map((request) => {
        const pending = request.status === 'PENDING'
        const service = serviceByTrade[request.trade]
        return (
          <View key={request.id} style={[styles.card, pending ? styles.cardPending : null]}>
            <View style={styles.cardTop}>
              <View style={styles.kindRow}>
                <HardHat size={14} color={ink('#1a5038')} />
                <Text style={styles.kind} numberOfLines={1}>{pending ? t('labor.requests.newLabel') : t('labor.requests.label')}</Text>
              </View>
              <RequestStatusPill status={request.status} />
            </View>
            <Text style={styles.project} numberOfLines={1}>{td(request.project_title) || t('labor.project')}</Text>
            <Text style={styles.people} numberOfLines={2}>
              {t('labor.siteEngineerName', { name: request.engineer_name || '—' })}
              {request.contractor_name ? ` · ${t('labor.builderName', { name: request.contractor_name })}` : ''}
            </Text>
            <View style={{ marginTop: 10 }}>
              <LabourRequestFacts request={request} showAllocated={request.workers_allocated != null} />
            </View>
            {request.work_description ? <Text style={styles.notes}>{td(request.work_description)}</Text> : null}
            {request.decision_note ? <Text style={styles.decision}>{t('labor.noteLine', { note: request.decision_note })}</Text> : null}
            {pending ? (
              <>
                <Text style={styles.availability}>
                  {availabilityText(t, request, service)}
                  {!request.supplier_assignment_active ? ` · ${t('labor.requests.unassigned')}` : ''}
                </Text>
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
              </>
            ) : null}
          </View>
        )
      })}
      {accepting ? <AcceptSheet request={accepting} service={serviceByTrade[accepting.trade]} onClose={() => setAccepting(null)} onDone={finish} /> : null}
      {rejecting ? <RejectSheet request={rejecting} onClose={() => setRejecting(null)} onDone={finish} /> : null}
    </View>
  )
}

function AcceptSheet({ request, service, onClose, onDone }) {
  const { t, td } = useLanguage()
  const required = Number(request.workers_required) || 0
  const available = service?.is_active ? Number(service.available_workers || 0) : 0
  const maxAllocatable = Math.min(required, available)
  const [workers, setWorkers] = useState(maxAllocatable > 0 ? String(maxAllocatable) : '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [workersError, setWorkersError] = useState('')
  const project = td(request.project_title) || t('labor.theProject')
  const value = Number(workers)
  const partial = Number.isInteger(value) && value >= 1 && value < required

  const accept = async () => {
    const problem = !Number.isInteger(value) || value < 1 ? t('labor.error.allocateOne')
      : value > required ? t('labor.error.allocateMax', { count: required })
        : value > available ? t('labor.error.allocateAvailable', { count: available, trade: request.trade })
          : ''
    if (problem) {
      setWorkersError(problem)
      toast.error(problem)
      return
    }
    setBusy(true)
    try {
      await acceptLabourRequest(request.id, { workers_allocated: value, decision_note: note.trim() || null })
      onDone({ tone: 'success', text: t('labor.msg.accepted', { count: value, trade: request.trade, project }) })
    } catch (failure) {
      toast.error(labourErrorMessage(failure, t('labor.error.accept')))
      setBusy(false)
    }
  }

  return (
    <SheetModal
      visible
      title={t('labor.requests.acceptTitle')}
      subtitle={`${project} · ${td(request.trade)} · ${t('labor.requests.requiredCount', { count: required })}`}
      onClose={busy ? () => {} : onClose}
      footer={(
        <View style={styles.sheetButtons}>
          <ActionButton label={t('labor.action.cancel')} tone="outline" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
          <ActionButton label={t('labor.action.accept')} icon={CheckCircle2} onPress={accept} busy={busy} disabled={maxAllocatable < 1} style={{ flex: 1 }} />
        </View>
      )}
    >
      <Text style={styles.availabilityBox}>{availabilityText(t, request, service)}</Text>
      <View style={{ marginTop: 12 }}>
        <NumberField
          label={t('labor.field.workersToAllocate')}
          value={workers}
          onChangeText={(text) => { setWorkers(text); setWorkersError('') }}
          decimal={false}
          error={workersError}
        />
      </View>
      {partial ? (
        <Text style={styles.partialHint}>
          {t('labor.allocation.willBePartial', { allocated: value, required, shortfall: required - value })}
        </Text>
      ) : null}
      <View style={{ marginTop: 12 }}>
        <LabeledInput label={t('labor.field.noteOptional')} value={note} onChangeText={setNote} maxLength={500} />
      </View>
    </SheetModal>
  )
}

function RejectSheet({ request, onClose, onDone }) {
  const { t, td } = useLanguage()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const reject = async () => {
    setBusy(true)
    try {
      await rejectLabourRequest(request.id, note.trim())
      onDone({ tone: 'success', text: t('labor.msg.rejected', { name: request.engineer_name || t('labor.theSiteEngineer') }) })
    } catch (failure) {
      toast.error(labourErrorMessage(failure, t('labor.error.reject')))
      setBusy(false)
    }
  }

  return (
    <SheetModal
      visible
      title={t('labor.requests.rejectTitle')}
      subtitle={`${td(request.project_title) || t('labor.project')} · ${td(request.trade)} · ${t('labor.requests.workersCount', { count: request.workers_required })}`}
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
  availability: { marginTop: 8, fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_700Bold', color: c.textMuted },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  button: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11 },
  buttonText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  reject: { borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft },
  rejectText: { color: c.roseText },
  accept: { backgroundColor: '#236645' },
  availabilityBox: { overflow: 'hidden', borderRadius: 11, backgroundColor: c.subtle, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  partialHint: { marginTop: 6, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', color: c.amberText },
  sheetButtons: { flexDirection: 'row', gap: 10 },
}))
