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
       <View className="flex-row items-center gap-1 self-start rounded-full px-2 py-0.5" style={{ backgroundColor: soft(style.bg, style.fg) }}>
      <Icon size={11} color={ink(style.fg)} />
      <Text className="text-[10px] font-extrabold" style={{ color: ink(style.fg) }}>{t(style.key)}</Text>
    </View>
  )
}

function PriceTag({ offer }) {
  const discount = Number(offer?.discount_percentage || 0)
  return (
    <View className="flex-row flex-wrap items-baseline gap-1">
      <Text className="text-[14px] font-extrabold text-graphite">{money(discountedPrice(offer.price, discount))}</Text>
      {discount > 0 ? <Text className="text-[10px] font-semibold text-slate-400 line-through">{money(offer.price)}</Text> : null}
      {offer.unit ? <Text className="text-[10px] font-semibold text-slate-500">/ {offer.unit}</Text> : null}
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
    <Pressable onPress={onOpen} className="mb-3 w-[48.5%] overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <View className="aspect-square items-center justify-center bg-slate-50">
        {product.image_url ? (
          <Image source={imageSource(product.image_url)} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        ) : (
          <Text className="text-[11px] font-bold text-slate-400">{t('mobile.account.catalog.noImage')}</Text>
        )}
        {discount > 0 ? (
          <View className="absolute left-2 top-2 rounded-md px-2 py-0.5" style={{ backgroundColor: '#f5b31b' }}>
            <Text className="text-[10px] font-extrabold" style={{ color: '#1f2937' }}>{t('mobile.account.catalog.percentOffBadge', { percent: Number(discount.toFixed(2)) })}</Text>
          </View>
        ) : null}
      </View>
      <View className="gap-1 p-2.5">
        <View className="flex-row items-center gap-1.5">
          {product.brand_logo_url ? <Image source={imageSource(product.brand_logo_url)} style={{ width: 14, height: 14, borderRadius: 3 }} contentFit="contain" /> : null}
          <Text className="flex-1 text-[10px] font-extrabold uppercase text-brand-700" numberOfLines={1}>{product.brand_name || t('mobile.account.catalog.generic')}</Text>
        </View>
        <Text className="text-xs font-extrabold leading-4 text-graphite" numberOfLines={2}>{product.name}</Text>
        <Text className="text-[11px] font-semibold text-slate-400" numberOfLines={1}>
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
          <View className="rounded-3xl border border-slate-200 bg-white p-4">
            <Text className="text-xs font-semibold text-slate-500">{t('mobile.account.catalog.subheading')}</Text>
            <View className="mt-3">
              <SearchBox value={search} onChangeText={setSearch} placeholder={t('mobile.account.catalog.searchPh')} />
            </View>

            {/* The admin's categories, as circles with their pictures. */}
            {categoryList.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4" contentContainerStyle={{ gap: 14 }}>
                {categoryList.map((category) => {
                  const on = category.id === categoryId
                  return (
                    <Pressable key={category.id} onPress={() => { setSearch(''); setCategoryId(on ? null : category.id) }} className="items-center" style={{ width: 72 }}>
                      <View
                        className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-50"
                        style={{ borderWidth: on ? 3 : 1, borderColor: on ? COLORS.brand[700] : (isDarkTheme() ? '#334155' : '#e2e8f0') }}
                      >
                        {category.image_url ? (
                          <Image source={imageSource(category.image_url)} style={{ width: 64, height: 64 }} contentFit="cover" />
                        ) : (
                          <Text className="text-xl font-extrabold text-brand-800">{String(category.name || '?').slice(0, 1).toUpperCase()}</Text>
                        )}
                      </View>
                      <Text className={`mt-1.5 text-center text-[12px] font-extrabold ${on ? 'text-brand-800' : 'text-graphite'}`} numberOfLines={1}>{category.name}</Text>
                    </Pressable>
                  )
                })}
              </ScrollView>
            ) : categories.loading ? <ActivityIndicator className="mt-4" color={COLORS.brand[800]} /> : null}

            {search.trim() ? (
              // Search results (web CatalogSearchOverlay).
              <View className="mt-4">
                {searching || loadingOffers ? (
                  <Text className="text-xs font-semibold text-slate-400">{t('shop.loading')}</Text>
                ) : !searchRows.length ? (
                  <Text className="rounded-lg bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">{t('mobile.account.catalog.noMatch')}</Text>
                ) : searchRows.map((product) => (
                  <Pressable key={product.id} onPress={() => setOpenProduct(product)} className="flex-row items-center gap-3 border-b border-slate-100 py-2.5">
                    <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                      {product.image_url ? <Image source={imageSource(product.image_url)} style={{ width: 44, height: 44 }} contentFit="contain" /> : <PackageSearch size={16} color={COLORS.slate[400]} />}
                    </View>
                    <View className="flex-1">
                      <Text className="text-[13px] font-extrabold text-graphite" numberOfLines={1}>{product.name}</Text>
                      <Text className="text-[11px] font-semibold text-slate-500" numberOfLines={1}>{[product.brand_name, product.category_name].filter(Boolean).join(' · ')}</Text>
                    </View>
                    {cheapest(product) ? <Text className="text-[12px] font-extrabold text-brand-800">{money(discountedPrice(cheapest(product).price, cheapest(product).discount_percentage))}</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : !categoryId ? (
              <View className="mt-4 flex-row items-center gap-2 rounded-lg bg-slate-50 px-3 py-3">
                <PackageSearch size={16} color={COLORS.slate[400]} />
                <Text className="flex-1 text-xs font-semibold text-slate-500">{t('mobile.account.catalog.chooseCategory')}</Text>
              </View>
            ) : null}
          </View>
        </Section>

        {!search.trim() && categoryId ? (
          <Section>
            <View className="mb-2 flex-row items-center gap-2">
              <Text className="text-sm font-extrabold uppercase text-graphite">{selectedCategory?.name}</Text>
              {!categoryProducts.loading && !loadingOffers ? <Text className="text-xs font-bold text-slate-400">{categoryRows.length}</Text> : null}
            </View>
            {categoryProducts.loading || loadingOffers ? (
              <Text className="text-xs font-semibold text-slate-400">{t('shop.loading')}</Text>
            ) : !categoryRows.length ? (
              <Text className="rounded-lg bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">{t('mobile.account.catalog.categoryEmpty')}</Text>
            ) : (
              <View className="flex-row flex-wrap justify-between">
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
          <View className="mb-3 h-40 items-center justify-center rounded-2xl bg-slate-50">
            <Image source={imageSource(openProduct.image_url)} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          </View>
        ) : null}
        <Text className="mb-2 text-[11px] font-semibold text-slate-400">{t('mobile.account.catalog.offerCount', { count: openOffers.length })}</Text>
        {openOffers.map((offer) => {
          const price = discountedPrice(offer.price, offer.discount_percentage)
          return (
            <View key={offer.id} className="mb-2 rounded-2xl border border-slate-200 p-3">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-[13px] font-extrabold text-graphite" numberOfLines={1}>{offer.supplier_name || t('dash.common.supplier')}</Text>
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