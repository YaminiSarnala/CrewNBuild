// ---------------------------------------------------------------------------
// Design tokens that Tailwind cannot express on React Native.
//
// The web app defines box-shadows and @keyframes in tailwind.config.js. Native
// has no CSS box-shadow and no CSS keyframes, so both are re-expressed here:
//   - SHADOW: iOS shadow* props + Android elevation, tuned to match the web blur
//   - MOTION: Moti/Reanimated configs using the SAME durations and easing curves
//     as the web keyframes, so the app feels identical in motion.
// ---------------------------------------------------------------------------
import { Easing } from 'react-native-reanimated'

export const COLORS = {
  brand: {
    50: '#f0f6f2',
    100: '#e0eee6',
    200: '#c3dccd',
    300: '#9dc5af',
    400: '#6ba88a',
    500: '#2e7d55',
    600: '#236645',
    700: '#1a5038',
    800: '#134127',
    900: '#0d3225',
    950: '#061f15',
  },
  graphite: '#1f2937',
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  warm: '#dc2626',
  paper: '#fcfaf3',
  white: '#ffffff',
  // A card's own surface: white in light, navy in dark.
  card: '#ffffff',
}

// --- dark theme -------------------------------------------------------------
// Colours passed in code (icon tints, placeholders, image backdrops) cannot use
// `dark:` classes, so COLORS itself switches. The values are the web's dark
// remaps (index.css html.dark .dash-canvas): light ink, navy surfaces, pale
// greens. ThemeProvider calls applyColorTheme before the app re-renders.
const LIGHT_COLORS = JSON.parse(JSON.stringify(COLORS))
const DARK_OVERRIDES = {
  graphite: '#e2e8f0',
  slate: { 50: '#1e293b', 100: '#1e293b', 200: '#334155', 300: '#475569', 400: '#64748b', 500: '#94a3b8', 600: '#94a3b8', 700: '#cbd5e1' },
  brand: { 50: '#0c2317', 100: '#10301f', 200: '#16402a', 600: '#5fae85', 700: '#82c29e', 800: '#a8d8bd', 900: '#c9e9d6' },
}

export function applyColorTheme(dark) {
  Object.assign(COLORS.brand, LIGHT_COLORS.brand)
  Object.assign(COLORS.slate, LIGHT_COLORS.slate)
  COLORS.graphite = LIGHT_COLORS.graphite
  COLORS.card = LIGHT_COLORS.card
  if (!dark) return
  Object.assign(COLORS.brand, DARK_OVERRIDES.brand)
  Object.assign(COLORS.slate, DARK_OVERRIDES.slate)
  COLORS.graphite = DARK_OVERRIDES.graphite
  COLORS.card = '#0f172a'
}

// Web: boxShadow.soft  '0 10px 40px -12px rgba(31, 41, 55, 0.12)'
// Web: boxShadow.card  '0 8px 30px -8px rgba(31, 41, 55, 0.10)'
// Web: boxShadow.float '0 24px 60px -15px rgba(31, 41, 55, 0.24)'
// Web: boxShadow.orange '0 18px 45px -18px rgba(19, 65, 39, 0.55)'
export const SHADOW = {
  soft: {
    shadowColor: '#1f2937',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  card: {
    shadowColor: '#1f2937',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 3,
  },
  float: {
    shadowColor: '#1f2937',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 12,
  },
  glow: {
    shadowColor: '#2e7d55',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  orange: {
    shadowColor: '#134127',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 10,
  },
}

// The web hero uses framer-motion with ease [0.22, 1, 0.36, 1] (easeOutExpo-ish)
// and 0.7s durations. Reproduced exactly.
export const EASE_SIGNATURE = Easing.bezier(0.22, 1, 0.36, 1)

export const MOTION = {
  // Web keyframe: fadeUp 0.8s cubic-bezier(0.22, 1, 0.36, 1)
  fadeUp: (delay = 0, y = 26) => ({
    from: { opacity: 0, translateY: y },
    animate: { opacity: 1, translateY: 0 },
    transition: { type: 'timing', duration: 700, delay, easing: EASE_SIGNATURE },
  }),
  // Web keyframe: fade only (hero avatars row)
  fade: (delay = 0) => ({
    from: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { type: 'timing', duration: 800, delay, easing: EASE_SIGNATURE },
  }),
  // Web keyframe: floaty 6s ease-in-out infinite, translateY 0 -> -10px
  floaty: {
    from: { translateY: 0 },
    animate: { translateY: -10 },
    transition: {
      type: 'timing',
      duration: 3000,
      loop: true,
      repeatReverse: true,
      easing: Easing.inOut(Easing.ease),
    },
  },
  // Web keyframe: floaty 9s
  floatySlow: {
    from: { translateY: 0 },
    animate: { translateY: -10 },
    transition: {
      type: 'timing',
      duration: 4500,
      loop: true,
      repeatReverse: true,
      easing: Easing.inOut(Easing.ease),
    },
  },
  // Web keyframe: pulseRing 2.4s ease-out infinite (scale stand-in for box-shadow spread)
  pulseRing: {
    from: { scale: 1, opacity: 0.45 },
    animate: { scale: 1.35, opacity: 0 },
    transition: {
      type: 'timing',
      duration: 2400,
      loop: true,
      repeatReverse: false,
      easing: Easing.out(Easing.ease),
    },
  },
  // Web keyframe: iconPulse 1.2s ease-out infinite
  iconPulse: {
    from: { scale: 1, opacity: 0.7 },
    animate: { scale: 1.4, opacity: 0 },
    transition: {
      type: 'timing',
      duration: 1200,
      loop: true,
      repeatReverse: false,
      easing: Easing.out(Easing.ease),
    },
  },
  // Web keyframe: wiggle 1s ease-in-out infinite
  wiggle: {
    from: { rotate: '-6deg', scale: 1.06 },
    animate: { rotate: '6deg', scale: 1.06 },
    transition: {
      type: 'timing',
      duration: 500,
      loop: true,
      repeatReverse: true,
      easing: Easing.inOut(Easing.ease),
    },
  },
}

// Type scale — web used clamp(); native gets fixed sizes at the mid-point of
// each clamp range, which is what a phone viewport would have resolved to.
export const TYPE = {
  heroTitle: 34, // clamp(2.2rem, 4.2vw, 3.6rem) at phone width
  sectionTitle: 26, // clamp(1.6rem, 3.2vw, 2.5rem) at phone width
  cardTitle: 17,
  body: 15,
  small: 13,
  tiny: 11,
}

export const RADIUS = {
  pill: 999,
  card: 24,
  panel: 16,
  input: 14,
}
