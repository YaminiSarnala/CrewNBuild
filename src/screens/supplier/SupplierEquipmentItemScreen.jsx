// Add or edit one machine: port of the web SupplierEquipmentSections ItemForm,
// as a full screen with a back arrow instead of a dialog.
//
//   route.params.itemId   edit that item (read from EquipmentContext)
//   no itemId             add a new one
//
// Mode decides which prices show: RENT the four rental rates (at least one),
// BUY the sale price, RENT_BUY both. Prices the chosen mode does not use are
// sent as null, so a BUY item keeps no stale rental rate. The backend checks
// the same rules and its own message is shown when it refuses.
import { useState } from 'react'
import { View, Text, Pressable, Platform, ActivityIndicator } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Camera, Save, Trash2 } from 'lucide-react-native'
import { ActionButton, Notice, Section, StackScreenShell } from '../../components/builder/BuilderUi'
import { FieldLabel, TextField } from '../../components/form'
import { toast } from '../../components/Toast'
import { createEquipmentItem, equipmentErrorMessage, updateEquipmentItem } from '../../api/equipment'
import { uploadLocalFile } from '../../api/upload'
import { useLanguage } from '../../i18n/LanguageContext'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'
import { NumberField, currencySymbol, useSupplierCountry } from './products/productParts'
import { useEquipment } from './equipment/EquipmentContext'
import { EQUIPMENT_CONDITIONS, EQUIPMENT_MODES, EquipmentImage, RATE_UNITS } from './equipment/equipmentParts'

const EMPTY_FORM = {
  name: '', category: '', brand: '', model: '', specifications: '', condition: 'NEW', mode: 'RENT', quantity_total: '',
  hourly_rate: '', daily_rate: '', weekly_rate: '', monthly_rate: '', sale_price: '', image_url: '',
}

const formFrom = (item) => (item
  ? Object.fromEntries(Object.keys(EMPTY_FORM).map((key) => [key, item[key] == null ? '' : String(item[key])]))
  : EMPTY_FORM)

// The server takes JPG, PNG and WebP only.
const MIME_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
function uploadableAsset(asset) {
  const ext = String(asset.fileName || asset.uri || '').split('?')[0].split('.').pop()?.toLowerCase()
  return {
    ...asset,
    mimeType: MIME_BY_EXT[ext] || 'image/jpeg',
    fileName: MIME_BY_EXT[ext] ? (asset.fileName || `equipment.${ext}`) : 'equipment.jpg',
  }
}
const uploadedUrl = (uploaded) => uploaded?.url || uploaded?.file_url || uploaded?.path || ''

// A price box's text as the API wants it: empty is "no price".
const priceOf = (value) => (String(value).trim() === '' ? null : Number(value))
const badPrice = (value) => {
  const price = priceOf(value)
  return price !== null && (!Number.isFinite(price) || price <= 0)
}

