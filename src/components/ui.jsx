// ---------------------------------------------------------------------------
// Port of the web src/components/site/ui.jsx plus the .btn/.eyebrow/.glass-card
// component classes that lived in index.css. On native those @layer components
// don't exist, so each is a real component here with identical styling.
// framer-motion -> moti (same declarative from/animate API, same easing).
// ---------------------------------------------------------------------------
import { useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path } from 'react-native-svg'
import { SHADOW, TYPE, EASE_SIGNATURE } from '../theme/tokens'
import { createStyles } from '../theme/createStyles'

/* Scroll-reveal wrapper — web used whileInView; on native we animate on mount,
   which reads the same because sections enter as you scroll to them. */
export function Reveal({ children, delay = 0, y = 26, style }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: y }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 700, delay, easing: EASE_SIGNATURE }}
      style={style}
    >
      {children}
    </MotiView>
  )
}

/* Web: .container-x = mx-auto w-full max-w-7xl px-5 sm:px-8 */
export function Container({ children, style }) {
  return <View style={[styles.view, style]}>{children}</View>
}

/* Web: .eyebrow / .eyebrow-dark */
export function Eyebrow({ children, dark = false }) {
  return (
    <View
      style={dark ? styles.view2 : styles.view3}
    >
      <Text
        style={[styles.text, dark ? styles.text2 : styles.text3, { fontSize: 11, letterSpacing: 1.6 }]}
      >
        {children}
      </Text>
    </View>
  )
}

export function SectionHeading({ eyebrow, title, highlight, sub, align = 'center', dark = false }) {
  const alignClass = align === 'center' ? 'tone' : 'tone2'
  const textAlign = align === 'center' ? 'center' : 'left'
  return (
    <View style={[styles.pressable, styles[alignClass]]}>
      {eyebrow ? (
        <Reveal>
          <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
        </Reveal>
      ) : null}
      <Reveal delay={60}>
        <Text
          style={[styles.text4, dark ? styles.text5 : styles.text6, { fontSize: TYPE.sectionTitle, lineHeight: TYPE.sectionTitle * 1.12, letterSpacing: -0.9, textAlign }]}
        >
          {title}
          {highlight ? <Text style={styles.text7}> {highlight}</Text> : null}
        </Text>
      </Reveal>
      {sub ? (
        <Reveal delay={120}>
          <Text
            style={[styles.text8, dark ? styles.text9 : styles.text10, { fontSize: TYPE.body, lineHeight: TYPE.body * 1.6, textAlign }]}
          >
            {sub}
          </Text>
        </Reveal>
      ) : null}
    </View>
  )
}

/* Web: SmartImage — falls back to a brand gradient if the remote photo fails */
export function SmartImage({ source, style, contentFit = 'cover', fallbackColors }) {
  const [failed, setFailed] = useState(false)
  const colors = fallbackColors || ['#c3dccd', '#6ba88a']
  if (failed || !source) {
    return <LinearGradient colors={colors} style={style} />
  }
  return (
    <Image
      source={typeof source === 'string' ? { uri: source } : source}
      style={style}
      contentFit={contentFit}
      transition={220}
      onError={() => setFailed(true)}
    />
  )
}

export function Stars({ rating = 5, size = 14 }) {
  return (
    <View style={[styles.view4, { gap: 2 }]}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Svg key={index} width={size} height={size} viewBox="0 0 20 20">
          <Path
            d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.28 3.95a1 1 0 0 0 .95.69h4.15c.97 0 1.37 1.24.59 1.81l-3.36 2.44a1 1 0 0 0-.36 1.12l1.28 3.95c.3.92-.75 1.69-1.54 1.12l-3.36-2.44a1 1 0 0 0-1.18 0l-3.36 2.44c-.79.57-1.84-.2-1.54-1.12l1.28-3.95a1 1 0 0 0-.36-1.12L2.08 9.38c-.78-.57-.38-1.81.59-1.81h4.15a1 1 0 0 0 .95-.69l1.28-3.95Z"
            fill={index < rating ? '#2e7d55' : '#e2e8f0'}
          />
        </Svg>
      ))}
    </View>
  )
}

/* ---------- Buttons (web .btn-primary / .btn-ghost / .btn-white) ---------- */

