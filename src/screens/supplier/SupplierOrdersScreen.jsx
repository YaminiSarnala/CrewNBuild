// Port of web SupplierMaterialRequests.jsx: incoming buy requests with the
// same three actions the web sends — ACCEPT, REJECT, then FULFILL once
// accepted (FULFILL also decrements inventory server-side).
import { useState } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchSupplierMaterialRequests, respondMaterialRequest } from '../../api/materialRequests'

const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`

const STATUS_TONE = {
  PENDING: 'bg-amber-50 text-amber-700',
  ACCEPTED: 'bg-brand-50 text-brand-800',
  FULFILLED: 'bg-blue-50 text-blue-700',
  REJECTED: 'bg-rose-50 text-rose-700',
}

export default function SupplierOrdersScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const orders = useAsyncData(fetchSupplierMaterialRequests, [])
  const orderList = Array.isArray(orders.data) ? orders.data : []

  const onRefresh = async () => {
    setRefreshing(true)
    await orders.reload()
    setRefreshing(false)
  }

  async function respond(id, action) {
    setBusyId(id)
    try {
      await respondMaterialRequest(id, action)
      await orders.reload()
    } catch (error) {
      Alert.alert('Could not update', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  function ActionButton({ label, onPress, tone = 'brand', disabled }) {
    const styles = tone === 'danger'
      ? 'border border-rose-200 bg-rose-50'
      : 'bg-brand-700'
    const textStyles = tone === 'danger' ? 'text-rose-700' : 'text-white'
    return (
      <Pressable onPress={onPress} disabled={disabled} className={`h-9 flex-1 items-center justify-center rounded-lg ${styles} ${disabled ? 'opacity-50' : ''}`}>
        <Text className={`text-xs font-extrabold ${textStyles}`}>{label}</Text>
      </Pressable>
    )
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <Panel title="Buy requests">
        <PanelState loading={orders.loading} error={orders.error} empty={!orderList.length} emptyText="No buy requests yet. They'll appear here when buyers checkout your products.">
          {orderList.map((order) => {
            const status = String(order.status || 'PENDING').toUpperCase()
            const items = Array.isArray(order.items) ? order.items : []
            return (
              <View key={order.id} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[14px] font-extrabold text-graphite" numberOfLines={1}>
                    {order.request_code || `Request #${order.id}`}
                  </Text>
                  <View className={`rounded-full px-2.5 py-1 ${STATUS_TONE[status] || 'bg-slate-100 text-slate-500'}`}>
                    <Text className={`text-[10px] font-extrabold ${(STATUS_TONE[status] || '').split(' ')[1] || 'text-slate-500'}`}>{status}</Text>
                  </View>
                </View>
                <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>
                  {order.buyer_name || order.owner_name || 'Buyer'}{order.project_title ? ` · ${order.project_title}` : ''}
                </Text>
                {items.map((item, index) => (
                  <Text key={item.id || index} className="mt-1 text-[12px] font-semibold text-slate-500" numberOfLines={1}>
                    {item.product_name || item.name} × {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                  </Text>
                ))}
                {!!order.total && <Text className="mt-2 text-[15px] font-extrabold text-brand-700">{inr(order.total)}</Text>}

                {status === 'PENDING' && (
                  <View className="mt-3 flex-row gap-2">
                    <ActionButton label="Reject" tone="danger" disabled={busyId === order.id} onPress={() => respond(order.id, 'REJECT')} />
                    <ActionButton label="Accept" disabled={busyId === order.id} onPress={() => respond(order.id, 'ACCEPT')} />
                  </View>
                )}
                {status === 'ACCEPTED' && (
                  <View className="mt-3">
                    <ActionButton label="Mark fulfilled" disabled={busyId === order.id} onPress={() => respond(order.id, 'FULFILL')} />
                  </View>
                )}
              </View>
            )
          })}
        </PanelState>
      </Panel>
    </DashboardShell>
  )
}