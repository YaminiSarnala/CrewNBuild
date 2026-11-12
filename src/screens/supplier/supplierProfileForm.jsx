// The supplier profile form, shared by Complete Profile and the Supplier
// Profile screen's edit mode. Port of web pages/auth/supplierProfileSteps.jsx
// (fields, wording per kind, documents) and CompleteProfilePage's supplier
// validation and payload, saved through PATCH /auth/complete-profile.
//
// The payload is always the whole profile, built on the loaded one, so a save
// never blanks a field this form does not show (logo, photo, gallery, documents
// an older screen saved without a type).
import { useCallback, useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { Check, FileText, Package } from 'lucide-react-native'
import { Panel } from '../../components/DashboardShell'
import { LabeledInput } from '../../components/builder/BuilderUi'
import { PincodeAreaHint, SelectField } from '../../components/form'
import { usePincodeAreaLookup } from '../../hooks/usePincodeAreaLookup'
import { uploadLocalFile } from '../../api/upload'
import { useLanguage } from '../../i18n/LanguageContext'
import { optionLabel, BUSINESS_TYPE_KEYS, DOCUMENT_TYPE_KEYS, SUPPLIER_CATEGORY_KEYS, SUPPLIER_TYPE_KEYS } from '../../i18n/optionKeys'
import { apiErrorText } from '../../utils/builderHelpers'
import { baseFieldErrors, digitsOf, isIndia } from '../../utils/profileValidation'
import { userCountry } from '../../utils/countryConfig'
import {
  MATERIAL, businessTypeOptions, includesValue, listOf, materialSupplyOptions, supplierDocumentsFor,
  supplierKind, supplierTextKeys, supplierTypeOptions, toggleValue,
} from './supplierKinds'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

const uploadedUrl = (uploaded) => uploaded?.url || uploaded?.file_url || uploaded?.path || ''

// "Type: url" entries are typed documents; anything else an older screen saved is kept as it is.
function splitDocuments(saved) {
  const typed = {}
  const untyped = []
  listOf(saved).forEach((entry) => {
    const index = entry.indexOf(': ')
    if (index > 0) typed[entry.slice(0, index).trim()] = entry.slice(index + 2).trim()
    else untyped.push(entry)
  })
  return { typed, untyped }
}

function stateFrom(profile, user) {
  const source = profile || {}
  const locations = listOf(source.delivery_locations).slice(0, 3)
  const { typed, untyped } = splitDocuments(source.documents)
  return {
    form: {
      name: source.name ?? user?.name ?? '',
      phone: source.phone ?? user?.phone ?? '',
      address: source.address ?? user?.address ?? '',
      pincode: String(source.pincode ?? user?.pincode ?? ''),
      store_name: source.store_name ?? '',
      about: source.about ?? '',
      gstin: source.gstin ?? '',
      pan: source.pan ?? '',
      website: source.website ?? '',
      business_type: source.business_type ?? '',
      supplier_category: source.supplier_category ?? '',
      registration_year: source.registration_year == null ? '' : String(source.registration_year),
    },
    locations: [...locations, '', '', ''].slice(0, 3),
    supplies: listOf(source.categories),
    documents: typed,
    untypedDocuments: untyped,
  }
}

/**
 * The form's state, checks and payload. `profile` is the loaded supplier
 * profile (null for a supplier who has none yet).
 */
export function useSupplierProfileForm(profile, user) {
  const { t } = useLanguage()
  const initial = useMemo(() => stateFrom(profile, user), [profile, user])
  const [form, setForm] = useState(initial.form)
  const [locations, setLocations] = useState(initial.locations)
  const [supplies, setSupplies] = useState(initial.supplies)
  const [documents, setDocuments] = useState(initial.documents)
  const [untypedDocuments, setUntypedDocuments] = useState(initial.untypedDocuments)
  const [errors, setErrors] = useState({})
  const [uploading, setUploading] = useState('')
  const [uploadMessage, setUploadMessage] = useState(null)
  const [branch, setBranch] = useState(null)
  const country = userCountry(user)
  // The category saved on the server is chosen once and shown read-only.
  const savedCategory = profile?.supplier_category || ''
  const kind = supplierKind(savedCategory || form.supplier_category)

  const reset = useCallback((nextProfile) => {
    const next = stateFrom(nextProfile, user)
    setForm(next.form)
    setLocations(next.locations)
    setSupplies(next.supplies)
    setDocuments(next.documents)
    setUntypedDocuments(next.untypedDocuments)
    setErrors({})
    setBranch(null)
  }, [user])

  const clearError = (field) => setErrors((current) => (current[field] ? { ...current, [field]: '' } : current))
  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    clearError(field)
  }
  const setLocation = (index, value) => {
    setLocations((current) => current.map((item, i) => (i === index ? value : item)))
    if (value.trim()) clearError('service_locations')
  }
  const toggleSupply = (value) => {
    setSupplies((current) => toggleValue(current, value))
    clearError('categories')
  }

  // A changed pincode is looked up; its post office becomes the location and,
  // while the first Delivery Location is empty, fills that too (as on the web).
  const savedPincode = String(profile?.pincode ?? user?.pincode ?? '')
  const onAreaResolved = useCallback((area) => {
    const branches = Array.isArray(area?.post_offices) ? area.post_offices : []
    const only = branches.length === 1 ? branches[0] : null
    setBranch(only)
    const display = only?.display || only?.name || area?.display || ''
    if (display) setLocations((current) => (current[0].trim() ? current : [display, ...current.slice(1)]))
  }, [])
  const pincodeLookup = usePincodeAreaLookup(form.pincode !== savedPincode ? form.pincode : '', onAreaResolved, country)

  async function uploadDocument(documentType) {
    if (uploading) return
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    const label = optionLabel(t, DOCUMENT_TYPE_KEYS, documentType)
    setUploading(documentType)
    setUploadMessage({ tone: 'info', text: t('ui.profile.uploadingDocument', { document: label }) })
    try {
      const url = uploadedUrl(await uploadLocalFile({ uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType }, asset.name || 'document.pdf'))
      if (!url) throw new Error('upload answered without a url')
      setDocuments((current) => ({ ...current, [documentType]: url }))
      setUploadMessage({ tone: 'success', text: t('ui.profile.documentUploaded', { document: label }) })
    } catch (error) {
      setUploadMessage({ tone: 'error', text: apiErrorText(error, t('ps.doc.uploadFailed')) })
    } finally {
      setUploading('')
    }
  }

  /** The web's supplier checks; returns the errors (empty when the form can be saved). */
  function validate() {
    const text = supplierTextKeys(kind)
    const next = Object.fromEntries(Object.entries(baseFieldErrors(form, country)).map(([key, value]) => [key, value]))
    if (!form.store_name.trim()) next.store_name = t(text.valName)
    if (!form.about.trim()) next.about = t(text.valAbout)
    if (!locations.some((item) => item.trim())) next.service_locations = t(text.valLocation)
    if (!supplies.length) next.categories = t(text.valSupply)
    if (!String(savedCategory || form.supplier_category).trim()) next.supplier_category = t('cp.val.supplierCategory')
    setErrors(next)
    return next
  }

  /** The whole profile, as CompleteProfilePage sends it. */
  function payload() {
    const current = profile || {}
    return {
      name: form.name.trim(),
      phone: isIndia(country) ? digitsOf(form.phone) : form.phone.trim(),
      address: form.address.trim(),
      pincode: digitsOf(form.pincode),
      country_of_residence: country,
      ...(pincodeLookup.status === 'success'
        ? { location: branch?.display || branch?.name || pincodeLookup.areaDetails?.display || '' }
        : {}),
      store_name: form.store_name.trim(),
      store_logo_url: current.store_logo_url || '',
      profile_image_url: current.profile_image_url || user?.profile_image_url || '',
      about: form.about.trim(),
      gstin: form.gstin.trim().toUpperCase(),
      pan: form.pan.trim().toUpperCase(),
      website: form.website.trim(),
      business_type: form.business_type,
      supplier_category: savedCategory || form.supplier_category,
      registration_year: form.registration_year === '' ? null : Number(form.registration_year),
      categories: supplies.join(', '),
      service_locations: locations.map((item) => item.trim()).filter(Boolean).join(', '),
      documents: [
        ...Object.entries(documents).map(([documentType, url]) => `${documentType}: ${url}`),
        ...untypedDocuments,
      ].join(', '),
      gallery: listOf(current.gallery).join(', '),
    }
  }

  return {
    form, update, locations, setLocation, supplies, toggleSupply, documents, uploadDocument, uploading, uploadMessage,
    errors, setErrors, validate, payload, reset, kind, savedCategory, country, pincodeLookup, branch, setBranch,
  }
}

