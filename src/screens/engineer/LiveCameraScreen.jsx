// Port of web EngineerLiveCamera + LiveCameraPlayer. LL-HLS via expo-video,
// with the playback token sent as an Authorization header on every request,
// renewed every 45s, and the session ended when the player closes.
import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, TextInput, Alert, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useVideoPlayer, VideoView } from 'expo-video'
import { ChevronLeft, Cctv, Wifi } from 'lucide-react-native'
import { Panel, PanelState } from '../../components/DashboardShell'
import {
  fetchProjectCameraSetup, connectProjectCamera, fetchProjectCameraDevices,
  startPlaybackSession, renewPlaybackSession, endPlaybackSession,
  searchRecordings, startRecordedPlayback,
} from '../../api/cctv'
import { COLORS } from '../../theme/tokens'

const RENEW_INTERVAL_MS = 45000

function LivePlayer({ camera, onBack }) {
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let sessionId = null
    let renewTimer = null
    startPlaybackSession(camera.channel.id, { transport: 'LL_HLS' })
      .then((result) => {
        if (!active) { endPlaybackSession(result.session_id).catch(() => {}); return }
        sessionId = result.session_id
        setSession(result)
        renewTimer = setInterval(() => { renewPlaybackSession(sessionId).catch(() => {}) }, RENEW_INTERVAL_MS)
      })
      .catch((err) => setError(err?.response?.data?.detail || 'Could not start the live stream.'))
    return () => {
      active = false
      if (renewTimer) clearInterval(renewTimer)
      if (sessionId) endPlaybackSession(sessionId).catch(() => {})
    }
  }, [camera.channel.id])

  const player = useVideoPlayer(
    session ? { uri: session.playback_url, headers: { Authorization: `Bearer ${session.playback_token}` } } : null,
    (p) => { p.loop = false; p.play() },
  )

  return (
    <View>
      <Pressable onPress={onBack} className="mb-3 flex-row items-center gap-1">
        <ChevronLeft size={18} color={COLORS.brand[700]} />
        <Text className="text-sm font-extrabold text-brand-700">All cameras</Text>
      </Pressable>
      <Text className="text-lg font-extrabold text-graphite">{camera.label}</Text>
      {!!error && (
        <View className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
          <Text className="text-[13px] font-semibold text-rose-700">{error}</Text>
        </View>
      )}
      {session ? (
        <View className="mt-3 overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: 16 / 9 }}>
          <VideoView player={player} style={{ width: '100%', height: '100%' }} allowsFullscreen nativeControls />
          <View className="absolute left-2 top-2 flex-row items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1">
            <View className="h-2 w-2 rounded-full bg-red-500" />
            <Text className="text-[10px] font-extrabold text-white">LIVE</Text>
          </View>
        </View>
      ) : !error ? (
        <Text className="mt-4 text-sm font-semibold text-slate-500">Connecting to the site camera…</Text>
      ) : null}
    </View>
  )
}


const SPEEDS = ['1', '1.5', '2', '3']

function RecordedPlayer({ camera, segment, onBack }) {
  const [speed, setSpeed] = useState('1')
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')

  // Speed is a property of the DVR replay session, so changing it opens a new
  // session — same rule as the web player.
  useEffect(() => {
    let active = true
    let sessionId = null
    let renewTimer = null
    setSession(null)
    setError('')
    startRecordedPlayback(camera.channel.id, { start: segment.start_local, end: segment.end_local, speed })
      .then((result) => {
        if (!active) { endPlaybackSession(result.session_id).catch(() => {}); return }
        sessionId = result.session_id
        setSession(result)
        renewTimer = setInterval(() => { renewPlaybackSession(sessionId).catch(() => {}) }, RENEW_INTERVAL_MS)
      })
      .catch((err) => setError(err?.response?.data?.detail || 'Could not open this recording.'))
    return () => {
      active = false
      if (renewTimer) clearInterval(renewTimer)
      if (sessionId) endPlaybackSession(sessionId).catch(() => {})
    }
  }, [camera.channel.id, segment.start_local, segment.end_local, speed])

  const player = useVideoPlayer(
    session ? { uri: session.playback_url, headers: { Authorization: `Bearer ${session.playback_token}` } } : null,
    (p) => { p.play() },
  )

  return (
    <View>
      <Pressable onPress={onBack} className="mb-3 flex-row items-center gap-1">
        <ChevronLeft size={18} color={COLORS.brand[700]} />
        <Text className="text-sm font-extrabold text-brand-700">Recordings</Text>
      </Pressable>
      <Text className="text-lg font-extrabold text-graphite">{camera.label}</Text>
      <Text className="mt-0.5 text-xs font-semibold text-slate-500">
        {String(segment.start_local).replace('T', ' ')} → {String(segment.end_local).slice(11)}
      </Text>
      {!!error && (
        <View className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
          <Text className="text-[13px] font-semibold text-rose-700">{error}</Text>
        </View>
      )}
      {session ? (
        <View className="mt-3 overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: 16 / 9 }}>
          <VideoView player={player} style={{ width: '100%', height: '100%' }} allowsFullscreen nativeControls />
        </View>
      ) : !error ? (
        <Text className="mt-4 text-sm font-semibold text-slate-500">Opening the recording…</Text>
      ) : null}
      <View className="mt-3 flex-row items-center gap-2">
        <Text className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Speed</Text>
        <View className="flex-row gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {SPEEDS.map((option) => (
            <Pressable key={option} onPress={() => setSpeed(option)} className={`h-8 items-center justify-center rounded-md px-3 ${speed === option ? 'bg-brand-600' : ''}`}>
              <Text className={`text-xs font-extrabold ${speed === option ? 'text-white' : 'text-slate-600'}`}>{option}×</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  )
}

