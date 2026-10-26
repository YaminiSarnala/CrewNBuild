// Port of the owner's view of the web SiteEngineerDashboard (`photoOnly`): the
// project's site media as a month calendar. A day is coloured by what the Site
// Engineer uploaded for it -- any video orange, photos only blue, today with
// nothing yet green -- Sundays are site holidays, and a past day with nothing
// on it cannot be opened. Picking a day shows its photos (tap for full screen)
// and videos. Read-only: GET /projects/{id}/photos.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, Modal, FlatList, useWindowDimensions, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react-native'
import { FormNotice } from '../../components/form'
import { useLanguage } from '../../i18n/LanguageContext'
import { fetchProjectPhotos } from '../../api/projects'
import { imageSource } from '../../api/client'
import { formatDate } from '../../utils/formatters'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

const localDateKey = (value = new Date()) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`

const CONTENT_LABEL_KEYS = { '010': 'se.cal.photo', '001': 'se.cal.video', '011': 'se.cal.photoVideo' }
const CELL_TONES = { open: ['#CFEBDD', '#03572E'], video: ['#F6EADB', '#F58A00'], photo: ['#E7F0FD', '#1683E8'] }
const STATUS_LABEL_KEYS = { OPEN: 'ui.status.open', CLOSED: 'ui.status.closed', Photos: 'se.statusPhotos', Videos: 'se.cal.video', PhotosVideos: 'se.cal.photoVideo' }
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// A date's place in the project's working sequence from its start date,
// Sundays (site holiday) excluded -- the same number for every role.
const workingDayNumber = (startDate, date) => {
  if (!startDate || !date || date < String(startDate).slice(0, 10)) return null
  const [y, m, d] = String(startDate).slice(0, 10).split('-').map(Number)
  const cursor = new Date(y, m - 1, d)
  let count = 0
  while (localDateKey(cursor) <= date) {
    if (cursor.getDay() !== 0) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count || null
}

function PhotoViewer({ photos, index, title, onClose }) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [current, setCurrent] = useState(index || 0)
  if (index == null) return null
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={[styles.view, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.view2, { gap: 10 }]}>
          <Text style={[styles.text, { fontSize: 14 }]} numberOfLines={1}>{title}</Text>
          <Text style={[styles.text2, { fontSize: 12 }]}>{`${current + 1} / ${photos.length}`}</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close" style={styles.pressable}>
            <X size={18} color="#ffffff" />
          </Pressable>
        </View>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={index}
          getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, itemIndex) => String(item.id || item.image_url || itemIndex)}
          onMomentumScrollEnd={(event) => setCurrent(Math.round(event.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={[styles.view3, { width, height: height - insets.top - insets.bottom - 56 }]}>
              <Image source={imageSource(item.image_url)} style={{ width, height: '100%' }} contentFit="contain" />
            </View>
          )}
        />
      </View>
    </Modal>
  )
}

function SiteVideo({ video }) {
  const player = useVideoPlayer(imageSource(video.image_url), (instance) => { instance.loop = false })
  return (
    <View style={[styles.view4, { aspectRatio: 16 / 9 }]}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} allowsFullscreen nativeControls contentFit="contain" />
    </View>
  )
}

export default function SitePhotoCalendar({ project, onRequestUpdate, requestingUpdate = false, updateMessage = '' }) {
  const { t, td } = useLanguage()
  const [month, setMonth] = useState(() => new Date())
  const [workDate, setWorkDate] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [viewerIndex, setViewerIndex] = useState(null)

  const refresh = useCallback(async () => {
    if (!project?.id) return
    setLoading(true)
    try {
      setRecords((await fetchProjectPhotos(project.id)) || [])
      setMessage('')
    } catch (error) {
      setMessage(error?.response?.data?.detail || t('se.errLoad'))
    } finally {
      setLoading(false)
    }
  }, [project?.id, t])
  useEffect(() => { refresh() }, [refresh])

  // Photos and videos per day, each counted on its own.
  const { photosByDate, videosByDate } = useMemo(() => {
    const photos = {}
    const videos = {}
    records.forEach((item) => {
      const key = String(item.work_date || '').slice(0, 10)
      if (!key) return
      if (item.media_type === 'video') videos[key] = (videos[key] || 0) + 1
      else (photos[key] = photos[key] || []).push(item)
    })
    return { photosByDate: photos, videosByDate: videos }
  }, [records])

  const cells = useMemo(() => {
    const result = []
    const year = month.getFullYear()
    const value = month.getMonth()
    for (let blank = 0; blank < new Date(year, value, 1).getDay(); blank += 1) result.push(null)
    for (let day = 1; day <= new Date(year, value + 1, 0).getDate(); day += 1) result.push(new Date(year, value, day))
    while (result.length % 7) result.push(null)
    return result
  }, [month])

  const todayKey = localDateKey(new Date())
  const dayMedia = useMemo(() => records.filter((item) => String(item.work_date || '').slice(0, 10) === workDate), [records, workDate])
  const dayImages = dayMedia.filter((item) => item.media_type !== 'video')
  const dayVideos = dayMedia.filter((item) => item.media_type === 'video')
  const displayedStatus = dayImages.length && dayVideos.length ? 'PhotosVideos'
    : dayImages.length ? 'Photos' : dayVideos.length ? 'Videos' : workDate === todayKey ? 'OPEN' : 'CLOSED'
  const dayNumber = workingDayNumber(project?.start_date, workDate)
  const statusTone = ['Photos', 'Videos', 'PhotosVideos'].includes(displayedStatus)
    ? 'tone'
    : displayedStatus === 'OPEN' ? 'tone2' : 'tone3'
  // One tone style: its background on the pill, its colour on the label.
  const statusLook = styles[statusTone]

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.view5, { gap: 8 }]}>
        <Text style={[styles.text3, { fontSize: 13 }]}>{t('ui.siteActivity')}</Text>
        <View style={[styles.view6, { gap: 8 }]}>
          <Pressable onPress={refresh} accessibilityLabel={t('dash.engineer.refresh')} style={styles.pressable2}>
            <RefreshCw size={14} color={COLORS.slate[600]} />
          </Pressable>
          {onRequestUpdate ? (
            <Pressable
              onPress={onRequestUpdate}
              disabled={requestingUpdate}
              style={[styles.pressable3, requestingUpdate ? styles.pressable4 : null]}
            >
              <Text style={[styles.text4, { fontSize: 12 }]}>{t('dash.owner.projectDetails.requestUpdate')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <FormNotice message={updateMessage} />
      <FormNotice message={message} tone="error" />

      <View style={styles.view7}>
        <View style={styles.view8}>
          <View style={[styles.view9, { gap: 6 }]}>
            <CalendarDays size={15} color="#03572E" />
            <Text style={[styles.text5, { fontSize: 13.5 }]}>{`${t(`se.month.${month.getMonth()}`)} ${month.getFullYear()}`}</Text>
          </View>
          <View style={[styles.view6, { gap: 6 }]}>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} accessibilityLabel="Previous month" style={styles.pressable5}>
              <ChevronLeft size={15} color={COLORS.graphite} />
            </Pressable>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} accessibilityLabel="Next month" style={styles.pressable5}>
              <ChevronRight size={15} color={COLORS.graphite} />
            </Pressable>
          </View>
        </View>
        <View style={styles.view6}>
          {WEEKDAYS.map((day) => (
            <Text key={day} style={[styles.text6, { fontSize: 9.5, color: COLORS.brand[700] }]}>{t(`se.weekday.${day}`)}</Text>
          ))}
        </View>
        {loading ? <ActivityIndicator color={COLORS.brand[700]} style={{ paddingVertical: 30 }} /> : (
          <View style={styles.view10}>
            {cells.map((date, index) => {
              if (!date) return <View key={`blank-${index}`} style={{ width: '14.28%', padding: 2 }} />
              const key = localDateKey(date)
              const hasPhotos = (photosByDate[key] || []).length > 0
              const hasVideo = (videosByDate[key] || 0) > 0
              const hasMedia = hasPhotos || hasVideo
              const isSunday = date.getDay() === 0
              const future = key > todayKey
              const isOpen = key === todayKey && !isSunday && !hasMedia
              const tone = isOpen ? CELL_TONES.open : hasVideo ? CELL_TONES.video : hasPhotos ? CELL_TONES.photo : null
              const label = isOpen ? t(STATUS_LABEL_KEYS.OPEN) : hasMedia ? t(CONTENT_LABEL_KEYS[`0${hasPhotos ? 1 : 0}${hasVideo ? 1 : 0}`]) : ''
              // A past day with nothing on it has nothing to open.
              const empty = key < todayKey && !hasMedia
              const disabled = future || isSunday || empty
              return (
                <View key={key} style={{ width: '14.28%', padding: 2 }}>
                  <Pressable
                    onPress={() => setWorkDate(key)}
                    disabled={disabled}
                    style={[styles.pressable6, key === workDate ? styles.pressable7 : styles.pressable8, future || isSunday ? styles.pressable9 : null, { minHeight: 54, backgroundColor: tone ? tone[0] : COLORS.card, borderWidth: key === workDate ? 2 : 1 }]}
                  >
                    <Text style={[styles.text7, [{ fontSize: 11.5 }, tone ? { color: tone[1] } : null]]}>{date.getDate()}</Text>
                    {label ? (
                      <Text style={[styles.text8, { fontSize: 8.5, lineHeight: 10, color: tone[1] }]} numberOfLines={2}>{label}</Text>
                    ) : isSunday ? (
                      <Text style={[styles.text8, { fontSize: 8.5, color: '#8B929D' }]} numberOfLines={1}>{t(STATUS_LABEL_KEYS.CLOSED)}</Text>
                    ) : null}
                  </Pressable>
                </View>
              )
            })}
          </View>
        )}
        <View style={[styles.view11, { gap: 12 }]}>
          {[['#E7F0FD', '#1683E8', t('se.cal.photo')], ['#F6EADB', '#F58A00', t('se.cal.video')], ['#CFEBDD', COLORS.brand[600], t('ui.status.open')]].map(([box, ink, label]) => (
            <View key={label} style={[styles.view9, { gap: 5 }]}>
              <View style={{ width: 11, height: 11, borderRadius: 3, backgroundColor: box }} />
              <Text style={[styles.text9, { fontSize: 11, color: ink }]}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {!workDate ? (
        <Text style={[styles.text10, { fontSize: 12.5 }]}>
          {t('se.selectBlueDate')}
        </Text>
      ) : (
        <View style={styles.view12}>
          <View style={styles.view13}>
            <View style={[styles.view14, { gap: 10 }]}>
              <Text style={[styles.text11, { fontSize: 16 }]}>{`${t('se.project')}: ${td(project?.title)}`}</Text>
              <View style={[styles.view15, statusLook]}>
                <Text style={[styles.text12, { color: statusLook.color, fontSize: 11 }]}>{t(STATUS_LABEL_KEYS[displayedStatus])}</Text>
              </View>
            </View>
            <Text style={[styles.text13, { fontSize: 12 }]}>
              {`${dayNumber ? `${t('se.day')} ${dayNumber} · ` : ''}${formatDate(workDate, workDate)}`}
            </Text>
          </View>
          <View style={styles.view16}>
            {dayImages.length ? (
              <>
                <View style={styles.view17}>
                  <Text style={[styles.text14, { fontSize: 12 }]}>{t('se.sitePhotos')}</Text>
                  <Text style={[styles.text15, { fontSize: 11 }]}>{t('se.availableCount', { count: dayImages.length })}</Text>
                </View>
                <View style={[styles.view18, { gap: 8 }]}>
                  {dayImages.map((image, index) => (
                    <Pressable key={image.id || image.image_url} onPress={() => setViewerIndex(index)} style={{ width: '48.5%' }}>
                      <Image source={imageSource(image.image_url)} style={{ width: '100%', height: 130, borderRadius: 12 }} contentFit="cover" />
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={() => setViewerIndex(0)} style={styles.pressable10}>
                  <Text style={[styles.text16, { fontSize: 12 }]}>{t('se.viewAllPhotos', { count: dayImages.length })}</Text>
                </Pressable>
              </>
            ) : null}
            {dayVideos.length ? (
              <>
                <View style={styles.view19}>
                  <Text style={[styles.text14, { fontSize: 12 }]}>{t('se.siteVideos')}</Text>
                  <Text style={[styles.text15, { fontSize: 11 }]}>{t('se.availableCount', { count: dayVideos.length })}</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {dayVideos.map((video) => <SiteVideo key={video.id || video.image_url} video={video} />)}
                </View>
              </>
            ) : null}
            {!dayImages.length && !dayVideos.length ? (
              <Text style={[styles.text17, { fontSize: 12 }]}>
                {t('se.noSiteMedia')}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {viewerIndex != null ? (
        <PhotoViewer
          photos={dayImages}
          index={viewerIndex}
          title={t('se.projectSitePhotos', { project: td(project?.title) || t('se.projectFallback') })}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1, backgroundColor: '#000000' },
  view2: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10.5, paddingVertical: 7 },
  text: { flex: 1, fontFamily: 'Inter_700Bold', color: '#ffffff' },
  text2: { fontFamily: 'Inter_600SemiBold', color: 'rgba(255, 255, 255, 0.7)' },
  pressable: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  view3: { alignItems: 'center', justifyContent: 'center' },
  view4: { overflow: 'hidden', borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: '#0f172a' },
  tone: { backgroundColor: c.blueSoftStrong, color: c.blueTextStrong },
  tone2: { backgroundColor: c.emeraldSoftStrong, color: c.emeraldTextStrong },
  tone3: { backgroundColor: c.muted, color: c.textSoft },
  view5: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  text3: { fontFamily: 'Inter_700Bold', color: c.textMuted },
  view6: { flexDirection: 'row' },
  pressable2: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  pressable3: { height: 31.5, justifyContent: 'center', borderRadius: 7, backgroundColor: '#1a5038', paddingHorizontal: 12.25 },
  pressable4: { opacity: 0.6 },
  text4: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  view7: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  view8: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  view9: { flexDirection: 'row', alignItems: 'center' },
  text5: { fontFamily: 'Inter_700Bold', color: c.text },
  pressable5: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border },
  text6: { flex: 1, textAlign: 'center', fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  view10: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap' },
  pressable6: { borderRadius: 7, borderWidth: 1, padding: 3.5 },
  pressable7: { borderColor: '#2e7d55' },
  pressable8: { borderColor: c.border },
  pressable9: { opacity: 0.45 },
  text7: { fontFamily: 'Inter_700Bold', color: c.textSoft },
  text8: { marginTop: 1.75, fontFamily: 'Inter_700Bold' },
  view11: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  text9: { fontFamily: 'Inter_600SemiBold' },
  text10: { borderRadius: 10.5, borderWidth: 1, borderStyle: 'dashed', borderColor: c.brandBorderStrong, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 21, textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.textMuted },
  view12: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  view13: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 14, paddingVertical: 10.5 },
  view14: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  text11: { flex: 1, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view15: { borderRadius: 9999, paddingHorizontal: 10.5, paddingVertical: 3.5 },
  text12: { fontFamily: 'Inter_700Bold' },
  text13: { marginTop: 3.5, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  view16: { padding: 14 },
  view17: { marginBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text14: { fontFamily: 'Inter_700Bold', color: c.textSecondary },
  text15: { fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  view18: { flexDirection: 'row', flexWrap: 'wrap' },
  pressable10: { marginTop: 10.5, height: 31.5, justifyContent: 'center', alignSelf: 'flex-start', borderRadius: 7, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.card, paddingHorizontal: 14 },
  text16: { fontFamily: 'Inter_700Bold', color: c.brandText },
  view19: { marginBottom: 7, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text17: { borderRadius: 10.5, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, paddingHorizontal: 14, paddingVertical: 21, textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.textFaint },
}))
