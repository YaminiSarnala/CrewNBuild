// Port of web pages/supplier/supplierProfilePanel.jsx (+ the dashboard's
// uploadSupplierProfileImage, uploadSupplierStoreLogo, saveSupplierProfileChanges
// and DeleteAccountSection). Opened from the header photo on every supplier tab.
//
// Reads like the web: plain information until Edit, then one form and one Save
// for the whole profile (PATCH /auth/complete-profile with the full payload).
// The photo uses PATCH /auth/profile-image and the store logo PATCH
// /auth/business-logo, both after POST /files/upload.
import { useState } from 'react'
import { View, Text, Pressable, Platform } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useDispatch, useSelector } from 'react-redux'
import { Camera, Pencil, Save, Store, Trash2, X } from 'lucide-react-native'
import { Panel, PanelState } from '../../components/DashboardShell'
import { ActionButton, InfoRow, Notice, Section, StackScreenShell } from '../../components/builder/BuilderUi'
import EmailSection from '../../components/EmailSection'
import { completeUserProfile, updateBusinessLogo, updateProfileImage } from '../../api/auth'
import { uploadLocalFile } from '../../api/upload'
import { imageUrl } from '../../api/client'
import { mergeUser } from '../../store/authSlice'
import { useLanguage } from '../../i18n/LanguageContext'
import { optionLabel, BUSINESS_TYPE_KEYS, DOCUMENT_TYPE_KEYS, SUPPLIER_CATEGORY_KEYS, SUPPLIER_TYPE_KEYS } from '../../i18n/optionKeys'
import { apiErrorText } from '../../utils/builderHelpers'
import { fieldErrorsFrom } from '../../utils/profileValidation'
import { useSupplier } from './SupplierContext'
import { listOf, supplierTextKeys } from './supplierKinds'
import { SupplierProfileFields, useSupplierProfileForm } from './supplierProfileForm'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

const uploadedUrl = (uploaded) => uploaded?.url || uploaded?.file_url || uploaded?.path || ''

// The server takes JPG, PNG and WebP only.
const MIME_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
function uploadableAsset(asset, fallbackName) {
  const ext = String(asset.fileName || asset.uri || '').split('?')[0].split('.').pop()?.toLowerCase()
  return {
    ...asset,
    mimeType: MIME_BY_EXT[ext] || asset.mimeType || 'image/jpeg',
    fileName: MIME_BY_EXT[ext] ? (asset.fileName || `${fallbackName}.${ext}`) : `${fallbackName}.jpg`,
  }
}

// The system photo picker needs no media permission (see useProfilePhoto).
async function pickSquareImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1],
    ...(Platform.OS === 'ios'
      ? { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }
      : null),
  })
  if (result.canceled) return null
  return result.assets?.[0] || null
}

// "Type: url" documents read as their type; anything else as its file name.
function documentLabel(entry, t) {
  const index = entry.indexOf(': ')
  if (index > 0) return optionLabel(t, DOCUMENT_TYPE_KEYS, entry.slice(0, index).trim())
  return entry.split('/').pop()
}

