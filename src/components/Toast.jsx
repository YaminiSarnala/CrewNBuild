// The app's one way to show a short message: it always floats at the BOTTOM of
// the screen and hides itself after a few seconds. Use it for the result of an
// action (saved, sent, failed) and for the summary of a form's validation --
// the fields themselves are highlighted in the form.
//
//   import { toast } from '../components/Toast'
//   toast.success(t('…'))           toast.error(t('…'))
//   toast.info(t('…'))              toast.warning(t('…'))
//   toast.show(message, tone, { title })
//
// Where it appears: every screen shell (DashboardShell, StackScreenShell) and
// every SheetModal holds a <ToastHost />, and App.js one more for screens
// without a shell. The host in front -- the focused screen, or an open sheet --
// shows the message, so it sits just above the tab bar on a tab screen, at the
// bottom on a stack screen, inside a sheet while one is open, and above the
// keyboard while it is up.
//
// A message held in state (a save result, a load error) can be handed over
// declaratively with <ToastMessage tone text />, which shows it whenever the
// text changes and renders nothing in place.
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Animated, Keyboard, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'
import { NavigationContext } from '@react-navigation/native'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react-native'
import { createStyles, currentPalette } from '../theme/createStyles'

const DEFAULT_DURATION = 3000
const LONG_DURATION = 4500 // errors and long texts stay a little longer

// ---------------------------------------------------------------------------
// The message bus: hosts register; the most recently activated one shows.

let hosts = [] // [{ key, deliver }] in activation order; the last one is in front
let sequence = 0
// The message on screen (or waiting for a host) and when it should be gone. When
// the host in front changes -- a sheet closes, the app goes back a screen right
// after a save -- the message moves to the new front host instead of being lost.
let live = null // { payload, until }

function frontHost() {
  return hosts[hosts.length - 1] || null
}

function handOver() {
  const host = frontHost()
  if (!host || !live) return
  const remaining = live.until - Date.now()
  if (remaining < 400) { live = null; return }
  host.deliver({ ...live.payload, duration: remaining })
}

function activateHost(key, deliver) {
  hosts = hosts.filter((host) => host.key !== key)
  hosts.push({ key, deliver })
  handOver()
}

function deactivateHost(key) {
  const wasFront = frontHost()?.key === key
  hosts = hosts.filter((host) => host.key !== key)
  if (wasFront) handOver()
}

// The host calls this when the message is tapped away or its time is up.
function finished(id) {
  if (live?.payload.id === id) live = null
}

const normalTone = (tone) => {
  if (tone === 'warn') return 'warning'
  return ['success', 'error', 'info', 'warning'].includes(tone) ? tone : 'success'
}

function show(message, tone = 'success', options = {}) {
  const text = String(message ?? '').trim()
  if (!text) return
  sequence += 1
  const normal = normalTone(tone)
  const duration = options.duration
    || (normal === 'error' || text.length > 80 ? LONG_DURATION : DEFAULT_DURATION)
  const payload = {
    message: text,
    title: options.title ? String(options.title) : '',
    tone: normal,
    id: sequence,
    duration,
  }
  live = { payload, until: Date.now() + duration + 400 }
  frontHost()?.deliver(payload)
}

function hide() {
  live = null
  frontHost()?.deliver(null)
}

export const toast = {
  show,
  hide,
  success: (message, options) => show(message, 'success', options),
  error: (message, options) => show(message, 'error', options),
  info: (message, options) => show(message, 'info', options),
  warning: (message, options) => show(message, 'warning', options),
}

// Kept for the screens written against the older per-screen toast: the same
// bottom toast, through the shared hosts.
export function useToast() {
  const showToast = useCallback((message, tone = 'success') => show(message, tone), [])
  const hideToast = useCallback(() => hide(), [])
  return { toast: {}, showToast, hideToast }
}

// The older per-screen element: the hosts draw the toast now, so it renders nothing.
export default function Toast() {
  return null
}

/** Shows `text` as a toast whenever it (or `id`) changes; renders nothing in place. */
export function ToastMessage({ text, tone = 'error', title, id }) {
  useEffect(() => {
    if (text) show(text, tone, { title })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, tone, id])
  return null
}

