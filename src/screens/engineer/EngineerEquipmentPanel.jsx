// The Site Engineer's Equipment tab — port of the web pages/engineer/EngineerEquipmentPanel.jsx.
// Shows ONLY the Equipment Supplier(s) the Builder assigned to this engineer on
// the selected project (GET /projects/{id}/suppliers) — never a marketplace.
// RENT: quantity + rate unit + dates; BUY: quantity. The supplier accepts or
// rejects, then marks a rental returned or a purchase delivered. The engineer
// cancels pending requests and logs daily hours on accepted rentals. Prices and
// availability are always the backend's.
import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text } from 'react-native'
import { useSelector } from 'react-redux'
import { CalendarDays, Construction, Send, ShoppingCart, Truck, XCircle } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { fetchProjectSuppliers } from '../../api/engineers'
import { fetchProjectEquipmentRequests, saveEquipmentUsage, supplyErrorMessage } from '../../api/siteResources'
import {
  EQUIPMENT_SUPPLIER_CATEGORY, allowsBuy, allowsRent, cancelEquipmentRequest, conditionLabel, createEquipmentRequest,
  fetchProjectEquipmentItems, localIsoDate, modeLabel, rentableUnits,
} from '../../api/supply'
import { formatMoney } from '../../utils/countryConfig'
import { ActionButton, SelectChip, SheetModal } from '../../components/builder/BuilderUi'
import { DateField } from '../../components/form'
import { EmptyCard } from './engineerParts'
import {
  ChoiceRow, EquipmentImage, EquipmentPrices, EquipmentRequestFacts, EquipmentUsageHistory, Field, Input, Loading,
  RequestTabs, SupplyNotice, SupplyStatusBadge, confirmAsync, formatSupplyDate,
} from './supplyParts'
import { ink, line, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

const isEquipmentSupplier = (supplier) => supplier?.supplier_category === EQUIPMENT_SUPPLIER_CATEGORY
const digits = (value) => value.replace(/[^\d]/g, '')

// ---------------------------------------------------------- request forms

function RentSheet({ projectId, supplierId, item, money, onClose, onSent }) {
  const { t } = useLanguage()
  const units = rentableUnits(item)
  const today = localIsoDate()
  const [form, setForm] = useState({ quantity: '1', rate_unit: units[0]?.unit || '', start_date: today, end_date: today, notes: '' })
  const [periodFree, setPeriodFree] = useState({ loading: false, value: item.available_to_rent })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }))
  const unit = units.find((rate) => rate.unit === form.rate_unit)

  // Availability for exactly the chosen period, from the backend.
  useEffect(() => {
    if (!form.start_date || !form.end_date || form.end_date < form.start_date) return undefined
    let current = true
    setPeriodFree((state) => ({ ...state, loading: true }))
    fetchProjectEquipmentItems(projectId, supplierId, { start: form.start_date, end: form.end_date })
      .then((list) => {
        if (!current) return
        const match = (list || []).find((row) => row.id === item.id)
        setPeriodFree({ loading: false, value: match ? match.available_to_rent : 0 })
      })
      .catch(() => { if (current) setPeriodFree({ loading: false, value: null }) })
    return () => { current = false }
  }, [projectId, supplierId, item.id, form.start_date, form.end_date])

  const submit = async () => {
    setError('')
    const quantity = Number(form.quantity)
    if (!Number.isInteger(quantity) || quantity < 1) { setError(t('equipment.error.quantityOne')); return }
    if (!form.rate_unit) { setError(t('equipment.error.rateUnit')); return }
    if (!form.start_date || !form.end_date) { setError(t('equipment.error.rentalDates')); return }
    if (form.end_date < form.start_date) { setError(t('labor.error.endBeforeStart')); return }
    setBusy(true)
    try {
      await createEquipmentRequest(projectId, {
        equipment_item_id: item.id, request_kind: 'RENT', quantity, rate_unit: form.rate_unit,
        start_date: form.start_date, end_date: form.end_date, notes: form.notes || null,
      })
      onSent({ tone: 'success', text: t('equipment.msg.rentalSent', { count: quantity, name: item.name }) })
    } catch (failure) {
      // e.g. the units were taken meanwhile: shown as the backend says it.
      setError(supplyErrorMessage(failure, t('equipment.error.rentalSend')))
      setBusy(false)
    }
  }

  const availability = periodFree.loading
    ? t('equipment.availability.checking')
    : periodFree.value == null
      ? t('equipment.availability.failed')
      : t('equipment.availability.forDates', { count: periodFree.value, total: item.quantity_total })

  return (
    <SheetModal
      visible
      tall
      title={t('equipment.engineer.requestRental')}
      onClose={onClose}
      footer={(
        <View style={styles.footer}>
          <ActionButton small tone="outline" label={t('labor.action.cancel')} onPress={onClose} />
          <ActionButton small icon={Send} label={t('equipment.engineer.sendRental')} onPress={submit} busy={busy} disabled={busy || !units.length} />
        </View>
      )}
    >
      <Field label={t('equipment.field.equipment')}><Input value={item.name} editable={false} /></Field>
      <Field label={t('equipment.field.quantity')}>
        <Input value={form.quantity} onChangeText={(value) => set('quantity')(digits(value))} keyboardType="number-pad" />
      </Field>
      <Field label={t('equipment.field.rateUnit')}>
        {/* Only units this item has a rate for. */}
        <ChoiceRow options={units.map((rate) => ({ value: rate.unit, label: t(rate.labelKey) }))} value={form.rate_unit} onChange={set('rate_unit')} />
        {unit ? <Text style={styles.hint}>{`${t('equipment.engineer.currentRate')} ${money(item[unit.field])} / ${t(unit.perKey)}`}</Text> : null}
      </Field>
      <View style={styles.pair}>
        <DateField label={t('labor.field.startDate')} value={form.start_date} min={today} onChange={set('start_date')} containerStyle={{ flex: 1 }} />
        <DateField label={t('labor.field.endDate')} value={form.end_date} min={form.start_date || today} onChange={set('end_date')} containerStyle={{ flex: 1 }} />
      </View>
      <Text style={styles.availability}>{availability}</Text>
      <Field label={t('labor.field.notes')}><Input multiline value={form.notes} onChangeText={set('notes')} /></Field>
      <Text style={styles.small}>{t('equipment.engineer.rateFixed')}</Text>
      <SupplyNotice notice={error ? { tone: 'error', text: error } : null} />
    </SheetModal>
  )
}

