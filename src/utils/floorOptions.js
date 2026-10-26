import { FLOOR_TYPE_KEYS } from '../i18n/optionKeys.js'
import { translate } from '../i18n/translate.js'

// Floor configurations for the public "Get Free Estimate" form.
// `label` is the English source text and the fallback; what renders comes from
// FLOOR_TYPE_KEYS via floorTypeLabel below.
// Each option carries the display label and the number of constructed floor
// levels used by the backend's built-up-area calculation. The `value` is the
// canonical code submitted through the estimate payload as `floor_type`.
export const FLOOR_OPTIONS = [
  { value: 'G', label: 'Ground Floor (G)', floors: 1 },
  { value: 'G+1', label: 'G + 1 Floor', floors: 2 },
  { value: 'G+2', label: 'G + 2 Floors', floors: 3 },
  { value: 'G+3', label: 'G + 3 Floors', floors: 4 },
  { value: 'G-1', label: 'Basement / G - 1', floors: 2 },
  { value: 'G-2', label: 'Basement / G - 2', floors: 3 },
  { value: 'G-3', label: 'Basement / G - 3', floors: 4 },
  { value: 'DUPLEX', label: 'Duplex', floors: 2 },
  { value: 'MANSION', label: 'Mansion', floors: 3 },
]

// Kuwait floor configurations (G through G+4).
export const KUWAIT_FLOOR_OPTIONS = [
  { value: 'G', label: 'Ground Floor (G)', floors: 1 },
  { value: 'G+1', label: 'G + 1 Floor', floors: 2 },
  { value: 'G+2', label: 'G + 2 Floors', floors: 3 },
  { value: 'G+3', label: 'G + 3 Floors', floors: 4 },
  { value: 'G+4', label: 'G + 4 Floors', floors: 5 },
]

export function floorOption(value) {
  return FLOOR_OPTIONS.find((option) => option.value === value) || null
}

export function kuwaitFloorOption(value) {
  return KUWAIT_FLOOR_OPTIONS.find((option) => option.value === value) || null
}

/**
 * The list a given country offers, and one option out of it.
 *
 * The estimate calculator has always chosen between the two lists inline. These
 * two helpers are that same choice, named once, so the profile, project and
 * property screens select from the canonical lists rather than each repeating
 * the country test — or, worse, carrying a copy of the options.
 */
export function floorOptionsForCountry(country) {
  return String(country || '').trim().toLowerCase() === 'kuwait' ? KUWAIT_FLOOR_OPTIONS : FLOOR_OPTIONS
}

export function floorOptionForCountry(country, value) {
  return floorOptionsForCountry(country).find((option) => option.value === value) || null
}

/**
 * The numeric floor count a code stands for, for the `floors` column that every
 * existing query and calculation still reads. Falls back to the count already
 * held, so a screen that cannot resolve a code never writes a wrong number.
 */
export function floorCountFor(country, value, fallback = 1) {
  const option = floorOptionForCountry(country, value)
  return option ? option.floors : Number(fallback) || 1
}

/**
 * The configuration code that stands for a given floor count -- the reverse of
 * floorCountFor, for a record that carries the count but no code, which is
 * every project saved before floor_type existed.
 *
 * Read-only by intent: it lets a form show the configuration the stored count
 * already means, and never changes that count. Several codes can share a count
 * (G+1, G-1 and DUPLEX are all two floors), so this answers with the first
 * match; only one floor is unambiguous, since Ground Floor is the sole option
 * that means one.
 */
export function floorTypeForCount(country, floors) {
  const count = Number(floors)
  if (!count) return ''
  const option = floorOptionsForCountry(country).find((candidate) => candidate.floors === count)
  return option ? option.value : ''
}

// Translated, and correct for both lists: the Kuwait-only G+4 is not in
// FLOOR_OPTIONS, so looking only there returned an empty label for it.
export function floorTypeLabel(value) {
  if (!value) return ''
  const key = FLOOR_TYPE_KEYS[value]
  if (key) return translate(key)
  return (floorOption(value) || kuwaitFloorOption(value))?.label || value
}
