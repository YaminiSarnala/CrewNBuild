// Port of the web src/pages/supplier/SupplierDashboard.jsx.
// Wired to: GET /supplier-products, GET /supplier/material-requests,
// GET /suppliers/find-clients, POST /supplier/material-requests/{id}/respond.
import { useState, useCallback } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { Package, Check, X, Plus, HardHat, MapPin } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, MetricRow, useAsyncData } from '../../components/DashboardShell'
import LanguageSheet from '../../components/LanguageSheet'
import { fetchSupplierProducts } from '../../api/supplierProducts'
import { fetchSupplierMaterialRequests, respondMaterialRequest } from '../../api/materialRequests'
import { fetchSupplierClients } from '../../api/profiles'
import { fetchSupplierMyProjects } from '../../api/projects'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

export default function SupplierDashboard({ navigation }) {
  const [languageOpen, setLanguageOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const products = useAsyncData(fetchSupplierProducts, [])
  const requests = useAsyncData(fetchSupplierMaterialRequests, [])
  const clients = useAsyncData(fetchSupplierClients, [])
  const myProjects = useAsyncData(() => fetchSupplierMyProjects().catch(() => []), [])
  const onRefresh = useCallback(async () => {
  setRefreshing(true);

  await Promise.all([
    products.reload(),
    requests.reload(),
    clients.reload(),
    myProjects.reload(),
  ]);

  setRefreshing(false);
}, [products, requests, clients, myProjects]);

  async function respond(id, action) {
    try {
      await respondMaterialRequest(id, action)
      await requests.reload()
    } catch (error) {
      Alert.alert('Could not update', error?.response?.data?.detail || 'Please try again.')
    }
  }

  const productList = Array.isArray(products.data) ? products.data : []
  const requestList = Array.isArray(requests.data) ? requests.data : []
  const clientList = Array.isArray(clients.data) ? clients.data : []
  const myProjectList = Array.isArray(myProjects.data) ? myProjects.data : []
  return (
    <>
      <DashboardShell
        refreshing={refreshing}
        onRefresh={onRefresh}
        onOpenLanguage={() => setLanguageOpen(true)}
        onOpenNotifications={() => navigation.navigate('Notifications')}
      >
        <MetricRow
          items={[
            { label: 'Products', value: String(productList.length) },
            { label: 'Requests', value: String(requestList.length) },
            { label: 'Projects', value: String(myProjectList.length) },
                    ]}
        />

        <Panel
          title="Material requests"
        >
          <PanelState
            loading={requests.loading}
            error={requests.error}
            empty={requestList.length === 0}
            emptyText="No incoming material requests."
          >
            {requestList.map((request) => (
              <View key={request.id} style={styles.view}>
                <Text style={[styles.text, { fontSize: 14.5 }]}>
                  {request.material_name || request.title || `Request #${request.id}`}
                </Text>
                <Text style={[styles.text2, { fontSize: 12.5 }]}>
                  {request.quantity ? `${request.quantity} ${request.unit || ''}` : ''}
                  {request.status ? ` · ${request.status}` : ''}
                </Text>
                <View style={[styles.view2, { gap: 10 }]}>
                  <Pressable
                    onPress={() => respond(request.id, 'ACCEPT')}
                    style={[styles.pressable, { gap: 6 }]}
                  >
                    <Check size={14} color="#ffffff" />
                    <Text style={[styles.text3, { fontSize: 13 }]}>
                      Accept
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => respond(request.id, 'REJECT')}
                    style={[styles.pressable2, { gap: 6 }]}
                  >
                    <X size={14} color="#dc2626" />
                    <Text style={[styles.text4, { fontSize: 13 }]}>
                      Decline
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </PanelState>
        </Panel>

        <Panel
          title="My catalogue"
          action={
            <Pressable
              onPress={() => navigation.navigate('AddProduct')}
              accessibilityRole="button"
              style={[styles.pressable3, { gap: 4 }]}
            >
              <Plus size={13} color={COLORS.brand[800]} />
              <Text style={[styles.text5, { fontSize: 12 }]}>
                Add
              </Text>
            </Pressable>
          }
        >
          <PanelState
            loading={products.loading}
            error={products.error}
            empty={productList.length === 0}
            emptyText="No products listed yet."
          >
            {productList.map((product) => (
              <View key={product.id} style={[styles.view3, { gap: 10 }]}>
                <View style={styles.view4}>
                  <Package size={16} color={COLORS.brand[800]} />
                </View>
                <View style={styles.view5}>
                  <Text style={[styles.text, { fontSize: 14 }]}>
                    {product.name}
                  </Text>
                  <Text style={[styles.text6, { fontSize: 12 }]}>
                    {product.category || '—'}
                  </Text>
                </View>
                <Text style={[styles.text7, { fontSize: 14 }]}>
                  ₹{Number(product.price || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
          </PanelState>
        </Panel>
        <Panel title="My projects">
          <PanelState loading={myProjects.loading} empty={!myProjectList.length} emptyText="No project assignments yet. When a builder assigns you to a site, it appears here.">
            {myProjectList.map((project) => {
              const projectId = project.id || project.project_id
              const projectOrders = requestList.filter((order) => order.project_id === projectId)
              return (
                <View key={projectId} style={styles.view6}>
                  <View style={styles.view7}>
                    <HardHat size={15} color="#166534" />
                    <Text style={styles.text8} numberOfLines={1}>
                      {project.project_title || project.title || 'Project'}
                    </Text>
                    {!!projectOrders.length && (
                      <View style={styles.view8}>
                        <Text style={styles.text9}>{projectOrders.length} orders</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.view9}>
                    <MapPin size={11} color="#94a3b8" />
                    <Text style={styles.text10} numberOfLines={1}>
                      {project.address || 'Location not set'}{project.pincode ? ` · ${project.pincode}` : ''}
                    </Text>
                  </View>
                  {!!(project.contractor_name || project.engineer_name) && (
                    <Text style={styles.text11} numberOfLines={1}>
                      {[project.contractor_name && `Builder: ${project.contractor_name}`, project.engineer_name && `Engineer: ${project.engineer_name}`].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  {projectOrders.slice(0, 3).map((order) => (
                    <Text key={order.id} style={styles.text12} numberOfLines={1}>
                      • {order.request_code || `Order #${order.id}`} · {order.status || 'PENDING'}
                    </Text>
                  ))}
                </View>
              )
            })}
          </PanelState>
        </Panel>
        <Panel title="Nearby clients">
          <PanelState
            loading={clients.loading}
            error={clients.error}
            empty={clientList.length === 0}
            emptyText="No clients found in your delivery area yet."
          >
            {clientList.slice(0, 8).map((client) => (
              <View key={client.id} style={styles.view10}>
                <Text style={[styles.text, { fontSize: 14 }]}>
                  {client.name || client.company_name}
                </Text>
                <Text style={[styles.text6, { fontSize: 12 }]}>
                  {client.pincode || '—'}
                </Text>
              </View>
            ))}
          </PanelState>
        </Panel>
      </DashboardShell>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 14, borderRadius: 14, backgroundColor: c.subtle, padding: 14 },
  text: { fontFamily: 'Inter_700Bold', color: c.text },
  text2: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view2: { marginTop: 10.5, flexDirection: 'row' },
  pressable: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#134127', paddingVertical: 8.75 },
  text3: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  pressable2: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.card, paddingVertical: 8.75 },
  text4: { fontFamily: 'Inter_700Bold', color: '#dc2626' },
  pressable3: { flexDirection: 'row', alignItems: 'center', borderRadius: 9999, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 5.25 },
  text5: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  view3: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center' },
  view4: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: c.brandSoft },
  view5: { flex: 1 },
  text6: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  text7: { fontFamily: 'Manrope_800ExtraBold', color: c.brandTextStrong },
  view6: { marginBottom: 10.5, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view7: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text8: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
  view8: { borderRadius: 9999, backgroundColor: c.brandSoftStrong, paddingHorizontal: 7, paddingVertical: 1.75 },
  text9: { fontSize: 10, fontWeight: '800', color: c.brandTextStrong },
  view9: { marginTop: 5.25, flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text10: { flex: 1, fontSize: 11, fontWeight: '600', color: c.textFaint },
  text11: { marginTop: 3.5, fontSize: 11, fontWeight: '600', color: c.textMuted },
  text12: { marginTop: 5.25, fontSize: 12, fontWeight: '600', color: c.textMuted },
  view10: { marginBottom: 10.5 },
}))
