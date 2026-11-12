// The supplier's Products tab: port of web pages/supplier/SupplierStorefront.jsx.
//
// Every product here is one of THIS supplier's listings (GET /supplier-products;
// the server filters by supplier and joins the master catalog for name, brand,
// category and image). Categories come from GET /catalog/categories for their
// order, name and picture, and only those holding a listing are shown.
//
//   Add product      the catalog picker (SupplierAddProduct)
//   a card           the product page (SupplierListing)
//   Edit             the listing editor (SupplierEditListing)
//   Add / cart       a buyer preview kept on the phone; the real cart is a buyer's
//
// The web's floating search panel becomes a search bar that filters the grid
// as you type, as on the owner's marketplace.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import { ArrowUpDown, LayoutGrid, PackageSearch, Search, X } from 'lucide-react-native'
import DashboardShell, { PanelState } from '../../components/DashboardShell'
import { Notice, SelectChip } from '../../components/builder/BuilderUi'
import { fetchCatalogCategories } from '../../api/catalog'
import { clearStoreFilters, selectStoreNotice, setStoreNotice, useStoreFilter } from '../../store/supplierCatalogSlice'
import { stockState } from '../owner/marketplace/shopParts'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import { CircleImage, currencySymbol, matchesWords, sellingPrice, usePreviewCart, useSupplierCountry, useSupplierListings } from './products/productParts'
import { PreviewCartBar, PreviewCartSheet, StorefrontCard, useListingActions } from './products/storefrontParts'

const GAP = 10

