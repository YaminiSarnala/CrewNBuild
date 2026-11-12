// Pieces shared by the supplier's Products screens. Ports of the web
// pages/supplier/storefront/shared.js, ListingImage.jsx,
// components/catalog/BrandPicker.jsx (BrandLogo), PriceTag.jsx (validDiscount),
// CatalogMedia.jsx (unitQuantity) and BulkPricing.jsx (the editors), plus the
// dashboard's update / delete handlers for a listing.
//
// The web shows this catalogue copy in English; so does the app, except where
// the web itself uses a translation key.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, Switch, TextInput, ActivityIndicator } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Image } from 'expo-image'
import { Check, ImageOff, Minus, Plus, ShoppingCart, Tags, Trash2 } from 'lucide-react-native'
import { imageSource } from '../../../api/client'
import {
  deleteSupplierProduct, fetchBulkPricing, fetchSupplierProducts, saveBulkPricing, updateSupplierProduct,
} from '../../../api/supplierProducts'
import {
  clearPreviewCart, removeSupplierProduct, selectPreviewCart, selectSupplierProducts, selectSupplierProductsStatus,
  setPreviewCartQuantity, setSupplierProducts, setSupplierProductsFailed, upsertSupplierProduct,
} from '../../../store/supplierCatalogSlice'
import { discountedPrice, stockState } from '../../owner/marketplace/shopParts'
import { countryCurrency, formatMoney, userCountry } from '../../../utils/countryConfig'
import { useLanguage } from '../../../i18n/LanguageContext'
import { apiErrorText } from '../../../utils/builderHelpers'
import { COLORS } from '../../../theme/tokens'
import { createStyles } from '../../../theme/createStyles'

// ---------------------------------------------------------------- values

export const sellingPrice = (listing) => discountedPrice(listing.price, listing.discount_percentage)
export const discountOf = (listing) => Number(listing?.discount_percentage || 0)
export const money = (value, country) => formatMoney(Math.round(Number(value || 0) * 100) / 100, country)
export const sizeOf = (listing) => listing.size || listing.unit || ''
export const discountText = (discount) => `${Number(Number(discount).toFixed(2))}% OFF`

/** A discount as the form accepts it: '' or a number from 0 to 100. */
export function validDiscount(value) {
  if (String(value ?? '').trim() === '') return true
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 100
}

/** "12 Bags", "1 Bag", from a catalog unit record. */
export function unitQuantity(quantity, unit) {
  const amount = Number(quantity || 0)
  const formatted = amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  if (!unit) return formatted
  const name = amount === 1 ? unit.name : unit.plural_name || unit.name
  return `${formatted} ${name}`.trim()
}

/** Every typed word must appear in the listing's name, brand, category,
 *  subcategory or size. Runs over this supplier's own listings only. */
export const matchesWords = (listing, words) => {
  const haystack = [listing.name, listing.brand, listing.category, listing.subcategory_name, listing.size, listing.unit]
    .map((value) => String(value || '').toLowerCase())
    .join(' ')
  return String(words).toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word))
}

/** The listing state ProductDetailCard keys its wording on. */
export const listingStatus = (product) => {
  if (product.is_published === false) return 'Unpublished'
  const state = stockState(product.quantity, product.low_stock_threshold)
  return state === 'out' ? 'Out of Stock' : state === 'low' ? 'Low Stock' : 'Active'
}

export function useSupplierCountry() {
  const user = useSelector((state) => state.auth.user)
  return userCountry(user)
}

// ---------------------------------------------------------------- listings

/**
 * This supplier's listings (GET /supplier-products), kept in the
 * supplierCatalog slice so every Products screen reads the same rows, with the
 * dashboard's update and delete handlers.
 */
export function useSupplierListings() {
  const dispatch = useDispatch()
  const { t } = useLanguage()
  const products = useSelector(selectSupplierProducts)
  const status = useSelector(selectSupplierProductsStatus)

  const reload = useCallback(async () => {
    try {
      dispatch(setSupplierProducts(await fetchSupplierProducts()))
    } catch {
      dispatch(setSupplierProductsFailed())
    }
  }, [dispatch])

  // Returns { saved } or { error }, so the caller can tell the two apart.
  const update = useCallback(async (id, updates) => {
    try {
      const saved = await updateSupplierProduct(id, updates)
      dispatch(upsertSupplierProduct(saved))
      return { saved, message: t('dash.supplier.msg.catalogUpdated') }
    } catch (error) {
      return { error: apiErrorText(error, t('dash.supplier.msg.unableUpdate'), t) }
    }
  }, [dispatch, t])

  const remove = useCallback(async (id) => {
    try {
      await deleteSupplierProduct(id)
      dispatch(removeSupplierProduct(id))
      return { message: t('dash.supplier.msg.deleted') }
    } catch (error) {
      return { error: apiErrorText(error, t('dash.supplier.msg.unableRemove'), t) }
    }
  }, [dispatch, t])

  return { products, status, reload, update, remove }
}

