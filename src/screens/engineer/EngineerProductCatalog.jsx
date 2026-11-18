// The Site Engineer's Product Catalog — port of the web
// components/shop/ProductCatalogPage.jsx as the engineer uses it (compact
// header, browse only). Two sources, never mixed:
//   - the admin's MASTER catalog (/catalog/*): categories with pictures, what a
//     product is (name, brand, images, highlights, description, FAQs, returns);
//   - OFFERS from the engineer's Material Suppliers' published listings.
// A product is listed only when at least one of those suppliers sells it, and
// its price is theirs.
import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import { ArrowLeft, PackageSearch, Search, Store, X } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { fetchCatalogCategories, fetchCatalogProduct, fetchCatalogProducts, searchCatalog } from '../../api/catalog'
import { bestOffer, discountedPrice } from '../../utils/orderHelpers'
import { fetchMaterialSuppliers } from './EngineerMaterialSuppliers'
import { PriceTag, SmartImage, StockBadge } from './materialParts'
import { COLORS } from '../../theme/tokens'
import { ink, soft, surface } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

// Every published listing of a master product becomes an offer, tagged with its supplier.
async function loadOffers(projects) {
  const suppliers = await fetchMaterialSuppliers(projects)
  const offers = []
  for (const supplier of suppliers) {
    for (const listing of supplier.products || []) {
      if (listing.master_product_id == null || listing.is_published === false) continue
      offers.push({ ...listing, supplier_user_id: supplier.user_id, supplier_name: supplier.store_name || supplier.name })
    }
  }
  return offers
}

function ProductTile({ product, offer, onOpen }) {
  const discount = Number(offer?.discount_percentage || 0)
  const sizes = (product.variants || []).map((variant) => variant.name).filter(Boolean)
  return (
    <Pressable onPress={onOpen} style={styles.tile}>
      <View>
        <SmartImage src={product.image_url} style={styles.tileImage} />
        {discount > 0 ? <Text style={styles.offBadge}>{`${Number(discount.toFixed(2))}% OFF`}</Text> : null}
      </View>
      <View style={styles.tileBody}>
        <Text style={styles.brand} numberOfLines={1}>{product.brand_name || 'Generic'}</Text>
        <Text style={styles.tileName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{[product.subcategory_name, offer?.size || sizes.join(' / ')].filter(Boolean).join(' · ')}</Text>
        {offer ? (
          <View style={{ gap: 4, marginTop: 2 }}>
            <PriceTag price={offer.price} discountPercentage={offer.discount_percentage} unit={offer.unit} />
            <StockBadge quantity={offer.quantity} threshold={offer.low_stock_threshold} />
          </View>
        ) : null}
      </View>
    </Pressable>
  )
}

function Fold({ title, open: initiallyOpen = false, children }) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <View style={styles.fold}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.foldHead}>
        <Text style={styles.foldTitle}>{title}</Text>
        <Text style={styles.foldSign}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <View style={styles.foldBody}>{children}</View> : null}
    </View>
  )
}
const NotAdded = () => <Text style={styles.faint}>Not added yet.</Text>

