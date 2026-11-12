// One of the supplier's listings as a product page: port of web
// pages/supplier/storefront/StorefrontProductDetail.jsx.
//
//   what the product IS  -- images, highlights, description, FAQs, returns
//     policy -- from its master product (GET /catalog/products/{id})
//   what it costs and how much is in stock -- from THIS supplier's listing
//   "You may also like" -- this supplier's other listings only
//
// Add To Cart is the buyer preview; nothing is ordered from here.
import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useSelector } from 'react-redux'
import { Image } from 'expo-image'
import {
  BellRing, Boxes, ChevronDown, CircleHelp, Clock3, Eye, EyeOff, FileText, IndianRupee, Pencil, RotateCcw, Star, Tags, Trash2, Truck,
} from 'lucide-react-native'
import { StackScreenShell, Section } from '../../components/builder/BuilderUi'
import { fetchCatalogProduct } from '../../api/catalog'
import { imageSource } from '../../api/client'
import { selectSupplierProducts } from '../../store/supplierCatalogSlice'
import { BulkPricingList, ServiceBadges, StockBadge, stockState } from '../owner/marketplace/shopParts'
import { useResponsive } from '../../hooks/useResponsive'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import {
  BrandLogo, ProductImage, QuantityAdd, discountOf, discountText, money, sellingPrice, usePreviewCart, useSupplierCountry,
} from './products/productParts'
import { PreviewCartBar, PreviewCartSheet, StorefrontCard, useListingActions } from './products/storefrontParts'

const RELATED = 4

/**
 * "You may also like": this supplier's OTHER listings, ranked same
 * subcategory > same category > same brand > same product type, newest first
 * within a rank. Listings sharing none of those are left out.
 */
export function relatedListings(listing, productList) {
  if (!listing) return []
  const same = (field) => (other) => listing[field] != null && listing[field] !== '' && String(other[field]) === String(listing[field])
  const rules = [same('subcategory_id'), same('category_id'), same('brand'), same('product_type')]
  return productList
    .filter((other) => other.id !== listing.id)
    .map((other) => ({ other, rank: rules.findIndex((rule) => rule(other)) }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || String(b.other.created_at || '').localeCompare(String(a.other.created_at || '')) || b.other.id - a.other.id)
    .slice(0, RELATED)
    .map(({ other }) => other)
}

function Accordion({ icon: Icon, title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <View style={styles.accordion}>
      <Pressable onPress={() => setOpen((value) => !value)} accessibilityState={{ expanded: open }} style={styles.accordionHead}>
        <View style={[styles.accordionIcon, open ? styles.accordionIconOn : null]}>
          <Icon size={15} color={open ? '#ffffff' : COLORS.brand[700]} />
        </View>
        <Text style={styles.accordionTitle}>{title}</Text>
        <ChevronDown size={18} color={open ? COLORS.brand[700] : COLORS.slate[400]} style={open ? { transform: [{ rotate: '180deg' }] } : null} />
      </Pressable>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  )
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}><Icon size={15} color={COLORS.brand[700]} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  )
}

const SERVICE_ITEMS = [
  { key: 'freeDelivery', icon: Truck, label: 'Free Delivery' },
  { key: 'deliveryTime', icon: Clock3, label: '60 Mins' },
  { key: 'payOnDelivery', icon: IndianRupee, label: 'Pay on Delivery' },
]

