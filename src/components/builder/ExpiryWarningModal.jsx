// The Builder's "plan ends in 3/2/1 days" popup (web subscription/ExpiryWarningModal),
// from the server's status (GET /subscriptions/me). Shown once per sign-in for each
// plan end and day count: closing it, or going to the plans, keeps it closed until
// the count drops or the builder signs in again. Display only: the server still
// enforces every limit and feature itself.
import { useEffect, useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { Clock, X } from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import { createStyles } from '../../theme/createStyles'
import { ink, soft } from '../../theme/tint'
import { expiryWarning, expiryWarningContent, expiryWarningDate } from '../../utils/subscriptionFormat'

// Popups already shown in this sign-in ("user:end:days"); emptied at sign-out.
const shown = new Set()
let shownFor = null

export default function ExpiryWarningModal({ status, userId, onViewPlans }) {
  const { t } = useLanguage()
  const warning = expiryWarning(status)
  const key = warning && userId ? `${userId}:${warning.end}:${warning.days}` : null
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // A different account (a sign-out and back in) sees its popups again.
    if (userId !== shownFor) { shown.clear(); shownFor = userId }
    if (key && !shown.has(key)) {
      shown.add(key)
      setOpen(true)
    }
  }, [key, userId])

  if (!open || !warning) return null
  const content = expiryWarningContent(warning)
  const dismiss = () => setOpen(false)
  const viewPlans = () => { dismiss(); onViewPlans() }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable onPress={dismiss} accessibilityLabel={t('subscription.expiryWarning.later')} style={styles.close}>
            <X size={18} color={ink('#64748b')} />
          </Pressable>
          <View style={styles.icon}><Clock size={20} color={ink('#b45309')} /></View>
          {content.messageKey ? (
            <Text style={styles.title}>{t(content.messageKey, content.values)}</Text>
          ) : (
            <>
              <Text style={styles.title}>{t(content.titleKey)}</Text>
              <Text style={styles.days}>{t('subscription.expiryWarning.daysLeft', content.values)}</Text>
              <Text style={styles.body}>{t(content.bodyKey, { date: expiryWarningDate(warning) })}</Text>
            </>
          )}
          <View style={styles.actions}>
            <Pressable onPress={dismiss} style={styles.later} accessibilityRole="button">
              <Text style={styles.laterText}>{t('subscription.expiryWarning.later')}</Text>
            </Pressable>
            <Pressable onPress={viewPlans} style={styles.cta} accessibilityRole="button">
              <Text style={styles.ctaText}>{t(content.ctaKey)}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = createStyles((c) => ({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.55)', padding: 20 },
  card: { width: '100%', maxWidth: 420, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 18 },
  close: { position: 'absolute', right: 10, top: 10, padding: 6 },
  icon: { height: 40, width: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: soft('#fffbeb', '#b45309') },
  title: { marginTop: 12, paddingRight: 28, fontFamily: 'Manrope_800ExtraBold', fontSize: 17, lineHeight: 23, color: c.text },
  days: { marginTop: 4, fontSize: 14, fontWeight: '800', color: ink('#b45309') },
  body: { marginTop: 8, fontSize: 13.5, lineHeight: 19, fontWeight: '500', color: c.textMuted },
  actions: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  later: { height: 40, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16 },
  laterText: { fontSize: 14, fontWeight: '800', color: c.textMuted },
  cta: { height: 40, justifyContent: 'center', borderRadius: 12, backgroundColor: '#059669', paddingHorizontal: 18 },
  ctaText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
}))