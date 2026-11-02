// Email address and its check in Profile — the mobile port of the web's
// components/dashboard/EmailVerificationSection.jsx, for every role.
//
// The profile save (PATCH /auth/complete-profile) cannot change the e-mail, so
// it has its own flow: type the address -> a 6 digit code is e-mailed -> the
// server saves the address on the account, verified, once the code checks out
// and answers with the updated account. A phone-first (WhatsApp) account adds
// its e-mail here. Servers without the route say so instead of failing quietly.
import { useEffect, useState } from 'react'
import { View, Text, TextInput } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { Mail } from 'lucide-react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { mergeUser } from '../store/authSlice'
import { sendProfileEmailCode, verifyProfileEmailCode } from '../api/emailVerification'
import { CodeActions, Notice, OtpBoxes, OutlineButton, codeComplete, emptyCode, useCountdown, useRequestGate } from './WhatsAppCode'
import { EMAIL_PATTERN } from '../utils/profileValidation'
import { createStyles } from '../theme/createStyles'

// Statuses whose `detail` the e-mail endpoints write for people to read: wrong
// code (400), no code asked for (404), address on another account or already
// verified (409), expired (410), wait / too many tries (429).
const READABLE = new Set([400, 404, 409, 410, 429])

function problemFrom(error, t, td, fallbackKey) {
  const response = error?.response
  if (!response || response.status >= 500) return t(fallbackKey)
  const detail = response.data?.detail
  // The route itself is missing: an older server.
  if ((response.status === 404 && detail === 'Not Found') || response.status === 405) return t('mobile.email.unavailable')
  if (response.status === 422) return t('emailVerify.invalid')
  if (READABLE.has(response.status) && typeof detail === 'string' && detail.trim()) return td(detail)
  return t(fallbackKey)
}

const BADGES = {
  verified: { key: 'emailVerify.status.verified', bg: '#ecfdf5', border: '#a7f3d0', fg: '#047857' },
  sent: { key: 'emailVerify.status.sent', bg: '#fffbeb', border: '#fde68a', fg: '#b45309' },
  notVerified: { key: 'emailVerify.status.notVerified', bg: '#fff1f2', border: '#fecdd3', fg: '#be123c' },
  none: { key: 'emailVerify.status.none', bg: '#f8fafc', border: '#e2e8f0', fg: '#475569' },
}

export default function EmailSection({ style }) {
  const { t, td } = useLanguage()
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const savedEmail = user?.email || ''
  // Older servers do not report email_verified; an address they hold was
  // checked at sign-up, so it counts as verified there.
  const verified = Boolean(savedEmail && (user?.email_verified ?? true))

  const [email, setEmail] = useState(savedEmail)
  const [stage, setStage] = useState('enter')
  const [code, setCode] = useState(emptyCode)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [notice, setNotice] = useState('')
  const [secondsLeft, setSecondsLeft] = useCountdown()
  const gate = useRequestGate()

  useEffect(() => { setEmail(savedEmail) }, [savedEmail])

  const typed = email.trim().toLowerCase()
  const emailUsable = EMAIL_PATTERN.test(typed)
  // A verified address needs nothing until a different one is typed.
  const nothingToVerify = verified && typed === savedEmail.toLowerCase()
  const status = stage === 'code' ? 'sent' : verified ? 'verified' : savedEmail ? 'notVerified' : 'none'
  const badge = BADGES[status]

  async function requestCode() {
    if (busy) return
    if (!emailUsable) { setProblem(t('emailVerify.invalid')); return }
    if (!gate.enter()) return
    setBusy(true)
    setProblem('')
    setNotice('')
    try {
      const result = await sendProfileEmailCode(typed)
      setCode(emptyCode())
      setSecondsLeft(result?.resend_after_seconds || 60)
      setStage('code')
    } catch (error) {
      setProblem(problemFrom(error, t, td, 'emailVerify.sendFailed'))
    } finally {
      gate.leave()
      setBusy(false)
    }
  }

  async function submitCode(next = code) {
    if (busy || !codeComplete(next)) return
    setBusy(true)
    setProblem('')
    try {
      const result = await verifyProfileEmailCode(typed, next)
      dispatch(mergeUser(result?.user || { email: typed, email_verified: true }))
      setStage('enter')
      setCode(emptyCode())
      setNotice(t('emailVerify.success'))
    } catch (error) {
      setProblem(problemFrom(error, t, td, 'emailVerify.codeFailed'))
      setCode(emptyCode())
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <View style={styles.icon}><Mail size={16} color="#1a5038" /></View>
        <Text style={styles.title}>{t('emailVerify.title')}</Text>
        <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>{t(badge.key)}</Text>
        </View>
      </View>
      {!savedEmail ? <Text style={styles.sub}>{t('emailVerify.subtitle')}</Text> : null}

      <Text style={styles.label}>{t('emailVerify.label')}</Text>
      <TextInput
        value={email}
        onChangeText={(value) => {
          setEmail(value)
          setProblem('')
          setNotice('')
          if (stage === 'code') { setStage('enter'); setCode(emptyCode()) }
        }}
        placeholder={t('emailVerify.placeholder')}
        placeholderTextColor="#94a3b8"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        editable={!busy}
        style={[styles.input, problem && stage === 'enter' ? styles.inputError : null]}
      />

      {stage === 'enter' && !nothingToVerify ? (
        <OutlineButton
          label={busy ? t('emailVerify.sending') : t('emailVerify.send')}
          onPress={requestCode}
          disabled={!emailUsable}
          busy={busy}
        />
      ) : null}

      {stage === 'code' ? (
        <>
          <Text style={styles.sub}>{t('emailVerify.sentTo', { email: typed })}</Text>
          <OtpBoxes
            code={code}
            onChange={(next) => {
              setCode(next)
              setProblem('')
              if (codeComplete(next)) submitCode(next)
            }}
            invalid={Boolean(problem)}
            disabled={busy}
            label={t('emailVerify.codeLabel')}
          />
          <CodeActions onBack={() => { setStage('enter'); setProblem('') }} secondsLeft={secondsLeft} onResend={requestCode} sending={busy}>
            <View style={{ flex: 1 }}>
              <OutlineButton
                label={busy ? t('emailVerify.checking') : t('emailVerify.verify')}
                onPress={() => submitCode()}
                disabled={!codeComplete(code)}
                busy={busy}
              />
            </View>
          </CodeActions>
        </>
      ) : null}

      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {problem ? <Notice>{problem}</Notice> : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.brandSoft },
  title: { flex: 1, fontSize: 14.5, fontFamily: 'Inter_700Bold', color: c.text },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', color: c.textMuted },
  label: { marginBottom: -4, fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  input: {
    borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: 'Inter_400Regular', color: c.text,
  },
  inputError: { borderColor: '#dc2626' },
}))
