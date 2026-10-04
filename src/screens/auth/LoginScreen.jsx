// Port of the web src/pages/auth/LoginPage.jsx.
// Same dark auth shell (index.css .auth-shell used #0d0b14), same background
// artwork, same OAuth buttons, same translated error handling.
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { Image } from 'expo-image'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeft, ArrowRight } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Field, ErrorBanner } from '../../components/Field'
import { PrimaryButton } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { loginWithCredentials, clearAuthError, setAuthenticatedUser } from '../../store/authSlice'
import { startGoogleOAuth, startMicrosoftOAuth } from '../../api/oauth'

// ---------------------------------------------------------------------------
// Google / Microsoft sign-in is OFF by default.
//
// Your FastAPI callback redirects to FRONTEND_ORIGIN (http://localhost:5173),
// which a phone cannot open. Making OAuth work needs a backend change, and you
// asked for the backend to stay untouched — so the buttons are hidden rather
// than shipped in a state where tapping them does nothing.
//
// Email + password login works fully and needs no backend change at all.
//
// If you later decide to change the backend: make the callback accept a
// redirect_uri parameter and send the user to octabuild://oauth?access_token=...
// then flip this to true. src/api/oauth.js is already written for that flow.
// ---------------------------------------------------------------------------
const SHOW_OAUTH = false

export default function LoginScreen({ navigation }) {
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const { t, translateMessage } = useLanguage()
  const { status, errorMessage } = useSelector((state) => state.auth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [oauthBusy, setOauthBusy] = useState(false)

  const loading = status === 'loading'

  async function submit() {
    if (!email.trim() || !password) return
    dispatch(loginWithCredentials({ email, password }))
    // Navigation is handled by RootNavigator reacting to auth state.
  }

  async function runOAuth(starter) {
    try {
      setOauthBusy(true)
      const result = await starter('OWNER')
      if (result?.accessToken) {
        dispatch(setAuthenticatedUser(result))
      }
    } catch (error) {
      Alert.alert('Sign-in failed', String(error?.message || error))
    } finally {
      setOauthBusy(false)
    }
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#0d0b14' }}>
      <Image
        source={require('../../../assets/auth-architecture-bg.png')}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }}
        contentFit="cover"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => navigation.navigate('Landing')}
            accessibilityRole="button"
            className="ml-4 mt-2 flex-row items-center self-start rounded-full bg-white/10 px-3.5 py-2"
            style={{ gap: 6 }}
          >
            <ArrowLeft size={15} color="#ffffff" />
            <Text className="font-sansSemi text-white" style={{ fontSize: 12.5 }}>
              {t('shared.backHome')}
            </Text>
          </Pressable>

          <View className="px-6 pt-10">
            <Image
              source={require('../../../assets/logo.png')}
              style={{ width: 44, height: 49 }}
              contentFit="contain"
            />
            <Text className="mt-5 font-display text-white" style={{ fontSize: 30, letterSpacing: -1 }}>
              {t('shared.buildTitle')}
            </Text>
            <Text className="font-display text-brand-400" style={{ fontSize: 30, letterSpacing: -1 }}>
              {t('shared.buildSubtitle')}
            </Text>
            <Text className="mt-3 font-sans text-slate-300" style={{ fontSize: 14, lineHeight: 21 }}>
              {t('shared.platform')}
            </Text>
          </View>

          <View className="mt-8 self-center w-full rounded-3xl bg-white p-6" style={{ maxWidth: 520, marginHorizontal: 20 }}>
            <ErrorBanner message={translateMessage(errorMessage)} />

            <Text className="font-display text-graphite" style={{ fontSize: 20, letterSpacing: -0.5 }}>
              {t('login.welcome')}
            </Text>
            <Text className="mb-5 mt-1.5 font-sans text-slate-500" style={{ fontSize: 13, lineHeight: 19 }}>
              {t('login.intro')}
            </Text>

            <Field
              label={t('login.email')}
              value={email}
              onChangeText={(value) => {
                if (errorMessage) dispatch(clearAuthError())
                setEmail(value)
              }}
              placeholder={t('login.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              textContentType="emailAddress"
            />
            <Field
              label={t('login.password')}
              value={password}
              onChangeText={setPassword}
              placeholder={t('login.passwordPlaceholder')}
              secure
              autoCapitalize="none"
              textContentType="password"
              onSubmitEditing={submit}
              returnKeyType="go"
            />

            <PrimaryButton
              label={loading ? t('login.loading') : t('login.submit')}
              onPress={submit}
              loading={loading}
              disabled={!email.trim() || !password}
              icon={<ArrowRight size={16} color="#ffffff" />}
              full
            />

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} className="mt-3 items-center">
              <Text className="font-sansSemi text-brand-700" style={{ fontSize: 13 }}>
                Forgot password?
              </Text>
            </Pressable>
            {SHOW_OAUTH ? (
              <>
                <View className="my-5 flex-row items-center" style={{ gap: 12 }}>
                  <View className="h-px flex-1 bg-slate-200" />
                  <Text className="font-sans text-slate-400" style={{ fontSize: 12 }}>
                    {t('shared.orContinue')}
                  </Text>
                  <View className="h-px flex-1 bg-slate-200" />
                </View>

                <View style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => runOAuth(startGoogleOAuth)}
                    disabled={oauthBusy}
                    accessibilityRole="button"
                    className="items-center rounded-full border border-slate-200 bg-white py-3.5 active:bg-slate-50"
                  >
                    <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }}>
                      Google
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => runOAuth(startMicrosoftOAuth)}
                    disabled={oauthBusy}
                    accessibilityRole="button"
                    className="items-center rounded-full border border-slate-200 bg-white py-3.5 active:bg-slate-50"
                  >
                    <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }}>
                      Microsoft
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            <Pressable onPress={() => navigation.navigate('Signup')} className="mt-6 items-center">
              <Text className="font-sansSemi text-brand-700" style={{ fontSize: 13.5 }}>
                {t('login.new')} {t('site.nav.signup')}
              </Text>
            </Pressable>

            <Text className="mt-5 text-center font-sans text-slate-400" style={{ fontSize: 11.5, lineHeight: 17 }}>
              {t('shared.security')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
