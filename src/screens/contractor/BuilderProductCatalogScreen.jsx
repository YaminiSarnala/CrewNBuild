// The Builder's "Product Catalog" — port of web components/shop/ProductCatalogPage
// as the builder uses it: BROWSE-ONLY (a Builder has no cart on the web).
//
// Two sources, never mixed (web parity):
//   - the admin's MASTER catalog (GET /catalog/categories, /catalog/products,
//     /catalog/search): categories as circles with their pictures, and what a
//     product is (name, brand, image, sizes);
//   - OFFERS from GET /suppliers/nearby: each supplier's published listing
//     linked to a master product (master_product_id).
// A product is listed only when at least one nearby supplier sells it, and its
// price is that supplier's (cheapest after discount first).
import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { PackageSearch, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react-native'
import DashboardShell, { useAsyncData } from '../../components/DashboardShell'
import { fetchNearbySuppliers } from '../../api/projects'
import { fetchCatalogCategories, fetchCatalogProducts, searchCatalog } from '../../api/catalog'
import { imageSource } from '../../api/client'
import { InfoRow, SearchBox, Section, SheetModal, Badge } from '../../components/builder/BuilderUi'
import { asList, money } from '../../utils/builderHelpers'
import { COLORS } from '../../theme/tokens'
import { useLanguage } from '../../i18n/LanguageContext'
import { ink, soft, isDarkTheme } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

const discountedPrice = (price, discount) => {
  const base = Number(price || 0)
  const off = Number(discount || 0)
  if (!Number.isFinite(base)) return 0
  if (!Number.isFinite(off) || off <= 0) return Math.round(base * 100) / 100
  return Math.round((base - (base * off) / 100) * 100) / 100
}

// web components/catalog/StockBadge
function stockState(quantity, threshold) {
  const qty = Number(quantity || 0)
  if (qty <= 0) return 'out'
  if (qty <= Number(threshold || 0)) return 'low'
  return 'in'
}
const STOCK = {
  in: { icon: CheckCircle2, bg: '#ecfdf5', fg: '#047857', key: 'dash.supplier.inStock' },
  low: { icon: AlertTriangle, bg: '#fffbeb', fg: '#92400e', key: 'owner.pa.stockLow' },
  out: { icon: XCircle, bg: '#fff1f2', fg: '#be123c', key: 'dash.supplier.outOfStock' },
}

function StockBadge({ quantity, threshold, t }) {
  const style = STOCK[stockState(quantity, threshold)]
  const Icon = style.icon
  return (
       <View style={[styles.view, { backgroundColor: soft(style.bg, style.fg) }]}>
      <Icon size={11} color={ink(style.fg)} />
      <Text style={[styles.text, { color: ink(style.fg) }]}>{t(style.key)}</Text>
    </View>
  )
}

function PriceTag({ offer }) {
  const discount = Number(offer?.discount_percentage || 0)
  return (
    <View style={styles.view2}>
      <Text style={styles.text2}>{money(discountedPrice(offer.price, discount))}</Text>
      {discount > 0 ? <Text style={styles.text3}>{money(offer.price)}</Text> : null}
      {offer.unit ? <Text style={styles.text4}>/ {offer.unit}</Text> : null}
    </View>
  )
}

/** Published, catalog-linked listings of every nearby supplier, as offers. */
function offersFrom(suppliers) {
  const offers = []
  for (const supplier of suppliers) {
    for (const listing of supplier.products || []) {
      if (listing.master_product_id == null || listing.is_published === false) continue
      offers.push({ ...listing, supplier_user_id: supplier.user_id, supplier_name: supplier.store_name || supplier.name })
    }
  }
  return offers
}

/** web catalog/ProductTile: image + discount badge, brand, name, sizes, price, stock. */
function ProductTile({ product, offer, onOpen, t }) {
  const discount = Number(offer?.discount_percentage || 0)
  const sizes = (product.variants || []).map((variant) => variant.name).filter(Boolean)
  return (
    <Pressable onPress={onOpen} style={styles.pressable}>
      <View style={styles.view3}>
        {product.image_url ? (
          <Image source={imageSource(product.image_url)} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        ) : (
          <Text style={styles.text5}>{t('mobile.account.catalog.noImage')}</Text>
        )}
        {discount > 0 ? (
          <View style={[styles.view4, { backgroundColor: '#f5b31b' }]}>
            <Text style={[styles.text, { color: '#1f2937' }]}>{t('mobile.account.catalog.percentOffBadge', { percent: Number(discount.toFixed(2)) })}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.view5}>
        <View style={styles.view6}>
          {product.brand_logo_url ? <Image source={imageSource(product.brand_logo_url)} style={{ width: 14, height: 14, borderRadius: 3 }} contentFit="contain" /> : null}
          <Text style={styles.text6} numberOfLines={1}>{product.brand_name || t('mobile.account.catalog.generic')}</Text>
        </View>
        <Text style={styles.text7} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.text8} numberOfLines={1}>
          {[product.subcategory_name, offer?.size || sizes.join(' / ')].filter(Boolean).join(' · ')}
        </Text>
        {offer ? (
          <>
            <PriceTag offer={offer} />
            <StockBadge quantity={offer.quantity} threshold={offer.low_stock_threshold} t={t} />
          </>
        ) : null}
      </View>
    </Pressable>
  )
}

export default function BuilderProductCatalogScreen({ navigation }) {
  const { t } = useLanguage()
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState(null)
  const [openProduct, setOpenProduct] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const categories = useAsyncData(() => fetchCatalogCategories().catch(() => []), [])
  const suppliers = useAsyncData(() => fetchNearbySuppliers(), [])
  const categoryProducts = useAsyncData(
    () => (categoryId ? fetchCatalogProducts({ categoryId }).catch(() => []) : Promise.resolve([])),
    [categoryId],
  )

  // master_product_id -> offers, cheapest (after discount) first.
  const offersByProduct = useMemo(() => {
    const map = {}
    offersFrom(asList(suppliers.data, 'suppliers', 'items')).forEach((offer) => {
      ;(map[offer.master_product_id] ||= []).push(offer)
    })
    Object.values(map).forEach((list) => list.sort((a, b) => discountedPrice(a.price, a.discount_percentage) - discountedPrice(b.price, b.discount_percentage)))
    return map
  }, [suppliers.data])
  const offered = (product) => Boolean(offersByProduct[product.id]?.length)
  const cheapest = (product) => (offersByProduct[product.id] || [])[0]

  // Search: debounced 250 ms, as on the web.
  useEffect(() => {
    const query = search.trim()
    if (!query) { setSearchResults([]); setSearching(false); return undefined }
    setSearching(true)
    const timer = setTimeout(() => {
      searchCatalog(query, 20)
        .then((rows) => setSearchResults(asList(rows, 'items', 'results', 'products')))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const categoryList = asList(categories.data, 'categories', 'items')
  const selectedCategory = categoryList.find((category) => category.id === categoryId) || null
  const categoryRows = asList(categoryProducts.data, 'products', 'items').filter(offered)
  const searchRows = searchResults.filter(offered)
  const loadingOffers = suppliers.loading && !suppliers.data

  const onRefresh = async () => {
    setRefreshing(true)
    try { await Promise.all([suppliers.reload(), categories.reload(), categoryProducts.reload()]) } finally { setRefreshing(false) }
  }

  const openOffers = openProduct ? offersByProduct[openProduct.id] || [] : []

  return (
    <>
      <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
        <Section>
          <View style={styles.view7}>
            <Text style={styles.text9}>{t('mobile.account.catalog.subheading')}</Text>
            <View style={styles.view8}>
              <SearchBox value={search} onChangeText={setSearch} placeholder={t('mobile.account.catalog.searchPh')} />
            </View>

            {/* The admin's categories, as circles with their pictures. */}
            {categoryList.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.view9} contentContainerStyle={{ gap: 14 }}>
                {categoryList.map((category) => {
                  const on = category.id === categoryId
                  return (
                    <Pressable key={category.id} onPress={() => { setSearch(''); setCategoryId(on ? null : category.id) }} style={[styles.pressable2, { width: 72 }]}>
                      <View
                        style={[styles.view10, { borderWidth: on ? 3 : 1, borderColor: on ? COLORS.brand[700] : (isDarkTheme() ? '#334155' : '#e2e8f0') }]}
                      >
                        {category.image_url ? (
                          <Image source={imageSource(category.image_url)} style={{ width: 64, height: 64 }} contentFit="cover" />
                        ) : (
                          <Text style={styles.text10}>{String(category.name || '?').slice(0, 1).toUpperCase()}</Text>
                        )}
                      </View>
                      <Text style={[styles.text11, on ? styles.text12 : styles.text13]} numberOfLines={1}>{category.name}</Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            ) : categories.loading ? <ActivityIndicator style={styles.view9} color={COLORS.brand[800]} /> : null}

            {search.trim() ? (
              // Search results (web CatalogSearchOverlay).
              <View style={styles.view9}>
                {searching || loadingOffers ? (
                  <Text style={styles.text14}>{t('shop.loading')}</Text>
                ) : !searchRows.length ? (
                  <Text style={styles.text15}>{t('mobile.account.catalog.noMatch')}</Text>
                ) : searchRows.map((product) => (
                  <Pressable key={product.id} onPress={() => setOpenProduct(product)} style={styles.pressable3}>
                    <View style={styles.view11}>
                      {product.image_url ? <Image source={imageSource(product.image_url)} style={{ width: 44, height: 44 }} contentFit="contain" /> : <PackageSearch size={16} color={COLORS.slate[400]} />}
                    </View>
                    <View style={styles.view12}>
                      <Text style={styles.text16} numberOfLines={1}>{product.name}</Text>
                      <Text style={styles.text17} numberOfLines={1}>{[product.brand_name, product.category_name].filter(Boolean).join(' · ')}</Text>
                    </View>
                    {cheapest(product) ? <Text style={styles.text18}>{money(discountedPrice(cheapest(product).price, cheapest(product).discount_percentage))}</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : !categoryId ? (
              <View style={styles.view13}>
                <PackageSearch size={16} color={COLORS.slate[400]} />
                <Text style={styles.text19}>{t('mobile.account.catalog.chooseCategory')}</Text>
              </View>
            ) : null}
          </View>
        </Section>

        {!search.trim() && categoryId ? (
          <Section>
            <View style={styles.view14}>
              <Text style={styles.text20}>{selectedCategory?.name}</Text>
              {!categoryProducts.loading && !loadingOffers ? <Text style={styles.text21}>{categoryRows.length}</Text> : null}
            </View>
            {categoryProducts.loading || loadingOffers ? (
              <Text style={styles.text14}>{t('shop.loading')}</Text>
            ) : !categoryRows.length ? (
              <Text style={styles.text15}>{t('mobile.account.catalog.categoryEmpty')}</Text>
            ) : (
              <View style={styles.view15}>
                {categoryRows.map((product) => (
                  <ProductTile key={product.id} product={product} offer={cheapest(product)} onOpen={() => setOpenProduct(product)} t={t} />
                ))}
              </View>
            )}
          </Section>
        ) : null}
      </DashboardShell>

      {/* A product's supplier offers, cheapest first. */}
      <SheetModal
        visible={!!openProduct}
        title={openProduct?.name}
        subtitle={[openProduct?.brand_name, openProduct?.category_name || selectedCategory?.name].filter(Boolean).join(' · ')}
        onClose={() => setOpenProduct(null)}
      >
        {openProduct?.image_url ? (
          <View style={styles.view16}>
            <Image source={imageSource(openProduct.image_url)} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          </View>
        ) : null}
        <Text style={styles.text22}>{t('mobile.account.catalog.offerCount', { count: openOffers.length })}</Text>
        {openOffers.map((offer) => {
          const price = discountedPrice(offer.price, offer.discount_percentage)
          return (
            <View key={offer.id} style={styles.view17}>
              <View style={styles.view18}>
                <Text style={styles.text23} numberOfLines={1}>{offer.supplier_name || t('dash.common.supplier')}</Text>
                <Badge label={t(STOCK[stockState(offer.quantity, offer.low_stock_threshold)].key)} />
              </View>
              <InfoRow label={t('dash.supplier.price')} value={`${money(price)}${offer.unit ? ` / ${offer.unit}` : ''}`} strong />
              {Number(offer.discount_percentage || 0) > 0 ? <InfoRow label={t('mobile.account.catalog.discount')} value={t('mobile.account.catalog.percentOff', { percent: Number(offer.discount_percentage), price: money(offer.price) })} /> : null}
              {offer.size ? <InfoRow label={t('dash.supplier.size')} value={offer.size} /> : null}
              {(offer.bulk_pricing || []).length ? (
                <InfoRow label={t('mobile.account.catalog.bulkPrice')} value={offer.bulk_pricing.map((tier) => t('mobile.account.catalog.bulkTier', { price: money(tier.unit_price), quantity: tier.min_quantity })).join(', ')} />
              ) : null}
            </View>
          )
        })}
      </SheetModal>
    </>
  )
}

const styles = createStyles((c) => ({
  view: { flexDirection: 'row', alignItems: 'center', gap: 3.5, alignSelf: 'flex-start', borderRadius: 9999, paddingHorizontal: 7, paddingVertical: 1.75 },
  text: { fontSize: 10, fontWeight: '800' },
  view2: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 3.5 },
  text2: { fontSize: 14, fontWeight: '800', color: c.text },
  text3: { fontSize: 10, fontWeight: '600', color: c.textFaint, textDecorationLine: 'line-through' },
  text4: { fontSize: 10, fontWeight: '600', color: c.textMuted },
  pressable: { marginBottom: 10.5, width: '48.5%', overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  view3: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.subtle },
  text5: { fontSize: 11, fontWeight: '700', color: c.textFaint },
  view4: { position: 'absolute', left: 7, top: 7, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1.75 },
  view5: { gap: 3.5, padding: 8.75 },
  view6: { flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text6: { flex: 1, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: c.brandText },
  text7: { fontSize: 12, lineHeight: 14, fontWeight: '800', color: c.text },
  text8: { fontSize: 11, fontWeight: '600', color: c.textFaint },
  view7: { borderRadius: 24, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  text9: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  view8: { marginTop: 10.5 },
  view9: { marginTop: 14 },
  pressable2: { alignItems: 'center' },
  view10: { height: 56, width: 56, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 9999, backgroundColor: c.brandSoft },
  text10: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: c.brandTextStrong },
  text11: { marginTop: 5.25, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  text12: { color: c.brandTextStrong },
  text13: { color: c.text },
  text14: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textFaint },
  text15: { borderRadius: 8, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 10.5, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  pressable3: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  view11: { height: 38.5, width: 38.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 8, backgroundColor: c.subtle },
  view12: { flex: 1 },
  text16: { fontSize: 13, fontWeight: '800', color: c.text },
  text17: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  text18: { fontSize: 12, fontWeight: '800', color: c.brandTextStrong },
  view13: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 8, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 10.5 },
  text19: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  view14: { marginBottom: 7, flexDirection: 'row', alignItems: 'center', gap: 7 },
  text20: { fontSize: 14, lineHeight: 20, fontWeight: '800', textTransform: 'uppercase', color: c.text },
  text21: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textFaint },
  view15: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  view16: { marginBottom: 10.5, height: 140, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: c.subtle },
  text22: { marginBottom: 7, fontSize: 11, fontWeight: '600', color: c.textFaint },
  view17: { marginBottom: 7, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 10.5 },
  view18: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text23: { flex: 1, fontSize: 13, fontWeight: '800', color: c.text },
}))
