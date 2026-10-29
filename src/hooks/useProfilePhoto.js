// Pick a picture and make it the account photo — the mobile counterpart of the
// web dashboards' uploadOwnerProfileImage: POST /files/upload, then
// PATCH /auth/profile-image with the returned url. Shared by the Profile tab
// and the header photo sheet so both behave the same.
//
// No media permission is requested: launchImageLibraryAsync opens the system
// photo picker (Android 13+, iOS PHPicker), which needs none. Asking for it on
// Android 13+ requests READ_MEDIA_IMAGES, which this app does not declare, so
// the request was always refused and the upload never started.
import { useState } from 'react'
import { Alert, Platform } from 'react-native'
import { useDispatch } from 'react-redux'
import * as ImagePicker from 'expo-image-picker'
import { updateProfileImage } from '../api/auth'
import { uploadLocalFile } from '../api/upload'
import { mergeUser } from '../store/authSlice'
import { useLanguage } from '../i18n/LanguageContext'

// The server takes JPG, PNG and WebP only, and checks the bytes match the type.
const MIME_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

function uploadableAsset(asset) {
  const ext = String(asset.fileName || asset.uri || '').split('?')[0].split('.').pop()?.toLowerCase()
  const mimeType = MIME_BY_EXT[ext] || asset.mimeType || 'image/jpeg'
  const name = MIME_BY_EXT[ext] ? (asset.fileName || `profile.${ext}`) : 'profile.jpg'
  return { ...asset, mimeType, fileName: name }
}

export function useProfilePhoto() {
  const dispatch = useDispatch()
  const { t, td } = useLanguage()
  const [busy, setBusy] = useState(false)

  async function changePhoto() {
    if (busy) return false
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
      // iOS: hand back a JPEG rather than HEIC, which the server refuses.
      ...(Platform.OS === 'ios'
        ? { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }
        : null),
    })
    if (result.canceled || !result.assets?.[0]) return false
    setBusy(true)
    try {
      const uploaded = await uploadLocalFile(uploadableAsset(result.assets[0]), 'profile.jpg')
      const fileUrl = uploaded.url || uploaded.file_url || uploaded.path
      if (!fileUrl) throw new Error('upload answered without a url')
      const updated = await updateProfileImage(fileUrl)
      dispatch(mergeUser({ ...(updated?.user || updated || {}), profile_image_url: fileUrl }))
      return true
    } catch (error) {
      const detail = error?.response?.data?.detail
      Alert.alert(t('photo.failed'), (typeof detail === 'string' && td(detail)) || t('photo.failedBody'))
      return false
    } finally {
      setBusy(false)
    }
  }

  return { changePhoto, busy }
}
