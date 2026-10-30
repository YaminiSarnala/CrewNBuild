// Theme-aware versions of the fixed colours the Builder screens pass in code
// (status chips, the coloured figure cards, quick-action tiles). Light theme:
// the colour as given. Dark theme: the web's dark remap — a faint tint of the
// accent on the navy card, a stronger tint for borders, and a lighter accent
// for text and icons so it stays readable.
//
//   soft('#ecfdf5', '#047857')   → chip / tile background
//   line('#a7f3d0', '#047857')   → its border
//   ink('#047857')               → its text / icon colour
//
// Screens render again on a theme change (RootNavigator remounts), so reading
// the theme here at render time is enough.
import { currentPalette } from './createStyles'
import { DARK } from './palette'

const NAVY = [15, 23, 42]
const WHITE = [255, 255, 255]

const parse = (value) => {
  const n = parseInt(String(value).replace('#', '').slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = (parts) => `#${parts.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
const mix = (top, amount, base) => toHex(parse(top).map((c, i) => c * amount + base[i] * (1 - amount)))

export const isDarkTheme = () => currentPalette() === DARK

/** Background of a tinted chip, card or tile. */
export const soft = (light, accent) => (isDarkTheme() ? mix(accent, 0.14, NAVY) : light)

/** Stronger tint (an inner chip on a tinted card). */
export const softStrong = (light, accent) => (isDarkTheme() ? mix(accent, 0.24, NAVY) : light)

/** Border of a tinted chip, card or tile. */
export const line = (light, accent) => (isDarkTheme() ? mix(accent, 0.38, NAVY) : light)

/** Text or icon colour on a tinted background. */
export const ink = (accent) => (isDarkTheme() ? mix(accent, 0.5, WHITE) : accent)

/** A neutral surface colour (white cards, light greys) for the active theme. */
export const surface = (light) => {
  if (!isDarkTheme()) return light
  const [r, g, b] = parse(light)
  return r + g + b > 700 ? '#0f172a' : '#1e293b'
}