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
              <View key={request.id} className="mb-4 rounded-2xl bg-slate-50 p-4">
                <Text className="font-sansBold text-graphite" style={{ fontSize: 14.5 }}>
                  {request.material_name || request.title || `Request #${request.id}`}
                </Text>
                <Text className="mt-1 font-sans text-slate-500" style={{ fontSize: 12.5 }}>
                  {request.quantity ? `${request.quantity} ${request.unit || ''}` : ''}
                  {request.status ? ` · ${request.status}` : ''}
                </Text>
                <View className="mt-3 flex-row" style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => respond(request.id, 'ACCEPT')}
                    className="flex-1 flex-row items-center justify-center rounded-full bg-brand-800 py-2.5 active:bg-brand-700"
                    style={{ gap: 6 }}
                  >
                    <Check size={14} color="#ffffff" />
                    <Text className="font-sansBold text-white" style={{ fontSize: 13 }}>
                      Accept
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => respond(request.id, 'REJECT')}
                    className="flex-1 flex-row items-center justify-center rounded-full border border-slate-300 bg-white py-2.5 active:bg-slate-100"
                    style={{ gap: 6 }}
                  >
                    <X size={14} color="#dc2626" />
                    <Text className="font-sansBold text-warm" style={{ fontSize: 13 }}>
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
              className="flex-row items-center rounded-full bg-brand-50 px-3 py-1.5"
              style={{ gap: 4 }}
            >
              <Plus size={13} color="#134127" />
              <Text className="font-sansBold text-brand-800" style={{ fontSize: 12 }}>
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
              <View key={product.id} className="mb-3 flex-row items-center" style={{ gap: 10 }}>
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                  <Package size={16} color="#134127" />
                </View>
                <View className="flex-1">
                  <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }}>
                    {product.name}
                  </Text>
                  <Text className="font-sans text-slate-500" style={{ fontSize: 12 }}>
                    {product.category || '—'}
                  </Text>
                </View>
                <Text className="font-display text-brand-800" style={{ fontSize: 14 }}>
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
                <View key={projectId} className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <View className="flex-row items-center gap-2">
                    <HardHat size={15} color="#166534" />
                    <Text className="flex-1 text-[14px] font-extrabold text-graphite" numberOfLines={1}>
                      {project.project_title || project.title || 'Project'}
                    </Text>
                    {!!projectOrders.length && (
                      <View className="rounded-full bg-brand-100 px-2 py-0.5">
                        <Text className="text-[10px] font-extrabold text-brand-800">{projectOrders.length} orders</Text>
                      </View>
                    )}
                  </View>
                  <View className="mt-1.5 flex-row items-center gap-1.5">
                    <MapPin size={11} color="#94a3b8" />
                    <Text className="flex-1 text-[11px] font-semibold text-slate-400" numberOfLines={1}>
                      {project.address || 'Location not set'}{project.pincode ? ` · ${project.pincode}` : ''}
                    </Text>
                  </View>
                  {!!(project.contractor_name || project.engineer_name) && (
                    <Text className="mt-1 text-[11px] font-semibold text-slate-500" numberOfLines={1}>
                      {[project.contractor_name && `Builder: ${project.contractor_name}`, project.engineer_name && `Engineer: ${project.engineer_name}`].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  {projectOrders.slice(0, 3).map((order) => (
                    <Text key={order.id} className="mt-1.5 text-[12px] font-semibold text-slate-500" numberOfLines={1}>
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
              <View key={client.id} className="mb-3">
                <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }}>
                  {client.name || client.company_name}
                </Text>
                <Text className="font-sans text-slate-500" style={{ fontSize: 12 }}>
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
