// The listing editor: port of web pages/supplier/ProductDetailCard.jsx as the
// storefront opens it (Edit, straight into the form).
//
//   A Master Catalog listing (master_product_id set): what the product IS is
//   read live from the catalog and shown read-only; the supplier edits only
//   what they own -- price, stock, low-stock threshold, discount, published --
//   plus the listing's optional bulk pricing (its own Save).
//   An older listing the supplier typed in themselves keeps its full form.
import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Save } from 'lucide-react-native'
import { ActionButton, Notice, Section, StackScreenShell } from '../../components/builder/BuilderUi'
import { BudgetInWords, SelectField, TextField } from '../../components/form'
import { fetchCatalogProduct } from '../../api/catalog'
import { selectSupplierProducts, setStoreNotice } from '../../store/supplierCatalogSlice'
import { StockBadge } from '../owner/marketplace/shopParts'
import { useLanguage } from '../../i18n/LanguageContext'
import { SUPPLIER_CATEGORY_KEYS, optionLabel } from '../../i18n/optionKeys'
import { formatDate } from '../../utils/formatters'
import { createStyles } from '../../theme/createStyles'
import { supplierCategoryOptions } from './supplierKinds'
import {
  BrandLogo, BulkPricingPanel, NumberField, ProductImage, PublishSwitch, currencySymbol, discountOf, discountText, listingStatus,
  money, sellingPrice, unitQuantity, useSupplierCountry, useSupplierListings, validDiscount,
} from './products/productParts'

const UNIT_OPTIONS = ['bag', 'kg', 'piece', 'ton', 'litre', 'cubic foot', 'cubic metre']
const UNIT_LABEL_KEYS = {
  bag: 'ui.supplier.unitBag',
  kg: 'ui.supplier.unitKg',
  piece: 'ui.supplier.unitPiece',
  ton: 'ui.supplier.unitTon',
  litre: 'ui.supplier.unitLitre',
  'cubic foot': 'sup.unit.cubicFoot',
  'cubic metre': 'sup.unit.cubicMetre',
}
const AVAILABILITY_KEYS = {
  'Active': 'dash.supplier.availableInStock',
  'Low Stock': 'dash.supplier.lowStock',
  'Out of Stock': 'dash.supplier.outOfStock',
  'Unpublished': 'dash.supplier.unpublished',
}

function draftFromProduct(product) {
  return {
    name: product.name || '',
    brand: product.brand || '',
    category: product.category || '',
    size: product.size || '',
    unit: product.unit || '',
    price: String(product.price ?? ''),
    quantity: String(product.quantity ?? ''),
    low_stock_threshold: String(product.low_stock_threshold ?? ''),
    discount_percentage: String(product.discount_percentage ?? 0),
    features: product.features || '',
    description: product.description || '',
    product_type: product.product_type || '',
    grade: product.grade || '',
    usage: product.usage || '',
    is_published: product.is_published !== false,
  }
}

function Tile({ label, value }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  )
}

