// The storefront card (web pages/supplier/storefront/StorefrontProductCard.jsx)
// and the listing actions every product surface offers: Edit, Publish /
// Unpublish and Delete (with the web's confirmation). No quantity or Add to
// Cart: a supplier sells here, never buys.
import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useDispatch } from 'react-redux'
import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react-native'
import { ConfirmDialog } from '../../../components/builder/BuilderUi'
import { BulkPricingList, ServiceBadges, StockBadge } from '../../owner/marketplace/shopParts'
import { setStoreNotice } from '../../../store/supplierCatalogSlice'
import { useLanguage } from '../../../i18n/LanguageContext'
import { COLORS } from '../../../theme/tokens'
import { createStyles } from '../../../theme/createStyles'
import {
  BrandLogo, ProductImage, discountOf, discountText, money, sellingPrice, sizeOf, useSupplierListings,
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
export function StorefrontCard({ listing, country, width, onOpen, onEdit, onTogglePublish, onDelete, layout = 'grid' }) {
  const discount = discountOf(listing)
  const unpublished = listing.is_published === false
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
        </View>
      </View>
    </View>
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
}))
