// Port of the web src/pages/auth/CompleteProfilePage.jsx.
//
// Opened by useProfileGate when an action needs profile data (the web no
// longer forces this form after signup). Saving returns to the screen that
// asked and replays the action it was in the middle of.
//
// Required fields follow the web's validation: phone, address and pincode for
// every role (checked per country of residence), plus the role-specific ones.
// The web's multi-step wizards collect more optional detail; those stay in the
// role's own profile settings.
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Pressable } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, ArrowRight } from 'lucide-react-native'
import { Field, ErrorBanner } from '../../components/Field'
import { PrimaryButton } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { submitProfileCompletion, clearAuthError } from '../../store/authSlice'
import { clearPendingProfileAction, takePendingProfileAction } from '../../hooks/useProfileGate'
import { createStyles } from '../../theme/createStyles'

const COUNTRIES = ['India', 'Kuwait']

// [key, label, kind, required]
const COMMON_FIELDS = [
  ['phone', 'Phone', 'phone', true],
  ['address', 'Address', 'multiline', true],
  ['pincode', 'Pincode / postal code', 'number', true],
]

const ROLE_FIELDS = {
  // A House Owner's profile is only the common fields; project details belong
  // to the project creation form (same as the web).
  OWNER: [],
  CONTRACTOR: [
    ['company_name', 'Company name', 'text', true],
    ['license_number', 'License number', 'text', true],
    ['experience_years', 'Years of experience', 'number', true],
    ['about', 'About your company', 'multiline', true],
    ['service_locations', 'Service locations (comma separated)', 'text', true],
    ['services_offered', 'Services offered (comma separated)', 'text', true],
  ],
  SUPPLIER: [
    ['store_name', 'Store name', 'text', true],
    ['supplier_category', 'Supplier category (Material / Labor / Equipment)', 'text', true],
    ['categories', 'Product categories (comma separated)', 'text', true],
    ['about', 'About your store', 'multiline', true],
    ['service_locations', 'Delivery locations (comma separated)', 'text', true],
  ],
  ENGINEER: [
    ['specialization', 'Specialization', 'text', true],
    ['qualification', 'Qualification', 'text', false],
    ['experience_years', 'Years of experience', 'number', false],
  ],
}

const isIndia = (country) => String(country || 'India').trim().toLowerCase() === 'india'
const digitsOf = (value) => String(value || '').replace(/\D/g, '')

const OWNER_PROFILE_KEYS = [
  'building_type', 'construction_type', 'budget', 'land_area', 'floors', 'floor_type',
  'project_title', 'project_description', 'site_status', 'start_timeline', 'design_status', 'contact_preference',
]

function ownerProfileFields(ownerProfile) {
  if (!ownerProfile) return {}
  return Object.fromEntries(OWNER_PROFILE_KEYS.filter((key) => ownerProfile[key] != null).map((key) => [key, ownerProfile[key]]))
}

function validate(form, fields, country) {
  const errors = {}
  const phone = digitsOf(form.phone)
  if (isIndia(country) ? phone.length !== 10 : phone.length < 8 || phone.length > 15) {
    errors.phone = isIndia(country) ? 'Enter a 10-digit mobile number.' : 'Enter a phone number of 8–15 digits.'
  }
  const pin = digitsOf(form.pincode)
  if (isIndia(country) ? !/^\d{6}$/.test(pin) : pin.length < 3 || pin.length > 10) {
    errors.pincode = isIndia(country) ? 'Enter a 6-digit pincode.' : 'Enter a valid postal code.'
  }
  fields.forEach(([key, , kind, required]) => {
    if (errors[key] || key === 'phone' || key === 'pincode') return
    const value = String(form[key] ?? '').trim()
    if (required && !value) errors[key] = 'This field is required.'
    else if (key === 'experience_years' && value && (!/^\d+$/.test(value) || (required && Number(value) < 1))) {
      errors[key] = 'Enter whole years (at least 1).'
    } else if (kind === 'number' && value && Number.isNaN(Number(value))) errors[key] = 'Enter a number.'
  })
  return errors
}