/** The buyer-preview basket: never saved, never ordered. */
export function usePreviewCart(productList = []) {
  const dispatch = useDispatch()
  const basket = useSelector(selectPreviewCart)
  const lines = Object.entries(basket)
    .map(([id, quantity]) => ({ listing: productList.find((row) => String(row.id) === String(id)), quantity }))
    .filter((line) => line.listing)
  return {
    quantityOf: (id) => Number(basket[id] || 0),
    setQuantity: (id, quantity) => dispatch(setPreviewCartQuantity({ id, quantity })),
    clear: () => dispatch(clearPreviewCart()),
    lines,
    count: lines.length,
    total: lines.reduce((sum, line) => sum + sellingPrice(line.listing) * line.quantity, 0),
  }
}

// ---------------------------------------------------------------- pictures

/** A listing or catalog picture, or a neutral "No image yet" box. */
export function ProductImage({ src, height = 120, width = '100%', compact = false, padding = 6 }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  if (!src || broken) {
    return (
      <View style={[styles.noImage, { height, width }]}>
        <ImageOff size={compact ? 16 : 22} color={COLORS.slate[300]} />
        {!compact ? <Text style={styles.noImageText}>No image yet</Text> : null}
      </View>
    )
  }
  return (
    <Image
      source={imageSource(src)}
      style={{ height, width, padding }}
      contentFit="contain"
      onError={() => setBroken(true)}
    />
  )
}

/** A brand's logo, or its initials on a neutral tile. */
export function BrandLogo({ src, name = '', size = 28, round = false }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  const box = [styles.brandBox, { width: size, height: size, borderRadius: round ? size / 2 : Math.max(5, size / 5) }]
  if (src && !broken) {
    return (
      <View style={box}>
        <Image source={imageSource(src)} style={{ width: '82%', height: '82%' }} contentFit="contain" onError={() => setBroken(true)} />
      </View>
    )
  }
  const initials = String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
  return (
    <View style={box}>
      <Text style={[styles.brandInitials, { fontSize: Math.max(9, size / 3.2) }]}>{initials || '?'}</Text>
    </View>
  )
}

/** A catalog picture in a circle: a category, subcategory or product. */
export function CircleImage({ src, name, size = 84, fit = 'cover' }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  const circle = { width: size, height: size, borderRadius: size / 2 }
  if (src && !broken) {
    return (
      <View style={[styles.circle, circle]}>
        <Image
          source={imageSource(src)}
          style={fit === 'contain' ? { width: '78%', height: '78%' } : { width: '100%', height: '100%' }}
          contentFit={fit}
          onError={() => setBroken(true)}
        />
      </View>
    )
  }
  return (
    <View style={[styles.circle, styles.circleEmpty, circle]} accessibilityLabel={name}>
      <ImageOff size={22} color={COLORS.slate[300]} />
      <Text style={styles.noImageText}>No image</Text>
    </View>
  )
}

// ---------------------------------------------------------------- inputs

/** A number input with an optional currency prefix or % suffix. */
export function NumberField({ label, value, onChangeText, placeholder, prefix, suffix, decimal = true, error }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={[styles.inputBox, error ? styles.inputBoxError : null]}>
        {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
        <TextInput
          value={String(value ?? '')}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.slate[400]}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          style={styles.input}
          accessibilityLabel={label}
        />
        {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  )
}

/** Published — buyers can see it / Hidden — buyers cannot see it. */
export function PublishSwitch({ value, onChange, label }) {
  const on = value !== false
  return (
    <View style={styles.switchRow}>
      <Switch
        value={on}
        onValueChange={(next) => onChange(next)}
        trackColor={{ false: COLORS.slate[300], true: '#2e7d55' }}
        thumbColor="#ffffff"
        accessibilityLabel={label || 'Published'}
      />
      <Text style={styles.switchText}>
        {label || (on ? 'Published — buyers can see it' : 'Hidden — buyers cannot see it')}
      </Text>
    </View>
  )
}

