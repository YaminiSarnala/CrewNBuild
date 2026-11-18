// Labour crews, equipment rentals, received stock and recorded payments for one
// date of the Site Engineer calendar — port of the web
// pages/contractor/SiteDayResources.jsx. Writes go to the existing endpoints,
// which enforce the same rules (own request, ACCEPTED, inside the request
// period, not in the future).
import { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { ChevronDown, PackageCheck, Truck, Wallet } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatMoney } from '../../utils/countryConfig'
import { formatDate } from '../../utils/formatters'
import { ratePer, saveEquipmentUsage, saveLaborDailyRecord, supplyErrorMessage } from '../../api/siteResources'
import { attendanceProblem, recordForDate, rentalChargeForDate, splitPayments } from '../../utils/siteResources'
import { COLORS } from '../../theme/tokens'
import { ink, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

const formatQty = (value) => { const number = Number(value || 0); return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(3))) }
const EMPTY_ATTENDANCE = { present_count: '0', absent_count: '0', half_day_count: '0', overtime_workers: '0', overtime_hours: '0', activity: '', notes: '' }
const attendanceFrom = (record) => (record ? {
  present_count: String(record.present_count ?? 0), absent_count: String(record.absent_count ?? 0), half_day_count: String(record.half_day_count ?? 0),
  overtime_workers: String(record.overtime_workers ?? 0), overtime_hours: String(record.overtime_hours ?? 0), activity: record.activity || '', notes: record.notes || '',
} : EMPTY_ATTENDANCE)
const normalize = (form) => ({
  present_count: Number(form.present_count || 0), absent_count: Number(form.absent_count || 0), half_day_count: Number(form.half_day_count || 0),
  overtime_workers: Number(form.overtime_workers || 0), overtime_hours: Number(form.overtime_hours || 0),
  activity: String(form.activity || '').trim(), notes: String(form.notes || '').trim(),
})
const same = (first, second) => JSON.stringify(first) === JSON.stringify(second)

const TAG_TONES = {
  slate: ['#f1f5f9', '#334155'], calc: ['#e0f2fe', '#075985'], entered: ['#fef3c7', '#92400e'],
  ok: ['#d1fae5', '#065f46'], warn: ['#ffe4e6', '#be123c'],
}
export function Tag({ tone = 'slate', children }) {
  const [bg, fg] = TAG_TONES[tone] || TAG_TONES.slate
  return (
       <View style={[styles.tag, { backgroundColor: soft(bg, fg) }]}>
      <Text style={[styles.tagText, { color: ink(fg) }]}>{children}</Text>
    </View>
  )
}

const periodText = (request, t) => (request.end_date
  ? `${formatDate(request.start_date, request.start_date)} – ${formatDate(request.end_date, request.end_date)}`
  : t('se.res.openEnded', { start: formatDate(request.start_date, request.start_date) }))

function CardShell({ title, subtitle, aside, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.small}>{subtitle}</Text> : null}
        </View>
        <View style={styles.tags}>{aside}</View>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  )
}

