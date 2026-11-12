// Port of the web src/pages/auth/SignupPage.jsx.
// Roles and the payload shape match app/services/auth_service.py exactly:
// role must be one of OWNER / CONTRACTOR / SUPPLIER / ENGINEER, and the
// backend requires name, email, phone, password, address, pincode.
//
// Where the server turns the WhatsApp check on (/auth/phone/config `enabled`),
// sign-up is phone-first like the web: name, role, the +91 number verified with
// a WhatsApp code, and the terms. No e-mail and no password: the account signs
// in later with a WhatsApp code to the same number. The reply carries the
// session, so the new account is signed in at once.
import { useRef, useState } from 'react'
import { useComingSoon, SoonTag } from '../../components/ComingSoon'
import { isSignupRoleOpen } from '../../config/modules'
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, ActivityIndicator } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowRight, Check } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Field, ErrorBanner, RoleCard } from '../../components/Field'
import { PrimaryButton } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { signupWithProfile, clearAuthError } from '../../store/authSlice'
import { lookupPincodeArea } from '../../api/location'
import { PhoneVerification, usePhoneConfig } from '../../components/WhatsAppCode'
import { createStyles } from '../../theme/createStyles'
import AuthBackground, { AUTH_BACKGROUND } from '../../components/AuthBackground'

// The web sign-up's role characters (public/octabuild/roles/*.png).
const ROLES = [
  { value: 'OWNER', labelKey: 'role.owner', descKey: 'role.ownerDesc', image: require('../../../assets/octabuild/roles/home.png') },
  { value: 'CONTRACTOR', labelKey: 'role.contractor', descKey: 'role.contractorDesc', image: require('../../../assets/octabuild/roles/builder.png') },
  { value: 'SUPPLIER', labelKey: 'role.supplier', descKey: 'role.supplierDesc', image: require('../../../assets/octabuild/roles/supplier.png') },
  { value: 'ENGINEER', labelKey: 'role.engineer', descKey: 'role.engineerDesc', image: require('../../../assets/octabuild/roles/engineer.png') },
]

