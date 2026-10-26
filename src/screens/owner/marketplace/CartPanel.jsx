// Port of the web components/shop/CartPanel.jsx (House Owner layout).
//
// A cart can hold products from several suppliers, and each supplier is sent
// its own buy request (POST /cart/checkout per supplier), so the lines are
// grouped by supplier. "Buy" per supplier, and one Buy for the whole cart that
// still sends one request per supplier. Buying needs a complete profile; the
// cart lives on the server, so after Complete Profile the same Buy resumes.
import { useEffect, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Image } from 'expo-image'
import { ArrowLeft, CheckCircle2, Minus, Package, Plus, ShoppingCart, Store, Trash2 } from 'lucide-react-native'
import { changeCartQuantity, emptyCart, loadCart, removeProductFromCart, selectCart, sendBuyRequest } from '../../../store/cartSlice'
import { useLanguage } from '../../../i18n/LanguageContext'
import { useProfileGate } from '../../../hooks/useProfileGate'
import { imageSource } from '../../../api/client'
import { formatMoney } from '../../../utils/countryConfig'
import { formatNumber } from '../../../utils/formatters'
import { SUPPLIER_CATEGORY_KEYS, optionLabel } from '../../../i18n/optionKeys'
import { COLORS } from '../../../theme/tokens'
import { createStyles } from '../../../theme/createStyles'

function CartLine({ line, country, busy, onChangeQuantity, onRemove }) {
  const { t, td } = useLanguage()
  const inStock = Number(line.available_quantity) > 0
  return (
    <View style={styles.view}>
      <View style={[styles.view2, { gap: 10 }]}>
        {line.image_url ? (
          <Image source={imageSource(line.image_url)} style={{ width: 54, height: 54, borderRadius: 10, backgroundColor: COLORS.slate[50] }} contentFit="contain" />
        ) : (
          <View style={styles.view3}>
            <Package size={20} color={COLORS.slate[300]} />
          </View>
        )}
        <View style={styles.view4}>
          {/* Product name, brand, size and unit are the supplier's own words. */}
          <Text style={[styles.text, { fontSize: 13.5 }]} numberOfLines={2}>{td(line.name)}</Text>
          <Text style={[styles.text2, { fontSize: 11 }]} numberOfLines={1}>
            {td([line.brand, line.size].filter(Boolean).join(' · ')) || optionLabel(t, SUPPLIER_CATEGORY_KEYS, line.category)}
          </Text>
          <Text style={[styles.text3, { fontSize: 11 }]}>
            {`${formatMoney(line.price, country)} ${t('dash.supplier.per')} ${td(line.unit)}`}
          </Text>
          {line.bulk_tier ? (
            <Text style={[styles.text4, { fontSize: 11 }]}>
              {`Bulk price applied (${line.bulk_tier.min_quantity}${line.bulk_tier.max_quantity == null ? '+' : `–${line.bulk_tier.max_quantity}`}) · normal ${formatMoney(line.normal_price, country)}`}
            </Text>
          ) : null}
          <Text style={[styles.text5, inStock ? styles.text6 : styles.text7, { fontSize: 11 }]}>
            {inStock ? `${formatNumber(line.available_quantity)} ${td(line.unit)} ${t('shop.inStock')}` : t('dash.supplier.outOfStock')}
          </Text>
        </View>
      </View>

      <View style={[styles.view5, { gap: 10 }]}>
        <View style={styles.view6}>
          <Pressable disabled={busy} onPress={() => onChangeQuantity(line, Number(line.quantity) - 1)} accessibilityLabel={t('shop.decrease')} style={styles.pressable}>
            <Minus size={14} color={COLORS.slate[500]} />
          </Pressable>
          <Text style={[styles.text8, { fontSize: 13.5 }]}>{formatNumber(line.quantity)}</Text>
          <Pressable disabled={busy} onPress={() => onChangeQuantity(line, Number(line.quantity) + 1)} accessibilityLabel={t('shop.increase')} style={styles.pressable}>
            <Plus size={14} color={COLORS.slate[500]} />
          </Pressable>
        </View>
        <Text style={[styles.text9, { fontSize: 14 }]}>{formatMoney(line.line_total, country)}</Text>
        <Pressable
          disabled={busy}
          onPress={() => onRemove(line)}
          accessibilityLabel={t('dash.common.delete')}
          style={styles.pressable2}
        >
          <Trash2 size={14} color="#dc2626" />
        </Pressable>
      </View>
    </View>
  )
}

