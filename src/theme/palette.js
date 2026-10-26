// The app's colours, light and dark, by what they are for. Every stylesheet
// reads its colours from here (through createStyles), so the dark theme is one
// switch rather than a second set of styles. Dark values are the web's dark
// theme (index.css html.dark .dash-canvas).
const hues = {
  emerald: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46' },
  red: { 50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b' },
  rose: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239' },
  amber: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e' },
  sky: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985' },
  violet: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6' },
  blue: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af' },
  orange: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412' },
}

const rgba = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function statusColours(dark) {
  const out = {}
  Object.entries(hues).forEach(([hue, shade]) => {
    out[`${hue}Soft`] = dark ? rgba(shade[500], 0.1) : shade[50]
    out[`${hue}SoftStrong`] = dark ? rgba(shade[500], 0.15) : shade[100]
    out[`${hue}BorderSoft`] = dark ? rgba(shade[500], 0.3) : shade[100]
    out[`${hue}Border`] = dark ? rgba(shade[500], 0.3) : shade[200]
    out[`${hue}TextSoft`] = dark ? shade[300] : shade[600]
    out[`${hue}Text`] = dark ? shade[300] : shade[700]
    out[`${hue}TextStrong`] = dark ? shade[300] : shade[800]
  })
  return out
}

export const LIGHT = {
  canvas: '#f1f5f9', // page background
  card: '#ffffff', // cards, sheets, inputs
  cardTranslucent: 'rgba(255, 255, 255, 0.9)',
  subtle: '#f8fafc', // a raised row inside a card
  muted: '#f1f5f9',
  mutedStrong: '#e2e8f0',
  mutedStronger: '#cbd5e1',
  paper: '#fcfaf3',
  brandSoft: '#f0f6f2',
  brandSoft40: 'rgba(240, 246, 242, 0.4)',
  brandSoft50: 'rgba(240, 246, 242, 0.5)',
  brandSoftStrong: '#e0eee6',
  text: '#1f2937',
  textSoft: '#334155',
  textSecondary: '#475569',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  brandTextDeep: '#0d3225',
  brandTextStrong: '#134127',
  brandText: '#1a5038',
  brandTextSoft: '#236645',
  border: '#e2e8f0',
  borderSoft: '#f1f5f9',
  borderStrong: '#cbd5e1',
  brandBorderSoft: '#f0f6f2',
  brandBorder: '#e0eee6',
  brandBorderStrong: '#c3dccd',
  ...statusColours(false),
}

export const DARK = {
  canvas: '#020617',
  card: '#0f172a',
  cardTranslucent: 'rgba(15, 23, 42, 0.9)',
  subtle: '#1e293b',
  muted: '#1e293b',
  mutedStrong: '#334155',
  mutedStronger: '#475569',
  paper: '#1e293b',
  brandSoft: '#0c2317',
  brandSoft40: 'rgba(12, 35, 23, 0.4)',
  brandSoft50: 'rgba(12, 35, 23, 0.5)',
  brandSoftStrong: '#10301f',
  text: '#e2e8f0',
  textSoft: '#cbd5e1',
  textSecondary: '#94a3b8',
  textMuted: '#94a3b8',
  textFaint: '#64748b',
  brandTextDeep: '#c9e9d6',
  brandTextStrong: '#a8d8bd',
  brandText: '#82c29e',
  brandTextSoft: '#5fae85',
  border: '#1e293b',
  borderSoft: '#1e293b',
  borderStrong: '#334155',
  brandBorderSoft: '#0c2317',
  brandBorder: '#10301f',
  brandBorderStrong: '#16402a',
  ...statusColours(true),
}