export default function SupplierListingScreen({ navigation, route }) {
  const listingId = route.params?.listingId
  const country = useSupplierCountry()
  const { width, maxContentWidth, gutter } = useResponsive()
  const productList = useSelector(selectSupplierProducts)
  const listing = productList.find((row) => String(row.id) === String(listingId)) || null
  const cart = usePreviewCart(productList)
  const [cartOpen, setCartOpen] = useState(false)
  const { togglePublish, askDelete, dialog } = useListingActions({ onDeleted: () => navigation.goBack() })

  const [master, setMaster] = useState(null)
  const [loading, setLoading] = useState(false)
  const [imageIndex, setImageIndex] = useState(0)

  useEffect(() => {
    setImageIndex(0)
    if (!listing?.master_product_id) {
      setMaster(null)
      return undefined
    }
    let live = true
    setLoading(true)
    fetchCatalogProduct(listing.master_product_id)
      .then((row) => live && setMaster(row))
      .catch(() => live && setMaster(null))
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [listing?.master_product_id])

  const related = useMemo(() => relatedListings(listing, productList), [listing, productList])

  if (!listing) {
    // Deleted (here or elsewhere): nothing to show.
    return (
      <StackScreenShell title="Product" onBack={() => navigation.goBack()}>
        <Section><Text style={styles.muted}>This product is no longer in your store.</Text></Section>
      </StackScreenShell>
    )
  }

  // Only the master product that belongs to this listing.
  const product = master && master.id === listing.master_product_id ? master : null
  const discount = discountOf(listing)
  const variant = (product?.variants || []).find((row) => row.id === listing.master_variant_id) || null
  const images = (product?.images?.length ? product.images : listing.image_url ? [{ id: 'listing', image_url: listing.image_url }] : [])
    .map((image) => (typeof image === 'string' ? image : image?.image_url || image?.url))
    .filter(Boolean)
  const shown = images[Math.min(imageIndex, Math.max(0, images.length - 1))]
  const category = product?.category_name || listing.category
  const subcategory = product?.subcategory_name || listing.subcategory_name
  const variantName = variant?.name || listing.size
  const unitName = variant?.unit?.name || product?.unit?.name || listing.unit
  const faqs = (product?.faqs || []).filter((faq) => faq && (faq.question || faq.answer))
  const highlights = (product?.highlights || []).map((line) => String(line || '').trim()).filter(Boolean)
  const tiers = listing.bulk_pricing || []
  const bestTier = tiers.reduce((low, tier) => (!low || tier.unit_price < low.unit_price ? tier : low), null)
  const outOfStock = stockState(listing.quantity, listing.low_stock_threshold) === 'out'
  const unpublished = listing.is_published === false
  const empty = <Text style={styles.muted}>{loading ? 'Loading…' : 'No information available.'}</Text>
  const inner = Math.min(width, maxContentWidth) - gutter * 2
  const relatedWidth = Math.floor((inner - 10) / 2)

  return (
    <StackScreenShell title={listing.name} subtitle={[category, subcategory].filter(Boolean).join(' / ')} onBack={() => navigation.goBack()}>
      <Section>
        {/* Gallery: the master product's images */}
        <View style={styles.gallery}>
          {loading && !product && !images.length ? (
            <ProductImage src={null} height={Math.min(inner - 24, 300)} />
          ) : (
            <ProductImage src={shown} height={Math.min(inner - 24, 300)} />
          )}
          {discount > 0 ? (
            <View style={styles.discount}><Text style={styles.discountText}>{discountText(discount)}</Text></View>
          ) : null}
        </View>
        {images.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 7 }}>
            {images.map((image, index) => (
              <Pressable
                key={`${image}-${index}`}
                onPress={() => setImageIndex(index)}
                accessibilityLabel={`Image ${index + 1}`}
                style={[styles.thumb, index === imageIndex ? styles.thumbOn : null]}
              >
                <Image source={imageSource(image)} style={{ width: 50, height: 50 }} contentFit="contain" />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <ServiceBadges size="md" style={{ marginTop: 14 }} />
        <View style={styles.brandRow}>
          <BrandLogo src={listing.brand_logo_url} name={listing.brand || 'Generic'} size={26} />
          <Text style={styles.brandText}>{listing.brand || 'Generic'}</Text>
        </View>
        <Text style={styles.name}>{listing.name}</Text>
        {[category, subcategory].filter(Boolean).length ? <Text style={styles.meta}>{[category, subcategory].filter(Boolean).join(' / ')}</Text> : null}
        {variantName || unitName ? <Text style={styles.meta}>{[variantName, unitName && `Sold per ${unitName}`].filter(Boolean).join(' · ')}</Text> : null}

        {/* Price */}
        <View style={styles.priceBlock}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{money(sellingPrice(listing), country)}</Text>
            {discount > 0 ? <Text style={styles.was}>{money(listing.price, country)}</Text> : null}
            {discount > 0 ? <Text style={styles.off}>{discountText(discount)}</Text> : null}
          </View>
          <BulkPricingList tiers={listing.bulk_pricing} unit={listing.unit} country={country} style={{ marginTop: 10 }} />
          <StockBadge quantity={listing.quantity} threshold={listing.low_stock_threshold} unit={listing.unit} style={{ marginTop: 10 }} />
        </View>

        {/* Purchase (buyer preview) */}
        <View style={{ marginTop: 16 }}>
          <QuantityAdd quantity={cart.quantityOf(listing.id)} onChange={(quantity) => cart.setQuantity(listing.id, quantity)} disabled={outOfStock} large />
          <Text style={styles.previewNote}>Buyer preview: this is how buyers add your product to their cart. Nothing is ordered from here.</Text>
        </View>

        {/* Service strip */}
        <View style={styles.serviceStrip}>
          {[
            ...SERVICE_ITEMS,
            ...(bestTier ? [{ key: 'bulk', icon: Tags, label: `Bulk: ${Number(bestTier.min_quantity)}+ ${money(bestTier.unit_price, country)}` }] : []),
          ].map(({ key, icon: Icon, label }) => (
            <View key={key} style={styles.serviceItem}>
              <Icon size={15} color={COLORS.brand[700]} />
              <Text style={styles.serviceText} numberOfLines={1}>{label}</Text>
            </View>
          ))}
        </View>

        {/* The supplier's own figures and actions */}
        <View style={styles.yours}>
          <StatCard icon={Boxes} label="Your stock" value={Number(listing.quantity || 0).toLocaleString('en-IN')} />
          <StatCard icon={BellRing} label="Low-stock alert" value={Number(listing.low_stock_threshold || 0).toLocaleString('en-IN')} />
          <StatCard icon={FileText} label="Status" value={unpublished ? 'Hidden' : 'Published'} />
          <View style={styles.actions}>
            <Pressable onPress={() => navigation.navigate('SupplierEditListing', { listingId: listing.id })} style={[styles.action, styles.actionDark]}>
              <Pencil size={15} color="#ffffff" />
              <Text style={[styles.actionText, { color: '#ffffff' }]}>Edit price & stock</Text>
            </Pressable>
            <View style={styles.actionPair}>
              <Pressable onPress={() => togglePublish(listing)} style={[styles.action, styles.actionOutline]}>
                {unpublished ? <Eye size={15} color={COLORS.slate[600]} /> : <EyeOff size={15} color={COLORS.slate[600]} />}
                <Text style={styles.actionText}>{unpublished ? 'Publish' : 'Unpublish'}</Text>
              </Pressable>
              <Pressable onPress={() => askDelete(listing)} style={[styles.action, styles.actionDanger]}>
                <Trash2 size={15} color="#dc2626" />
                <Text style={[styles.actionText, styles.actionDangerText]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Product content, from the master product's own columns */}
        <View style={styles.accordions}>
          <Accordion icon={Star} title="Product Highlights">
            {highlights.length ? highlights.map((line, index) => (
              <Text key={`${line}-${index}`} style={styles.body}>{`• ${line}`}</Text>
            )) : product?.short_description ? <Text style={styles.body}>{product.short_description}</Text> : empty}
          </Accordion>
          <Accordion icon={FileText} title="Product Description">
            {product?.description ? <Text style={styles.body}>{product.description}</Text> : empty}
          </Accordion>
          <Accordion icon={CircleHelp} title="FAQs">
            {faqs.length ? faqs.map((faq, index) => (
              <View key={`${faq.question}-${index}`} style={{ marginBottom: 10 }}>
                <Text style={styles.faqQ}>{faq.question}</Text>
                <Text style={styles.body}>{faq.answer}</Text>
              </View>
            )) : empty}
          </Accordion>
          <Accordion icon={RotateCcw} title="Returns & Exchange Policy">
            {product?.returns_exchange_policy ? <Text style={styles.body}>{product.returns_exchange_policy}</Text> : empty}
          </Accordion>
        </View>

        {related.length ? (
          <View style={{ marginTop: 22 }}>
            <Text style={styles.relatedTitle}>You may also like</Text>
            <View style={styles.relatedGrid}>
              {related.map((item) => (
                <StorefrontCard
                  key={item.id}
                  listing={item}
                  country={country}
                  width={relatedWidth}
                  layout="row"
                  quantity={cart.quantityOf(item.id)}
                  onQuantity={(value) => cart.setQuantity(item.id, value)}
                  onOpen={() => navigation.push('SupplierListing', { listingId: item.id })}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 16 }}>
          <PreviewCartBar cart={cart} country={country} onOpen={() => setCartOpen(true)} />
        </View>
      </Section>

      <PreviewCartSheet open={cartOpen} cart={cart} country={country} onClose={() => setCartOpen(false)} />
      {dialog}
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  muted: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', color: c.textMuted },
  gallery: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: '#ffffff', padding: 12 },
  discount: { position: 'absolute', left: 10, top: 10, borderRadius: 6, backgroundColor: '#fcd34d', paddingHorizontal: 8, paddingVertical: 3 },
  discountText: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: '#1f2937' },
  thumb: { overflow: 'hidden', borderRadius: 9, borderWidth: 1, borderColor: c.border, backgroundColor: '#ffffff', padding: 3 },
  thumbOn: { borderWidth: 2, borderColor: '#2e7d55' },
  brandRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandText: { fontSize: 11.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, textTransform: 'uppercase', color: c.brandText },
  name: { marginTop: 6, fontSize: 21, lineHeight: 26, letterSpacing: -0.3, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  meta: { marginTop: 3, fontSize: 13, fontFamily: 'Inter_400Regular', color: c.textMuted },
  priceBlock: { marginTop: 14, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 14 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 9 },
  price: { fontSize: 28, letterSpacing: -0.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  was: { fontSize: 14, fontFamily: 'Inter_500Medium', color: c.textFaint, textDecorationLine: 'line-through' },
  off: { overflow: 'hidden', borderRadius: 6, backgroundColor: c.brandSoft, paddingHorizontal: 7, paddingVertical: 2, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  previewNote: { marginTop: 7, fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_400Regular', color: c.textFaint },
  serviceStrip: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft },
  serviceItem: { width: '50%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 10 },
  serviceText: { flexShrink: 1, fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.text },
  yours: { marginTop: 16, overflow: 'hidden', borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: c.border, paddingHorizontal: 13, paddingVertical: 10 },
  statIcon: { height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.textMuted },
  statValue: { marginTop: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text },
  actions: { gap: 8, padding: 11 },
  actionPair: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10 },
  actionDark: { backgroundColor: '#1f2937' },
  actionOutline: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  actionDanger: { borderWidth: 1, borderColor: c.redBorder, backgroundColor: c.card },
  actionText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  actionDangerText: { color: '#dc2626' },
  accordions: { marginTop: 18, overflow: 'hidden', borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  accordion: { borderBottomWidth: 1, borderColor: c.borderSoft },
  accordionHead: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 8 },
  accordionIcon: { height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: c.brandSoft },
  accordionIconOn: { backgroundColor: '#236645' },
  accordionTitle: { flex: 1, fontSize: 14.5, fontFamily: 'Inter_600SemiBold', color: c.text },
  accordionBody: { paddingLeft: 56, paddingRight: 14, paddingBottom: 14, gap: 4 },
  body: { fontSize: 13.5, lineHeight: 20, fontFamily: 'Inter_400Regular', color: c.textSecondary },
  faqQ: { fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text },
  relatedTitle: { fontSize: 18, letterSpacing: -0.3, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  relatedGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
}))
