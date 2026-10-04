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
export function Container({ children, className = '' }) {
  return <View className={`w-full px-5 ${className}`}>{children}</View>
}

/* Web: .eyebrow / .eyebrow-dark */
export function Eyebrow({ children, dark = false }) {
  return (
    <View
      className={
        dark
          ? 'self-start flex-row items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1'
          : 'self-start flex-row items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1'
      }
    >
      <Text
        className={`font-sansBold uppercase ${dark ? 'text-brand-300' : 'text-brand-700'}`}
        style={{ fontSize: 11, letterSpacing: 1.6 }}
      >
        {children}
      </Text>
    </View>
  )
}

export function SectionHeading({ eyebrow, title, highlight, sub, align = 'center', dark = false }) {
  const alignClass = align === 'center' ? 'items-center' : 'items-start'
  const textAlign = align === 'center' ? 'center' : 'left'
  return (
    <View className={`w-full ${alignClass}`}>
      {eyebrow ? (
        <Reveal>
          <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
        </Reveal>
      ) : null}
      <Reveal delay={60}>
        <Text
          className={`font-display mt-4 ${dark ? 'text-white' : 'text-graphite'}`}
          style={{ fontSize: TYPE.sectionTitle, lineHeight: TYPE.sectionTitle * 1.12, letterSpacing: -0.9, textAlign }}
        >
          {title}
          {highlight ? <Text className="text-brand-500"> {highlight}</Text> : null}
        </Text>
      </Reveal>
      {sub ? (
        <Reveal delay={120}>
          <Text
            className={`mt-4 font-sans ${dark ? 'text-slate-300' : 'text-slate-500'}`}
            style={{ fontSize: TYPE.body, lineHeight: TYPE.body * 1.6, textAlign }}
          >
            {sub}
          </Text>
        </Reveal>
      ) : null}
    </View>
  )
}

/* Web: SmartImage — falls back to a brand gradient if the remote photo fails */
export function SmartImage({ source, style, className = '', contentFit = 'cover', fallbackColors }) {
  const [failed, setFailed] = useState(false)
  const colors = fallbackColors || ['#c3dccd', '#6ba88a']
  if (failed || !source) {
    return <LinearGradient colors={colors} style={style} className={className} />
  }
  return (
    <Image
      source={typeof source === 'string' ? { uri: source } : source}
      style={style}
      className={className}
      contentFit={contentFit}
      transition={220}
      onError={() => setFailed(true)}
    />
  )
}

export function Stars({ rating = 5, size = 14 }) {
  return (
    <View className="flex-row" style={{ gap: 2 }}>
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

export function PrimaryButton({ label, onPress, icon, loading, disabled, className = '', full = false }) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      className={`flex-row items-center justify-center gap-2 rounded-full bg-brand-800 px-7 py-4 active:bg-brand-700 ${
        full ? 'w-full' : 'self-start'
      } ${isDisabled ? 'opacity-60' : ''} ${className}`}
      style={SHADOW.orange}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <>
          <Text className="font-sansBold text-white" style={{ fontSize: 14 }}>
            {label}
          </Text>
          {icon}
        </>
      )}
    </Pressable>
  )
}

export function GhostButton({ label, onPress, icon, disabled, className = '', full = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`flex-row items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-4 active:bg-brand-50 ${
        full ? 'w-full' : 'self-start'
      } ${disabled ? 'opacity-60' : ''} ${className}`}
      style={SHADOW.card}
    >
      {icon}
      <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  )
}

/* Web: .pill */
export function Pill({ label, icon }) {
  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2"
      style={SHADOW.card}
    >
      {icon}
      <Text className="font-sansSemi text-graphite" style={{ fontSize: 13 }}>
        {label}
      </Text>
    </View>
  )
}

/* Web: .glass-card */
export function GlassCard({ children, className = '', style }) {
  return (
    <View className={`rounded-3xl border border-white/70 bg-white/90 ${className}`} style={[SHADOW.card, style]}>
      {children}
    </View>
  )
}

export function StatCard({ value, label }) {
  return (
    <View className="flex-1 px-4 py-4 items-center">
      <Text className="font-display text-brand-800" style={{ fontSize: 20 }}>
        {value}
      </Text>
      <Text className="mt-0.5 font-sansSemi text-slate-500 text-center" style={{ fontSize: 11, lineHeight: 14 }}>
        {label}
      </Text>
    </View>
  )
}

export function Divider({ className = '' }) {
  return <View className={`h-px bg-slate-200 ${className}`} />
}

export function EmptyState({ title, body, action }) {
  return (
    <View className="items-center px-6 py-12">
      <Text className="font-display text-graphite text-center" style={{ fontSize: 18 }}>
        {title}
      </Text>
      {body ? (
        <Text className="mt-2 font-sans text-slate-500 text-center" style={{ fontSize: 14, lineHeight: 21 }}>
          {body}
        </Text>
      ) : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  )
}