export default function SupplierProductsScreen({ navigation }) {
  const dispatch = useDispatch()
  const { t } = useLanguage()
  const country = useSupplierCountry()
  const { width, maxContentWidth, gutter, isTablet } = useResponsive()
  const { products: productList, status, reload } = useSupplierListings()
  const notice = useSelector(selectStoreNotice)
  const cart = usePreviewCart(productList)
  const { togglePublish, askDelete, dialog } = useListingActions()

  const [categoryId, setCategoryId] = useStoreFilter('storeCategory')
  const [subcategoryId, setSubcategoryId] = useStoreFilter('storeSubcategory')
  const [search, setSearch] = useStoreFilter('search')
  const [brand, setBrand] = useStoreFilter('brand')
  const [availability, setAvailability] = useStoreFilter('availability')
  const [published, setPublished] = useStoreFilter('status')
  const [priceMin, setPriceMin] = useStoreFilter('priceMin')
  const [priceMax, setPriceMax] = useStoreFilter('priceMax')
  const [sort, setSort] = useStoreFilter('sort')

  const [categories, setCategories] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)

  // Re-read the listings whenever the tab comes back into view (after an add,
  // an edit, or an order that changed stock).
  useFocusEffect(useCallback(() => { reload() }, [reload]))

  useEffect(() => {
    let live = true
    fetchCatalogCategories().then((rows) => live && setCategories(rows || [])).catch(() => live && setCategories([]))
    return () => { live = false }
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await reload()
    setRefreshing(false)
  }

  // Brand choices, from this supplier's own listings only.
  const brandOptions = useMemo(
    () => [...new Set(productList.map((product) => product.brand).filter(Boolean))].sort().map((name) => ({ value: name, label: name })),
    [productList],
  )
  // Categories this supplier has a listing in, in the catalog's order and name.
  const categoryOptions = useMemo(() => {
    const listed = new Map()
    for (const product of productList) {
      if (product.category_id) listed.set(String(product.category_id), product.category)
    }
    const catalogOrder = new Map(categories.map((row, index) => [String(row.id), index]))
    const catalogName = new Map(categories.map((row) => [String(row.id), row.name]))
    return [...listed.entries()]
      .map(([id, name]) => ({ id, name: catalogName.get(id) || name }))
      .sort((a, b) => (catalogOrder.get(a.id) ?? Infinity) - (catalogOrder.get(b.id) ?? Infinity) || String(a.name).localeCompare(String(b.name)))
  }, [productList, categories])
  const categoryImages = useMemo(() => new Map(categories.map((row) => [String(row.id), row.image_url])), [categories])
  // Subcategories holding one of this supplier's listings (in the chosen category).
  const subcategoryOptions = useMemo(() => {
    const seen = new Map()
    for (const product of productList) {
      if (!product.subcategory_id) continue
      if (categoryId && String(product.category_id) !== String(categoryId)) continue
      seen.set(String(product.subcategory_id), product.subcategory_name)
    }
    return [...seen.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]))).map(([value, label]) => ({ value, label }))
  }, [productList, categoryId])

  const visible = useMemo(() => {
    const words = String(search || '').trim().toLowerCase()
    const min = String(priceMin).trim() === '' ? null : Number(priceMin)
    const max = String(priceMax).trim() === '' ? null : Number(priceMax)
    const rows = productList.filter((product) => {
      if (categoryId && String(product.category_id) !== String(categoryId)) return false
      if (subcategoryId && String(product.subcategory_id) !== String(subcategoryId)) return false
      if (brand && product.brand !== brand) return false
      if (published === 'Published' && product.is_published === false) return false
      if (published === 'Unpublished' && product.is_published !== false) return false
      if (availability && stockState(product.quantity, product.low_stock_threshold) !== availability) return false
      const price = sellingPrice(product)
      if (min !== null && Number.isFinite(min) && price < min) return false
      if (max !== null && Number.isFinite(max) && price > max) return false
      if (words && !matchesWords(product, words)) return false
      return true
    })
    if (sort === 'price-asc') rows.sort((a, b) => sellingPrice(a) - sellingPrice(b))
    if (sort === 'price-desc') rows.sort((a, b) => sellingPrice(b) - sellingPrice(a))
    if (sort === 'discount-desc') rows.sort((a, b) => Number(b.discount_percentage || 0) - Number(a.discount_percentage || 0))
    if (sort === 'stock-asc') rows.sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0))
    return rows
  }, [productList, categoryId, subcategoryId, brand, published, availability, priceMin, priceMax, search, sort])

  const filtered = Boolean(categoryId || subcategoryId || String(search || '').trim() || brand || published || availability
    || String(priceMin).trim() || String(priceMax).trim())
  const clearAll = () => dispatch(clearStoreFilters())
  const chooseCategory = (id) => {
    setCategoryId(id)
    setSubcategoryId('')
  }

  const columns = isTablet ? 3 : 2
  const inner = Math.min(width, maxContentWidth) - gutter * 2
  const cardWidth = Math.floor((inner - GAP * (columns - 1)) / columns)
  const symbol = currencySymbol(country)

  const openAdd = () => {
    dispatch(setStoreNotice(null))
    navigation.navigate('SupplierAddProduct')
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ paddingHorizontal: gutter }}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('ui.products')}</Text>
            <Text style={styles.subtitle}>{`${productList.length} listing${productList.length === 1 ? '' : 's'} in your store`}</Text>
          </View>
          <Pressable onPress={openAdd} style={styles.addButton} accessibilityRole="button">
            <Text style={styles.addText} numberOfLines={1}>{t('dash.supplier.addPublishListing')}</Text>
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Search size={17} color={COLORS.slate[400]} />
          <TextInput
            value={search || ''}
            onChangeText={setSearch}
            placeholder="Search your products, brands or sizes"
            placeholderTextColor={COLORS.slate[400]}
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} accessibilityLabel="Clear search" hitSlop={8}>
              <X size={16} color={COLORS.slate[500]} />
            </Pressable>
          ) : null}
        </View>

        {notice ? (
          <Pressable onPress={() => dispatch(setStoreNotice(null))} style={{ marginTop: 10 }}>
            <Notice tone={notice.tone} text={notice.text} />
          </Pressable>
        ) : null}
      </View>

      {productList.length > 0 ? (
        <>
          {/* Categories of this supplier's listings */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8, paddingHorizontal: gutter }}>
            {[{ id: '', name: 'All' }, ...categoryOptions].map((row) => {
              const selected = String(categoryId || '') === row.id
              return (
                <Pressable
                  key={row.id || 'all'}
                  onPress={() => chooseCategory(row.id)}
                  accessibilityState={{ selected }}
                  style={[styles.categoryChip, selected ? styles.categoryChipOn : null]}
                >
                  {row.id ? (
                    <CircleImage src={categoryImages.get(row.id)} name={row.name} size={26} />
                  ) : (
                    <View style={styles.allIcon}><LayoutGrid size={14} color={COLORS.brand[700]} /></View>
                  )}
                  <Text style={[styles.categoryText, selected ? styles.categoryTextOn : null]} numberOfLines={1}>{row.name}</Text>
                </Pressable>
              )
            })}
          </ScrollView>

          {/* The shopping filters, straight above the grid */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8, paddingHorizontal: gutter, alignItems: 'center' }}>
            <SelectChip placeholder="All subcategories" value={subcategoryId || ''} options={subcategoryOptions} onChange={setSubcategoryId} />
            <SelectChip placeholder="All brands" value={brand || ''} options={brandOptions} onChange={setBrand} />
            <SelectChip
              placeholder="Availability"
              value={availability || ''}
              options={[{ value: 'in', label: 'In Stock' }, { value: 'low', label: 'Low Stock' }, { value: 'out', label: 'Out of Stock' }]}
              onChange={setAvailability}
            />
            <SelectChip
              placeholder="Published & hidden"
              value={published || ''}
              options={[{ value: 'Published', label: 'Published' }, { value: 'Unpublished', label: 'Hidden' }]}
              onChange={setPublished}
            />
            <SelectChip
              placeholder="Newest"
              icon={ArrowUpDown}
              value={sort || ''}
              options={[
                { value: 'price-asc', label: 'Price: low to high' },
                { value: 'price-desc', label: 'Price: high to low' },
                { value: 'discount-desc', label: 'Biggest discount' },
                { value: 'stock-asc', label: 'Lowest stock' },
              ]}
              onChange={setSort}
            />
          </ScrollView>
          <View style={[styles.priceRow, { paddingHorizontal: gutter }]}>
            <View style={[styles.priceBox, String(priceMin || '').trim() ? styles.priceBoxOn : null]}>
              <Text style={styles.priceAffix}>{symbol}</Text>
              <TextInput value={priceMin || ''} onChangeText={setPriceMin} placeholder="Min" placeholderTextColor={COLORS.slate[400]} keyboardType="decimal-pad" style={styles.priceInput} accessibilityLabel="Minimum price" />
            </View>
            <View style={[styles.priceBox, String(priceMax || '').trim() ? styles.priceBoxOn : null]}>
              <Text style={styles.priceAffix}>{symbol}</Text>
              <TextInput value={priceMax || ''} onChangeText={setPriceMax} placeholder="Max" placeholderTextColor={COLORS.slate[400]} keyboardType="decimal-pad" style={styles.priceInput} accessibilityLabel="Maximum price" />
            </View>
            {filtered ? (
              <Pressable onPress={clearAll} style={styles.clearAll}>
                <Text style={styles.clearAllText}>Clear all</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      <View style={{ paddingHorizontal: gutter, marginTop: 14 }}>
        {status === 'idle' ? (
          <PanelState loading />
        ) : status === 'error' && productList.length === 0 ? (
          <View style={styles.empty}>
            <PanelState error="Your products could not be loaded." />
            <Pressable onPress={reload} style={styles.retry}><Text style={styles.clearAllText}>{t('dash.engineer.liveCamera.retry')}</Text></Pressable>
          </View>
        ) : productList.length === 0 ? (
          <View style={styles.empty}>
            <PackageSearch size={38} color={COLORS.slate[300]} />
            <Text style={styles.emptyTitle}>Your store is empty</Text>
            <Text style={styles.emptyBody}>Products you add from the catalog, with your price and stock, appear here.</Text>
            <Pressable onPress={openAdd} style={[styles.addButton, { marginTop: 14 }]}>
              <Text style={styles.addText}>{t('dash.supplier.addPublishListing')}</Text>
            </Pressable>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <PackageSearch size={34} color={COLORS.slate[300]} />
            <Text style={styles.emptyTitle}>No products match</Text>
            <Pressable onPress={clearAll} style={styles.retry}><Text style={styles.clearAllText}>Clear search and filters</Text></Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {visible.map((listing) => (
              <StorefrontCard
                key={listing.id}
                listing={listing}
                country={country}
                width={cardWidth}
                quantity={cart.quantityOf(listing.id)}
                onQuantity={(quantity) => cart.setQuantity(listing.id, quantity)}
                onOpen={() => navigation.navigate('SupplierListing', { listingId: listing.id })}
                onEdit={() => navigation.navigate('SupplierEditListing', { listingId: listing.id })}
                onTogglePublish={() => togglePublish(listing)}
                onDelete={() => askDelete(listing)}
              />
            ))}
          </View>
        )}

        <View style={{ marginTop: 14 }}>
          <PreviewCartBar cart={cart} country={country} onOpen={() => setCartOpen(true)} />
        </View>
      </View>

      <PreviewCartSheet open={cartOpen} cart={cart} country={country} onClose={() => setCartOpen(false)} />
      {dialog}
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, letterSpacing: -0.4, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  subtitle: { marginTop: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textMuted },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, maxWidth: 210, borderRadius: 11, backgroundColor: '#1f2937', paddingHorizontal: 12 },
  addText: { flexShrink: 1, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  searchBox: { marginTop: 12, height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 13 },
  searchInput: { flex: 1, height: '100%', fontSize: 14, fontFamily: 'Inter_500Medium', color: c.text },
  categoryChip: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingLeft: 6, paddingRight: 12 },
  categoryChipOn: { borderColor: '#2e7d55', backgroundColor: c.brandSoft },
  allIcon: { height: 26, width: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: c.brandSoft },
  categoryText: { maxWidth: 160, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text },
  categoryTextOn: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  priceRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceBox: { flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10 },
  priceBoxOn: { borderColor: '#2e7d55', backgroundColor: c.brandSoft },
  priceAffix: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.textFaint },
  priceInput: { flex: 1, height: '100%', fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text },
  clearAll: { height: 38, justifyContent: 'center', paddingHorizontal: 8 },
  clearAllText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  empty: { alignItems: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, backgroundColor: c.card, paddingHorizontal: 22, paddingVertical: 34 },
  emptyTitle: { marginTop: 10, fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  emptyBody: { marginTop: 4, textAlign: 'center', fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', color: c.textMuted },
  retry: { marginTop: 8, paddingVertical: 6 },
}))