// ---------------------------------------------------------------------------
// Where the toast is drawn.

// Focus of the screen the host sits in; always true outside a navigator.
function useScreenFocused() {
  const navigation = useContext(NavigationContext)
  const [focused, setFocused] = useState(() => (navigation ? navigation.isFocused() : true))
  useEffect(() => {
    if (!navigation) return undefined
    setFocused(navigation.isFocused())
    const offFocus = navigation.addListener('focus', () => setFocused(true))
    const offBlur = navigation.addListener('blur', () => setFocused(false))
    return () => { offFocus(); offBlur() }
  }, [navigation])
  return focused
}

// iOS does not resize the window for the keyboard: lift the toast above it.
function useKeyboardHeight() {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined
    const onShow = Keyboard.addListener('keyboardWillShow', (event) => setHeight(event?.endCoordinates?.height || 0))
    const onHide = Keyboard.addListener('keyboardWillHide', () => setHeight(0))
    return () => { onShow.remove(); onHide.remove() }
  }, [])
  return height
}

let hostSequence = 0

/**
 * One place the toast can be drawn. `offset` lifts it (e.g. above a sheet's
 * footer buttons); `active` lets a host step aside without unmounting.
 */
export function ToastHost({ offset = 0, active = true }) {
  const insets = useSafeAreaInsets()
  // Undefined outside a tab navigator; a tab screen already ends above the tab bar.
  const tabBarHeight = useContext(BottomTabBarHeightContext)
  const focused = useScreenFocused()
  const keyboardHeight = useKeyboardHeight()
  const keyRef = useRef(0)
  if (!keyRef.current) { hostSequence += 1; keyRef.current = hostSequence }
  const [current, setCurrent] = useState(null)
  const opacity = useRef(new Animated.Value(0)).current

  const live = active && focused
  useEffect(() => {
    const key = keyRef.current
    if (!live) {
      deactivateHost(key)
      setCurrent(null)
      return undefined
    }
    activateHost(key, setCurrent)
    return () => deactivateHost(key)
  }, [live])

  useEffect(() => {
    if (!current) return undefined
    opacity.setValue(0)
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start()
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        finished(current.id)
        setCurrent((shown) => (shown?.id === current.id ? null : shown))
      })
    }, current.duration || DEFAULT_DURATION)
    return () => clearTimeout(timer)
  }, [current, opacity])

  if (!current) return null
  const c = currentPalette()
  const tone = TONES[current.tone] || TONES.success
  const Icon = tone.icon
  const base = (tabBarHeight ? 0 : insets.bottom) + 16 + offset
  const bottom = keyboardHeight ? Math.max(base, keyboardHeight + 12) : base
  const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] })

  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { bottom, opacity, transform: [{ translateY }] }]}>
      <Pressable
        onPress={() => { finished(current.id); setCurrent(null) }}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { borderColor: c[tone.border] }]}
      >
        <View style={[styles.icon, { backgroundColor: c[tone.soft] }]}>
          <Icon size={16} color={c[tone.text]} />
        </View>
        <View style={styles.body}>
          {current.title ? <Text style={[styles.title, { color: c[tone.text] }]}>{current.title}</Text> : null}
          <Text style={[styles.text, { color: c[tone.text] }]}>{current.message}</Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const TONES = {
  success: { icon: CheckCircle2, border: 'emeraldBorder', soft: 'emeraldSoft', text: 'emeraldText' },
  error: { icon: AlertCircle, border: 'roseBorder', soft: 'roseSoft', text: 'roseText' },
  warning: { icon: AlertTriangle, border: 'amberBorder', soft: 'amberSoft', text: 'amberText' },
  info: { icon: Info, border: 'border', soft: 'brandSoft', text: 'brandText' },
}

const styles = createStyles((c) => ({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 1000, elevation: 24 },
  toast: {
    width: '100%', maxWidth: 520, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, backgroundColor: c.card, paddingHorizontal: 12, paddingVertical: 11,
    shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  text: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
}))
