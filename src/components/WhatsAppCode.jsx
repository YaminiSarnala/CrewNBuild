// The WhatsApp code pieces shared by Login and Sign-up — the mobile port of the
// web's pages/auth/PhoneVerification.jsx, OtpInput.jsx, DevOtpNotice.jsx and
// requestGate.js.
//
// The server decides whether the check is on (/auth/phone/config). An older
// server without the route, or one where it is off, keeps e-mail and password,
// exactly as the web does.
import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { ArrowLeft, ShieldCheck } from 'lucide-react-native'
import { useLanguage } from '../i18n/LanguageContext'
import { readPhoneVerificationConfig, sendPhoneCode, verifyPhoneCode } from '../api/phoneVerification'
import { createStyles } from '../theme/createStyles'

export const INDIA_MOBILE = /^[6-9]\d{9}$/
export const OTP_LENGTH = 6
export const emptyCode = () => Array(OTP_LENGTH).fill('')
export const codeComplete = (code) => code.every((digit) => digit !== '')

const BRAND = '#1a5038'

// { ready, signup, login }: both false until (and unless) the server says so.
export function usePhoneConfig() {
  const [config, setConfig] = useState({ ready: false, signup: false, login: false })
  useEffect(() => {
    let active = true
    readPhoneVerificationConfig()
      .then((data) => { if (active) setConfig({ ready: true, signup: data?.enabled === true, login: data?.login === true }) })
      .catch(() => { if (active) setConfig({ ready: true, signup: false, login: false }) })
    return () => { active = false }
  }, [])
  return config
}

// One code request at a time: a state flag is only seen after the next render,
// so two quick taps could both pass it. Every message is billed and counted
// against the number's hourly limit.
export function useRequestGate() {
  return useRef({
    busy: false,
    enter() { if (this.busy) return false; this.busy = true; return true },
    leave() { this.busy = false },
  }).current
}

// Seconds until another code may be asked for.
export function useCountdown() {
  const [secondsLeft, setSecondsLeft] = useState(0)
  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const timer = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])
  return [secondsLeft, setSecondsLeft]
}

const clock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

// The `detail` the phone endpoints write for people to read, else the fallback.
export function readableError(error, fallback, statuses) {
  const response = error?.response
  if (!response || response.status >= 500) return fallback
  const detail = response.data?.detail
  if (response.status === 404 && detail === 'Not Found') return fallback
  return statuses.has(response.status) && typeof detail === 'string' && detail.trim() ? detail : fallback
}

// Development preview reply ({ code }), else null.
export const devPreviewOf = (result) => (result?.dev_preview ? { code: result.dev_otp || '' } : null)

// The 10 digit number with a fixed +91 in front.
export function PhoneNumberField({ label, value, onChangeText, editable = true, error }) {
  const { t } = useLanguage()
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.phoneBox, error ? styles.phoneBoxError : null, !editable && styles.phoneBoxLocked]}>
        <Text style={styles.dial}>+91</Text>
        <View style={styles.dialRule} />
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 10))}
          placeholder={t('signup.phone.placeholder')}
          placeholderTextColor="#94a3b8"
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={10}
          editable={editable}
          style={styles.phoneInput}
        />
      </View>
    </View>
  )
}

// Six boxes over one hidden input, so typing, deleting and the keyboard's
// one-time-code suggestion (iOS) / SMS autofill all just work.
export function OtpBoxes({ code, onChange, invalid, disabled, label, note }) {
  const input = useRef(null)
  const value = code.join('')
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => input.current?.focus(), 250)
    return () => clearTimeout(timer)
  }, [])

  return (
    <View>
      <View style={styles.otpHead}>
        <Text style={styles.label}>{label}</Text>
        {note ? <Text style={styles.otpNote}>{note}</Text> : null}
      </View>
      <Pressable onPress={() => input.current?.focus()} style={styles.otpRow} disabled={disabled}>
        {code.map((digit, index) => {
          const active = focused && index === Math.min(value.length, OTP_LENGTH - 1)
          return (
            <View
              key={index}
              style={[styles.otpBox, active && styles.otpBoxActive, invalid && styles.otpBoxInvalid, disabled && styles.otpBoxDisabled]}
            >
              <Text style={styles.otpDigit}>{digit}</Text>
            </View>
          )
        })}
        <TextInput
          ref={input}
          value={value}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH)
            onChange(Array.from({ length: OTP_LENGTH }, (_, index) => digits[index] || ''))
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={OTP_LENGTH}
          editable={!disabled}
          caretHidden
          style={styles.otpHidden}
        />
      </Pressable>
    </View>
  )
}

