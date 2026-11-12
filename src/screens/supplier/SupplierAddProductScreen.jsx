// Adding a product from the Master Catalog: port of web
// pages/supplier/supplierCatalogPicker.jsx.
//
// One screen per level -- Category > Subcategory > Brand > Product > Variant --
// by tapping picture tiles, and only then the commercial form: selling price,
// stock, low-stock threshold, discount, published, and optional bulk pricing.
// What a product IS (name, description, specifications, images) belongs to the
// master catalog and is never typed here.
//
// Every tile is a query (GET /catalog/...), never a hard-coded list. Back (the
// header arrow or the phone's back) returns one step before it leaves.
import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Check, ChevronRight, PackageSearch, Search, X } from 'lucide-react-native'
import { Notice, Section, StackScreenShell } from '../../components/builder/BuilderUi'
import { PrimaryButton } from '../../components/ui'
import {
  addSupplierCatalogListing, fetchCatalogBrands, fetchCatalogCategories, fetchCatalogProducts, fetchCatalogSubcategories, searchCatalog,
} from '../../api/catalog'
import { saveBulkPricing } from '../../api/supplierProducts'
import { selectSupplierProducts, setStoreNotice, upsertSupplierProduct } from '../../store/supplierCatalogSlice'
import { useResponsive } from '../../hooks/useResponsive'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import {
  BrandLogo, BulkTierBuilder, CircleImage, NumberField, ProductImage, PublishSwitch, blankSimpleTier, currencySymbol,
  discountText, money, simpleTierProblem, simpleTiersForApi, useSupplierCountry, validDiscount,
} from './products/productParts'
import { discountedPrice } from '../owner/marketplace/shopParts'

// The Brand option for products that belong to no brand (brand_id NULL).
const GENERIC_BRAND = 'generic'

const STEPS = [
  { key: 'category', label: 'Category' },
  { key: 'subcategory', label: 'Subcategory' },
  { key: 'brand', label: 'Brand' },
  { key: 'product', label: 'Product' },
  { key: 'variant', label: 'Variant' },
  { key: 'selling', label: 'Selling' },
]
const stepIndex = (key) => STEPS.findIndex((step) => step.key === key)

/** A listing key for "is this product / variant already in my catalog?". */
const listedKey = (variantId) => (variantId == null || variantId === '' ? 'none' : String(variantId))

const EMPTY_FORM = { price: '', quantity: '', lowStockThreshold: '', discountPercentage: '', isPublished: true }

function EmptyNote({ children }) {
  return (
    <View style={styles.emptyNote}>
      <PackageSearch size={20} color={COLORS.slate[300]} />
      <Text style={styles.emptyNoteText}>{children}</Text>
    </View>
  )
}

function LoadingNote() {
  return (
    <View style={styles.loadingNote}>
      <ActivityIndicator size="small" color={COLORS.brand[700]} />
      <Text style={styles.emptyNoteText}>Loading…</Text>
    </View>
  )
}

/** A catalog choice: a circular picture and its name. */
function CircleTile({ name, selected, onPress, width, children }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.tile, { width }]}>
      <View style={[styles.tileRing, selected ? styles.tileRingOn : null]}>{children}</View>
      <Text style={[styles.tileName, selected ? styles.tileNameOn : null]} numberOfLines={3}>{name}</Text>
    </Pressable>
  )
}

/** ← the path chosen so far, and what this screen asks for. */
function ScreenTitle({ path = [], title, hint }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {path.length ? <Text style={styles.path} numberOfLines={2}>{path.join('  /  ')}</Text> : null}
      <Text style={styles.screenTitle}>{title}</Text>
      {hint ? <Text style={styles.screenHint}>{hint}</Text> : null}
    </View>
  )
}

