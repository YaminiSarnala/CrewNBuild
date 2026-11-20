// Pieces the Site Engineer's Labor and Equipment panels share — the mobile
// form of the web SupplierLaborSections (status badge, dates, dialog, daily
// records) and SupplierEquipmentSections (prices, request facts, usage).
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { ImageOff } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { imageUrl } from '../../api/client'
import { fetchEquipmentUsage, supplyErrorMessage } from '../../api/siteResources'
import { RATE_UNITS, allowsBuy, allowsRent, kindLabel } from '../../api/supply'
import { formatCalendarDate } from '../../utils/formatters'
import { COLORS } from '../../theme/tokens'
import { ink, soft, surface } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

export const formatSupplyDate = (value) => (value ? formatCalendarDate(String(value).slice(0, 10), '—') : '—')

// [background, text]
const STATUS_TONES = {
  PENDING: ['#fef3c7', '#92400e'],
  ACCEPTED: ['#d1fae5', '#065f46'],
  REJECTED: ['#ffe4e6', '#be123c'],
  CANCELLED: ['#f1f5f9', '#475569'],
  COMPLETED: ['#e0f2fe', '#075985'],
}
export function SupplyStatusBadge({ status }) {
  const { t } = useLanguage()
  const [bg, fg] = STATUS_TONES[status] || STATUS_TONES.CANCELLED
  return (
     <View style={[styles.badge, { backgroundColor: soft(bg, fg) }]}>
      <Text style={[styles.badgeText, { color: ink(fg) }]}>{STATUS_TONES[status] ? t(`labor.status.${status}`) : status}</Text>
    </View>
  )
}

export function SupplyNotice({ notice }) {
  if (!notice?.text) return null
  const error = notice.tone === 'error'
  return <Text style={[styles.notice, error ? styles.noticeError : styles.noticeOk]}>{notice.text}</Text>
}

export function FieldLabel({ children }) {
  return <Text style={styles.label}>{children}</Text>
}

/** A field's validation message, in red right under it. */
export function FieldErrorText({ message }) {
  if (!message) return null
  return <Text accessibilityRole="alert" style={styles.fieldError}>{message}</Text>
}

export function Field({ label, children, style, error }) {
  return (
    <View style={[styles.field, style]}>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      {children}
      <FieldErrorText message={error} />
    </View>
  )
}

export function Input({ value, onChangeText, editable = true, multiline = false, invalid = false, ...props }) {
  return (
    <TextInput
      {...props}
      value={value == null ? '' : String(value)}
      onChangeText={onChangeText}
      editable={editable}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      placeholderTextColor={COLORS.slate[400]}
      style={[multiline ? styles.textArea : styles.input, !editable ? styles.inputDisabled : null, invalid ? styles.inputInvalid : null]}
    />
  )
}

