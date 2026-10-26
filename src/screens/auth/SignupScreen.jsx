// Port of the web src/pages/auth/SignupPage.jsx.
// Roles and the payload shape match app/services/auth_service.py exactly:
// role must be one of OWNER / CONTRACTOR / SUPPLIER / ENGINEER, and the
// backend requires name, email, phone, password, address, pincode.
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView } from 'react-native'
import { Image } from 'expo-image'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeft, ArrowRight, House as Home, HardHat, Package, Ruler } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Field, ErrorBanner, RoleCard } from '../../components/Field'
import { PrimaryButton } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { signupWithProfile, clearAuthError } from '../../store/authSlice'
import { lookupPincodeArea } from '../../api/location'
import { createStyles } from '../../theme/createStyles'

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
    phone: '',
    password: '',
    address: '',
    pincode: '',
  })
  const [pincodeArea, setPincodeArea] = useState('')

  const loading = status === 'loading'
  const set = (key) => (value) => {
    if (errorMessage) dispatch(clearAuthError())
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
  function submit() {
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
    <View style={[styles.view, { backgroundColor: '#0d0b14' }]}>
      <Image
        source={require('../../../assets/auth-architecture-bg.png')}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }}
        contentFit="cover"
      />
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
            {ROLES.map(({ value, labelKey, descKey, Icon }) => (
              <RoleCard
                key={value}
                label={t(labelKey)}
                description={t(descKey)}
                selected={form.role === value}
                onPress={() => set('role')(value)}
                icon={<Icon size={18} color={form.role === value ? '#ffffff' : '#64748b'} />}
              />
            ))}

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

            <Pressable onPress={() => navigation.navigate('Login')} style={styles.pressable2}>
              <Text style={[styles.text6, { fontSize: 13.5 }]}>
                {t('site.nav.login')}
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
  text5: { marginTop: -7, marginBottom: 10.5, fontFamily: 'Inter_400Regular', color: c.brandText },
  pressable2: { marginTop: 17.5, alignItems: 'center' },
  text6: { fontFamily: 'Inter_600SemiBold', color: c.brandText },
}))
