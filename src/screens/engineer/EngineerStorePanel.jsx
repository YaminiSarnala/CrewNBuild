// The Site Engineer's Store — port of the web pages/engineer/EngineerStorePanel.jsx.
// Browse the builder's Store Manager's products for one assigned project, pick a
// product's size or variant, put it in a cart and send the cart as one request.
// The request goes to the Store Manager, never to a supplier. The cart is kept on
// this device per project and store; the request is what the server saves.
// What happens to a request is followed under Store Requests.
import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Image } from 'expo-image'
import { ClipboardList, Package, Search, ShoppingCart, Trash2, Truck } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useProfileGate } from '../../hooks/useProfileGate'
import { imageUrl } from '../../api/client'
import { createSiteRequest, refusalText } from '../../api/store'
import { quantityProblem } from '../../utils/quantityUnits'
import { STOCK_STATE_KEYS, formatQty, matchesSearch } from '../../utils/storeHelpers'
import { ActionButton, SelectChip, SheetModal } from '../../components/builder/BuilderUi'
import { toast } from '../../components/Toast'
import QuantityField from '../../components/QuantityField'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

const cartKey = (projectId, storeId) => `crewbuild.storeCart.${projectId}.${storeId}`
async function readCart(key) {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(key)) || '{}')
    return saved && typeof saved === 'object' ? saved : {}
  } catch {
    return {}
  }
}
function writeCart(key, cart) {
  const job = Object.keys(cart).length ? AsyncStorage.setItem(key, JSON.stringify(cart)) : AsyncStorage.removeItem(key)
  job.catch(() => {})
}

const STATE_TONES = { IN_STOCK: '#047857', LOW_STOCK: '#b45309', OUT_OF_STOCK: '#be123c' }

// One product as the engineer picks it: a name and brand, in one or more sizes.
const productKey = (item) => [item.name, item.brand || '', item.category || ''].map((value) => String(value).trim().toLowerCase()).join('|')
function groupProducts(items) {
  const groups = new Map()
  items.forEach((item) => {
    const key = productKey(item)
    if (!groups.has(key)) groups.set(key, { key, items: [] })
    groups.get(key).items.push(item)
  })
  return [...groups.values()]
}
const productTitle = (item, td) => `${td(item.name)}${item.variant ? ` · ${td(item.variant)}` : ''}`

function ProductImage({ item, large = false }) {
  const style = large ? styles.imageLarge : styles.imageSmall
  return item?.image_url
    ? <Image source={{ uri: imageUrl(item.image_url) }} style={style} contentFit="contain" />
    : <View style={[style, styles.imageEmpty]}><Package size={large ? 30 : 20} color={COLORS.slate[400]} /></View>
}

/** What the store holds, and, when the quantity asked is more, by how much it falls short. */
function StockLine({ item, quantity }) {
  const { t, td } = useLanguage()
  const asked = quantityProblem(quantity, item.unit) ? 0 : Number(quantity)
  const short = asked - Number(item.quantity)
  return (
    <View>
      <Text style={styles.small}>
             {t('store.requests.available', { quantity: `${formatQty(item.quantity)} ${td(item.unit)}` })}
        {item.stock_state ? <Text style={[styles.strong, { color: ink(STATE_TONES[item.stock_state]) }]}>{` · ${t(STOCK_STATE_KEYS[item.stock_state])}`}</Text> : null}
      </Text>
      {short > 0 ? <Text style={styles.short}>{t('store.engineer.cartShort', { quantity: `${formatQty(short)} ${td(item.unit)}` })}</Text> : null}
    </View>
  )
}

function Empty({ icon: Icon, title, body }) {
  return (
    <View style={styles.empty}>
      <Icon size={26} color={COLORS.slate[400]} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  )
}

