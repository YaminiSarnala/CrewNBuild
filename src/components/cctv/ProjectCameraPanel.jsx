// Port of the web components/cctv/ProjectCameraPanel.jsx + ProjectCameraViewer
// + the engineer's LiveCameraPlayer / RecordedCameraPlayer, for React Native.
//
// A project has ONE recorder, shared by the House Owner, the Builder and the
// Site Engineer; each person verifies it once. The backend decides whether
// that has happened (GET /cctv/projects/{id}/camera-setup -> access_granted);
// this only renders the answer.
//
// Playback: POST /cctv/channels/{id}/playback returns playback_url and
// playback_token. expo-video plays the LL-HLS stream and sends the token as
// `Authorization: Bearer <token>` on every request, exactly as the web's hls.js
// does. The session is renewed every 45 seconds while open and ended when the
// player closes. The token lives only in this player's memory.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { CalendarClock, Lock, Play, RefreshCw, Search, ShieldCheck, Video, X } from 'lucide-react-native'
import { DateField, FormNotice, SelectField, TextField } from '../form'
import { useLanguage } from '../../i18n/LanguageContext'
import {
  connectProjectCamera, endPlaybackSession, fetchProjectCameraDevices, fetchProjectCameraSetup, renewPlaybackSession,
  searchRecordings, startPlaybackSession, startRecordedPlayback,
} from '../../api/cctv'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

const RENEW_INTERVAL_MS = 45000
const card = 'tone'

// The API's own words, or a fallback that says whether the server answered.
function apiMessage(error, fallback, t, td) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return td(detail)
  if (detail?.message) {
    const field = Array.isArray(detail.fields) && detail.fields.length ? ` ${detail.fields[0].message}` : ''
    return td(`${detail.message}${field}`)
  }
  if (!error?.response) return `${fallback} ${t('ui.cctv.serverUnreachable')}`
  if (error.response.status >= 500) return `${fallback} ${t('ui.cctv.serverReturnedError', { status: error.response.status })}`
  return fallback
}

const pad = (n) => String(n).padStart(2, '0')
const segmentLabel = (iso) => String(iso).slice(11, 19)
function durationLabel(seconds, t) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? t('ui.cctv.durationHoursMinutes', { h, m: pad(m) })
    : m > 0
      ? t('ui.cctv.durationMinutesSeconds', { m, s: pad(sec) })
      : t('ui.cctv.durationSeconds', { s: sec })
}

function preferredVariant(channel) {
  if (channel.preferred_stream === 'SUB' && channel.has_sub_stream) return 'SUB'
  if (channel.preferred_stream === 'MAIN' && channel.has_main_stream) return 'MAIN'
  return channel.has_sub_stream ? 'SUB' : 'MAIN'
}

function resolutionOf(channel, variant) {
  const width = variant === 'SUB' ? channel.sub_width : channel.main_width
  const height = variant === 'SUB' ? channel.sub_height : channel.main_height
  return width && height ? `${width}×${height}` : ''
}

const STATUS_PILL = {
  live: { box: 'tone2', text: 'tone3', dot: 'tone4', key: 'dash.engineer.liveCamera.statusLive' },
  connecting: { box: 'tone5', text: 'tone6', dot: 'tone7', key: 'dash.engineer.liveCamera.statusConnecting' },
  reconnecting: { box: 'tone5', text: 'tone6', dot: 'tone7', key: 'dash.engineer.liveCamera.statusReconnecting' },
  ready: { box: 'tone8', text: 'tone9', dot: 'tone10', key: 'dash.engineer.liveCamera.statusReady' },
  offline: { box: 'tone11', text: 'text', dot: 'tone12', key: 'dash.engineer.liveCamera.statusOffline' },
}

function StatusPill({ state }) {
  const { t } = useLanguage()
  const look = STATUS_PILL[state] || STATUS_PILL.offline
  return (
    <View style={[styles.view, styles[look.box], { gap: 5 }]}>
      <View style={[styles.view2, styles[look.dot]]} />
      <Text style={[styles.text2, styles[look.text], { fontSize: 9.5 }]}>{t(look.key)}</Text>
    </View>
  )
}

// HD is the channel's MAIN stream and SD its SUB stream.
const QUALITY_OPTIONS = [
  { variant: 'MAIN', labelKey: 'dash.engineer.liveCamera.qualityHd', configured: (channel) => Boolean(channel.has_main_stream) },
  { variant: 'SUB', labelKey: 'dash.engineer.liveCamera.qualitySd', configured: (channel) => Boolean(channel.has_sub_stream) },
]

