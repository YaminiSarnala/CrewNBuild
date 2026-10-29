// Shared Profile tab for all four roles: view + edit basics via
// completeUserProfile (same endpoint web profile settings use), language,
// help, and logout.
import { useState } from 'react'
import { View, Text, Pressable, TextInput, Alert, Linking } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Image } from 'expo-image'
import { Globe, LifeBuoy, LogOut, Wrench,Pencil, Camera, MessageCircle } from 'lucide-react-native'
import DashboardShell, { Panel } from '../../components/DashboardShell'
import LanguageSheet from '../../components/LanguageSheet'
import { completeUserProfile, updateProfileImage } from '../../api/auth'
import { uploadLocalFile } from '../../api/upload'
import * as ImagePicker from 'expo-image-picker'
import { mergeUser, logoutUser } from '../../store/authSlice'
import { imageUrl } from '../../api/client'
import { COLORS } from '../../theme/tokens'

const ROLE_LABELS = { OWNER: 'House Owner', CONTRACTOR: 'Builder', SUPPLIER: 'Supplier', ENGINEER: 'Site Engineer' }

function Row({ label, value }) {
  return (
    <View className="flex-row items-center justify-between border-b border-slate-100 py-3">
      <Text className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</Text>
      <Text className="ml-3 flex-1 text-right text-[13px] font-extrabold text-graphite" numberOfLines={1}>{value || '—'}</Text>
    </View>
  )
}

function Input({ label, ...props }) {
  return (
    <View className="mt-3">
      <Text className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</Text>
      <TextInput
        {...props}
        className="mt-1.5 h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite"
        placeholderTextColor={COLORS.slate[400]}
      />
    </View>
  )
}

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
    const [avatarBusy, setAvatarBusy] = useState(false)

  async function changeAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to change your profile picture.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] })
    if (result.canceled) return
    setAvatarBusy(true)
    try {
      const uploaded = await uploadLocalFile(result.assets[0], 'profile.jpg')
      const fileUrl = uploaded.url || uploaded.file_url || uploaded.path
      const updated = await updateProfileImage(fileUrl)
      dispatch(mergeUser(updated?.user || updated || { profile_image_url: fileUrl }))
    } catch (error) {
      Alert.alert('Could not update photo', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setAvatarBusy(false)
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
        <View className="mb-4 items-center rounded-3xl border border-slate-200 bg-white p-6">
                      <Pressable onPress={changeAvatar} disabled={avatarBusy} className="relative">
            <View className={`h-20 w-20 overflow-hidden rounded-full bg-brand-100 ${avatarBusy ? 'opacity-50' : ''}`}>
              {user?.profile_image_url ? (
                <Image source={{ uri: imageUrl(user.profile_image_url) }} style={{ width: 80, height: 80 }} contentFit="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Text className="text-2xl font-extrabold text-brand-800">{(user?.name || 'U').slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
            </View>
            <View className="absolute -bottom-1 -right-1 h-7 w-7 items-center justify-center rounded-full bg-brand-700 border-2 border-white">
              <Camera size={13} color="#fff" />
            </View>
          </Pressable>
            <Text className="mt-3 text-lg font-extrabold text-graphite">{user?.name || 'User'}</Text>
          <View className="mt-1.5 rounded-full bg-brand-50 px-3 py-1">
            <Text className="text-[11px] font-extrabold text-brand-800">{ROLE_LABELS[user?.role] || user?.role || ''}</Text>
          </View>
        </View>

        <Panel
          title="My details"
          action={
            <Pressable onPress={() => setEditing((e) => !e)} className="flex-row items-center gap-1">
                            // A Builder's details live in the full builder profile (company,
              // licence, portfolio…). Saving only these four fields through the
              // same PATCH /auth/complete-profile could blank the rest, so the
              // Builder edits them in Profile Settings, as on the web.
              onPress={() => (user?.role === 'CONTRACTOR' ? navigation.navigate('BuilderProfileSettings') : setEditing((e) => !e))}
              <Pencil size={12} color={COLORS.brand[700]} />
              <Text className="text-xs font-extrabold text-brand-700">{editing ? 'Cancel' : 'Edit'}</Text>
            </Pressable>
          }
        >
          {editing ? (
            <>
              <Input label="Full name" value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} placeholder="Your name" />
              <Input label="Phone" value={draft.phone} onChangeText={(phone) => setDraft((d) => ({ ...d, phone }))} placeholder="Phone number" keyboardType="phone-pad" />
              <Input label="Address" value={draft.address} onChangeText={(address) => setDraft((d) => ({ ...d, address }))} placeholder="Address" />
              <Input label="Pincode" value={draft.pincode} onChangeText={(pincode) => setDraft((d) => ({ ...d, pincode }))} placeholder="Pincode" keyboardType="number-pad" />
              <Pressable onPress={save} disabled={saving} className={`mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 ${saving ? 'opacity-50' : ''}`}>
                <Text className="text-[13px] font-extrabold text-white">{saving ? 'Saving…' : 'Save changes'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Row label="Email" value={user?.email} />
              <Row label="Phone" value={user?.phone} />
              <Row label="Address" value={user?.address} />
              <Row label="Pincode" value={user?.pincode} />
              <Row label="Country" value={user?.country} />
            </>
          )}
        </Panel>
          <Pressable onPress={() => navigation.navigate('Messages')} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
            <MessageCircle size={16} color={COLORS.brand[700]} />
            <Text className="flex-1 text-[14px] font-extrabold text-graphite">Messages</Text>
          </Pressable>
        <Panel title="Settings">
                    {(user?.role === 'OWNER' || user?.role === 'ENGINEER') && (
            <Pressable onPress={() => navigation.navigate('BookTechnician')} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
              <Wrench size={16} color={COLORS.brand[700]} />
              <Text className="flex-1 text-[14px] font-extrabold text-graphite">Book a technician</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setLanguageOpen(true)} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
            <Globe size={16} color={COLORS.brand[700]} />
            <Text className="flex-1 text-[14px] font-extrabold text-graphite">Language</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('mailto:support@octabuild.com')} className="flex-row items-center gap-3 border-b border-slate-100 py-3">
            <LifeBuoy size={16} color={COLORS.brand[700]} />
            <Text className="flex-1 text-[14px] font-extrabold text-graphite">Help & feedback</Text>
          </Pressable>
          <Pressable onPress={confirmLogout} className="flex-row items-center gap-3 py-3">
            <LogOut size={16} color="#e11d48" />
            <Text className="flex-1 text-[14px] font-extrabold text-rose-600">Sign out</Text>
          </Pressable>
        </Panel>
      </DashboardShell>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
            </>
  )
}