export default function SupplierEditListingScreen({ navigation, route }) {
  const dispatch = useDispatch()
  const { t, td } = useLanguage()
  const country = useSupplierCountry()
  const listingId = route.params?.listingId
  const product = useSelector(selectSupplierProducts).find((row) => String(row.id) === String(listingId)) || null
  const { update } = useSupplierListings()
  const [draft, setDraft] = useState(() => (product ? draftFromProduct(product) : null))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const isCatalog = Boolean(product?.master_product_id)
  const [catalog, setCatalog] = useState({ status: isCatalog ? 'loading' : 'none', product: null })
  useEffect(() => {
    if (!isCatalog) return undefined
    let cancelled = false
    setCatalog({ status: 'loading', product: null })
    fetchCatalogProduct(product.master_product_id)
      .then((master) => !cancelled && setCatalog({ status: 'ready', product: master }))
      .catch(() => !cancelled && setCatalog({ status: 'error', product: null }))
    return () => { cancelled = true }
  }, [isCatalog, product?.master_product_id])

  if (!product || !draft) {
    return (
      <StackScreenShell title={t('dash.supplier.editListing')} onBack={() => navigation.goBack()}>
        <Section><Text style={styles.muted}>This product is no longer in your store.</Text></Section>
      </StackScreenShell>
    )
  }

  const setField = (field) => (value) => setDraft((current) => ({ ...current, [field]: value }))
  const master = catalog.product
  const masterVariant = master?.variants?.find((variant) => variant.id === product.master_variant_id) || null
  const unitRecord = masterVariant?.unit || master?.unit || null
  const unitLabel = unitRecord ? unitRecord.plural_name || unitRecord.name : ''
  const title = (isCatalog && master?.name) || td(product.name)
  const statusKey = listingStatus(product)
  const quantity = Number(product.quantity || 0)
  const discount = discountOf(product)
  const legacyUnit = product.unit ? optionLabel(t, UNIT_LABEL_KEYS, product.unit) : ''

  const catalogDetails = master
    ? [
        [t('dash.supplier.category'), master.category_name],
        [t('dash.supplier.subcategory'), master.subcategory_name],
        [t('dash.supplier.brand'), master.brand_name],
        [t('dash.supplier.variant'), masterVariant?.name],
        [t('dash.supplier.unit'), unitRecord?.name],
        [t('dash.supplier.standard'), master.standard_code],
      ].filter(([, value]) => value)
    : []

  async function saveChanges() {
    if (saving) return
    let updates
    if (isCatalog) {
      const values = ['price', 'quantity', 'low_stock_threshold'].map((field) => Number(draft[field] || 0))
      if (values.some((value) => !Number.isFinite(value) || value < 0)) {
        setSaveError(t('dash.supplier.msg.unableUpdate'))
        return
      }
      if (!validDiscount(draft.discount_percentage)) {
        setSaveError('Discount must be a number from 0 to 100.')
        return
      }
      // Only what the supplier owns: the server refuses a catalog field.
      updates = {
        price: values[0],
        quantity: values[1],
        low_stock_threshold: values[2],
        is_published: draft.is_published,
        discount_percentage: Number(draft.discount_percentage || 0),
      }
    } else {
      if (!draft.name.trim()) {
        setSaveError(`${t('dash.supplier.msg.pleaseEnter')}: ${t('sup.field.productName')}`)
        return
      }
      updates = {
        name: draft.name.trim(),
        brand: draft.brand.trim(),
        category: draft.category,
        size: draft.size.trim(),
        unit: draft.unit,
        price: Number(draft.price || 0),
        quantity: Number(draft.quantity || 0),
        low_stock_threshold: Number(draft.low_stock_threshold || 0),
        features: draft.features.trim(),
        description: draft.description.trim(),
        product_type: draft.product_type.trim(),
        grade: draft.grade.trim(),
        usage: draft.usage.trim(),
        is_published: draft.is_published,
      }
    }
    setSaving(true)
    setSaveError('')
    const result = await update(product.id, updates)
    setSaving(false)
    if (result.error) {
      setSaveError(result.error)
      return
    }
    dispatch(setStoreNotice({ tone: 'success', text: result.message }))
    navigation.goBack()
  }

  return (
    <StackScreenShell title={t('dash.supplier.editListing')} subtitle={title} onBack={() => navigation.goBack()}>
      <Section>
        {/* What the listing is, at a glance */}
        <View style={styles.summary}>
          <View style={styles.summaryImage}><ProductImage src={product.image_url} height={84} compact /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {isCatalog && master ? (
              <View style={styles.brandRow}>
                <BrandLogo src={master.brand_logo_url || product.brand_logo_url} name={master.brand_name || 'Generic'} size={18} />
                <Text style={styles.brandText} numberOfLines={1}>{master.brand_name || 'Generic'}</Text>
              </View>
            ) : null}
            <Text style={styles.title} numberOfLines={3}>{title}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{money(sellingPrice(product), country)}</Text>
              {discount > 0 ? <Text style={styles.was}>{money(product.price, country)}</Text> : null}
              {discount > 0 ? <Text style={styles.off}>{discountText(discount)}</Text> : null}
            </View>
            <Text style={styles.availability}>{t(AVAILABILITY_KEYS[statusKey] || AVAILABILITY_KEYS.Active)}</Text>
          </View>
        </View>

        <View style={styles.tiles}>
          <Tile label={t('dash.supplier.stock')} value={isCatalog ? unitQuantity(quantity, unitRecord) : `${quantity.toLocaleString('en-IN')} ${legacyUnit}`.trim()} />
          <Tile label={t('dash.supplier.lowStockThreshold')} value={isCatalog ? unitQuantity(product.low_stock_threshold, unitRecord) : String(product.low_stock_threshold || 0)} />
          <Tile label={t('dash.common.status')} value={product.is_published === false ? t('dash.supplier.unpublished') : t('sup.card.published')} />
          <Tile label={t('dash.supplier.listedOn')} value={formatDate(product.created_at, '—')} />
        </View>
        <StockBadge quantity={product.quantity} threshold={product.low_stock_threshold} style={{ marginTop: 10, alignSelf: 'flex-start' }} />

        {isCatalog && catalog.status === 'ready' && catalogDetails.length ? (
          <View style={[styles.tiles, { marginTop: 14 }]}>
            {catalogDetails.map(([label, value]) => <Tile key={label} label={label} value={value} />)}
          </View>
        ) : null}
        {isCatalog && catalog.status === 'loading' ? <Text style={[styles.muted, { marginTop: 14 }]}>{t('dash.supplier.catalogLoading')}</Text> : null}
        {isCatalog && catalog.status === 'error' ? <View style={{ marginTop: 14 }}><Notice tone="error" text={t('dash.supplier.catalogUnavailable')} /></View> : null}

        {/* What the supplier owns */}
        <View style={styles.form}>
          {isCatalog ? (
            <>
              <NumberField label={t('dash.supplier.sellingPrice')} value={draft.price} onChangeText={setField('price')} prefix={currencySymbol(country)} />
              <BudgetInWords value={draft.price} country={country} />
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <NumberField label={unitLabel ? `${t('dash.supplier.stock')} (${unitLabel})` : t('dash.supplier.stock')} value={draft.quantity} onChangeText={setField('quantity')} />
                </View>
                <View style={{ flex: 1 }}>
                  <NumberField
                    label={unitLabel ? `${t('dash.supplier.lowStockThreshold')} (${unitLabel})` : t('dash.supplier.lowStockThreshold')}
                    value={draft.low_stock_threshold}
                    onChangeText={setField('low_stock_threshold')}
                  />
                </View>
              </View>
              <NumberField
                label="Discount (%)"
                value={draft.discount_percentage}
                onChangeText={setField('discount_percentage')}
                suffix="%"
                error={validDiscount(draft.discount_percentage) ? '' : 'Discount must be a number from 0 to 100.'}
              />
              <PublishSwitch value={draft.is_published} onChange={setField('is_published')} label={t('dash.supplier.published')} />
              <Text style={styles.readOnlyNote}>{t('dash.supplier.catalogReadOnly')}</Text>
            </>
          ) : (
            <>
              <TextField label={t('sup.field.productName')} value={draft.name} onChangeText={setField('name')} />
              <TextField label={t('dash.supplier.brand')} value={draft.brand} onChangeText={setField('brand')} />
              <SelectField
                label={t('dash.supplier.category')}
                value={draft.category}
                onChange={setField('category')}
                placeholder={t('dash.supplier.category')}
                options={supplierCategoryOptions.map((option) => ({ value: option, label: optionLabel(t, SUPPLIER_CATEGORY_KEYS, option) }))}
              />
              <TextField label={t('dash.supplier.size')} value={draft.size} onChangeText={setField('size')} />
              <SelectField
                label={t('dash.supplier.unit')}
                value={draft.unit}
                onChange={setField('unit')}
                placeholder={t('dash.supplier.selectUnit')}
                options={UNIT_OPTIONS.map((option) => ({ value: option, label: optionLabel(t, UNIT_LABEL_KEYS, option) }))}
              />
              <NumberField label={t('dash.supplier.price')} value={draft.price} onChangeText={setField('price')} prefix={currencySymbol(country)} />
              <BudgetInWords value={draft.price} country={country} />
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <NumberField label={t('dash.supplier.stock')} value={draft.quantity} onChangeText={setField('quantity')} />
                </View>
                <View style={{ flex: 1 }}>
                  <NumberField label={t('dash.supplier.lowStockThreshold')} value={draft.low_stock_threshold} onChangeText={setField('low_stock_threshold')} />
                </View>
              </View>
              <PublishSwitch value={draft.is_published} onChange={setField('is_published')} label={t('dash.supplier.published')} />
              <TextField label={t('shop.type')} value={draft.product_type} onChangeText={setField('product_type')} />
              <TextField label={t('shop.grade')} value={draft.grade} onChangeText={setField('grade')} />
              <TextField label={t('shop.description')} value={draft.description} onChangeText={setField('description')} multiline />
              <TextField label={t('shop.usage')} value={draft.usage} onChangeText={setField('usage')} />
              <TextField label={t('dash.supplier.features')} value={draft.features} onChangeText={setField('features')} placeholder={t('dash.supplier.featuresHint')} multiline />
            </>
          )}
          {saveError ? <Notice tone="error" text={saveError} /> : null}
          <View style={styles.buttons}>
            <ActionButton label={t('dash.common.cancel')} tone="outline" onPress={() => navigation.goBack()} disabled={saving} style={{ flex: 1 }} />
            <ActionButton
              label={saving ? t('reset.saving') : isCatalog ? t('dash.supplier.saveChanges') : t('dash.common.save')}
              icon={Save}
              onPress={saveChanges}
              busy={saving}
              disabled={isCatalog && catalog.status === 'loading'}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {/* Optional bulk pricing of this listing: its own Save. */}
        <View style={styles.bulk}>
          <Text style={styles.bulkTitle}>Bulk Pricing</Text>
          <BulkPricingPanel productId={product.id} unit={unitRecord?.name || product.unit} normalPrice={Number(product.price || 0)} country={country} />
        </View>
      </Section>
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  muted: { fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', color: c.textMuted },
  summary: { flexDirection: 'row', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 11 },
  summaryImage: { height: 84, width: 84, overflow: 'hidden', borderRadius: 11, backgroundColor: '#ffffff' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  brandText: { flex: 1, fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.4, color: c.brandText },
  title: { marginTop: 3, fontSize: 15.5, lineHeight: 20, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  priceRow: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 },
  price: { fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  was: { fontSize: 12, fontFamily: 'Inter_400Regular', color: c.textFaint, textDecorationLine: 'line-through' },
  off: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.brandTextSoft },
  availability: { marginTop: 3, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  tiles: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.5%', borderRadius: 11, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.subtle, paddingHorizontal: 11, paddingVertical: 9 },
  tileLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textFaint },
  tileValue: { marginTop: 3, fontSize: 13.5, fontFamily: 'Inter_700Bold', color: c.text },
  form: { marginTop: 16, gap: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  twoCol: { flexDirection: 'row', gap: 10 },
  readOnlyNote: { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  buttons: { marginTop: 4, flexDirection: 'row', gap: 10 },
  bulk: { marginTop: 16, gap: 10 },
  bulkTitle: { fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: c.text },
}))
