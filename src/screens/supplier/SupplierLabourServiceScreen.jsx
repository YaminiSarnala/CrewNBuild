// Add or edit one labour service: port of the web SupplierLaborSections
// ServiceForm, as a full screen with a back arrow instead of a dialog.
//
//   route.params.serviceId   edit that service (read from LabourContext)
//   no serviceId             add a service for a trade not offered yet
//
// The trade is chosen once (tap one of the backend's trades); after that only
// the skill level, worker capacity and notes change. The backend checks the
// same rules and its own message is shown when it refuses.
import { useState } from 'react'
import { View, Text, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { Check, Save } from 'lucide-react-native'
import { ActionButton, Notice, Section, StackScreenShell } from '../../components/builder/BuilderUi'
import { FieldLabel, TextField } from '../../components/form'
import { toast } from '../../components/Toast'
import { createLabourService, labourErrorMessage, updateLabourService } from '../../api/labour'
import { useLanguage } from '../../i18n/LanguageContext'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import { NumberField } from './products/productParts'
import { useLabour } from './labour/LabourContext'

export default function SupplierLabourServiceScreen({ navigation, route }) {
  const { t, td } = useLanguage()
  const { services, trades, upsertService, reload } = useLabour()
  const serviceId = route?.params?.serviceId
  const service = serviceId ? services.find((row) => String(row.id) === String(serviceId)) : null
  const editing = Boolean(serviceId)

  const [form, setForm] = useState(() => ({
    trade: service?.trade || '',
    skill_level: service?.skill_level || '',
    worker_capacity: service ? String(service.worker_capacity ?? '') : '',
    notes: service?.notes || '',
  }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => (current[field] ? { ...current, [field]: '' } : current))
  }

  if (editing && !service) {
    return (
      <StackScreenShell title={t('labor.services.title')} onBack={() => navigation.goBack()}>
        <Section><Notice tone="error" text={t('labor.error.serviceUpdate')} /></Section>
      </StackScreenShell>
    )
  }

  const offered = new Set(services.map((row) => row.trade))
  const addableTrades = trades.filter((trade) => !offered.has(trade))
  const title = editing ? t('labor.services.editTitle', { name: td(service.trade) }) : t('labor.services.addTitle')

  const save = async () => {
    const next = {}
    const capacity = Number(form.worker_capacity)
    if (!editing && !form.trade) next.trade = t('labor.error.chooseTrade')
    if (String(form.worker_capacity).trim() === '' || !Number.isInteger(capacity) || capacity < 0) next.worker_capacity = t('labor.error.capacity')
    setErrors(next)
    const failing = Object.values(next).filter(Boolean)
    if (failing.length) {
      toast.error(failing.length === 1 ? failing[0] : t('cp.val.completeFields'))
      return
    }
    setSaving(true)
    try {
      const payload = { skill_level: form.skill_level.trim(), worker_capacity: capacity, notes: form.notes }
      const saved = editing ? await updateLabourService(service.id, payload) : await createLabourService({ ...payload, trade: form.trade })
      upsertService(saved)
      toast.success(t(editing ? 'labor.msg.updated' : 'labor.msg.added', { name: saved?.trade || form.trade }))
      reload()
      navigation.goBack()
    } catch (failure) {
      toast.error(labourErrorMessage(failure, t('labor.error.serviceSave')))
      setSaving(false)
    }
  }

  return (
    <StackScreenShell title={title} onBack={() => navigation.goBack()}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
    >

      <Section>
        <View style={styles.card}>
          <FieldLabel>{t('labor.field.trade')}</FieldLabel>
          {editing ? (
            <View style={styles.fixedTrade}>
              <Text style={styles.fixedTradeText}>{td(service.trade)}</Text>
            </View>
          ) : addableTrades.length ? (
            <View style={styles.trades}>
              {addableTrades.map((trade) => {
                const selected = form.trade === trade
                return (
                  <Pressable
                    key={trade}
                    onPress={() => set('trade')(trade)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[styles.trade, selected ? styles.tradeOn : errors.trade ? styles.tradeInvalid : null]}
                  >
                    {selected ? <Check size={14} color={COLORS.brand[700]} /> : null}
                    <Text style={[styles.tradeText, selected ? styles.tradeTextOn : null]}>{td(trade)}</Text>
                  </Pressable>
                )
              })}
            </View>
          ) : (
            <Text style={styles.muted}>{t('labor.field.selectTrade')}</Text>
          )}
          {errors.trade ? <Text style={styles.fieldError}>{errors.trade}</Text> : null}

          <View style={{ marginTop: 16 }}>
            <TextField
              label={t('labor.field.skillLevel')}
              value={form.skill_level}
              onChangeText={set('skill_level')}
              maxLength={20}
              placeholder={t('labor.field.skillLevelPh')}
            />
            <View style={{ marginBottom: 12 }}>
              <NumberField
                label={t('labor.field.workerCapacity')}
                value={form.worker_capacity}
                onChangeText={set('worker_capacity')}
                decimal={false}
                error={errors.worker_capacity}
              />
            </View>
            <TextField label={t('labor.field.notes')} value={form.notes} onChangeText={set('notes')} multiline />
          </View>

          <View style={styles.buttons}>
            <ActionButton label={t('labor.action.cancel')} tone="outline" onPress={() => navigation.goBack()} disabled={saving} style={{ flex: 1 }} />
            <ActionButton
              label={editing ? t('labor.action.saveChanges') : t('labor.action.addService')}
              icon={Save}
              onPress={save}
              busy={saving}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </Section>
      </ScrollView>
      </KeyboardAvoidingView>
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  trades: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trade: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 13 },
  tradeOn: { borderColor: '#1f6b45', backgroundColor: c.brandSoft },
  tradeInvalid: { borderColor: '#dc2626' },
  tradeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  tradeTextOn: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  fixedTrade: { height: 46, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 13 },
  fixedTradeText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  muted: { fontSize: 13, fontFamily: 'Inter_500Medium', color: c.textMuted },
  fieldError: { marginTop: 6, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.roseText },
  buttons: { marginTop: 18, flexDirection: 'row', gap: 10 },
}))