export default function CartPanel({ projectId, country = 'India', onBack }) {
  const { t, td } = useLanguage()
  const { requireCompleteProfile } = useProfileGate()
  const dispatch = useDispatch()
  const cart = useSelector(selectCart)
  const [sentCode, setSentCode] = useState('')
  // Per-supplier outcome of the last Buy: [{ supplier, ok, detail }].
  const [outcomes, setOutcomes] = useState([])

  useEffect(() => { if (projectId) dispatch(loadCart(projectId)) }, [dispatch, projectId])

  const busy = cart.status === 'loading'
  const totalQuantity = cart.items.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
  const money = (value) => formatMoney(value, country)

  const changeQuantity = (line, quantity) => (quantity < 1
    ? dispatch(removeProductFromCart({ itemId: line.id }))
    : dispatch(changeCartQuantity({ itemId: line.id, quantity })))

  const buyOne = async (group) => {
    const result = await dispatch(sendBuyRequest({ projectId: Number(projectId), supplierId: group.supplier_id }))
    const ok = result.meta.requestStatus === 'fulfilled'
    if (ok) setSentCode(result.payload?.request_code || '')
    return {
      supplier: td(group.store_name || group.supplier_name || ''),
      ok,
      detail: ok ? String(result.payload?.request_code || '').slice(0, 8).toUpperCase() : result.payload,
    }
  }

  const submitGroup = async (supplierId) => {
    if (!projectId) return
    if (requireCompleteProfile(() => submitGroup(supplierId))) return
    const group = cart.suppliers.find((row) => row.supplier_id === supplierId)
    if (!group) return
    setOutcomes([await buyOne(group)])
  }

  // One Buy for the whole cart: one request per supplier, in turn. A supplier
  // that fails keeps its lines in the cart; the others still go through.
  const submitAll = async () => {
    if (!projectId) return
    if (requireCompleteProfile(() => submitAll())) return
    const results = []
    for (const group of [...cart.suppliers]) {
      results.push(await buyOne(group))
    }
    setOutcomes(results)
  }

  const backLink = onBack ? (
    <Pressable onPress={onBack} style={[styles.pressable3, { gap: 5 }]}>
      <ArrowLeft size={14} color={COLORS.brand[700]} />
      <Text style={[styles.text4, { fontSize: 12.5 }]}>{t('ui.suppliers')}</Text>
    </Pressable>
  ) : null

  const outcomeList = outcomes.length ? (
    <View style={{ gap: 6 }}>
      {outcomes.map((row) => (
        <Text
          key={row.supplier}
          style={[styles.text10, row.ok ? styles.text11 : styles.text12, { fontSize: 12, lineHeight: 17 }]}
        >
          {row.ok
            ? `Order ${row.detail} sent to ${row.supplier}. You will get a message when they accept it.`
            : `${row.supplier}: ${td(row.detail || 'The order could not be sent.')} These items are still in your cart.`}
        </Text>
      ))}
    </View>
  ) : null

  if (!cart.item_count) {
    return (
      <View>
        {backLink}
        <View style={styles.view7}>
          <View style={styles.view8}>
            <ShoppingCart size={20} color={COLORS.brand[700]} />
          </View>
          <Text style={[styles.text13, { fontSize: 17 }]}>{t('shop.cartEmpty')}</Text>
          <Text style={[styles.text14, { fontSize: 13 }]}>{t('shop.cartEmptyHint')}</Text>
          {sentCode && !outcomes.length ? (
            <View style={[styles.view9, { gap: 6 }]}>
              <CheckCircle2 size={15} color="#047857" />
              <Text style={[styles.text15, { fontSize: 12 }]}>{t('shop.requestSent')}</Text>
            </View>
          ) : null}
          {outcomeList ? <View style={styles.view10}>{outcomeList}</View> : null}
        </View>
      </View>
    )
  }

  return (
    <View style={{ gap: 12 }}>
      {backLink ? <View style={{ marginBottom: -12 }}>{backLink}</View> : null}
      <View style={[styles.view11, { gap: 10 }]}>
        <View style={styles.view4}>
          <Text style={[styles.text16, { fontSize: 17 }]}>{t('shop.reviewCart')}</Text>
          <Text style={[styles.text2, { fontSize: 11.5 }]}>
            {t('shop.itemsFromSuppliers', { items: cart.item_count, suppliers: cart.suppliers.length })}
          </Text>
        </View>
        <Pressable disabled={busy} onPress={() => dispatch(emptyCart(projectId))} style={styles.pressable4}>
          <Text style={[styles.text17, { fontSize: 12 }]}>{t('shop.clearCart')}</Text>
        </Pressable>
      </View>

      {outcomeList}
      {/* The server writes its refusals in English. */}
      {cart.errorMessage && !outcomes.length ? (
        <Text style={[styles.text18, { fontSize: 12 }]}>
          {td(cart.errorMessage)}
        </Text>
      ) : null}

      {cart.suppliers.map((group) => (
        <View key={group.supplier_id} style={styles.view12}>
          <View style={[styles.view13, { gap: 10 }]}>
            <View style={styles.view14}>
              <Store size={16} color={COLORS.brand[700]} />
            </View>
            <View style={styles.view4}>
              <Text style={[styles.text19, { fontSize: 10 }]}>{t('shop.soldBy')}</Text>
              <Text style={[styles.text, { fontSize: 14 }]} numberOfLines={1}>{td(group.store_name || group.supplier_name)}</Text>
            </View>
          </View>
          {group.items.map((line) => (
            <CartLine
              key={line.id}
              line={line}
              country={country}
              busy={busy}
              onChangeQuantity={changeQuantity}
              onRemove={(item) => dispatch(removeProductFromCart({ itemId: item.id }))}
            />
          ))}
          <View style={[styles.view15, { gap: 10 }]}>
            <Text style={[styles.text, { fontSize: 14 }]}>{`${t('shop.supplierTotal')}: ${money(group.total)}`}</Text>
            <Pressable
              disabled={busy || !projectId}
              onPress={() => submitGroup(group.supplier_id)}
              style={[styles.pressable5, busy ? styles.pressable6 : null]}
            >
              <Text style={[styles.text20, { fontSize: 13.5 }]}>Buy</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <View style={styles.view16}>
        <Text style={[styles.text16, { fontSize: 15 }]}>{t('shop.orderSummary')}</Text>
        {[
          [t('shop.subtotal'), money(cart.total)],
          [t('shop.products'), formatNumber(cart.item_count)],
          [t('shop.totalQuantity'), formatNumber(totalQuantity)],
        ].map(([label, value]) => (
          <View key={label} style={styles.view5}>
            <Text style={[styles.text21, { fontSize: 13 }]}>{label}</Text>
            <Text style={[styles.text, { fontSize: 13 }]}>{value}</Text>
          </View>
        ))}
        <View style={styles.view17}>
          <Text style={[styles.text, { fontSize: 14 }]}>{t('shop.estimatedTotal')}</Text>
          <Text style={[styles.text16, { fontSize: 19 }]}>{money(cart.total)}</Text>
        </View>
        {cart.suppliers.length > 1 ? (
          <Pressable
            disabled={busy || !projectId}
            onPress={submitAll}
            style={[styles.pressable7, busy ? styles.pressable6 : null]}
          >
            <Text style={[styles.text20, { fontSize: 13.5 }]}>
              {`Buy — ${cart.suppliers.length} suppliers, ${money(cart.total)}`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { borderTopWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  view2: { flexDirection: 'row', alignItems: 'flex-start' },
  view3: { height: 54, width: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.subtle },
  view4: { flex: 1 },
  text: { fontFamily: 'Inter_700Bold', color: c.text },
  text2: { fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  text3: { marginTop: 1.75, fontFamily: 'Inter_700Bold', color: c.textMuted },
  text4: { fontFamily: 'Inter_700Bold', color: c.brandText },
  text5: { fontFamily: 'Inter_700Bold' },
  text6: { color: c.emeraldTextSoft },
  text7: { color: c.roseTextSoft },
  view5: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  view6: { height: 31.5, flexDirection: 'row', alignItems: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border },
  pressable: { height: '100%', width: 31.5, alignItems: 'center', justifyContent: 'center' },
  text8: { width: 42, textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.text },
  text9: { flex: 1, textAlign: 'right', fontFamily: 'Inter_700Bold', color: c.text },
  pressable2: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.redBorderSoft, backgroundColor: c.redSoft },
  pressable3: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  text10: { borderRadius: 10.5, borderWidth: 1, paddingHorizontal: 10.5, paddingVertical: 7, fontFamily: 'Inter_700Bold' },
  text11: { borderColor: c.emeraldBorder, backgroundColor: c.emeraldSoft, color: c.emeraldTextStrong },
  text12: { borderColor: c.roseBorder, backgroundColor: c.roseSoft, color: c.roseText },
  view7: { alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 28 },
  view8: { height: 42, width: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: c.brandSoft },
  text13: { marginTop: 10.5, textAlign: 'center', fontFamily: 'Manrope_800ExtraBold', color: c.text },
  text14: { marginTop: 3.5, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textMuted },
  view9: { marginTop: 14, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.emeraldBorder, backgroundColor: c.emeraldSoft, paddingHorizontal: 10.5, paddingVertical: 7 },
  text15: { fontFamily: 'Inter_700Bold', color: c.emeraldTextStrong },
  view10: { marginTop: 14, width: '100%' },
  view11: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10.5 },
  text16: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  pressable4: { height: 31.5, justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10.5 },
  text17: { fontFamily: 'Inter_700Bold', color: c.textMuted },
  text18: { borderRadius: 10.5, borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft, paddingHorizontal: 10.5, paddingVertical: 7, fontFamily: 'Inter_700Bold', color: c.roseText },
  view12: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12.25 },
  view13: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10.5 },
  view14: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: c.brandSoft },
  text19: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.textFaint },
  view15: { marginTop: 3.5, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 10.5 },
  pressable5: { height: 38.5, justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038', paddingHorizontal: 17.5 },
  pressable6: { opacity: 0.5 },
  text20: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  view16: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  text21: { fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  view17: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 7 },
  pressable7: { marginTop: 14, height: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038', paddingHorizontal: 17.5 },
}))
