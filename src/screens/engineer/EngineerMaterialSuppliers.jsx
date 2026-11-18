// The Site Engineer's Material Suppliers — port of the web
// pages/engineer/EngineerSuppliersSection.jsx with the parts of
// components/shop/SupplierBrowser.jsx it uses (reference cards, search only,
// catalogue as its own view, browse only: a Site Engineer asks the Store
// Manager for material, so there is no Add to Cart here).
// The list is every supplier accepted by the Builder of each of the engineer's
// projects (/projects/{id}/team-suppliers), less Labor and Equipment Suppliers.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { AlertTriangle, ArrowLeft, ChevronRight, MapPin, Package, Search, Star, Store, Truck, Warehouse } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { fetchProjectTeamSuppliers } from '../../api/engineers'
import { fetchSupplierProfile } from '../../api/profiles'
import { fetchCatalogCategories } from '../../api/catalog'
import { EQUIPMENT_SUPPLIER_CATEGORY, LABOR_SUPPLIER_CATEGORY } from '../../api/supply'
import { listingSearchScore } from '../../utils/catalogSearch'
import { formatNumber } from '../../utils/formatters'
import { DEFAULT_SUPPLIER_OFFERING_KEYS, SUPPLIER_CATEGORY_KEYS, SUPPLIER_OFFERING_KEYS, SUPPLIER_TYPE_KEYS, optionLabel } from '../../i18n/optionKeys'
import { SheetModal } from '../../components/builder/BuilderUi'
import { PriceTag, SmartImage, StockBadge } from './materialParts'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

// Labor and Equipment Suppliers have their own screens.
export const isMaterialScreenSupplier = (supplier) => (
  supplier?.supplier_category !== LABOR_SUPPLIER_CATEGORY && supplier?.supplier_category !== EQUIPMENT_SUPPLIER_CATEGORY
)
const offeringKeys = (supplier) => SUPPLIER_OFFERING_KEYS[supplier?.supplier_category] || DEFAULT_SUPPLIER_OFFERING_KEYS
const categorySlug = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Every supplier accepted by each project's own Builder, each once. Shared with the Product Catalog. */
export async function fetchMaterialSuppliers(projects) {
  const all = []
  const seen = new Set()
  for (const project of projects) {
    try {
      const list = await fetchProjectTeamSuppliers(project.id)
      for (const supplier of list || []) {
        if (!seen.has(supplier.user_id)) {
          seen.add(supplier.user_id)
          all.push(supplier)
        }
      }
    } catch {
      // Skip projects where the engineer has no access.
    }
  }
  return all.filter(isMaterialScreenSupplier)
}

function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <View style={styles.empty}>
      <Icon size={30} color={COLORS.brand[400]} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
      {action}
    </View>
  )
}

/** One supplier listing's details, browse only (web BuyerProductCard without the cart). */
function ProductSheet({ product, supplier, onClose }) {
  const { t, td } = useLanguage()
  if (!product) return null
  const available = Number(product.quantity || 0)
  const outOfStock = available <= 0
  const stockText = `${formatNumber(available)} ${td(product.unit)}`
  const specs = [
    [t('dash.supplier.brand'), td(product.brand)],
    [t('shop.type'), td(product.product_type)],
    [t('shop.grade'), td(product.grade)],
    [t('dash.supplier.size'), td(product.size)],
    [t('dash.supplier.unit'), td(product.unit)],
    [t('shop.availability'), outOfStock ? t('dash.supplier.outOfStock') : stockText],
  ].filter(([, value]) => value)
  return (
    <SheetModal visible tall title={td(product.name)} subtitle={product.category ? optionLabel(t, SUPPLIER_CATEGORY_KEYS, product.category) : ''} onClose={onClose}>
      <SmartImage src={product.image_url} style={styles.detailImage} iconSize={34} />
      <View style={{ marginTop: 12 }}>
        <PriceTag price={product.price} discountPercentage={product.discount_percentage} large />
        {product.unit ? <Text style={styles.meta}>{`${t('dash.supplier.per')} ${td(product.unit)}`}</Text> : null}
        <Text style={[styles.stockLine, { color: ink(outOfStock ? '#be123c' : '#047857') }]}>{outOfStock ? t('dash.supplier.outOfStock') : `${stockText} ${t('shop.inStock')}`}</Text>    
          </View>
      {product.description ? <Text style={styles.description}>{td(product.description)}</Text> : null}
      <Text style={styles.sectionLabel}>{t('shop.specifications')}</Text>
      <View style={styles.specs}>
        {specs.map(([label, value]) => (
          <View key={label} style={styles.spec}>
            <Text style={styles.specLabel}>{label}</Text>
            <Text style={styles.specValue}>{value}</Text>
          </View>
        ))}
      </View>
      {product.usage ? (
        <View style={styles.box}>
          <Text style={styles.specLabel}>{t('shop.usage')}</Text>
          <Text style={styles.meta}>{td(product.usage)}</Text>
        </View>
      ) : null}
      {supplier ? (
        <View style={styles.box}>
          <Text style={styles.specLabel}>{t('shop.supplierDetails')}</Text>
          <Text style={styles.cardName}>{td(supplier.store_name || supplier.name)}</Text>
          {supplier.name && supplier.store_name && supplier.name !== supplier.store_name ? <Text style={styles.meta}>{td(supplier.name)}</Text> : null}
        </View>
      ) : null}
    </SheetModal>
  )
}