export function CheckRow({ value, onChange, label, hint }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="checkbox" accessibilityState={{ checked: !!value }} style={styles.checkRow}>
      <View style={[styles.checkBox, value ? styles.checkBoxOn : null]}>
        {value ? <Check size={13} color="#ffffff" /> : null}
      </View>
      <Text style={styles.checkText}>{label}</Text>
      {hint ? <Text style={styles.checkHint}>{hint}</Text> : null}
    </Pressable>
  )
}

/** The currency symbol for price inputs ("₹", "KD"). */
export const currencySymbol = (country) => countryCurrency(country).symbol

// ---------------------------------------------------------------- buyer preview

/**
 * [ − N + ]  [ Add ] over the preview basket. Before adding, the stepper picks
 * how many; once added it edits the basket itself and the button reads "Added".
 */
export function QuantityAdd({ quantity, onChange, disabled, large = false }) {
  const [draft, setDraft] = useState(1)
  const inCart = quantity > 0
  const shown = inCart ? quantity : draft
  const step = (delta) => (inCart ? onChange(quantity + delta) : setDraft((value) => Math.max(1, value + delta)))
  const height = large ? 46 : 34
  return (
    <View style={styles.qtyRow}>
      <View style={[styles.stepper, { height, width: large ? 132 : 92 }]}>
        <Pressable onPress={() => step(-1)} disabled={disabled || (!inCart && draft <= 1)} accessibilityLabel="Decrease quantity" style={styles.stepButton}>
          <Minus size={14} color={disabled ? COLORS.slate[300] : COLORS.slate[600]} />
        </Pressable>
        <Text style={[styles.stepValue, { fontSize: large ? 15 : 13 }]}>{disabled ? 0 : shown}</Text>
        <Pressable onPress={() => step(1)} disabled={disabled} accessibilityLabel="Increase quantity" style={styles.stepButton}>
          <Plus size={14} color={disabled ? COLORS.slate[300] : COLORS.slate[600]} />
        </Pressable>
      </View>
      <Pressable
        onPress={() => { if (!inCart) onChange(draft) }}
        disabled={disabled}
        style={[styles.addButton, { height }, disabled ? styles.addDisabled : inCart ? styles.addDone : null]}
      >
        {disabled ? null : inCart ? <Check size={15} color={COLORS.brand[800]} /> : <ShoppingCart size={15} color="#ffffff" />}
        <Text style={[styles.addText, { fontSize: large ? 15 : 13 }, disabled ? styles.addTextDisabled : inCart ? styles.addTextDone : null]} numberOfLines={1}>
          {disabled ? 'Out of Stock' : inCart ? 'Added' : large ? 'Add To Cart' : 'Add'}
        </Text>
      </Pressable>
    </View>
  )
}

// ---------------------------------------------------------------- bulk pricing

const blankTier = () => ({ min_quantity: '', max_quantity: '', unit_price: '' })

/** The tiers as the API takes them: numbers, empty max = no upper limit. */
export const tiersForApi = (tiers = []) => tiers
  .filter((tier) => String(tier.min_quantity).trim() !== '' || String(tier.unit_price).trim() !== '')
  .map((tier) => ({
    min_quantity: Number(tier.min_quantity),
    max_quantity: String(tier.max_quantity ?? '').trim() === '' ? null : Number(tier.max_quantity),
    unit_price: Number(tier.unit_price),
  }))

/** The first problem in a set of tiers (the same rules the server applies), or ''. */
export function tierProblem(tiers = []) {
  const clean = tiersForApi(tiers)
  for (const [index, tier] of clean.entries()) {
    const n = index + 1
    if (!Number.isFinite(tier.min_quantity) || tier.min_quantity < 1) return `Tier ${n}: minimum quantity must be at least 1.`
    if (tier.max_quantity !== null && (!Number.isFinite(tier.max_quantity) || tier.max_quantity < tier.min_quantity)) return `Tier ${n}: maximum must be empty or at least the minimum.`
    if (!Number.isFinite(tier.unit_price) || tier.unit_price <= 0) return `Tier ${n}: price per unit must be greater than 0.`
  }
  const sorted = [...clean].sort((a, b) => a.min_quantity - b.min_quantity)
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]
    const current = sorted[i]
    if (current.min_quantity === previous.min_quantity) return `Two tiers start at ${current.min_quantity}.`
    if (previous.max_quantity === null || current.min_quantity <= previous.max_quantity) return 'Quantity ranges must not overlap.'
  }
  return ''
}

