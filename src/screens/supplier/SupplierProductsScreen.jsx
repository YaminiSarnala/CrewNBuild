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
import { createStyles } from '../../theme/createStyles'

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
      style={styles.textInput}
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
        <View style={styles.view}>
          <View style={styles.view2}>
            <Text style={styles.text}>
              {editor?.field === 'price'
                ? `New price per ${editor?.product?.unit || 'unit'}`
                : 'Update stock quantity'}
            </Text>
            <Text style={styles.text2} numberOfLines={1}>{editor?.product?.name}</Text>
            <TextInput
              value={editor?.value ?? ''}
              onChangeText={(value) => setEditor((e) => ({ ...e, value }))}
              keyboardType="numeric"
              autoFocus
              style={styles.textInput2}
            />
            <View style={styles.view3}>
              <Pressable onPress={() => setEditor(null)} style={styles.pressable}>
                <Text style={styles.text3}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveEditor} disabled={editorSaving} style={[styles.pressable2, editorSaving ? styles.pressable3 : null]}>
                <Text style={styles.text4}>{editorSaving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Pressable onPress={() => setFormOpen((open) => !open)} style={styles.pressable4}>
        <Plus size={15} color="#fff" />
        <Text style={styles.text4}>{formOpen ? 'Close form' : 'Add product'}</Text>
      </Pressable>

      {formOpen && (
        <Panel title="New product listing">
          <Text style={styles.text5}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={{ gap: 6 }}>
            {CATEGORIES.map((category) => {
              const active = draft.category === category
              return (
                <Pressable
                  key={category}
                  onPress={() => setDraft((d) => ({ ...d, category, unit: d.unit || DEFAULT_UNITS[category] || 'piece' }))}
                  style={[styles.pressable5, active ? styles.pressable6 : styles.pressable7]}
                >
                  <Text style={[styles.text6, active ? styles.text7 : styles.text8]}>{category}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
          <Input value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} placeholder="Product name (e.g. OPC 53 Grade Cement)" />
          <Input value={draft.brand} onChangeText={(brand) => setDraft((d) => ({ ...d, brand }))} placeholder="Brand (optional)" />
          <View style={styles.view4}>
            <View style={styles.view5}><Input value={draft.price} onChangeText={(price) => setDraft((d) => ({ ...d, price }))} placeholder="Price" keyboardType="numeric" /></View>
            <View style={styles.view5}><Input value={draft.unit} onChangeText={(unit) => setDraft((d) => ({ ...d, unit }))} placeholder="Unit" /></View>
            <View style={styles.view5}><Input value={draft.quantity} onChangeText={(quantity) => setDraft((d) => ({ ...d, quantity }))} placeholder="Stock" keyboardType="numeric" /></View>
          </View>
          <Pressable onPress={saveProduct} disabled={saving} style={[styles.pressable8, saving ? styles.pressable3 : null]}>
            <Text style={styles.text4}>{saving ? 'Saving…' : 'Publish product'}</Text>
          </Pressable>
        </Panel>
      )}

      <Panel title={`My products (${productList.length})`}>
        <PanelState loading={products.loading} error={products.error} empty={!productList.length} emptyText="No products listed yet. Add your first product above.">
          {productList.map((product) => (
            <View key={product.id} style={styles.view6}>
              <View style={styles.view7}>
                <View style={styles.view5}>
                  <Text style={styles.text9} numberOfLines={1}>{product.name}</Text>
                  <Text style={styles.text2} numberOfLines={1}>
                    {[product.brand, product.category].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Pressable onPress={() => removeProduct(product)} style={styles.pressable9}>
                  <Trash2 size={13} color="#e11d48" />
                </Pressable>
              </View>
              <View style={styles.view8}>
                <Text style={styles.text10}>{inr(product.price)}</Text>
                <Text style={styles.text11}>per {product.unit || 'unit'} · stock {product.quantity ?? 0}</Text>
                <View style={styles.view5} />
                <Pressable onPress={() => updatePrice(product)} style={styles.pressable10}>
                  <Text style={styles.text12}>Price</Text>
                </Pressable>
                <Pressable onPress={() => updateStock(product)} style={styles.pressable10}>
                  <Text style={styles.text12}>Stock</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </PanelState>
      </Panel>
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  textInput: { marginTop: 7, height: 38.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  view: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)', paddingHorizontal: 21 },
  view2: { width: '100%', borderRadius: 21, backgroundColor: c.card, padding: 17.5 },
  text: { fontSize: 15, fontWeight: '800', color: c.text },
  text2: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  textInput2: { marginTop: 10.5, height: 42, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 16, fontWeight: '800', color: c.text },
  view3: { marginTop: 14, flexDirection: 'row', gap: 7 },
  pressable: { height: 38.5, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.border },
  text3: { fontSize: 13, fontWeight: '800', color: c.textMuted },
  pressable2: { height: 38.5, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  pressable3: { opacity: 0.5 },
  text4: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  pressable4: { marginBottom: 14, height: 38.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5.25, borderRadius: 10.5, backgroundColor: '#1a5038' },
  text5: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  scrollView: { marginTop: 7 },
  pressable5: { borderRadius: 9999, paddingHorizontal: 12.25, paddingVertical: 7 },
  pressable6: { backgroundColor: '#1a5038' },
  pressable7: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  text6: { fontSize: 11, fontWeight: '800' },
  text7: { color: '#ffffff' },
  text8: { color: c.textMuted },
  view4: { flexDirection: 'row', gap: 7 },
  view5: { flex: 1 },
  pressable8: { marginTop: 10.5, height: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  view6: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  view7: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text9: { fontSize: 14, fontWeight: '800', color: c.text },
  pressable9: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: c.roseSoft },
  view8: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 7 },
  text10: { fontSize: 15, fontWeight: '800', color: c.brandText },
  text11: { fontSize: 10, fontWeight: '600', color: c.textFaint },
  pressable10: { borderRadius: 7, borderWidth: 1, borderColor: c.brandBorderStrong, paddingHorizontal: 8.75, paddingVertical: 5.25 },
  text12: { fontSize: 10, fontWeight: '800', color: c.brandTextStrong },
}))
