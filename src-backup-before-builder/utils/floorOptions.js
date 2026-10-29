// Floor configurations for the public "Get Free Estimate" form.
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

export function floorOption(value) {
  return FLOOR_OPTIONS.find((option) => option.value === value) || null
}

export function floorTypeLabel(value) {
  return floorOption(value)?.label || ''
}