function Chip({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.chip, on ? styles.chipOn : null]}>
      {on ? <Check size={13} color="#ffffff" /> : <Package size={13} color={COLORS.brand[700]} />}
      <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{label}</Text>
    </Pressable>
  )
}

/** The form's fields, in the web Complete Profile's order. */
export function SupplierProfileFields({ state, email }) {
  const { t } = useLanguage()
  const { form, update, locations, setLocation, supplies, toggleSupply, documents, uploadDocument, uploading, errors, kind, savedCategory, country, pincodeLookup, branch, setBranch } = state
  const text = supplierTextKeys(kind)
  const india = isIndia(country)
  const supplyChoices = materialSupplyOptions(supplies)
  const documentTypes = supplierDocumentsFor(kind || MATERIAL)

  return (
    <>
      <Panel title={t(text.storeDetails)}>
        <LabeledInput label={`${t('ps.name')} *`} value={form.name} onChangeText={(value) => update('name', value)} maxLength={120} error={errors.name} />
        {email ? <LabeledInput label={t('ps.email')} value={email} editable={false} /> : null}
        <LabeledInput
          label={`${t('ps.phone')} *`}
          value={form.phone}
          onChangeText={(value) => update('phone', india ? value.replace(/\D/g, '').slice(0, 10) : value)}
          keyboardType="phone-pad"
          maxLength={india ? 10 : 15}
          placeholder="9876543210"
          error={errors.phone}
        />
        <LabeledInput
          label={`${t('ps.pincode')} *`}
          value={form.pincode}
          onChangeText={(value) => update('pincode', value.replace(/\D/g, '').slice(0, india ? 6 : 10))}
          keyboardType="number-pad"
          maxLength={india ? 6 : 10}
          placeholder="500001"
          error={errors.pincode}
        />
        {!errors.pincode ? <PincodeAreaHint lookupState={pincodeLookup} selectedBranch={branch} onSelectBranch={setBranch} /> : null}
        <LabeledInput label={`${t('ps.address')} *`} value={form.address} onChangeText={(value) => update('address', value)} maxLength={500} placeholder={t('ps.addressPlaceholder')} error={errors.address} />
      </Panel>

      <Panel title={t(text.profile)}>
        <LabeledInput label={`${t(text.name)} *`} value={form.store_name} onChangeText={(value) => update('store_name', value)} maxLength={150} placeholder={t(text.namePlaceholder)} error={errors.store_name} />
        {savedCategory ? (
          <LabeledInput label={`${t('ps.supplierCategory')} *`} value={optionLabel(t, SUPPLIER_TYPE_KEYS, savedCategory)} editable={false} />
        ) : (
          <SelectField
            label={`${t('ps.supplierCategory')} *`}
            value={form.supplier_category}
            placeholder={t('ps.selectSupplierCategory')}
            options={supplierTypeOptions.map((value) => ({ value, label: optionLabel(t, SUPPLIER_TYPE_KEYS, value) }))}
            onChange={(value) => update('supplier_category', value)}
            invalid={Boolean(errors.supplier_category)}
            error={errors.supplier_category}
          />
        )}
        <SelectField
          label={t('ps.businessType')}
          value={form.business_type}
          placeholder={t('ps.selectBusinessType')}
          options={[...businessTypeOptions, ...(form.business_type && !businessTypeOptions.includes(form.business_type) ? [form.business_type] : [])]
            .map((value) => ({ value, label: optionLabel(t, BUSINESS_TYPE_KEYS, value) }))}
          onChange={(value) => update('business_type', value)}
        />
        <LabeledInput label={t('ps.gstin')} value={form.gstin} onChangeText={(value) => update('gstin', value.toUpperCase().replace(/\s/g, ''))} autoCapitalize="characters" maxLength={15} placeholder={t('ps.gstinPlaceholder')} error={errors.gstin} />
        <LabeledInput label={t('ps.pan')} value={form.pan} onChangeText={(value) => update('pan', value.toUpperCase().replace(/\s/g, ''))} autoCapitalize="characters" maxLength={10} placeholder={t('ps.panPlaceholder')} error={errors.pan} />
        <LabeledInput label={t('ps.website')} value={form.website} onChangeText={(value) => update('website', value.trim())} autoCapitalize="none" keyboardType="url" placeholder={t('ps.sup.websitePlaceholder')} error={errors.website} />
        <LabeledInput label={t('ps.registrationYear')} value={form.registration_year} onChangeText={(value) => update('registration_year', value.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={4} placeholder={t('ps.sup.yearPlaceholder')} error={errors.registration_year} />
        <LabeledInput label={`${t(text.about)} *`} value={form.about} onChangeText={(value) => update('about', value)} multiline maxLength={2000} placeholder={t(text.aboutPlaceholder)} error={errors.about} />
        <Text style={styles.label}>{`${t(text.locations)} *  `}<Text style={styles.labelNote}>{t('ps.minMax3')}</Text></Text>
        {locations.map((location, index) => (
          <LabeledInput
            key={index}
            value={location}
            onChangeText={(value) => setLocation(index, value)}
            placeholder={index === 0 ? t(text.primaryLocation) : t('ps.sup.optionalLocation', { index: index + 1 })}
          />
        ))}
        {errors.service_locations ? <Text style={styles.error}>{errors.service_locations}</Text> : null}
      </Panel>

      <Panel title={`${t(text.supply)} *`}>
        <Text style={styles.sub}>{t(text.supplySub)}</Text>
        <View style={styles.chips}>
          {supplyChoices.map((choice) => (
            <Chip key={choice} label={optionLabel(t, SUPPLIER_CATEGORY_KEYS, choice)} on={includesValue(supplies, choice)} onPress={() => toggleSupply(choice)} />
          ))}
        </View>
        {errors.categories ? <Text style={styles.error}>{errors.categories}</Text> : null}
      </Panel>

      <Panel title={t('ps.documents')}>
        <Text style={styles.sub}>{t(text.documentsHint)}</Text>
        {documentTypes.map((documentType) => {
          const done = Boolean(documents[documentType])
          const busy = uploading === documentType
          return (
            <Pressable
              key={documentType}
              onPress={() => uploadDocument(documentType)}
              disabled={Boolean(uploading)}
              style={[styles.doc, done ? styles.docDone : null, uploading && !busy ? styles.dim : null]}
            >
              <View style={[styles.docIcon, done ? styles.docIconDone : null]}>
                <FileText size={16} color={COLORS.brand[700]} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.docTitle} numberOfLines={1}>{optionLabel(t, DOCUMENT_TYPE_KEYS, documentType)}</Text>
                <Text style={[styles.docState, done ? styles.docStateDone : null]}>
                  {busy ? t('ps.doc.actionUploading') : done ? t('ps.doc.uploaded') : t('ps.doc.none')}
                </Text>
              </View>
              <Text style={[styles.docAction, done ? styles.docActionDone : null]}>
                {done ? t('ps.doc.actionUploaded') : t('ps.doc.actionUpload')}
              </Text>
            </Pressable>
          )
        })}
      </Panel>
    </>
  )
}

const styles = createStyles((c) => ({
  flex: { flex: 1, minWidth: 0 },
  label: { marginBottom: 6, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  labelNote: { fontSize: 11, fontFamily: 'Inter_500Medium', color: c.textMuted },
  sub: { marginBottom: 10, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', color: c.textMuted },
  error: { marginTop: -4, marginBottom: 6, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#dc2626' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 9999, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { borderColor: '#1a5038', backgroundColor: '#1a5038' },
  chipText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: c.text },
  chipTextOn: { color: '#ffffff' },
  doc: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12 },
  docDone: { borderColor: c.brandBorder || '#c3dccd', backgroundColor: c.brandSoft },
  dim: { opacity: 0.5 },
  docIcon: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: c.subtle },
  docIconDone: { backgroundColor: c.brandSoftStrong },
  docTitle: { fontSize: 14, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  docState: { marginTop: 2, fontSize: 12, fontFamily: 'Inter_500Medium', color: c.textFaint },
  docStateDone: { color: c.brandText },
  docAction: { borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontFamily: 'Inter_700Bold', color: c.brandText, overflow: 'hidden' },
  docActionDone: { borderColor: '#1a5038', backgroundColor: '#1a5038', color: '#ffffff' },
}))