export default function SupplierProfileScreen({ navigation }) {
  const { t, td } = useLanguage()
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const { profile, setProfile, status, reload } = useSupplier()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState('')
  const [message, setMessage] = useState(null)
  const formState = useSupplierProfileForm(profile, user)
  const text = supplierTextKeys(formState.kind)

  const startEditing = () => {
    formState.reset(profile)
    setMessage(null)
    setEditing(true)
  }
  const cancelEditing = () => {
    formState.reset(profile)
    setMessage(null)
    setEditing(false)
  }

  async function save() {
    if (saving) return
    // Never save without the loaded profile: the payload is the whole profile.
    if (!profile) return
    const errors = formState.validate()
    if (Object.keys(errors).length) {
      formState.setErrors(Object.fromEntries(Object.entries(errors).map(([key, value]) => [key, td(String(value))])))
      setMessage({ tone: 'error', text: t('cp.val.completeFields') })
      return
    }
    setSaving(true)
    setMessage({ tone: 'info', text: t('dash.supplier.msg.savingProfile') })
    try {
      const updatedUser = await completeUserProfile(formState.payload())
      dispatch(mergeUser(updatedUser?.user || updatedUser || {}))
      const refreshed = await reload()
      if (refreshed) formState.reset(refreshed)
      setEditing(false)
      setMessage({ tone: 'success', text: t('dash.supplier.msg.profileSaved') })
    } catch (error) {
      const fields = fieldErrorsFrom(error)
      formState.setErrors(Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, td(String(value))])))
      setMessage({ tone: 'error', text: td(apiErrorText(error, t('dash.owner.profile.saveError'))) })
    } finally {
      setSaving(false)
    }
  }

  async function changeImage(kind) {
    if (uploading) return
    const asset = await pickSquareImage()
    if (!asset) return
    setUploading(kind)
    setMessage({ tone: 'info', text: kind === 'logo' ? t('dash.supplier.msg.uploadingStoreLogo') : t('dash.supplier.msg.uploadingProfileImage') })
    try {
      const fileUrl = uploadedUrl(await uploadLocalFile(uploadableAsset(asset, kind), `${kind}.jpg`))
      if (!fileUrl) throw new Error('upload answered without a url')
      if (kind === 'logo') {
        const updatedProfile = await updateBusinessLogo(fileUrl)
        setProfile((current) => ({ ...(current || {}), ...(updatedProfile || {}), store_logo_url: updatedProfile?.store_logo_url || fileUrl }))
        setMessage({ tone: 'success', text: t('dash.supplier.msg.storeLogoUpdated') })
      } else {
        const updated = await updateProfileImage(fileUrl)
        dispatch(mergeUser({ ...(updated?.user || updated || {}), profile_image_url: fileUrl }))
        setProfile((current) => ({ ...(current || {}), profile_image_url: fileUrl }))
        setMessage({ tone: 'success', text: t('dash.supplier.msg.profileImageUpdated') })
      }
    } catch (error) {
      setMessage({ tone: 'error', text: td(apiErrorText(error, kind === 'logo' ? t('dash.supplier.msg.storeLogoUploadFailed') : t('dash.common.profileImageUploadFailed'))) })
    } finally {
      setUploading('')
    }
  }

  // As the web's DeleteAccountSection: the button opens the Delete Account form.
  const openDeleteAccount = () => navigation.navigate('DeleteAccount')

  const photoUrl = profile?.profile_image_url || user?.profile_image_url
  const logoUrl = profile?.store_logo_url
  const documents = listOf(profile?.documents)
  const gallery = listOf(profile?.gallery)

  return (
    <StackScreenShell
      title={t('ui.profile')}
      subtitle={profile?.store_name ? td(profile.store_name) : t('role.supplier')}
      onBack={() => navigation.goBack()}
      refreshing={status === 'loading' && Boolean(profile)}
      onRefresh={editing ? undefined : reload}
    >
      <Section><Notice tone={message?.tone} text={message?.text} /></Section>

      <Panel title={t('dash.common.settings')}>
        <PanelState
          loading={!profile && (status === 'loading' || status === 'idle')}
          error={status === 'error' ? t('dash.supplier.profile.notLoaded') : ''}
          empty={false}
        >
          <View style={styles.photos}>
            {[
              ['photo', t('dash.common.changeImage'), photoUrl],
              ['logo', t('dash.supplier.profile.storeLogo'), logoUrl],
            ].map(([kind, label, url]) => (
              <Pressable key={kind} onPress={() => changeImage(kind)} disabled={Boolean(uploading) || !profile} style={styles.photo}>
                <View style={[styles.photoBox, uploading === kind ? styles.dim : null]}>
                  {url ? (
                    <Image source={{ uri: imageUrl(url) }} style={styles.photoImage} contentFit="cover" />
                  ) : kind === 'logo' ? (
                    <Store size={26} color={COLORS.brand[700]} />
                  ) : (
                    <Text style={styles.initial}>{(user?.name || 'S').slice(0, 1).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.camera}><Camera size={13} color="#fff" /></View>
                <Text style={styles.photoLabel} numberOfLines={2}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {profile ? (
            <>
              <Text style={styles.storeName}>{td(profile.store_name) || '—'}</Text>
              <Text style={styles.storeSub}>
                {`${td(profile.name) || t('role.supplier')} · ${td(profile.address) || '—'} · ${profile.pincode || '—'}`}
              </Text>
            </>
          ) : null}
        </PanelState>
      </Panel>

      {profile && editing ? (
        <>
          <SupplierProfileFields state={formState} email={user?.email || profile.email} />
          <Section style={styles.actions}>
            <ActionButton label={t('dash.common.cancel')} tone="outline" icon={X} onPress={cancelEditing} disabled={saving} />
            <ActionButton label={saving ? t('dash.common.saving') : t('dash.common.save')} icon={Save} busy={saving} onPress={save} />
          </Section>
        </>
      ) : null}

      {profile && !editing ? (
        <>
          <Panel
            title={t('dash.common.personalInformation')}
            action={<ActionButton small tone="dark" icon={Pencil} label={t('dash.common.edit')} onPress={startEditing} />}
          >
            <InfoRow label={t('dash.common.name')} value={td(profile.name)} />
            <InfoRow label={t('dash.common.phone')} value={profile.phone || user?.phone} />
            <InfoRow label={t('dash.common.email')} value={user?.email || profile.email} />
            <InfoRow label={t('dash.common.pincode')} value={profile.pincode} />
            <InfoRow label={t('dash.common.address')} value={td(profile.address)} />
          </Panel>

          <Panel
            title={t('dash.supplier.profile.businessInformation')}
            action={<ActionButton small tone="dark" icon={Pencil} label={t('dash.common.edit')} onPress={startEditing} />}
          >
            <InfoRow label={t(text.name)} value={td(profile.store_name)} />
            <InfoRow label={t('dash.supplier.profile.supplierCategory')} value={profile.supplier_category ? optionLabel(t, SUPPLIER_TYPE_KEYS, profile.supplier_category) : ''} />
            <InfoRow label={t('dash.supplier.profile.businessType')} value={profile.business_type ? optionLabel(t, BUSINESS_TYPE_KEYS, profile.business_type) : ''} />
            <InfoRow label={t('ps.gstin')} value={profile.gstin} />
            <InfoRow label={t('ps.pan')} value={profile.pan} />
            <InfoRow label={t('dash.supplier.profile.website')} value={profile.website} />
            <InfoRow label={t('dash.supplier.profile.registrationYear')} value={profile.registration_year} />
            <InfoRow label={t(text.supply)} value={listOf(profile.categories).map((item) => optionLabel(t, SUPPLIER_CATEGORY_KEYS, item)).join(', ')} />
            <InfoRow label={t('dash.msg.about')} value={td(profile.about)} />
            <InfoRow label={t(text.locations)} value={listOf(profile.delivery_locations).map(td).join(', ')} />
          </Panel>

          <Panel title={t('dash.common.documentGallery')}>
            {documents.length ? (
              documents.map((entry) => (
                <Text key={entry} style={styles.document} numberOfLines={1}>{documentLabel(entry, t)}</Text>
              ))
            ) : (
              <Text style={styles.none}>{t('dash.common.documentsNone')}</Text>
            )}
            {gallery.length ? (
              <View style={styles.gallery}>
                {gallery.map((image) => (
                  <Image key={image} source={{ uri: imageUrl(image) }} style={styles.galleryImage} contentFit="cover" />
                ))}
              </View>
            ) : null}
          </Panel>

          <Panel title={t('dash.common.email')}>
            <EmailSection />
          </Panel>

          <Panel title={t('account.delete')}>
            <Text style={styles.none}>{t('account.deleteSub')}</Text>
            <ActionButton label={t('account.delete')} tone="danger" icon={Trash2} onPress={openDeleteAccount} />
          </Panel>
        </>
      ) : null}
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  photos: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  photo: { alignItems: 'center', width: 104 },
  photoBox: { height: 80, width: 80, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.brandSoft },
  photoImage: { width: 80, height: 80 },
  dim: { opacity: 0.45 },
  initial: { fontSize: 28, fontFamily: 'Manrope_800ExtraBold', color: c.brandTextStrong },
  camera: { position: 'absolute', top: 60, right: 18, height: 24, width: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#1a5038', borderWidth: 2, borderColor: c.card },
  photoLabel: { marginTop: 8, textAlign: 'center', fontSize: 12, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  storeName: { marginTop: 14, textAlign: 'center', fontSize: 18, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  storeSub: { marginTop: 4, textAlign: 'center', fontSize: 12.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: 14 },
  document: { marginBottom: 6, borderRadius: 10, backgroundColor: c.subtle, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: 'Inter_700Bold', color: c.textSecondary, overflow: 'hidden' },
  none: { marginBottom: 10, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium', color: c.textMuted },
  gallery: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galleryImage: { height: 88, width: 88, borderRadius: 12 },
}))
