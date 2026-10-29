// The Builder's "Product Catalog" — port of web ProductCatalogPage as the
// builder uses it: BROWSE-ONLY (a Builder has no cart on the web), with offers
// from the nearby suppliers found by the same GET /suppliers/nearby rules.
//
// As on the web, a product is listed only when at least one supplier sells it
// (a published listing linked to a master catalog product), and its price is
// that supplier's. Offers for the same master product are grouped, cheapest
// (after discount) first.
// Strings use existing web keys where they match, else mobile.account.catalog.*.
import { useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Package } from 'lucide-react-native'
import DashboardShell, { PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchNearbySuppliers } from '../../api/projects'
import { Badge, InfoRow, SearchBox, Section, SegmentTabs, SheetModal } from '../../components/builder/BuilderUi'
import { asList, money } from '../../utils/builderHelpers'
import { COLORS } from '../../theme/tokens'
import { useLanguage } from '../../i18n/LanguageContext'

const discountedPrice = (price, discount) => {
  const base = Number(price || 0)
  const off = Number(discount || 0)
  if (!Number.isFinite(base)) return 0
  if (!Number.isFinite(off) || off <= 0) return Math.round(base * 100) / 100
  return Math.round((base - (base * off) / 100) * 100) / 100
}

const STOCK_LABEL_KEYS = { IN_STOCK: 'dash.supplier.inStock', LOW_STOCK: 'owner.pa.stockLow', OUT_OF_STOCK: 'dash.supplier.outOfStock' }

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

export default function BuilderProductCatalogScreen({ navigation }) {
  const { t } = useLanguage()
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [openProduct, setOpenProduct] = useState(null)
  const suppliers = useAsyncData(() => fetchNearbySuppliers(), [])

  const products = useMemo(() => {
    const groups = {}
    offersFrom(asList(suppliers.data, 'suppliers', 'items')).forEach((offer) => {
      const key = offer.master_product_id
      groups[key] = groups[key] || {
        id: key,
        name: offer.master_product_name || offer.name || offer.product_name || t('dash.supplier.product'),
        brand: offer.brand_name || offer.brand || '',
        category: offer.category_name || offer.category || t('dash.common.other'),
        unit: offer.unit || '',
        offers: [],
      }
      groups[key].offers.push(offer)
    })
    return Object.values(groups).map((product) => {
      const offers = [...product.offers].sort((a, b) => discountedPrice(a.price, a.discount_percentage) - discountedPrice(b.price, b.discount_percentage))
      return { ...product, offers, best: offers[0] }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [suppliers.data, t])

  const categories = useMemo(() => [...new Set(products.map((product) => product.category))].sort(), [products])
  const needle = search.trim().toLowerCase()
  const shown = products.filter((product) => (category === 'all' || product.category === category)
    && (!needle || `${product.name} ${product.brand} ${product.category}`.toLowerCase().includes(needle)))

  const onRefresh = async () => {
    setRefreshing(true)
    try { await suppliers.reload() } finally { setRefreshing(false) }
  }

  return (
    <>
      <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
        <Section>
          <SearchBox value={search} onChangeText={setSearch} placeholder={t('mobile.account.catalog.searchPh')} />
          {categories.length > 1 ? (
            <View className="mt-2">
              <SegmentTabs dense tabs={[{ id: 'all', label: t('shop.allCategories') }, ...categories.map((item) => ({ id: item, label: item }))]} active={category} onChange={setCategory} />
            </View>
          ) : null}
          <Text className="mt-2 text-[11px] font-semibold text-slate-400">{t('mobile.account.catalog.note')}</Text>
        </Section>
        <Section>
          <PanelState loading={suppliers.loading} error={suppliers.error} empty={!shown.length} emptyText={products.length ? t('mobile.account.catalog.noMatch') : t('mobile.account.catalog.noSuppliers')}>
            {shown.map((product) => {
              const best = product.best
              const price = discountedPrice(best?.price, best?.discount_percentage)
              return (
                <Pressable key={product.id} onPress={() => setOpenProduct(product)} className="mb-3 flex-row items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4">
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
                    <Package size={18} color={COLORS.brand[700]} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>{product.name}</Text>
                    <Text className="text-[11px] font-semibold text-slate-500" numberOfLines={1}>{[product.brand, product.category].filter(Boolean).join(' · ')}</Text>
                    <Text className="mt-0.5 text-[11px] font-semibold text-slate-400">{t('mobile.account.catalog.offerCount', { count: product.offers.length })}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-[10px] font-bold text-slate-400">{t('shop.from')}</Text>
                    <Text className="text-[14px] font-extrabold text-brand-800">{money(price)}</Text>
                    {best?.unit ? <Text className="text-[10px] text-slate-400">/ {best.unit}</Text> : null}
                  </View>
                </Pressable>
              )
            })}
          </PanelState>
        </Section>
      </DashboardShell>

      <SheetModal visible={!!openProduct} title={openProduct?.name} subtitle={[openProduct?.brand, openProduct?.category].filter(Boolean).join(' · ')} onClose={() => setOpenProduct(null)}>
        {openProduct?.offers.map((offer) => {
          const price = discountedPrice(offer.price, offer.discount_percentage)
          return (
            <View key={offer.id} className="mb-2 rounded-2xl border border-slate-200 p-3">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-[13px] font-extrabold text-graphite" numberOfLines={1}>{offer.supplier_name || t('dash.common.supplier')}</Text>
                {offer.stock_status ? <Badge label={STOCK_LABEL_KEYS[offer.stock_status] ? t(STOCK_LABEL_KEYS[offer.stock_status]) : offer.stock_status} /> : null}
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