export default function EngineerMaterialSuppliers({ projects, search, onOpenSupplierTab }) {
  const { t, td } = useLanguage()
  const categoryLabel = (value) => {
    const label = optionLabel(t, SUPPLIER_CATEGORY_KEYS, value)
    return label === value ? td(value) : label
  }
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewedSupplier, setViewedSupplier] = useState(null)
  const [supplierCategory, setSupplierCategory] = useState('')
  const [viewedProduct, setViewedProduct] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [categoryImages, setCategoryImages] = useState(() => new Map())
  const imagesRequested = useRef(false)
  const projectKey = projects.map((project) => project.id).join(',')

  const load = useCallback(() => fetchMaterialSuppliers(projects), [projectKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true
    setLoading(true)
    load()
      .then((list) => { if (active) setSuppliers(Array.isArray(list) ? list : []) })
      .catch(() => { if (active) setSuppliers([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load])
  // The Builder accepting or assigning a supplier sends a live hint; re-read quietly.
  useLiveRefresh(() => { load().then((list) => { if (Array.isArray(list)) setSuppliers(list) }).catch(() => {}) })

  // The Master Catalog's category pictures, read once when a catalogue is first opened.
  useEffect(() => {
    if (!viewedSupplier || imagesRequested.current) return
    imagesRequested.current = true
    fetchCatalogCategories()
      .then((rows) => {
        const images = new Map()
        ;(Array.isArray(rows) ? rows : []).forEach((row) => {
          if (!row?.image_url) return
          images.set(categorySlug(row.name), row.image_url)
          if (row.slug) images.set(categorySlug(row.slug), row.image_url)
        })
        setCategoryImages(images)
      })
      .catch(() => {})
  }, [viewedSupplier])

  const query = String(search || '').trim().toLowerCase()
  const filteredSuppliers = useMemo(() => suppliers.filter((supplier) => {
    if (!query) return true
    const nameMatch = `${supplier.store_name || ''} ${supplier.name || ''}`.toLowerCase().includes(query)
    const materialMatch = (supplier.products || []).some((product) => listingSearchScore(query, product) > 0)
    return nameMatch || materialMatch
  }), [suppliers, query])
  const matchingProducts = useMemo(() => {
    if (!query) return []
    const matches = []
    filteredSuppliers.forEach((supplier) => {
      ;(supplier.products || []).forEach((product) => {
        const score = listingSearchScore(query, product)
        if (score > 0) matches.push({ supplier, product, score })
      })
    })
    return matches.sort((a, b) => b.score - a.score).slice(0, 8)
  }, [filteredSuppliers, query])

  const viewSupplier = async (supplier, openProductId = null) => {
    // Labor and Equipment suppliers open their own tab, not the material catalogue.
    const tab = { [LABOR_SUPPLIER_CATEGORY]: 'labor', [EQUIPMENT_SUPPLIER_CATEGORY]: 'equipment' }[supplier?.supplier_category]
    if (tab && onOpenSupplierTab) { onOpenSupplierTab(tab, supplier.user_id); return }
    setSupplierCategory('')
    setErrorMessage('')
    try {
      const profile = await fetchSupplierProfile(supplier.user_id)
      const next = { ...supplier, ...profile, products: profile.profile_products || [] }
      setViewedSupplier(next)
      const opened = openProductId && (profile.profile_products || []).find((item) => item.id === openProductId)
      if (opened) setViewedProduct(opened)
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || t('dash.engineer.suppliers.unableLoad'))
    }
  }

  const visibleProducts = viewedSupplier ? viewedSupplier.products || [] : []
  const materialCategories = useMemo(
    () => [...new Set(visibleProducts.map((product) => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [visibleProducts],
  )
  const categorySummary = useMemo(() => {
    const summary = new Map()
    visibleProducts.forEach((product) => {
      if (!product.category) return
      const entry = summary.get(product.category) || { count: 0, image: null }
      entry.count += 1
      if (!entry.image && product.image_url) entry.image = product.image_url
      summary.set(product.category, entry)
    })
    return summary
  }, [visibleProducts])
  const shownProducts = supplierCategory ? visibleProducts.filter((product) => product.category === supplierCategory) : visibleProducts
  const browsingCategories = supplierCategory === '' && materialCategories.length > 1

  const errorBox = errorMessage ? (
    <View style={styles.error}>
            <AlertTriangle size={15} color={ink('#be123c')} />
      <Text style={styles.errorText}>{td(errorMessage)}</Text>
    </View>
  ) : null

  // ------------------------------------------------ one supplier's catalogue
  if (viewedSupplier) {
    return (
      <View style={styles.panel}>
        {errorBox}
        <View style={styles.supplierHead}>
          <Pressable onPress={() => { setViewedSupplier(null); setViewedProduct(null) }} accessibilityLabel={t('dash.contractor.backToSuppliers')} style={styles.backButton}>
            <ArrowLeft size={15} color={COLORS.slate[600]} />
            <Text style={styles.backText}>{t('dash.contractor.backToSuppliers')}</Text>
          </Pressable>
          <Text style={styles.supplierName}>{td(viewedSupplier.store_name || viewedSupplier.name)}</Text>
          <View style={styles.metaRow}>
            <View style={styles.inline}><Star size={12} color={ink('#2e7d55')} fill="#2e7d55" /><Text style={styles.rating}>{String(viewedSupplier.rating || t('dash.common.new'))}</Text></View>         
               <View style={[styles.inline, { flexShrink: 1 }]}>
              <MapPin size={12} color={COLORS.slate[500]} />
              <Text style={styles.meta} numberOfLines={2}>{viewedSupplier.address ? td(viewedSupplier.address) : `${t('dash.common.pincode')} ${viewedSupplier.pincode || '—'}`}</Text>
            </View>
            {viewedSupplier.phone ? <Text style={styles.meta}>{viewedSupplier.phone}</Text> : null}
          </View>
          {viewedSupplier.about ? <Text style={styles.about}>{td(viewedSupplier.about)}</Text> : null}
        </View>

        {!visibleProducts.length ? (
          <EmptyState icon={Package} title={t(offeringKeys(viewedSupplier).empty)} hint={t('dash.engineer.suppliers.noPublishedMaterialsHint')} />
        ) : browsingCategories ? (
          // Category tiles, each pictured by the Master Catalog or the supplier's own products.
          <View style={styles.grid}>
            {materialCategories.map((name) => {
              const summary = categorySummary.get(name)
              const picture = categoryImages.get(categorySlug(name)) || summary?.image
              return (
                <Pressable key={name} onPress={() => setSupplierCategory(name)} style={styles.tile}>
                  <SmartImage src={picture} style={styles.tileImage} contentFit="cover" />
                  <View style={styles.tileBody}>
                    <Text style={styles.tileName} numberOfLines={1}>{categoryLabel(name)}</Text>
                    <Text style={styles.meta}>{`${formatNumber(summary?.count ?? 0)} ${t('dash.supplier.products')}`}</Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        ) : (
          <View>
            {supplierCategory ? (
              <View style={styles.categoryHead}>
                {materialCategories.length > 1 ? (
                  <Pressable onPress={() => setSupplierCategory('')} style={styles.backButton}>
                    <ArrowLeft size={13} color={COLORS.slate[600]} />
                    <Text style={styles.backText}>{t('dash.supplier.allCategories')}</Text>
                  </Pressable>
                ) : null}
                <Text style={styles.categoryTitle} numberOfLines={1}>{categoryLabel(supplierCategory)}</Text>
              </View>
            ) : null}
            <View style={styles.grid}>
              {shownProducts.map((product) => (
                <Pressable key={product.id} onPress={() => setViewedProduct(product)} style={styles.productCard}>
                  <SmartImage src={product.image_url} style={styles.productImage} />
                  <View style={styles.productBody}>
                    <Text style={styles.productName} numberOfLines={2}>{td(product.name)}</Text>
                    <PriceTag price={product.price} discountPercentage={product.discount_percentage} />
                    <StockBadge quantity={product.quantity} threshold={product.low_stock_threshold} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        <ProductSheet product={viewedProduct} supplier={viewedSupplier} onClose={() => setViewedProduct(null)} />
      </View>
    )
  }

  // ------------------------------------------------ the supplier list
  return (
    <View style={styles.panel}>
      {errorBox}
      {!projects.length ? (
        <View style={styles.warnPill}>
                  <AlertTriangle size={13} color={ink('#134127')} />
          <Text style={styles.warnText}>{t('dash.engineer.noAssignedProjects')}</Text>
        </View>
      ) : null}
      {loading ? (
        <View style={{ gap: 8 }}>{[0, 1, 2].map((index) => <View key={index} style={styles.skeleton} />)}</View>
      ) : !suppliers.length ? (
        <EmptyState icon={Store} title={t('dash.owner.suppliers.emptyTitle')} hint={t('dash.engineer.suppliers.noSuppliersHint')} />
      ) : !filteredSuppliers.length ? (
        <EmptyState icon={Search} title={t('dash.engineer.suppliers.noMatch')} hint={t('dash.engineer.suppliers.noMatchHint')} />
      ) : (
        <View style={{ gap: 10 }}>
          {matchingProducts.length > 0 ? (
            <View>
              <Text style={styles.eyebrow}>{t('catalog.matchingProducts')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 6 }}>
                {matchingProducts.map(({ supplier, product }) => (
                  <Pressable key={`${supplier.user_id}-${product.id}`} onPress={() => viewSupplier(supplier, product.id)} style={styles.match}>
                    <SmartImage src={product.image_url} style={styles.matchImage} contentFit="cover" iconSize={16} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchName} numberOfLines={1}>{td(product.name)}</Text>
                      <Text style={styles.meta} numberOfLines={1}>{[product.brand, product.category && categoryLabel(product.category), product.size, product.unit].filter(Boolean).join(' · ')}</Text>
                      <Text style={styles.faint} numberOfLines={1}>{supplier.store_name || supplier.name}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
          {filteredSuppliers.map((supplier) => {
            const products = supplier.products || []
            const inStock = products.filter((product) => Number(product.quantity) > 0).length
            const [pillBg, pillFg, pillText] = products.length === 0
              ? ['#f1f5f9', '#475569', t(offeringKeys(supplier).none)]
              : inStock === 0
                ? ['#fffbeb', '#b45309', t('dash.supplier.outOfStock')]
                : ['#ecfdf5', '#047857', `${inStock} ${t('dash.engineer.suppliers.items')}`]
            const storeLine = supplier.store_name && supplier.store_name !== supplier.name ? td(supplier.store_name) : ''
            return (
              <Pressable key={supplier.user_id} onPress={() => viewSupplier(supplier)} style={styles.card}>
                <View style={styles.cardTop}>
                  <SmartImage src={supplier.store_logo_url || supplier.profile_photo_url} style={styles.avatar} contentFit="cover" iconSize={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{td(supplier.name || supplier.store_name)}</Text>
                    {storeLine ? <Text style={styles.meta} numberOfLines={1}>{storeLine}</Text> : null}
                  </View>
                </View>
                <View style={styles.chips}>
                  {supplier.supplier_category ? (
                    <View style={[styles.chip, styles.chipBrand]}>
                                           <Warehouse size={12} color={ink('#134127')} />
                      <Text style={styles.chipBrandText}>{optionLabel(t, SUPPLIER_TYPE_KEYS, supplier.supplier_category)}</Text>
                    </View>
                  ) : null}
                  <View style={styles.chip}>
                    <MapPin size={11} color={COLORS.slate[500]} />
                    <Text style={styles.chipText}>{`${t('dash.common.pincode')} ${supplier.pincode || '—'}`}</Text>
                  </View>
                  <View style={[styles.chip, styles.chipBrand]}>
                                       <Star size={11} color={ink('#134127')} />
                    <Text style={styles.chipBrandText}>{String(supplier.rating || t('dash.common.new'))}</Text>
                  </View>
                </View>
                <View style={styles.cardFoot}>
                  <Truck size={15} color={COLORS.slate[500]} />
                  <Text style={styles.meta}>{t('dash.engineer.suppliers.availability')}</Text>
                                  <View style={[styles.pill, { backgroundColor: soft(pillBg, pillFg), marginLeft: 'auto' }]}>
                    <Text style={[styles.pillText, { color: ink(pillFg) }]} numberOfLines={1}>{pillText}</Text>
                  </View>
                  <ChevronRight size={16} color={COLORS.slate[600]} />
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = createStyles((c) => ({
  panel: { gap: 10, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.brandBorderStrong, paddingHorizontal: 16, paddingVertical: 26 },
  emptyTitle: { marginTop: 6, textAlign: 'center', fontFamily: 'Manrope_800ExtraBold', fontSize: 15, color: c.text },
  emptyHint: { textAlign: 'center', fontSize: 12.5, fontWeight: '500', color: c.textMuted },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: line('#fecdd3', '#e11d48'), backgroundColor: soft('#fff1f2', '#e11d48'), padding: 10 },
  errorText: { flex: 1, fontSize: 12.5, fontWeight: '700', color: ink('#be123c') },
  warnPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft, paddingHorizontal: 10, paddingVertical: 5 },
  warnText: { fontSize: 11, fontWeight: '800', color: ink('#134127') },
    skeleton: { height: 64, borderRadius: 12, backgroundColor: c.subtle },
  eyebrow: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textMuted },
  match: { width: 240, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 8 },
  matchImage: { height: 46, width: 46, borderRadius: 8 },
  matchName: { fontSize: 12, fontWeight: '800', color: c.text },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { height: 44, width: 44, borderRadius: 22 },
  cardName: { fontSize: 14, fontWeight: '800', color: c.text },
  chips: { marginVertical: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: c.subtle, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  chipBrand: { backgroundColor: soft('#ecfdf5', '#047857') },
  chipBrandText: { fontSize: 11, fontWeight: '700', color: ink('#134127') },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 8 },
  pill: { maxWidth: 150, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 12, fontWeight: '600', color: c.textMuted },
  faint: { fontSize: 10.5, fontWeight: '700', color: c.textFaint },
  supplierHead: { gap: 4 },
  backButton: { alignSelf: 'flex-start', height: 32, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10 },
  backText: { fontSize: 12, fontWeight: '800', color: c.textSoft },
  supplierName: { marginTop: 6, fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: c.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 2 },
  rating: { fontSize: 12, fontWeight: '800', color: c.brandText },
  about: { marginTop: 4, fontSize: 12, fontWeight: '500', lineHeight: 18, color: c.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { width: '48.5%', overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  tileImage: { aspectRatio: 16 / 9, width: '100%' },
  tileBody: { paddingHorizontal: 10, paddingVertical: 8 },
  tileName: { fontFamily: 'Manrope_800ExtraBold', fontSize: 13.5, color: c.text },
  categoryHead: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryTitle: { flex: 1, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textMuted },
  productCard: { width: '48.5%', overflow: 'hidden', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  productImage: { aspectRatio: 1, width: '100%', backgroundColor: c.subtle },
  productBody: { gap: 4, padding: 8 },
  productName: { fontSize: 12.5, fontWeight: '800', lineHeight: 16, color: c.text },
  detailImage: { height: 220, width: '100%', borderRadius: 12, backgroundColor: c.subtle },
  stockLine: { marginTop: 4, fontSize: 12, fontWeight: '800' },
  description: { marginTop: 10, fontSize: 13, lineHeight: 19, fontWeight: '500', color: c.textSoft },
  sectionLabel: { marginTop: 14, marginBottom: 6, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spec: { width: '48%', borderRadius: 10, backgroundColor: c.subtle, padding: 8 },
  specLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  specValue: { marginTop: 2, fontSize: 13, fontWeight: '800', color: c.text },
  box: { marginTop: 10, gap: 3, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10 },
}))