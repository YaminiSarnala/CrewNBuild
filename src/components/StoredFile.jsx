// Opening an uploaded file (gallery photo, certificate, chat attachment).
//
// The server serves /files/... only to a signed-in request: the token goes in
// the Authorization header. A phone browser opened with Linking.openURL has no
// token, so it shows {"detail":"Authentication required"}. Instead:
//   images     open in an in-app full-screen viewer that sends the header
//              (the same source the thumbnails use);
//   other files are downloaded with the header into the app's cache and handed
//              to the system ("Open with" / share sheet: PDF viewer, Drive...).
// Links to other sites still open in the browser.
//
//   const files = useStoredFiles()
//   files.open(path, { gallery: allImagePaths })   // then render {files.viewer}
//
// The viewer is a Modal rendered by the screen (or sheet) that uses the hook, so
// it also works on top of a sheet that is itself a Modal.
import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { X } from 'lucide-react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { API_BASE_URL, getCachedAuth, imageSource, imageUrl } from '../api/client'
import { toast } from './Toast'
import { createStyles } from '../theme/createStyles'

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|heic|heif|bmp)(\?|#|$)/i

const MIME_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
}

/** True for a path the app's server serves (and so needs the sign-in token). */
function isOurFile(path) {
  const text = String(path || '')
  if (text.startsWith('/')) return true
  return text.startsWith(API_BASE_URL)
}

export function isImagePath(path) {
  return IMAGE_EXTENSIONS.test(String(path || ''))
}

const fileName = (path) => {
  const last = String(path || '').split(/[?#]/)[0].split('/').pop() || 'file'
  return decodeURIComponent(last).replace(/[^\w.-]+/g, '-') || 'file'
}

/** Downloads one of our files with the token and offers it to the system. */
async function openDocument(path) {
  const url = imageUrl(path)
  const token = getCachedAuth()?.accessToken
  const name = fileName(path)
  const extension = (name.split('.').pop() || '').toLowerCase()
  const target = new File(Paths.cache, `${Date.now()}-${name}`)
  const file = await File.downloadFileAsync(url, target, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    idempotent: true,
  })
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable')
  await Sharing.shareAsync(file.uri, { mimeType: MIME_TYPES[extension], dialogTitle: name })
}

export function useStoredFiles() {
  const [viewer, setViewer] = useState(null) // { images, index }
  const [busy, setBusy] = useState(false)

  const open = useCallback(async (path, { gallery } = {}) => {
    if (!path) return
    if (!isOurFile(path)) {
      Linking.openURL(imageUrl(path)).catch(() => toast.error('Could not open this file.'))
      return
    }
    if (isImagePath(path) || gallery?.includes(path)) {
      const images = gallery?.length ? gallery : [path]
      setViewer({ images, index: Math.max(0, images.indexOf(path)) })
      return
    }
    if (busy) return
    setBusy(true)
    try {
      await openDocument(path)
    } catch {
      toast.error('Could not open this file. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }, [busy])

  const element = useMemo(() => (
    <>
      {viewer ? <ImageViewer images={viewer.images} index={viewer.index} onClose={() => setViewer(null)} /> : null}
      {busy ? (
        <Modal transparent visible animationType="fade" onRequestClose={() => {}}>
          <View style={styles.busy}><ActivityIndicator size="large" color="#ffffff" /></View>
        </Modal>
      ) : null}
    </>
  ), [viewer, busy])

  return { open, busy, viewer: element }
}

/** Full-screen, swipeable photos; each one is fetched with the sign-in header. */
export function ImageViewer({ images, index = 0, onClose }) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [current, setCurrent] = useState(index)
  const pageHeight = height - insets.top - insets.bottom - 56
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.bar}>
          <Text style={styles.count}>{images.length > 1 ? `${current + 1} / ${images.length}` : ''}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
            <X size={20} color="#ffffff" />
          </Pressable>
        </View>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, itemIndex) => `${item}-${itemIndex}`}
          onMomentumScrollEnd={(event) => setCurrent(Math.round(event.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={{ width, height: pageHeight, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={imageSource(item)} style={{ width, height: pageHeight }} contentFit="contain" transition={150} />
            </View>
          )}
        />
      </View>
    </Modal>
  )
}

const styles = createStyles(() => ({
  screen: { flex: 1, backgroundColor: '#000000' },
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  count: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  busy: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
}))