export default function SignupScreen({ navigation }) {
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const { t, translateMessage } = useLanguage()
  const comingSoon = useComingSoon()
  const { status, errorMessage } = useSelector((state) => state.auth)

  const [form, setForm] = useState({
    role: 'OWNER',
    name: '',
    email: '',
    phone: '',
    password: '',
    address: '',
    pincode: '',
  })
  const [pincodeArea, setPincodeArea] = useState('')
  const phoneConfig = usePhoneConfig()
  const phoneFirst = phoneConfig.signup
  const [phoneToken, setPhoneToken] = useState(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [signupAlert, setSignupAlert] = useState('')
  // One account per tap: set before the request leaves, cleared only if it fails.
  const submitting = useRef(false)

  const loading = status === 'loading'
  const set = (key) => (value) => {
    if (errorMessage) dispatch(clearAuthError())
    setSignupAlert('')
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Mirrors the web behaviour: auto-fill the area name once 6 digits are typed.
  async function onPincodeChange(value) {
    set('pincode')(value)
    if (value.length === 6) {
      try {
        const area = await lookupPincodeArea(value)
        setPincodeArea(area?.area || area?.district || '')
      } catch {
        setPincodeArea('')
      }
    } else {
      setPincodeArea('')
    }
  }

  const complete =
    form.name.trim() && form.email.trim() && form.phone.trim() && form.password
  const phoneFirstReady = form.name.trim().length >= 2 && Boolean(form.role) && Boolean(phoneToken) && acceptedTerms

  async function submitPhoneFirst() {
    if (submitting.current || loading) return
    if (form.name.trim().length < 2) return setSignupAlert(t('validation.name'))
    if (!phoneToken) return setSignupAlert(t('signup.phone.verifyFirst'))
    if (!acceptedTerms) return setSignupAlert(t('validation.terms'))
    setSignupAlert('')
    submitting.current = true
    // The verified number and its token, nothing else to identify the account:
    // the API checks the token belongs to exactly this number.
    const result = await dispatch(
      signupWithProfile({ name: form.name.trim(), role: form.role, phone: form.phone, phone_verification_token: phoneToken }),
    )
    if (!result.payload?.user) submitting.current = false
  }

  function submit() {
    if (phoneFirst) return submitPhoneFirst()
    if (!complete) return
    dispatch(
      signupWithProfile({
        ...form,
        email: form.email.trim().toLowerCase(),
        name: form.name.trim(),
      }),
    )
  }

  return (
    <View style={[styles.view, { backgroundColor: AUTH_BACKGROUND }]}>
      <AuthBackground />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            style={[styles.pressable, { gap: 6 }]}
          >
            <ArrowLeft size={15} color="#ffffff" />
            <Text style={[styles.text, { fontSize: 12.5 }]}>
              {t('shared.backHome')}
            </Text>
          </Pressable> */}

          <View style={styles.view2}>
            <Text style={[styles.text2, { fontSize: 26, letterSpacing: -0.9 }]}>
              {t('shared.tagline')}
            </Text>
            <Text style={[styles.text3, { fontSize: 13.5, lineHeight: 20 }]}>
              {t('shared.joinPlatform')}
            </Text>
          </View>

          <View style={[styles.view3, { maxWidth: 560, marginHorizontal: 20 }]}>
            <ErrorBanner message={translateMessage(errorMessage)} />

            <Text style={[styles.text4, { fontSize: 13 }]}>
              {t('role.owner') ? 'I am a…' : 'Role'}
            </Text>
            {ROLES.map(({ value, labelKey, descKey, image }) => (
              <RoleCard
                key={value}
                label={t(labelKey)}
                description={t(descKey)}
                selected={form.role === value}
                // Site Engineer is not live in the app yet; Supplier opens with its first live kind.
                onPress={() => (isSignupRoleOpen(value) ? set('role')(value) : comingSoon.show(value))}
                badge={isSignupRoleOpen(value) ? null : <SoonTag />}
                image={image}
              />
            ))}

            {!phoneConfig.ready ? (
              <ActivityIndicator color="#1a5038" style={styles.loader} />
            ) : phoneFirst ? (
              <View style={styles.view4}>
                <Field label={t('signup.fullName')} value={form.name} onChangeText={set('name')} placeholder={t('signup.namePlaceholder')} autoComplete="name" />
                <PhoneVerification
                  phone={form.phone}
                  onPhoneChange={set('phone')}
                  onVerifiedChange={setPhoneToken}
                  label={t('signup.mobileNumber')}
                />
                <Pressable
                  onPress={() => { setAcceptedTerms((value) => !value); setSignupAlert('') }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTerms }}
                  style={styles.terms}
                >
                  <View style={[styles.checkbox, acceptedTerms && styles.checkboxOn]}>
                    {acceptedTerms ? <Check size={13} color="#ffffff" strokeWidth={3} /> : null}
                  </View>
                  <Text style={styles.termsText}>{t('signup.terms')}</Text>
                </Pressable>
                <ErrorBanner message={signupAlert} />
                <PrimaryButton
                  label={loading ? t('signup.loading') : t('signup.createAccount')}
                  onPress={submit}
                  loading={loading}
                  disabled={!phoneFirstReady}
                  icon={<ArrowRight size={16} color="#ffffff" />}
                  full
                />
              </View>
            ) : (
              <>
              <View style={styles.view4}>
                <Field label="Full name" value={form.name} onChangeText={set('name')} placeholder="Your name" />
                <Field
                  label="Email"
                  value={form.email}
                  onChangeText={set('email')}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Field
                  label="Phone"
                  value={form.phone}
                  onChangeText={set('phone')}
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                />
                <Field
                  label="Password"
                  value={form.password}
                  onChangeText={set('password')}
                  placeholder="10+ chars, upper, lower, number, symbol"
                  secure
                  autoCapitalize="none"
                />
                <Field label="Address" value={form.address} onChangeText={set('address')} placeholder="Street, area, city" multiline />
                <Field
                  label="Pincode"
                  value={form.pincode}
                  onChangeText={onPincodeChange}
                  placeholder="500001"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                {pincodeArea ? (
                  <Text style={[styles.text5, { fontSize: 12.5 }]}>
                    {pincodeArea}
                  </Text>
                ) : null}
              </View>

              <PrimaryButton
                label={t('site.nav.signup')}
                onPress={submit}
                loading={loading}
                disabled={!complete}
                icon={<ArrowRight size={16} color="#ffffff" />}
                full
              />
              </>
            )}

            <Pressable onPress={() => navigation.navigate('Login')} style={styles.pressable2}>
              <Text style={[styles.text6, { fontSize: 13.5 }]}>
                {phoneFirst ? `${t('signup.already')} ${t('signup.signinPlain')}` : t('site.nav.login')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1 },
  pressable: { marginLeft: 14, marginTop: 7, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 9999, backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 12.25, paddingVertical: 7 },
  text: { fontFamily: 'Inter_600SemiBold', color: '#ffffff' },
  view2: { paddingHorizontal: 21, paddingTop: 28 },
  text2: { fontFamily: 'Manrope_800ExtraBold', color: '#ffffff' },
  text3: { marginTop: 7, fontFamily: 'Inter_400Regular', color: '#cbd5e1' },
  view3: { marginTop: 24.5, alignSelf: 'center', width: '100%', borderRadius: 21, backgroundColor: c.card, padding: 21 },
  text4: { marginBottom: 10.5, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  view4: { marginTop: 14 },
  loader: { marginVertical: 24 },
  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  checkbox: { width: 20, height: 20, marginTop: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1.5, borderColor: c.borderStrong, backgroundColor: c.card },
  checkboxOn: { borderColor: '#1a5038', backgroundColor: '#1a5038' },
  termsText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_500Medium', color: c.textMuted },
  text5: { marginTop: -7, marginBottom: 10.5, fontFamily: 'Inter_400Regular', color: c.brandText },
  pressable2: { marginTop: 17.5, alignItems: 'center' },
  text6: { fontFamily: 'Inter_600SemiBold', color: c.brandText },
}))
