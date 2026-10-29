// Shared Suppliers/Orders/Cart hub — the same journey the web gives both the
// House Owner (OwnerSupplierHub) and the Site Engineer (EngineerSupplierHub).
// The only role difference is where the checkout project comes from, so that
// arrives as props.
import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, Alert } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import PropertyMarketSection from './ropertyMarketSection'
import { PackageSearch, ShoppingBag, ShoppingCart, Plus, Minus,Building2, Trash2 } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchShopProducts } from '../../api/shop'
import { fetchMyMaterialRequests } from '../../api/materialRequests'
import {
  loadCart, addProductToCart, changeCartQuantity, removeProductFromCart,
  sendBuyRequest, selectCart, selectCartCount, clearCartMessage,
} from '../../store/cartSlice'
import { COLORS } from '../../theme/tokens'

const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`

export default function ShopHubScreen({ navigation, loadProjects, pickCheckoutProject, showProperty = false }) {  const dispatch = useDispatch()
  const cart = useSelector(selectCart)
  const cartCount = useSelector(selectCartCount)
  const [activeTab, setActiveTab] = useState('suppliers')
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [checkoutSupplierId, setCheckoutSupplierId] = useState(null)

  const products = useAsyncData(() => fetchShopProducts(), [])
  const orders = useAsyncData(fetchMyMaterialRequests, [])
  const projects = useAsyncData(loadProjects, [])

  useEffect(() => { dispatch(loadCart()) }, [dispatch])

  const productList = Array.isArray(products.data) ? products.data : (products.data?.products || [])
  const orderList = Array.isArray(orders.data) ? orders.data : []
  const projectList = Array.isArray(projects.data) ? projects.data : []
  const checkoutProject = pickCheckoutProject(projectList)

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

  async function checkout(supplierId) {
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
      <View className="mb-4 flex-row gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5">
        {tabs.map(({ id, label, icon: Icon, badge }) => {
          const active = activeTab === id
          return (
            <Pressable key={id} onPress={() => setActiveTab(id)} className={`h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl ${active ? 'bg-brand-700' : ''}`}>
              <Icon size={13} color={active ? '#fff' : COLORS.slate[400]} />
              <Text className={`text-[11px] font-extrabold ${active ? 'text-white' : 'text-slate-500'}`}>{label}</Text>
              {Boolean(badge) && (
                <View className={`h-4 min-w-4 items-center justify-center rounded-full px-1 ${active ? 'bg-white/25' : 'bg-brand-100'}`}>
                  <Text className={`text-[9px] font-extrabold ${active ? 'text-white' : 'text-brand-800'}`}>{badge}</Text>
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
            className="mb-3 h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite"
            placeholderTextColor={COLORS.slate[400]}
          />
          <PanelState loading={products.loading} error={products.error} empty={!filtered.length} emptyText="No products available to you yet.">
            {filtered.map((product) => (
              <View key={product.id} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
                <Text className="text-[15px] font-extrabold text-graphite" numberOfLines={1}>{product.name}</Text>
                <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>
                  {[product.brand, product.category, product.grade].filter(Boolean).join(' · ')}
                </Text>
                <View className="mt-2.5 flex-row items-center justify-between">
                  <View>
                    <Text className="text-lg font-extrabold text-graphite">{inr(product.price)}</Text>
                    <Text className="text-[10px] font-semibold text-slate-400">per {product.unit || 'unit'}</Text>
                  </View>
                  <Pressable
                    onPress={() => dispatch(addProductToCart({ productId: product.id, quantity: 1 }))}
                    className="h-10 flex-row items-center gap-1.5 rounded-full bg-brand-700 px-4"
                  >
                    <Plus size={14} color="#fff" />
                    <Text className="text-xs font-extrabold text-white">Add to cart</Text>
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
              <View key={order.id} className="border-b border-slate-100 py-3">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[14px] font-extrabold text-graphite" numberOfLines={1}>
                    {order.request_code || `Order #${order.id}`}
                  </Text>
                  <Text className="text-[10px] font-extrabold text-brand-700">{order.status || 'PENDING'}</Text>
                </View>
                <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>
                  {order.supplier_name || 'Supplier'}{order.total ? ` · ${inr(order.total)}` : ''}
                </Text>
              </View>
            ))}
          </PanelState>
        </Panel>
      )}
      {activeTab === 'property' && <PropertyMarketSection />}
      {activeTab === 'cart' && (
        <Panel title={`Cart · ${inr(cart.total)}`}>
          <PanelState loading={cart.status === 'loading' && !cart.items.length} error={cart.errorMessage} empty={!cart.items.length} emptyText="Your cart is empty. Browse suppliers to add materials.">
            {cart.items.map((item) => (
              <View key={item.id} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
                <View className="flex-1">
                  <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>{item.product_name || item.name}</Text>
                  <Text className="mt-0.5 text-xs font-semibold text-slate-500">{inr(item.price)} × {item.quantity}</Text>
                </View>
                <Pressable onPress={() => dispatch(changeCartQuantity({ itemId: item.id, quantity: Math.max(1, item.quantity - 1) }))} className="h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                  <Minus size={13} color={COLORS.graphite} />
                </Pressable>
                <Text className="w-6 text-center text-[14px] font-extrabold text-graphite">{item.quantity}</Text>
                <Pressable onPress={() => dispatch(changeCartQuantity({ itemId: item.id, quantity: item.quantity + 1 }))} className="h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                  <Plus size={13} color={COLORS.graphite} />
                </Pressable>
                <Pressable onPress={() => dispatch(removeProductFromCart({ itemId: item.id }))} className="h-8 w-8 items-center justify-center rounded-full bg-rose-50">
                  <Trash2 size={13} color="#e11d48" />
                </Pressable>
              </View>
            ))}
            {(cart.suppliers || []).map((supplier) => (
              <Pressable
                key={supplier.supplier_id || supplier.id}
                onPress={() => checkout(supplier.supplier_id || supplier.id)}
                disabled={checkoutSupplierId !== null}
                className={`mt-3 h-11 items-center justify-center rounded-xl bg-brand-700 ${
                  checkoutSupplierId !== null ? 'opacity-60' : ''
                }`}
              >
                <Text className="text-[13px] font-extrabold text-white">
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