function BuySheet({ projectId, item, money, onClose, onSent }) {
  const { t } = useLanguage()
  const [form, setForm] = useState({ quantity: '1', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }))
  const quantity = Number(form.quantity)

  const submit = async () => {
    setError('')
    if (!Number.isInteger(quantity) || quantity < 1) { setError(t('equipment.error.quantityOne')); return }
    setBusy(true)
    try {
      await createEquipmentRequest(projectId, { equipment_item_id: item.id, request_kind: 'BUY', quantity, notes: form.notes || null })
      onSent({ tone: 'success', text: t('equipment.msg.purchaseSent', { count: quantity, name: item.name }) })
    } catch (failure) {
      setError(supplyErrorMessage(failure, t('equipment.error.purchaseSend')))
      setBusy(false)
    }
  }

  return (
    <SheetModal
      visible
      title={t('equipment.engineer.requestPurchase')}
      onClose={onClose}
      footer={(
        <View style={styles.footer}>
          <ActionButton small tone="outline" label={t('labor.action.cancel')} onPress={onClose} />
          <ActionButton small icon={Send} label={t('equipment.engineer.sendPurchase')} onPress={submit} busy={busy} disabled={busy} />
        </View>
      )}
    >
      <Field label={t('equipment.field.equipment')}><Input value={item.name} editable={false} /></Field>
      <View style={styles.buyFacts}>
        <View style={{ flex: 1 }}>
          <Text style={styles.factLabel}>{t('equipment.field.availableQuantity')}</Text>
          <Text style={[styles.factValue, { color: ink('#047857') }]}>{item.available_to_buy}</Text> 
                 </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.factLabel}>{t('equipment.field.salePrice')}</Text>
          <Text style={styles.factValue}>{money(item.sale_price)}</Text>
        </View>
      </View>
      <Field label={t('equipment.field.quantity')}>
        <Input value={form.quantity} onChangeText={(value) => set('quantity')(digits(value))} keyboardType="number-pad" />
        {Number.isInteger(quantity) && quantity > 0 ? <Text style={styles.hint}>{`${t('equipment.engineer.totalAtPrice')} ${money(quantity * Number(item.sale_price || 0))}`}</Text> : null}
      </Field>
      <Field label={t('labor.field.notes')}><Input multiline value={form.notes} onChangeText={set('notes')} /></Field>
      <SupplyNotice notice={error ? { tone: 'error', text: error } : null} />
    </SheetModal>
  )
}

