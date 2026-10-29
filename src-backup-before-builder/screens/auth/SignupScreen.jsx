import { useState } from 'react'
import { Image } from 'expo-image'
import {
  View,
  Text,
  Alert,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'

import { sendEmailCode, verifyEmailCode } from '../../api/emailVerification'
import { useDispatch, useSelector } from 'react-redux'
import {
  ArrowRight,
  House as Home,
  HardHat,
  Package,
  Ruler,
} from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Field, ErrorBanner, RoleCard } from '../../components/Field'
import { PrimaryButton } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { signupWithProfile, clearAuthError } from '../../store/authSlice'

const ROLES = [
  { value: 'OWNER', labelKey: 'role.owner', descKey: 'role.ownerDesc', Icon: Home },
  { value: 'CONTRACTOR', labelKey: 'role.contractor', descKey: 'role.contractorDesc', Icon: HardHat },
  { value: 'SUPPLIER', labelKey: 'role.supplier', descKey: 'role.supplierDesc', Icon: Package },
  { value: 'ENGINEER', labelKey: 'role.engineer', descKey: 'role.engineerDesc', Icon: Ruler },
]

export default function SignupScreen({ navigation }) {
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const { t, translateMessage } = useLanguage()
  const { status, errorMessage } = useSelector((state) => state.auth)

  const [form, setForm] = useState({
    role: 'OWNER',
    name: '',
    email: '',
    password: '',
  })
  const [verificationStep, setVerificationStep] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationLoading, setVerificationLoading] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const loading = status === 'loading'

  const set = (key) => (value) => {
    if (errorMessage) dispatch(clearAuthError())
    setForm((previous) => ({ ...previous, [key]: value }))
  }

  const strongPassword =
    form.password.length >= 10 &&
    /[a-z]/.test(form.password) &&
    /[A-Z]/.test(form.password) &&
    /\d/.test(form.password) &&
    /[^A-Za-z0-9\s]/.test(form.password)

  async function requestEmailCode() {
    const email = form.email.trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.')
      return
    }

    if (!strongPassword) {
      Alert.alert(
        'Weak password',
        'Use at least 10 characters, including uppercase, lowercase, a number, and a symbol.',
      )
      return
    }

    setVerificationLoading(true)

    try {
      await sendEmailCode(email)
      setVerificationCode('')
      setVerificationStep(true)
      Alert.alert('Code sent', 'Check your email for the six-digit code.')
    } catch (error) {
      const detail = error.response?.data?.detail
      Alert.alert(
        'Unable to send code',
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail[0]?.msg || 'Please try again.'
            : error.message,
      )
    } finally {
      setVerificationLoading(false)
    }
  }

  async function confirmEmailCode() {
    if (!/^\d{6}$/.test(verificationCode)) {
      Alert.alert('Invalid code', 'Enter the six-digit code.')
      return
    }

    setVerificationLoading(true)

    try {
      const result = await verifyEmailCode(
        form.email.trim().toLowerCase(),
        verificationCode,
      )

      if (result?.verified !== true) {
        Alert.alert('Verification failed', 'Please check your code and try again.')
        return
      }

      setEmailVerified(true)
      setVerificationStep(false)
      Alert.alert('Email verified', 'Accept the terms to create your account.')
    } catch (error) {
      const detail = error.response?.data?.detail
      Alert.alert(
        'Verification failed',
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail[0]?.msg || 'Please check your code and try again.'
            : error.message,
      )
    } finally {
      setVerificationLoading(false)
    }
  }

  function submit() {
    if (form.name.trim().length < 2) {
      Alert.alert('Name required', 'Enter your full name.')
      return
    }

    if (!strongPassword) {
      Alert.alert(
        'Weak password',
        'Use at least 10 characters, including uppercase, lowercase, a number, and a symbol.',
      )
      return
    }

    if (!emailVerified) {
      Alert.alert('Verify email', 'Please verify your email before creating your account.')
      return
    }

    if (!acceptedTerms) {
      Alert.alert(
        'Terms required',
        'Please accept the Terms of Service and Privacy Policy.',
      )
      return
    }

    const name = form.name.trim()
    const roleDefaults = {
      OWNER: {
        building_type: 'RESIDENTIAL',
        construction_type: 'CONTRACTOR',
        budget: 0,
        land_area: 0,
        floors: 1,
      },
      CONTRACTOR: {
        company_name: name,
        license_number: '',
        experience_years: 0,
      },
      SUPPLIER: {
        store_name: name,
        categories: '',
      },
      ENGINEER: {
        qualification: '',
        specialization: '',
        experience_years: 0,
        license_number: '',
        about: '',
      },
    }

    dispatch(
      signupWithProfile({
        name,
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        ...roleDefaults[form.role],
      }),
    )
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#0d0b14' }}>
      <Image
        source={require('../../../assets/auth-architecture-bg.png')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.35,
        }}
        contentFit="cover"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-6 pt-8">
            <Text
              className="font-display text-white"
              style={{ fontSize: 26, letterSpacing: -0.9 }}
            >
              {t('shared.tagline')}
            </Text>
            <Text
              className="mt-2 font-sans text-slate-300"
              style={{ fontSize: 13.5, lineHeight: 20 }}
            >
              {t('shared.joinPlatform')}
            </Text>
          </View>

          <View
            className="mt-7 self-center w-full rounded-3xl bg-white p-6"
            style={{ maxWidth: 560, marginHorizontal: 20 }}
          >
            <ErrorBanner message={translateMessage(errorMessage)} />

            <Text className="mb-3 font-sansSemi text-slate-600" style={{ fontSize: 13 }}>
              I am a…
            </Text>

            {ROLES.map(({ value, labelKey, descKey, Icon }) => (
              <RoleCard
                key={value}
                label={t(labelKey)}
                description={t(descKey)}
                selected={form.role === value}
                onPress={() => set('role')(value)}
                icon={
                  <Icon
                    size={18}
                    color={form.role === value ? '#ffffff' : '#64748b'}
                  />
                }
              />
            ))}

            <View className="mt-4">
              <Field
                label="Full name"
                value={form.name}
                onChangeText={set('name')}
                placeholder="Your name"
              />

              <Field
                label="Email"
                value={form.email}
                onChangeText={(value) => {
                  set('email')(value)
                  setEmailVerified(false)
                  setVerificationStep(false)
                  setVerificationCode('')
                  setAcceptedTerms(false)
                }}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Field
                label="Password"
                value={form.password}
                onChangeText={(value) => {
                  set('password')(value)
                  setEmailVerified(false)
                  setVerificationStep(false)
                  setVerificationCode('')
                  setAcceptedTerms(false)
                }}
                placeholder="10+ chars, upper, lower, number, symbol"
                secure
                autoCapitalize="none"
              />

              <Text className="mb-3 -mt-2 font-sans text-slate-500" style={{ fontSize: 11 }}>
                Use at least 10 characters with uppercase, lowercase, a number, and a symbol.
              </Text>

              {!emailVerified && (
                <View className="mb-4">
                  {!verificationStep ? (
                    <PrimaryButton
                      label="Send verification code"
                      onPress={requestEmailCode}
                      loading={verificationLoading}
                      disabled={!form.email.trim() || !strongPassword || verificationLoading}
                      full
                    />
                  ) : (
                    <>
                      <Text className="mb-2 font-sansSemi text-slate-700">
                        Enter the six-digit code sent to your email
                      </Text>

                      <Field
                        label="Verification code"
                        value={verificationCode}
                        onChangeText={(value) =>
                          setVerificationCode(value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="000000"
                        keyboardType="number-pad"
                        maxLength={6}
                      />

                      <PrimaryButton
                        label="Verify email"
                        onPress={confirmEmailCode}
                        loading={verificationLoading}
                        disabled={verificationCode.length !== 6 || verificationLoading}
                        full
                      />

                      <Pressable
                        onPress={requestEmailCode}
                        disabled={verificationLoading}
                        className="mt-3 items-center"
                      >
                        <Text className="font-sansSemi text-brand-700">
                          Resend verification code
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}

              {emailVerified && (
                <>
                  <Text className="mb-3 font-sansSemi text-green-700">
                    ✓ Email verified
                  </Text>

                  <Pressable
                    onPress={() => setAcceptedTerms((previous) => !previous)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: acceptedTerms }}
                    className="mb-4 flex-row items-start"
                    style={{ gap: 10 }}
                  >
                    <View
                      className="mt-0.5 h-5 w-5 items-center justify-center rounded border"
                      style={{
                        borderColor: acceptedTerms ? '#15803d' : '#94a3b8',
                        backgroundColor: acceptedTerms ? '#15803d' : '#ffffff',
                      }}
                    >
                      {acceptedTerms ? (
                        <Text className="font-sansSemi text-white">✓</Text>
                      ) : null}
                    </View>

                    <Text className="flex-1 font-sans text-slate-600" style={{ fontSize: 12, lineHeight: 18 }}>
                      I agree to the Terms of Service and Privacy Policy.
                    </Text>
                  </Pressable>
                </>
              )}
            </View>

            {emailVerified && (
              <PrimaryButton
                label={t('site.nav.signup')}
                onPress={submit}
                loading={loading}
                disabled={
                  form.name.trim().length < 2 ||
                  !strongPassword ||
                  !acceptedTerms ||
                  loading
                }
                icon={<ArrowRight size={16} color="#ffffff" />}
                full
              />
            )}

            <Pressable
              onPress={() => navigation.navigate('Login')}
              className="mt-5 items-center"
            >
              <Text className="font-sansSemi text-brand-700" style={{ fontSize: 13.5 }}>
                {t('site.nav.login')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