/** "Offer bulk pricing" + Min / Max / Price rows, for an existing listing. */
export function BulkPricingEditor({ enabled, onToggle, tiers, onChange, unit = '', normalPrice = null, country }) {
  const set = (index, key) => (value) => onChange(tiers.map((tier, i) => (i === index ? { ...tier, [key]: value } : tier)))
  const problem = enabled ? tierProblem(tiers) : ''
  return (
    <View style={styles.bulkBox}>
      <CheckRow value={enabled} onChange={onToggle} label="Offer bulk pricing" hint="Optional" />
      {!enabled ? (
        <Text style={styles.bulkHint}>
          {`No bulk pricing: every quantity sells at your normal price${normalPrice != null ? ` (${money(normalPrice, country)}${unit ? ` / ${unit}` : ''})` : ''}.`}
        </Text>
      ) : (
        <View style={{ marginTop: 10, gap: 8 }}>
          {tiers.map((tier, index) => (
            <View key={index} style={styles.tierCard}>
              <View style={styles.tierRow}>
                <View style={{ flex: 1 }}>
                  <NumberField label="Minimum qty" value={tier.min_quantity} onChangeText={set(index, 'min_quantity')} placeholder="10" />
                </View>
                <View style={{ flex: 1 }}>
                  <NumberField label="Maximum qty" value={tier.max_quantity ?? ''} onChangeText={set(index, 'max_quantity')} placeholder="No limit" />
                </View>
              </View>
              <View style={styles.tierRow}>
                <View style={{ flex: 1 }}>
                  <NumberField label={`Price / ${unit || 'unit'}`} value={tier.unit_price} onChangeText={set(index, 'unit_price')} prefix={currencySymbol(country)} />
                </View>
                <Pressable onPress={() => onChange(tiers.filter((_, i) => i !== index))} accessibilityLabel={`Remove tier ${index + 1}`} style={styles.tierRemove}>
                  <Trash2 size={16} color="#be123c" />
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable onPress={() => onChange([...tiers, blankTier()])} style={styles.addTier}>
            <Plus size={14} color={COLORS.brand[800]} />
            <Text style={styles.addTierText}>Add Bulk Tier</Text>
          </Pressable>
          <Text style={styles.bulkHint}>Leave Maximum empty for “and above”. A quantity not covered by a tier sells at your normal price.</Text>
          {problem ? <Text style={styles.problem}>{problem}</Text> : null}
        </View>
      )}
    </View>
  )
}

/** The editor wired to GET/PUT /supplier-products/{id}/bulk-pricing, with its own Save. */
export function BulkPricingPanel({ productId, unit = '', normalPrice = null, country }) {
  const [enabled, setEnabled] = useState(false)
  const [tiers, setTiers] = useState([blankTier()])
  const [state, setState] = useState({ loading: true, saving: false, tone: '', text: '' })

  useEffect(() => {
    let live = true
    fetchBulkPricing(productId)
      .then((data) => {
        if (!live) return
        const rows = data?.tiers || []
        setEnabled(rows.length > 0)
        setTiers(rows.length ? rows.map((tier) => ({
          min_quantity: String(tier.min_quantity),
          max_quantity: tier.max_quantity == null ? '' : String(tier.max_quantity),
          unit_price: String(tier.unit_price),
        })) : [blankTier()])
        setState((current) => ({ ...current, loading: false }))
      })
      .catch((failure) => live && setState({ loading: false, saving: false, tone: 'error', text: failure?.response?.data?.detail || 'Bulk pricing could not be loaded.' }))
    return () => { live = false }
  }, [productId])

  const save = async () => {
    const problem = enabled ? tierProblem(tiers) : ''
    if (problem) { setState((current) => ({ ...current, tone: 'error', text: problem })); return }
    setState((current) => ({ ...current, saving: true, tone: '', text: '' }))
    try {
      const saved = await saveBulkPricing(productId, enabled ? tiersForApi(tiers) : [])
      const count = saved?.tiers?.length || 0
      setState({ loading: false, saving: false, tone: 'success', text: count ? `Bulk pricing saved (${count} tier${count === 1 ? '' : 's'}).` : 'Bulk pricing turned off.' })
    } catch (failure) {
      setState({ loading: false, saving: false, tone: 'error', text: failure?.response?.data?.detail || 'Bulk pricing could not be saved.' })
    }
  }

  if (state.loading) {
    return (
      <View style={styles.inlineLoading}>
        <ActivityIndicator size="small" color={COLORS.brand[700]} />
        <Text style={styles.bulkHint}>Loading bulk pricing…</Text>
      </View>
    )
  }
  return (
    <View style={{ gap: 8 }}>
      <BulkPricingEditor enabled={enabled} onToggle={setEnabled} tiers={tiers} onChange={setTiers} unit={unit} normalPrice={normalPrice} country={country} />
      <View style={styles.bulkSaveRow}>
        <Pressable onPress={save} disabled={state.saving} style={[styles.bulkSave, state.saving ? { opacity: 0.6 } : null]}>
          {state.saving ? <ActivityIndicator size="small" color="#ffffff" /> : <Tags size={14} color="#ffffff" />}
          <Text style={styles.bulkSaveText}>Save bulk pricing</Text>
        </Pressable>
        {state.text ? <Text style={[styles.bulkState, state.tone === 'error' ? styles.bulkStateError : styles.bulkStateOk]}>{state.text}</Text> : null}
      </View>
    </View>
  )
}

// Add Product's simple form: "from this quantity, this price". Saved as
// ranges: each tier runs up to one below the next tier's minimum; the last is open.
export const blankSimpleTier = () => ({ min_quantity: '', unit_price: '' })
const filledSimple = (tiers = []) => tiers.filter((tier) => String(tier.min_quantity).trim() !== '' || String(tier.unit_price).trim() !== '')
export const sortedSimpleTiers = (tiers = []) => filledSimple(tiers)
  .map((tier) => ({ min_quantity: Number(tier.min_quantity), unit_price: Number(tier.unit_price) }))
  .sort((a, b) => a.min_quantity - b.min_quantity)
export const simpleTiersForApi = (tiers = []) => {
  const sorted = sortedSimpleTiers(tiers)
  return sorted.map((tier, index) => ({
    min_quantity: tier.min_quantity,
    max_quantity: index < sorted.length - 1 ? sorted[index + 1].min_quantity - 1 : null,
    unit_price: tier.unit_price,
  }))
}

export function simpleTierProblem(tiers = [], normalPrice = null) {
  const rows = filledSimple(tiers)
  if (!rows.length) return 'Add at least one pricing tier, or turn bulk pricing off.'
  for (const [index, tier] of rows.entries()) {
    const minimum = Number(tier.min_quantity)
    const price = Number(tier.unit_price)
    const n = index + 1
    if (String(tier.min_quantity).trim() === '' || !Number.isFinite(minimum) || minimum <= 1) return `Tier ${n}: minimum quantity must be greater than 1.`
    if (String(tier.unit_price).trim() === '' || !Number.isFinite(price) || price <= 0) return `Tier ${n}: bulk price must be greater than 0.`
    if (normalPrice != null && Number.isFinite(normalPrice) && normalPrice > 0 && price >= normalPrice) return `Tier ${n}: bulk price must be lower than your selling price.`
  }
  const sorted = sortedSimpleTiers(tiers)
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].min_quantity === sorted[i - 1].min_quantity) return `Two tiers start at ${sorted[i].min_quantity}. Each tier needs its own minimum quantity.`
    if (sorted[i].unit_price > sorted[i - 1].unit_price) return `The ${sorted[i].min_quantity}+ price should not be higher than the ${sorted[i - 1].min_quantity}+ price.`
  }
  return ''
}