// Development-only: shown when the API answered in its preview mode
// (WHATSAPP_DEV_OTP_PREVIEW on a development server) — nothing was sent.
export function DevOtpNotice({ code }) {
  return (
    <View style={styles.devNotice}>
      <Text style={styles.devText}>
        Development mode — WhatsApp not sent.
        {code ? ` Your code: ${code}` : ' The code is only shown on the developer’s own machine.'}
      </Text>
    </View>
  )
}

export function Notice({ tone = 'warning', children }) {
  return (
    <View style={[styles.notice, tone === 'success' ? styles.noticeSuccess : styles.noticeWarning]}>
      {tone === 'success' ? <ShieldCheck size={16} color={BRAND} /> : null}
      <Text style={[styles.noticeText, tone === 'success' ? styles.noticeTextSuccess : styles.noticeTextWarning]}>{children}</Text>
    </View>
  )
}

export function OutlineButton({ label, onPress, disabled, busy }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={({ pressed }) => [styles.outline, (disabled || busy) && styles.dimmed, pressed && styles.outlinePressed]}
    >
      {busy ? <ActivityIndicator size="small" color={BRAND} /> : null}
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
  )
}

// Back to the number, then the countdown or "Resend".
export function CodeActions({ onBack, secondsLeft, onResend, sending, children }) {
  const { t } = useLanguage()
  return (
    <View style={styles.actions}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('signup.phone.change')} hitSlop={6} style={styles.backSquare}>
        <ArrowLeft size={16} color="#64748b" />
      </Pressable>
      {children}
      {secondsLeft > 0 ? (
        <Text style={styles.timer}>{clock(secondsLeft)}</Text>
      ) : (
        <Pressable onPress={onResend} disabled={sending} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.resend}>{sending ? t('signup.flow.sending') : t('signup.flow.resend')}</Text>
        </Pressable>
      )}
    </View>
  )
}

// Sign-up statuses whose `detail` is written for people: invalid number (422),
// number in use (409), wait / too many (429), wrong code (400), expired or
// used (410), no code requested yet (404).
const SIGNUP_READABLE = new Set([400, 404, 409, 410, 422, 429])

/**
 * The sign-up number: enter -> code -> verified. A correct code gives a
 * one-time token that sign-up must present with the same number; editing the
 * number drops it, so only the number that received the code can be submitted.
 */