function QualitySelector({ channel, value, onChange }) {
  const { t } = useLanguage()
  return (
    <View style={styles.view3} accessibilityLabel={t('dash.engineer.liveCamera.quality')}>
      {QUALITY_OPTIONS.map((option) => {
        const configured = option.configured(channel)
        const selected = value === option.variant
        return (
          <Pressable
            key={option.variant}
            disabled={!configured}
            onPress={() => !selected && onChange(option.variant)}
            style={[styles.pressable, selected ? styles.pressable2 : null, configured ? null : styles.pressable3]}
          >
            <Text style={[styles.text3, selected ? styles.text4 : styles.text, { fontSize: 11 }]}>{t(option.labelKey)}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// The video itself, mounted once a session exists so its source never changes.
function StreamView({ session, live, onStatus }) {
  const player = useVideoPlayer(
    { uri: session.playback_url, headers: { Authorization: `Bearer ${session.playback_token}` } },
    (instance) => { instance.loop = false; instance.play() },
  )
  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => onStatus?.(status))
    return () => subscription.remove()
  }, [player, onStatus])
  return (
    <View style={[styles.view4, { aspectRatio: 16 / 9 }]}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} allowsFullscreen nativeControls={!live} contentFit="contain" />
    </View>
  )
}

// One open playback session: started on mount, renewed every 45s, ended on close.
function usePlaybackSession(start, key, t) {
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let sessionId = null
    let renewTimer = null
    setSession(null)
    setError('')
    start()
      .then((result) => {
        if (!active) { endPlaybackSession(result.session_id).catch(() => {}); return }
        sessionId = result.session_id
        setSession(result)
        renewTimer = setInterval(() => { renewPlaybackSession(sessionId).catch(() => {}) }, RENEW_INTERVAL_MS)
      })
      .catch((failure) => { if (active) setError(failure?.response?.data?.detail || t('dash.engineer.liveCamera.loadError')) })
    return () => {
      active = false
      if (renewTimer) clearInterval(renewTimer)
      if (sessionId) endPlaybackSession(sessionId).catch(() => {})
    }
    // `start` is rebuilt every render; `key` says when the session must change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])
  return { session, error, retry: () => setAttempt((value) => value + 1) }
}

function LivePlayer({ channel, variant, title, subtitle, onVariantChange, onStateChange, onClose }) {
  const { t } = useLanguage()
  const { session, error, retry } = usePlaybackSession(
    () => startPlaybackSession(channel.id, { transport: 'LL_HLS', streamVariant: variant }),
    `${channel.id}:${variant}`,
    t,
  )
  const [state, setState] = useState('connecting')
  useEffect(() => { onStateChange?.(error ? 'offline' : state) }, [state, error, onStateChange])
  useEffect(() => { setState('connecting') }, [session])
  const onStatus = useCallback((status) => {
    if (status === 'readyToPlay') setState('live')
    else if (status === 'loading') setState((current) => (current === 'live' ? 'reconnecting' : 'connecting'))
    else if (status === 'error') setState('offline')
  }, [])

  return (
    <View style={styles[card]}>
      <View style={[styles.view5, { gap: 8 }]}>
        <View style={styles.view6}>
          <Text style={[styles.text5, { fontSize: 14.5 }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.text6, { fontSize: 11.5 }]} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        <Pressable onPress={onClose} accessibilityLabel={t('dash.engineer.liveCamera.close')} style={styles.pressable4}>
          <X size={14} color={COLORS.slate[500]} />
        </Pressable>
      </View>
      {session ? (
        <StreamView session={session} live onStatus={onStatus} />
      ) : (
        <View style={[styles.view7, { aspectRatio: 16 / 9 }]}>
          {error ? (
            <Text style={[styles.text7, { fontSize: 12.5 }]}>{error}</Text>
          ) : (
            <ActivityIndicator color="#ffffff" />
          )}
        </View>
      )}
      <View style={[styles.view8, { gap: 8 }]}>
        <StatusPill state={error ? 'offline' : state} />
        <QualitySelector channel={channel} value={variant} onChange={onVariantChange} />
        {error || state === 'offline' ? (
          <Pressable onPress={retry} style={[styles.pressable5, { gap: 5 }]}>
            <RefreshCw size={13} color={COLORS.slate[600]} />
            <Text style={[styles.text8, { fontSize: 11.5 }]}>{t('dash.engineer.liveCamera.reconnect')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const SPEEDS = ['1', '1.5', '2', '3']

function RecordedPlayer({ channel, segment, title, subtitle, onClose }) {
  const { t } = useLanguage()
  const [speed, setSpeed] = useState('1')
  // Speed is applied by the recorder, so a new speed is a new session.
  const { session, error } = usePlaybackSession(
    () => startRecordedPlayback(channel.id, { start: segment.start_local, end: segment.end_local, speed }),
    `${channel.id}:${segment.start_local}:${segment.end_local}:${speed}`,
    t,
  )
  return (
    <View style={styles[card]}>
      <View style={[styles.view5, { gap: 8 }]}>
        <View style={styles.view6}>
          <Text style={[styles.text5, { fontSize: 14.5 }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.text6, { fontSize: 11.5 }]} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        <Pressable onPress={onClose} accessibilityLabel={t('dash.engineer.liveCamera.close')} style={styles.pressable4}>
          <X size={14} color={COLORS.slate[500]} />
        </Pressable>
      </View>
      {session ? (
        <StreamView session={session} live={false} />
      ) : (
        <View style={[styles.view7, { aspectRatio: 16 / 9 }]}>
          {error ? <Text style={[styles.text7, { fontSize: 12.5 }]}>{error}</Text> : <ActivityIndicator color="#ffffff" />}
        </View>
      )}
      <View style={[styles.view9, { gap: 8 }]}>
        <Text style={[styles.text9, { fontSize: 10.5 }]}>{t('dash.engineer.recorded.speed')}</Text>
        <View style={[styles.view10, { gap: 2 }]}>
          {SPEEDS.map((option) => (
            <Pressable key={option} onPress={() => setSpeed(option)} style={[styles.pressable6, speed === option ? styles.pressable2 : null]}>
              <Text style={[styles.text3, speed === option ? styles.text4 : styles.text, { fontSize: 12 }]}>{`${option}×`}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}

const timeText = (value) => {
  const digits = String(value).replace(/[^0-9]/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits
}
const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

function CameraViewer({ devices, projectTitle }) {
  const { t, td } = useLanguage()
  const [mode, setMode] = useState('live')
  const [activeChannelId, setActiveChannelId] = useState(null)
  const [activeState, setActiveState] = useState('connecting')
  const [qualityByChannel, setQualityByChannel] = useState({})
  const now = new Date()
  const earlier = new Date(now.getTime() - 30 * 60000)
  const [recCameraId, setRecCameraId] = useState('')
  const [recDate, setRecDate] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
  const [recStart, setRecStart] = useState(`${pad(earlier.getHours())}:${pad(earlier.getMinutes())}`)
  const [recEnd, setRecEnd] = useState(`${pad(now.getHours())}:${pad(now.getMinutes())}`)
  const [searchStatus, setSearchStatus] = useState('idle')
  const [segments, setSegments] = useState([])
  const [searchError, setSearchError] = useState('')
  const [activeSegment, setActiveSegment] = useState(null)

  const cameras = useMemo(() => (devices || []).flatMap((device) => (device.channels || [])
    .filter((channel) => channel.is_enabled)
    .map((channel) => ({ channel, available: device.is_active && device.status === 'ONLINE' }))), [devices])

  useEffect(() => {
    if (!cameras.length) { setRecCameraId(''); return }
    setRecCameraId((current) => (cameras.some(({ channel }) => channel.id === current) ? current : cameras[0].channel.id))
  }, [cameras])

  const activeCamera = cameras.find(({ channel }) => channel.id === activeChannelId) || null
  const recCamera = cameras.find(({ channel }) => channel.id === recCameraId) || null
  const qualityOf = (channel) => qualityByChannel[channel.id] || preferredVariant(channel)
  const chooseQuality = (channelId, variant) => setQualityByChannel((current) => ({ ...current, [channelId]: variant }))
  const cameraSubtitle = (channel) => [
    td(projectTitle),
    td(channel.location_label),
    t('dash.engineer.liveCamera.channel', { number: channel.channel_number }),
    resolutionOf(channel, qualityOf(channel)),
  ].filter(Boolean).join(' · ')

  const switchMode = (next) => {
    if (next === mode) return
    setActiveChannelId(null)
    setActiveSegment(null)
    setMode(next)
  }

  const runSearch = async () => {
    if (!recCamera) return
    setActiveSegment(null)
    setSearchError('')
    if (!validTime(recStart) || !validTime(recEnd) || !recDate) {
      setSearchStatus('error')
      setSearchError(t('dash.engineer.recorded.badWindow'))
      return
    }
    const start = `${recDate}T${recStart}:00`
    const end = `${recDate}T${recEnd}:00`
    if (!(new Date(end).getTime() > new Date(start).getTime())) {
      setSearchStatus('error')
      setSearchError(t('dash.engineer.recorded.badWindow'))
      return
    }
    setSearchStatus('loading')
    try {
      const result = await searchRecordings(recCamera.channel.id, { start, end })
      const found = Array.isArray(result?.segments) ? result.segments : []
      setSegments(found)
      setSearchStatus(found.length ? 'done' : 'empty')
    } catch (error) {
      const status = error?.response?.status
      setSearchStatus('error')
      setSearchError(status === 403 || status === 404 ? t('dash.engineer.recorded.unauthorized') : t('dash.engineer.recorded.searchError'))
    }
  }

  const empty = (title, body) => (
    <View style={styles.view11}>
      <Text style={[styles.text10, { fontSize: 13.5 }]}>{title}</Text>
      <Text style={[styles.text11, { fontSize: 12 }]}>{body}</Text>
    </View>
  )

  return (
    <View style={{ gap: 12 }}>
      <View>
        <Text style={[styles.text12, { fontSize: 12 }]}>{t('dash.engineer.recorded.mode')}</Text>
        <View style={[styles.view12, { gap: 2 }]}>
          {[['live', t('dash.engineer.recorded.live')], ['recorded', t('dash.engineer.recorded.recorded')]].map(([value, label]) => (
            <Pressable key={value} onPress={() => switchMode(value)} style={[styles.pressable7, mode === value ? styles.pressable2 : null]}>
              <Text style={[styles.text3, mode === value ? styles.text4 : styles.text, { fontSize: 12 }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {mode === 'live' && activeCamera ? (
        <LivePlayer
          key={activeCamera.channel.id}
          channel={activeCamera.channel}
          variant={qualityOf(activeCamera.channel)}
          title={td(activeCamera.channel.name)}
          subtitle={cameraSubtitle(activeCamera.channel)}
          onVariantChange={(variant) => chooseQuality(activeCamera.channel.id, variant)}
          onStateChange={setActiveState}
          onClose={() => setActiveChannelId(null)}
        />
      ) : null}

      {mode === 'recorded' ? (
        <View style={styles[card]}>
          <View style={[styles.view13, { gap: 6 }]}>
            <CalendarClock size={15} color={COLORS.slate[400]} />
            <Text style={[styles.text9, { fontSize: 11 }]}>{t('dash.engineer.recorded.searchHeading')}</Text>
          </View>
          <SelectField
            label={t('dash.engineer.recorded.camera')}
            value={recCameraId}
            onChange={(value) => { if (value) { setRecCameraId(value); setActiveSegment(null); setSearchStatus('idle') } }}
            placeholder={t('dash.engineer.liveCamera.emptyTitle')}
            disabled={!cameras.length}
            options={cameras.map(({ channel }) => ({ value: channel.id, label: td(channel.name) }))}
          />
          <DateField label={t('dash.engineer.recorded.date')} value={recDate} onChange={(value) => value && setRecDate(value)} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextField
              containerStyle={{ flex: 1 }}
              label={t('dash.engineer.recorded.start')}
              value={recStart}
              onChangeText={(value) => setRecStart(timeText(value))}
              keyboardType="number-pad"
              placeholder="HH:MM"
            />
            <TextField
              containerStyle={{ flex: 1 }}
              label={t('dash.engineer.recorded.end')}
              value={recEnd}
              onChangeText={(value) => setRecEnd(timeText(value))}
              keyboardType="number-pad"
              placeholder="HH:MM"
            />
          </View>
          <Pressable
            onPress={runSearch}
            disabled={!recCamera || searchStatus === 'loading'}
            style={[styles.pressable8, !recCamera ? styles.pressable9 : styles.pressable2, { gap: 6 }]}
          >
            <Search size={15} color="#ffffff" />
            <Text style={[styles.text13, { fontSize: 12.5 }]}>
              {searchStatus === 'loading' ? t('dash.engineer.recorded.searching') : t('dash.engineer.recorded.search')}
            </Text>
          </Pressable>
          <Text style={[styles.text14, { fontSize: 11 }]}>{t('dash.engineer.recorded.timezoneNote')}</Text>
        </View>
      ) : null}

      {mode === 'recorded' && activeSegment && recCamera ? (
        <RecordedPlayer
          key={`${recCamera.channel.id}:${activeSegment.start_local}:${activeSegment.end_local}`}
          channel={recCamera.channel}
          segment={activeSegment}
          title={td(recCamera.channel.name)}
          subtitle={[td(projectTitle), td(recCamera.channel.location_label), t('dash.engineer.recorded.recordedOn', { date: recDate })].filter(Boolean).join(' · ')}
          onClose={() => setActiveSegment(null)}
        />
      ) : null}

      {mode === 'recorded' ? (
        <View style={styles[card]}>
          <Text style={[styles.text15, { fontSize: 11 }]}>{t('dash.engineer.recorded.resultsHeading')}</Text>
          {searchStatus === 'idle' ? empty(t('dash.engineer.recorded.idleTitle'), t('dash.engineer.recorded.idleBody'))
            : searchStatus === 'loading' ? <ActivityIndicator color={COLORS.brand[700]} style={{ paddingVertical: 20 }} />
              : searchStatus === 'error' ? <Text style={[styles.text16, { fontSize: 13 }]}>{searchError}</Text>
                : searchStatus === 'empty' ? empty(t('dash.engineer.recorded.noneTitle'), t('dash.engineer.recorded.noneBody'))
                  : (
                    <View style={{ gap: 8 }}>
                      {segments.map((segment) => {
                        const isActive = activeSegment && activeSegment.start_local === segment.start_local && activeSegment.end_local === segment.end_local
                        return (
                          <View key={`${segment.start_local}-${segment.end_local}`} style={[styles.view14, isActive ? styles.view15 : styles.view16, { gap: 10 }]}>
                            <View style={styles.view17}>
                              <Video size={15} color={COLORS.brand[700]} />
                            </View>
                            <View style={styles.view6}>
                              <Text style={[styles.text5, { fontSize: 13.5 }]}>{`${segmentLabel(segment.start_local)} – ${segmentLabel(segment.end_local)}`}</Text>
                              <Text style={[styles.text6, { fontSize: 11.5 }]}>
                                {t('dash.engineer.recorded.duration', { duration: durationLabel(segment.duration_seconds, t) })}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => setActiveSegment(segment)}
                              disabled={isActive}
                              style={[styles.pressable10, isActive ? styles.pressable9 : styles.pressable2, { gap: 4 }]}
                            >
                              <Play size={12} color="#ffffff" />
                              <Text style={[styles.text13, { fontSize: 11.5 }]}>{t('dash.engineer.recorded.play')}</Text>
                            </Pressable>
                          </View>
                        )
                      })}
                    </View>
                  )}
        </View>
      ) : null}

      {mode === 'live' ? (
        <View style={styles[card]}>
          <Text style={[styles.text15, { fontSize: 11 }]}>{t('dash.engineer.liveCamera.listHeading')}</Text>
          {!cameras.length ? empty(t('dash.engineer.liveCamera.emptyTitle'), t('dash.engineer.liveCamera.emptyBody')) : (
            <View style={{ gap: 8 }}>
              {cameras.map(({ channel, available }) => {
                const isActive = channel.id === activeChannelId
                const pillState = isActive
                  ? (['live', 'connecting', 'reconnecting'].includes(activeState) ? activeState : 'offline')
                  : (available ? 'ready' : 'offline')
                return (
                  <View key={channel.id} style={[styles.view18, isActive ? styles.view15 : styles.view16]}>
                    <View style={[styles.view19, { gap: 10 }]}>
                      <View style={styles.view17}>
                        <Video size={15} color={COLORS.brand[700]} />
                      </View>
                      <View style={styles.view6}>
                        <Text style={[styles.text5, { fontSize: 13.5 }]} numberOfLines={1}>{td(channel.name)}</Text>
                        <Text style={[styles.text6, { fontSize: 11 }]} numberOfLines={2}>{cameraSubtitle(channel)}</Text>
                      </View>
                    </View>
                    <View style={[styles.view20, { gap: 8 }]}>
                      <QualitySelector channel={channel} value={qualityOf(channel)} onChange={(variant) => chooseQuality(channel.id, variant)} />
                      <StatusPill state={pillState} />
                      <Pressable
                        onPress={() => { setActiveState('connecting'); setActiveChannelId(channel.id) }}
                        disabled={!available || isActive}
                        style={[styles.pressable11, !available || isActive ? styles.pressable9 : styles.pressable2, { gap: 4 }]}
                      >
                        <Play size={12} color="#ffffff" />
                        <Text style={[styles.text13, { fontSize: 11.5 }]}>{t('dash.engineer.liveCamera.watch')}</Text>
                      </Pressable>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
          <Text style={[styles.text14, { fontSize: 11 }]}>{t('dash.engineer.liveCamera.securityNote')}</Text>
        </View>
      ) : null}
    </View>
  )
}

const DEVICE_TYPES = [
  { value: 'DVR', label: 'DVR' },
  { value: 'NVR', label: 'NVR' },
]

function ConnectForm({ projectTitle, hasDevice, busy, stage, message, onSubmit }) {
  const { t, td } = useLanguage()
  const [deviceType, setDeviceType] = useState('DVR')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  // Optional: blank means the backend's standard 554.
  const [rtspPort, setRtspPort] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const submit = async () => {
    if (!host.trim() || !port.trim() || !username.trim() || !password) return
    const ok = await onSubmit({ deviceType, host: host.trim(), port, rtspPort: rtspPort.trim(), username: username.trim(), password })
    // Whatever the outcome, the secret does not stay in memory afterwards.
    setPassword('')
    if (ok) {
      setHost('')
      setPort('')
      setRtspPort('')
      setUsername('')
    }
  }

  return (
    <View style={styles[card]}>
      <Text style={[styles.text17, { fontSize: 10.5, letterSpacing: 1.6 }]}>{t('ui.cctv.connectDvrNvr')}</Text>
      <Text style={[styles.text18, { fontSize: 18 }]}>{td(projectTitle)}</Text>
      {hasDevice ? <Text style={[styles.text19, { fontSize: 12 }]}>{t('ui.cctv.existingRecorderNote')}</Text> : null}
      <View style={styles.view21}>
        <SelectField label={t('ui.cctv.deviceType')} value={deviceType} onChange={(value) => value && setDeviceType(value)} options={DEVICE_TYPES} disabled={busy} />
        <TextField label={t('ui.cctv.ipAddressHost')} value={host} onChangeText={setHost} placeholder="192.168.1.100" autoCapitalize="none" autoCorrect={false} editable={!busy} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextField containerStyle={{ flex: 1 }} label={t('ui.cctv.port')} value={port} onChangeText={setPort} placeholder="80" keyboardType="number-pad" editable={!busy} />
          <TextField containerStyle={{ flex: 1, marginBottom: 2 }} label={t('ui.cctv.rtspPort')} value={rtspPort} onChangeText={setRtspPort} placeholder="554" keyboardType="number-pad" editable={!busy} />
        </View>
        <Text style={[styles.text20, { fontSize: 10.5 }]}>{t('ui.cctv.rtspPortHint')}</Text>
        <TextField label={t('ui.cctv.username')} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} editable={!busy} />
        <TextField label={t('login.password')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" textContentType="password" editable={!busy} />
      </View>
      <Pressable
        onPress={submit}
        disabled={busy}
        style={[styles.pressable12, busy ? styles.pressable13 : null, { gap: 8 }]}
      >
        {busy ? <ActivityIndicator size="small" color="#ffffff" /> : <ShieldCheck size={16} color="#ffffff" />}
        <Text style={[styles.text13, { fontSize: 13.5 }]}>
          {busy ? (stage === 'discovering' ? t('ui.cctv.discoveringCameras') : t('ui.cctv.verifyingDvrNvr')) : t('ui.cctv.verifyDevice')}
        </Text>
      </Pressable>
      <FormNotice message={message?.text} tone={message?.tone === 'error' ? 'error' : 'success'} style={{ marginTop: 10 }} />
      <View style={[styles.view22, { gap: 5 }]}>
        <Lock size={11} color={COLORS.slate[400]} />
        <Text style={[styles.text21, { fontSize: 11 }]}>{t('ui.cctv.credentialsNote')}</Text>
      </View>
    </View>
  )
}

export default function ProjectCameraPanel({ projectId, projectTitle = '' }) {
  const { t, td } = useLanguage()
  // Read through refs so a language change does not re-run the setup request.
  const tRef = useRef(t)
  tRef.current = t
  const tdRef = useRef(td)
  tdRef.current = td
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('idle')
  const [message, setMessage] = useState(null)
  const [devices, setDevices] = useState([])
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const loadCameras = useCallback(async () => {
    try {
      const rows = await fetchProjectCameraDevices(projectId)
      if (alive.current) setDevices(Array.isArray(rows) ? rows : [])
    } catch {
      if (alive.current) setDevices([])
    }
  }, [projectId])

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const next = await fetchProjectCameraSetup(projectId)
      if (!alive.current) return
      setStatus(next)
      if (next?.access_granted) await loadCameras()
    } catch (error) {
      if (alive.current) setLoadError(apiMessage(error, tRef.current('ui.cctv.cameraUnavailable'), tRef.current, tdRef.current))
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [projectId, loadCameras])

  useEffect(() => { refresh() }, [refresh])

  const submit = async (form) => {
    setBusy(true)
    setStage('discovering')
    setMessage(null)
    try {
      // One call: the server verifies the credentials, then discovers the cameras.
      const result = await connectProjectCamera(projectId, form)
      if (!alive.current) return true
      setMessage({ tone: 'ok', text: t('ui.cctv.deviceVerified') })
      setShowForm(false)
      await refresh()
      return Boolean(result?.access_granted)
    } catch (error) {
      if (alive.current) setMessage({ tone: 'error', text: apiMessage(error, t('ui.cctv.recorderNotVerified'), t, td) })
      return false
    } finally {
      if (alive.current) { setBusy(false); setStage('idle') }
    }
  }

  const title = status?.project_title || projectTitle

  if (loading) {
    return (
      <View style={[styles.view23, { gap: 8 }]}>
        <ActivityIndicator color={COLORS.brand[700]} />
        <Text style={[styles.text22, { fontSize: 13 }]}>{t('ui.cctv.loadingProjectCamera')}</Text>
      </View>
    )
  }

  if (loadError) {
    return (
      <View style={styles[card]}>
        <Text style={[styles.text5, { fontSize: 14 }]}>{t('ui.cctv.projectCamera')}</Text>
        <Text style={[styles.text23, { fontSize: 12.5 }]}>{loadError}</Text>
        <Pressable onPress={refresh} style={[styles.pressable14, { gap: 5 }]}>
          <RefreshCw size={13} color={COLORS.slate[600]} />
          <Text style={[styles.text8, { fontSize: 12 }]}>{t('dash.engineer.refresh')}</Text>
        </Pressable>
      </View>
    )
  }

  if (status?.access_granted) {
    return (
      <View style={{ gap: 12 }}>
        <View style={[styles.view24, { gap: 8 }]}>
          <View style={styles.view6}>
            <Text style={[styles.text9, { fontSize: 10.5, letterSpacing: 1.6 }]}>{t('ui.cctv.projectCamera')}</Text>
            <Text style={[styles.text24, { fontSize: 16 }]} numberOfLines={1}>{td(title)}</Text>
          </View>
          <Pressable onPress={refresh} style={[styles.pressable15, { gap: 5 }]}>
            <RefreshCw size={13} color={COLORS.brand[800]} />
            <Text style={[styles.text25, { fontSize: 12 }]}>{t('dash.engineer.refresh')}</Text>
          </Pressable>
        </View>
        <CameraViewer devices={devices} projectTitle={title} />
      </View>
    )
  }

  if (showForm) {
    return <ConnectForm projectTitle={title} hasDevice={Boolean(status?.has_device)} busy={busy} stage={stage} message={message} onSubmit={submit} />
  }

  return (
    <View style={[styles[card], styles.view25]}>
      <Text style={[styles.text9, { fontSize: 10.5, letterSpacing: 1.6 }]}>{t('ui.cctv.projectCamera')}</Text>
      <Text style={[styles.text18, { fontSize: 18 }]}>{td(title)}</Text>
      <Text style={[styles.text26, { fontSize: 13, lineHeight: 19 }]}>{t('ui.cctv.noAccessConfigured')}</Text>
      <Pressable
        onPress={() => { setMessage(null); setShowForm(true) }}
        style={[styles.pressable16, { gap: 8 }]}
      >
        <Video size={16} color="#ffffff" />
        <Text style={[styles.text13, { fontSize: 13.5 }]}>{t('ui.cctv.connectDvrNvr')}</Text>
      </Pressable>
    </View>
  )
}

const styles = createStyles((c) => ({
  tone: { borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  tone2: { backgroundColor: c.redSoft, borderColor: c.redBorder },
  tone3: { color: c.redText },
  tone4: { backgroundColor: '#ef4444' },
  tone5: { backgroundColor: c.amberSoft, borderColor: c.amberBorder },
  tone6: { color: c.amberTextStrong },
  tone7: { backgroundColor: '#f59e0b' },
  tone8: { backgroundColor: c.emeraldSoft, borderColor: c.emeraldBorder },
  tone9: { color: c.emeraldText },
  tone10: { backgroundColor: '#10b981' },
  tone11: { backgroundColor: c.muted, borderColor: c.border },
  text: { color: c.textSecondary },
  tone12: { backgroundColor: '#94a3b8' },
  view: { height: 24.5, flexDirection: 'row', alignItems: 'center', borderRadius: 9999, borderWidth: 1, paddingHorizontal: 8.75 },
  view2: { height: 5.25, width: 5.25, borderRadius: 9999 },
  text2: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  view3: { height: 28, flexDirection: 'row', alignItems: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 1.75 },
  pressable: { height: 24.5, minWidth: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 5.25, paddingHorizontal: 7 },
  pressable2: { backgroundColor: '#236645' },
  pressable3: { opacity: 0.4 },
  text3: { fontFamily: 'Inter_700Bold' },
  text4: { color: '#ffffff' },
  view4: { overflow: 'hidden', borderRadius: 10.5, backgroundColor: '#000000' },
  view5: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'flex-start' },
  view6: { flex: 1 },
  text5: { fontFamily: 'Inter_700Bold', color: c.text },
  text6: { fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  pressable4: { height: 28, width: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.border },
  view7: { alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#0f172a' },
  text7: { paddingHorizontal: 14, textAlign: 'center', fontFamily: 'Inter_600SemiBold', color: '#fda4af' },
  view8: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  pressable5: { height: 28, flexDirection: 'row', alignItems: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10.5 },
  text8: { fontFamily: 'Inter_700Bold', color: c.textSecondary },
  view9: { marginTop: 10.5, flexDirection: 'row', alignItems: 'center' },
  text9: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.textFaint },
  view10: { flexDirection: 'row', borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 1.75 },
  pressable6: { height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 5.25, paddingHorizontal: 10.5 },
  view11: { alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, padding: 17.5 },
  text10: { textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.text },
  text11: { marginTop: 3.5, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textMuted },
  text12: { marginBottom: 3.5, fontFamily: 'Inter_700Bold', color: c.textSecondary },
  view12: { height: 35, flexDirection: 'row', alignSelf: 'flex-start', borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 1.75 },
  pressable7: { height: 28, justifyContent: 'center', borderRadius: 5.25, paddingHorizontal: 10.5 },
  view13: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center' },
  pressable8: { height: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  pressable9: { backgroundColor: c.mutedStronger },
  text13: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  text14: { marginTop: 10.5, fontFamily: 'Inter_400Regular', color: c.textFaint },
  text15: { marginBottom: 10.5, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.textFaint },
  text16: { paddingVertical: 14, textAlign: 'center', fontFamily: 'Inter_600SemiBold', color: c.roseTextSoft },
  view14: { flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, borderWidth: 1, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  view15: { borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft },
  view16: { borderColor: c.border, backgroundColor: c.subtle },
  view17: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: c.brandSoft },
  pressable10: { height: 28, flexDirection: 'row', alignItems: 'center', borderRadius: 7, paddingHorizontal: 10.5 },
  view18: { borderRadius: 10.5, borderWidth: 1, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  view19: { flexDirection: 'row', alignItems: 'center' },
  view20: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  pressable11: { marginLeft: 'auto', height: 28, flexDirection: 'row', alignItems: 'center', borderRadius: 7, paddingHorizontal: 10.5 },
  text17: { textAlign: 'center', fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.textFaint },
  text18: { marginTop: 3.5, textAlign: 'center', fontFamily: 'Manrope_800ExtraBold', color: c.text },
  text19: { marginTop: 7, textAlign: 'center', fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  view21: { marginTop: 14 },
  text20: { marginBottom: 10.5, fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  pressable12: { height: 38.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  pressable13: { opacity: 0.6 },
  view22: { marginTop: 10.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text21: { fontFamily: 'Inter_600SemiBold', color: c.textFaint },
  view23: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 35 },
  text22: { fontFamily: 'Inter_700Bold', color: c.textMuted },
  text23: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  pressable14: { marginTop: 10.5, height: 31.5, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 7, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10.5 },
  view24: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text24: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  pressable15: { height: 31.5, flexDirection: 'row', alignItems: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5 },
  text25: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  view25: { alignItems: 'center' },
  text26: { marginTop: 10.5, textAlign: 'center', fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  pressable16: { marginTop: 14, height: 38.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038', paddingHorizontal: 17.5 },
}))
