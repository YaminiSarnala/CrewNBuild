// The storefront pieces (web pages/supplier/storefront/StorefrontProductCard.jsx
// and PreviewCart.jsx) and the listing actions every product surface offers:
// Edit, Publish / Unpublish and Delete (with the web's confirmation).
import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useDispatch } from 'react-redux'
import { Eye, EyeOff, Minus, Pencil, Plus, ShoppingCart, Trash2 } from 'lucide-react-native'
import { ConfirmDialog, SheetModal } from '../../../components/builder/BuilderUi'
import { BulkPricingList, ServiceBadges, StockBadge, stockState } from '../../owner/marketplace/shopParts'
import { setStoreNotice } from '../../../store/supplierCatalogSlice'
import { useLanguage } from '../../../i18n/LanguageContext'
import { COLORS } from '../../../theme/tokens'
import { createStyles } from '../../../theme/createStyles'
import {
  BrandLogo, ProductImage, QuantityAdd, discountOf, discountText, money, sellingPrice, sizeOf, useSupplierListings,
} from './productParts'

/**
 * Publish / Unpublish and Delete for one listing. Returns the handlers and the
 * confirmation dialog to render. `onDeleted` runs after a successful delete
 * (the product page closes itself).
 */
export function useListingActions({ onDeleted } = {}) {
  const dispatch = useDispatch()
  const { t, td } = useLanguage()
  const { update, remove } = useSupplierListings()
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)

  const togglePublish = async (listing) => {
    const result = await update(listing.id, { is_published: listing.is_published === false })
    dispatch(setStoreNotice(result.error ? { tone: 'error', text: result.error } : { tone: 'success', text: result.message }))
  }

  const confirmDelete = async () => {
    if (!pending) return
    setBusy(true)
    const result = await remove(pending.id)
    setBusy(false)
    setPending(null)
    dispatch(setStoreNotice(result.error ? { tone: 'error', text: result.error } : { tone: 'success', text: result.message }))
    if (!result.error && onDeleted) onDeleted()
  }

  const dialog = (
    <ConfirmDialog
      visible={!!pending}
      title={t('dash.common.delete')}
      body={pending ? t('dash.supplier.msg.deleteConfirm', { name: td(pending.name) || t('dash.supplier.msg.thisProduct') }) : ''}
      confirmLabel={t('dash.common.delete')}
      tone="danger"
      busy={busy}
      onConfirm={confirmDelete}
      onCancel={() => (busy ? null : setPending(null))}
    />
  )

  return { togglePublish, askDelete: setPending, dialog }
}

const DiscountBadge = ({ discount, style }) => (
  <View style={[styles.discount, style]}>
    <Text style={styles.discountText}>{discountText(discount)}</Text>
  </View>
)

function BrandRow({ listing }) {
  return (
    <View style={styles.brandRow}>
      <BrandLogo src={listing.brand_logo_url} name={listing.brand || 'Generic'} size={16} />
      <Text style={styles.brandText} numberOfLines={1}>{listing.brand || 'Generic'}</Text>
    </View>
  )
}

/**
 * A shop card for one listing.
 *   layout="grid"  the product grid, with the supplier's Edit / Publish /
 *                  Delete controls on the image
 *   layout="row"   "You may also like": compact, no controls
 */