// ------------------------------------------------------------ rental usage

function RentalUsage({ request, refreshKey, onSaved }) {
  const { t } = useLanguage()
  const today = localIsoDate()
  const start = String(request.start_date).slice(0, 10)
  const lastAllowed = request.end_date && request.end_date < today ? request.end_date : today
  const startsLater = start > today
  const editable = request.status === 'ACCEPTED' && !startsLater
  const [form, setForm] = useState({ usage_date: lastAllowed, hours_used: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }))

  const save = async () => {
    setNotice(null)
    const hours = Number(form.hours_used)
    if (form.hours_used === '' || Number.isNaN(hours) || hours < 0) { setNotice({ tone: 'error', text: t('equipment.error.hours') }); return }
    setBusy(true)
    try {
      await saveEquipmentUsage(request.id, form.usage_date, { hours_used: hours, notes: form.notes || null })
      setNotice({ tone: 'success', text: t('equipment.msg.usageSaved', { date: formatSupplyDate(form.usage_date) }) })
      setForm((current) => ({ ...current, hours_used: '', notes: '' }))
      onSaved()
    } catch (failure) {
      setNotice({ tone: 'error', text: supplyErrorMessage(failure, t('equipment.error.usageSave')) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: 10 }}>
      {editable ? (
        <View style={styles.formBox}>
          <Text style={styles.formTitle}>{t('equipment.usage.record')}</Text>
          <DateField label={t('equipment.field.usageDate')} value={form.usage_date} min={start} max={lastAllowed} onChange={set('usage_date')} containerStyle={{ marginTop: 8, marginBottom: 6 }} />
          <Field label={t('equipment.field.hoursUsed')}>
            <Input value={form.hours_used} onChangeText={(value) => set('hours_used')(value.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
          </Field>
          <Field label={t('labor.field.notes')}><Input value={form.notes} onChangeText={set('notes')} /></Field>
          <Text style={styles.small}>{t('equipment.usage.replaceHint')}</Text>
          <SupplyNotice notice={notice} />
          <View style={[styles.footer, { marginTop: 8 }]}>
            <ActionButton small icon={CalendarDays} label={t('equipment.usage.record')} onPress={save} busy={busy} disabled={busy} />
          </View>
        </View>
      ) : request.status === 'ACCEPTED' && startsLater ? (
        <Text style={styles.greyBox}>{t('equipment.usage.fromDate', { date: formatSupplyDate(request.start_date) })}</Text>
      ) : null}
      <View>
        <Text style={styles.eyebrow}>{t('equipment.usage.history')}</Text>
        <EquipmentUsageHistory requestId={request.id} refreshKey={refreshKey} />
      </View>
    </View>
  )
}

// ---------------------------------------------------------------- requests

function RequestCard({ request, money, refreshKey, onChanged, setNotice }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rent = request.request_kind === 'RENT'

  const cancel = async () => {
    if (!(await confirmAsync(t(rent ? 'equipment.confirm.cancelRental' : 'equipment.confirm.cancelPurchase'), t('labor.action.cancelRequest'), t('labor.action.cancel')))) return
    setBusy(true)
    setNotice(null)
    try {
      await cancelEquipmentRequest(request.id)
      setNotice({ tone: 'success', text: t('equipment.msg.cancelled') })
      onChanged()
    } catch (failure) {
      setNotice({ tone: 'error', text: supplyErrorMessage(failure, t('equipment.error.cancel')) })
    } finally {
      setBusy(false)
    }
  }

  const heading = request.status === 'ACCEPTED'
    ? t(rent ? 'equipment.engineer.rentedReserved' : 'equipment.engineer.purchasedAwaiting')
    : request.status === 'COMPLETED'
      ? t(rent ? 'equipment.engineer.rentalReturned' : 'equipment.engineer.purchaseDelivered')
      : t(rent ? 'equipment.requests.rental' : 'equipment.requests.purchase')
  const KindIcon = rent ? Truck : ShoppingCart

  return (
    <View style={[styles.card, request.status === 'ACCEPTED' ? styles.cardAccepted : null]}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <View style={styles.inline}>
                       <KindIcon size={13} color={ink('#134127')} />
            <Text style={styles.eyebrowBrand}>{heading}</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>{`${request.item_name} · ${request.supplier_name}`}</Text>
        </View>
        <SupplyStatusBadge status={request.status} />
      </View>
      <EquipmentRequestFacts request={request} money={money} />
      {request.notes ? <Text style={styles.description}>{request.notes}</Text> : null}
      {request.status === 'REJECTED' ? (
        <Text style={styles.rejected}>{request.decision_note ? t('labor.engineer.rejectedNote', { note: request.decision_note }) : t('labor.engineer.rejected')}</Text>
      ) : null}
      {request.status === 'COMPLETED' && request.completed_at ? (
        <Text style={styles.sky}>{t(rent ? 'equipment.returnedOn' : 'equipment.deliveredOn', { date: formatSupplyDate(request.completed_at) })}</Text>
      ) : null}
      {request.status === 'ACCEPTED' && !request.supplier_assignment_active ? (
        <Text style={styles.warn}>{t(rent ? 'equipment.engineer.unassignedRental' : 'equipment.engineer.unassignedPurchase')}</Text>
      ) : null}
      <View style={styles.actions}>
        {request.status === 'PENDING' ? (
          <ActionButton small tone="danger" icon={XCircle} label={t('labor.action.cancelRequest')} onPress={cancel} disabled={busy} />
        ) : null}
        {rent && (request.status === 'ACCEPTED' || request.status === 'COMPLETED') ? (
          <ActionButton small tone="outline" icon={CalendarDays} label={open ? t('equipment.usage.hide') : t('equipment.usage.label')} onPress={() => setOpen((value) => !value)} />
        ) : null}
      </View>
      {open ? <View style={{ marginTop: 10 }}><RentalUsage request={request} refreshKey={refreshKey} onSaved={onChanged} /></View> : null}
    </View>
  )
}

// ------------------------------------------------------------------- panel

export default function EngineerEquipmentPanel({ projects = [], activeProjectId = null, onProjectChange, openSupplierOnLoad = null }) {
  const { t, td } = useLanguage()
  const residence = useSelector((state) => state.auth.user?.country_of_residence)
  const projectId = activeProjectId ?? projects[0]?.id ?? null
  const project = projects.find((item) => item.id === projectId) || null
  // Prices in the project's country (web MoneyCountryContext).
  const money = (value) => formatMoney(value, project?.project_country || residence)
  const [suppliers, setSuppliers] = useState([])
  const [itemsBySupplier, setItemsBySupplier] = useState({})
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // Opened from that supplier's card on the Suppliers tab: start with its equipment unfolded.
  const [openSupplierId, setOpenSupplierId] = useState(openSupplierOnLoad)
  const loadedProjectId = useRef(projectId)
  const [dialog, setDialog] = useState(null) // { kind: 'RENT'|'BUY', item, supplierId }
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
      const [assigned, equipmentRequests] = await Promise.all([fetchProjectSuppliers(projectId), fetchProjectEquipmentRequests(projectId)])
      const equipmentSuppliers = (assigned || []).filter(isEquipmentSupplier)
      const itemLists = await Promise.all(equipmentSuppliers.map((supplier) => (
        fetchProjectEquipmentItems(projectId, supplier.user_id).catch(() => [])
      )))
      if (!isLatest()) return
      setSuppliers(equipmentSuppliers)
      setItemsBySupplier(Object.fromEntries(equipmentSuppliers.map((supplier, index) => [supplier.user_id, itemLists[index] || []])))
      setRequests(Array.isArray(equipmentRequests) ? equipmentRequests : [])
      setLoadError('')
      setRefreshKey((key) => key + 1)
    } catch (failure) {
      if (isLatest()) setLoadError(supplyErrorMessage(failure, t('equipment.error.panelLoad')))
    } finally {
      if (isLatest()) setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    // Only a real project change folds it.
    if (loadedProjectId.current !== projectId) setOpenSupplierId(null)
    loadedProjectId.current = projectId
    load()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps
  // The supplier's accept/reject/return/delivery, and our own changes, arrive through the live hint.
  useLiveRefresh(load)

  const groups = useMemo(() => ({
    active: requests.filter((request) => request.status === 'ACCEPTED'),
    pending: requests.filter((request) => request.status === 'PENDING'),
    history: requests.filter((request) => ['REJECTED', 'CANCELLED', 'COMPLETED'].includes(request.status)),
  }), [requests])
  const tabs = [
    { id: 'active', label: t('labor.tab.active'), list: groups.active },
    { id: 'pending', label: t('labor.status.PENDING'), list: groups.pending },
    { id: 'history', label: t('labor.tab.history'), list: groups.history },
  ]
  const shown = tabs.find((item) => item.id === tab) || tabs[0]
  const sent = (result) => { setDialog(null); setNotice(result); setTab('pending'); load() }

  if (!projects.length) {
    return <EmptyCard icon={Construction} title={t('labor.engineer.noProjectsTitle')} body={t('equipment.engineer.noProjectsMessage')} />
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.headCard}>
        <Text style={styles.panelTitle}>{t('equipment.engineer.title')}</Text>
        <Text style={styles.small}>{t('equipment.engineer.subtitle')}</Text>
        {projects.length > 1 ? (
          <View style={{ marginTop: 8, flexDirection: 'row' }}>
            <SelectChip
              placeholder={t('labor.project')}
              value={projectId != null ? String(projectId) : ''}
              onChange={(value) => onProjectChange?.(Number(value))}
              options={projects.map((item) => ({ value: String(item.id), label: td(item.title) }))}
            />
          </View>
        ) : null}
      </View>

      {loading ? <Loading text={t('equipment.engineer.loading')} /> : loadError ? <SupplyNotice notice={{ tone: 'error', text: loadError }} /> : (
        <View style={{ gap: 10 }}>
          {suppliers.length ? suppliers.map((supplier) => {
            const items = itemsBySupplier[supplier.user_id] || []
            const availableCount = items.filter((item) => (allowsRent(item) && item.available_to_rent > 0) || (allowsBuy(item) && item.available_to_buy > 0)).length
            const open = openSupplierId === supplier.user_id
            return (
              <View key={supplier.user_id} style={{ gap: 10 }}>
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <View style={styles.avatar}><Construction size={20} color={ink('#134127')} /></View>                  
                      <View style={{ flex: 1 }}>
                      <Text style={styles.title} numberOfLines={1}>{supplier.store_name || supplier.name}</Text>
                      <Text style={styles.small} numberOfLines={1}>{t('equipment.engineer.assignedSupplier', { count: availableCount, total: items.length })}</Text>
                    </View>
                    <Text style={styles.assigned}>{t('labor.assigned')}</Text>
                  </View>
                  <ActionButton small icon={Construction} label={open ? t('equipment.engineer.hideEquipment') : t('equipment.engineer.viewEquipment')} onPress={() => setOpenSupplierId(open ? null : supplier.user_id)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
                </View>
                {open ? (items.length ? items.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.itemTop}>
                      <EquipmentImage src={item.image_url} style={styles.itemImage} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.small} numberOfLines={1}>{`${item.category || ''}${[item.brand, item.model].filter(Boolean).length ? ` · ${[item.brand, item.model].filter(Boolean).join(' ')}` : ''}`}</Text>
                        <View style={styles.pills}>
                          <Text style={styles.pillGrey}>{conditionLabel(item.condition, t)}</Text>
                          <Text style={styles.pillBrand}>{modeLabel(item.mode, t)}</Text>
                        </View>
                        <View style={{ marginTop: 6 }}><EquipmentPrices item={item} money={money} /></View>
                      </View>
                    </View>
                    <View style={styles.stockRow}>
                      {allowsRent(item) ? <Text style={styles.ok}>{t('equipment.engineer.toRentToday', { count: item.available_to_rent, total: item.quantity_total })}</Text> : null}
                      {allowsBuy(item) ? <Text style={styles.teal}>{t('equipment.engineer.toBuy', { count: item.available_to_buy })}</Text> : null}
                    </View>
                    {item.specifications ? <Text style={styles.small} numberOfLines={2}>{item.specifications}</Text> : null}
                    <View style={styles.itemActions}>
                      {allowsRent(item) ? (
                        <ActionButton small icon={Truck} label={allowsBuy(item) ? t('equipment.mode.rent') : t('equipment.engineer.requestRental')} onPress={() => { setNotice(null); setDialog({ kind: 'RENT', item, supplierId: supplier.user_id }) }} style={{ flex: 1 }} />
                      ) : null}
                      {allowsBuy(item) ? (
                        <ActionButton small tone="outline" icon={ShoppingCart} label={allowsRent(item) ? t('equipment.mode.buy') : t('equipment.engineer.requestPurchase')} disabled={item.available_to_buy < 1} onPress={() => { setNotice(null); setDialog({ kind: 'BUY', item, supplierId: supplier.user_id }) }} style={{ flex: 1 }} />
                      ) : null}
                    </View>
                  </View>
                )) : (
                  <EmptyCard icon={Construction} title={t('equipment.engineer.noItemsTitle')} body={t('equipment.engineer.noItemsMessage')} />
                )) : null}
              </View>
            )
          }) : (
            <EmptyCard icon={Construction} title={t('equipment.engineer.noSupplierTitle')} body={t('equipment.engineer.noSupplierMessage')} />
          )}

          <SupplyNotice notice={notice} />
          <RequestTabs tabs={tabs} active={shown.id} onChange={setTab} />
          {shown.list.length
            ? shown.list.map((request) => <RequestCard key={request.id} request={request} money={money} refreshKey={refreshKey} onChanged={load} setNotice={setNotice} />)
            : <EmptyCard icon={Construction} title={t(`equipment.engineer.empty.${shown.id}.title`)} body={t(`equipment.engineer.empty.${shown.id}.message`)} />}
        </View>
      )}

      {dialog?.kind === 'RENT' ? (
        <RentSheet projectId={projectId} supplierId={dialog.supplierId} item={dialog.item} money={money} onClose={() => setDialog(null)} onSent={sent} />
      ) : null}
      {dialog?.kind === 'BUY' ? (
        <BuySheet projectId={projectId} item={dialog.item} money={money} onClose={() => setDialog(null)} onSent={sent} />
      ) : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  headCard: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  panelTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: c.text },
  small: { fontSize: 12, fontWeight: '600', color: c.textMuted },
  hint: { marginTop: 6, fontSize: 11.5, fontWeight: '700', color: c.textSoft },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
    cardAccepted: { borderColor: line('#a7f3d0', '#047857') },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrowBrand: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: ink('#134127') },  eyebrow: { marginBottom: 6, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  title: { fontSize: 15, fontWeight: '800', color: c.text },
  avatar: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.brandSoft },
  assigned: { overflow: 'hidden', borderRadius: 999, backgroundColor: soft('#d1fae5', '#065f46'), paddingHorizontal: 9, paddingVertical: 2, fontSize: 10, fontWeight: '800', color: ink('#065f46') },  itemTop: { flexDirection: 'row', gap: 12 },
  itemImage: { width: '38%', minHeight: 96 },
  pills: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pillGrey: { overflow: 'hidden', borderRadius: 999, backgroundColor: c.subtle, paddingHorizontal: 8, paddingVertical: 2, fontSize: 10, fontWeight: '800', color: c.textSoft },
  pillBrand: { overflow: 'hidden', borderRadius: 999, backgroundColor: c.brandSoft, paddingHorizontal: 8, paddingVertical: 2, fontSize: 10, fontWeight: '800', color: c.brandTextStrong },
  stockRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 2 },
    ok: { fontSize: 12, fontWeight: '700', color: ink('#047857') },
  teal: { fontSize: 12, fontWeight: '700', color: ink('#0f766e') },
  itemActions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  availability: { marginBottom: 10, overflow: 'hidden', borderRadius: 12, backgroundColor: c.subtle, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '700', color: ink('#047857') },  buyFacts: { marginBottom: 10, flexDirection: 'row', gap: 10, borderRadius: 12, backgroundColor: c.subtle, padding: 10 },
  factLabel: { fontSize: 11, fontWeight: '700', color: c.textFaint },
  factValue: { fontSize: 13, fontWeight: '800', color: c.text },
  description: { marginTop: 8, overflow: 'hidden', borderRadius: 12, backgroundColor: c.subtle, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '600', color: c.textSoft },
  rejected: { marginTop: 8, fontSize: 12, fontWeight: '700', color: ink('#be123c') },
  sky: { marginTop: 8, fontSize: 11.5, fontWeight: '700', color: ink('#075985') },
  warn: { marginTop: 6, fontSize: 11.5, fontWeight: '700', color: ink('#b45309') },
  greyBox: { overflow: 'hidden', borderRadius: 12, backgroundColor: c.subtle, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '600', color: c.textSoft },
  actions: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  pair: { flexDirection: 'row', gap: 8 },
  formBox: { borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 10 },
  formTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14, color: c.text },
}))