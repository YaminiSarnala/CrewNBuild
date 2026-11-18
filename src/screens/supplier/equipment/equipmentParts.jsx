// What every Equipment Supplier screen shows the same way: the rent / buy /
// condition vocabulary, the item's picture, and its rates and sale price as
// the backend stores them. Labels are translation keys, read at render time.
import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import { ImageOff } from 'lucide-react-native'
import { imageSource } from '../../../api/client'
import { useLanguage } from '../../../i18n/LanguageContext'
import { formatCalendarDate } from '../../../utils/formatters'
import { COLORS } from '../../../theme/tokens'
import { createStyles } from '../../../theme/createStyles'
import { money } from '../products/productParts'
import { StatusPill } from '../orders/orderParts'

export const EQUIPMENT_MODES = [
  { value: 'RENT', labelKey: 'equipment.mode.rent' },
  { value: 'BUY', labelKey: 'equipment.mode.buy' },
  { value: 'RENT_BUY', labelKey: 'equipment.mode.rentBuy' },
]
export const EQUIPMENT_CONDITIONS = [
  { value: 'NEW', labelKey: 'equipment.condition.new' },
  { value: 'USED', labelKey: 'equipment.condition.used' },
]
// rate_unit -> the item field holding that rate (the backend's RATE_COLUMNS).
export const RATE_UNITS = [
  { unit: 'HOUR', field: 'hourly_rate', rateKey: 'equipment.rate.hourly', perKey: 'equipment.per.hour' },
  { unit: 'DAY', field: 'daily_rate', rateKey: 'equipment.rate.daily', perKey: 'equipment.per.day' },
  { unit: 'WEEK', field: 'weekly_rate', rateKey: 'equipment.rate.weekly', perKey: 'equipment.per.week' },
  { unit: 'MONTH', field: 'monthly_rate', rateKey: 'equipment.rate.monthly', perKey: 'equipment.per.month' },
]

export const allowsRent = (item) => item?.mode === 'RENT' || item?.mode === 'RENT_BUY'
export const allowsBuy = (item) => item?.mode === 'BUY' || item?.mode === 'RENT_BUY'

export const modeLabel = (t, mode) => {
  const option = EQUIPMENT_MODES.find((item) => item.value === mode)
  return option ? t(option.labelKey) : mode || ''
}
export const conditionLabel = (t, condition) => t(condition === 'USED' ? 'equipment.condition.used' : 'equipment.condition.new')
export const kindLabel = (t, kind) => t(kind === 'RENT' ? 'equipment.kind.rent' : 'equipment.kind.buy')
export const ratePer = (t, unit) => {
  const rate = RATE_UNITS.find((item) => item.unit === unit)
  return rate ? t(rate.perKey) : String(unit || '').toLowerCase()
}

// Request statuses (the backend's), labelled with the web's labor.status keys.
export const REQUEST_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED']

/** A calendar date (or a timestamp's date part) in the selected language. */
export const equipmentDate = (value) => (value ? formatCalendarDate(String(value).slice(0, 10), '—') : '—')

export function RequestStatusPill({ status }) {
  const { t } = useLanguage()
  return <StatusPill status={status} label={REQUEST_STATUSES.includes(status) ? t(`labor.status.${status}`) : status} />
}

/** What was asked, from the request itself (unit_price is its own snapshot). */
export function EquipmentRequestFacts({ request, country }) {
  const { t } = useLanguage()
  const rent = request.request_kind === 'RENT'
  const facts = [
    [t('equipment.field.equipment'), request.item_name || '—', true],
    [t('equipment.field.requestType'), kindLabel(t, request.request_kind)],
    [t('equipment.field.quantity'), String(request.quantity ?? '—')],
    ...(rent
      ? [
          [t('equipment.field.rate'), `${money(request.unit_price, country)} / ${ratePer(t, request.rate_unit)}`],
          [t('equipment.field.rentalPeriod'), `${equipmentDate(request.start_date)} – ${equipmentDate(request.end_date)}`, true],
        ]
      : [[t('equipment.field.salePrice'), money(request.unit_price, country)]]),
  ]
  return (
    <View style={styles.facts}>
      {facts.map(([label, value, wide]) => (
        <View key={label} style={[styles.fact, wide ? styles.factWide : null]}>
          <Text style={styles.factLabel} numberOfLines={1}>{label}</Text>
          <Text style={styles.factValue} numberOfLines={2}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

/** The item's picture, shown whole, or a neutral box. */
export function EquipmentImage({ src, height = 96, width = '100%' }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  if (!src || broken) {
    return (
      <View style={[styles.noImage, { height, width }]}>
        <ImageOff size={22} color={COLORS.slate[300]} />
      </View>
    )
  }
  return (
    <Image
      source={imageSource(src)}
      style={[styles.image, { height, width }]}
      contentFit="contain"
      onError={() => setBroken(true)}
    />
  )
}

/** Its rental rates (only those set) and its sale price, as stored. */
export function EquipmentPrices({ item, country }) {
  const { t } = useLanguage()
  const rates = allowsRent(item) ? RATE_UNITS.filter((rate) => item[rate.field] != null) : []
  const sale = allowsBuy(item) && item.sale_price != null
  if (!rates.length && !sale) return null
  return (
    <View style={styles.prices}>
      {rates.map((rate) => (
        <Text key={rate.unit} style={styles.priceLine} numberOfLines={1}>
          <Text style={styles.priceStrong}>{money(item[rate.field], country)}</Text>
          {` / ${t(rate.perKey)}`}
        </Text>
      ))}
      {sale ? (
        <Text style={styles.priceLine} numberOfLines={1}>
          {`${t('equipment.buyPrice')} `}
          <Text style={styles.priceStrong}>{money(item.sale_price, country)}</Text>
        </Text>
      ) : null}
    </View>
  )
}

/** A small rounded label (condition, mode, active). */
export function Tag({ label, bg, fg }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  )
}

const styles = createStyles((c) => ({
  noImage: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.subtle },
  image: { borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: '#ffffff' },
  prices: { gap: 2, borderRadius: 10, backgroundColor: c.subtle, paddingHorizontal: 9, paddingVertical: 6 },
  priceLine: { fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textSecondary },
  priceStrong: { fontFamily: 'Inter_700Bold', color: c.text },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2.5 },
  tagText: { fontSize: 10.5, fontFamily: 'Inter_700Bold' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, columnGap: 10, borderRadius: 12, backgroundColor: c.subtle, padding: 10 },
  fact: { width: '46%', flexGrow: 1 },
  factWide: { width: '100%' },
  factLabel: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  factValue: { marginTop: 1, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
}))