export function PrimaryButton({ label, onPress, icon, loading, disabled, style, full = false }) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={[styles.pressable2, full ? styles.pressable : styles.pressable3, isDisabled ? styles.pressable4 : null, style, SHADOW.orange]}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <>
          <Text style={[styles.text11, { fontSize: 14 }]}>
            {label}
          </Text>
          {icon}
        </>
      )}
    </Pressable>
  )
}

export function GhostButton({ label, onPress, icon, disabled, style, full = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.pressable5, full ? styles.pressable : styles.pressable3, disabled ? styles.pressable4 : null, style, SHADOW.card]}
    >
      {icon}
      <Text style={[styles.text12, { fontSize: 14 }]}>
        {label}
      </Text>
    </Pressable>
  )
}

/* Web: .pill */
export function Pill({ label, icon }) {
  return (
    <View
      style={[styles.view5, SHADOW.card]}
    >
      {icon}
      <Text style={[styles.text13, { fontSize: 13 }]}>
        {label}
      </Text>
    </View>
  )
}

/* Web: .glass-card */
export function GlassCard({ children, style }) {
  return (
    <View style={[styles.view6, SHADOW.card, style]}>
      {children}
    </View>
  )
}

export function StatCard({ value, label }) {
  return (
    <View style={styles.view7}>
      <Text style={[styles.text14, { fontSize: 20 }]}>
        {value}
      </Text>
      <Text style={[styles.text15, { fontSize: 11, lineHeight: 14 }]}>
        {label}
      </Text>
    </View>
  )
}

export function Divider({ style }) {
  return <View style={[styles.view8, style]} />
}

export function EmptyState({ title, body, action }) {
  return (
    <View style={styles.view9}>
      <Text style={[styles.text16, { fontSize: 18 }]}>
        {title}
      </Text>
      {body ? (
        <Text style={[styles.text17, { fontSize: 14, lineHeight: 21 }]}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={styles.view10}>{action}</View> : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { width: '100%', paddingHorizontal: 17.5 },
  view2: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 10.5, paddingVertical: 3.5 },
  view3: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 9999, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 3.5 },
  text: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  text2: { color: '#9dc5af' },
  text3: { color: c.brandText },
  tone: { alignItems: 'center' },
  tone2: { alignItems: 'flex-start' },
  pressable: { width: '100%' },
  text4: { fontFamily: 'Manrope_800ExtraBold', marginTop: 14 },
  text5: { color: '#ffffff' },
  text6: { color: c.text },
  text7: { color: '#2e7d55' },
  text8: { marginTop: 14, fontFamily: 'Inter_400Regular' },
  text9: { color: '#cbd5e1' },
  text10: { color: c.textMuted },
  view4: { flexDirection: 'row' },
  pressable2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9999, backgroundColor: '#134127', paddingHorizontal: 24.5, paddingVertical: 14 },
  pressable3: { alignSelf: 'flex-start' },
  pressable4: { opacity: 0.6 },
  text11: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  pressable5: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 9999, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.card, paddingHorizontal: 21, paddingVertical: 14 },
  text12: { fontFamily: 'Inter_700Bold', color: c.text },
  view5: { flexDirection: 'row', alignItems: 'center', gap: 5.25, borderRadius: 9999, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12.25, paddingVertical: 7 },
  text13: { fontFamily: 'Inter_600SemiBold', color: c.text },
  view6: { borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.7)', backgroundColor: c.cardTranslucent },
  view7: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, alignItems: 'center' },
  text14: { fontFamily: 'Manrope_800ExtraBold', color: c.brandTextStrong },
  text15: { marginTop: 1.75, fontFamily: 'Inter_600SemiBold', color: c.textMuted, textAlign: 'center' },
  view8: { height: 0.88, backgroundColor: c.mutedStrong },
  view9: { alignItems: 'center', paddingHorizontal: 21, paddingVertical: 42 },
  text16: { fontFamily: 'Manrope_800ExtraBold', color: c.text, textAlign: 'center' },
  text17: { marginTop: 7, fontFamily: 'Inter_400Regular', color: c.textMuted, textAlign: 'center' },
  view10: { marginTop: 17.5 },
}))
