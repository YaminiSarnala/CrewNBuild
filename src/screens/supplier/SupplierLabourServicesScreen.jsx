// A Labour Supplier's Services tab: port of web SupplierLaborSections
// LaborServicesSection.
//
// One card per trade the supplier offers, with the backend's own capacity,
// available and deployed figures (never re-derived here). Add and Edit open
// the full-screen form (SupplierLabourService); Deactivate / Activate sets
// is_active. Add is off once every trade the backend accepts is offered.
import { useCallback, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Pencil, Plus, Power, Wrench } from 'lucide-react-native'
import DashboardShell, { PanelState } from '../../components/DashboardShell'
import { toast } from '../../components/Toast'
import PianoLoader from '../../components/PianoLoader'
import { labourErrorMessage, updateLabourService } from '../../api/labour'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { COLORS } from '../../theme/tokens'
import { ink, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'
import { useLabour } from './labour/LabourContext'
import { Tag } from './equipment/equipmentParts'

const GAP = 12

export default function SupplierLabourServicesScreen({ navigation }) {
  const { t } = useLanguage()
  const { width, maxContentWidth, gutter, isTablet } = useResponsive()
  const { services, trades, servicesStatus, reload } = useLabour()
  const [busyId, setBusyId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Back from Add / Edit, or after a request changed who is deployed.
  useFocusEffect(useCallback(() => { reload() }, [reload]))

  const onRefresh = async () => {
    setRefreshing(true)
    await reload()
    setRefreshing(false)
  }

  const offered = new Set(services.map((service) => service.trade))
  const canAdd = trades.some((trade) => !offered.has(trade))
  const columns = isTablet ? 2 : 1
  const inner = Math.min(width, maxContentWidth) - gutter * 2
  const cardWidth = Math.floor((inner - GAP * (columns - 1)) / columns)

  const openForm = (service) => {
    navigation.navigate('SupplierLabourService', service ? { serviceId: service.id } : {})
  }

  const toggleActive = async (service) => {
    setBusyId(service.id)
    try {
      await updateLabourService(service.id, { is_active: !service.is_active })
      toast.success(t(service.is_active ? 'labor.msg.deactivated' : 'labor.msg.activated', { name: service.trade }))
      await reload()
    } catch (failure) {
      toast.error(labourErrorMessage(failure, t('labor.error.serviceUpdate')))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ paddingHorizontal: gutter }}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title} numberOfLines={1}>{t('labor.services.title')}</Text>
            <Text style={styles.subtitle}>{t('labor.services.subtitle')}</Text>
          </View>
          <Pressable
            onPress={() => openForm(null)}
            disabled={!canAdd}
            style={[styles.addButton, !canAdd ? { opacity: 0.5 } : null]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canAdd }}
          >
            <Plus size={15} color="#ffffff" />
            <Text style={styles.addText} numberOfLines={1}>{t('labor.action.addService')}</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 14 }}>
          {servicesStatus === 'idle' ? (
            <PanelState loading skeleton="cards" />
          ) : servicesStatus === 'error' && services.length === 0 ? (
            <View style={styles.empty}>
              <PanelState error={t('mobile.labour.loadError')} />
              <Pressable onPress={reload} style={styles.retry}><Text style={styles.linkText}>{t('dash.engineer.liveCamera.retry')}</Text></Pressable>
            </View>
          ) : services.length === 0 ? (
            <View style={styles.empty}>
              <Wrench size={38} color={COLORS.slate[300]} />
              <Text style={styles.emptyTitle}>{t('labor.services.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('labor.services.emptyMessage')}</Text>
              {canAdd ? (
                <Pressable onPress={() => openForm(null)} style={[styles.addButton, { marginTop: 14 }]}>
                  <Plus size={15} color="#ffffff" />
                  <Text style={styles.addText}>{t('labor.action.addService')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.grid}>
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  width={cardWidth}
                  busy={busyId === service.id}
                  onEdit={() => openForm(service)}
                  onToggle={() => toggleActive(service)}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </DashboardShell>
  )
}

function ServiceCard({ service, width, busy, onEdit, onToggle }) {
  const { t, td } = useLanguage()
  const active = service.is_active !== false
  const offColor = ink('#be123c')
  return (
    <View style={[styles.card, { width }, active ? null : styles.cardOff]}>
      <View style={styles.cardTop}>
        <View style={styles.tradeIcon}><Wrench size={18} color={COLORS.brand[700]} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.trade} numberOfLines={1}>{td(service.trade)}</Text>
          <Text style={styles.skill} numberOfLines={1}>{service.skill_level ? td(service.skill_level) : t('labor.services.skillNotSet')}</Text>
        </View>
        <Tag
          label={active ? t('labor.active') : t('labor.inactive')}
          bg={active ? soft('#d1fae5', '#047857') : soft('#f1f5f9', '#475569')}
          fg={active ? ink('#065f46') : ink('#475569')}
        />
      </View>

      <View style={styles.figures}>
        <Figure label={t('labor.services.capacity')} value={service.worker_capacity} color={ink('#1f2937')} />
        <Figure label={t('labor.services.available')} value={service.available_workers} color={ink('#047857')} />
        <Figure label={t('labor.services.deployed')} value={service.allocated_workers} color={ink('#ea580c')} />
      </View>

      {service.notes ? <Text style={styles.notes} numberOfLines={2}>{td(service.notes)}</Text> : null}

      <View style={styles.actions}>
        <Pressable onPress={onEdit} style={[styles.action, styles.actionEdit]} accessibilityRole="button">
          <Pencil size={14} color={COLORS.slate[600]} />
          <Text style={styles.actionEditText}>{t('labor.action.edit')}</Text>
        </Pressable>
        <Pressable
          onPress={onToggle}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.action, active ? styles.actionOff : styles.actionOn, busy ? { opacity: 0.7 } : null]}
        >
          {busy ? <PianoLoader color={active ? offColor : '#ffffff'} height={14} /> : <Power size={14} color={active ? offColor : '#ffffff'} />}
          <Text style={active ? styles.actionOffText : styles.actionOnText}>{active ? t('labor.action.deactivate') : t('labor.action.activate')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function Figure({ label, value, color }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.figureValue, { color }]}>{value ?? 0}</Text>
    </View>
  )
}

const styles = createStyles((c) => ({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 20, letterSpacing: -0.4, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  subtitle: { marginTop: 2, fontSize: 12, lineHeight: 16, fontFamily: 'Inter_500Medium', color: c.textMuted },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, borderRadius: 11, backgroundColor: '#1f2937', paddingHorizontal: 12 },
  addText: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 13 },
  cardOff: { borderStyle: 'dashed', borderColor: c.borderStrong, opacity: 0.8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tradeIcon: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: c.brandSoft },
  trade: { fontSize: 15.5, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  skill: { marginTop: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textMuted },
  figures: { marginTop: 12, flexDirection: 'row', gap: 8, borderRadius: 12, backgroundColor: c.subtle, padding: 9 },
  figure: { flex: 1, alignItems: 'center' },
  figureLabel: { fontSize: 10.5, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  figureValue: { marginTop: 2, fontSize: 19, fontFamily: 'Manrope_800ExtraBold' },
  notes: { marginTop: 9, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', color: c.textMuted },
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
