// The Site Engineer's Labor tab — port of the web pages/engineer/EngineerLaborPanel.jsx.
// Shows ONLY the Labor Supplier(s) the Builder assigned to this engineer on the
// selected project (GET /projects/{id}/suppliers) — never a marketplace.
// Flow: Request Labor -> supplier accepts/rejects -> an accepted request is the
// project's labour assignment -> daily attendance (counts only) -> Complete.
// No quotation, negotiation or payment.
import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { CalendarDays, CheckCircle2, HardHat, Pencil, Send, UserRound, XCircle } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { fetchProjectSuppliers } from '../../api/engineers'
import { fetchLaborDailyRecords, fetchProjectLaborRequests, saveLaborDailyRecord, supplyErrorMessage } from '../../api/siteResources'
import {
  LABOR_SUPPLIER_CATEGORY, cancelLaborRequest, completeLaborRequest, createLaborRequest, fetchLaborTrades,
  fetchProjectLaborSupplierServices, localIsoDate,
} from '../../api/supply'
import { allocationSummary, availableCount, offeredServices, workersRequestError } from '../../utils/laborRequestRules'
import { ActionButton, SelectChip, SheetModal } from '../../components/builder/BuilderUi'
import { DateField } from '../../components/form'
import { EmptyCard } from './engineerParts'
import {
  ChoiceRow, Fact, Field, Input, LaborRecordsList, Loading, RequestTabs, SupplyNotice, SupplyStatusBadge,
  confirmAsync, formatSupplyDate,
} from './supplyParts'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

const isLaborSupplier = (supplier) => supplier?.supplier_category === LABOR_SUPPLIER_CATEGORY
const digits = (value) => value.replace(/[^\d]/g, '')
const decimal = (value) => value.replace(/[^\d.]/g, '')

// ------------------------------------------------------------ request form

function RequestLaborSheet({ projectId, supplier, services, trades, tradesError = '', onClose, onSent, onStale }) {
  const { t } = useLanguage()
  // The trades follow the backend's list, narrowed to what this supplier offers.
  const offered = useMemo(() => offeredServices(services, trades), [services, trades])
  const today = localIsoDate()
  const [form, setForm] = useState({ trade: offered[0]?.trade || '', workers_required: '', start_date: today, end_date: '', work_description: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }))
  useEffect(() => {
    if (offered.length && !offered.some((service) => service.trade === form.trade)) {
      setForm((current) => ({ ...current, trade: offered[0].trade }))
    }
  }, [offered, form.trade])
  const selected = offered.find((service) => service.trade === form.trade)
  const available = availableCount(selected)
  const supplierName = supplier.store_name || supplier.name
  const workersError = form.workers_required === '' ? null : workersRequestError(form.workers_required, selected)
  const noneAvailable = Boolean(selected) && available < 1

  const submit = async () => {
    setError('')
    const workers = Number(form.workers_required)
    if (!form.trade) { setError(t('labor.error.chooseTrade')); return }
    const invalid = workersRequestError(form.workers_required, selected)
    if (invalid) { setError(t(invalid.key, invalid.params)); return }
    if (!form.start_date) { setError(t('labor.error.startDate')); return }
    if (form.end_date && form.end_date < form.start_date) { setError(t('labor.error.endBeforeStart')); return }
    // The request has one free-text field; notes travel inside it, labelled.
    const description = [form.work_description.trim(), form.notes.trim() ? `${t('labor.field.notes')}: ${form.notes.trim()}` : ''].filter(Boolean).join('\n\n')
    setBusy(true)
    try {
      await createLaborRequest(projectId, {
        supplier_id: supplier.user_id,
        trade: form.trade,
        workers_required: workers,
        start_date: form.start_date,
        end_date: form.end_date || null,
        work_description: description || null,
      })
      onSent({ tone: 'success', text: t('labor.msg.requestSent', { name: supplierName }) })
    } catch (failure) {
      setError(supplyErrorMessage(failure, t('labor.error.requestSend')))
      setBusy(false)
      // Availability moved since this screen loaded: show the current figure.
      if (failure?.response?.status === 409) onStale?.()
    }
  }

  return (
    <SheetModal
      visible
      tall
      title={t('labor.engineer.requestLabor')}
      onClose={onClose}
      footer={(
        <View style={styles.footer}>
          <ActionButton small tone="outline" label={t('labor.action.cancel')} onPress={onClose} />
          <ActionButton small icon={Send} label={t('labor.engineer.sendRequest')} onPress={submit} busy={busy} disabled={busy || !offered.length || noneAvailable || Boolean(workersError)} />
        </View>
      )}
    >
      <Field label={t('labor.engineer.laborSupplier')}>
        {/* Fixed to the Builder's assignment; there is nothing to choose. */}
        <Input value={supplierName} editable={false} />
      </Field>
      <Field label={t('labor.field.trade')}>
        <ChoiceRow options={offered.map((service) => ({ value: service.trade, label: service.trade }))} value={form.trade} onChange={set('trade')} />
        {selected ? (noneAvailable
          ? <Text style={styles.warn}>{t('labor.engineer.noneAvailable', { trade: selected.trade })}</Text>
          : <Text style={styles.ok}>{t('labor.engineer.availableWorkers', { count: available })}</Text>) : null}
      </Field>
      <Field label={t('labor.field.workersRequired')}>
        <Input value={form.workers_required} onChangeText={(value) => set('workers_required')(digits(value))} keyboardType="number-pad" editable={!noneAvailable} invalid={Boolean(workersError)} />
        {workersError && !noneAvailable ? <Text style={styles.error}>{t(workersError.key, workersError.params)}</Text> : null}
      </Field>
      <View style={styles.pair}>
        <DateField label={t('labor.field.startDate')} value={form.start_date} min={today} onChange={set('start_date')} containerStyle={{ flex: 1 }} />
        <DateField label={t('labor.field.endDate')} value={form.end_date} min={form.start_date || today} onChange={set('end_date')} containerStyle={{ flex: 1 }} />
      </View>
      <Field label={t('labor.field.workDescription')}>
        <Input value={form.work_description} onChangeText={set('work_description')} placeholder={t('labor.field.activityPh')} />
      </Field>
      <Field label={t('labor.field.notes')}>
        <Input multiline value={form.notes} onChangeText={set('notes')} />
      </Field>
      {tradesError ? <Text style={styles.amberBox}>{tradesError}</Text> : null}
      <SupplyNotice notice={error ? { tone: 'error', text: error } : null} />
    </SheetModal>
  )
}

