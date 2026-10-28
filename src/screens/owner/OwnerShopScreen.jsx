// // Port of web OwnerSupplierHub.jsx + shop components: browse products
// // (fetchShopProducts), Orders (fetchMyMaterialRequests), Cart (existing
// // cartSlice thunks). Buy requests go per supplier, tied to the first
// // SELF_CONSTRUCTION project — same rule as the web hub.
// import { useEffect, useState } from 'react'
// import { View, Text, Pressable, TextInput, Alert } from 'react-native'
// import { useDispatch, useSelector } from 'react-redux'
// import { PackageSearch, ShoppingBag, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react-native'
// import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
// import { fetchShopProducts } from '../../api/shop'
// import { fetchMyMaterialRequests } from '../../api/materialRequests'
// import { fetchOwnerProjects } from '../../api/projects'
// import {
//   loadCart, addProductToCart, changeCartQuantity, removeProductFromCart,
//   sendBuyRequest, selectCart, selectCartCount, clearCartMessage,
// } from '../../store/cartSlice'
// import { COLORS } from '../../theme/tokens'

// const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`

// export default function OwnerShopScreen({ navigation }) {
//   const dispatch = useDispatch()
//   const cart = useSelector(selectCart)
//   const cartCount = useSelector(selectCartCount)
//   const [activeTab, setActiveTab] = useState('suppliers')
//   const [refreshing, setRefreshing] = useState(false)
//   const [search, setSearch] = useState('')

//   const products = useAsyncData(() => fetchShopProducts(), [])
//   const orders = useAsyncData(fetchMyMaterialRequests, [])
//   const projects = useAsyncData(fetchOwnerProjects, [])

//   useEffect(() => { dispatch(loadCart()) }, [dispatch])

//   const productList = Array.isArray(products.data) ? products.data : (products.data?.products || [])
//   const orderList = Array.isArray(orders.data) ? orders.data : []
//   const projectList = Array.isArray(projects.data) ? projects.data : []
//   const checkoutProject = projectList.find((p) => p.construction_type === 'SELF_CONSTRUCTION') || projectList[0] || null

//   const filtered = search.trim()
//     ? productList.filter((p) => `${p.name} ${p.category} ${p.brand}`.toLowerCase().includes(search.trim().toLowerCase()))
//     : productList

//   const onRefresh = async () => {
//     setRefreshing(true)
//     await Promise.all([products.reload(), orders.reload(), dispatch(loadCart())])
//     setRefreshing(false)
//   }

//   async function checkout(supplierId) {
//     if (!checkoutProject) {
//       Alert.alert('No project', 'Create a self-construction project first so the supplier knows the delivery site.')
//       return
//     }
//     const result = await dispatch(sendBuyRequest({ projectId: checkoutProject.id, supplierId }))
//     if (sendBuyRequest.fulfilled.match(result)) {
//       Alert.alert('Buy request sent', result.payload?.request_code ? `Request code: ${result.payload.request_code}` : 'The supplier has been notified.')
//       dispatch(clearCartMessage())
//       orders.reload()
//     } else {
//       Alert.alert('Could not send', result.payload || 'Unable to send the buy request.')
//     }
//   }

//   const tabs = [
//     { id: 'suppliers', label: 'Suppliers', icon: PackageSearch },
//     { id: 'orders', label: 'Orders', icon: ShoppingBag },
//     { id: 'cart', label: 'Cart', icon: ShoppingCart, badge: cartCount },
//   ]

//   return (
//     <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
//       {/* Sub-tab strip — same three tabs as web OwnerSupplierHub */}
//       <View style={styles.view}>
//         {tabs.map(({ id, label, icon: Icon, badge }) => {
//           const active = activeTab === id
//           return (
//             <Pressable key={id} onPress={() => setActiveTab(id)} style={[styles.pressable, active ? styles.pressable2 : null]}>
//               <Icon size={13} color={active ? '#fff' : COLORS.slate[400]} />
//               <Text style={[styles.text, active ? styles.text2 : styles.text3]}>{label}</Text>
//               {Boolean(badge) && (
//                 <View style={[styles.view2, active ? styles.view3 : styles.view4]}>
//                   <Text style={[styles.text4, active ? styles.text2 : styles.text5]}>{badge}</Text>
//                 </View>
//               )}
//             </Pressable>
//           )
//         })}
//       </View>

