// Port of the web supplier Products section: list with price/stock controls
// plus an add-product form. Categories and payload fields match the web
// listingDraft in SupplierDashboard.jsx.
import { useState } from 'react'
import { View, Text, Pressable, TextInput, Alert, ScrollView, Modal } from 'react-native'
import { Plus, Trash2 } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import {
  fetchSupplierProducts, createSupplierProduct, updateSupplierProduct,
  updateSupplierProductPrice, deleteSupplierProduct,
} from '../../api/supplierProducts'
import { COLORS } from '../../theme/tokens'

const CATEGORIES = ['Cement', 'Steel/TMT', 'Bricks', 'Sand', 'Aggregates', 'Concrete', 'Blocks', 'Other Construction Materials']
const DEFAULT_UNITS = { Cement: 'bag', 'Steel/TMT': 'kg', Bricks: 'piece', Sand: 'ton', Aggregates: 'ton', Concrete: 'cu.m', Blocks: 'piece' }
const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`

const EMPTY_DRAFT = { name: '', brand: '', category: '', unit: '', price: '', quantity: '' }

function Input({ value, onChangeText, placeholder, keyboardType }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType={keyboardType}
      className="mt-2 h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite"
      placeholderTextColor={COLORS.slate[400]}
    />
  )
}

export default function SupplierProductsScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
    const [editor, setEditor] = useState(null) // { product, field: 'price'|'quantity', value }
  const [editorSaving, setEditorSaving] = useState(false)
  const products = useAsyncData(fetchSupplierProducts, [])
  const productList = Array.isArray(products.data) ? products.data : []

  const onRefresh = async () => {
    setRefreshing(true)
    await products.reload()
    setRefreshing(false)
  }

  async function saveProduct() {
    if (!draft.name.trim() || !draft.category || !draft.price) {
      Alert.alert('Missing details', 'Name, category and price are required.')
      return
    }
    setSaving(true)
    try {
      await createSupplierProduct({
        name: draft.name.trim(),
        brand: draft.brand.trim(),
        category: draft.category,
        unit: draft.unit.trim() || DEFAULT_UNITS[draft.category] || 'piece',
        price: Number(draft.price),
        quantity: Number(draft.quantity || 0),
      })
      setDraft(EMPTY_DRAFT)
      setFormOpen(false)
      await products.reload()
    } catch (error) {
      Alert.alert('Could not save', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

    function updateStock(product) {
    setEditor({ product, field: 'quantity', value: String(product.quantity ?? 0) })
  }

  function updatePrice(product) {
    setEditor({ product, field: 'price', value: String(product.price ?? '') })
  }

  async function saveEditor() {
    const value = Number(editor.value)
    if (Number.isNaN(value) || value < 0) {
      Alert.alert('Invalid value', 'Enter a number of 0 or more.')
      return
    }
    setEditorSaving(true)
    try {
      if (editor.field === 'price') await updateSupplierProductPrice(editor.product.id, { price: value })
      else await updateSupplierProduct(editor.product.id, { quantity: value })
      setEditor(null)
      await products.reload()
    } catch (error) {
      Alert.alert('Could not update', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setEditorSaving(false)
    }
  }

  function removeProduct(product) {
    Alert.alert('Delete product', `Remove "${product.name}" from your catalog?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteSupplierProduct(product.id); await products.reload() }
          catch (error) { Alert.alert('Could not delete', error?.response?.data?.detail || 'Please try again.') }
        },
      },
    ])
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
              <Modal visible={!!editor} transparent animationType="fade" onRequestClose={() => setEditor(null)}>
        <View className="flex-1 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-3xl bg-white p-5">
            <Text className="text-[15px] font-extrabold text-graphite">
              {editor?.field === 'price'
                ? `New price per ${editor?.product?.unit || 'unit'}`
                : 'Update stock quantity'}
            </Text>
            <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>{editor?.product?.name}</Text>
            <TextInput
              value={editor?.value ?? ''}
              onChangeText={(value) => setEditor((e) => ({ ...e, value }))}
              keyboardType="numeric"
              autoFocus
              className="mt-3 h-12 rounded-xl border border-slate-200 bg-white px-3 text-[16px] font-extrabold text-graphite"
            />
            <View className="mt-4 flex-row gap-2">
              <Pressable onPress={() => setEditor(null)} className="h-11 flex-1 items-center justify-center rounded-xl border border-slate-200">
                <Text className="text-[13px] font-extrabold text-slate-500">Cancel</Text>
              </Pressable>
              <Pressable onPress={saveEditor} disabled={editorSaving} className={`h-11 flex-1 items-center justify-center rounded-xl bg-brand-700 ${editorSaving ? 'opacity-50' : ''}`}>
                <Text className="text-[13px] font-extrabold text-white">{editorSaving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Pressable onPress={() => setFormOpen((open) => !open)} className="mb-4 h-11 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-700">
        <Plus size={15} color="#fff" />
        <Text className="text-[13px] font-extrabold text-white">{formOpen ? 'Close form' : 'Add product'}</Text>
      </Pressable>

      {formOpen && (
        <Panel title="New product listing">
          <Text className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 6 }}>
            {CATEGORIES.map((category) => {
              const active = draft.category === category
              return (
                <Pressable
                  key={category}
                  onPress={() => setDraft((d) => ({ ...d, category, unit: d.unit || DEFAULT_UNITS[category] || 'piece' }))}
                  className={`rounded-full px-3.5 py-2 ${active ? 'bg-brand-700' : 'bg-white border border-slate-200'}`}
                >
                  <Text className={`text-[11px] font-extrabold ${active ? 'text-white' : 'text-slate-500'}`}>{category}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
          <Input value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} placeholder="Product name (e.g. OPC 53 Grade Cement)" />
          <Input value={draft.brand} onChangeText={(brand) => setDraft((d) => ({ ...d, brand }))} placeholder="Brand (optional)" />
          <View className="flex-row gap-2">
            <View className="flex-1"><Input value={draft.price} onChangeText={(price) => setDraft((d) => ({ ...d, price }))} placeholder="Price" keyboardType="numeric" /></View>
            <View className="flex-1"><Input value={draft.unit} onChangeText={(unit) => setDraft((d) => ({ ...d, unit }))} placeholder="Unit" /></View>
            <View className="flex-1"><Input value={draft.quantity} onChangeText={(quantity) => setDraft((d) => ({ ...d, quantity }))} placeholder="Stock" keyboardType="numeric" /></View>
          </View>
          <Pressable onPress={saveProduct} disabled={saving} className={`mt-3 h-11 items-center justify-center rounded-xl bg-brand-700 ${saving ? 'opacity-50' : ''}`}>
            <Text className="text-[13px] font-extrabold text-white">{saving ? 'Saving…' : 'Publish product'}</Text>
          </Pressable>
        </Panel>
      )}

      <Panel title={`My products (${productList.length})`}>
        <PanelState loading={products.loading} error={products.error} empty={!productList.length} emptyText="No products listed yet. Add your first product above.">
          {productList.map((product) => (
            <View key={product.id} className="border-b border-slate-100 py-3">
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Text className="text-[14px] font-extrabold text-graphite" numberOfLines={1}>{product.name}</Text>
                  <Text className="mt-0.5 text-xs font-semibold text-slate-500" numberOfLines={1}>
                    {[product.brand, product.category].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Pressable onPress={() => removeProduct(product)} className="h-8 w-8 items-center justify-center rounded-full bg-rose-50">
                  <Trash2 size={13} color="#e11d48" />
                </Pressable>
              </View>
              <View className="mt-2 flex-row items-center gap-2">
                <Text className="text-[15px] font-extrabold text-brand-700">{inr(product.price)}</Text>
                <Text className="text-[10px] font-semibold text-slate-400">per {product.unit || 'unit'} · stock {product.quantity ?? 0}</Text>
                <View className="flex-1" />
                <Pressable onPress={() => updatePrice(product)} className="rounded-lg border border-brand-200 px-2.5 py-1.5">
                  <Text className="text-[10px] font-extrabold text-brand-800">Price</Text>
                </Pressable>
                <Pressable onPress={() => updateStock(product)} className="rounded-lg border border-brand-200 px-2.5 py-1.5">
                  <Text className="text-[10px] font-extrabold text-brand-800">Stock</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </PanelState>
      </Panel>
    </DashboardShell>
  )
}