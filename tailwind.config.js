/** @type {import('tailwindcss').Config} */
// ---------------------------------------------------------------------------
// Ported verbatim from the OctaBuild web app's tailwind.config.js so that every
// colour token resolves to exactly the same hex value on mobile as on the web.
// Only two things changed for React Native:
//   1. `content` points at the RN source tree.
//   2. `presets: [nativewind/preset]` is added (required by NativeWind v4).
// Keyframe animations are NOT handled by Tailwind on native — they live in
// src/theme/tokens.js as Moti/Reanimated configs with identical timings.
// ---------------------------------------------------------------------------
module.exports = {
  darkMode: 'class',
content: [
  './App.js',
  './src/components/**/*.{js,jsx}',
  './src/screens/**/*.{js,jsx}',
  './src/site/**/*.{js,jsx}',
  './src/navigation/**/*.{js,jsx}',
],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Primary brand — Dark Construction Green (#134127)
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
        // Legacy alias — "forest" tokens resolve to the dark green brand family
        // so dashboards share the same green identity.
        forest: {
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
        // Secondary — Dark Slate
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
        surface: {
          DEFAULT: '#f8fafc',
          deep: '#f1f5f9',
        },
        cream: {
          DEFAULT: '#f8fafc',
          deep: '#f1f5f9',
        },
        // Error / rejection tone (kept red so alerts stay readable)
        warm: '#dc2626',
        gold: {
          DEFAULT: '#134127',
          soft: '#2e7d55',
        },
        accent: {
          DEFAULT: '#1a5038',
          soft: '#2e7d55',
        },
        neon: {
          DEFAULT: '#134127',
          soft: '#2e7d55',
        },
        oc: {
          green: '#126b45',
          deep: '#083e2b',
          mint: '#dff0e8',
          paper: '#f7faf7',
          ink: '#17201c',
          muted: '#61736a',
          amber: '#f4b740',
          line: '#d9e6de',
          'line-strong': '#d5ddd9',
          night: '#0b0c0b',
          faint: '#98a29d',
          sunken: '#f1f5f3',
        },
        ocbrand: {
          50: '#ecf6f1',
          100: '#d5ebe0',
          200: '#add8c3',
          300: '#7bc2a2',
          400: '#22a06b',
          500: '#1a8659',
          700: '#0e5537',
        },
        ocaccent: {
          50: '#fef8ea',
          100: '#fceec9',
          400: '#e8b23c',
          600: '#b27d1c',
        },
        // The marketing site's paper background, used as bg-[#fcfaf3] on web.
        paper: '#fcfaf3',
      },
      fontFamily: {
        // Loaded via @expo-google-fonts in App.js — same two families as web.
        display: ['Manrope_800ExtraBold'],
        displaySemi: ['Manrope_600SemiBold'],
        sans: ['Inter_400Regular'],
        sansMedium: ['Inter_500Medium'],
        sansSemi: ['Inter_600SemiBold'],
        sansBold: ['Inter_700Bold'],
      },
      letterSpacing: {
        tightest: '-0.045em',
        tighter: '-0.035em',
      },
    },
  },
  plugins: [],
}