export default function CompleteProfileScreen({ navigation }) {
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const { translateMessage } = useLanguage()
  const { user, status, errorMessage } = useSelector((state) => state.auth)

  const fields = [...COMMON_FIELDS, ...(ROLE_FIELDS[user?.role] || [])]
  const [country, setCountry] = useState(user?.country_of_residence || 'India')
  const [form, setForm] = useState(() =>
    Object.fromEntries(fields.map(([key]) => [key, user?.[key] != null ? String(user[key]) : ''])),
  )
  const [errors, setErrors] = useState({})
  const loading = status === 'loading'

  useEffect(() => {
    dispatch(clearAuthError())
    // Leaving without saving drops the action that was waiting on this form.
    return () => clearPendingProfileAction()
  }, [dispatch])

  async function submit() {
    const nextErrors = validate(form, fields, country)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    const payload = {
      // The API resets an omitted owner budget / land area / floors to 0 / 0 / 1,
      // so the owner's saved values travel with the form unchanged.
      ...(user?.role === 'OWNER' ? ownerProfileFields(user.owner_profile) : {}),
      ...form,
      country_of_residence: country,
      phone: digitsOf(form.phone),
      pincode: digitsOf(form.pincode),
    }
    // phone and pincode stay strings (validated with .isdigit() server-side).
    if (payload.experience_years !== undefined) payload.experience_years = Number(payload.experience_years || 0)

    const result = await dispatch(submitProfileCompletion(payload))
    if (!submitProfileCompletion.fulfilled.match(result)) {
      // 422 carries per-field messages: {detail: {message, fields: {phone: '…'}}}
      if (result.meta?.fieldErrors) setErrors(result.meta.fieldErrors)
      return
    }
    if (result.payload?.profile_complete === false) return

    const resume = takePendingProfileAction()
    if (navigation.canGoBack()) navigation.goBack()
    // Let the asking screen come back into focus before replaying its action.
    if (resume) setTimeout(resume, 350)
  }

  const setField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  return (
    <View style={styles.view}>
      <View style={[styles.view2, { paddingTop: insets.top }]}>
        <View style={[styles.view3, { gap: 6 }]}>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Back" style={styles.pressable}>
              <ArrowLeft size={20} color="#ffffff" />
            </Pressable>
          )}
          <View style={styles.view4}>
            <Text style={[styles.text2, { fontSize: 19, letterSpacing: -0.5 }]}>
              Complete your profile
            </Text>
            <Text style={[styles.text3, { fontSize: 12.5 }]}>
              A few details before you continue
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, width: '100%', maxWidth: 640, alignSelf: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <ErrorBanner message={translateMessage(errorMessage)} />

          <Text style={[styles.text4, { fontSize: 13 }]}>Country of residence</Text>
          <View style={[styles.view5, { gap: 4 }]}>
            {COUNTRIES.map((option) => {
              const active = option === country
              return (
                <Pressable
                  key={option}
                  onPress={() => setCountry(option)}
                  style={[styles.pressable2, active ? styles.pressable3 : null]}
                >
                  <Text style={[styles.text, active ? styles.text5 : styles.text6]}>{option}</Text>
                </Pressable>
              )
            })}
          </View>

          {fields.map(([key, label, kind, required]) => (
            <Field
              key={key}
              label={required ? label : `${label} (optional)`}
              value={form[key]}
              onChangeText={setField(key)}
              keyboardType={kind === 'phone' ? 'phone-pad' : kind === 'number' ? 'number-pad' : 'default'}
              multiline={kind === 'multiline'}
              placeholder={label}
              error={errors[key]}
            />
          ))}

          <PrimaryButton
            label="Save and continue"
            onPress={submit}
            loading={loading}
            icon={<ArrowRight size={16} color="#ffffff" />}
            full
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = createStyles((c) => ({
  text: { fontSize: 13, fontWeight: '800' },
  view: { flex: 1, backgroundColor: c.paper },
  view2: { backgroundColor: '#134127', paddingBottom: 17.5 },
  view3: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10.5, paddingTop: 10.5 },
  pressable: { padding: 7 },
  view4: { flex: 1, paddingHorizontal: 7 },
  text2: { fontFamily: 'Manrope_800ExtraBold', color: '#ffffff' },
  text3: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: '#9dc5af' },
  text4: { marginBottom: 5.25, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  view5: { marginBottom: 14, flexDirection: 'row', borderRadius: 14, backgroundColor: c.muted, padding: 3.5 },
  pressable2: { height: 35, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5 },
  pressable3: { backgroundColor: '#1a5038' },
  text5: { color: '#ffffff' },
  text6: { color: c.textMuted },
}))
