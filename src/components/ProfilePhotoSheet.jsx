// The header photo, opened: the account picture at full size with a button to
// change it. Opened by tapping the avatar beside the name in DashboardShell.
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native'
import { useSelector } from 'react-redux'
import { Image } from 'expo-image'
import { Camera, X } from 'lucide-react-native'
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
  const hasPhoto = Boolean(user?.profile_image_url)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onClose()}>
      <Pressable style={styles.backdrop} onPress={() => !busy && onClose()}>
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
            onPress={async () => { if (await changePhoto()) onClose() }}
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
    </Modal>
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
  name: { marginTop: 14, fontSize: 18, fontWeight: '800', color: c.text },
  role: { marginTop: 2, fontSize: 12.5, fontWeight: '700', color: c.textMuted },
  button: {
    marginTop: 20, alignSelf: 'stretch', height: 46, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, backgroundColor: BRAND,
  },
  buttonText: { fontSize: 14.5, fontWeight: '800', color: '#ffffff' },
}))