// ------------------------------------------------------- daily attendance

const EMPTY_COUNTS = { present_count: '0', absent_count: '0', half_day_count: '0', overtime_workers: '0', overtime_hours: '0', activity: '', notes: '' }

function DailyAttendance({ request, refreshKey, onSaved }) {
  const { t } = useLanguage()
  const today = localIsoDate()
  const lastAllowed = request.end_date && request.end_date < today ? request.end_date : today
  const editable = request.status === 'ACCEPTED'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [workDate, setWorkDate] = useState(lastAllowed)
  const [form, setForm] = useState(EMPTY_COUNTS)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let current = true
    fetchLaborDailyRecords(request.id)
      .then((list) => { if (current) { setRecords(Array.isArray(list) ? list : []); setLoadError('') } })
      .catch((failure) => { if (current) setLoadError(supplyErrorMessage(failure, t('labor.error.attendanceLoad'))) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [request.id, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // The form shows the saved record for the chosen date, or a blank one.
  const savedForDate = records.find((record) => String(record.work_date).slice(0, 10) === workDate)
  useEffect(() => {
    setForm(savedForDate ? {
      present_count: String(savedForDate.present_count ?? 0),
      absent_count: String(savedForDate.absent_count ?? 0),
      half_day_count: String(savedForDate.half_day_count ?? 0),
      overtime_workers: String(savedForDate.overtime_workers ?? 0),
      overtime_hours: String(savedForDate.overtime_hours ?? 0),
      activity: savedForDate.activity || '',
      notes: savedForDate.notes || '',
    } : EMPTY_COUNTS)
  }, [workDate, savedForDate?.id, savedForDate?.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }))
  const allocated = Number(request.workers_allocated || 0)

  const save = async () => {
    setNotice(null)
    const counts = ['present_count', 'absent_count', 'half_day_count', 'overtime_workers'].map((field) => Number(form[field] || 0))
    const [present, absent, halfDay, overtimeWorkers] = counts
    const overtimeHours = Number(form.overtime_hours || 0)
    if (counts.some((value) => !Number.isInteger(value) || value < 0) || Number.isNaN(overtimeHours) || overtimeHours < 0) {
      setNotice({ tone: 'error', text: t('labor.error.counts') }); return
    }
    if (present + absent + halfDay > allocated) {
      setNotice({ tone: 'error', text: t('labor.error.countsExceed', { total: present + absent + halfDay, allocated }) }); return
    }
    if (overtimeWorkers > present + halfDay) {
      setNotice({ tone: 'error', text: t('labor.error.overtimeExceed') }); return
    }
    setBusy(true)
    try {
      await saveLaborDailyRecord(request.id, workDate, {
        present_count: present, absent_count: absent, half_day_count: halfDay,
        overtime_workers: overtimeWorkers, overtime_hours: overtimeHours,
        activity: form.activity || null, notes: form.notes || null,
      })
      setNotice({ tone: 'success', text: t('labor.msg.attendanceSaved', { date: formatSupplyDate(workDate) }) })
      onSaved()
    } catch (failure) {
      setNotice({ tone: 'error', text: supplyErrorMessage(failure, t('labor.error.attendanceSave')) })
    } finally {
      setBusy(false)
    }
  }

  const numberField = (field, label, isDecimal = false) => (
    <Field label={label} style={styles.third}>
      <Input value={form[field]} onChangeText={(value) => set(field)(isDecimal ? decimal(value) : digits(value))} keyboardType={isDecimal ? 'decimal-pad' : 'number-pad'} selectTextOnFocus />
    </Field>
  )

  return (
    <View style={{ gap: 10 }}>
      {editable ? (
        <View style={styles.formBox}>
          <Text style={styles.formTitle}>{workDate === today ? t('labor.attendance.today') : t('labor.attendance.onDate', { date: formatSupplyDate(workDate) })}</Text>
          <Text style={styles.small}>
            {`${t('labor.attendance.allocated')} `}<Text style={styles.strong}>{allocated}</Text>{` · ${savedForDate ? t('labor.attendance.editingSaved') : t('labor.attendance.notRecorded')}`}
          </Text>
          <DateField label={t('labor.field.date')} value={workDate} min={String(request.start_date).slice(0, 10)} max={lastAllowed} onChange={setWorkDate} containerStyle={{ marginTop: 8, marginBottom: 6 }} />
          <View style={styles.grid}>
            {numberField('present_count', t('labor.field.present'))}
            {numberField('absent_count', t('labor.field.absent'))}
            {numberField('half_day_count', t('labor.field.halfDay'))}
            {numberField('overtime_workers', t('labor.field.otWorkers'))}
            {numberField('overtime_hours', t('labor.field.otHours'), true)}
          </View>
          <Field label={t('labor.field.activity')}>
            <Input value={form.activity} onChangeText={set('activity')} maxLength={255} placeholder={t('labor.field.activityPh')} />
          </Field>
          <Field label={t('labor.field.notes')}>
            <Input value={form.notes} onChangeText={set('notes')} />
          </Field>
          <SupplyNotice notice={notice} />
          <View style={styles.footer}>
            <ActionButton small icon={CheckCircle2} label={savedForDate ? t('labor.attendance.update') : t('labor.attendance.save')} onPress={save} busy={busy} disabled={busy} />
          </View>
        </View>
      ) : null}
      <View>
        <Text style={styles.eyebrow}>{t('labor.attendance.history')}</Text>
        {loading ? <Loading text={t('labor.attendance.loading')} /> : loadError ? <SupplyNotice notice={{ tone: 'error', text: loadError }} /> : (
          <View>
            <LaborRecordsList records={records} />
            {editable && records.length > 0 ? (
              <View style={styles.dateChips}>
                {records.slice(0, 7).map((record) => (
                  <Pressable key={record.id} onPress={() => setWorkDate(String(record.work_date).slice(0, 10))} style={styles.dateChip}>
                    <Pencil size={11} color={COLORS.slate[600]} />
                    <Text style={styles.dateChipText}>{formatSupplyDate(record.work_date)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>
    </View>
  )
}

// ------------------------------------------------------------- requests

function RequestCard({ request, refreshKey, onChanged, setNotice }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const act = async (action) => {
    const question = action === 'complete'
      ? t('labor.confirm.complete', { trade: request.trade, count: request.workers_allocated })
      : t('labor.confirm.cancel')
    const okLabel = action === 'complete' ? t('labor.action.completeAssignment') : t('labor.action.cancelRequest')
    if (!(await confirmAsync(question, okLabel, t('labor.action.cancel')))) return
    setBusy(true)
    setNotice(null)
    try {
      if (action === 'cancel') await cancelLaborRequest(request.id)
      else await completeLaborRequest(request.id)
      setNotice({ tone: 'success', text: action === 'cancel' ? t('labor.msg.cancelled') : t('labor.msg.completed') })
      onChanged()
    } catch (failure) {
      setNotice({ tone: 'error', text: supplyErrorMessage(failure, t('labor.error.requestUpdate')) })
    } finally {
      setBusy(false)
    }
  }

  const accepted = request.status === 'ACCEPTED'
  const allocation = allocationSummary(request)
  const heading = accepted ? t('labor.engineer.assigned') : request.status === 'COMPLETED' ? t('labor.engineer.completedAssignment') : t('labor.requests.label')
  return (
    <View style={[styles.card, accepted ? styles.cardAccepted : null]}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <View style={styles.inline}>
            <HardHat size={13} color={ink('#134127')} />
                        <Text style={styles.eyebrowBrand}>{heading}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>{`${request.trade} · ${request.supplier_name}`}</Text>
        </View>
        <SupplyStatusBadge status={request.status} />
      </View>
      <View style={styles.facts}>
        <Fact label={t('labor.field.workersRequired')} value={request.workers_required} />
        <Fact label={t('labor.field.allocatedWorkers')} value={request.workers_allocated ?? '—'} tone="#047857" />
        <Fact label={t('labor.field.startDate')} value={formatSupplyDate(request.start_date)} />
        <Fact label={t('labor.field.endDate')} value={formatSupplyDate(request.end_date)} />
      </View>
      {allocation.partial ? (
        <Text style={styles.amberBox}>{t('labor.allocation.partial', { allocated: allocation.allocated, required: allocation.required, shortfall: allocation.shortfall })}</Text>
      ) : null}
      {request.work_description ? <Text style={styles.description}>{request.work_description}</Text> : null}
      {request.status === 'REJECTED' ? (
        <Text style={styles.rejected}>{request.decision_note ? t('labor.engineer.rejectedNote', { note: request.decision_note }) : t('labor.engineer.rejected')}</Text>
      ) : null}
      {accepted && request.decision_note ? <Text style={styles.faint}>{t('labor.engineer.supplierNote', { note: request.decision_note })}</Text> : null}
      {request.status === 'COMPLETED' && request.completed_at ? (
        <Text style={styles.sky}>{t('labor.engineer.completedOn', { date: formatSupplyDate(request.completed_at) })}</Text>
      ) : null}
      {accepted && !request.supplier_assignment_active ? <Text style={styles.warn}>{t('labor.engineer.unassignedContinues')}</Text> : null}
      <View style={styles.actions}>
        {request.status === 'PENDING' ? (
          <ActionButton small tone="danger" icon={XCircle} label={t('labor.action.cancelRequest')} onPress={() => act('cancel')} disabled={busy} />
        ) : null}
        {accepted || request.status === 'COMPLETED' ? (
          <ActionButton
            small
            tone="outline"
            icon={CalendarDays}
            label={accepted ? (open ? t('labor.engineer.hideAttendance') : t('labor.engineer.dailyAttendance')) : (open ? t('labor.engineer.hideRecords') : t('labor.engineer.dailyRecords'))}
            onPress={() => setOpen((value) => !value)}
          />
        ) : null}
        {accepted ? (
          <ActionButton small icon={CheckCircle2} label={t('labor.action.completeAssignment')} onPress={() => act('complete')} busy={busy} disabled={busy} />
        ) : null}
      </View>
      {open ? <View style={{ marginTop: 10 }}><DailyAttendance request={request} refreshKey={refreshKey} onSaved={onChanged} /></View> : null}
    </View>
  )
}

// ------------------------------------------------------------------ panel

export default function EngineerLaborPanel({ projects = [], activeProjectId = null, onProjectChange }) {
  const { t, td } = useLanguage()
  const projectId = activeProjectId ?? projects[0]?.id ?? null
  const [suppliers, setSuppliers] = useState([])
  const [servicesBySupplier, setServicesBySupplier] = useState({})
  const [serviceErrors, setServiceErrors] = useState({})
  const [requests, setRequests] = useState([])
  const [trades, setTrades] = useState([])
  const [tradesError, setTradesError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [requesting, setRequesting] = useState(null)
  const [notice, setNotice] = useState(null)
  const [tab, setTab] = useState('active')
  const [refreshKey, setRefreshKey] = useState(0)
  const seq = useRef(0)

  const load = async () => {
    if (!projectId) { setLoading(false); return }
    seq.current += 1
    const mine = seq.current
    const isLatest = () => mine === seq.current
    try {
      const [assigned, labor] = await Promise.all([fetchProjectSuppliers(projectId), fetchProjectLaborRequests(projectId)])
      const laborSuppliers = (assigned || []).filter(isLaborSupplier)
      const serviceLists = await Promise.all(laborSuppliers.map((supplier) => (
        fetchProjectLaborSupplierServices(projectId, supplier.user_id)
          .then((list) => ({ list: Array.isArray(list) ? list : [], error: '' }))
          .catch((failure) => ({ list: [], error: supplyErrorMessage(failure, t('labor.error.tradesLoad')) }))
      )))
      if (!isLatest()) return
      setSuppliers(laborSuppliers)
      setServicesBySupplier(Object.fromEntries(laborSuppliers.map((supplier, index) => [supplier.user_id, serviceLists[index].list])))
      setServiceErrors(Object.fromEntries(laborSuppliers.map((supplier, index) => [supplier.user_id, serviceLists[index].error])))
      setRequests(Array.isArray(labor) ? labor : [])
      setLoadError('')
      setRefreshKey((key) => key + 1)
    } catch (failure) {
      if (isLatest()) setLoadError(supplyErrorMessage(failure, t('labor.error.panelLoad')))
    } finally {
      if (isLatest()) setLoading(false)
    }
  }

  useEffect(() => { setLoading(true); load() }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchLaborTrades()
      .then((list) => { setTrades(Array.isArray(list) ? list : []); setTradesError('') })
      .catch((failure) => { setTrades([]); setTradesError(supplyErrorMessage(failure, t('labor.error.tradeListLoad'))) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // The supplier's accept/reject, and our own changes, arrive through the live hint.
  useLiveRefresh(load)

  const groups = {
    active: requests.filter((request) => request.status === 'ACCEPTED'),
    pending: requests.filter((request) => request.status === 'PENDING'),
    history: requests.filter((request) => ['REJECTED', 'CANCELLED', 'COMPLETED'].includes(request.status)),
  }
  const tabs = [
    { id: 'active', label: t('labor.engineer.tab.active'), list: groups.active },
    { id: 'pending', label: t('labor.status.PENDING'), list: groups.pending },
    { id: 'history', label: t('labor.tab.history'), list: groups.history },
  ]
  const shown = tabs.find((item) => item.id === tab) || tabs[0]

  if (!projects.length) {
    return <EmptyCard icon={HardHat} title={t('labor.engineer.noProjectsTitle')} body={t('labor.engineer.noProjectsMessage')} />
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.headCard}>
        <Text style={styles.panelTitle}>{t('labor.engineer.title')}</Text>
        <Text style={styles.small}>{t('labor.engineer.subtitle')}</Text>
        {projects.length > 1 ? (
          <View style={{ marginTop: 8, flexDirection: 'row' }}>
            <SelectChip
              placeholder={t('labor.project')}
              value={projectId != null ? String(projectId) : ''}
              onChange={(value) => onProjectChange?.(Number(value))}
              options={projects.map((project) => ({ value: String(project.id), label: td(project.title) }))}
            />
          </View>
        ) : null}
      </View>

      {loading ? <Loading text={t('labor.engineer.loading')} /> : loadError ? <SupplyNotice notice={{ tone: 'error', text: loadError }} /> : (
        <View style={{ gap: 10 }}>
          {suppliers.length ? suppliers.map((supplier) => {
            const services = servicesBySupplier[supplier.user_id] || []
            const servicesError = serviceErrors[supplier.user_id] || ''
            return (
              <View key={supplier.user_id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.avatar}><UserRound size={20} color={ink('#134127')} /></View>   
                                 <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{supplier.store_name || supplier.name}</Text>
                    <Text style={styles.small} numberOfLines={1}>{t('labor.engineer.assignedSupplier')}</Text>
                  </View>
                  <Text style={styles.assigned}>{t('labor.assigned')}</Text>
                </View>
                {services.length ? (
                  <View style={styles.services}>
                    {services.map((service) => (
                      <View key={service.id} style={styles.service}>
                        <Text style={[styles.serviceName, { flex: 1 }]} numberOfLines={1}>
                          {service.trade}{service.skill_level ? <Text style={styles.small}>{` · ${service.skill_level}`}</Text> : null}
                        </Text>
                        <Text style={[styles.serviceCount, { color: ink(availableCount(service) > 0 ? '#047857' : '#b45309') }]}>{t('labor.engineer.availableCount', { count: availableCount(service) })}</Text>     
                                         </View>
                    ))}
                  </View>
                ) : servicesError ? (
                  <SupplyNotice notice={{ tone: 'error', text: servicesError }} />
                ) : (
                  <Text style={styles.greyBox}>{t('labor.engineer.noTrades')}</Text>
                )}
                <ActionButton icon={Send} label={t('labor.engineer.requestLabor')} disabled={!services.length} onPress={() => { setNotice(null); setRequesting(supplier) }} style={{ marginTop: 10 }} />
              </View>
            )
          }) : (
            <EmptyCard icon={HardHat} title={t('labor.engineer.noSupplierTitle')} body={t('labor.engineer.noSupplierMessage')} />
          )}

          <SupplyNotice notice={notice} />
          <RequestTabs tabs={tabs} active={shown.id} onChange={setTab} />
          {shown.list.length
            ? shown.list.map((request) => <RequestCard key={request.id} request={request} refreshKey={refreshKey} onChanged={load} setNotice={setNotice} />)
            : <EmptyCard icon={HardHat} title={t(`labor.engineer.empty.${shown.id}.title`)} body={t(`labor.engineer.empty.${shown.id}.message`)} />}
        </View>
      )}

      {requesting ? (
        <RequestLaborSheet
          projectId={projectId}
          supplier={requesting}
          services={servicesBySupplier[requesting.user_id] || []}
          trades={trades}
          tradesError={tradesError}
          onClose={() => setRequesting(null)}
          onStale={load}
          onSent={(result) => { setRequesting(null); setNotice(result); setTab('pending'); load() }}
        />
      ) : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  headCard: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  panelTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: c.text },
  small: { fontSize: 12, fontWeight: '600', color: c.textMuted },
  strong: { fontWeight: '800', color: c.text },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  cardAccepted: { borderColor: line('#a7f3d0', '#047857') },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrowBrand: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: ink('#134127') },  eyebrow: { marginBottom: 6, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  title: { fontSize: 15, fontWeight: '800', color: c.text },
  avatar: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.brandSoft },
  assigned: { overflow: 'hidden', borderRadius: 999, backgroundColor: soft('#d1fae5', '#065f46'), paddingHorizontal: 9, paddingVertical: 2, fontSize: 10, fontWeight: '800', color: ink('#065f46') },  services: { marginTop: 10, borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft },
  service: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10, paddingVertical: 8 },
  serviceName: { fontSize: 12.5, fontWeight: '800', color: c.text },
  serviceCount: { fontSize: 12, fontWeight: '700' },
  greyBox: { marginTop: 10, overflow: 'hidden', borderRadius: 12, backgroundColor: c.subtle, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '600', color: c.textMuted },
  amberBox: { marginTop: 8, overflow: 'hidden', borderRadius: 12, backgroundColor: soft('#fffbeb', '#92400e'), paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '700', color: ink('#92400e') },  facts: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap' },
  description: { marginTop: 8, overflow: 'hidden', borderRadius: 12, backgroundColor: c.subtle, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '600', color: c.textSoft },
  rejected: { marginTop: 8, fontSize: 12, fontWeight: '700', color: ink('#be123c') },
    faint: { marginTop: 8, fontSize: 11.5, fontWeight: '700', color: c.textMuted },
  sky: { marginTop: 8, fontSize: 11.5, fontWeight: '700', color: ink('#075985') },
  warn: { marginTop: 6, fontSize: 11.5, fontWeight: '700', color: ink('#b45309') },
  ok: { marginTop: 6, fontSize: 11.5, fontWeight: '700', color: ink('#047857') },
  error: { marginTop: 4, fontSize: 11.5, fontWeight: '700', color: ink('#be123c') },
  actions: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  pair: { flexDirection: 'row', gap: 8 },
  formBox: { borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 10 },
  formTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14, color: c.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  third: { width: '31%' },
  dateChips: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dateChip: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 9 },
  dateChipText: { fontSize: 11, fontWeight: '800', color: c.textSoft },
}))