export function BulkTierBuilder({ enabled, onToggle, tiers, onChange, unit = '', normalPrice = null, country }) {
  const set = (index, key) => (value) => onChange(tiers.map((tier, i) => (i === index ? { ...tier, [key]: value } : tier)))
  const problem = enabled ? simpleTierProblem(tiers, normalPrice) : ''
  const preview = sortedSimpleTiers(tiers).filter((tier) => tier.min_quantity > 1 && tier.unit_price > 0)
  const per = unit ? ` / ${unit}` : ''
  return (
    <View style={{ gap: 10 }}>
      <CheckRow value={enabled} onChange={onToggle} label="Offer bulk pricing" />
      {!enabled ? (
        <Text style={styles.bulkHint}>Every quantity sells at your normal selling price.</Text>
      ) : (
        <>
          {tiers.map((tier, index) => (
            <View key={index} style={[styles.tierCard, styles.tierRow]}>
              <View style={{ flex: 1 }}>
                <NumberField
                  label="Minimum quantity"
                  value={tier.min_quantity}
                  onChangeText={set(index, 'min_quantity')}
                  placeholder="10"
                  decimal={false}
                  suffix={`+${unit ? ` ${unit}` : ''}`}
                />
              </View>
              <View style={{ flex: 1 }}>
                <NumberField label={`Price / ${unit || 'unit'}`} value={tier.unit_price} onChangeText={set(index, 'unit_price')} placeholder="250" prefix={currencySymbol(country)} />
              </View>
              <Pressable
                onPress={() => onChange(tiers.length > 1 ? tiers.filter((_, i) => i !== index) : [blankSimpleTier()])}
                accessibilityLabel={`Remove tier ${index + 1}`}
                style={styles.tierRemove}
              >
                <Trash2 size={16} color="#be123c" />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => onChange([...tiers, blankSimpleTier()])} style={styles.addTier}>
            <Plus size={14} color={COLORS.brand[800]} />
            <Text style={styles.addTierText}>Add pricing tier</Text>
          </Pressable>
          {problem ? <Text style={styles.problem}>{problem}</Text> : null}
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>BUYERS WILL SEE</Text>
            <Text style={styles.previewLine}>
              {'Normal price: '}
              <Text style={styles.previewStrong}>{normalPrice != null && normalPrice > 0 ? `${money(normalPrice, country)}${per}` : '—'}</Text>
            </Text>
            {preview.length ? preview.map((tier) => (
              <Text key={tier.min_quantity} style={styles.previewLine}>
                {`${tier.min_quantity}+${unit ? ` ${unit}` : ''} → `}
                <Text style={styles.previewBrand}>{`${money(tier.unit_price, country)}${per}`}</Text>
              </Text>
            )) : <Text style={styles.bulkHint}>Add a minimum quantity and a price to see the tiers here.</Text>}
          </View>
        </>
      )}
    </View>
  )
}

const styles = createStyles((c) => ({
  noImage: { alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: c.subtle, borderRadius: 10 },
  noImageText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  brandBox: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: '#ffffff' },
  brandInitials: { fontFamily: 'Inter_700Bold', color: COLORS.slate[400] },
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#ffffff' },
  circleEmpty: { gap: 3, backgroundColor: c.subtle },
  field: { gap: 5 },
  fieldLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textMuted },
  inputBox: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12 },
  inputBoxError: { borderColor: '#f43f5e' },
  input: { flex: 1, height: '100%', fontSize: 14, fontFamily: 'Inter_600SemiBold', color: c.text },
  affix: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.textFaint },
  fieldError: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: c.roseText },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchText: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.text },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', minHeight: 32 },
  checkBox: { height: 20, width: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 5, borderWidth: 1.5, borderColor: c.borderStrong, backgroundColor: c.card },
  checkBoxOn: { borderColor: '#2e7d55', backgroundColor: '#2e7d55' },
  checkText: { fontSize: 13.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  checkHint: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 9, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  stepButton: { height: '100%', width: 30, alignItems: 'center', justifyContent: 'center' },
  stepValue: { flex: 1, textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.text },
  addButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 9, backgroundColor: '#236645', paddingHorizontal: 8 },
  addDone: { borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft },
  addDisabled: { backgroundColor: c.mutedStronger },
  addText: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  addTextDone: { color: c.brandTextStrong },
  addTextDisabled: { color: c.textMuted },
  bulkBox: { borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 12 },
  bulkHint: { fontSize: 11.5, lineHeight: 16, fontFamily: 'Inter_400Regular', color: c.textMuted },
  tierCard: { borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10, gap: 8 },
  tierRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  tierRemove: { height: 44, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  addTier: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', height: 36, borderRadius: 9, borderWidth: 1, borderStyle: 'dashed', borderColor: c.brandBorderStrong, paddingHorizontal: 12 },
  addTierText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  problem: { borderRadius: 9, backgroundColor: c.roseSoft, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.roseText },
  preview: { borderRadius: 11, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft, paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
  previewLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', letterSpacing: 0.4, color: c.brandTextStrong },
  previewLine: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.text },
  previewStrong: { fontFamily: 'Inter_700Bold', color: c.text },
  previewBrand: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  bulkSaveRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  bulkSave: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, borderRadius: 10, backgroundColor: '#236645', paddingHorizontal: 14 },
  bulkSaveText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  bulkState: { flexShrink: 1, fontSize: 12, fontFamily: 'Inter_700Bold' },
  bulkStateError: { color: c.roseText },
  bulkStateOk: { color: c.emeraldText },
}))