/** One master product with every supplier's offer (web ProductDetailView). */
function ProductDetail({ product, offers, related, relatedPrice, onBack, onOpenProduct }) {
  const [imageIndex, setImageIndex] = useState(0)
  useEffect(() => { setImageIndex(0) }, [product?.id])
  if (!product) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={COLORS.brand[700]} />
        <Text style={styles.meta}>Loading product…</Text>
      </View>
    )
  }
  const best = bestOffer(offers)
  const unitName = product.unit?.name || product.unit_code || ''
  const images = (product.images || []).map((image) => (typeof image === 'string' ? image : image?.url || image?.image_url)).filter(Boolean)
  const highlights = product.highlights || []
  const faqs = product.faqs || []
  const specifications = Object.entries(product.specifications || {})
  return (
    <View style={{ gap: 12 }}>
      <Pressable onPress={onBack} style={styles.backLink}>
        <ArrowLeft size={14} color={COLORS.brand[700]} />
        <Text style={styles.backLinkText}>Back to products</Text>
      </Pressable>
      <SmartImage src={images[imageIndex] || product.image_url} style={styles.heroImage} iconSize={34} />
      {images.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {images.map((source, index) => (
            <Pressable key={`${source}-${index}`} onPress={() => setImageIndex(index)} style={[styles.thumb, index === imageIndex ? styles.thumbOn : null]}>
              <SmartImage src={source} style={{ width: '100%', height: '100%' }} iconSize={14} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View>
        <Text style={styles.brand}>{product.brand_name || 'Generic'}</Text>
        <Text style={styles.detailName}>{product.name}</Text>
        <Text style={styles.meta}>
          {[product.category_name, product.subcategory_name].filter(Boolean).join(' › ')}
          {unitName ? ` · Sold by ${unitName}` : ''}
        </Text>
        {(product.variants || []).length ? (
          <View style={styles.variants}>
            {product.variants.map((variant) => <Text key={variant.id} style={styles.variant}>{variant.name}</Text>)}
          </View>
        ) : null}
      </View>
      {best
        ? <PriceTag price={best.price} discountPercentage={best.discount_percentage} unit={best.unit || unitName} large />
        : <Text style={styles.faintStrong}>Not currently offered by your suppliers.</Text>}

      {offers.length ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.eyebrow}>{`Sold by ${offers.length} supplier${offers.length === 1 ? '' : 's'}`}</Text>
          {offers.map((offer) => (
            <View key={offer.id} style={styles.offer}>
              <View style={{ flex: 1 }}>
                <View style={styles.inline}>
                  <Store size={13} color={COLORS.slate[400]} />
                  <Text style={styles.offerName} numberOfLines={1}>{offer.supplier_name}</Text>
                </View>
                <Text style={styles.meta}>
                  {[offer.size, offer.stock_status === 'OUT_OF_STOCK' ? 'Out of stock' : `${Number(offer.quantity || 0)} ${offer.unit || ''} in stock`].filter(Boolean).join(' · ')}
                </Text>
                {(offer.bulk_pricing || []).length ? (
                  <Text style={styles.bulk}>{offer.bulk_pricing.map((tier) => `${Number(tier.min_quantity)}+ @ ${tier.unit_price}`).join(' · ')}</Text>
                ) : null}
              </View>
              <PriceTag price={offer.price} discountPercentage={offer.discount_percentage} />
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.folds}>
        <Fold title="Product Highlights" open>
          {highlights.length ? highlights.map((line) => <Text key={line} style={styles.body}>{`• ${line}`}</Text>) : <NotAdded />}
        </Fold>
        <Fold title="Product Description">
          {product.description ? <Text style={styles.body}>{product.description}</Text> : <NotAdded />}
        </Fold>
        <Fold title="FAQs">
          {faqs.length ? faqs.map((faq) => (
            <View key={faq.question} style={{ marginBottom: 6 }}>
              <Text style={styles.offerName}>{faq.question}</Text>
              <Text style={styles.body}>{faq.answer}</Text>
            </View>
          )) : <NotAdded />}
        </Fold>
        <Fold title="Returns & Exchange Policy">
          {product.returns_exchange_policy ? <Text style={styles.body}>{product.returns_exchange_policy}</Text> : <NotAdded />}
        </Fold>
        {specifications.length ? (
          <Fold title="Specifications">
            {specifications.map(([key, value]) => (
              <View key={key} style={styles.specRow}>
                <Text style={[styles.meta, { flex: 2 }]}>{key}</Text>
                <Text style={[styles.offerName, { flex: 3 }]}>{String(value)}</Text>
              </View>
            ))}
          </Fold>
        ) : null}
      </View>

      {related.length ? (
        <View>
          <Text style={styles.sectionTitle}>You may also like</Text>
          <View style={styles.grid}>
            {related.map((item) => <ProductTile key={item.id} product={item} offer={relatedPrice(item)} onOpen={() => onOpenProduct(item.id)} />)}
          </View>
        </View>
      ) : null}
    </View>
  )
}

export default function EngineerProductCatalog({ projects }) {
  const projectKey = projects.map((project) => project.id).join(',')
  const [categories, setCategories] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [categoryProducts, setCategoryProducts] = useState([])
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [offers, setOffers] = useState([])
  const [offersLoaded, setOffersLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchSeq = useRef(0)

  // Fresh on every visit and whenever the engineer's projects change.
  useEffect(() => {
    let active = true
    setSelectedCategoryId(null); setCategoryProducts([]); setSelectedProductId(null); setSelectedProduct(null)
    setOffersLoaded(false); setError('')
    fetchCatalogCategories().then((rows) => { if (active) setCategories(Array.isArray(rows) ? rows : []) }).catch(() => { if (active) setError('The catalog could not be loaded.') })
    loadOffers(projects)
      .then((list) => { if (active) { setOffers(list); setOffersLoaded(true) } })
      .catch(() => { if (active) { setOffers([]); setOffersLoaded(true); setError('Your suppliers could not be loaded.') } })
    return () => { active = false }
  }, [projectKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedCategoryId) return undefined
    let active = true
    setLoading(true)
    fetchCatalogProducts({ categoryId: selectedCategoryId })
      .then((rows) => { if (active) setCategoryProducts(Array.isArray(rows) ? rows : []) })
      .catch(() => { if (active) { setCategoryProducts([]); setError('Those products could not be loaded.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selectedCategoryId])

  useEffect(() => {
    const text = query.trim()
    if (!text) { setSearchResults([]); setSearching(false); return undefined }
    const seq = searchSeq.current + 1
    searchSeq.current = seq
    const timer = setTimeout(() => {
      setSearching(true)
      searchCatalog(text, 20)
        .then((rows) => { if (seq === searchSeq.current) setSearchResults(Array.isArray(rows) ? rows : []) })
        .catch(() => { if (seq === searchSeq.current) setError('The search could not be completed.') })
        .finally(() => { if (seq === searchSeq.current) setSearching(false) })
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!selectedProductId) return undefined
    let active = true
    setSelectedProduct(null)
    fetchCatalogProduct(selectedProductId)
      .then((row) => { if (active) setSelectedProduct(row) })
      .catch(() => { if (active) setError('That product could not be opened.') })
    return () => { active = false }
  }, [selectedProductId])

  // master_product_id -> its offers, cheapest (after discount) first.
  const offersByProduct = useMemo(() => {
    const map = {}
    for (const offer of offers) (map[offer.master_product_id] ||= []).push(offer)
    for (const list of Object.values(map)) {
      list.sort((a, b) => discountedPrice(a.price, a.discount_percentage) - discountedPrice(b.price, b.discount_percentage))
    }
    return map
  }, [offers])
  const offered = (product) => Boolean(offersByProduct[product.id]?.length)
  const cheapest = (product) => bestOffer(offersByProduct[product.id] || [])
  const categoryList = categoryProducts.filter(offered)
  const searchList = searchResults.filter(offered)
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) || null
  const openProduct = (id) => { setQuery(''); setSelectedProductId(id) }

  if (selectedProductId) {
    const related = selectedProduct
      ? categoryProducts.concat(searchResults)
        .filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
        .filter((item) => item.id !== selectedProduct.id && offered(item))
        .filter((item) => item.subcategory_id === selectedProduct.subcategory_id || item.category_id === selectedProduct.category_id)
        .sort((a, b) => Number(b.subcategory_id === selectedProduct.subcategory_id) - Number(a.subcategory_id === selectedProduct.subcategory_id))
        .slice(0, 10)
      : []
    return (
      <View style={styles.panel}>
        <ProductDetail
          product={selectedProduct}
          offers={offersByProduct[selectedProductId] || []}
          related={related}
          relatedPrice={cheapest}
          onBack={() => { setSelectedProductId(null); setSelectedProduct(null) }}
          onOpenProduct={openProduct}
        />
      </View>
    )
  }

  return (
    <View style={styles.panel}>
      <View style={styles.search}>
        <Search size={16} color={COLORS.slate[400]} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search cement, UltraTech, ACC…" placeholderTextColor={COLORS.slate[400]} style={styles.searchInput} />
        {query ? <Pressable onPress={() => setQuery('')} hitSlop={8}><X size={15} color={COLORS.slate[500]} /></Pressable> : null}
      </View>
      {query.trim() ? (
        <View style={styles.results}>
          {searching ? <ActivityIndicator size="small" color={COLORS.brand[700]} style={{ margin: 10 }} /> : null}
          {!searching && !searchList.length ? <Text style={[styles.meta, { padding: 10 }]}>No matching products.</Text> : null}
          {searchList.map((product) => (
            <Pressable key={product.id} onPress={() => openProduct(product.id)} style={styles.result}>
              <SmartImage src={product.image_url} style={styles.resultImage} iconSize={16} />
              <View style={{ flex: 1 }}>
                <Text style={styles.offerName} numberOfLines={1}>{product.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>{[product.brand_name, product.category_name].filter(Boolean).join(' · ')}</Text>
              </View>
              {cheapest(product) ? <PriceTag price={cheapest(product).price} discountPercentage={cheapest(product).discount_percentage} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* The admin's categories, as circles with their pictures. */}
      {categories.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4 }}>
          {categories.map((category) => {
            const on = category.id === selectedCategoryId
            return (
              <Pressable key={category.id} onPress={() => { setSelectedCategoryId(Number(category.id)); setSelectedProductId(null) }} style={styles.circleItem}>
                <View style={[styles.circle, on ? styles.circleOn : null]}>
                  <SmartImage src={category.image_url} style={styles.circleImage} contentFit="cover" iconSize={18} />
                </View>
                <Text style={[styles.circleText, on ? styles.circleTextOn : null]} numberOfLines={2}>{category.name}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : null}

      {error ? <Text style={styles.amber}>{error}</Text> : null}

      {!selectedCategoryId ? (
        <View style={styles.hint}>
          <PackageSearch size={16} color={COLORS.slate[400]} />
          <Text style={[styles.meta, { flex: 1 }]}>Choose a category, or search, to see products.</Text>
        </View>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>
            {selectedCategory?.name}
            {offersLoaded && !loading ? <Text style={styles.faint}>{`  ${categoryList.length}`}</Text> : null}
          </Text>
          {loading || !offersLoaded ? (
            <Text style={styles.meta}>Loading…</Text>
          ) : !categoryList.length ? (
            <Text style={styles.hintText}>None of your suppliers sells a product in this category yet.</Text>
          ) : (
            <View style={styles.grid}>
              {categoryList.map((product) => <ProductTile key={product.id} product={product} offer={cheapest(product)} onOpen={() => openProduct(product.id)} />)}
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const styles = createStyles((c) => ({
  panel: { gap: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  search: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', color: c.text },
  results: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: c.borderSoft, padding: 8 },
  resultImage: { height: 40, width: 40, borderRadius: 8, backgroundColor: c.subtle },
  circleItem: { width: 72, alignItems: 'center', gap: 4 },
  circle: { height: 60, width: 60, overflow: 'hidden', borderRadius: 30, borderWidth: 2, borderColor: c.border },
  circleOn: { borderColor: '#236645' },
  circleImage: { height: '100%', width: '100%' },
  circleText: { textAlign: 'center', fontSize: 11, fontWeight: '700', color: c.textSoft },
  circleTextOn: { color: c.brandTextStrong },
  amber: { overflow: 'hidden', borderRadius: 8, backgroundColor: soft('#fffbeb', '#b45309'), paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, fontWeight: '700', color: ink('#b45309') },  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, backgroundColor: c.subtle, padding: 10 },
  hintText: { overflow: 'hidden', borderRadius: 8, backgroundColor: c.subtle, padding: 10, fontSize: 12, fontWeight: '600', color: c.textMuted },
  sectionTitle: { marginBottom: 8, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { width: '48.5%', overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  tileImage: { aspectRatio: 1, width: '100%', backgroundColor: c.subtle },
  offBadge: { position: 'absolute', left: 6, top: 6, overflow: 'hidden', borderRadius: 6, backgroundColor: '#fbbf24', paddingHorizontal: 6, paddingVertical: 2, fontSize: 9.5, fontWeight: '800', color: '#1f2937' },
  tileBody: { gap: 2, padding: 8 },
  brand: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.brandText },
  tileName: { fontSize: 12.5, fontWeight: '800', lineHeight: 16, color: c.text },
  meta: { fontSize: 11.5, fontWeight: '600', color: c.textMuted },
  faint: { fontSize: 12, fontWeight: '600', color: c.textFaint },
  faintStrong: { fontSize: 13, fontWeight: '700', color: c.textFaint },
  eyebrow: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 30 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  backLinkText: { fontSize: 12, fontWeight: '800', color: c.brandText },
  heroImage: { aspectRatio: 1, width: '100%', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: surface('#ffffff') },  thumb: { height: 54, width: 54, overflow: 'hidden', borderRadius: 8, borderWidth: 1, borderColor: c.border },
  thumbOn: { borderColor: '#236645', borderWidth: 2 },
  detailName: { marginTop: 4, fontFamily: 'Manrope_800ExtraBold', fontSize: 20, lineHeight: 26, color: c.text },
  variants: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  variant: { overflow: 'hidden', borderRadius: 6, borderWidth: 1, borderColor: c.border, paddingHorizontal: 8, paddingVertical: 2, fontSize: 11, fontWeight: '700', color: c.textSoft },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10 },
  offerName: { fontSize: 13, fontWeight: '800', color: c.text },
  bulk: { marginTop: 2, fontSize: 11, fontWeight: '700', color: ink('#0369a1') },
    folds: { borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12 },
  fold: { borderBottomWidth: 1, borderColor: c.borderSoft },
  foldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  foldTitle: { fontSize: 13.5, fontWeight: '800', color: c.text },
  foldSign: { fontSize: 18, fontWeight: '700', color: c.textMuted },
  foldBody: { paddingBottom: 12 },
  body: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: c.textSoft },
  specRow: { flexDirection: 'row', gap: 10, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 6 },
}))