export default function SupplierAddProductScreen({ navigation }) {
  const dispatch = useDispatch()
  const country = useSupplierCountry()
  const { width, maxContentWidth, gutter, isTablet } = useResponsive()
  // This supplier's own listings: which categories they already sell in, and
  // which products / variants are already in their catalog.
  const ownListings = useSelector(selectSupplierProducts)

  const [step, setStep] = useState('category')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  // The chosen product's catalog row, kept whole so a product picked from the
  // search keeps its details while its subcategory's list is still loading.
  const [pickedProduct, setPickedProduct] = useState(null)

  // The tile lists. Each remembers the parent it was loaded for, so an answer
  // still showing for the previous choice can never be picked.
  const [categories, setCategories] = useState({ loaded: false, rows: [] })
  const [subcategories, setSubcategories] = useState({ parent: '', loading: false, rows: [] })
  const [brands, setBrands] = useState({ parent: '', rows: [] })
  const [catalogProducts, setCatalogProducts] = useState({ parent: '', loading: false, rows: [] })

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)
  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }))
  const [bulkEnabled, setBulkEnabled] = useState(false)
  const [bulkTiers, setBulkTiers] = useState([blankSimpleTier()])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const scrollRef = useRef(null)
  const leaving = useRef(false)

  // ---- What this supplier already sells
  const listedCategoryIds = new Set()
  const listedVariants = new Map()
  for (const listing of ownListings || []) {
    if (listing.category_id != null) listedCategoryIds.add(String(listing.category_id))
    if (listing.master_product_id == null) continue
    const key = String(listing.master_product_id)
    if (!listedVariants.has(key)) listedVariants.set(key, new Set())
    listedVariants.get(key).add(listedKey(listing.master_variant_id))
  }
  const isListed = (productKey, variantKey) => Boolean(listedVariants.get(String(productKey))?.has(listedKey(variantKey)))
  const isFullyListed = (row) => {
    const rowVariants = row.variants || []
    return rowVariants.length ? rowVariants.every((item) => isListed(row.id, item.id)) : isListed(row.id, null)
  }

  // ---- The lists for the current choices
  const categoryRows = categories.rows
  const yourCategories = categoryRows.filter((row) => listedCategoryIds.has(String(row.id)))
  const otherCategories = categoryRows.filter((row) => !listedCategoryIds.has(String(row.id)))
  const category = categoryRows.find((row) => String(row.id) === String(categoryId)) || null
  const subcategoryRows = subcategories.parent === categoryId
    ? subcategories.rows.filter((row) => String(row.category_id ?? categoryId) === String(categoryId))
    : []
  const subcategory = subcategoryRows.find((row) => String(row.id) === String(subcategoryId)) || null
  const productsHere = catalogProducts.parent === subcategoryId
    ? catalogProducts.rows.filter((row) => String(row.subcategory_id ?? subcategoryId) === String(subcategoryId))
    : []
  // Brands the subcategory's products actually use, in the catalog's brand order.
  const brandOrder = new Map((brands.parent === subcategoryId ? brands.rows : []).map((row, index) => [String(row.id), index]))
  const brandRows = [...new Map(
    productsHere
      .filter((row) => row.brand_id != null)
      .map((row) => [String(row.brand_id), { id: String(row.brand_id), name: row.brand_name, logo_url: row.brand_logo_url }]),
  ).values()].sort((a, b) => (brandOrder.get(a.id) ?? Infinity) - (brandOrder.get(b.id) ?? Infinity) || String(a.name).localeCompare(String(b.name)))
  const hasGenericProducts = productsHere.some((row) => row.brand_id == null)
  const brandName = brandId === GENERIC_BRAND
    ? 'Generic'
    : brandRows.find((row) => row.id === String(brandId))?.name || pickedProduct?.brand_name || ''

  const products = productsHere.filter((row) => {
    if (!brandId) return true
    if (brandId === GENERIC_BRAND) return row.brand_id == null
    return String(row.brand_id) === String(brandId)
  })
  const product = products.find((row) => String(row.id) === String(productId))
    || (pickedProduct && String(pickedProduct.id) === String(productId) ? pickedProduct : null)
  const variants = product?.variants || []
  const variant = variants.find((row) => String(row.id) === String(variantId)) || null
  const unitRecord = variant?.unit || product?.unit || null
  const unit = unitRecord?.name || variant?.unit_code || product?.unit_code || ''
  const unitPlural = unitRecord?.plural_name || unit
  const productChosen = Boolean(product && (variants.length === 0 || variant))
  const alreadyListed = productChosen && isListed(product.id, variant ? variant.id : null)

  useEffect(() => {
    let live = true
    fetchCatalogCategories()
      .then((rows) => live && setCategories({ loaded: true, rows: rows || [] }))
      .catch((error) => {
        if (!live) return
        setCategories({ loaded: true, rows: [] })
        setMessage({ tone: 'error', text: error?.response?.data?.detail || 'The product catalog could not be loaded.' })
      })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!categoryId) return undefined
    let live = true
    setSubcategories((current) => ({ parent: categoryId, loading: true, rows: current.parent === categoryId ? current.rows : [] }))
    fetchCatalogSubcategories(categoryId)
      .then((rows) => live && setSubcategories({ parent: categoryId, loading: false, rows: rows || [] }))
      .catch(() => live && setSubcategories({ parent: categoryId, loading: false, rows: [] }))
    return () => { live = false }
  }, [categoryId])

  // Brands and products load together once a subcategory is chosen; the brand
  // then narrows the products, "Generic (no brand)" included.
  useEffect(() => {
    if (!subcategoryId) return undefined
    let live = true
    setCatalogProducts((current) => ({ parent: subcategoryId, loading: true, rows: current.parent === subcategoryId ? current.rows : [] }))
    fetchCatalogBrands({ subcategoryId })
      .then((rows) => live && setBrands({ parent: subcategoryId, rows: rows || [] }))
      .catch(() => live && setBrands({ parent: subcategoryId, rows: [] }))
    fetchCatalogProducts({ subcategoryId })
      .then((rows) => live && setCatalogProducts({ parent: subcategoryId, loading: false, rows: rows || [] }))
      .catch(() => live && setCatalogProducts({ parent: subcategoryId, loading: false, rows: [] }))
    return () => { live = false }
  }, [subcategoryId])

  // Search as the supplier types, a moment after they stop. Only the latest answer is shown.
  useEffect(() => {
    const words = query.trim()
    if (!words) {
      setSearchResults([])
      setSearching(false)
      return undefined
    }
    let live = true
    setSearching(true)
    const timer = setTimeout(() => {
      searchCatalog(words, 12)
        .then((rows) => live && setSearchResults(rows || []))
        .catch(() => live && setSearchResults([]))
        .finally(() => live && setSearching(false))
    }, 300)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query])

  // A new screen starts at its top.
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false })
  }, [step])

  // ---- Choosing. A different item clears the levels below it; the same one
  // again (after Back) keeps them.
  const chooseCategory = (value) => {
    if (String(value) !== String(categoryId)) {
      setCategoryId(String(value))
      setSubcategoryId('')
      setBrandId('')
      setProductId('')
      setVariantId('')
      setPickedProduct(null)
    }
    setMessage(null)
    setStep('subcategory')
  }
  const chooseSubcategory = (value) => {
    if (String(value) !== String(subcategoryId)) {
      setSubcategoryId(String(value))
      setBrandId('')
      setProductId('')
      setVariantId('')
      setPickedProduct(null)
    }
    setStep('brand')
  }
  const chooseBrand = (value) => {
    if (String(value) !== String(brandId)) {
      setBrandId(String(value))
      setProductId('')
      setVariantId('')
      setPickedProduct(null)
    }
    setStep('product')
  }
  // A product sold in one form needs no variant choice; one with several does.
  const chooseProduct = (row, preferredVariantId = null) => {
    const rowVariants = row.variants || []
    const sameProduct = String(row.id) === String(productId)
    setProductId(String(row.id))
    setPickedProduct(row)
    if (rowVariants.length <= 1) {
      setVariantId(rowVariants.length === 1 ? String(rowVariants[0].id) : '')
      setStep('selling')
      return
    }
    const preferred = rowVariants.find((item) => String(item.id) === String(preferredVariantId))
    if (preferred) setVariantId(String(preferred.id))
    else if (!sameProduct) setVariantId('')
    setStep('variant')
  }
  const chooseVariant = (value) => {
    setVariantId(String(value))
    setStep('selling')
  }
  // A search result carries its category, subcategory and brand ids, so
  // choosing it fills every level at once.
  const chooseSearchResult = (row) => {
    if (row.category_id == null || row.subcategory_id == null) return
    setCategoryId(String(row.category_id))
    setSubcategoryId(String(row.subcategory_id))
    setBrandId(row.brand_id == null ? GENERIC_BRAND : String(row.brand_id))
    setQuery('')
    setMessage(null)
    chooseProduct(row, row.matched_variant?.id)
  }

  // Back: to the previous screen, skipping a variant screen the product never needed.
  const hasVariantScreen = variants.length > 1
  const stepBack = () => {
    if (step === 'selling') setStep(hasVariantScreen ? 'variant' : 'product')
    else setStep(STEPS[Math.max(0, stepIndex(step) - 1)].key)
  }
  const canOpen = (key) => key !== 'variant' || hasVariantScreen

  // The header arrow and the phone's back step back first, then leave.
  const stepRef = useRef(null)
  stepRef.current = { step, stepBack }
  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (leaving.current || stepRef.current.step === 'category') return
    event.preventDefault()
    stepRef.current.stepBack()
  }), [navigation])

  // ---- Selling information
  const stockNumbers = [form.quantity, form.lowStockThreshold].map((value) => (String(value).trim() === '' ? NaN : Number(value)))
  const priceNumber = String(form.price).trim() === '' ? NaN : Number(form.price)
  const bulkProblem = bulkEnabled ? simpleTierProblem(bulkTiers, Number.isFinite(priceNumber) ? priceNumber : null) : ''
  const ready = Boolean(
    categoryId && subcategoryId && brandId && productChosen && !alreadyListed
    && Number.isFinite(priceNumber) && priceNumber > 0
    && stockNumbers.every((value) => Number.isFinite(value) && value >= 0)
    && validDiscount(form.discountPercentage)
    && !bulkProblem,
  )

  async function submit() {
    if (!ready || saving) return
    setSaving(true)
    setMessage(null)
    try {
      const listing = await addSupplierCatalogListing({
        master_product_id: Number(productId),
        master_variant_id: variantId ? Number(variantId) : null,
        price: priceNumber,
        quantity: stockNumbers[0],
        low_stock_threshold: stockNumbers[1],
        discount_percentage: String(form.discountPercentage).trim() === '' ? 0 : Number(form.discountPercentage),
        is_published: form.isPublished !== false,
      })
      // Bulk tiers, when offered, go onto the listing just created. If they
      // cannot be saved the product is still added; the supplier can set them from Edit.
      let note = ''
      const tiers = bulkEnabled ? simpleTiersForApi(bulkTiers) : []
      if (tiers.length) {
        try {
          await saveBulkPricing(listing.id, tiers)
          note = ` Bulk pricing saved (${tiers.length} tier${tiers.length === 1 ? '' : 's'}).`
        } catch (bulkError) {
          note = ` Bulk pricing was not saved: ${bulkError?.response?.data?.detail || 'please set it from Edit'}.`
        }
      }
      dispatch(upsertSupplierProduct(listing))
      dispatch(setStoreNotice({ tone: 'success', text: `${listing.name} added to your catalog.${note}` }))
      // Back to the product list, which re-reads the listings on focus.
      leaving.current = true
      navigation.goBack()
    } catch (error) {
      setMessage({ tone: 'error', text: error?.response?.data?.detail || 'That product could not be added.' })
      setSaving(false)
    }
  }

  // ---- Layout
  const columns = isTablet ? 4 : 3
  const inner = Math.min(width, maxContentWidth) - gutter * 2
  const tileWidth = Math.floor((inner - 8 * (columns - 1)) / columns)
  const circle = Math.min(88, tileWidth - 16)
  const term = query.trim().toLowerCase()

  const tileGrid = (rows, render) => <View style={styles.tileGrid}>{rows.map(render)}</View>

  const categoryTiles = (rows) => tileGrid(rows, (row) => (
    <CircleTile key={row.id} width={tileWidth} name={row.name} selected={String(row.id) === String(categoryId)} onPress={() => chooseCategory(row.id)}>
      <CircleImage src={row.image_url} name={row.name} size={circle} />
    </CircleTile>
  ))

  const renderCategoryScreen = () => (
    <View>
      <View style={styles.searchBox}>
        <Search size={18} color={COLORS.slate[400]} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search products, brands or materials..."
          placeholderTextColor={COLORS.slate[400]}
          autoCorrect={false}
          returnKeyType="search"
          style={styles.searchInput}
        />
        {searching ? <ActivityIndicator size="small" color={COLORS.slate[400]} /> : query ? (
          <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
            <X size={16} color={COLORS.slate[500]} />
          </Pressable>
        ) : null}
      </View>

      {term ? (
        <View style={{ marginTop: 16, gap: 16 }}>
          {categoryRows.some((row) => row.name.toLowerCase().includes(term)) ? (
            <View>
              <Text style={styles.label}>CATEGORIES</Text>
              {categoryTiles(categoryRows.filter((row) => row.name.toLowerCase().includes(term)))}
            </View>
          ) : null}
          <View>
            <Text style={styles.label}>CATALOG PRODUCTS</Text>
            {searching && searchResults.length === 0 ? (
              <LoadingNote />
            ) : searchResults.length === 0 ? (
              <EmptyNote>{`No catalog products match “${query.trim()}”.`}</EmptyNote>
            ) : (
              <View style={{ gap: 8 }}>
                {searchResults.map((row) => {
                  const listed = isFullyListed(row)
                  return (
                    <Pressable key={row.id} onPress={() => chooseSearchResult(row)} disabled={listed} style={[styles.resultRow, listed ? { opacity: 0.6 } : null]}>
                      <View style={styles.resultThumb}><ProductImage src={row.image_url} height={52} compact /></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.resultName} numberOfLines={1}>{row.name}</Text>
                        <Text style={styles.resultMeta} numberOfLines={1}>
                          {[row.brand_name || 'Generic', [row.category_name, row.subcategory_name].filter(Boolean).join(' › ')].filter(Boolean).join(' · ')}
                        </Text>
                        {row.matched_variant?.name || listed ? (
                          <Text style={styles.resultVariant} numberOfLines={1}>{listed ? 'Already in your catalog' : row.matched_variant.name}</Text>
                        ) : null}
                      </View>
                      <ChevronRight size={16} color={COLORS.slate[400]} />
                    </Pressable>
                  )
                })}
              </View>
            )}
          </View>
        </View>
      ) : !categories.loaded ? (
        <LoadingNote />
      ) : categoryRows.length === 0 ? (
        <View style={{ marginTop: 16 }}><EmptyNote>No products available in the admin catalog.</EmptyNote></View>
      ) : (
        <View style={{ marginTop: 18 }}>
          <Text style={styles.sectionTitle}>Choose a category</Text>
          {/* Your categories first, then the rest of the catalog. */}
          {categoryTiles([...yourCategories, ...otherCategories])}
        </View>
      )}
    </View>
  )

  const renderSubcategoryScreen = () => (
    <View>
      <ScreenTitle path={[category?.name].filter(Boolean)} title="Choose Subcategory" />
      {subcategories.loading && subcategoryRows.length === 0 ? <LoadingNote /> : subcategoryRows.length === 0 ? (
        <EmptyNote>No subcategories in this category yet.</EmptyNote>
      ) : tileGrid(subcategoryRows, (row) => (
        <CircleTile key={row.id} width={tileWidth} name={row.name} selected={String(row.id) === String(subcategoryId)} onPress={() => chooseSubcategory(row.id)}>
          <CircleImage src={row.image_url} name={row.name} size={circle} />
        </CircleTile>
      ))}
    </View>
  )

  const renderBrandScreen = () => (
    <View>
      <ScreenTitle path={[category?.name, subcategory?.name].filter(Boolean)} title="Choose Brand" />
      {catalogProducts.loading && productsHere.length === 0 ? <LoadingNote /> : brandRows.length === 0 && !hasGenericProducts ? (
        <EmptyNote>No products in this subcategory yet.</EmptyNote>
      ) : (
        <View style={styles.tileGrid}>
          {brandRows.map((row) => (
            <CircleTile key={row.id} width={tileWidth} name={row.name} selected={row.id === String(brandId)} onPress={() => chooseBrand(row.id)}>
              <BrandLogo src={row.logo_url} name={row.name} size={circle} round />
            </CircleTile>
          ))}
          {hasGenericProducts ? (
            <CircleTile width={tileWidth} name="Generic (no brand)" selected={brandId === GENERIC_BRAND} onPress={() => chooseBrand(GENERIC_BRAND)}>
              <BrandLogo src={null} name="Generic" size={circle} round />
            </CircleTile>
          ) : null}
        </View>
      )}
    </View>
  )

  const renderProductScreen = () => (
    <View>
      <ScreenTitle path={[category?.name, subcategory?.name, brandName].filter(Boolean)} title="Choose Product" />
      {catalogProducts.loading && products.length === 0 ? <LoadingNote /> : products.length === 0 ? (
        <EmptyNote>No products for this brand.</EmptyNote>
      ) : tileGrid(products, (row) => (
        <CircleTile key={row.id} width={tileWidth} name={row.name} selected={String(row.id) === String(productId)} onPress={() => chooseProduct(row)}>
          <CircleImage src={row.image_url} name={row.name} size={circle} fit="contain" />
        </CircleTile>
      ))}
    </View>
  )

  const renderVariantScreen = () => (
    <View>
      <ScreenTitle path={[product?.brand_name || 'Generic', product?.name].filter(Boolean)} title="Select Variant" />
      {!product ? <EmptyNote>Choose a product first.</EmptyNote> : (
        <View style={styles.variantGrid}>
          {variants.map((row) => {
            const listed = isListed(product.id, row.id)
            const selected = String(row.id) === String(variantId)
            const rowUnit = row.unit?.name || row.unit_code || ''
            return (
              <Pressable
                key={row.id}
                onPress={() => chooseVariant(row.id)}
                disabled={listed}
                accessibilityState={{ selected, disabled: listed }}
                style={[styles.variant, { width: Math.floor((inner - 8) / 2) }, selected ? styles.variantOn : null, listed ? { opacity: 0.6 } : null]}
              >
                <View style={styles.variantTop}>
                  <Text style={styles.variantName} numberOfLines={2}>{row.name}</Text>
                  {selected ? <Check size={15} color={COLORS.brand[700]} /> : null}
                </View>
                {rowUnit ? <Text style={styles.variantMeta}>{`Sold by ${rowUnit}`}</Text> : null}
                {listed ? <Text style={styles.resultVariant}>Already in your catalog</Text> : null}
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )

  const discountNumber = Number(form.discountPercentage || 0)
  const renderSellingScreen = () => (
    <View>
      <ScreenTitle title="Selling Information" hint="Set the price, stock and discount for your store." />
      {productChosen ? (
        <View style={styles.chosen}>
          <View style={styles.chosenThumb}><ProductImage src={product.image_url} height={60} compact /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.chosenBrand}>
              <BrandLogo src={product.brand_logo_url} name={product.brand_name || 'Generic'} size={18} />
              <Text style={styles.chosenBrandText} numberOfLines={1}>{product.brand_name || 'Generic'}</Text>
            </View>
            <Text style={styles.resultName} numberOfLines={2}>{product.name}</Text>
            <Text style={styles.resultMeta} numberOfLines={2}>
              {[variant?.name, [product.category_name, product.subcategory_name].filter(Boolean).join(' › ')].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      ) : null}
      {alreadyListed ? (
        <Text style={styles.warning}>This product is already in your catalog. Edit its price from your product list instead.</Text>
      ) : null}

      <View style={{ gap: 12 }}>
        <NumberField label={`Selling price${unit ? ` (per ${unit})` : ''}`} value={form.price} onChangeText={setField('price')} placeholder="300" prefix={currencySymbol(country)} />
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <NumberField label={`Stock${unitPlural ? ` (${unitPlural})` : ''}`} value={form.quantity} onChangeText={setField('quantity')} placeholder="450" />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label={`Low-stock alert${unitPlural ? ` (${unitPlural})` : ''}`} value={form.lowStockThreshold} onChangeText={setField('lowStockThreshold')} placeholder="50" />
          </View>
        </View>
        <NumberField
          label="Discount"
          value={form.discountPercentage}
          onChangeText={setField('discountPercentage')}
          placeholder="0"
          suffix="%"
          error={validDiscount(form.discountPercentage) ? '' : 'Discount must be a number from 0 to 100.'}
        />
        <PublishSwitch value={form.isPublished} onChange={setField('isPublished')} />
        {Number.isFinite(priceNumber) && priceNumber > 0 && validDiscount(form.discountPercentage) && discountNumber > 0 ? (
          <Text style={styles.buyersSee}>
            {'Buyers see: '}
            <Text style={styles.buyersPrice}>{money(discountedPrice(priceNumber, discountNumber), country)}</Text>
            {'  '}
            <Text style={styles.buyersWas}>{money(priceNumber, country)}</Text>
            {`  ${discountText(discountNumber)}${unit ? ` · per ${unit}` : ''}`}
          </Text>
        ) : null}
      </View>

      <View style={styles.bulkSection}>
        <Text style={styles.sectionTitle}>Bulk Pricing</Text>
        <Text style={[styles.screenHint, { marginBottom: 10 }]}>Optional: a lower price per unit from a quantity you choose.</Text>
        <BulkTierBuilder
          enabled={bulkEnabled}
          onToggle={setBulkEnabled}
          tiers={bulkTiers}
          onChange={setBulkTiers}
          unit={unit}
          normalPrice={Number.isFinite(priceNumber) ? priceNumber : null}
          country={country}
        />
      </View>

      <View style={{ marginTop: 18 }}>
        <PrimaryButton
          label="Save Product"
          onPress={submit}
          loading={saving}
          disabled={!ready || saving}
          icon={<Check size={16} color="#ffffff" />}
          full
        />
      </View>
    </View>
  )

  // A screen whose earlier choice is missing falls back to the first open question.
  const screen = (() => {
    if (step !== 'category' && !categoryId) return renderCategoryScreen()
    switch (step) {
      case 'subcategory':
        return renderSubcategoryScreen()
      case 'brand':
        return subcategoryId ? renderBrandScreen() : renderSubcategoryScreen()
      case 'product':
        return brandId ? renderProductScreen() : renderBrandScreen()
      case 'variant':
        return product ? renderVariantScreen() : renderProductScreen()
      case 'selling':
        return productChosen ? renderSellingScreen() : product ? renderVariantScreen() : renderProductScreen()
      default:
        return renderCategoryScreen()
    }
  })()

  const current = stepIndex(step)
  return (
    <StackScreenShell title="Add Product" subtitle={STEPS[current]?.label} onBack={() => navigation.goBack()} scrollRef={scrollRef}>
      {/* Category → … → Selling; a screen already passed can be reopened. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingHorizontal: gutter, alignItems: 'center' }}>
        {STEPS.map((item, index) => {
          const done = index < current
          const active = index === current
          const clickable = done && canOpen(item.key)
          return (
            <View key={item.key} style={styles.progressItem}>
              <Pressable
                onPress={clickable ? () => setStep(item.key) : undefined}
                disabled={!clickable}
                style={[styles.pill, active ? styles.pillActive : done ? styles.pillDone : null]}
              >
                {done ? <Check size={11} color={COLORS.brand[800]} /> : null}
                <Text style={[styles.pillText, active ? styles.pillTextActive : done ? styles.pillTextDone : null]}>{item.label}</Text>
              </Pressable>
              {index < STEPS.length - 1 ? <ChevronRight size={13} color={COLORS.slate[300]} /> : null}
            </View>
          )
        })}
      </ScrollView>

      <Section style={{ marginTop: 16 }}>
        {screen}
        {message ? <View style={{ marginTop: 14 }}><Notice tone={message.tone} text={message.text} /></View> : null}
      </Section>
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  progressItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, backgroundColor: c.muted, paddingHorizontal: 10, paddingVertical: 5 },
  pillActive: { backgroundColor: '#1a5038' },
  pillDone: { backgroundColor: c.brandSoft },
  pillText: { fontSize: 11.5, fontFamily: 'Inter_700Bold', color: c.textFaint },
  pillTextActive: { color: '#ffffff' },
  pillTextDone: { color: c.brandTextStrong },
  searchBox: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 13 },
  searchInput: { flex: 1, height: '100%', fontSize: 14, fontFamily: 'Inter_500Medium', color: c.text },
  label: { marginBottom: 8, fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: c.textFaint },
  sectionTitle: { marginBottom: 12, fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, rowGap: 14 },
  tile: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  tileRing: { borderRadius: 999, borderWidth: 1, borderColor: c.border, padding: 3 },
  tileRingOn: { borderWidth: 2, borderColor: '#236645' },
  tileName: { textAlign: 'center', fontSize: 12, lineHeight: 15, fontFamily: 'Inter_700Bold', color: c.text },
  tileNameOn: { color: c.brandTextStrong },
  path: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  screenTitle: { marginTop: 2, fontSize: 17, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  screenHint: { marginTop: 2, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', color: c.textMuted },
  emptyNote: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, paddingHorizontal: 14, paddingVertical: 16 },
  emptyNoteText: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  loadingNote: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 20 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 9 },
  resultThumb: { height: 52, width: 52, overflow: 'hidden', borderRadius: 9, borderWidth: 1, borderColor: c.borderSoft },
  resultName: { fontSize: 13.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  resultMeta: { marginTop: 1, fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  resultVariant: { marginTop: 2, fontSize: 11, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variant: { minHeight: 70, justifyContent: 'center', gap: 2, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12, paddingVertical: 10 },
  variantOn: { borderWidth: 2, borderColor: '#2e7d55', backgroundColor: c.brandSoft },
  variantTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  variantName: { flex: 1, fontSize: 13.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  variantMeta: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  chosen: { marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 12, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft, padding: 10 },
  chosenThumb: { height: 60, width: 60, overflow: 'hidden', borderRadius: 9, borderWidth: 1, borderColor: c.border, backgroundColor: '#ffffff' },
  chosenBrand: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chosenBrandText: { flex: 1, fontSize: 11, fontFamily: 'Inter_700Bold', color: c.textMuted },
  warning: { marginBottom: 14, borderRadius: 9, backgroundColor: c.amberSoft, paddingHorizontal: 11, paddingVertical: 8, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', color: c.amberTextStrong },
  twoCol: { flexDirection: 'row', gap: 10 },
  buyersSee: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  buyersPrice: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  buyersWas: { textDecorationLine: 'line-through', color: c.textFaint },
  bulkSection: { marginTop: 18, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 13 },
}))
