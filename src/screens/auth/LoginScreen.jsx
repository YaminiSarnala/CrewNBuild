// Port of the web src/pages/auth/LoginPage.jsx.
// Same dark auth shell (index.css .auth-shell used #0d0b14), same background
// artwork, same OAuth buttons, same translated error handling.
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Alert } from 'react-native'
import { Image } from 'expo-image'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowRight } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Field, ErrorBanner } from '../../components/Field'
import { PrimaryButton } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { loginWithCredentials, clearAuthError, setAuthenticatedUser } from '../../store/authSlice'
import { startGoogleOAuth, startMicrosoftOAuth } from '../../api/oauth'
import { createStyles } from '../../theme/createStyles'

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
    <View style={[styles.view, { backgroundColor: '#0d0b14' }]}>
      <Image
        source={require('../../../assets/auth-architecture-bg.png')}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }}
        contentFit="cover"
      />

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.view2}>
            <Image
              source={require('../../../assets/logo.png')}
              style={{ width: 44, height: 49 }}
              contentFit="contain"
            />
            <Text style={[styles.text, { fontSize: 30, letterSpacing: -1 }]}>
              {t('shared.buildTitle')}
            </Text>
            <Text style={[styles.text2, { fontSize: 30, letterSpacing: -1 }]}>
              {t('shared.buildSubtitle')}
            </Text>
            <Text style={[styles.text3, { fontSize: 14, lineHeight: 21 }]}>
              {t('shared.platform')}
            </Text>
          </View>

          <View style={[styles.view3, { maxWidth: 520, marginHorizontal: 20 }]}>
            <ErrorBanner message={translateMessage(errorMessage)} />

            <Text style={[styles.text4, { fontSize: 20, letterSpacing: -0.5 }]}>
              {t('login.welcome')}
            </Text>
            <Text style={[styles.text5, { fontSize: 13, lineHeight: 19 }]}>
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

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.pressable}>
              <Text style={[styles.text6, { fontSize: 13 }]}>
                Forgot password?
              </Text>
            </Pressable>
            {SHOW_OAUTH ? (
              <>
                <View style={[styles.view4, { gap: 12 }]}>
                  <View style={styles.view5} />
                  <Text style={[styles.text7, { fontSize: 12 }]}>
                    {t('shared.orContinue')}
                  </Text>
                  <View style={styles.view5} />
                </View>

                <View style={{ gap: 10 }}>
                  <Pressable
                    onPress={() => runOAuth(startGoogleOAuth)}
                    disabled={oauthBusy}
                    accessibilityRole="button"
                    style={styles.pressable2}
                  >
                    <Text style={[styles.text8, { fontSize: 14 }]}>
                      Google
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => runOAuth(startMicrosoftOAuth)}
                    disabled={oauthBusy}
                    accessibilityRole="button"
                    style={styles.pressable2}
                  >
                    <Text style={[styles.text8, { fontSize: 14 }]}>
                      Microsoft
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            <Pressable onPress={() => navigation.navigate('Signup')} style={styles.pressable3}>
              <Text style={[styles.text6, { fontSize: 13.5 }]}>
                {t('login.new')} {t('site.nav.signup')}
              </Text>
            </Pressable>

            <Text style={[styles.text9, { fontSize: 11.5, lineHeight: 17 }]}>
              {t('shared.security')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1 },
  view2: { paddingHorizontal: 21, paddingTop: 35 },
  text: { marginTop: 17.5, fontFamily: 'Manrope_800ExtraBold', color: '#ffffff' },
  text2: { fontFamily: 'Manrope_800ExtraBold', color: '#6ba88a' },
  text3: { marginTop: 10.5, fontFamily: 'Inter_400Regular', color: '#cbd5e1' },
  view3: { marginTop: 28, alignSelf: 'center', width: '100%', borderRadius: 21, backgroundColor: c.card, padding: 21 },
  text4: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  text5: { marginBottom: 17.5, marginTop: 5.25, fontFamily: 'Inter_400Regular', color: c.textMuted },
  pressable: { marginTop: 10.5, alignItems: 'center' },
  text6: { fontFamily: 'Inter_600SemiBold', color: c.brandText },
  view4: { marginVertical: 17.5, flexDirection: 'row', alignItems: 'center' },
  view5: { height: 0.88, flex: 1, backgroundColor: c.mutedStrong },
  text7: { fontFamily: 'Inter_400Regular', color: c.textFaint },
  pressable2: { alignItems: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingVertical: 12.25 },
  text8: { fontFamily: 'Inter_700Bold', color: c.text },
  pressable3: { marginTop: 21, alignItems: 'center' },
  text9: { marginTop: 17.5, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textFaint },
}))