export default function EngineerStorePanel({ projects, stores, activeProjectId, onProjectChange, onStoresChanged }) {
  const { t, td } = useLanguage()
  const { requireCompleteProfile } = useProfileGate()
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  // Cart lines whose quantity stopped the send: { [itemId]: message }.
  const [cartErrors, setCartErrors] = useState({})
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('products')
  const [openProduct, setOpenProduct] = useState(null)
  const [chosenId, setChosenId] = useState(null)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState('') // { field: 'variant'|'quantity', text } or ''
  const projectStores = stores.filter((store) => (store.project_ids || []).some((id) => String(id) === String(activeProjectId)))
  const [storeId, setStoreId] = useState('')
  const store = projectStores.find((item) => String(item.store_manager_id) === storeId) || projectStores[0]
  const storeItems = store?.items || []
  const categories = [...new Set(storeItems.map((item) => item.category).filter(Boolean))].sort()
  const shownProducts = groupProducts(storeItems.filter((item) => (!category || item.category === category) && matchesSearch(item, search)))
  const chosen = openProduct?.items.find((item) => item.id === chosenId) || null

  const key = store ? cartKey(activeProjectId, store.store_manager_id) : ''
  const [cart, setCart] = useState({})
  useEffect(() => {
    let current = true
    if (!key) { setCart({}); return undefined }
    readCart(key).then((saved) => { if (current) setCart(saved) })
    return () => { current = false }
  }, [key])
  const updateCart = (change) => setCart((current) => {
    const next = change(current)
    if (key) writeCart(key, next)
    return next
  })
  // Only products the store still lists; one it has since archived drops out.
  const cartLines = Object.entries(cart)
    .map(([itemId, quantity]) => ({ item: storeItems.find((item) => String(item.id) === itemId), quantity }))
    .filter((line) => line.item)
  const cartCount = cartLines.length

  // A Store Manager's change (new stock, an issue) reloads the stores' stock.
  useLiveRefresh(() => { onStoresChanged() })

  const openDetails = (product) => {
    const only = product.items.length === 1 ? product.items[0] : null
    setOpenProduct(product)
    setChosenId(only ? only.id : null)
    setDraft(only ? cart[only.id] || '' : '')
    setDraftError('')
  }
  const chooseVariant = (item) => {
    setChosenId(item.id)
    setDraft(cart[item.id] || '')
    setDraftError('')
  }
  const quantityMessage = (quantity, unit) => (quantityProblem(quantity, unit) === 'whole' ? t('store.quantityWhole', { unit: td(unit) }) : t('store.quantityInvalid'))
  const addToCart = () => {
    const problem = !chosen
      ? { field: 'variant', text: t('store.engineer.chooseVariant') }
      : quantityProblem(draft, chosen.unit) ? { field: 'quantity', text: quantityMessage(draft, chosen.unit) } : null
    if (problem) {
      setDraftError(problem)
      toast.error(problem.text)
      return
    }
    const name = productTitle(chosen, td)
    updateCart((current) => ({ ...current, [chosen.id]: String(draft).trim() }))
    setCartErrors((current) => ({ ...current, [chosen.id]: '' }))
    setOpenProduct(null)
    toast.success(t('store.engineer.addedToCart', { name }))
  }
  const setLineQuantity = (itemId, text) => {
    updateCart((current) => ({ ...current, [itemId]: text }))
    setCartErrors((current) => (current[itemId] ? { ...current, [itemId]: '' } : current))
  }
  const removeFromCart = (itemId) => updateCart((current) => {
    const next = { ...current }
    delete next[itemId]
    return next
  })

  const send = async () => {
    if (requireCompleteProfile(send)) return
    // Every line with a quantity its unit cannot take is highlighted at once.
    const wrongLines = cartLines.filter((line) => quantityProblem(line.quantity, line.item.unit))
    const wrong = wrongLines[0]
    setCartErrors(Object.fromEntries(wrongLines.map((line) => [line.item.id, quantityMessage(line.quantity, line.item.unit)])))
    if (!cartLines.length || wrong) {
      toast.error(wrongLines.length > 1
        ? t('cp.val.completeFields')
        : wrong ? `${productTitle(wrong.item, td)}: ${quantityMessage(wrong.quantity, wrong.item.unit)}` : t('store.quantityInvalid'))
      return
    }
    setSending(true)
    try {
      const saved = await createSiteRequest({
        project_id: activeProjectId,
        store_manager_id: store.store_manager_id,
        items: cartLines.map((line) => ({ item_id: Number(line.item.id), quantity: String(line.quantity).trim() })),
        note: note.trim() || null,
      })
      updateCart(() => ({}))
      setNote('')
      setView('products')
      toast.success(t('store.engineer.sentNumbered', { id: saved.public_request_id, name: td(saved.store_manager_name) }))
      onStoresChanged()
    } catch (error) {
      toast.error(refusalText(error, td, t('store.saveFailed')))
    } finally {
      setSending(false)
    }
  }

  const awaiting = store?.awaiting_receipt || 0
  const awaitingNote = awaiting > 0 ? (
    <View style={styles.awaiting}>
           <Truck size={16} color={ink('#0369a1')} />
      <View style={{ flex: 1 }}>
        <Text style={styles.awaitingTitle}>{t('store.engineer.awaitingTitle', { count: awaiting })}</Text>
        <Text style={styles.awaitingSub}>{t('store.engineer.awaitingSub')}</Text>
      </View>
    </View>
  ) : null

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{t('store.engineer.type')}</Text>
        {store && storeItems.length > 0 ? (
          <Pressable onPress={() => setView(view === 'cart' ? 'products' : 'cart')} style={[styles.cartButton, view === 'cart' ? styles.cartButtonOn : null]}>
            <ShoppingCart size={14} color={view === 'cart' ? '#ffffff' : COLORS.slate[600]} />
            <Text style={[styles.cartText, view === 'cart' ? styles.cartTextOn : null]}>{t('store.engineer.cart')}</Text>
            <View style={[styles.count, view === 'cart' ? styles.countOn : null]}><Text style={[styles.countText, view === 'cart' ? styles.cartTextOn : null]}>{cartCount}</Text></View>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.pickers}>
        <View style={styles.picker}>
          <Text style={styles.label}>{t('store.buy.project')}</Text>
          <SelectChip
            placeholder={t('store.buy.project')}
            value={activeProjectId != null ? String(activeProjectId) : ''}
            onChange={(value) => { onProjectChange(Number(value)); setView('products') }}
            options={projects.map((project) => ({ value: String(project.id), label: td(project.title) }))}
          />
        </View>
        {projectStores.length > 1 ? (
          <View style={styles.picker}>
            <Text style={styles.label}>{t('store.engineer.store')}</Text>
            <SelectChip
              placeholder={t('store.engineer.store')}
              value={store ? String(store.store_manager_id) : ''}
              onChange={(value) => { setStoreId(value); setView('products') }}
              options={projectStores.map((item) => ({ value: String(item.store_manager_id), label: td(item.store_manager_name) }))}
            />
          </View>
        ) : null}
      </View>

      {!store ? (
        // No Store Manager on this project's builder team: a request is never sent to a supplier instead.
        <View style={styles.alert}>
          <Text style={styles.alertTitle}>{t('store.engineer.noStoreManager')}</Text>
          <Text style={styles.alertBody}>{t('store.engineer.noStoreManagerSub')}</Text>
        </View>
      ) : !storeItems.length ? (
        <View>
          {awaitingNote}
          <Empty icon={ClipboardList} title={t('store.engineer.noItems')} body={t('store.engineer.noItemsSub')} />
        </View>
      ) : view === 'cart' ? (
        <View>
          <Text style={styles.small}>{t('store.engineer.cartFor', { name: td(store.store_manager_name) })}</Text>
          {cartLines.length ? (
            <View>
              <View style={styles.cartList}>
                {cartLines.map(({ item, quantity }) => (
                  <View key={item.id} style={[styles.cartRow, cartErrors[item.id] ? styles.cartRowInvalid : null]}>
                    <View style={styles.cartTop}>
                      <ProductImage item={item} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name} numberOfLines={2}>{productTitle(item, td)}</Text>
                        <Text style={styles.meta} numberOfLines={1}>{[item.brand, item.category].filter(Boolean).map((value) => td(value)).join(' · ')}</Text>
                        <StockLine item={item} quantity={quantity} />
                        {!quantityProblem(quantity, item.unit) ? <Text style={styles.requested}>{t('store.engineer.cartRequested', { quantity: `${formatQty(Number(quantity))} ${td(item.unit)}` })}</Text> : null}
                      </View>
                    </View>
                    <View style={styles.cartBottom}>
                      <QuantityField value={quantity} unit={item.unit} label={`${t('store.quantity')} ${productTitle(item, td)}`} onChange={(text) => setLineQuantity(item.id, text)} />
                      <Pressable onPress={() => removeFromCart(item.id)} accessibilityLabel={`${t('store.remove')} ${productTitle(item, td)}`} style={styles.iconButton}>
                        <Trash2 size={15} color={COLORS.slate[600]} />
                      </Pressable>
                    </View>
                    {cartErrors[item.id] && !String(quantity ?? '').trim() ? <Text style={styles.fieldError}>{cartErrors[item.id]}</Text> : null}
                  </View>
                ))}
              </View>
              <Text style={styles.meta}>{t('store.engineer.moreThanStock')}</Text>
              <TextInput value={note} onChangeText={setNote} placeholder={t('store.note')} placeholderTextColor={COLORS.slate[400]} maxLength={500} style={styles.input} />
              <View style={styles.actions}>
                <ActionButton small tone="outline" label={t('store.engineer.continueBrowsing')} onPress={() => setView('products')} />
                <ActionButton small label={sending ? t('dash.common.saving') : t('store.engineer.submitCart', { count: cartCount })} onPress={send} disabled={sending} busy={sending} />
              </View>
            </View>
          ) : (
            <Empty icon={ShoppingCart} title={t('store.engineer.cartEmpty')} body={t('store.engineer.cartEmptySub')} />
          )}
        </View>
      ) : (
        <View>
          {awaitingNote}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {['', ...categories].map((value) => (
              <Pressable key={value || 'all'} onPress={() => setCategory(value)} style={[styles.chip, category === value ? styles.chipOn : null]}>
                <Text style={[styles.chipText, category === value ? styles.chipTextOn : null]}>{value ? td(value) : t('store.engineer.allCategories')}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.search}>
            <Search size={15} color={COLORS.slate[400]} />
            <TextInput value={search} onChangeText={setSearch} placeholder={t('store.searchPlaceholder')} placeholderTextColor={COLORS.slate[400]} style={styles.searchInput} />
          </View>
          <View style={styles.grid}>
            {shownProducts.map((product) => {
              const first = product.items[0]
              const pictured = product.items.find((item) => item.image_url)
              const described = product.items.find((item) => item.description)
              const inCart = product.items.filter((item) => cart[item.id])
              return (
                <Pressable key={product.key} onPress={() => openDetails(product)} style={styles.card}>
                  <View style={styles.cardImage}>
                    {pictured
                      ? <Image source={{ uri: imageUrl(pictured.image_url) }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                      : <Package size={30} color={COLORS.slate[300]} />}
                    {inCart.length > 0 ? <Text style={styles.inCartBadge}>{t('store.engineer.inCartBadge')}</Text> : null}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.brand} numberOfLines={1}>{first.brand ? td(first.brand) : t('store.catalog.noBrand')}</Text>
                    <Text style={styles.cardName} numberOfLines={2}>{td(first.name)}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{[first.category, first.subcategory].filter(Boolean).map((value) => td(value)).join(' · ')}</Text>
                    {described ? <Text style={styles.meta} numberOfLines={2}>{td(described.description)}</Text> : null}
                    <View style={{ marginTop: 4, gap: 2 }}>
                      {product.items.map((item) => (
                        <Text key={item.id} style={styles.meta}>
                          {item.variant ? <Text style={styles.strongText}>{`${td(item.variant)}: `}</Text> : null}
                          {t('store.requests.available', { quantity: `${formatQty(item.quantity)} ${td(item.unit)}` })}
                          {item.stock_state ? <Text style={[styles.strong, { color: ink(STATE_TONES[item.stock_state]) }]}>{` · ${t(STOCK_STATE_KEYS[item.stock_state])}`}</Text> : null}                        </Text>
                      ))}
                    </View>
                    <Pressable onPress={() => openDetails(product)} style={styles.addButton}>
                      <ShoppingCart size={13} color="#ffffff" />
                      <Text style={styles.addText} numberOfLines={1}>
                        {inCart.length ? t('store.engineer.inCart', { quantity: inCart.map((item) => `${cart[item.id]} ${td(item.unit)}`).join(' + ') }) : t('store.engineer.addToCart')}
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </View>
      )}

      <SheetModal
        visible={Boolean(openProduct)}
        title={openProduct ? td(openProduct.items[0].name) : ''}
        subtitle={openProduct ? [openProduct.items[0].brand, openProduct.items[0].category].filter(Boolean).map((value) => td(value)).join(' · ') : ''}
        onClose={() => setOpenProduct(null)}
        footer={(
          <View style={styles.actions}>
            <ActionButton small tone="outline" label={t('store.engineer.close')} onPress={() => setOpenProduct(null)} />
            <ActionButton small icon={ShoppingCart} label={chosen && cart[chosen.id] ? t('store.engineer.updateCart') : t('store.engineer.addToCart')} onPress={addToCart} />
          </View>
        )}
      >
        {openProduct ? (
          <View>
            <ProductImage large item={chosen?.image_url ? chosen : openProduct.items.find((item) => item.image_url) || openProduct.items[0]} />
            {(chosen || openProduct.items[0]).description ? <Text style={styles.description}>{td((chosen || openProduct.items[0]).description)}</Text> : null}
            <Text style={[styles.label, { marginTop: 12 }]}>{t('store.engineer.variant')}</Text>
            <View style={styles.variants}>
              {openProduct.items.map((item) => (
                <Pressable key={item.id} onPress={() => chooseVariant(item)} accessibilityRole="radio" accessibilityState={{ checked: chosenId === item.id }} style={[styles.variant, chosenId === item.id ? styles.variantOn : null, draftError?.field === 'variant' ? styles.variantInvalid : null]}>
                  <Text style={[styles.variantText, chosenId === item.id ? styles.variantTextOn : null]}>{td(item.variant || item.unit)}</Text>
                  <Text style={styles.meta}>{`${formatQty(item.quantity)} ${td(item.unit)}`}</Text>
                </Pressable>
              ))}
            </View>
            {chosen ? (
              <View>
                <View style={styles.facts}>
                  <View style={styles.fact}><Text style={styles.label}>{t('store.catalog.unit')}</Text><Text style={styles.name}>{td(chosen.unit)}</Text></View>
                  <View style={styles.fact}><Text style={styles.label}>{t('store.engineer.inStore')}</Text><Text style={styles.name}>{`${formatQty(chosen.quantity)} ${td(chosen.unit)}`}</Text></View>
                </View>
                <Text style={[styles.label, { marginTop: 12 }]}>{t('store.engineer.quantityToRequest', { unit: td(chosen.unit) })}</Text>
                <View style={[{ marginTop: 4 }, draftError?.field === 'quantity' ? styles.quantityInvalid : null]}>
                  <QuantityField large value={draft} unit={chosen.unit} label={`${t('store.quantity')} ${productTitle(chosen, td)}`} onChange={(text) => { setDraft(text); setDraftError('') }} />
                </View>
                <View style={{ marginTop: 4 }}><StockLine item={chosen} quantity={draft} /></View>
              </View>
            ) : null}
            {draftError ? <Text style={styles.draftError}>{draftError.text}</Text> : null}
          </View>
        ) : null}
      </SheetModal>
    </View>
  )
}

const styles = createStyles((c) => ({
  panel: { gap: 10, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  panelTitle: { flex: 1, fontFamily: 'Manrope_800ExtraBold', fontSize: 16, color: c.text },
  cartButton: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10 },
  cartButtonOn: { borderColor: '#236645', backgroundColor: '#236645' },
  cartText: { fontSize: 12, fontWeight: '800', color: c.textSoft },
  cartTextOn: { color: '#ffffff' },
  count: { minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.brandSoft, paddingHorizontal: 5 },
  countOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  countText: { fontSize: 10, fontWeight: '800', color: c.brandTextStrong },
  pickers: { gap: 8 },
  picker: { gap: 4 },
  label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textSoft },
  alert: { borderRadius: 12, borderWidth: 1, borderColor: line('#fecdd3', '#e11d48'), backgroundColor: soft('#fff1f2', '#e11d48'), padding: 12 },
  alertTitle: { fontSize: 12.5, fontWeight: '800', color: ink('#9f1239') },
  alertBody: { marginTop: 2, fontSize: 12, fontWeight: '600', color: ink('#be123c') },
  awaiting: { marginBottom: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: line('#bae6fd', '#0369a1'), backgroundColor: soft('#f0f9ff', '#0369a1'), padding: 10 },
  awaitingTitle: { fontSize: 12, fontWeight: '800', color: ink('#0c4a6e') },
  awaitingSub: { fontSize: 12, fontWeight: '600', color: ink('#075985') },
  empty: { alignItems: 'center', gap: 4, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, paddingHorizontal: 14, paddingVertical: 24 },
  emptyTitle: { marginTop: 4, textAlign: 'center', fontSize: 14, fontWeight: '800', color: c.text },
  emptyBody: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: c.textMuted },
  small: { fontSize: 12, fontWeight: '600', color: c.textMuted },
  strong: { fontWeight: '800' },
  strongText: { fontWeight: '800', color: c.text },
  short: { fontSize: 12, fontWeight: '800', color: ink('#b45309') },
    meta: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  name: { fontSize: 13.5, fontWeight: '800', color: c.text },
  requested: { fontSize: 12, fontWeight: '800', color: c.text },
  cartList: { marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10 },
  cartRow: { gap: 8, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10 },
  cartRowInvalid: { marginVertical: 2, borderRadius: 12, borderWidth: 1, borderColor: '#dc2626', paddingHorizontal: 8 },
  fieldError: { fontSize: 11.5, fontWeight: '600', color: '#dc2626' },
  variantInvalid: { borderColor: '#dc2626' },
  quantityInvalid: { alignSelf: 'flex-start', borderRadius: 12, borderWidth: 1, borderColor: '#dc2626', padding: 2 },
  cartTop: { flexDirection: 'row', gap: 10 },
  cartBottom: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  iconButton: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border },
  input: { marginTop: 8, height: 40, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10, fontSize: 14, fontWeight: '600', color: c.text },
  actions: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  chips: { gap: 6, paddingBottom: 8 },
  chip: { height: 32, justifyContent: 'center', borderRadius: 999, backgroundColor: c.subtle, paddingHorizontal: 12 },
  chipOn: { backgroundColor: '#236645' },
  chipText: { fontSize: 12, fontWeight: '800', color: c.textSoft },
  chipTextOn: { color: '#ffffff' },
  search: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text },
  grid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  card: { width: '48.5%', overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  cardImage: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.subtle, padding: 6 },
  inCartBadge: { position: 'absolute', right: 6, top: 6, overflow: 'hidden', borderRadius: 6, backgroundColor: '#236645', paddingHorizontal: 6, paddingVertical: 2, fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', color: '#ffffff' },
  cardBody: { flex: 1, gap: 2, padding: 9 },
  brand: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.brandText },
  cardName: { fontSize: 12.5, fontWeight: '800', lineHeight: 16, color: c.text },
  addButton: { marginTop: 8, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 8, backgroundColor: '#236645', paddingHorizontal: 6 },
  addText: { flexShrink: 1, fontSize: 11, fontWeight: '800', color: '#ffffff' },
  imageSmall: { height: 56, width: 56, borderRadius: 8, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.subtle },
  imageLarge: { height: 160, width: '100%', borderRadius: 12, borderWidth: 1, borderColor: c.borderSoft, backgroundColor: c.subtle },
  imageEmpty: { alignItems: 'center', justifyContent: 'center' },
  description: { marginTop: 10, fontSize: 12, fontWeight: '500', color: c.textSoft },
  variants: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  variant: { borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 6 },
  variantOn: { borderColor: '#2e7d55', backgroundColor: c.brandSoft },
  variantText: { fontSize: 12, fontWeight: '800', color: c.textSoft },
  variantTextOn: { color: c.brandTextStrong },
  facts: { marginTop: 12, flexDirection: 'row', gap: 8 },
  fact: { flex: 1, borderRadius: 8, backgroundColor: c.subtle, padding: 8 },
  draftError: { marginTop: 8, fontSize: 11.5, fontWeight: '700', color: '#dc2626' },
}))