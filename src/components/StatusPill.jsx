// Port of the web components/dashboard/StatusPill.jsx: a stored status code
// shown as the word for it in the reader's language. `soft` is the at-a-glance
// palette the owner's Recent Activity uses (pending amber, accepted green).
import { View, Text } from 'react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { ink, line, soft } from '../theme/tint'
export const STATUS_KEYS = {
  pending: 'ui.status.pending',
  accepted: 'ui.status.accepted',
  rejected: 'ui.status.rejected',
  completed: 'ui.status.completed',
  active: 'ui.status.active',
   fulfilled: 'ui.status.fulfilled',
  approved: 'store.status.approved',
  issued: 'store.status.issued',
  // A store request's stage (what an open request waits for, or how it ended).
  partially_issued: 'store.status.partiallyIssued',
  partially_available: 'store.status.partiallyAvailable',
  procurement_pending: 'store.status.procurementPending',
  partially_fulfilled: 'store.status.partiallyFulfilled',
  cancelled: 'store.status.cancelled',
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
  approved: ['#ecfdf5', '#047857', '#a7f3d0'],
  issued: ['#ecfdf5', '#047857', '#a7f3d0'],
  partially_available: ['#fff1f2', '#be123c', '#fecdd3'],
  procurement_pending: ['#f5f3ff', '#6d28d9', '#ddd6fe'],
  partially_fulfilled: ['#fffbeb', '#b45309', '#fde68a'],
  partially_issued: ['#fffbeb', '#b45309', '#fde68a'],
  cancelled: ['#f1f5f9', '#475569', '#e2e8f0'],
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
        <View style={{ backgroundColor: soft(bg, fg), borderColor: line(border, fg), borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: ink(fg), fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{statusLabel(normalized, t)}</Text>
    </View>
  )
}
