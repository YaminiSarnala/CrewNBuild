// Shared Profile tab for all four roles: view + edit basics via
// completeUserProfile (same endpoint web profile settings use), language,
// help, and logout.
import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, Text, Pressable, TextInput, Alert, Linking } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Image } from 'expo-image'
import { Globe, LifeBuoy, LogOut, Wrench,Pencil, Camera, MessageCircle, Trash2, AlertTriangle } from 'lucide-react-native'
import DashboardShell, { Panel } from '../../components/DashboardShell'
import LanguageSheet from '../../components/LanguageSheet'
import Dialog, { DialogButton } from '../../components/Dialog'
import { completeUserProfile, deleteOwnAccount } from '../../api/auth'
import { useProfilePhoto } from '../../hooks/useProfilePhoto'
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

function Input({ label, ...props }) {
  return (
    <View style={styles.view2}>
      <Text style={styles.text}>{label}</Text>
      <TextInput
        {...props}
        style={styles.textInput}
        placeholderTextColor={COLORS.slate[400]}
      />
    </View>
  )
}

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
  const { changePhoto: changeAvatar, busy: avatarBusy } = useProfilePhoto()
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

  const [draft, setDraft] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    pincode: user?.pincode || '',
  })

  async function save() {
    setSaving(true)
    try {
      const result = await completeUserProfile(draft)
      dispatch(mergeUser(result?.user || result || draft))
      setEditing(false)
      Alert.alert('Profile updated', 'Your details have been saved.')
    } catch (error) {
      Alert.alert('Could not save', error?.response?.data?.detail || 'Please try again.')
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
          <Pressable
              // A Builder's details live in the full builder profile (company,
              // licence, portfolio…). Saving only these four fields through the
              // same PATCH /auth/complete-profile could blank the rest, so the
              // Builder edits them in Profile Settings, as on the web.
              onPress={() => (user?.role === 'CONTRACTOR' ? navigation.navigate('BuilderProfileSettings') : setEditing((e) => !e))}
              style={styles.pressable3}
            >
            <View style={[styles.view4, avatarBusy ? styles.pressable2 : null]}>
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
            <Text style={styles.text4}>{td(user?.name) || 'User'}</Text>
          <View style={styles.view7}>
            <Text style={styles.text5}>{ROLE_LABELS[user?.role] || user?.role || ''}</Text>
          </View>
        </View>

        <Panel
          title="My details"
          action={
            <Pressable onPress={() => setEditing((e) => !e)} style={styles.pressable3}>
              <Pencil size={12} color={COLORS.brand[700]} />
              <Text style={styles.text6}>{editing ? 'Cancel' : 'Edit'}</Text>
            </Pressable>
          }
        >
          {editing ? (
            <>
              <Input label="Full name" value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} placeholder="Your name" />
              <Input label="Phone" value={draft.phone} onChangeText={(phone) => setDraft((d) => ({ ...d, phone }))} placeholder="Phone number" keyboardType="phone-pad" />
              <Input label="Address" value={draft.address} onChangeText={(address) => setDraft((d) => ({ ...d, address }))} placeholder="Address" />
              <Input label="Pincode" value={draft.pincode} onChangeText={(pincode) => setDraft((d) => ({ ...d, pincode }))} placeholder="Pincode" keyboardType="number-pad" />
              <Pressable onPress={save} disabled={saving} style={[styles.pressable4, saving ? styles.pressable2 : null]}>
                <Text style={styles.text7}>{saving ? 'Saving…' : 'Save changes'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Row label="Email" value={user?.email} />
              <Row label="Phone" value={user?.phone} />
              <Row label="Address" value={td(user?.address)} />
              <Row label="Pincode" value={user?.pincode} />
              <Row label="Country" value={userCountry(user)} />
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
  textInput: { marginTop: 5.25, height: 38.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  view3: { marginBottom: 14, alignItems: 'center', borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 21 },
  pressable: { position: 'relative' },
  view4: { height: 70, width: 70, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.brandSoftStrong },
  pressable2: { opacity: 0.5 },
  view5: { height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center' },
  text3: { fontSize: 21, lineHeight: 28, fontWeight: '800', color: c.brandTextStrong },
  view6: { position: 'absolute', bottom: -3.5, right: -3.5, height: 24.5, width: 24.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#1a5038', borderWidth: 2, borderColor: '#ffffff' },
  text4: { marginTop: 10.5, fontSize: 15.75, lineHeight: 24.5, fontWeight: '800', color: c.text },
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