export function PhoneVerification({ phone, onPhoneChange, onVerifiedChange, label }) {
  const { t, translateMessage } = useLanguage()
  const [stage, setStage] = useState('enter')
  const [code, setCode] = useState(emptyCode)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [devPreview, setDevPreview] = useState(null)
  const [secondsLeft, setSecondsLeft] = useCountdown()
  const gate = useRequestGate()
  const phoneUsable = INDIA_MOBILE.test(phone)

  const changePhone = (digits) => {
    onPhoneChange(digits)
    if (digits !== phone) {
      onVerifiedChange(null)
      setCode(emptyCode())
      setStage('enter')
      setDevPreview(null)
    }
    setProblem('')
  }

  async function requestCode() {
    if (busy) return
    if (!phoneUsable) {
      setProblem(t('signup.phone.invalid'))
      return
    }
    if (!gate.enter()) return
    setBusy(true)
    setProblem('')
    try {
      const result = await sendPhoneCode(phone)
      setCode(emptyCode())
      setDevPreview(devPreviewOf(result))
      setSecondsLeft(result?.resend_after_seconds || 60)
      setStage('code')
    } catch (error) {
      setProblem(readableError(error, t('signup.phone.sendFailed'), SIGNUP_READABLE))
    } finally {
      gate.leave()
      setBusy(false)
    }
  }

  async function submitCode() {
    if (busy || !codeComplete(code)) return
    setBusy(true)
    setProblem('')
    try {
      const result = await verifyPhoneCode(phone, code)
      if (!result?.verification_token) throw new Error('missing token')
      onVerifiedChange(result.verification_token)
      setStage('done')
    } catch (error) {
      setProblem(readableError(error, t('signup.flow.otpInvalid'), SIGNUP_READABLE))
      setCode(emptyCode())
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={styles.stack}>
      <PhoneNumberField label={label || t('signup.phone.label')} value={phone} onChangeText={changePhone} error={Boolean(problem) && stage === 'enter'} />
      {stage === 'enter' ? (
        <OutlineButton
          label={busy ? t('signup.flow.sending') : t('signup.phone.send')}
          onPress={requestCode}
          disabled={!phoneUsable}
          busy={busy}
        />
      ) : null}
      {stage === 'code' ? (
        <>
          <OtpBoxes
            code={code}
            onChange={(next) => { setCode(next); setProblem('') }}
            invalid={Boolean(problem)}
            disabled={busy}
            label={t('signup.phone.otpLabel')}
            note={`+91 ${phone}`}
          />
          {/* Sent, not delivered: the provider accepting a message is all we know. */}
          <Text style={styles.hint}>{t('signup.phone.sent')}</Text>
          {devPreview ? <DevOtpNotice code={devPreview.code} /> : null}
          <CodeActions
            onBack={() => { setStage('enter'); setProblem('') }}
            secondsLeft={secondsLeft}
            onResend={requestCode}
            sending={busy}
          >
            <View style={{ flex: 1 }}>
              <OutlineButton
                label={busy ? t('signup.flow.checking') : t('signup.flow.verifyOtp')}
                onPress={submitCode}
                disabled={!codeComplete(code)}
                busy={busy}
              />
            </View>
          </CodeActions>
        </>
      ) : null}
      {stage === 'done' ? <Notice tone="success">{t('signup.phone.verified')}</Notice> : null}
      {problem ? <Notice>{translateMessage(problem)}</Notice> : null}
    </View>
  )
}

const styles = createStyles((c) => ({
  stack: { gap: 10, marginBottom: 14 },
  field: {},
  label: { marginBottom: 5.25, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  phoneBox: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.card, paddingLeft: 14,
  },
  phoneBoxError: { borderColor: '#dc2626' },
  phoneBoxLocked: { backgroundColor: c.muted },
  dial: { fontSize: 15, fontFamily: 'Inter_700Bold', color: c.text },
  dialRule: { width: 1, height: 22, marginLeft: 12, backgroundColor: c.border },
  phoneInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 15, fontSize: 15, fontFamily: 'Inter_400Regular', color: c.text, letterSpacing: 0.5 },
  otpHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  otpNote: { marginBottom: 5.25, fontSize: 12, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  otpRow: { flexDirection: 'row', gap: 8 },
  otpBox: {
    flex: 1, maxWidth: 52, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 2, borderColor: c.border, backgroundColor: c.card,
  },
  otpBoxActive: { borderColor: BRAND },
  otpBoxInvalid: { borderColor: '#dc2626' },
  otpBoxDisabled: { backgroundColor: c.muted },
  otpDigit: { fontSize: 20, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  // Kept on screen (not display:none) so it can hold focus and receive autofill.
  otpHidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.011, color: 'transparent' },
  hint: { fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
  devNotice: { borderRadius: 12, borderWidth: 1, borderColor: '#fcd34d', backgroundColor: '#fffbeb', paddingHorizontal: 12, paddingVertical: 9 },
  devText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#78350f' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  noticeWarning: { borderColor: 'rgba(220, 38, 38, 0.3)', backgroundColor: 'rgba(220, 38, 38, 0.08)' },
  noticeSuccess: { borderColor: 'rgba(26, 80, 56, 0.35)', backgroundColor: c.brandSoft },
  noticeText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  noticeTextWarning: { fontFamily: 'Inter_600SemiBold', color: '#dc2626' },
  noticeTextSuccess: { fontFamily: 'Inter_700Bold', color: c.brandText },
  outline: {
    minHeight: 46, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, borderWidth: 1.5, borderColor: BRAND, backgroundColor: c.card, paddingHorizontal: 14,
  },
  outlinePressed: { backgroundColor: c.brandSoft },
  outlineText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: c.brandText },
  dimmed: { opacity: 0.45 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backSquare: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.border },
  timer: { fontSize: 12.5, fontFamily: 'Inter_600SemiBold', color: c.textMuted, fontVariant: ['tabular-nums'] },
  resend: { fontSize: 12.5, fontFamily: 'Inter_700Bold', color: c.brandText },
}))