function RecordedBrowser({ camera, onBack }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [fromTime, setFromTime] = useState('06:00')
  const [toTime, setToTime] = useState('18:00')
  const [segments, setSegments] = useState(null)
  const [searching, setSearching] = useState(false)
  const [playing, setPlaying] = useState(null)
  const [error, setError] = useState('')

  async function search() {
    setSearching(true)
    setError('')
    try {
      const result = await searchRecordings(camera.channel.id, {
        start: `${date}T${fromTime}:00`,
        end: `${date}T${toTime}:00`,
      })
      const rows = Array.isArray(result) ? result : (result?.segments || [])
      setSegments(rows)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Search failed. Check the date and times.')
    } finally {
      setSearching(false)
    }
  }

  if (playing) return <RecordedPlayer camera={camera} segment={playing} onBack={() => setPlaying(null)} />

  return (
    <View>
      <Pressable onPress={onBack} className="mb-3 flex-row items-center gap-1">
        <ChevronLeft size={18} color={COLORS.brand[700]} />
        <Text className="text-sm font-extrabold text-brand-700">All cameras</Text>
      </Pressable>
      <Panel title={`Recordings · ${camera.label}`}>
        <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite" placeholderTextColor={COLORS.slate[400]} />
        <View className="mt-2 flex-row gap-2">
          <TextInput value={fromTime} onChangeText={setFromTime} placeholder="From (HH:MM)" className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite" placeholderTextColor={COLORS.slate[400]} />
          <TextInput value={toTime} onChangeText={setToTime} placeholder="To (HH:MM)" className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite" placeholderTextColor={COLORS.slate[400]} />
        </View>
        {!!error && <Text className="mt-2 text-[13px] font-semibold text-rose-700">{error}</Text>}
        <Pressable onPress={search} disabled={searching} className={`mt-3 h-11 items-center justify-center rounded-xl bg-brand-700 ${searching ? 'opacity-50' : ''}`}>
          <Text className="text-[13px] font-extrabold text-white">{searching ? 'Searching…' : 'Search recordings'}</Text>
        </Pressable>
        {segments !== null && (
          <View className="mt-3">
            <PanelState empty={!segments.length} emptyText="No recordings in that window.">
              {segments.map((segment, index) => (
                <Pressable key={index} onPress={() => setPlaying(segment)} className="border-b border-slate-100 py-3">
                  <Text className="text-[14px] font-extrabold text-graphite">
                    {String(segment.start_local).slice(11, 19)} → {String(segment.end_local).slice(11, 19)}
                  </Text>
                  <Text className="mt-0.5 text-[11px] font-semibold text-slate-500">Tap to play</Text>
                </Pressable>
              ))}
            </PanelState>
          </View>
        )}
      </Panel>
    </View>
  )
}
export default function LiveCameraScreen({ navigation, route }) {
  const insets = useSafeAreaInsets()
  const { projectId, projectTitle } = route.params || {}
  const [phase, setPhase] = useState('loading') // loading | setup | cameras
  const [setup, setSetup] = useState(null)
  const [devices, setDevices] = useState([])
  const [watching, setWatching] = useState(null)
  const [error, setError] = useState('')
  // one-time recorder verification form
  const [form, setForm] = useState({ deviceType: '', host: '', port: '', username: '', password: '' })
  const [connecting, setConnecting] = useState(false)

  async function loadDevices() {
    const rows = await fetchProjectCameraDevices(projectId)
    setDevices(Array.isArray(rows) ? rows : [])
    setPhase('cameras')
  }

  useEffect(() => {
    let active = true
    fetchProjectCameraSetup(projectId)
      .then(async (result) => {
        if (!active) return
        setSetup(result)
        const verified = result?.verified || result?.is_verified || result?.status === 'VERIFIED'
        if (verified) await loadDevices()
        else {
          const device = result?.device || {}
          setForm((f) => ({ ...f, deviceType: device.device_type || f.deviceType, host: device.host || '', port: device.port ? String(device.port) : '' }))
          setPhase('setup')
        }
      })
      .catch((err) => { if (active) { setError(err?.response?.data?.detail || 'Camera is not available for this project.'); setPhase('setup') } })
    return () => { active = false }
  }, [projectId])

  async function connect() {
    setConnecting(true)
    setError('')
    try {
      await connectProjectCamera(projectId, { ...form, port: form.port })
      setForm((f) => ({ ...f, password: '' }))
      await loadDevices()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not verify the recorder. Check the details and try again.')
    } finally {
      setConnecting(false)
    }
  }

  const cameras = devices.flatMap((device) => (device.channels || [])
    .filter((channel) => channel.is_enabled)
    .map((channel) => ({ channel, label: channel.name || `Camera ${channel.channel_number ?? channel.id}`, device })))

  return (
    <View className="flex-1 bg-brand-50" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {!watching && (
          <Pressable onPress={() => navigation.goBack()} className="mb-3 flex-row items-center gap-1">
            <ChevronLeft size={18} color={COLORS.brand[700]} />
            <Text className="text-sm font-extrabold text-brand-700">{projectTitle || 'Back'}</Text>
          </Pressable>
        )}

               {watching ? (
          watching.mode === 'recorded'
            ? <RecordedBrowser camera={watching} onBack={() => setWatching(null)} />
            : <LivePlayer camera={watching} onBack={() => setWatching(null)} />
        ) : phase === 'setup' ? (
          <Panel title="Connect the site recorder">
            <Text className="text-xs font-semibold text-slate-500">Verify the project's DVR once with its viewing account. The password is sent securely and never stored on this phone.</Text>
            {!!error && <Text className="mt-2 text-[13px] font-semibold text-rose-700">{error}</Text>}
            {[
              ['deviceType', 'Device type (e.g. CPPLUS_DVR)'], ['host', 'Host / IP address'],
              ['port', 'Port'], ['username', 'Viewer username'], ['password', 'Viewer password'],
            ].map(([key, placeholder]) => (
              <TextInput
                key={key}
                value={form[key]}
                onChangeText={(value) => setForm((f) => ({ ...f, [key]: value }))}
                placeholder={placeholder}
                secureTextEntry={key === 'password'}
                autoCapitalize="none"
                keyboardType={key === 'port' ? 'number-pad' : 'default'}
                className="mt-2 h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite"
                placeholderTextColor={COLORS.slate[400]}
              />
            ))}
            <Pressable onPress={connect} disabled={connecting || !form.host || !form.username || !form.password} className={`mt-3 h-11 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-700 ${connecting ? 'opacity-50' : ''}`}>
              <Wifi size={14} color="#fff" />
              <Text className="text-[13px] font-extrabold text-white">{connecting ? 'Verifying…' : 'Connect & verify'}</Text>
            </Pressable>
          </Panel>
        ) : (
          <Panel title="Site cameras">
            <PanelState loading={phase === 'loading'} empty={phase === 'cameras' && !cameras.length} emptyText="No enabled cameras on this recorder.">
                         {cameras.map((camera) => (
                <View key={camera.channel.id} className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                      <Cctv size={18} color={COLORS.brand[700]} />
                    </View>
                    <Text className="flex-1 text-[14px] font-extrabold text-graphite">{camera.label}</Text>
                  </View>
                  <View className="mt-3 flex-row gap-2">
                    <Pressable onPress={() => setWatching({ ...camera, mode: 'live' })} className="h-9 flex-1 items-center justify-center rounded-lg bg-brand-700">
                      <Text className="text-xs font-extrabold text-white">Watch live</Text>
                    </Pressable>
                    <Pressable onPress={() => setWatching({ ...camera, mode: 'recorded' })} className="h-9 flex-1 items-center justify-center rounded-lg border border-brand-200 bg-brand-50">
                      <Text className="text-xs font-extrabold text-brand-800">Recordings</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </PanelState>
          </Panel>
        )}
      </ScrollView>
    </View>
  )
}