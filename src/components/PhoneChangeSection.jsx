// Mobile number in Profile Settings (web components/dashboard/PhoneChangeSection).
//
// Where the server turns the WhatsApp check on, the number is how the account
// signs in, so it changes only to a number that has just passed that check: the
// new number gets a code, the code returns a one-time token for exactly that
// number, and POST /auth/phone/change swaps the number with it. The account id,
// role and every related record stay as they are. Elsewhere (the check off, or a
// country other than India) this section is not shown and the profile form keeps
// editing the number as before.
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Smartphone } from 'lucide-react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { changeAccountPhone } from '../api/phoneVerification'
import { mergeUser } from '../store/authSlice'
import { createStyles } from '../theme/createStyles'
import { ink } from '../theme/tint'
import { PhoneVerification, usePhoneConfig } from './WhatsAppCode'

function apiMessage(error, td, fallback) {
  const response = error?.response
  if (!response || response.status >= 500) return fallback
  const detail = response.data?.detail
  if (typeof detail === 'string' && detail.trim() && detail !== 'Not Found') return td(detail)
  if (typeof detail?.message === 'string') return td(detail.message)
  return fallback
}

export default function PhoneChangeSection({ style }) {
  const { t, td } = useLanguage()
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const config = usePhoneConfig()
  const currentPhone = user?.phone || ''
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState('')
  const [notice, setNotice] = useState('')
  // Remounts the WhatsApp check, so a finished or cancelled change starts clean.
  const [attempt, setAttempt] = useState(0)

  // The check only reaches Indian numbers; another country keeps its own form.
  const india = !user?.country_of_residence || user.country_of_residence === 'India'
  if (!config.signup || !india) return null

  const close = () => {
    setOpen(false)
    setPhone('')
    setProblem('')
    setAttempt((value) => value + 1)
  }

  const applyVerifiedNumber = async (token) => {
    if (!token || saving) return
    setSaving(true)
    setProblem('')
    try {
      const updated = await changeAccountPhone(phone, token)
      // The saved number, read back from the API, not the typed one.
      dispatch(mergeUser(updated?.user || updated || {}))
      setNotice(t('phoneChange.success'))
      close()
    } catch (error) {
      setProblem(apiMessage(error, td, t('phoneChange.failed')))
      // The token may be spent or refused: ask for a fresh check.
      setAttempt((value) => value + 1)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <View style={styles.icon}><Smartphone size={16} color={ink('#1a5038')} /></View>
        <Text style={styles.title}>{t('phoneChange.title')}</Text>
        {!open ? (
          <Pressable onPress={() => { setNotice(''); setOpen(true) }} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>{currentPhone ? t('phoneChange.change') : t('phoneChange.add')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.sub}>{t('phoneChange.subtitle')}</Text>
      <Text style={styles.current}>
        {`${t('phoneChange.current')}: `}
        <Text style={styles.currentValue}>{currentPhone ? `+91 ${currentPhone}` : t('phoneChange.none')}</Text>
      </Text>

      {open ? (
        <View style={{ gap: 8 }}>
          <PhoneVerification
            key={attempt}
            phone={phone}
            onPhoneChange={(value) => { setPhone(value); setProblem('') }}
            onVerifiedChange={applyVerifiedNumber}
            label={t('phoneChange.newLabel')}
          />
          {saving ? <Text style={[styles.status, { color: ink('#047857') }]}>{t('phoneChange.saving')}</Text> : null}
          <Pressable onPress={close} disabled={saving} accessibilityRole="button">
            <Text style={styles.cancel}>{t('phoneChange.cancel')}</Text>
          </Pressable>
        </View>
      ) : null}

      {problem ? <Text style={[styles.status, { color: ink('#b45309') }]}>{problem}</Text> : null}
      {notice ? <Text style={[styles.status, { color: ink('#047857') }]}>{notice}</Text> : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brandSoft },
  title: { flex: 1, fontSize: 14.5, fontFamily: 'Inter_700Bold', color: c.text },
  button: { borderRadius: 10, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft, paddingHorizontal: 12, paddingVertical: 7 },
  buttonText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  sub: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', color: c.textMuted },
  current: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  currentValue: { fontFamily: 'Inter_700Bold', color: c.text },
  status: { fontSize: 12.5, fontFamily: 'Inter_700Bold' },
  cancel: { fontSize: 12, fontFamily: 'Inter_700Bold', color: c.textMuted, textDecorationLine: 'underline' },
}))