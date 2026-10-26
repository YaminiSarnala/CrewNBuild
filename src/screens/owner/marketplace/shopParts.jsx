// Small shop pieces shared by the owner's marketplace, product page and cart.
// Ports of the web components/shop/CartStepper.jsx, catalog/StockBadge.jsx,
// catalog/BulkPricing.jsx (BulkPricingList), catalog/PriceTag.jsx
// (discountedPrice) and catalog/ProductServiceBadges.jsx. The web shows this
// marketplace copy in English; so does the app.
import { useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { AlertTriangle, CheckCircle2, Clock3, IndianRupee, Minus, Plus, ShoppingCart, Tags, Truck, XCircle } from 'lucide-react-native'
import { addProductToCart, changeCartQuantity, removeProductFromCart, selectCart } from '../../../store/cartSlice'
import { formatMoney } from '../../../utils/countryConfig'
import { COLORS } from '../../../theme/tokens'
import { createStyles } from '../../../theme/createStyles'

export function discountedPrice(price, discountPercentage) {
  const base = Number(price || 0)
  const discount = Number(discountPercentage || 0)
  if (!Number.isFinite(base)) return 0
  if (!Number.isFinite(discount) || discount <= 0) return Math.round(base * 100) / 100
  return Math.round((base - (base * discount) / 100) * 100) / 100
}

const amount = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

// Stock status, as text plus an icon -- never colour alone.
export function stockState(quantity, threshold) {
  const qty = Number(quantity || 0)
  if (qty <= 0) return 'out'
  if (qty <= Number(threshold || 0)) return 'low'
  return 'in'
}

const STOCK = {
  in: { icon: CheckCircle2, box: 'tone', text: 'tone2', color: '#047857', label: 'In stock' },
  low: { icon: AlertTriangle, box: 'tone3', text: 'tone4', color: '#92400e', label: 'Low stock' },
  out: { icon: XCircle, box: 'tone5', text: 'tone6', color: '#be123c', label: 'Out of stock' },
}

export function StockBadge({ quantity, threshold, unit = '', style }) {
  const state = stockState(quantity, threshold)
  const look = STOCK[state]
  const Icon = look.icon
  const detail = state === 'low' ? ` · only ${amount(quantity)}${unit ? ` ${unit}` : ''} left` : ''
  return (
    <View style={[styles.view, styles[look.box], [{ gap: 3 }, style]]}>
      <Icon size={11} color={look.color} />
      <Text style={[styles.text, styles[look.text], { fontSize: 10.5 }]}>{`${look.label}${detail}`}</Text>
    </View>
  )
}

const rangeLabel = (tier, unit) => `${tier.min_quantity}${tier.max_quantity == null ? '+' : `–${tier.max_quantity}`}${unit ? ` ${unit}` : ''}`

export function BulkPricingList({ tiers = [], unit = '', country, compact = false, style }) {
  if (!tiers?.length) return null
  if (compact) {
    return (
      <View style={[styles.view2, [{ gap: 3 }, style]]}>
        <Tags size={10} color={COLORS.brand[800]} />
        <Text style={[styles.text2, { fontSize: 10 }]}>
          {`Bulk: ${tiers.map((tier) => `${rangeLabel(tier, '')} ${formatMoney(tier.unit_price, country)}`).join(' · ')}`}
        </Text>
      </View>
    )
  }
  return (
    <View style={[styles.view3, style]}>
      <View style={[styles.view4, { gap: 5 }]}>
        <Tags size={13} color={COLORS.brand[800]} />
        <Text style={[styles.text3, { fontSize: 12 }]}>Bulk pricing</Text>
      </View>
      {tiers.map((tier) => (
        <View key={tier.min_quantity} style={[styles.view5, { gap: 12 }]}>
          <Text style={[styles.text4, { fontSize: 12 }]}>{rangeLabel(tier, unit)}</Text>
          <Text style={[styles.text5, { fontSize: 12 }]}>
            {`${formatMoney(tier.unit_price, country)}${unit ? ` / ${unit}` : ''}`}
          </Text>
        </View>
      ))}
    </View>
  )
}

// Free Delivery · 60 Mins · Pay on Delivery (the web's PRODUCT_SERVICE_DEFAULTS).
export function ServiceBadges({ size = 'sm', style }) {
  const fontSize = size === 'sm' ? 10 : 12.5
  const icon = size === 'sm' ? 11 : 14
  return (
    <View style={[styles.view2, [{ gap: 6 }, style]]}>
      <View style={[styles.view6, { gap: 3 }]}>
        <Truck size={icon} color="#ffffff" />
        <Text style={[styles.text6, { fontSize }]}>Free Delivery</Text>
      </View>
      <View style={[styles.view4, { gap: 3 }]}>
        <Clock3 size={icon} color={COLORS.brand[700]} />
        <Text style={[styles.text3, { fontSize }]}>60 Mins</Text>
      </View>
      <View style={[styles.view4, { gap: 3 }]}>
        <IndianRupee size={icon} color={COLORS.brand[700]} />
        <Text style={[styles.text3, { fontSize }]}>Pay on Delivery</Text>
      </View>
    </View>
  )
}

/**
 * "Add to Cart", then [ − 1 + ] once the listing is in the cart. Only the
 * existing cart thunks (POST /cart/items, PATCH/DELETE /cart/items/{id});
 * stepping below one removes the line.
 */
export function CartStepper({ offer, projectId, onMessage, full = false, size = 'md' }) {
  const dispatch = useDispatch()
  const line = useSelector((state) => selectCart(state).items.find((item) => item.product_id === offer?.id)) || null
  const [busy, setBusy] = useState(false)
  const outOfStock = !offer || offer.stock_status === 'OUT_OF_STOCK' || Number(offer.quantity || 0) <= 0
  const height = size === 'sm' ? 34 : 40

  const run = async (action, success) => {
    setBusy(true)
    const result = await dispatch(action)
    setBusy(false)
    onMessage?.(result.meta.requestStatus === 'fulfilled' ? success : result.payload)
  }

  const add = () => {
    if (!projectId) {
      onMessage?.('Choose a project first; the cart belongs to a project.')
      return
    }
    run(addProductToCart({ projectId, productId: offer.id, quantity: 1 }), `${offer.name} added to your cart.`)
  }
  const step = (quantity) => (quantity < 1
    ? run(removeProductFromCart({ itemId: line.id }), `${offer.name} removed from your cart.`)
    : run(changeCartQuantity({ itemId: line.id, quantity }), ''))

  if (!line) {
    return (
      <Pressable
        onPress={add}
        disabled={busy || outOfStock}
        accessibilityRole="button"
        style={[styles.pressable, outOfStock ? styles.pressable2 : styles.pressable3, { height, gap: 5, alignSelf: full ? 'stretch' : 'flex-start' }]}
      >
        {busy ? <ActivityIndicator size="small" color="#ffffff" /> : <ShoppingCart size={13} color="#ffffff" />}
        <Text style={[styles.text6, { fontSize: 12 }]}>{outOfStock ? 'Out of stock' : 'Add to Cart'}</Text>
      </Pressable>
    )
  }
  return (
    <View
      style={[styles.view7, { height, alignSelf: full ? 'stretch' : 'flex-start' }]}
      accessibilityLabel={`${offer.name} in cart`}
    >
      <Pressable onPress={() => step(Number(line.quantity) - 1)} disabled={busy} accessibilityLabel="Decrease quantity" style={styles.pressable4}>
        <Minus size={14} color={COLORS.brand[800]} />
      </Pressable>
      {busy ? (
        <ActivityIndicator size="small" color={COLORS.brand[700]} style={{ minWidth: 36 }} />
      ) : (
        <Text style={[styles.text7, { fontSize: 13.5, minWidth: 36 }]}>{amount(line.quantity)}</Text>
      )}
      <Pressable onPress={() => step(Number(line.quantity) + 1)} disabled={busy} accessibilityLabel="Increase quantity" style={styles.pressable4}>
        <Plus size={14} color={COLORS.brand[800]} />
      </Pressable>
    </View>
  )
}

const styles = createStyles((c) => ({
  tone: { backgroundColor: c.emeraldSoft, borderColor: c.emeraldBorder },
  tone2: { color: c.emeraldText },
  tone3: { backgroundColor: c.amberSoft, borderColor: c.amberBorder },
  tone4: { color: c.amberTextStrong },
  tone5: { backgroundColor: c.roseSoft, borderColor: c.roseBorder },
  tone6: { color: c.roseText },
  view: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 9999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 1.75 },
  text: { fontFamily: 'Inter_700Bold' },
  view2: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  text2: { flex: 1, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  view3: { borderRadius: 7, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 7 },
  view4: { flexDirection: 'row', alignItems: 'center' },
  text3: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  view5: { marginTop: 1.75, flexDirection: 'row', justifyContent: 'space-between' },
  text4: { fontFamily: 'Inter_600SemiBold', color: c.text },
  text5: { fontFamily: 'Inter_700Bold', color: c.text },
  view6: { flexDirection: 'row', alignItems: 'center', borderRadius: 5.25, backgroundColor: '#1a5038', paddingHorizontal: 5.25, paddingVertical: 1.75 },
  text6: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  pressable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 7, paddingHorizontal: 10.5 },
  pressable2: { backgroundColor: c.mutedStronger },
  pressable3: { backgroundColor: '#1a5038' },
  view7: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 7, borderWidth: 2, borderColor: '#236645', backgroundColor: c.card },
  pressable4: { height: '100%', width: 31.5, alignItems: 'center', justifyContent: 'center' },
  text7: { textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.text },
}))
