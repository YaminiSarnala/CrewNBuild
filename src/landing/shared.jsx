// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/shared.jsx.
//
// The web file is mostly Tailwind class strings. React Native has no gradients
// in className, no :hover and no backdrop-blur, so each shared class becomes a
// real component here. Colour values are unchanged.
//
// Image URLs are gone: on native, artwork is bundled and required, so every
// picture comes from LANDING_ART / roleMeta in content.js instead.
// ---------------------------------------------------------------------------
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import { Easing } from 'react-native-reanimated'
import { LANDING_ART } from './content'

/* Web: transitionTimingFunction.soft = cubic-bezier(0.23, 1, 0.32, 1) */
export const EASE_SOFT = Easing.bezier(0.23, 1, 0.32, 1)

/* The oc-* palette, for style props where className is unavailable. */
export const OC = {
  green: '#126b45',
  deep: '#083e2b',
  mint: '#dff0e8',
  paper: '#f7faf7',
  ink: '#17201c',
  muted: '#61736a',
  amber: '#f4b740',
  line: '#d9e6de',
  lineStrong: '#d5ddd9',
  night: '#0b0c0b',
  faint: '#98a29d',
  sunken: '#f1f5f3',
}

/* Web: containerClass = w-[min(100%-48px,1240px)] mx-auto */
export const GUTTER = 24

/* Web: sectionPaddingClass = py-[clamp(4.5rem,3rem+6vw,8rem)].
   At phone width the clamp resolves near its lower bound. */
export const SECTION_PADDING = 72
export const SECTION_PADDING_WIDE = 104

/* Web: amberSurfaceClass */
export function AmberSurface({ children, style, radius = 0 }) {
  return (
    <LinearGradient
      colors={['#f9c85f', '#f4b740', '#e9a92f']}
      locations={[0, 0.52, 1]}
      style={[{ borderRadius: radius }, style]}
    >
      {children}
    </LinearGradient>
  )
}

/* Web used scroll-triggered reveals (scrollReveal.js). whileInView has no direct
   native equivalent, so sections animate on mount — which reads the same as they
   scroll into view. */
export function Reveal({ children, delay = 0, y = 24, style }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: y }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 620, delay, easing: EASE_SOFT }}
      style={style}
    >
      {children}
    </MotiView>
  )
}

/* Web: Brand — logo + OCTABUILD wordmark. The <a href> becomes an onPress. */
export function Brand({ onPress, size = 46, light = false }) {
  const content = (
    <View className="flex-row items-center" style={{ gap: 10 }}>
      <Image
        source={LANDING_ART.logo}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
      <Text
        className="font-display"
        style={{ fontSize: 15, letterSpacing: 2.5, color: light ? '#ffffff' : OC.deep }}
      >
        OCTABUILD
      </Text>
    </View>
  )
  if (!onPress) return content
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="OCTABUILD home">
      {content}
    </Pressable>
  )
}

/* Web: labelTones — the amber dot needs a different colour on an amber band. */
const LABEL_TONES = {
  dark: { text: OC.green, dot: OC.amber },
  light: { text: '#b9d8c5', dot: OC.amber },
  onAmber: { text: OC.deep, dot: OC.deep },
}

export function SectionLabel({ children, tone = 'dark' }) {
  const { text, dot } = LABEL_TONES[tone] || LABEL_TONES.dark
  return (
    <View className="flex-row items-center" style={{ gap: 9 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      <Text
        className="font-sansBold uppercase"
        style={{ fontSize: 10, letterSpacing: 1.4, color: text }}
      >
        {children}
      </Text>
    </View>
  )
}

/* ------------------------------- Buttons -------------------------------- */

/* Web: buttonClass / smallButtonClass — solid green pill. */
export function GreenButton({ label, onPress, icon, small = false, style, full = false }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center justify-center rounded-full active:opacity-85 ${
        full ? 'w-full' : 'self-start'
      }`}
      style={[
        {
          minHeight: small ? 42 : 50,
          paddingHorizontal: small ? 22 : 28,
          gap: 13,
          backgroundColor: OC.green,
          shadowColor: OC.green,
          shadowOffset: { width: 0, height: 11 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
          elevation: 5,
        },
        style,
      ]}
    >
      <Text className="font-sansBold text-white" style={{ fontSize: 12 }}>
        {label}
      </Text>
      {icon}
    </Pressable>
  )
}

/* Web: creamButtonClass — white pill with green text, for the dark hero. */
export function CreamButton({ label, onPress, icon, style, full = false }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center justify-center rounded-full bg-white active:opacity-85 ${
        full ? 'w-full' : 'self-start'
      }`}
      style={[{ minHeight: 50, paddingHorizontal: 28, gap: 13 }, style]}
    >
      <Text className="font-sansBold" style={{ fontSize: 12, color: OC.green }}>
        {label}
      </Text>
      {icon}
    </Pressable>
  )
}

/* Web: languagePillClass — outline pill for the language switch. */
export function LanguagePill({ label, onPress, icon }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center rounded-full active:opacity-70"
      style={{
        gap: 7,
        minHeight: 38,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: 'rgba(8,62,43,0.2)',
      }}
    >
      {icon}
      <Text className="font-sansBold" style={{ fontSize: 11, color: OC.deep }}>
        {label}
      </Text>
    </Pressable>
  )
}

/* Web: roleAvatarClass — round frame holding one role face at card scale. */
export function RoleFace({ source, size = 40 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: OC.line,
        backgroundColor: OC.mint,
      }}
    >
      <Image source={source} style={{ width: size, height: size }} contentFit="cover" />
    </View>
  )
}

/**
 * One role character with its idle motion.
 *
 * Each character is its own file, cut on a shared baseline and to a shared
 * height, so giving them all the same height preserves their real proportions —
 * the same rule the web version relies on.
 */
export function RoleCharacter({ role, height, animate = true }) {
  const picture = (
    <Image
      source={role.image}
      style={{ height, width: '100%' }}
      contentFit="contain"
      contentPosition="bottom center"
      transition={220}
    />
  )
  if (!animate || !role.idle) return picture

  const { idle } = role
  return (
    <MotiView
      from={{ translateY: idle.translateY[0], rotate: `${idle.rotate[0]}deg` }}
      animate={{ translateY: idle.translateY[1], rotate: `${idle.rotate[1]}deg` }}
      transition={{
        type: 'timing',
        duration: idle.duration,
        loop: true,
        repeatReverse: true,
        easing: Easing.inOut(Easing.ease),
      }}
      style={{ height, width: '100%' }}
    >
      {picture}
    </MotiView>
  )
}

/* Web: the "Coming soon" chip on the equipment role. */
export function ComingSoonChip({ label }) {
  return (
    <View
      className="self-start rounded-full"
      style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: OC.amber }}
    >
      <Text className="font-sansBold uppercase" style={{ fontSize: 9, letterSpacing: 1, color: OC.deep }}>
        {label}
      </Text>
    </View>
  )
}

/* Web: the dashed decorative rings behind hero and roles artwork. */
export function DashedRing({ size, style, duration = 2800 }) {
  return (
    <MotiView
      from={{ opacity: 0.35, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1.04 }}
      transition={{ type: 'timing', duration, loop: true, repeatReverse: true }}
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: 'rgba(255,255,255,0.7)',
          opacity: 0.7,
        },
        style,
      ]}
      pointerEvents="none"
    />
  )
}