//       {activeTab === 'suppliers' && (
//         <>
//           <TextInput
//             value={search}
//             onChangeText={setSearch}
//             placeholder="Search cement, steel, bricks…"
//             style={styles.textInput}
//             placeholderTextColor={COLORS.slate[400]}
//           />
//           <PanelState loading={products.loading} error={products.error} empty={!filtered.length} emptyText="No products available from suppliers near you yet.">
//             {filtered.map((product) => (
//               <View key={product.id} style={styles.view5}>
//                 <Text style={styles.text6} numberOfLines={1}>{product.name}</Text>
//                 <Text style={styles.text7} numberOfLines={1}>
//                   {[product.brand, product.category, product.grade].filter(Boolean).join(' · ')}
//                 </Text>
//                 <View style={styles.view6}>
//                   <View>
//                     <Text style={styles.text8}>{inr(product.price)}</Text>
//                     <Text style={styles.text9}>per {product.unit || 'unit'}</Text>
//                   </View>
//                   <Pressable
//                     onPress={() => dispatch(addProductToCart({ productId: product.id, quantity: 1 }))}
//                     style={styles.pressable3}
//                   >
//                     <Plus size={14} color="#fff" />
//                     <Text style={styles.text10}>Add to cart</Text>
//                   </Pressable>
//                 </View>
//               </View>
//             ))}
//           </PanelState>
//         </>
//       )}

//       {activeTab === 'orders' && (
//         <Panel title="My orders">
//           <PanelState loading={orders.loading} error={orders.error} empty={!orderList.length} emptyText="No buy requests sent yet. Add products to your cart to get started.">
//             {orderList.map((order) => (
//               <View key={order.id} style={styles.view7}>
//                 <View style={styles.view8}>
//                   <Text style={styles.text11} numberOfLines={1}>
//                     {order.request_code || `Order #${order.id}`}
//                   </Text>
//                   <Text style={styles.text12}>{order.status || 'PENDING'}</Text>
//                 </View>
//                 <Text style={styles.text7} numberOfLines={1}>
//                   {order.supplier_name || 'Supplier'}{order.total ? ` · ${inr(order.total)}` : ''}
//                 </Text>
//               </View>
//             ))}
//           </PanelState>
//         </Panel>
//       )}

//       {activeTab === 'cart' && (
//         <Panel title={`Cart · ${inr(cart.total)}`}>
//           <PanelState loading={cart.status === 'loading' && !cart.items.length} error={cart.errorMessage} empty={!cart.items.length} emptyText="Your cart is empty. Browse suppliers to add materials.">
//             {cart.items.map((item) => (
//               <View key={item.id} style={styles.view9}>
//                 <View style={styles.view10}>
//                   <Text style={styles.text13} numberOfLines={1}>{item.product_name || item.name}</Text>
//                   <Text style={styles.text7}>{inr(item.price)} × {item.quantity}</Text>
//                 </View>
//                 <Pressable onPress={() => dispatch(changeCartQuantity({ itemId: item.id, quantity: Math.max(1, item.quantity - 1) }))} style={styles.pressable4}>
//                   <Minus size={13} color={COLORS.graphite} />
//                 </Pressable>
//                 <Text style={styles.text14}>{item.quantity}</Text>
//                 <Pressable onPress={() => dispatch(changeCartQuantity({ itemId: item.id, quantity: item.quantity + 1 }))} style={styles.pressable4}>
//                   <Plus size={13} color={COLORS.graphite} />
//                 </Pressable>
//                 <Pressable onPress={() => dispatch(removeProductFromCart({ itemId: item.id }))} style={styles.pressable5}>
//                   <Trash2 size={13} color="#e11d48" />
//                 </Pressable>
//               </View>
//             ))}
//             {(cart.suppliers || []).map((supplier) => (
//               <Pressable
//                 key={supplier.supplier_id || supplier.id}
//                 onPress={() => checkout(supplier.supplier_id || supplier.id)}
//                 style={styles.pressable6}
//               >
//                 <Text style={styles.text15}>
//                   Send buy request · {supplier.supplier_name || supplier.name || 'Supplier'}
//                 </Text>
//               </Pressable>
//             ))}
//           </PanelState>
//         </Panel>
//       )}
//     </DashboardShell>
//   )
// }

// Owner's supplier hub: shared shop, checkout tied to the first
// SELF_CONSTRUCTION project — same rule as web OwnerSupplierHub.
import ShopHubScreen from '../shared/ShopHubScreen'
import DashboardShell from '../../components/DashboardShell'
import { ComingSoonPanel } from '../../components/ComingSoon'
import { COMING_SOON } from '../../config/modules'
import { fetchOwnerProjects } from '../../api/projects'
import { createStyles } from '../../theme/createStyles'

export default function OwnerShopScreen({ navigation, route }) {
  // Materials marketplace and property buy & sell are not live yet.
  if (COMING_SOON.marketplace && COMING_SOON.property) {
    return (
      <DashboardShell onOpenNotifications={() => navigation.navigate('Notifications')}>
        <ComingSoonPanel feature="buySell" style={{ marginTop: 8 }} />
      </DashboardShell>
    )
  }
  return (
    <ShopHubScreen
      navigation={navigation}
      route={route}
      showProperty
      loadProjects={fetchOwnerProjects}
      pickCheckoutProject={(projects) =>
        projects.find((p) => p.construction_type === 'SELF_CONSTRUCTION') || projects[0] || null}
    />
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
}))