export default function SupplierEquipmentItemScreen({ navigation, route }) {
  const { t } = useLanguage()
  const country = useSupplierCountry()
  const { items, upsertItem, reload } = useEquipment()
  const itemId = route?.params?.itemId
  const item = itemId ? items.find((row) => String(row.id) === String(itemId)) : null
  const editing = Boolean(itemId)

  const [form, setForm] = useState(() => formFrom(item))
  const [imagePreview, setImagePreview] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (field) => (value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => (current[field] ? { ...current, [field]: '' } : current))
  }
  const rentMode = form.mode === 'RENT' || form.mode === 'RENT_BUY'
  const buyMode = form.mode === 'BUY' || form.mode === 'RENT_BUY'
  const symbol = currencySymbol(country)
  const title = editing ? t('labor.services.editTitle', { name: item?.name || '' }) : t('equipment.action.add')

  if (editing && !item) {
    return (
      <StackScreenShell title={t('equipment.inventory.title')} onBack={() => navigation.goBack()}>
        <Section><Notice tone="error" text={t('equipment.error.update')} /></Section>
      </StackScreenShell>
    )
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      ...(Platform.OS === 'ios'
        ? { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }
        : null),
    })
    const asset = result.canceled ? null : result.assets?.[0]
    if (!asset) return
    setUploading(true)
    try {
      const url = uploadedUrl(await uploadLocalFile(uploadableAsset(asset), 'equipment.jpg'))
      if (!url) throw new Error('no url')
      setForm((current) => ({ ...current, image_url: url }))
      setImagePreview(asset.uri)
    } catch (failure) {
      toast.error(equipmentErrorMessage(failure, t('equipment.error.imageUpload')))
    } finally {
      setUploading(false)
    }
  }

  const removeImage = () => {
    setForm((current) => ({ ...current, image_url: '' }))
    setImagePreview('')
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = t('mobile.equipment.needName')
    if (!form.category.trim()) next.category = t('mobile.equipment.needCategory')
    const quantity = Number(form.quantity_total)
    if (String(form.quantity_total).trim() === '' || !Number.isInteger(quantity) || quantity < 0) next.quantity_total = t('equipment.error.quantityZero')
    if (rentMode) {
      RATE_UNITS.forEach((rate) => { if (badPrice(form[rate.field])) next[rate.field] = t('mobile.equipment.amountAboveZero') })
      if (!RATE_UNITS.some((rate) => priceOf(form[rate.field]) !== null)) next.rates = t('equipment.error.needRate')
    }
    if (buyMode) {
      if (priceOf(form.sale_price) === null) next.sale_price = t('equipment.error.needSalePrice')
      else if (badPrice(form.sale_price)) next.sale_price = t('mobile.equipment.amountAboveZero')
    }
    return next
  }

  const save = async () => {
    const problems = validate()
    setErrors(problems)
    const failing = Object.values(problems).filter(Boolean)
    if (failing.length) {
      toast.error(failing.length === 1 ? failing[0] : t('cp.val.completeFields'))
      return
    }
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      brand: form.brand,
      model: form.model,
      specifications: form.specifications,
      condition: form.condition,
      mode: form.mode,
      quantity_total: Number(form.quantity_total),
      image_url: form.image_url || null,
      ...Object.fromEntries(RATE_UNITS.map((rate) => [rate.field, rentMode ? priceOf(form[rate.field]) : null])),
      sale_price: buyMode ? priceOf(form.sale_price) : null,
    }
    setSaving(true)
    try {
      const saved = editing ? await updateEquipmentItem(item.id, payload) : await createEquipmentItem(payload)
      upsertItem(saved)
      toast.success(t(editing ? 'labor.msg.updated' : 'labor.msg.added', { name: saved?.name || payload.name }))
      reload()
      navigation.goBack()
    } catch (failure) {
      toast.error(equipmentErrorMessage(failure, t('equipment.error.save')))
      setSaving(false)
    }
  }

  return (
    <StackScreenShell title={title} onBack={() => navigation.goBack()}>
      <Section>
        <View style={styles.card}>
          {/* Picture */}
          <FieldLabel>{t('equipment.field.image')}</FieldLabel>
          <View style={styles.imageRow}>
            <View style={styles.imageBox}>
              <EquipmentImage src={imagePreview || form.image_url} height={88} />
              {uploading ? (
                <View style={styles.imageBusy}><ActivityIndicator color="#ffffff" /></View>
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Pressable onPress={pickImage} disabled={uploading || saving} style={[styles.pick, uploading ? { opacity: 0.6 } : null]} accessibilityRole="button">
                <Camera size={15} color={COLORS.brand[700]} />
                <Text style={styles.pickText} numberOfLines={1}>{uploading ? t('equipment.uploading') : form.image_url ? t('mobile.equipment.changePhoto') : t('mobile.equipment.choosePhoto')}</Text>
              </Pressable>
              {form.image_url && !uploading ? (
                <Pressable onPress={removeImage} style={styles.remove} accessibilityRole="button">
                  <Trash2 size={14} color={COLORS.slate[500]} />
                  <Text style={styles.removeText}>{t('mobile.equipment.removePhoto')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={{ marginTop: 16 }}>
            <TextField label={t('equipment.field.name')} value={form.name} onChangeText={set('name')} maxLength={120} placeholder={t('equipment.field.namePh')} error={errors.name} />
            <TextField label={t('equipment.field.category')} value={form.category} onChangeText={set('category')} maxLength={60} placeholder={t('equipment.field.categoryPh')} error={errors.category} />
            <View style={styles.twoCol}>
              <TextField label={t('equipment.field.brand')} value={form.brand} onChangeText={set('brand')} maxLength={80} containerStyle={{ flex: 1, marginBottom: 12 }} />
              <TextField label={t('equipment.field.model')} value={form.model} onChangeText={set('model')} maxLength={80} containerStyle={{ flex: 1, marginBottom: 12 }} />
            </View>
            <TextField label={t('equipment.field.specifications')} value={form.specifications} onChangeText={set('specifications')} multiline />

            <FieldLabel>{t('equipment.field.condition')}</FieldLabel>
            <Choices options={EQUIPMENT_CONDITIONS} value={form.condition} onChange={set('condition')} />

            <FieldLabel>{t('equipment.field.mode')}</FieldLabel>
            <Choices options={EQUIPMENT_MODES} value={form.mode} onChange={set('mode')} />

            <View style={{ marginBottom: 12 }}>
              <NumberField
                label={t('equipment.field.quantity')}
                value={form.quantity_total}
                onChangeText={set('quantity_total')}
                decimal={false}
                error={errors.quantity_total}
              />
            </View>
          </View>

          {rentMode ? (
            <View style={[styles.group, errors.rates ? styles.groupInvalid : null]}>
              <Text style={styles.groupTitle}>{t('equipment.field.rentalRates')}</Text>
              <View style={styles.rateGrid}>
                {RATE_UNITS.map((rate) => (
                  <View key={rate.unit} style={styles.rateCell}>
                    <NumberField
                      label={t(rate.rateKey)}
                      value={form[rate.field]}
                      onChangeText={(value) => {
                        set(rate.field)(value)
                        setErrors((current) => (current.rates ? { ...current, rates: '' } : current))
                      }}
                      prefix={symbol}
                      error={errors[rate.field]}
                    />
                  </View>
                ))}
              </View>
              {errors.rates ? <Text style={styles.groupError}>{errors.rates}</Text> : null}
            </View>
          ) : null}

          {buyMode ? (
            <View style={[styles.group, rentMode ? { marginTop: 12 } : null]}>
              <NumberField
                label={t('equipment.field.salePrice')}
                value={form.sale_price}
                onChangeText={set('sale_price')}
                prefix={symbol}
                error={errors.sale_price}
              />
            </View>
          ) : null}

          <View style={styles.buttons}>
            <ActionButton label={t('labor.action.cancel')} tone="outline" onPress={() => navigation.goBack()} disabled={saving} style={{ flex: 1 }} />
            <ActionButton
              label={editing ? t('labor.action.saveChanges') : t('equipment.action.add')}
              icon={Save}
              onPress={save}
              busy={saving}
              disabled={uploading}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </Section>
    </StackScreenShell>
  )
}

/** One-tap choice between a few values (condition, mode). */
function Choices({ options, value, onChange }) {
  const { t } = useLanguage()
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.choice, selected ? styles.choiceOn : null]}
          >
            <Text style={[styles.choiceText, selected ? styles.choiceTextOn : null]} numberOfLines={1}>{t(option.labelKey)}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = createStyles((c) => ({
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  imageBox: { width: 104, overflow: 'hidden', borderRadius: 12 },
  imageBusy: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.35)' },
  pick: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft, paddingHorizontal: 12 },
  pickText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  remove: { height: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  removeText: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  // Inputs line up even when one label wraps onto a second line.
  twoCol: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  choices: { marginBottom: 12, flexDirection: 'row', gap: 8 },
  choice: { flex: 1, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 8 },
  choiceOn: { borderColor: '#1f6b45', backgroundColor: c.brandSoft },
  choiceText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  choiceTextOn: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  group: { borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 12 },
  groupTitle: { marginBottom: 10, fontSize: 11.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase', color: c.textMuted },
  rateGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', rowGap: 10, columnGap: 10 },
  rateCell: { width: '47%', flexGrow: 1 },
  groupInvalid: { borderColor: '#dc2626' },
  groupError: { marginTop: 8, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.roseText },
  buttons: { marginTop: 18, flexDirection: 'row', gap: 10 },
}))
