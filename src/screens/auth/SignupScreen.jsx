// Port of the web src/pages/auth/SignupPage.jsx.
// Roles and the payload shape match app/services/auth_service.py exactly:
// role must be one of OWNER / CONTRACTOR / SUPPLIER / ENGINEER, and the
// backend requires name, email, phone, password, address, pincode.
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { Image } from 'expo-image'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeft, ArrowRight, House as Home, HardHat, Package, Ruler } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Field, ErrorBanner, RoleCard } from '../../components/Field'
import { PrimaryButton } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { signupWithProfile, clearAuthError } from '../../store/authSlice'
import { lookupPincodeArea } from '../../api/location'

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
    <View className="flex-1" style={{ backgroundColor: '#0d0b14' }}>
      <Image
        source={require('../../../assets/auth-architecture-bg.png')}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }}
        contentFit="cover"
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            className="ml-4 mt-2 flex-row items-center self-start rounded-full bg-white/10 px-3.5 py-2"
            style={{ gap: 6 }}
          >
            <ArrowLeft size={15} color="#ffffff" />
            <Text className="font-sansSemi text-white" style={{ fontSize: 12.5 }}>
              {t('shared.backHome')}
            </Text>
          </Pressable>

          <View className="px-6 pt-8">
            <Text className="font-display text-white" style={{ fontSize: 26, letterSpacing: -0.9 }}>
              {t('shared.tagline')}
            </Text>
            <Text className="mt-2 font-sans text-slate-300" style={{ fontSize: 13.5, lineHeight: 20 }}>
              {t('shared.joinPlatform')}
            </Text>
          </View>

          <View className="mt-7 self-center w-full rounded-3xl bg-white p-6" style={{ maxWidth: 560, marginHorizontal: 20 }}>
            <ErrorBanner message={translateMessage(errorMessage)} />

            <Text className="mb-3 font-sansSemi text-slate-600" style={{ fontSize: 13 }}>
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

            <View className="mt-4">
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
                <Text className="-mt-2 mb-3 font-sans text-brand-700" style={{ fontSize: 12.5 }}>
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

            <Pressable onPress={() => navigation.navigate('Login')} className="mt-5 items-center">
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
