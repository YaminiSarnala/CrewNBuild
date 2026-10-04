// Port of the web password-recovery flow: request code → verify 6-digit
// code → set new password, using the existing api/passwordReset.js.
import { useState } from 'react'
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { sendResetCode, verifyResetCode, resetPassword } from '../../api/passwordReset'
import { COLORS } from '../../theme/tokens'

function Input(props) {
  return (
    <TextInput
      {...props}
      className="mt-2 h-12 rounded-xl border border-slate-200 bg-white px-3 text-[15px] font-semibold text-graphite"
      placeholderTextColor={COLORS.slate[400]}
    />
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
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function run(action, nextStep, successMessage) {
    setBusy(true)
    setError('')
    try {
      await action()
      setStep(nextStep)
      setMessage(successMessage)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const submitEmail = () => run(() => sendResetCode(email.trim()), 'code',
    'If that address has an account, a 6-digit code is on its way.')
  const submitCode = () => run(() => verifyResetCode(email.trim(), code.trim()), 'password',
    'Code verified. Choose a new password.')
  const submitPassword = () => {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    run(() => resetPassword(email.trim(), password), 'done', 'Password updated. You can sign in now.')
  }

  const canContinue =
    step === 'email' ? email.trim().includes('@')
    : step === 'code' ? code.trim().length >= 4
    : step === 'password' ? Boolean(password && confirm)
    : true

  return (
    <View className="flex-1 bg-brand-800" style={{ paddingTop: insets.top }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => navigation.goBack()} className="mb-4 flex-row items-center gap-1 self-start">
            <ChevronLeft size={18} color={COLORS.brand[200]} />
            <Text className="text-sm font-extrabold text-brand-200">Back to sign in</Text>
          </Pressable>

          <View className="w-full self-center rounded-3xl bg-white p-6" style={{ maxWidth: 520 }}>
            <Text className="text-xl font-extrabold text-graphite">Reset your password</Text>
            {!!message && !error && (
              <View className="mt-3 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2">
                <Text className="text-[13px] font-semibold text-brand-800">{message}</Text>
              </View>
            )}
            {!!error && (
              <View className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                <Text className="text-[13px] font-semibold text-rose-700">{error}</Text>
              </View>
            )}

            {step === 'email' && (
              <>
                <Text className="mt-2 text-[13px] font-semibold text-slate-500">Enter the email you signed up with and we'll send a verification code.</Text>
                <Input value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoFocus />
              </>
            )}
            {step === 'code' && (
              <>
                <Text className="mt-2 text-[13px] font-semibold text-slate-500">Enter the 6-digit code sent to {email.trim()}.</Text>
                <Input value={code} onChangeText={setCode} placeholder="6-digit code" keyboardType="number-pad" maxLength={6} autoFocus style={{ letterSpacing: 8, textAlign: 'center', fontWeight: '800' }} />
                <Pressable onPress={submitEmail} disabled={busy} className="mt-2 self-center">
                  <Text className="text-xs font-extrabold text-brand-700">Resend code</Text>
                </Pressable>
              </>
            )}
            {step === 'password' && (
              <>
                <Input value={password} onChangeText={setPassword} placeholder="New password (min 8 characters)" secureTextEntry autoCapitalize="none" autoFocus />
                <Input value={confirm} onChangeText={setConfirm} placeholder="Confirm new password" secureTextEntry autoCapitalize="none" />
              </>
            )}

            {step !== 'done' ? (
              <Pressable
                onPress={step === 'email' ? submitEmail : step === 'code' ? submitCode : submitPassword}
                disabled={busy || !canContinue}
                className={`mt-4 h-12 items-center justify-center rounded-full bg-brand-700 ${busy || !canContinue ? 'opacity-50' : ''}`}
              >
                <Text className="text-[14px] font-extrabold text-white">
                  {busy ? 'Please wait…' : step === 'email' ? 'Send code' : step === 'code' ? 'Verify code' : 'Set new password'}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => navigation.navigate('Login')} className="mt-4 h-12 items-center justify-center rounded-full bg-brand-700">
                <Text className="text-[14px] font-extrabold text-white">Go to sign in</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}