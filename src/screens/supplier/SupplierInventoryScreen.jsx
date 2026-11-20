// An Equipment Supplier's Inventory tab: port of web SupplierEquipmentSections
// EquipmentInventorySection.
//
// Each card is one machine as GET /equipment/items returns it: its picture,
// rates and sale price, and the backend's own "free to rent today" and "free
// to sell" figures. Add and Edit open the full-screen form
// (SupplierEquipmentItem); Turn off is the backend's soft delete, Turn on
// sets is_active again. The search bar narrows the cards as you type.
import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import PianoLoader from '../../components/PianoLoader'
import { useFocusEffect } from '@react-navigation/native'
import { Construction, Pencil, Plus, Power, Search, X } from 'lucide-react-native'
import DashboardShell, { PanelState } from '../../components/DashboardShell'
import { toast } from '../../components/Toast'
import { deactivateEquipmentItem, equipmentErrorMessage, updateEquipmentItem } from '../../api/equipment'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { COLORS } from '../../theme/tokens'
import { ink, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'
import { useSupplierCountry } from './products/productParts'
import { useEquipment } from './equipment/EquipmentContext'
import { EquipmentImage, EquipmentPrices, Tag, allowsBuy, allowsRent, conditionLabel, modeLabel } from './equipment/equipmentParts'

const GAP = 12

const matches = (item, words) => [item.name, item.category, item.brand, item.model, item.specifications]
  .filter(Boolean)
  .join(' ')
  .toLowerCase()
  .includes(words)

export default function SupplierInventoryScreen({ navigation }) {
  const { t } = useLanguage()
  const country = useSupplierCountry()
  const { width, maxContentWidth, gutter, isTablet } = useResponsive()
  const { items, itemsStatus, reload } = useEquipment()
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Back from Add / Edit, or after a request changed what is free today.
  useFocusEffect(useCallback(() => { reload() }, [reload]))

  const onRefresh = async () => {
    setRefreshing(true)
    await reload()
    setRefreshing(false)
  }

  const visible = useMemo(() => {
    const words = search.trim().toLowerCase()
    return words ? items.filter((item) => matches(item, words)) : items
  }, [items, search])

  const columns = isTablet ? 2 : 1
  const inner = Math.min(width, maxContentWidth) - gutter * 2
  const cardWidth = Math.floor((inner - GAP * (columns - 1)) / columns)

  const openForm = (item) => {
    navigation.navigate('SupplierEquipmentItem', item ? { itemId: item.id } : {})
  }

  const toggleActive = async (item) => {
    setBusyId(item.id)
    try {
      if (item.is_active) await deactivateEquipmentItem(item.id)
      else await updateEquipmentItem(item.id, { is_active: true })
      toast.success(t(item.is_active ? 'labor.msg.deactivated' : 'labor.msg.activated', { name: item.name }))
      await reload()
    } catch (failure) {
      toast.error(equipmentErrorMessage(failure, t('equipment.error.update')))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ paddingHorizontal: gutter }}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>{t('equipment.inventory.title')}</Text>
            <Text style={styles.subtitle}>{t('equipment.inventory.subtitle')}</Text>
          </View>
          <Pressable onPress={() => openForm(null)} style={styles.addButton} accessibilityRole="button">
            <Plus size={15} color="#ffffff" />
            <Text style={styles.addText} numberOfLines={1}>{t('equipment.action.add')}</Text>
          </Pressable>
        </View>

        {items.length > 0 ? (
          <View style={styles.searchBox}>
            <Search size={17} color={COLORS.slate[400]} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('mobile.equipment.search')}
              placeholderTextColor={COLORS.slate[400]}
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} accessibilityLabel={t('mobile.equipment.clearSearch')} hitSlop={8}>
                <X size={16} color={COLORS.slate[500]} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={{ marginTop: 14 }}>
          {itemsStatus === 'idle' ? (
            <PanelState loading skeleton="cards" />
          ) : itemsStatus === 'error' && items.length === 0 ? (
            <View style={styles.empty}>
              <PanelState error={t('mobile.equipment.loadError')} />
              <Pressable onPress={reload} style={styles.retry}><Text style={styles.linkText}>{t('dash.engineer.liveCamera.retry')}</Text></Pressable>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <Construction size={38} color={COLORS.slate[300]} />
              <Text style={styles.emptyTitle}>{t('equipment.inventory.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('equipment.inventory.emptyMessage')}</Text>
              <Pressable onPress={() => openForm(null)} style={[styles.addButton, { marginTop: 14 }]}>
                <Plus size={15} color="#ffffff" />
                <Text style={styles.addText}>{t('equipment.action.add')}</Text>
              </Pressable>
            </View>
          ) : visible.length === 0 ? (
            <View style={styles.empty}>
              <Search size={30} color={COLORS.slate[300]} />
              <Text style={styles.emptyTitle}>{t('mobile.equipment.noMatch')}</Text>
              <Pressable onPress={() => setSearch('')} style={styles.retry}><Text style={styles.linkText}>{t('mobile.equipment.clearSearch')}</Text></Pressable>
            </View>
          ) : (
            <View style={styles.grid}>
              {visible.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  country={country}
                  width={cardWidth}
                  busy={busyId === item.id}
                  onEdit={() => openForm(item)}
                  onToggle={() => toggleActive(item)}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </DashboardShell>
  )
}

function ItemCard({ item, country, width, busy, onEdit, onToggle }) {
  const { t } = useLanguage()
  const active = item.is_active !== false
  const maker = [item.brand, item.model].filter(Boolean).join(' ')
  const rent = allowsRent(item)
  const buy = allowsBuy(item)
  return (
    <View style={[styles.card, { width }, active ? null : styles.cardOff]}>
      <View style={styles.cardTop}>
        <View style={styles.cardImage}>
          <EquipmentImage src={item.image_url} height={118} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            <Tag
              label={active ? t('labor.active') : t('labor.inactive')}
              bg={active ? soft('#d1fae5', '#047857') : soft('#f1f5f9', '#475569')}
              fg={active ? ink('#065f46') : ink('#475569')}
            />
          </View>
          <Text style={styles.meta} numberOfLines={1}>{maker ? `${item.category} · ${maker}` : item.category}</Text>
          <View style={styles.tags}>
            <Tag label={conditionLabel(t, item.condition)} bg={soft('#f1f5f9', '#475569')} fg={ink('#334155')} />
            <Tag label={modeLabel(t, item.mode)} bg={soft('#e8f3ec', '#1f6b45')} fg={ink('#134127')} />
          </View>
          <View style={{ marginTop: 8 }}>
            <EquipmentPrices item={item} country={country} />
          </View>
        </View>
      </View>

      {rent || buy ? (
        <View style={styles.figures}>
          {rent ? (
            <View style={styles.figure}>
              <Text style={styles.figureLabel} numberOfLines={2}>{t('equipment.inventory.availableRentToday')}</Text>
              <Text style={[styles.figureValue, { color: ink('#047857') }]}>{`${item.available_to_rent ?? 0} / ${item.quantity_total ?? 0}`}</Text>
            </View>
          ) : null}
          {buy ? (
            <View style={styles.figure}>
              <Text style={styles.figureLabel} numberOfLines={2}>{t('equipment.inventory.availableSell')}</Text>
              <Text style={[styles.figureValue, { color: ink('#0f766e') }]}>{`${item.available_to_buy ?? 0} / ${item.quantity_total ?? 0}`}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {item.specifications ? <Text style={styles.specs} numberOfLines={2}>{item.specifications}</Text> : null}

      <View style={styles.actions}>
        <Pressable onPress={onEdit} style={[styles.action, styles.actionEdit]} accessibilityRole="button">
          <Pencil size={14} color={COLORS.slate[600]} />
          <Text style={styles.actionEditText}>{t('labor.action.edit')}</Text>
        </Pressable>
        <Pressable
          onPress={onToggle}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.action, active ? styles.actionOff : styles.actionOn, busy ? { opacity: 0.55 } : null]}
        >
          {busy ? <PianoLoader color={active ? ink('#be123c') : '#ffffff'} height={14} /> : <Power size={14} color={active ? ink('#be123c') : '#ffffff'} />}
          <Text style={active ? styles.actionOffText : styles.actionOnText}>{active ? t('labor.action.deactivate') : t('labor.action.activate')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = createStyles((c) => ({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, letterSpacing: -0.4, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  subtitle: { marginTop: 2, fontSize: 12, lineHeight: 16, fontFamily: 'Inter_500Medium', color: c.textMuted },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, borderRadius: 11, backgroundColor: '#1f2937', paddingHorizontal: 12 },
  addText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  searchBox: { marginTop: 12, height: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 13 },
  searchInput: { flex: 1, height: '100%', fontSize: 14, fontFamily: 'Inter_500Medium', color: c.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12 },
  cardOff: { borderStyle: 'dashed', borderColor: c.borderStrong, opacity: 0.8 },
  cardTop: { flexDirection: 'row', gap: 12 },
  cardImage: { width: '38%' },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  name: { flex: 1, fontSize: 15, lineHeight: 19, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  meta: { marginTop: 2, fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textMuted },
  tags: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  figures: { marginTop: 12, flexDirection: 'row', gap: 8, borderRadius: 12, backgroundColor: c.subtle, padding: 9 },
  figure: { flex: 1, alignItems: 'center' },
  figureLabel: { textAlign: 'center', fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  figureValue: { marginTop: 2, fontSize: 18, fontFamily: 'Manrope_800ExtraBold' },
  specs: { marginTop: 9, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', color: c.textMuted },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
  action: { flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10 },
  actionEdit: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  actionEditText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  actionOff: { borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft },
  actionOffText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.roseText },
  actionOn: { backgroundColor: '#1f6b45' },
  actionOnText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  empty: { alignItems: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: c.borderStrong, backgroundColor: c.card, paddingHorizontal: 22, paddingVertical: 34 },
  emptyTitle: { marginTop: 10, textAlign: 'center', fontSize: 16, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  emptyBody: { marginTop: 4, textAlign: 'center', fontSize: 13, lineHeight: 19, fontFamily: 'Inter_400Regular', color: c.textMuted },
  retry: { marginTop: 8, paddingVertical: 6 },
  linkText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
}))
