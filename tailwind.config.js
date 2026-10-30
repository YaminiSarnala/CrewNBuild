// NativeWind (Tailwind) setup for the screens that style with `className`
// (the Builder module). Colours match the web's tailwind.config.js.
//
// Dark theme: the utilities below are pointed at CSS variables instead of
// fixed colours, so the same className paints light or dark depending on the
// theme (web index.css "html.dark .dash-canvas" remap). The variable values
// live in src/theme/nativeVars.js; ThemeVars (App.js) applies the active set.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

const HUES = ['amber', 'emerald', 'red', 'rose', 'sky', 'violet', 'blue', 'orange']
const scale = (prefix, name, shades) => Object.fromEntries(shades.map((shade) => [shade, v(`${prefix}-${name}-${shade}`)]))
const status = (prefix, shades) => Object.fromEntries(HUES.map((hue) => [hue, scale(prefix, hue, shades)]))

module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Primary brand — Dark Construction Green (web).
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
        paper: '#fcfaf3',
        surface: { DEFAULT: '#f8fafc', deep: '#f1f5f9' },
        // Always white (translucent overlays on green or photo backgrounds),
        // unlike bg-white, which turns navy in the dark theme.
        glass: '#ffffff',
      },
      // Theme-aware utilities (light ↔ dark), as on the web.
      backgroundColor: {
        white: v('bg-white'),
        paper: v('bg-paper'),
        surface: { DEFAULT: v('bg-surface'), deep: v('bg-surface-deep') },
        slate: scale('bg', 'slate', [50, 100, 200, 300]),
        brand: scale('bg', 'brand', [50, 100]),
        ...status('bg', [50, 100]),
      },
      textColor: {
        graphite: v('tx-graphite'),
        slate: scale('tx', 'slate', [400, 500, 600, 700, 800, 900, 950]),
        brand: scale('tx', 'brand', [600, 700, 800, 900, 950]),
        ...status('tx', [600, 700, 800, 900]),
      },
      borderColor: {
        slate: scale('bd', 'slate', [50, 100, 200, 300]),
        brand: scale('bd', 'brand', [100, 200, 300]),
        ...status('bd', [100, 200, 300]),
      },
      // Same families the app loads in App.js (web: Inter + Manrope).
      fontFamily: {
        sans: ['Inter_400Regular'],
        sansMedium: ['Inter_500Medium'],
        sansSemi: ['Inter_600SemiBold'],
        sansBold: ['Inter_700Bold'],
        display: ['Manrope_800ExtraBold'],
      },
    },
  },
  plugins: [],
}