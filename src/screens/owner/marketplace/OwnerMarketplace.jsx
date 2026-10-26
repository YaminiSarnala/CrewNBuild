// Port of the web components/shop/OwnerMarketplace.jsx (+ the parts of
// catalog/ProductDetailView.jsx it uses): a self-construction project's
// Suppliers tab, the materials marketplace for the project's location. No
// request first.
//
//   GET /suppliers/nearby?project_id=  the suppliers serving the project's
//     pincode with their PUBLISHED listings; every card is one supplier's
//     listing, so the same product from two suppliers is two cards.
//   GET /catalog/products/{id}  the product page (images, highlights,
//     description, FAQs, returns policy) plus every local listing of it.
//   The cart is the project's own (/cart/items against the listing id).
//
// The web's floating search panel becomes a search bar that filters the grid
// as you type, plus the category strip.
import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Image } from 'expo-image'
import { ArrowLeft, ChevronDown, ImageOff, MapPin, PackageSearch, Search, ShoppingCart, Store, X } from 'lucide-react-native'
import { fetchNearbySuppliers } from '../../../api/projects'
import { fetchCatalogCategories, fetchCatalogProduct } from '../../../api/catalog'
import { imageSource } from '../../../api/client'
import { loadCart, selectCartCount } from '../../../store/cartSlice'
import { formatMoney } from '../../../utils/countryConfig'
import { useResponsive } from '../../../hooks/useResponsive'
import { COLORS } from '../../../theme/tokens'
import { BulkPricingList, CartStepper, ServiceBadges, StockBadge, discountedPrice } from './shopParts'
import { createStyles } from '../../../theme/createStyles'

const selling = (listing) => discountedPrice(listing.price, listing.discount_percentage)

// Every typed word must appear in the listing's name, brand, category,
// subcategory, size or supplier store name.
const matchesListing = (row, query) => {
  const words = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const text = [row.name, row.brand, row.category_name, row.category, row.subcategory_name, row.size, row.supplier_name].join(' ').toLowerCase()
  return words.every((word) => text.includes(word))
}

function CardImage({ src, height }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  if (!src || broken) {
    return (
      <View style={[styles.view, { height }]}>
        <ImageOff size={22} color={COLORS.slate[300]} />
        <Text style={[styles.text, { fontSize: 10 }]}>No image yet</Text>
      </View>
    )
  }
  return (
    <Image
      source={imageSource(src)}
      style={{ width: '100%', height }}
      contentFit="contain"
      onError={() => setBroken(true)}
    />
  )
}

function ListingCard({ listing, country, projectId, width, onOpen, onMessage }) {
  const discount = Number(listing.discount_percentage || 0)
  return (
    <View style={[styles.view2, { width }]}>
      <Pressable onPress={onOpen} accessibilityLabel={`View ${listing.name} from ${listing.supplier_name}`} style={styles.pressable}>
        <CardImage src={listing.image_url} height={104} />
        {discount > 0 ? (
          <View style={styles.view3}>
            <Text style={[styles.text2, { fontSize: 10, color: '#1f2937' }]}>{`${Number(discount.toFixed(2))}% OFF`}</Text>
          </View>
        ) : null}
      </Pressable>
      <Text style={[styles.text3, { fontSize: 10 }]} numberOfLines={1}>{listing.brand || 'Generic'}</Text>
      <Pressable onPress={onOpen}>
        <Text style={[styles.text2, { fontSize: 13, lineHeight: 17 }]} numberOfLines={2}>{listing.name}</Text>
      </Pressable>
      <Text style={[styles.text4, { fontSize: 11 }]} numberOfLines={1}>
        {[listing.subcategory_name, listing.size].filter(Boolean).join(' · ') || ' '}
      </Text>
      <ServiceBadges style={{ marginTop: 4 }} />
      <View style={[styles.view4, { gap: 4 }]}>
        <Store size={11} color={COLORS.slate[400]} />
        <Text style={[styles.text5, { fontSize: 11 }]} numberOfLines={1}>{`Sold by ${listing.supplier_name}`}</Text>
      </View>
      <Text style={[styles.text6, { fontSize: 15 }]}>
        {formatMoney(selling(listing), country)}
        {listing.unit ? <Text style={[styles.text7, { fontSize: 11 }]}>{` / ${listing.unit}`}</Text> : null}
      </Text>
      {discount > 0 ? (
        <View style={[styles.view5, { gap: 5 }]}>
          <Text style={[styles.text8, { fontSize: 11 }]}>{formatMoney(listing.price, country)}</Text>
          <Text style={[styles.text9, { fontSize: 11 }]}>{`${Number(discount.toFixed(2))}% OFF`}</Text>
        </View>
      ) : null}
      <BulkPricingList tiers={listing.bulk_pricing} country={country} compact style={{ marginTop: 4 }} />
      <StockBadge quantity={listing.quantity} threshold={listing.low_stock_threshold} style={{ marginTop: 4 }} />
      <View style={styles.view6}>
        <CartStepper offer={listing} projectId={projectId} onMessage={onMessage} size="sm" full />
      </View>
    </View>
  )
}

