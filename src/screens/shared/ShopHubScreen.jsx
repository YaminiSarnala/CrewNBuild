// Shared Suppliers/Orders/Cart hub — the same journey the web gives both the
// House Owner (OwnerSupplierHub) and the Site Engineer (EngineerSupplierHub).
// The only role difference is where the checkout project comes from, so that
// arrives as props.
import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { PackageSearch, ShoppingBag, ShoppingCart, Plus, Minus,Building2, Trash2 } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchShopProducts } from '../../api/shop'
import { fetchMyMaterialRequests } from '../../api/materialRequests'
import {
  loadCart, addProductToCart, changeCartQuantity, removeProductFromCart,
  sendBuyRequest, selectCart, selectCartCount, clearCartMessage,
} from '../../store/cartSlice'
import { COLORS } from '../../theme/tokens'
import PropertyMarketSection from './PropertyMarketSection'
import { formatMoney, projectCountry } from '../../utils/countryConfig'
import { useProfileGate } from '../../hooks/useProfileGate'
import { createStyles } from '../../theme/createStyles'

export default function ShopHubScreen({ navigation, route, loadProjects, pickCheckoutProject, showProperty = false }) {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const { requireCompleteProfile } = useProfileGate()
  const cart = useSelector(selectCart)
  const cartCount = useSelector(selectCartCount)
  const [activeTab, setActiveTab] = useState(route?.params?.tab || 'suppliers')
  // Owner Home's quick actions open a particular sub-tab (e.g. Property).
  const requestedTab = route?.params?.tab
  useEffect(() => {
    if (!requestedTab) return
    setActiveTab(requestedTab)
    navigation.setParams({ tab: undefined })
  }, [requestedTab, navigation])
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [checkoutSupplierId, setCheckoutSupplierId] = useState(null)

  const products = useAsyncData(() => fetchShopProducts(), [])
  const orders = useAsyncData(fetchMyMaterialRequests, [])
  const projects = useAsyncData(loadProjects, [])

  const productList = Array.isArray(products.data) ? products.data : (products.data?.products || [])
  const orderList = Array.isArray(orders.data) ? orders.data : []
  const projectList = Array.isArray(projects.data) ? projects.data : []
  const checkoutProject = pickCheckoutProject(projectList)
  const checkoutProjectId = checkoutProject?.id
  const money = (value) => formatMoney(value, projectCountry(checkoutProject, user))

  // The cart is kept per project on the server (same as the web).
  useEffect(() => {
    if (checkoutProjectId) dispatch(loadCart(checkoutProjectId))
  }, [dispatch, checkoutProjectId])

  const filtered = search.trim()
    ? productList.filter((p) => `${p.name} ${p.category} ${p.brand}`.toLowerCase().includes(search.trim().toLowerCase()))
    : productList

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([products.reload(), orders.reload(), dispatch(loadCart())])
    } finally {
      setRefreshing(false)
    }
  }

  function addToCart(productId) {
    if (!checkoutProjectId) {
      Alert.alert('No project', 'You need a project linked to your account before adding materials.')
      return
    }
    dispatch(addProductToCart({ projectId: checkoutProjectId, productId, quantity: 1 }))
  }

  async function checkout(supplierId) {
    if (requireCompleteProfile(() => checkout(supplierId))) return
    if (checkoutSupplierId !== null) return
    if (!checkoutProject) {
      Alert.alert('No project', 'You need a project linked to your account before sending a buy request.')
      return
    }
    setCheckoutSupplierId(supplierId)
    try {
      const result = await dispatch(sendBuyRequest({
        projectId: checkoutProject.id,
        supplierId,
      }))
      if (sendBuyRequest.fulfilled.match(result)) {
        Alert.alert(
          'Buy request sent',
          result.payload?.request_code
            ? `Request code: ${result.payload.request_code}`
            : 'The supplier has been notified.'
        )
        dispatch(clearCartMessage())
        await orders.reload()
      } else {
        Alert.alert(
          'Could not send',
          result.payload || 'Unable to send the buy request.'
        )
      }
    } catch (error) {
      Alert.alert(
        'Could not send',
        error?.message || 'Unable to send the buy request. Please try again.'
      )
    } finally {
      setCheckoutSupplierId(null)
    }
  }

    const tabs = [
    { id: 'suppliers', label: 'Materials', icon: PackageSearch },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'cart', label: 'Cart', icon: ShoppingCart, badge: cartCount },
    ...(showProperty ? [{ id: 'property', label: 'Property', icon: Building2 }] : []),
  ]

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <View style={styles.view}>
        {tabs.map(({ id, label, icon: Icon, badge }) => {
          const active = activeTab === id
          return (
            <Pressable key={id} onPress={() => setActiveTab(id)} style={[styles.pressable, active ? styles.pressable2 : null]}>
              <Icon size={13} color={active ? '#fff' : COLORS.slate[400]} />
              <Text style={[styles.text, active ? styles.text2 : styles.text3]}>{label}</Text>
              {Boolean(badge) && (
                <View style={[styles.view2, active ? styles.view3 : styles.view4]}>
                  <Text style={[styles.text4, active ? styles.text2 : styles.text5]}>{badge}</Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>

      {activeTab === 'suppliers' && (
        <>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search cement, steel, bricks…"
            style={styles.textInput}
            placeholderTextColor={COLORS.slate[400]}
          />
          <PanelState loading={products.loading} error={products.error} empty={!filtered.length} emptyText="No products available to you yet.">
            {filtered.map((product) => (
              <View key={product.id} style={styles.view5}>
                <Text style={styles.text6} numberOfLines={1}>{product.name}</Text>
                <Text style={styles.text7} numberOfLines={1}>
                  {[product.brand, product.category, product.grade].filter(Boolean).join(' · ')}
                </Text>
                <View style={styles.view6}>
                  <View>
                    <Text style={styles.text8}>{money(product.price)}</Text>
                    <Text style={styles.text9}>per {product.unit || 'unit'}</Text>
                  </View>
                  <Pressable
                    onPress={() => addToCart(product.id)}
                    style={styles.pressable3}
                  >
                    <Plus size={14} color="#fff" />
                    <Text style={styles.text10}>Add to cart</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </PanelState>
        </>
      )}

      {activeTab === 'orders' && (
        <Panel title="My orders">
          <PanelState loading={orders.loading} error={orders.error} empty={!orderList.length} emptyText="No buy requests sent yet. Add products to your cart to get started.">
            {orderList.map((order) => (
              <View key={order.id} style={styles.view7}>
                <View style={styles.view8}>
                  <Text style={styles.text11} numberOfLines={1}>
                    {order.request_code || `Order #${order.id}`}
                  </Text>
                  <Text style={styles.text12}>{order.status || 'PENDING'}</Text>
                </View>
                <Text style={styles.text7} numberOfLines={1}>
                  {order.supplier_name || 'Supplier'}{order.total ? ` · ${money(order.total)}` : ''}
                </Text>
              </View>
            ))}
          </PanelState>
        </Panel>
      )}
      {activeTab === 'property' && <PropertyMarketSection />}
      {activeTab === 'cart' && (
        <Panel title={`Cart · ${money(cart.total)}`}>
          <PanelState loading={cart.status === 'loading' && !cart.items.length} error={cart.errorMessage} empty={!cart.items.length} emptyText="Your cart is empty. Browse suppliers to add materials.">
            {cart.items.map((item) => (
              <View key={item.id} style={styles.view9}>
                <View style={styles.view10}>
                  <Text style={styles.text13} numberOfLines={1}>{item.product_name || item.name}</Text>
                  <Text style={styles.text7}>{money(item.price)} × {item.quantity}</Text>
                </View>
                <Pressable onPress={() => dispatch(changeCartQuantity({ itemId: item.id, quantity: Math.max(1, item.quantity - 1) }))} style={styles.pressable4}>
                  <Minus size={13} color={COLORS.graphite} />
                </Pressable>
                <Text style={styles.text14}>{item.quantity}</Text>
                <Pressable onPress={() => dispatch(changeCartQuantity({ itemId: item.id, quantity: item.quantity + 1 }))} style={styles.pressable4}>
                  <Plus size={13} color={COLORS.graphite} />
                </Pressable>
                <Pressable onPress={() => dispatch(removeProductFromCart({ itemId: item.id }))} style={styles.pressable5}>
                  <Trash2 size={13} color="#e11d48" />
                </Pressable>
              </View>
            ))}
            {(cart.suppliers || []).map((supplier) => (
              <Pressable
                key={supplier.supplier_id || supplier.id}
                onPress={() => checkout(supplier.supplier_id || supplier.id)}
                disabled={checkoutSupplierId !== null}
                style={[styles.pressable7, checkoutSupplierId !== null ? styles.pressable8 : null]}
              >
                <Text style={styles.text16}>
                  {checkoutSupplierId === (supplier.supplier_id || supplier.id)
                    ? 'Sending request…'
                    : `Send buy request · ${supplier.supplier_name || supplier.name || 'Supplier'}`}
                </Text>
              </Pressable>
            ))}
          </PanelState>
        </Panel>
      )}
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 14, flexDirection: 'row', gap: 5.25, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 5.25 },
  pressable: { height: 35, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 10.5 },
  pressable2: { backgroundColor: '#1a5038' },
  text: { fontSize: 11, fontWeight: '800' },
  text2: { color: '#ffffff' },
  text3: { color: c.textMuted },
  view2: { height: 14, minWidth: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, paddingHorizontal: 3.5 },
  view3: { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  view4: { backgroundColor: c.brandSoftStrong },
  text4: { fontSize: 9, fontWeight: '800' },
  text5: { color: c.brandTextStrong },
  textInput: { marginBottom: 10.5, height: 38.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  view5: { marginBottom: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  text6: { fontSize: 15, fontWeight: '800', color: c.text },
  text7: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  view6: { marginTop: 8.75, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text8: { fontSize: 15.75, lineHeight: 24.5, fontWeight: '800', color: c.text },
  text9: { fontSize: 10, fontWeight: '600', color: c.textFaint },
  pressable3: { height: 35, flexDirection: 'row', alignItems: 'center', gap: 5.25, borderRadius: 9999, backgroundColor: '#1a5038', paddingHorizontal: 14 },
  text10: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: '#ffffff' },
  view7: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  view8: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text11: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
  text12: { fontSize: 10, fontWeight: '800', color: c.brandText },
  view9: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  view10: { flex: 1 },
  text13: { fontSize: 14, fontWeight: '800', color: c.text },
  pressable4: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: c.muted },
  text14: { width: 21, textAlign: 'center', fontSize: 14, fontWeight: '800', color: c.text },
  pressable5: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: c.roseSoft },
  pressable6: { marginTop: 10.5, height: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  text15: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  pressable7: { marginTop: 10.5, height: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#1a5038' },
  pressable8: { opacity: 0.6 },
  text16: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
}))
