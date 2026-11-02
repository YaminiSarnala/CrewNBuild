// Shared Profile tab for all four roles: view + edit basics via
// completeUserProfile (same endpoint web profile settings use), language,
// help, and logout.
import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, Text, Pressable, TextInput, Alert, Linking } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Image } from 'expo-image'
import { Globe, LifeBuoy, LogOut, Wrench,Pencil, Camera, MessageCircle, Trash2, AlertTriangle } from 'lucide-react-native'
import DashboardShell, { Panel } from '../../components/DashboardShell'
import LanguageSheet from '../../components/LanguageSheet'
import ProfilePhotoSheet from '../../components/ProfilePhotoSheet'
import EmailSection from '../../components/EmailSection'
import { PincodeAreaHint } from '../../components/form'
import { usePincodeAreaLookup } from '../../hooks/usePincodeAreaLookup'
import { baseFieldErrors, digitsOf, fieldErrorsFrom, isIndia, ownerProfileFields } from '../../utils/profileValidation'
import Dialog, { DialogButton } from '../../components/Dialog'
import { completeUserProfile, deleteOwnAccount } from '../../api/auth'
import { mergeUser, logoutUser } from '../../store/authSlice'
import { imageSource } from '../../api/client'
import { COLORS } from '../../theme/tokens'
import { userCountry } from '../../utils/countryConfig'
import { useLanguage } from '../../i18n/LanguageContext'
import { useNotifications } from '../../notifications/NotificationsContext'
import { useResponsive } from '../../hooks/useResponsive'
import { useComingSoon, SoonTag } from '../../components/ComingSoon'
import { COMING_SOON } from '../../config/modules'
import { createStyles } from '../../theme/createStyles'

const ROLE_LABELS = { OWNER: 'House Owner', CONTRACTOR: 'Builder', SUPPLIER: 'Supplier', ENGINEER: 'Site Engineer' }

function Row({ label, value }) {
  return (
    <View style={styles.view}>
      <Text style={styles.text}>{label}</Text>
      <Text style={styles.text2} numberOfLines={1}>{value || '—'}</Text>
    </View>
  )
}

function Input({ label, error, ...props }) {
  return (
    <View style={styles.view2}>
      <Text style={styles.text}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.textInput, error ? styles.inputError : null]}
        placeholderTextColor={COLORS.slate[400]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  )
}