function CardFooter({ editable, dirty, saving, onSave, label, notice }) {
  if (!editable && !notice?.text) return null
  return (
    <View style={styles.footer}>
      <Text style={[styles.footerText, { color: ink(notice?.tone === 'error' ? '#e11d48' : '#047857') }]}>{notice?.text || ''}</Text>     
       {editable ? (
        <Pressable onPress={onSave} disabled={saving || !dirty} style={[styles.saveButton, (saving || !dirty) && styles.dim]}>
          {saving ? <ActivityIndicator size="small" color={ink('#0f172a')} /> : null}        
            <Text style={styles.saveText}>{label}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function NumberField({ label, value, onChange, editable, decimal = false }) {
  return (
    <View style={styles.numberField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(text.replace(decimal ? /[^\d.]/g : /\D/g, ''))}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        selectTextOnFocus
        editable={editable}
        style={[styles.numberInput, !editable && styles.inputDisabled]}
      />
    </View>
  )
}

function TextField({ label, value, onChange, editable, placeholder }) {
  return (
    <View style={styles.textField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={COLORS.slate[400]}
        maxLength={255}
        style={[styles.textInput, !editable && styles.inputDisabled]}
      />
    </View>
  )
}

// One accepted labour request on one date: attendance, saved to
// PUT /labor-requests/{id}/daily-records/{date}.
function LabourCard({ request, date, records, editable, onSaved, onDirtyChange, resetSignal }) {
  const { t, td } = useLanguage()
  const saved = recordForDate(records, date)
  const [form, setForm] = useState(() => attendanceFrom(saved))
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const baseline = attendanceFrom(saved)
  useEffect(() => { setForm(attendanceFrom(saved)); setNotice(null) }, [date, saved?.id, saved?.updated_at, resetSignal]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = editable && !same(normalize(form), normalize(baseline))
  useEffect(() => { onDirtyChange(`labour:${request.id}`, dirty); return () => onDirtyChange(`labour:${request.id}`, false) }, [dirty]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (field) => (value) => { setForm((current) => ({ ...current, [field]: value })); setNotice(null) }
  const allocated = Number(request.workers_allocated || 0)

  async function save() {
    const problem = attendanceProblem(form, allocated)
    if (problem) { setNotice({ tone: 'error', text: t(problem.key, problem.values) }); return }
    setSaving(true)
    try {
      const payload = normalize(form)
      await saveLaborDailyRecord(request.id, date, { ...payload, activity: payload.activity || null, notes: payload.notes || null })
      await onSaved(request.id)
      setNotice({ tone: 'ok', text: t('labor.msg.attendanceSaved', { date: formatDate(date, date) }) })
    } catch (error) {
      setNotice({ tone: 'error', text: supplyErrorMessage(error, t('labor.error.attendanceSave')) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <CardShell
      title={`${td(request.supplier_name || '')} · ${td(request.trade)}`}
      subtitle={`${t('labor.field.allocatedWorkers')}: ${allocated} · ${periodText(request, t)}`}
      aside={(
        <>
          {request.status === 'COMPLETED' ? <Tag>{t('labor.status.COMPLETED')}</Tag> : null}
          {saved ? <Tag tone="ok">{t('se.res.recorded')}</Tag> : <Tag>{t('labor.attendance.notRecorded')}</Tag>}
          {dirty ? <Tag tone="entered">{t('se.res.unsavedCard')}</Tag> : null}
        </>
      )}
    >
      <View style={styles.grid}>
        <NumberField label={t('labor.field.present')} value={form.present_count} onChange={set('present_count')} editable={editable} />
        <NumberField label={t('labor.field.absent')} value={form.absent_count} onChange={set('absent_count')} editable={editable} />
        <NumberField label={t('labor.field.halfDay')} value={form.half_day_count} onChange={set('half_day_count')} editable={editable} />
        <NumberField label={t('labor.field.otWorkers')} value={form.overtime_workers} onChange={set('overtime_workers')} editable={editable} />
        <NumberField label={t('labor.field.otHours')} value={form.overtime_hours} onChange={set('overtime_hours')} editable={editable} decimal />
      </View>
      <TextField label={t('labor.field.activity')} value={form.activity} onChange={set('activity')} editable={editable} placeholder={editable ? t('labor.field.activityPh') : ''} />
      <TextField label={t('labor.field.notes')} value={form.notes} onChange={set('notes')} editable={editable} />
      {/* No agreed rate exists on labour requests, so no amount is shown. */}
      <Text style={[styles.small, styles.top]}>{t('se.res.noRate')}</Text>
      <CardFooter editable={editable} dirty={dirty} saving={saving} onSave={save} label={saved ? t('labor.attendance.update') : t('labor.attendance.save')} notice={notice} />
    </CardShell>
  )
}

export function LabourCards({ requests, date, recordsById, canRecord, onSaved, onDirtyChange, resetSignal }) {
  const { t } = useLanguage()
  if (!requests.length) return <Text style={styles.empty}>{t('se.res.noLabour')}</Text>
  return requests.map((request) => (
    <LabourCard key={request.id} request={request} date={date} records={recordsById[request.id] || []} editable={canRecord(request)} onSaved={onSaved} onDirtyChange={onDirtyChange} resetSignal={resetSignal} />
  ))
}

// One supplier rental on one date: the agreed terms, the day's charge under
// them, and the hours logged (PUT /equipment-requests/{id}/usage/{date}).
function RentalCard({ rental, date, logs, editable, country, onSaved, onDirtyChange, resetSignal }) {
  const { t, td } = useLanguage()
  const saved = recordForDate(logs, date, 'usage_date')
  const savedHours = saved ? String(saved.hours_used) : ''
  const [hours, setHours] = useState(savedHours)
  const [notes, setNotes] = useState(saved?.notes || '')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  useEffect(() => { setHours(savedHours); setNotes(saved?.notes || ''); setNotice(null) }, [date, saved?.id, saved?.updated_at, resetSignal]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = editable && (String(hours) !== savedHours || String(notes || '') !== String(saved?.notes || ''))
  useEffect(() => { onDirtyChange(`rental:${rental.id}`, dirty); return () => onDirtyChange(`rental:${rental.id}`, false) }, [dirty]) // eslint-disable-line react-hooks/exhaustive-deps
  const charge = rentalChargeForDate(rental, date, saved ? saved.hours_used : null)

  async function save() {
    const value = Number(hours)
    if (hours === '' || !Number.isFinite(value) || value < 0) { setNotice({ tone: 'error', text: t('equipment.error.hours') }); return }
    if (value > 24 * Number(rental.quantity || 1)) { setNotice({ tone: 'error', text: t('se.res.errHoursCap', { max: 24 * Number(rental.quantity || 1) }) }); return }
    setSaving(true)
    try {
      await saveEquipmentUsage(rental.id, date, { hours_used: value, notes: String(notes || '').trim() || null })
      await onSaved(rental.id)
      setNotice({ tone: 'ok', text: t('se.res.hoursSaved') })
    } catch (error) {
      setNotice({ tone: 'error', text: supplyErrorMessage(error, t('equipment.error.usageSave')) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <CardShell
      title={`${td(rental.item_name || '')}${rental.item_category ? ` · ${td(rental.item_category)}` : ''}`}
      subtitle={`${td(rental.supplier_name || '')} · ${t('se.res.units', { count: rental.quantity })} · ${periodText(rental, t)}`}
      aside={(
        <>
          {rental.status === 'COMPLETED' ? <Tag>{t('se.res.returned')}</Tag> : null}
          {dirty ? <Tag tone="entered">{t('se.res.unsavedCard')}</Tag> : null}
        </>
      )}
    >
      <View style={styles.dlRow}>
        <Text style={styles.dt}>{t('equipment.field.rate')}</Text>
        <Text style={styles.dd}>{t('se.res.ratePer', { amount: formatMoney(rental.unit_price, country), unit: ratePer(rental.rate_unit, t) })}</Text>
      </View>
      <View style={styles.dlRow}>
        <Text style={styles.dt}>{t('equipment.field.hoursUsed')}</Text>
        <Text style={styles.dd}>{saved ? formatQty(saved.hours_used) : '—'}</Text>
      </View>
      <View style={styles.dlRow}>
        <Text style={styles.dt}>{t('se.res.dayCharge')}</Text>
        {charge.amount != null ? (
          <View style={styles.tags}><Tag tone="calc">{t('se.res.calculated')}</Tag><Text style={styles.dd}>{formatMoney(charge.amount, country)}</Text></View>
        ) : <Tag tone="warn">{t('se.res.notPriced')}</Tag>}
      </View>
      {editable ? (
        <View style={styles.grid}>
          <NumberField label={t('equipment.field.hoursUsed')} value={hours} onChange={(value) => { setHours(value); setNotice(null) }} editable decimal />
          <View style={{ flex: 2, minWidth: 140 }}>
            <TextField label={t('labor.field.notes')} value={notes} onChange={(value) => { setNotes(value); setNotice(null) }} editable />
          </View>
        </View>
      ) : null}
      <Text style={[styles.small, styles.top]}>{t(`se.res.basis.${charge.basis}`)}</Text>
      <CardFooter editable={editable} dirty={dirty} saving={saving} onSave={save} label={t('se.res.saveHours')} notice={notice} />
    </CardShell>
  )
}

export function RentalCards({ rentals, date, logsById, canRecord, country, onSaved, onDirtyChange, resetSignal }) {
  const { t } = useLanguage()
  if (!rentals.length) return <Text style={styles.empty}>{t('se.res.noRentals')}</Text>
  return rentals.map((rental) => (
    <RentalCard key={rental.id} rental={rental} date={date} logs={logsById[rental.id] || []} editable={canRecord(rental)} country={country} onSaved={onSaved} onDirtyChange={onDirtyChange} resetSignal={resetSignal} />
  ))
}

/** A folded block (web <details>): a tappable heading that shows its body. */
function Fold({ icon: Icon, title, children }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  return (
    <View style={styles.fold}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.foldHead}>
        <View style={styles.tags}>
          <Icon size={14} color={COLORS.slate[600]} />
          <Text style={styles.foldTitle}>{title}</Text>
        </View>
        <View style={styles.tags}>
          <Tag>{t('se.res.notInTotal')}</Tag>
          <ChevronDown size={15} color={COLORS.slate[500]} style={open ? { transform: [{ rotate: '180deg' }] } : null} />
        </View>
      </Pressable>
      {open ? <View style={styles.foldBody}>{children}</View> : null}
    </View>
  )
}

// Bought equipment: reference only, never a daily charge.
export function PurchasedEquipment({ purchases, country }) {
  const { t, td } = useLanguage()
  if (!purchases.length) return null
  return (
    <Fold icon={Truck} title={`${t('se.res.purchases')} (${purchases.length})`}>
      {purchases.map((purchase) => (
        <View key={purchase.id} style={styles.listRow}>
          <Text style={[styles.rowText, { flex: 1 }]}>{`${td(purchase.item_name || '')} × ${purchase.quantity} · ${td(purchase.supplier_name || '')}`}</Text>
          <Text style={styles.rowStrong}>{formatMoney(Number(purchase.unit_price || 0) * Number(purchase.quantity || 0), country)}</Text>
        </View>
      ))}
      <Text style={[styles.small, styles.pad]}>{t('se.res.purchasesHint')}</Text>
    </Fold>
  )
}

// Fulfilled order lines delivered on this date: reference only.
export function ReceivedMaterials({ orders = [], country, unitLabel }) {
  const { t, td } = useLanguage()
  return (
    <Fold icon={PackageCheck} title={`${t('se.res.received')} (${orders.length})`}>
      {orders.length ? orders.map((order) => (
        <View key={order.id} style={styles.listRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowStrong}>{td(order.material_name)}</Text>
            <Text style={styles.small}>{[td(order.supplier_name || ''), order.request_code].filter(Boolean).join(' · ')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.rowStrong}>{`${formatQty(order.quantity)} ${unitLabel(order.unit)}`}</Text>
            {order.amount != null ? <Text style={styles.small}>{formatMoney(order.amount, country)}</Text> : null}
          </View>
        </View>
      )) : <Text style={styles.emptyInline}>{t('se.res.noReceived')}</Text>}
      <Text style={[styles.small, styles.pad]}>{t('se.res.receivedHint')}</Text>
    </Fold>
  )
}

// Payments recorded on the day's records, by the party name as typed.
export function PaymentsList({ payments = [], country }) {
  const { t, td } = useLanguage()
  const { paidOut, receivedIn, paidOutTotal, receivedInTotal } = useMemo(() => splitPayments(payments), [payments])
  const rows = [...paidOut, ...receivedIn]
  return (
    <Fold icon={Wallet} title={`${t('se.res.payments')} (${rows.length})`}>
      {rows.length ? rows.map((payment) => {
        const incoming = String(payment.direction).toUpperCase() === 'IN'
        return (
          <View key={payment.id} style={styles.listRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowStrong}>{td(payment.payment_type || '')}</Text>
              <Text style={styles.small}>{[payment.party_name ? td(payment.party_name) : '', payment.remarks ? td(payment.remarks) : ''].filter(Boolean).join(' · ')}</Text>
            </View>
            <Text style={[styles.rowStrong, incoming ? { color: ink('#047857') } : null]}>{`${incoming ? '+' : '−'}${formatMoney(payment.amount, country)}`}</Text>    
                  </View>
        )
      }) : <Text style={styles.emptyInline}>{t('se.res.noPayments')}</Text>}
      {paidOutTotal > 0 || receivedInTotal > 0 ? (
        <Text style={[styles.rowText, styles.pad]}>
          {t('se.res.paidOutTotal', { amount: formatMoney(paidOutTotal, country) })}{receivedInTotal > 0 ? ` · ${t('se.res.receivedInTotal', { amount: formatMoney(receivedInTotal, country) })}` : ''}
        </Text>
      ) : null}
      <Text style={[styles.small, styles.pad]}>{t('se.res.paymentsHint')}</Text>
    </Fold>
  )
}

const styles = createStyles((c) => ({
  tag: { borderRadius: 9999, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '800' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  card: { marginBottom: 10.5, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 7, borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10.5, paddingVertical: 9 },
  cardTitle: { fontSize: 13.5, fontWeight: '800', color: c.text },
  cardBody: { padding: 10.5 },
  small: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  top: { marginTop: 7 },
  pad: { paddingHorizontal: 10.5, paddingVertical: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  numberField: { flex: 1, minWidth: 64 },
  textField: { marginTop: 7 },
  fieldLabel: { marginBottom: 3.5, fontSize: 11, fontWeight: '700', color: c.textSecondary },
  numberInput: { height: 36, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 7, textAlign: 'right', fontSize: 14, fontWeight: '800', color: c.text },
  textInput: { height: 36, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 9, fontSize: 14, fontWeight: '600', color: c.text },
  inputDisabled: { backgroundColor: c.subtle, color: c.textSoft },
  footer: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  footerText: { flex: 1, fontSize: 12, fontWeight: '700' },
  saveButton: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 8, borderWidth: 2, borderColor: '#236645', backgroundColor: '#2e7d55', paddingHorizontal: 14 },
  saveText: { fontSize: 12, fontWeight: '800', color: '#ffffff' },
  dim: { opacity: 0.4 },
  dlRow: { marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  dt: { fontSize: 12, fontWeight: '700', color: c.textMuted },
  dd: { fontSize: 12, fontWeight: '800', color: c.text },
  empty: { borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, paddingHorizontal: 10.5, paddingVertical: 14, textAlign: 'center', fontSize: 12, fontWeight: '700', color: c.textFaint },
  emptyInline: { paddingHorizontal: 10.5, paddingVertical: 10.5, textAlign: 'center', fontSize: 12, fontWeight: '700', color: c.textFaint },
  fold: { marginTop: 10.5, borderRadius: 8, borderWidth: 1, borderColor: c.border },
  foldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, paddingHorizontal: 10.5, paddingVertical: 8 },
  foldTitle: { fontSize: 12, fontWeight: '800', color: c.textSoft },
  foldBody: { borderTopWidth: 1, borderColor: c.border },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 7, borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10.5, paddingVertical: 7 },
  rowText: { fontSize: 12, fontWeight: '700', color: c.textSoft },
  rowStrong: { fontSize: 12, fontWeight: '800', color: c.text },
}))