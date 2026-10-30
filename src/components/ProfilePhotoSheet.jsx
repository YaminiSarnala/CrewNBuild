// The account photo, opened: the picture at full size with a button to change
// it. Opened by tapping the avatar in the DashboardShell header or on the
// Profile tab. "Change photo" slides up a choice of camera or gallery.
import { useEffect, useState } from 'react'
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import { Image } from 'expo-image'
import { Camera, ChevronRight, Image as ImageIcon, X } from 'lucide-react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { useProfilePhoto } from '../hooks/useProfilePhoto'
import { userAvatarSource } from '../utils/avatars'
import { createStyles } from '../theme/createStyles'

const BRAND = '#1a5038'

const ROLE_KEYS = { OWNER: 'role.owner', CONTRACTOR: 'role.contractor', SUPPLIER: 'role.supplier', ENGINEER: 'role.engineer' }

export default function ProfilePhotoSheet({ visible, onClose }) {
  const user = useSelector((state) => state.auth.user)
  const { t, td } = useLanguage()
  const { changePhoto, busy } = useProfilePhoto()
  const insets = useSafeAreaInsets()
  const hasPhoto = Boolean(user?.profile_image_url)
  const [choosing, setChoosing] = useState(false)
  useEffect(() => { if (!visible) setChoosing(false) }, [visible])

  async function pick(source) {
    setChoosing(false)
    if (await changePhoto(source)) onClose()
  }
  const dismiss = () => {
    if (busy) return
    if (choosing) setChoosing(false)
    else onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Pressable onPress={onClose} disabled={busy} hitSlop={10} accessibilityLabel="Close" style={styles.close}>
            <X size={20} color="#64748b" />
          </Pressable>
          <View style={styles.photoRing}>
            <Image source={userAvatarSource(user, user?.role)} style={styles.photo} contentFit="cover" />
            {busy ? (
              <View style={styles.photoBusy}>
                <ActivityIndicator color="#ffffff" />
              </View>
            ) : null}
          </View>
          <Text style={styles.name} numberOfLines={1}>{td(user?.name) || '—'}</Text>
          <Text style={styles.role}>{t(ROLE_KEYS[user?.role] || 'role.owner')}</Text>
          <Pressable
            onPress={() => setChoosing(true)}
            disabled={busy}
            accessibilityRole="button"
            style={[styles.button, busy && { opacity: 0.6 }]}
          >
            <Camera size={16} color="#ffffff" />
            <Text style={styles.buttonText}>
              {busy ? t('photo.uploading') : hasPhoto ? t('photo.change') : t('photo.upload')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>

      {choosing ? (
        <View style={styles.choiceLayer}>
          <Pressable style={styles.choiceBackdrop} onPress={() => setChoosing(false)} accessibilityLabel="Close" />
          <View style={[styles.choiceSheet, { paddingBottom: insets.bottom + 14 }]}>
            <View style={styles.grabber} />
            <Text style={styles.choiceTitle}>{hasPhoto ? t('photo.change') : t('photo.upload')}</Text>
            <ChoiceRow icon={Camera} label={t('photo.camera')} hint={t('photo.cameraHint')} onPress={() => pick('camera')} />
            <ChoiceRow icon={ImageIcon} label={t('photo.gallery')} hint={t('photo.galleryHint')} onPress={() => pick('library')} />
            <Pressable onPress={() => setChoosing(false)} accessibilityRole="button" style={styles.cancel}>
              <Text style={styles.cancelText}>{t('dash.common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Modal>
  )
}

function ChoiceRow({ icon: Icon, label, hint, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.choiceRow, pressed && styles.choiceRowPressed]}>
      <View style={styles.choiceIcon}>
        <Icon size={20} color={BRAND} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.choiceLabel}>{label}</Text>
        <Text style={styles.choiceHint}>{hint}</Text>
      </View>
      <ChevronRight size={18} color="#94a3b8" />
    </Pressable>
  )
}

const styles = createStyles((c) => ({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  card: {
    width: '100%', maxWidth: 360, alignItems: 'center', borderRadius: 24, backgroundColor: c.card,
    paddingHorizontal: 24, paddingTop: 30, paddingBottom: 22,
    shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  close: { position: 'absolute', top: 14, right: 14, padding: 4 },
  photoRing: { width: 148, height: 148, borderRadius: 74, padding: 4, backgroundColor: c.brandSoftStrong, overflow: 'hidden' },
  photo: { width: '100%', height: '100%', borderRadius: 70 },
  photoBusy: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 70, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  name: { marginTop: 14, alignSelf: 'stretch', textAlign: 'center', fontSize: 18, fontWeight: '800', color: c.text },
  role: { marginTop: 2, fontSize: 12.5, fontWeight: '700', color: c.textMuted },
  button: {
    marginTop: 20, alignSelf: 'stretch', height: 46, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, backgroundColor: BRAND,
  },
  buttonText: { fontSize: 14.5, fontWeight: '800', color: '#ffffff' },
  choiceLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  choiceBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  choiceSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: c.card, paddingHorizontal: 18, paddingTop: 10, gap: 10,
    shadowColor: '#0f172a', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: -6 }, elevation: 16,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4.5, borderRadius: 3, backgroundColor: c.border, marginBottom: 4 },
  choiceTitle: { fontSize: 16.5, fontWeight: '800', color: c.text, marginBottom: 2 },
  choiceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 12,
  },
  choiceRowPressed: { backgroundColor: c.brandSoft },
  choiceIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brandSoftStrong },
  choiceLabel: { fontSize: 14.5, fontWeight: '800', color: c.text },
  choiceHint: { marginTop: 1, fontSize: 12, fontWeight: '600', color: c.textMuted },
  cancel: { height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.border, marginTop: 2 },
  cancelText: { fontSize: 14.5, fontWeight: '800', color: c.text },
}))