function Section({ title, open: initiallyOpen = false, children }) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <View style={styles.view7}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.pressable2}>
        <Text style={[styles.text2, { fontSize: 13.5 }]}>{title}</Text>
        <ChevronDown size={16} color={COLORS.slate[400]} style={open ? { transform: [{ rotate: '180deg' }] } : null} />
      </Pressable>
      {open ? <View style={styles.view6}>{children}</View> : null}
    </View>
  )
}

const NotAdded = () => <Text style={[styles.text7, { fontSize: 12 }]}>Not added yet.</Text>

function bestOffer(offers = []) {
  return offers.reduce(
    (best, offer) => (!best || discountedPrice(offer.price, offer.discount_percentage) < discountedPrice(best.price, best.discount_percentage) ? offer : best),
    null,
  )
}

function ProductPage({ product, offers, country, projectId, onBack, onMessage, message }) {
  const { width } = useResponsive()
  const [imageIndex, setImageIndex] = useState(0)
  if (!product) {
    return (
      <View style={[styles.view8, { gap: 8 }]}>
        <ActivityIndicator color={COLORS.brand[700]} />
        <Text style={[styles.text7, { fontSize: 13 }]}>Loading product…</Text>
      </View>
    )
  }
  const best = bestOffer(offers)
  const unitName = product.unit?.name || product.unit_code || ''
  const images = (product.images || []).map((image) => (typeof image === 'string' ? image : image?.url || image?.image_url)).filter(Boolean)
  const shown = images[imageIndex] || images[0]
  const highlights = product.highlights || []
  const faqs = product.faqs || []

  return (
    <View>
      <Pressable onPress={onBack} style={[styles.pressable3, { gap: 5 }]}>
        <ArrowLeft size={14} color={COLORS.brand[700]} />
        <Text style={[styles.text9, { fontSize: 12.5 }]}>Back to products</Text>
      </Pressable>

      <View style={styles.view9}>
        <CardImage src={shown} height={Math.min(width - 80, 320)} />
      </View>
      {images.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.view6} contentContainerStyle={{ gap: 6 }}>
          {images.map((image, index) => (
            <Pressable
              key={`${image}-${index}`}
              onPress={() => setImageIndex(index)}
              style={[styles.pressable4, index === imageIndex ? styles.pressable5 : styles.pressable6]}
            >
              <Image source={imageSource(image)} style={{ width: 52, height: 52 }} contentFit="contain" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ServiceBadges size="md" style={{ marginTop: 14 }} />
      <View style={[styles.view10, { gap: 6 }]}>
        {product.brand_logo_url ? (
          <Image source={imageSource(product.brand_logo_url)} style={{ width: 26, height: 26, borderRadius: 6 }} contentFit="contain" />
        ) : null}
        <Text style={[styles.text10, { fontSize: 11 }]}>{product.brand_name || 'Generic'}</Text>
      </View>
      <Text style={[styles.text11, { fontSize: 20, lineHeight: 25 }]}>{product.name}</Text>
      <Text style={[styles.text, { fontSize: 11.5 }]}>
        {[product.category_name, product.subcategory_name].filter(Boolean).join(' › ')}
        {unitName ? ` · Sold by ${unitName}` : ''}
      </Text>
      {(product.variants || []).length ? (
        <View style={[styles.view11, { gap: 5 }]}>
          {product.variants.map((variant) => (
            <View key={variant.id} style={styles.view12}>
              <Text style={[styles.text12, { fontSize: 11 }]}>{variant.name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.scrollView}>
        {best ? (
          <>
            <Text style={[styles.text13, { fontSize: 22 }]}>
              {formatMoney(discountedPrice(best.price, best.discount_percentage), country)}
              {best.unit || unitName ? <Text style={[styles.text7, { fontSize: 13 }]}>{` / ${best.unit || unitName}`}</Text> : null}
            </Text>
            {Number(best.discount_percentage || 0) > 0 ? (
              <Text style={[styles.text8, { fontSize: 12 }]}>{formatMoney(best.price, country)}</Text>
            ) : null}
            <BulkPricingList tiers={best.bulk_pricing} unit={best.unit || unitName} country={country} style={{ marginTop: 8 }} />
          </>
        ) : (
          <Text style={[styles.text14, { fontSize: 13 }]}>Not currently offered by your suppliers.</Text>
        )}
      </View>

      {offers.length ? (
        <View style={[styles.view13, { gap: 8 }]}>
          <Text style={[styles.text15, { fontSize: 10 }]}>
            {`Sold by ${offers.length} supplier${offers.length === 1 ? '' : 's'}`}
          </Text>
          {offers.map((offer) => (
            <View key={offer.id} style={styles.view14}>
              <View style={[styles.view15, { gap: 5 }]}>
                <Store size={13} color={COLORS.slate[400]} />
                <Text style={[styles.text16, { fontSize: 13.5 }]}>{offer.supplier_name}</Text>
                <Text style={[styles.text2, { fontSize: 13.5 }]}>
                  {formatMoney(discountedPrice(offer.price, offer.discount_percentage), country)}
                </Text>
              </View>
              <Text style={[styles.text17, { fontSize: 11 }]}>
                {[offer.size, offer.stock_status === 'OUT_OF_STOCK' ? 'Out of stock' : `${Number(offer.quantity || 0)} ${offer.unit || ''} in stock`].filter(Boolean).join(' · ')}
              </Text>
              <BulkPricingList tiers={offer.bulk_pricing} unit={offer.unit} country={country} compact style={{ marginTop: 2 }} />
              <View style={styles.view6}>
                <CartStepper offer={offer} projectId={projectId} onMessage={onMessage} size="sm" />
              </View>
            </View>
          ))}
          {message ? (
            <Text style={[styles.text18, { fontSize: 12 }]}>{message}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.view16}>
        <Section title="Product Highlights" open>
          {highlights.length ? highlights.map((line) => (
            <Text key={line} style={[styles.text19, { fontSize: 13, lineHeight: 19 }]}>{`• ${line}`}</Text>
          )) : <NotAdded />}
        </Section>
        <Section title="Product Description">
          {product.description ? <Text style={[styles.text19, { fontSize: 13, lineHeight: 19 }]}>{product.description}</Text> : <NotAdded />}
        </Section>
        <Section title="FAQs">
          {faqs.length ? faqs.map((faq) => (
            <View key={faq.question} style={styles.view17}>
              <Text style={[styles.text2, { fontSize: 13 }]}>{faq.question}</Text>
              <Text style={[styles.text20, { fontSize: 13, lineHeight: 19 }]}>{faq.answer}</Text>
            </View>
          )) : <NotAdded />}
        </Section>
        <View style={{ marginBottom: -1 }}>
          <Section title="Returns & Exchange Policy">
            {product.returns_exchange_policy ? (
              <Text style={[styles.text19, { fontSize: 13, lineHeight: 19 }]}>{product.returns_exchange_policy}</Text>
            ) : <NotAdded />}
          </Section>
        </View>
      </View>
    </View>
  )
}

export default function OwnerMarketplace({ projectId, pincode, country = 'India', onOpenCart }) {
  const dispatch = useDispatch()
  const { columns, isLargeTablet } = useResponsive()
  const cartCount = useSelector(selectCartCount)
  const [listings, setListings] = useState([])
  const [supplierCount, setSupplierCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState([])
  const [openListing, setOpenListing] = useState(null)
  const [product, setProduct] = useState(null)

  // The catalog's categories, for the strip.
  useEffect(() => {
    let live = true
    fetchCatalogCategories().then((rows) => live && setCategories(rows || [])).catch(() => live && setCategories([]))
    return () => { live = false }
  }, [])

  // The project's marketplace: local suppliers and their published listings.
  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    fetchNearbySuppliers(pincode, country, projectId)
      .then((suppliers) => {
        if (!live) return
        const rows = []
        for (const supplier of suppliers || []) {
          for (const listing of supplier.products || []) {
            if (listing.master_product_id == null || listing.is_published === false) continue
            rows.push({ ...listing, supplier_id: supplier.user_id, supplier_name: supplier.store_name || supplier.name })
          }
        }
        setListings(rows)
        setSupplierCount((suppliers || []).length)
      })
      .catch((failure) => live && setError(failure?.response?.data?.detail || 'The suppliers for this project could not be loaded.'))
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [projectId, pincode, country])

  // The cart the Add to Cart controls read: this project's.
  useEffect(() => {
    if (projectId) dispatch(loadCart(projectId))
  }, [projectId, dispatch])

  useEffect(() => {
    if (!openListing) {
      setProduct(null)
      return undefined
    }
    let live = true
    setProduct(null)
    fetchCatalogProduct(openListing.master_product_id).then((row) => live && setProduct(row)).catch(() => live && setProduct(null))
    return () => { live = false }
  }, [openListing])

  const visible = useMemo(
    () => listings.filter((row) => (!categoryId || String(row.category_id) === String(categoryId)) && matchesListing(row, search)),
    [listings, search, categoryId],
  )
  const categoryName = categories.find((row) => String(row.id) === String(categoryId))?.name
    || listings.find((row) => String(row.category_id) === String(categoryId))?.category_name

  // "You may also like": other local listings, same subcategory > category > brand, at most 4.
  const relatedFor = (listing) => {
    const same = (field) => (row) => listing[field] != null && listing[field] !== '' && String(row[field]) === String(listing[field])
    const rules = [same('subcategory_id'), same('category_id'), same('brand')]
    return listings
      .filter((row) => row.master_product_id !== listing.master_product_id)
      .map((row) => ({ row, rank: rules.findIndex((rule) => rule(row)) }))
      .filter(({ rank }) => rank >= 0)
      .sort((x, y) => x.rank - y.rank)
      .slice(0, 4)
      .map(({ row }) => row)
  }

  // Two cards a row on a phone, more on a tablet.
  const perRow = isLargeTablet ? 4 : columns > 1 ? 3 : 2
  const cardWidth = `${(100 - (perRow - 1) * 2.5) / perRow}%`

  const header = (
    <View style={[styles.view18, { gap: 10 }]}>
      <View style={[styles.view19, { minWidth: 170 }]}>
        <Text style={[styles.text13, { fontSize: 17 }]}>Suppliers / Materials</Text>
        <View style={[styles.view20, { gap: 3 }]}>
          <Text style={[styles.text21, { fontSize: 11.5 }]}>Project delivery location:</Text>
          <MapPin size={12} color={COLORS.brand[700]} />
          <Text style={[styles.text2, { fontSize: 11.5 }]}>{pincode || '—'}</Text>
        </View>
      </View>
      <Pressable
        onPress={onOpenCart}
        accessibilityRole="button"
        style={[styles.pressable7, { gap: 6 }]}
      >
        <ShoppingCart size={16} color={COLORS.brand[800]} />
        <Text style={[styles.text22, { fontSize: 13 }]}>Cart</Text>
        {cartCount > 0 ? (
          <View style={styles.view21}>
            <Text style={[styles.text2, { fontSize: 11, color: '#1f2937' }]}>{cartCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  )

  if (openListing) {
    const related = relatedFor(openListing)
    const offers = listings
      .filter((row) => row.master_product_id === openListing.master_product_id)
      .sort((a, b) => Number(b.id === openListing.id) - Number(a.id === openListing.id))
    return (
      <View style={styles.view22}>
        {header}
        <ProductPage
          product={product}
          offers={offers}
          country={country}
          projectId={projectId}
          onBack={() => setOpenListing(null)}
          onMessage={setMessage}
          message={message}
        />
        {related.length ? (
          <View style={styles.view23}>
            <Text style={[styles.text23, { fontSize: 15 }]}>You may also like</Text>
            <View style={styles.view24}>
              {related.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  country={country}
                  projectId={projectId}
                  width={cardWidth}
                  onOpen={() => { setMessage(''); setOpenListing(listing) }}
                  onMessage={setMessage}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.view22}>
      {header}

      <View style={[styles.view25, { gap: 8 }]}>
        <Search size={16} color={COLORS.graphite} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products, brands or materials..."
          placeholderTextColor={COLORS.slate[400]}
          accessibilityLabel="Search products, brands or materials"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.textInput, { fontSize: 14 }]}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} accessibilityLabel="Clear search" hitSlop={8}>
            <X size={16} color={COLORS.slate[400]} />
          </Pressable>
        ) : null}
      </View>

      {categories.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={{ gap: 6 }}>
          {[{ id: '', name: 'All' }, ...categories].map((category) => {
            const active = String(categoryId) === String(category.id)
            return (
              <Pressable
                key={String(category.id) || 'all'}
                onPress={() => setCategoryId(String(category.id))}
                style={[styles.pressable8, active ? styles.pressable9 : styles.pressable10, { gap: 6 }]}
              >
                {category.image_url ? (
                  <Image source={imageSource(category.image_url)} style={{ width: 20, height: 20, borderRadius: 10 }} contentFit="cover" />
                ) : null}
                <Text style={[styles.text24, active ? styles.text25 : styles.text26, { fontSize: 12 }]}>{category.name}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : null}

      {message ? (
        <Text style={[styles.text27, { fontSize: 12 }]}>{message}</Text>
      ) : null}
      {error ? (
        <Text style={[styles.text28, { fontSize: 12 }]}>{error}</Text>
      ) : null}

      {loading ? (
        <View style={[styles.view8, { gap: 8 }]}>
          <ActivityIndicator color={COLORS.brand[700]} />
          <Text style={[styles.text7, { fontSize: 13 }]}>{`Loading suppliers near ${pincode || ''}…`}</Text>
        </View>
      ) : listings.length === 0 ? (
        <View style={styles.view26}>
          <PackageSearch size={30} color={COLORS.slate[300]} />
          <Text style={[styles.text29, { fontSize: 13.5 }]}>
            {`No supplier products for ${pincode || 'this location'} yet`}
          </Text>
          <Text style={[styles.text30, { fontSize: 12 }]}>
            Products appear here as soon as a supplier serving this location publishes them.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.text31, { fontSize: 12 }]}>
            {search.trim() || categoryId
              ? `${visible.length} of ${listings.length} products match${search.trim() ? ` “${search.trim()}”` : ''}${categoryName ? ` in ${categoryName}` : ''}`
              : `${listings.length} product${listings.length === 1 ? '' : 's'} from ${supplierCount} supplier${supplierCount === 1 ? '' : 's'} serving ${pincode}`}
          </Text>
          {visible.length === 0 ? (
            <View style={styles.view27}>
              <Text style={[styles.text32, { fontSize: 13.5 }]}>{`No products from suppliers serving ${pincode} match`}</Text>
              <Pressable onPress={() => { setSearch(''); setCategoryId('') }} style={styles.pressable11}>
                <Text style={[styles.text22, { fontSize: 12 }]}>Show all products</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.view24}>
              {visible.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  country={country}
                  projectId={projectId}
                  width={cardWidth}
                  onOpen={() => { setMessage(''); setOpenListing(listing) }}
                  onMessage={setMessage}
                />
              ))}
            </View>
          )}
        </>
      )}
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { alignItems: 'center', justifyContent: 'center' },
  text: { marginTop: 3.5, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  view2: { marginBottom: 10.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 8.75 },
  pressable: { overflow: 'hidden', borderRadius: 7, backgroundColor: c.subtle, padding: 7 },
  view3: { position: 'absolute', left: 5.25, top: 5.25, borderRadius: 3.5, backgroundColor: '#fcd34d', paddingHorizontal: 5.25, paddingVertical: 1.75 },
  text2: { fontFamily: 'Inter_700Bold', color: c.text },
  text3: { marginTop: 7, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.brandText },
  text4: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  view4: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center' },
  text5: { flex: 1, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  text6: { marginTop: 3.5, fontFamily: 'Inter_700Bold', color: c.text },
  text7: { fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  view5: { flexDirection: 'row', alignItems: 'baseline' },
  text8: { fontFamily: 'Inter_600SemiBold', color: c.textFaint, textDecorationLine: 'line-through' },
  text9: { fontFamily: 'Inter_700Bold', color: c.brandText },
  view6: { marginTop: 7 },
  view7: { borderBottomWidth: 1, borderColor: c.border, paddingVertical: 10.5 },
  pressable2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  view8: { flexDirection: 'row', alignItems: 'center', paddingVertical: 35 },
  pressable3: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  view9: { overflow: 'hidden', borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 10.5 },
  pressable4: { overflow: 'hidden', borderRadius: 7, borderWidth: 1, backgroundColor: c.card, padding: 3.5 },
  pressable5: { borderColor: '#236645' },
  pressable6: { borderColor: c.border },
  view10: { marginTop: 10.5, flexDirection: 'row', alignItems: 'center' },
  text10: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.brandText },
  text11: { marginTop: 3.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view11: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap' },
  view12: { borderRadius: 5.25, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 7, paddingVertical: 1.75 },
  text12: { fontFamily: 'Inter_700Bold', color: c.textSecondary },
  scrollView: { marginTop: 10.5 },
  text13: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  text14: { fontFamily: 'Inter_700Bold', color: c.textFaint },
  view13: { marginTop: 14 },
  text15: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.textFaint },
  view14: { borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  view15: { flexDirection: 'row', alignItems: 'center' },
  text16: { flex: 1, fontFamily: 'Inter_700Bold', color: c.text },
  text17: { marginTop: 1.75, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  text18: { borderRadius: 7, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  view16: { marginTop: 14, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12.25 },
  text19: { fontFamily: 'Inter_400Regular', color: c.textSecondary },
  view17: { marginBottom: 7 },
  text20: { marginTop: 1.75, fontFamily: 'Inter_400Regular', color: c.textSecondary },
  view18: { marginBottom: 10.5, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  view19: { flex: 1 },
  view20: { marginTop: 1.75, flexDirection: 'row', alignItems: 'center' },
  text21: { fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  pressable7: { height: 35, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft, paddingHorizontal: 12.25 },
  text22: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  view21: { height: 17.5, minWidth: 17.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#fcd34d', paddingHorizontal: 3.5 },
  view22: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12.25 },
  view23: { marginTop: 14, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 14 },
  text23: { marginBottom: 10.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view24: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  view25: { height: 38.5, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, borderWidth: 2, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5 },
  textInput: { flex: 1, fontFamily: 'Inter_600SemiBold', color: c.text },
  pressable8: { height: 31.5, flexDirection: 'row', alignItems: 'center', borderRadius: 9999, paddingHorizontal: 12.25 },
  pressable9: { backgroundColor: '#1a5038' },
  pressable10: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  text24: { fontFamily: 'Inter_700Bold' },
  text25: { color: '#ffffff' },
  text26: { color: c.textSecondary },
  text27: { marginTop: 10.5, borderRadius: 7, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 7, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  text28: { marginTop: 10.5, borderRadius: 7, backgroundColor: c.amberSoft, paddingHorizontal: 10.5, paddingVertical: 7, fontFamily: 'Inter_700Bold', color: c.amberText },
  view26: { marginTop: 10.5, alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, paddingHorizontal: 21, paddingVertical: 35 },
  text29: { marginTop: 7, textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.text },
  text30: { marginTop: 3.5, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textMuted },
  text31: { marginBottom: 7, marginTop: 10.5, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  view27: { alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, paddingHorizontal: 21, paddingVertical: 28 },
  text32: { textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.text },
  pressable11: { marginTop: 3.5 },
}))