export function StorefrontCard({ listing, country, width, quantity, onQuantity, onOpen, onEdit, onTogglePublish, onDelete, layout = 'grid' }) {
  const discount = discountOf(listing)
  const unpublished = listing.is_published === false
  const out = stockState(listing.quantity, listing.low_stock_threshold) === 'out'
  const compact = layout === 'row'

  return (
    <View style={[styles.card, { width }]}>
      <Pressable onPress={onOpen} accessibilityLabel={`View ${listing.name}`} style={styles.imageBox}>
        <ProductImage src={listing.image_url} height={compact ? 96 : 116} />
        {discount > 0 ? <DiscountBadge discount={discount} style={styles.badgeTopLeft} /> : null}
        {unpublished && !compact ? (
          <View style={[styles.hidden, { top: discount > 0 ? 24 : 0 }]}>
            <EyeOff size={10} color="#ffffff" />
            <Text style={styles.hiddenText}>HIDDEN</Text>
          </View>
        ) : null}
      </Pressable>
      {!compact ? (
        <View style={styles.controls}>
          {[
            { label: 'Edit listing', icon: Pencil, onPress: onEdit, color: COLORS.slate[600] },
            { label: unpublished ? 'Publish listing' : 'Unpublish listing', icon: unpublished ? Eye : EyeOff, onPress: onTogglePublish, color: COLORS.slate[600] },
            { label: `Delete ${listing.name}`, icon: Trash2, onPress: onDelete, color: '#dc2626' },
          ].map(({ label, icon: Icon, onPress, color }) => (
            <Pressable key={label} onPress={onPress} accessibilityLabel={label} hitSlop={4} style={styles.control}>
              <Icon size={13} color={color} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.body}>
        <BrandRow listing={listing} />
        <Pressable onPress={onOpen}>
          {/* Two lines reserved, so a one-line name does not lift the rest. */}
          <Text style={styles.name} numberOfLines={2}>{listing.name}</Text>
        </Pressable>
        <Text style={styles.size} numberOfLines={1}>{sizeOf(listing) || ' '}</Text>
        {!compact ? <ServiceBadges style={{ marginTop: 5 }} /> : null}
        <View style={styles.bottom}>
          <View style={styles.priceRow}>
            <Text style={[styles.price, compact ? { fontSize: 15 } : null]} numberOfLines={1}>{money(sellingPrice(listing), country)}</Text>
            {discount > 0 ? <Text style={styles.was} numberOfLines={1}>{money(listing.price, country)}</Text> : null}
          </View>
          {!compact && discount > 0 ? <Text style={styles.off}>{discountText(discount)}</Text> : null}
          {!compact ? (
            <>
              <BulkPricingList tiers={listing.bulk_pricing} country={country} compact style={{ marginTop: 3 }} />
              <StockBadge quantity={listing.quantity} threshold={listing.low_stock_threshold} style={{ marginTop: 4 }} />
            </>
          ) : null}
          <View style={{ marginTop: 9 }}>
            {compact ? (
              <CompactAdd quantity={quantity} onChange={onQuantity} disabled={out} />
            ) : (
              <QuantityAdd quantity={quantity} onChange={onQuantity} disabled={out} />
            )}
          </View>
        </View>
      </View>
    </View>
  )
}

/** The single Add of a "You may also like" card; − N + once added. */
function CompactAdd({ quantity, onChange, disabled }) {
  if (!quantity) {
    return (
      <Pressable onPress={() => onChange(1)} disabled={disabled} style={[styles.compactAdd, disabled ? styles.compactAddOff : null]}>
        {!disabled ? <ShoppingCart size={14} color="#ffffff" /> : null}
        <Text style={[styles.compactAddText, disabled ? styles.compactAddTextOff : null]}>{disabled ? 'Out of Stock' : 'Add'}</Text>
      </Pressable>
    )
  }
  return (
    <View style={[styles.compactAdd, { justifyContent: 'space-between', paddingHorizontal: 0 }]}>
      <Pressable onPress={() => onChange(quantity - 1)} accessibilityLabel="Decrease quantity" style={styles.compactStep}>
        <Minus size={14} color="#ffffff" />
      </Pressable>
      <Text style={styles.compactAddText}>{quantity}</Text>
      <Pressable onPress={() => onChange(quantity + 1)} accessibilityLabel="Increase quantity" style={styles.compactStep}>
        <Plus size={14} color="#ffffff" />
      </Pressable>
    </View>
  )
}

/** "N items · total  [View Cart]" -- the buyer preview's summary. */
export function PreviewCartBar({ cart, country, onOpen }) {
  if (!cart.count) return null
  return (
    <View style={styles.cartBar}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cartBarCount}>{`${cart.count} item${cart.count === 1 ? '' : 's'} · buyer preview`}</Text>
        <Text style={styles.cartBarTotal}>{money(cart.total, country)}</Text>
      </View>
      <Pressable onPress={onOpen} style={styles.cartBarButton}>
        <Text style={styles.cartBarButtonText}>View Cart</Text>
      </Pressable>
    </View>
  )
}

export function PreviewCartSheet({ open, cart, country, onClose }) {
  return (
    <SheetModal
      visible={open}
      title="Cart preview"
      subtitle="How a buyer's cart shows your products. Not saved, not ordered."
      onClose={onClose}
      footer={cart.lines.length ? (
        <View style={{ gap: 10 }}>
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotal}>{money(cart.total, country)}</Text>
          </View>
          <Pressable onPress={cart.clear} style={styles.clearCart}>
            <Text style={styles.clearCartText}>Clear preview</Text>
          </Pressable>
        </View>
      ) : null}
    >
      {cart.lines.length === 0 ? (
        <Text style={styles.cartEmpty}>Your cart preview is empty.</Text>
      ) : cart.lines.map(({ listing, quantity }) => (
        <View key={listing.id} style={styles.cartLine}>
          <View style={styles.cartThumb}>
            <ProductImage src={listing.image_url} height={56} compact />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cartName} numberOfLines={1}>{listing.name}</Text>
            <Text style={styles.cartMeta} numberOfLines={1}>{[listing.brand, sizeOf(listing)].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.cartMeta}>
              {money(sellingPrice(listing), country)}
              {discountOf(listing) > 0 ? `  ${discountText(discountOf(listing))}` : ''}
            </Text>
            <View style={styles.cartControls}>
              <View style={styles.cartStepper}>
                <Pressable onPress={() => cart.setQuantity(listing.id, quantity - 1)} accessibilityLabel="Decrease quantity" style={styles.cartStep}>
                  <Minus size={13} color={COLORS.slate[600]} />
                </Pressable>
                <Text style={styles.cartQty}>{quantity}</Text>
                <Pressable onPress={() => cart.setQuantity(listing.id, quantity + 1)} accessibilityLabel="Increase quantity" style={styles.cartStep}>
                  <Plus size={13} color={COLORS.slate[600]} />
                </Pressable>
              </View>
              <Pressable onPress={() => cart.setQuantity(listing.id, 0)} accessibilityLabel={`Remove ${listing.name}`} hitSlop={6}>
                <Trash2 size={16} color="#dc2626" />
              </Pressable>
            </View>
          </View>
          <Text style={styles.cartLineTotal}>{money(sellingPrice(listing) * quantity, country)}</Text>
        </View>
      ))}
    </SheetModal>
  )
}

const styles = createStyles((c) => ({
  card: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10 },
  imageBox: { overflow: 'hidden', borderRadius: 10, backgroundColor: '#ffffff' },
  badgeTopLeft: { position: 'absolute', left: 0, top: 0 },
  discount: { borderRadius: 6, backgroundColor: '#fcd34d', paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { fontSize: 10.5, fontFamily: 'Inter_700Bold', color: '#1f2937' },
  hidden: { position: 'absolute', left: 0, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, backgroundColor: '#1e293b', paddingHorizontal: 5, paddingVertical: 2 },
  hiddenText: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: '#ffffff' },
  controls: { position: 'absolute', right: 8, top: 8, gap: 5 },
  control: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  body: { flex: 1, marginTop: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 16 },
  brandText: { flex: 1, fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.brandText },
  name: { marginTop: 4, minHeight: 36, fontSize: 13.5, lineHeight: 18, fontFamily: 'Inter_600SemiBold', color: c.text },
  size: { marginTop: 1, fontSize: 12, fontFamily: 'Inter_400Regular', color: c.textMuted },
  bottom: { marginTop: 'auto', paddingTop: 7 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  price: { flexShrink: 1, fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  was: { flexShrink: 1, fontSize: 11, fontFamily: 'Inter_400Regular', color: c.textFaint, textDecorationLine: 'line-through' },
  off: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.brandTextSoft },
  compactAdd: { height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9, backgroundColor: '#236645', paddingHorizontal: 8 },
  compactAddOff: { backgroundColor: c.mutedStronger },
  compactAddText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  compactAddTextOff: { color: c.textMuted },
  compactStep: { height: '100%', width: 36, alignItems: 'center', justifyContent: 'center' },
  cartBar: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 11 },
  cartBarCount: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  cartBarTotal: { fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  cartBarButton: { height: 40, justifyContent: 'center', borderRadius: 11, backgroundColor: '#236645', paddingHorizontal: 18 },
  cartBarButtonText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  cartEmpty: { paddingVertical: 28, textAlign: 'center', fontSize: 13, fontFamily: 'Inter_400Regular', color: c.textMuted },
  cartLine: { flexDirection: 'row', gap: 10, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 12 },
  cartThumb: { height: 56, width: 56, overflow: 'hidden', borderRadius: 9, backgroundColor: c.subtle },
  cartName: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text },
  cartMeta: { marginTop: 1, fontSize: 11.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  cartControls: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 14 },
  cartStepper: { height: 30, flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border },
  cartStep: { height: '100%', width: 30, alignItems: 'center', justifyContent: 'center' },
  cartQty: { width: 26, textAlign: 'center', fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  cartLineTotal: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text },
  subtotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subtotalLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  subtotal: { fontSize: 19, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  clearCart: { height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: c.border },
  clearCartText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.textSecondary },
}))