const draftFrom = (user) => ({
  name: user?.name || '',
  phone: user?.phone || '',
  address: user?.address || '',
  pincode: user?.pincode || '',
})

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const { t, td } = useLanguage()
  const comingSoon = useComingSoon()
  const { markSectionRead } = useNotifications()
  const { gutter } = useResponsive()
  // Opening Profile clears its general notifications, as on the web.
  useFocusEffect(useCallback(() => { markSectionRead('profile') }, [markSectionRead]))
  const [languageOpen, setLanguageOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // As the web's DeleteAccountSection: the server deletes the account the token
  // belongs to; the session is only torn down once it reports success.
  async function confirmDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteOwnAccount()
      setDeleteOpen(false)
      dispatch(logoutUser())
    } catch (error) {
      const detail = error?.response?.data?.detail
      setDeleteError((typeof detail === 'string' && td(detail)) || t('account.deleteFailed'))
      setDeleting(false)
    }
  }

  const country = userCountry(user)
  const india = isIndia(country)
  const [draft, setDraft] = useState(() => draftFrom(user))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  // The post office picked for the typed pincode (saved as the account's location).
  const [branch, setBranch] = useState(null)
  // Every edit starts from the account as it is now.
  useEffect(() => {
    if (!editing) return
    setDraft(draftFrom(user))
    setErrors({})
    setFormError('')
    setBranch(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const onAreaResolved = useCallback((area) => {
    const branches = Array.isArray(area?.post_offices) ? area.post_offices : []
    setBranch(branches.length === 1 ? branches[0] : null)
  }, [])
  // The area is looked up while the pincode is typed (edit mode only).
  const pincodeLookup = usePincodeAreaLookup(editing ? draft.pincode : '', onAreaResolved, country)

  const change = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setErrors((current) => (current[field] ? { ...current, [field]: '' } : current))
    setFormError('')
  }

  async function save() {
    if (saving) return
    const nextErrors = baseFieldErrors(draft, country)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setFormError(t('mobile.profile.fixFields'))
      return
    }
    setSaving(true)
    setErrors({})
    setFormError('')
    const area = pincodeLookup.status === 'success' ? pincodeLookup.areaDetails : null
    const payload = {
      // The API resets an omitted owner budget / land area / floors, so the
      // owner's saved project answers travel with the form unchanged.
      ...(user?.role === 'OWNER' ? ownerProfileFields(user.owner_profile) : {}),
      name: draft.name.trim(),
      phone: india ? digitsOf(draft.phone) : draft.phone.trim(),
      address: draft.address.trim(),
      pincode: digitsOf(draft.pincode),
      country_of_residence: country,
      // The picked post office, else the area the pincode resolved to.
      ...(branch || area ? { location: branch?.display || branch?.name || area?.display || '' } : {}),
    }
    try {
      const result = await completeUserProfile(payload)
      dispatch(mergeUser(result?.user || result || payload))
      setEditing(false)
      Alert.alert('Profile updated', 'Your details have been saved.')
    } catch (error) {
      const fields = fieldErrorsFrom(error)
      setErrors(Object.fromEntries(Object.entries(fields).map(([key, text]) => [key, td(String(text))])))
      const detail = error?.response?.data?.detail
      const message = typeof detail === 'string' ? detail : detail?.message
      setFormError(message ? td(message) : 'Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function confirmLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => dispatch(logoutUser()) },
    ])
  }

  return (
    <>
      <DashboardShell onOpenNotifications={() => navigation.navigate('Notifications')}>
        <View style={[styles.view3, { marginHorizontal: gutter }]}>
          {/* The photo opens the same viewer as the header avatar. */}
          <Pressable onPress={() => setPhotoOpen(true)} accessibilityRole="button" accessibilityLabel={t('photo.title')} style={styles.pressable}>
            <View style={styles.view4}>
              {user?.profile_image_url ? (
                <Image source={imageSource(user.profile_image_url)} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <View style={styles.view5}>
                  <Text style={styles.text3}>{(user?.name || 'U').slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View style={styles.view6}>
              <Camera size={13} color="#fff" />
            </View>
          </Pressable>
            <Text style={styles.text4} numberOfLines={2}>{td(user?.name) || 'User'}</Text>
          <View style={styles.view7}>
            <Text style={styles.text5}>{ROLE_LABELS[user?.role] || user?.role || ''}</Text>
          </View>
        </View>

        <Panel
          title="My details"
          action={
            <Pressable
              // A Builder's details live in the full builder profile (company,
              // licence, portfolio…). Saving only these four fields through the
              // same PATCH /auth/complete-profile could blank the rest, so the
              // Builder edits them in Profile Settings, as on the web.
              onPress={() => (user?.role === 'CONTRACTOR' ? navigation.navigate('BuilderProfileSettings') : setEditing((e) => !e))}
              style={styles.pressable3}
            >
              <Pencil size={12} color={COLORS.brand[700]} />
              <Text style={styles.text6}>{editing ? 'Cancel' : 'Edit'}</Text>
            </Pressable>
          }
        >
          {editing ? (
            <>
              <Input label="Full name *" value={draft.name} onChangeText={(value) => change('name', value)} placeholder="Your name" maxLength={120} error={errors.name} />
              <Input
                label="Phone *"
                value={draft.phone}
                onChangeText={(value) => change('phone', india ? value.replace(/\D/g, '').slice(0, 10) : value)}
                placeholder={india ? '10 digit mobile number' : 'Phone number'}
                keyboardType="phone-pad"
                maxLength={india ? 10 : 15}
                error={errors.phone}
              />
              <Input label="Address *" value={draft.address} onChangeText={(value) => change('address', value)} placeholder="House no, street, area, city" maxLength={500} error={errors.address} />
              <Input
                label="Pincode *"
                value={draft.pincode}
                onChangeText={(value) => change('pincode', value.replace(/\D/g, '').slice(0, india ? 6 : 10))}
                placeholder={india ? '6 digit pincode' : 'Postal code'}
                keyboardType="number-pad"
                maxLength={india ? 6 : 10}
                error={errors.pincode}
              />
              {!errors.pincode ? <PincodeAreaHint lookupState={pincodeLookup} selectedBranch={branch} onSelectBranch={setBranch} /> : null}
              {errors.location ? <Text style={styles.fieldError}>{errors.location}</Text> : null}
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
              <Pressable onPress={save} disabled={saving} style={[styles.pressable4, saving ? styles.pressable2 : null]}>
                <Text style={styles.text7}>{saving ? 'Saving…' : 'Save changes'}</Text>
              </Pressable>
              <View style={styles.emailBlock}>
                <EmailSection />
              </View>
            </>
          ) : (
            <>
              <Row label="Email" value={user?.email} />
              <Row label="Phone" value={user?.phone} />
              <Row label="Address" value={td(user?.address)} />
              <Row label="Pincode" value={user?.pincode} />
              <Row label="Country" value={userCountry(user)} />
              {/* A phone-first account has no e-mail yet: it is added here. */}
              {!user?.email ? (
                <View style={styles.emailBlock}>
                  <EmailSection />
                </View>
              ) : null}
            </>
          )}
        </Panel>
        <Panel title="Settings">
            <Pressable onPress={() => navigation.navigate('Messages')} style={styles.pressable5}>
              <MessageCircle size={16} color={COLORS.brand[700]} />
              <Text style={styles.text8}>Messages</Text>
            </Pressable>
                    {(user?.role === 'OWNER' || user?.role === 'ENGINEER') && (
            <Pressable onPress={() => (COMING_SOON.technician ? comingSoon.show('technician') : navigation.navigate('BookTechnician'))} style={styles.pressable5}>
              <Wrench size={16} color={COLORS.brand[700]} />
              <Text style={styles.text8}>Book a technician</Text>
              {COMING_SOON.technician ? <SoonTag /> : null}
            </Pressable>
          )}
          <Pressable onPress={() => setLanguageOpen(true)} style={styles.pressable5}>
            <Globe size={16} color={COLORS.brand[700]} />
            <Text style={styles.text8}>Language</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('mailto:support@octabuild.com')} style={styles.pressable5}>
            <LifeBuoy size={16} color={COLORS.brand[700]} />
            <Text style={styles.text8}>Help & feedback</Text>
          </Pressable>
          <Pressable onPress={confirmLogout} style={styles.pressable6}>
            <LogOut size={16} color="#e11d48" />
            <Text style={styles.text9}>Sign out</Text>
          </Pressable>
        </Panel>

        <View style={[styles.deleteCard, { marginHorizontal: gutter }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.deleteTitle}>{t('account.delete')}</Text>
            <Text style={styles.deleteSub}>{t('account.deleteSub')}</Text>
          </View>
          <Pressable
            onPress={() => { setDeleteError(''); setDeleteOpen(true) }}
            accessibilityRole="button"
            style={styles.deleteButton}
          >
            <Trash2 size={14} color="#be123c" />
            <Text style={styles.deleteButtonText}>{t('account.delete')}</Text>
          </Pressable>
        </View>
      </DashboardShell>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
      <ProfilePhotoSheet visible={photoOpen} onClose={() => setPhotoOpen(false)} />
      <Dialog
        visible={deleteOpen}
        busy={deleting}
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <DialogButton label={t('dash.common.cancel')} look="secondary" disabled={deleting} onPress={() => setDeleteOpen(false)} />
            <DialogButton label={deleting ? t('account.deleting') : t('account.delete')} look="danger" disabled={deleting} onPress={confirmDelete} />
          </>
        }
      >
        <View style={styles.deleteHead}>
          <View style={styles.deleteIcon}>
            <AlertTriangle size={20} color="#dc2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.deleteDialogTitle}>{t('account.deleteTitle')}</Text>
            <Text style={styles.deleteDialogBody}>{t('account.deleteBody')}</Text>
          </View>
        </View>
        {!!deleteError && <Text style={styles.deleteError}>{deleteError}</Text>}
      </Dialog>
    </>
  )
}

const styles = createStyles((c) => ({
  view: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text: { fontSize: 10.5, lineHeight: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  text2: { marginLeft: 10.5, flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '800', color: c.text },
  view2: { marginTop: 10.5 },
  inputError: { borderColor: '#dc2626' },
  fieldError: { marginTop: 4, fontSize: 11.5, fontWeight: '600', color: '#dc2626' },
  formError: { marginBottom: 8, fontSize: 12.5, fontWeight: '700', color: '#dc2626' },
  emailBlock: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: c.borderSoft },
  textInput: { marginTop: 5.25, height: 38.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  view3: { marginBottom: 14, alignItems: 'center', borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 21 },
  pressable: { position: 'relative' },
  view4: { height: 70, width: 70, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.brandSoftStrong },
  pressable2: { opacity: 0.5 },
  view5: { height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center' },
  text3: { fontSize: 21, lineHeight: 28, fontWeight: '800', color: c.brandTextStrong },
  view6: { position: 'absolute', bottom: -3.5, right: -3.5, height: 24.5, width: 24.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#1a5038', borderWidth: 2, borderColor: '#ffffff' },
  // Full card width, text centred: a shrink-to-fit Text inside a centred column
  // is measured too narrow on some Android phones (vivo/Oppo system fonts) and
  // drops its last word — "Yamini Sarnala" painted as "Yamini".
  text4: { marginTop: 10.5, alignSelf: 'stretch', textAlign: 'center', fontSize: 15.75, lineHeight: 24.5, fontWeight: '800', color: c.text },
  view7: { marginTop: 5.25, borderRadius: 9999, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 3.5 },
  text5: { fontSize: 11, fontWeight: '800', color: c.brandTextStrong },
  pressable3: { flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  text6: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: c.brandText },
  pressable4: { marginTop: 14, height: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  text7: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  pressable5: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text8: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
  pressable6: { flexDirection: 'row', alignItems: 'center', gap: 10.5, paddingVertical: 10.5 },
  text9: { flex: 1, fontSize: 14, fontWeight: '800', color: c.roseTextSoft },
  deleteCard: {
    marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1,
    borderColor: '#fecdd3', backgroundColor: c.card, padding: 14,
  },
  deleteTitle: { fontSize: 14, fontWeight: '800', color: '#e11d48' },
  deleteSub: { marginTop: 2, fontSize: 11.5, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  deleteButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, borderRadius: 10, borderWidth: 1,
    borderColor: '#fda4af', backgroundColor: '#fff1f2', paddingHorizontal: 12,
  },
  deleteButtonText: { fontSize: 12, fontWeight: '800', color: '#be123c' },
  deleteHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  deleteIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2' },
  deleteDialogTitle: { fontSize: 17, fontWeight: '800', color: c.text },
  deleteDialogBody: { marginTop: 4, fontSize: 13.5, lineHeight: 19, color: c.textMuted },
  deleteError: { marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fecdd3', backgroundColor: '#fff1f2', padding: 10, fontSize: 13, fontWeight: '700', color: '#be123c' },
}))
