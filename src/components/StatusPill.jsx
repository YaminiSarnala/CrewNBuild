// Port of the web components/dashboard/StatusPill.jsx: a stored status code
// shown as the word for it in the reader's language. `soft` is the at-a-glance
// palette the owner's Recent Activity uses (pending amber, accepted green).
import { View, Text } from 'react-native'
import { useLanguage } from '../i18n/LanguageContext'

export const STATUS_KEYS = {
  pending: 'ui.status.pending',
  accepted: 'ui.status.accepted',
  rejected: 'ui.status.rejected',
  completed: 'ui.status.completed',
  active: 'ui.status.active',
  fulfilled: 'ui.status.fulfilled',
  in_progress: 'ui.status.inProgress',
  closed: 'ui.status.closed',
  open: 'ui.status.open',
  draft: 'ui.shared.statusDraft',
  listed: 'ui.shared.statusListed',
  under_offer: 'ui.shared.statusUnderOffer',
  sold: 'ui.shared.statusSold',
  withdrawn: 'ui.shared.statusWithdrawn',
}

// [background, text, border]
const TONES = {
  pending: ['#fffbeb', '#b45309', '#fde68a'],
  accepted: ['#ecfdf5', '#047857', '#a7f3d0'],
  completed: ['#ecfdf5', '#047857', '#a7f3d0'],
  fulfilled: ['#f0f9ff', '#0369a1', '#bae6fd'],
  rejected: ['#fff1f2', '#be123c', '#fecdd3'],
  withdrawn: ['#f1f5f9', '#475569', '#e2e8f0'],
  active: ['#f0f9ff', '#0369a1', '#bae6fd'],
}
const NEUTRAL = ['#f8fafc', '#475569', '#e2e8f0']

export function statusLabel(status, t) {
  const key = STATUS_KEYS[String(status || 'pending').toLowerCase()]
  return t(key || 'ui.status.unknown')
}

export default function StatusPill({ status }) {
  const { t } = useLanguage()
  const normalized = String(status || 'pending').toLowerCase()
  const [bg, fg, border] = TONES[normalized] || NEUTRAL
  return (
    <View style={{ backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: fg, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{statusLabel(normalized, t)}</Text>
    </View>
  )
}
