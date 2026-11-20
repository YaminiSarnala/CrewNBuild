// Port of the web password-recovery flow: request code → verify 6-digit
// code → set new password, using the existing api/passwordReset.js.
import { useState } from 'react'
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { sendResetCode, verifyResetCode, resetPassword } from '../../api/passwordReset'
import { COLORS } from '../../theme/tokens'
import { toast } from '../../components/Toast'
import { createStyles } from '../../theme/createStyles'

function Input({ error, ...props }) {
  return (
    <>
      <TextInput
        {...props}
        style={[styles.textInput, error ? styles.textInputInvalid : null]}
        placeholderTextColor={COLORS.slate[400]}
      />
      {error ? <Text accessibilityRole="alert" style={styles.fieldError}>{error}</Text> : null}
    </>
  )
}

export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState('email') // email -> code -> password -> done
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  // Each field's problem, shown under (and highlighting) that field.
  const [errors, setErrors] = useState({})
  const clearError = (field) => setErrors((current) => (current[field] ? { ...current, [field]: '' } : current))

  // `field` is the input the step's answer is about: a refusal highlights it.
  async function run(action, nextStep, successMessage, field) {
    setBusy(true)
    setErrors({})
    try {
      await action()
      setStep(nextStep)
      toast.success(successMessage)
    } catch (err) {
      const detail = err?.response?.data?.detail
      const text = (typeof detail === 'string' && detail) || 'Something went wrong. Please try again.'
      setErrors(field ? { [field]: text } : {})
      toast.error(text)
    } finally {
      setBusy(false)
    }
  }

  const submitEmail = () => run(() => sendResetCode(email.trim()), 'code',
    'If that address has an account, a 6-digit code is on its way.', step === 'email' ? 'email' : null)
  const submitCode = () => run(() => verifyResetCode(email.trim(), code.trim()), 'password',
    'Code verified. Choose a new password.', 'code')
  const submitPassword = () => {
    const nextErrors = {}
    if (password.length < 8) nextErrors.password = 'Password must be at least 8 characters.'
    if (password !== confirm) nextErrors.confirm = 'Passwords do not match.'
    const failing = Object.values(nextErrors)
    if (failing.length) {
      setErrors(nextErrors)
      toast.error(failing.length === 1 ? failing[0] : 'Please fix the highlighted fields.')
      return
    }
    run(() => resetPassword(email.trim(), password), 'done', 'Password updated. You can sign in now.', 'password')
  }

  const canContinue =
    step === 'email' ? email.trim().includes('@')
    : step === 'code' ? code.trim().length >= 4
    : step === 'password' ? Boolean(password && confirm)
    : true

  return (
    <View style={[styles.view, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.keyboardAvoidingView}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => navigation.goBack()} style={styles.pressable}>
            <ChevronLeft size={18} color={COLORS.brand[200]} />
            <Text style={styles.text}>Back to sign in</Text>
          </Pressable>

          <View style={[styles.view2, { maxWidth: 520 }]}>
            <Text style={styles.text2}>Reset your password</Text>
            {step === 'done' && <Text style={styles.text5}>Password updated. You can sign in now.</Text>}

            {step === 'email' && (
              <>
                <Text style={styles.text5}>Enter the email you signed up with and we'll send a verification code.</Text>
                <Input value={email} onChangeText={(value) => { setEmail(value); clearError('email') }} error={errors.email} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoFocus />
              </>
            )}
            {step === 'code' && (
              <>
                <Text style={styles.text5}>Enter the 6-digit code sent to {email.trim()}.</Text>
                <Input value={code} onChangeText={(value) => { setCode(value); clearError('code') }} error={errors.code} placeholder="6-digit code" keyboardType="number-pad" maxLength={6} autoFocus style={{ letterSpacing: 8, textAlign: 'center', fontWeight: '800' }} />
                <Pressable onPress={submitEmail} disabled={busy} style={styles.pressable2}>
                  <Text style={styles.text6}>Resend code</Text>
                </Pressable>
              </>
            )}
            {step === 'password' && (
              <>
                <Input value={password} onChangeText={(value) => { setPassword(value); clearError('password') }} error={errors.password} placeholder="New password (min 8 characters)" secureTextEntry autoCapitalize="none" autoFocus />
                <Input value={confirm} onChangeText={(value) => { setConfirm(value); clearError('confirm') }} error={errors.confirm} placeholder="Confirm new password" secureTextEntry autoCapitalize="none" />
              </>
            )}

            {step !== 'done' ? (
              <Pressable
                onPress={step === 'email' ? submitEmail : step === 'code' ? submitCode : submitPassword}
                disabled={busy || !canContinue}
                style={[styles.pressable3, busy || !canContinue ? styles.pressable4 : null]}
              >
                <Text style={styles.text7}>
                  {busy ? 'Please wait…' : step === 'email' ? 'Send code' : step === 'code' ? 'Verify code' : 'Set new password'}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => navigation.navigate('Login')} style={styles.pressable3}>
                <Text style={styles.text7}>Go to sign in</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = createStyles((c) => ({
  textInput: { marginTop: 7, height: 42, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 15, fontWeight: '600', color: c.text },
  view: { flex: 1, backgroundColor: '#134127' },
  keyboardAvoidingView: { flex: 1 },
  pressable: { marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 3.5, alignSelf: 'flex-start' },
  text: { fontSize: 12.25, lineHeight: 17.5, fontWeight: '800', color: '#c3dccd' },
  view2: { width: '100%', alignSelf: 'center', borderRadius: 21, backgroundColor: c.card, padding: 21 },
  text2: { fontSize: 17.5, lineHeight: 24.5, fontWeight: '800', color: c.text },
  textInputInvalid: { borderColor: '#dc2626' },
  fieldError: { marginTop: 4, fontSize: 11.5, fontWeight: '600', color: '#dc2626' },
  text5: { marginTop: 7, fontSize: 13, fontWeight: '600', color: c.textMuted },
  pressable2: { marginTop: 7, alignSelf: 'center' },
  text6: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: c.brandText },
  pressable3: { marginTop: 14, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#1a5038' },
  pressable4: { opacity: 0.5 },
  text7: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
}))
