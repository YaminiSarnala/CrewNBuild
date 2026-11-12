// A short message that floats near the bottom of the screen and hides itself
// after a few seconds — for the result of a save, where a notice at the top of
// a long form would be out of sight.
//
//   const { toast, showToast, hideToast } = useToast()
//   showToast(t('…'), 'success')            // or 'error'
//   …
//   <Toast {...toast} onHide={hideToast} />   // last child of the screen root
//
// It sits above the safe-area inset, or just above the tab bar on a tab screen.
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs'
import { AlertCircle, CheckCircle2 } from 'lucide-react-native'
import { createStyles, currentPalette } from '../theme/createStyles'

const DEFAULT_DURATION = 3000

export function useToast() {
  const [toast, setToast] = useState({ message: '', tone: 'success', id: 0 })
  // A new id restarts the timer even when the same message is shown twice.
  const showToast = useCallback((message, tone = 'success') => {
    setToast((current) => ({ message: String(message || ''), tone, id: current.id + 1 }))
  }, [])
  const hideToast = useCallback(() => setToast((current) => ({ ...current, message: '' })), [])
  return { toast, showToast, hideToast }
}

export default function Toast({ message, tone = 'success', id, onHide, duration = DEFAULT_DURATION }) {
  const insets = useSafeAreaInsets()
  // Undefined outside a tab navigator; a tab screen already ends above the tab bar.
  const tabBarHeight = useContext(BottomTabBarHeightContext)
  const opacity = useRef(new Animated.Value(0)).current
  const onHideRef = useRef(onHide)
  onHideRef.current = onHide

  useEffect(() => {
    if (!message) return undefined
    opacity.setValue(0)
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start()
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => onHideRef.current?.())
    }, duration)
    return () => clearTimeout(timer)
  }, [message, id, duration, opacity])

  if (!message) return null
  const error = tone === 'error'
  const c = currentPalette()
  const Icon = error ? AlertCircle : CheckCircle2
  const bottom = (tabBarHeight ? 0 : insets.bottom) + 16
  const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] })

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom, opacity, transform: [{ translateY }] }]}
    >
      <Pressable
        onPress={() => onHideRef.current?.()}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, error ? styles.toastError : styles.toastSuccess]}
      >
        <View style={[styles.icon, error ? styles.iconError : styles.iconSuccess]}>
          <Icon size={16} color={error ? c.roseText : c.emeraldText} />
        </View>
        <Text style={[styles.text, error ? styles.textError : styles.textSuccess]}>{message}</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = createStyles((c) => ({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 50, elevation: 12 },
  toast: {
    width: '100%', maxWidth: 520, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, backgroundColor: c.card, paddingHorizontal: 12, paddingVertical: 11,
    shadowColor: '#0f172a', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  toastSuccess: { borderColor: c.emeraldBorder },
  toastError: { borderColor: c.roseBorder },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconSuccess: { backgroundColor: c.emeraldSoft },
  iconError: { backgroundColor: c.roseSoft },
  text: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  textSuccess: { color: c.emeraldText },
  textError: { color: c.roseText },
}))
