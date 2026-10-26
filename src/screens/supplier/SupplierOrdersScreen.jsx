// Port of web SupplierMaterialRequests.jsx: incoming buy requests with the
// same three actions the web sends — ACCEPT, REJECT, then FULFILL once
// accepted (FULFILL also decrements inventory server-side).
import { useState } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchSupplierMaterialRequests, respondMaterialRequest } from '../../api/materialRequests'
import { createStyles } from '../../theme/createStyles'

const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`

const STATUS_TONE = {
  PENDING: 'tone',
  ACCEPTED: 'tone2',
  FULFILLED: 'tone3',
  REJECTED: 'tone4',
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
    const boxTone = tone === 'danger' ? styles.tone5 : styles.tone6
    const textTone = tone === 'danger' ? styles.tone7 : styles.tone8
    return (
      <Pressable onPress={onPress} disabled={disabled} style={[styles.pressable, boxTone, disabled ? styles.pressable2 : null]}>
        <Text style={[styles.text, textTone]}>{label}</Text>
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
              <View key={order.id} style={styles.view}>
                <View style={styles.view2}>
                  <Text style={styles.text2} numberOfLines={1}>
                    {order.request_code || `Request #${order.id}`}
                  </Text>
                  <View style={[styles.view3, styles[STATUS_TONE[status] || 'view4']]}>
                    <Text style={[styles.text3, STATUS_TONE[status] ? { color: styles[STATUS_TONE[status]].color } : styles.text4]}>{status}</Text>
                  </View>
                </View>
                <Text style={styles.text5} numberOfLines={1}>
                  {order.buyer_name || order.owner_name || 'Buyer'}{order.project_title ? ` · ${order.project_title}` : ''}
                </Text>
                {items.map((item, index) => (
                  <Text key={item.id || index} style={styles.text6} numberOfLines={1}>
                    {item.product_name || item.name} × {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                  </Text>
                ))}
                {!!order.total && <Text style={styles.text7}>{inr(order.total)}</Text>}

                {status === 'PENDING' && (
                  <View style={styles.view5}>
                    <ActionButton label="Reject" tone="danger" disabled={busyId === order.id} onPress={() => respond(order.id, 'REJECT')} />
                    <ActionButton label="Accept" disabled={busyId === order.id} onPress={() => respond(order.id, 'ACCEPT')} />
                  </View>
                )}
                {status === 'ACCEPTED' && (
                  <View style={styles.view6}>
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

const styles = createStyles((c) => ({
  tone: { backgroundColor: c.amberSoft, color: c.amberText },
  tone2: { backgroundColor: c.brandSoft, color: c.brandTextStrong },
  tone3: { backgroundColor: c.blueSoft, color: c.blueText },
  tone4: { backgroundColor: c.roseSoft, color: c.roseText },
  tone5: { borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft },
  tone6: { backgroundColor: '#1a5038' },
  tone7: { color: c.roseText },
  tone8: { color: '#ffffff' },
  pressable: { height: 31.5, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  pressable2: { opacity: 0.5 },
  text: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  view: { marginBottom: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text2: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
  view3: { borderRadius: 9999, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  view4: { backgroundColor: c.muted, color: c.textMuted },
  text3: { fontSize: 10, fontWeight: '800' },
  text4: { color: c.textMuted },
  text5: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  text6: { marginTop: 3.5, fontSize: 12, fontWeight: '600', color: c.textMuted },
  text7: { marginTop: 7, fontSize: 15, fontWeight: '800', color: c.brandText },
  view5: { marginTop: 10.5, flexDirection: 'row', gap: 7 },
  view6: { marginTop: 10.5 },
}))
