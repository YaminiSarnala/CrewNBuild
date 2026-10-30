// Light and dark values for the Tailwind colours the Builder screens use in
// `className` (NativeWind). Same idea as the web's index.css dark theme
// (html.dark .dash-canvas): the screens keep their light utilities
// (bg-white, text-graphite, border-slate-200 …) and the dark theme remaps what
// those utilities paint.
//
// tailwind.config.js points each remapped utility at a CSS variable
// (e.g. bg-white → rgb(var(--bg-white))). ThemeVars (App.js) sets the
// variables for the active theme with NativeWind's vars(), so a theme switch
// repaints every className at once. global.css holds the light values as the
// default. Values are "R G B" so opacity modifiers (bg-white/80) still work.
//
// Keep this file, tailwind.config.js and global.css in step: global.css
// repeats the light values below as its :root defaults.

const NAVY = [15, 23, 42] // dark card #0f172a

const hex = (value) => {
  const n = parseInt(value.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
// `amount` of `top` over `base`, as a solid colour (the web uses rgba tints on
// the dark card; a solid blend keeps opacity modifiers usable).
const over = (top, amount, base = NAVY) => hex(top).map((c, i) => Math.round(c * amount + base[i] * (1 - amount)))
const rgb = (parts) => parts.join(' ')

// Tailwind 500 / 300 / 200 shades of the status hues the Builder screens use.
const HUES = {
  amber: { 500: '#f59e0b', 300: '#fcd34d', 200: '#fde68a' },
  emerald: { 500: '#10b981', 300: '#6ee7b7', 200: '#a7f3d0' },
  red: { 500: '#ef4444', 300: '#fca5a5', 200: '#fecaca' },
  rose: { 500: '#f43f5e', 300: '#fda4af', 200: '#fecdd3' },
  sky: { 500: '#0ea5e9', 300: '#7dd3fc', 200: '#bae6fd' },
  violet: { 500: '#8b5cf6', 300: '#c4b5fd', 200: '#ddd6fe' },
  blue: { 500: '#3b82f6', 300: '#93c5fd', 200: '#bfdbfe' },
  orange: { 500: '#f97316', 300: '#fdba74', 200: '#fed7aa' },
}
// Tailwind light shades (50/100 backgrounds, 100/200/300 borders, 600–900 text).
const TW = {
  amber: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f' },
  emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
  red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d' },
  rose: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337' },
  sky: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e' },
  violet: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95' },
  blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
  orange: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
}

// [name, light, dark] — name becomes the CSS variable --<name>.
const ROWS = [
  // Surfaces (web: white cards → slate-900, slate/cream → slate-800).
  ['bg-white', [255, 255, 255], NAVY],
  ['bg-slate-50', [248, 250, 252], [30, 41, 59]],
  ['bg-slate-100', [241, 245, 249], [30, 41, 59]],
  ['bg-slate-200', [226, 232, 240], [51, 65, 85]],
  ['bg-slate-300', [203, 213, 225], [71, 85, 105]],
  ['bg-paper', [252, 250, 243], [17, 28, 47]],
  ['bg-surface', [248, 250, 252], [30, 41, 59]],
  ['bg-surface-deep', [241, 245, 249], [2, 6, 23]],
  ['bg-brand-50', [240, 246, 242], [12, 35, 23]],
  ['bg-brand-100', [224, 238, 230], [16, 48, 31]],
  // Text (web: graphite/slate ink → light ink; brand greens → pale greens).
  ['tx-graphite', [31, 41, 55], [226, 232, 240]],
  ['tx-slate-950', [2, 6, 23], [241, 245, 249]],
  ['tx-slate-900', [15, 23, 42], [226, 232, 240]],
  ['tx-slate-800', [30, 41, 59], [226, 232, 240]],
  ['tx-slate-700', [51, 65, 85], [203, 213, 225]],
  ['tx-slate-600', [71, 85, 105], [148, 163, 184]],
  ['tx-slate-500', [100, 116, 139], [148, 163, 184]],
  ['tx-slate-400', [148, 163, 184], [100, 116, 139]],
  ['tx-brand-600', [35, 102, 69], [95, 174, 133]],
  ['tx-brand-700', [26, 80, 56], [130, 194, 158]],
  ['tx-brand-800', [19, 65, 39], [168, 216, 189]],
  ['tx-brand-900', [13, 50, 37], [201, 233, 214]],
  ['tx-brand-950', [6, 31, 21], [217, 240, 227]],
  // Borders (web: slate lines → slate-800/700, brand lines → deep greens).
  ['bd-slate-50', [248, 250, 252], [30, 41, 59]],
  ['bd-slate-100', [241, 245, 249], [30, 41, 59]],
  ['bd-slate-200', [226, 232, 240], [30, 41, 59]],
  ['bd-slate-300', [203, 213, 225], [51, 65, 85]],
  ['bd-brand-100', [224, 238, 230], [16, 48, 31]],
  ['bd-brand-200', [195, 220, 205], [22, 64, 42]],
  ['bd-brand-300', [157, 197, 175], [47, 109, 81]],
]

// Status hues: soft backgrounds, borders and text (palette.js statusColours).
Object.keys(HUES).forEach((hue) => {
  const tw = TW[hue]
  const accent = HUES[hue][500]
  ROWS.push([`bg-${hue}-50`, hex(tw[50]), over(accent, 0.12)])
  ROWS.push([`bg-${hue}-100`, hex(tw[100]), over(accent, 0.18)])
  ROWS.push([`bd-${hue}-100`, hex(tw[100]), over(accent, 0.3)])
  ROWS.push([`bd-${hue}-200`, hex(tw[200]), over(accent, 0.35)])
  ROWS.push([`bd-${hue}-300`, hex(tw[300]), over(accent, 0.45)])
  ROWS.push([`tx-${hue}-600`, hex(tw[600]), hex(HUES[hue][300])])
  ROWS.push([`tx-${hue}-700`, hex(tw[700]), hex(HUES[hue][300])])
  ROWS.push([`tx-${hue}-800`, hex(tw[800]), hex(HUES[hue][300])])
  ROWS.push([`tx-${hue}-900`, hex(tw[900]), hex(HUES[hue][200])])
})

export const VAR_NAMES = ROWS.map(([name]) => name)

export const LIGHT_VARS = Object.fromEntries(ROWS.map(([name, light]) => [`--${name}`, rgb(light)]))
export const DARK_VARS = Object.fromEntries(ROWS.map(([name, , dark]) => [`--${name}`, rgb(dark)]))

export const STATUS_HUES = Object.keys(HUES)