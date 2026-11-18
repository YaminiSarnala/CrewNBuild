// Small pieces the Site Engineer's Material screens share — the mobile form of
// the web PriceTag, StockBadge and SmartImage.
import { useState } from 'react'
import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import { Package } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { imageUrl } from '../../api/client'
import { formatMoney } from '../../utils/countryConfig'
import { formatNumber } from '../../utils/formatters'
import { discountedPrice } from '../../utils/orderHelpers'
import { COLORS } from '../../theme/tokens'
import { ink, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

/** The price after discount, the struck-through price and the discount, as the web PriceTag. */
export function PriceTag({ price, discountPercentage, unit = '', large = false, country }) {
  const discount = Number(discountPercentage || 0)
  const final = discountedPrice(price, discount)
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.price, large ? styles.priceLarge : null]}>{formatMoney(final, country)}</Text>
      {unit ? <Text style={styles.unit}>{`/ ${unit}`}</Text> : null}
      {discount > 0 ? (
        <>
          <Text style={styles.was}>{formatMoney(price, country)}</Text>
          <Text style={styles.off}>{`${Number(discount.toFixed(2))}% OFF`}</Text>
        </>
      ) : null}
    </View>
  )
}

/** In stock / low / out of stock, from the listing's own quantity and threshold. */
export function StockBadge({ quantity, threshold }) {
  const { t } = useLanguage()
  const available = Number(quantity || 0)
  const low = Number(threshold || 0)
  const [bg, fg, label] = available <= 0
    ? ['#fff1f2', '#be123c', t('dash.supplier.outOfStock')]
    : low && available <= low
      ? ['#fffbeb', '#b45309', `${formatNumber(available)} ${t('shop.inStock')}`]
      : ['#ecfdf5', '#047857', `${formatNumber(available)} ${t('shop.inStock')}`]
  return (
        <View style={[styles.stock, { backgroundColor: soft(bg, fg) }]}>
      <Text style={[styles.stockText, { color: ink(fg) }]} numberOfLines={1}>{label}</Text>
    </View>
  )
}

/** A stored image, or a package mark when there is none or it fails to load. */
export function SmartImage({ src, style, contentFit = 'contain', iconSize = 22 }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) return <View style={[styles.empty, style]}><Package size={iconSize} color={COLORS.slate[300]} /></View>
  return <Image source={{ uri: imageUrl(src) }} style={style} contentFit={contentFit} onError={() => setBroken(true)} />
}

const styles = createStyles((c) => ({
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 5 },
  price: { fontSize: 14, fontWeight: '800', color: c.text },
  priceLarge: { fontFamily: 'Manrope_800ExtraBold', fontSize: 22 },
  unit: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  was: { fontSize: 11, fontWeight: '600', color: c.textFaint, textDecorationLine: 'line-through' },
  off: { fontSize: 10.5, fontWeight: '800', color: ink('#047857') },
  stock: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  stockText: { fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.subtle },
}))