/** A pressable chip row standing in for a <select>. */
export function ChoiceRow({ options, value, onChange, invalid = false }) {
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const on = option.value === value
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.choice, on ? styles.choiceOn : null, invalid && !on ? styles.choiceInvalid : null]}>
            <Text style={[styles.choiceText, on ? styles.choiceTextOn : null]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Active / Pending / History, each with its count. */
export function RequestTabs({ tabs, active, onChange }) {
  return (
    <View style={styles.tabs}>
      {tabs.map((item) => {
        const on = item.id === active
        return (
          <Pressable key={item.id} onPress={() => onChange(item.id)} style={[styles.tab, on ? styles.tabOn : null]}>
            <Text style={[styles.tabText, on ? styles.tabTextOn : null]} numberOfLines={1}>{item.label}</Text>
            {item.list.length > 0 ? (
              <View style={[styles.tabCount, on ? styles.tabCountOn : null]}><Text style={[styles.tabCountText, on ? styles.tabTextOn : null]}>{item.list.length}</Text></View>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

export function Fact({ label, value, tone }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, tone ? { color: ink(tone) } : null]}>{value ?? '—'}</Text>  
        </View>
  )
}

export function Loading({ text }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="small" color={COLORS.brand[700]} />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  )
}

export const confirmAsync = (title, okLabel, cancelLabel) => new Promise((resolve) => {
  Alert.alert(title, undefined, [
    { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
    { text: okLabel, onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) })
})

/** Daily attendance saved for a labour request (web LaborDailyRecordsTable). */
export function LaborRecordsList({ records }) {
  const { t } = useLanguage()
  if (!records.length) return <Text style={styles.none}>{t('labor.attendance.none')}</Text>
  return (
    <View style={styles.records}>
      {records.map((record) => (
        <View key={record.id} style={styles.record}>
          <Text style={styles.recordDate}>{formatSupplyDate(record.work_date)}</Text>
          <View style={styles.recordGrid}>
            <Fact label={t('labor.field.present')} value={record.present_count} />
            <Fact label={t('labor.field.absent')} value={record.absent_count} />
            <Fact label={t('labor.field.halfDay')} value={record.half_day_count} />
            <Fact label={t('labor.field.otWorkers')} value={record.overtime_workers} />
            <Fact label={t('labor.field.otHours')} value={record.overtime_hours} />
          </View>
          {record.activity ? <Text style={styles.recordNote}>{`${t('labor.field.activity')}: ${record.activity}`}</Text> : null}
          {record.notes ? <Text style={styles.recordNote}>{`${t('labor.field.notes')}: ${record.notes}`}</Text> : null}
        </View>
      ))}
    </View>
  )
}

export function EquipmentImage({ src, style }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return <View style={[styles.imageEmpty, style]}><ImageOff size={22} color={COLORS.slate[300]} /></View>
  return <Image source={{ uri: imageUrl(src) }} style={[styles.image, style]} contentFit="contain" onError={() => setBroken(true)} />
}

/** The item's rental rates and sale price, as stored. */
export function EquipmentPrices({ item, money }) {
  const { t } = useLanguage()
  const rates = allowsRent(item) ? RATE_UNITS.filter((rate) => item[rate.field] != null) : []
  return (
    <View style={styles.prices}>
      {rates.map((rate) => (
        <Text key={rate.unit} style={styles.price}><Text style={styles.priceStrong}>{money(item[rate.field])}</Text>{` / ${t(rate.perKey)}`}</Text>
      ))}
      {allowsBuy(item) && item.sale_price != null ? (
        <Text style={styles.price}>{`${t('equipment.buyPrice')} `}<Text style={styles.priceStrong}>{money(item.sale_price)}</Text></Text>
      ) : null}
    </View>
  )
}

export function EquipmentRequestFacts({ request, money }) {
  const { t } = useLanguage()
  const rent = request.request_kind === 'RENT'
  const per = RATE_UNITS.find((rate) => rate.unit === request.rate_unit)
  return (
    <View style={styles.factGrid}>
      <Fact label={t('equipment.field.equipment')} value={request.item_name} />
      <Fact label={t('equipment.field.requestType')} value={kindLabel(request.request_kind, t)} />
      <Fact label={t('equipment.field.quantity')} value={request.quantity} />
      {rent ? (
        <>
          <Fact label={t('equipment.field.rentalPeriod')} value={`${formatSupplyDate(request.start_date)} – ${formatSupplyDate(request.end_date)}`} />
          <Fact label={t('equipment.field.rate')} value={`${money(request.unit_price)} / ${per ? t(per.perKey) : String(request.rate_unit || '').toLowerCase()}`} />
        </>
      ) : (
        <Fact label={t('equipment.field.salePrice')} value={money(request.unit_price)} />
      )}
    </View>
  )
}

/** A rental's logged hours, re-read whenever the panel reloads (refreshKey). */
export function EquipmentUsageHistory({ requestId, refreshKey }) {
  const { t } = useLanguage()
  const [state, setState] = useState({ loading: true, logs: [], error: '' })
  useEffect(() => {
    let current = true
    fetchEquipmentUsage(requestId)
      .then((logs) => { if (current) setState({ loading: false, logs: Array.isArray(logs) ? logs : [], error: '' }) })
      .catch((failure) => { if (current) setState({ loading: false, logs: [], error: supplyErrorMessage(failure, t('equipment.error.usageLoad')) }) })
    return () => { current = false }
  }, [requestId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps
  if (state.loading) return <Loading text={t('equipment.usage.loading')} />
  if (state.error) return <SupplyNotice notice={{ tone: 'error', text: state.error }} />
  if (!state.logs.length) return <Text style={styles.none}>{t('equipment.usage.none')}</Text>
  return (
    <View style={styles.records}>
      {state.logs.map((log) => (
        <View key={log.id} style={styles.usageRow}>
          <Text style={[styles.recordDate, { flex: 1 }]}>{formatSupplyDate(log.usage_date)}</Text>
          <Text style={styles.usageHours}>{`${log.hours_used} ${t('equipment.field.hoursUsed')}`}</Text>
          {log.notes ? <Text style={[styles.recordNote, { width: '100%' }]}>{log.notes}</Text> : null}
        </View>
      ))}
    </View>
  )
}

const styles = createStyles((c) => ({
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  notice: { overflow: 'hidden', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '700' },
    noticeError: { backgroundColor: soft('#fff1f2', '#be123c'), color: ink('#be123c') },
  noticeOk: { backgroundColor: soft('#ecfdf5', '#065f46'), color: ink('#065f46') },
  label: { marginBottom: 4, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textMuted },
  field: { marginBottom: 10 },
  input: { height: 42, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12, fontSize: 14, fontWeight: '600', color: c.text },
  textArea: { minHeight: 64, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontWeight: '600', color: c.text },
  inputDisabled: { backgroundColor: c.subtle, color: c.textSoft },
  inputInvalid: { borderColor: '#dc2626' },
  fieldError: { marginTop: 4, fontSize: 11.5, fontWeight: '600', color: '#dc2626' },
  choiceInvalid: { borderColor: '#dc2626' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 11, paddingVertical: 8 },
  choiceOn: { borderColor: '#2e7d55', backgroundColor: c.brandSoft },
  choiceText: { fontSize: 12.5, fontWeight: '800', color: c.textSoft },
  choiceTextOn: { color: c.brandTextStrong },
  tabs: { flexDirection: 'row', gap: 4, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 5 },
  tab: { flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 6 },
  tabOn: { backgroundColor: '#236645' },
  tabText: { flexShrink: 1, fontSize: 12, fontWeight: '800', color: c.textMuted },
  tabTextOn: { color: '#ffffff' },
  tabCount: { borderRadius: 999, backgroundColor: c.brandSoft, paddingHorizontal: 6, paddingVertical: 1 },
  tabCountOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabCountText: { fontSize: 10, fontWeight: '800', color: c.brandText },
  fact: { width: '50%', paddingRight: 6, paddingVertical: 3 },
  factLabel: { fontSize: 11, fontWeight: '700', color: c.textFaint },
  factValue: { fontSize: 12.5, fontWeight: '800', color: c.text },
  factGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 },
  loadingText: { fontSize: 12, fontWeight: '600', color: c.textMuted },
  none: { overflow: 'hidden', borderRadius: 12, backgroundColor: c.subtle, paddingHorizontal: 12, paddingVertical: 14, textAlign: 'center', fontSize: 12, fontWeight: '600', color: c.textMuted },
  records: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  record: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10, paddingVertical: 8 },
  recordDate: { fontSize: 12.5, fontWeight: '800', color: c.text },
  recordGrid: { marginTop: 2, flexDirection: 'row', flexWrap: 'wrap' },
  recordNote: { marginTop: 2, fontSize: 11.5, fontWeight: '600', color: c.textSoft },
  usageRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 10, paddingVertical: 8 },
  usageHours: { fontSize: 12, fontWeight: '800', color: c.text },
  image: { borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: surface('#ffffff') },  imageEmpty: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.subtle },
  prices: { gap: 2, borderRadius: 12, backgroundColor: c.subtle, paddingHorizontal: 10, paddingVertical: 7 },
  price: { fontSize: 12, fontWeight: '600', color: c.textSoft },
  priceStrong: { fontWeight: '800', color: c.text },
}))