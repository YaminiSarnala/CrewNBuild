// Port of the web src/pages/auth/CompleteProfilePage.jsx.
//
// The web version has four multi-step wizards (contractorProfileSteps.jsx,
// ownerProfileSteps.jsx, supplierProfileSteps.jsx, engineerProfileSteps.jsx).
// This screen implements the SAME required fields the backend checks in
// User.profile_complete (app/models/user.py), in a single scrolling form per
// role. Extend it into multi-step screens later if you want the exact web flow.
import { useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowRight, LogOut } from 'lucide-react-native'
import { Field, ErrorBanner } from '../../components/Field'
import { PrimaryButton } from '../../components/ui'
import { useLanguage } from '../../i18n/LanguageContext'
import { submitProfileCompletion, logoutUser } from '../../store/authSlice'

// Required fields per role, taken straight from User.profile_complete.
// Required fields per role. The backend's profile_field_errors() in
// api/routes.py requires phone, address and pincode for EVERY role, plus the
// role-specific ones below.
const ROLE_FIELDS = {
  CONTRACTOR: [
    ['phone', 'Phone (10 digits)', 'numeric'],
    ['address', 'Address', 'multiline'],
    ['pincode', 'Pincode (6 digits)', 'numeric'],
    ['company_name', 'Company name'],
    ['license_number', 'License number'],
    ['experience_years', 'Years of experience', 'numeric'],
    ['about', 'About your company', 'multiline'],
    ['service_locations', 'Service locations (comma separated pincodes)'],
    ['services_offered', 'Services offered (comma separated)'],
  ],
  SUPPLIER: [
    ['phone', 'Phone (10 digits)', 'numeric'],
    ['address', 'Address', 'multiline'],
    ['pincode', 'Pincode (6 digits)', 'numeric'],
    ['store_name', 'Store name'],
    ['categories', 'Categories (comma separated)'],
    ['about', 'About your store', 'multiline'],
    ['service_locations', 'Delivery locations (comma separated pincodes)'],
  ],
  OWNER: [
    ['phone', 'Phone (10 digits)', 'numeric'],
    ['address', 'Address', 'multiline'],
    ['pincode', 'Pincode (6 digits)', 'numeric'],
    ['project_title', 'Project title'],
    ['project_description', 'Project description', 'multiline'],
    ['building_type', 'Building type (e.g. Independent house)'],
    ['construction_type', 'Construction type (e.g. New build)'],
    ['budget', 'Budget (₹)', 'numeric'],
    ['land_area', 'Land area (sq.ft)', 'numeric'],
    ['floors', 'Number of floors', 'numeric'],
  ],
  ENGINEER: [
    ['phone', 'Phone (10 digits)', 'numeric'],
    ['address', 'Address', 'multiline'],
    ['pincode', 'Pincode (6 digits)', 'numeric'],
    ['qualification', 'Qualification'],
    ['experience_years', 'Years of experience', 'numeric'],
    ['specialisation', 'Specialisation'],
  ],
}
export default function CompleteProfileScreen() {
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const { t, translateMessage } = useLanguage()
  const { user, status, errorMessage } = useSelector((state) => state.auth)

  const fields = ROLE_FIELDS[user?.role] || ROLE_FIELDS.OWNER
  const [form, setForm] = useState({})

  const loading = status === 'loading'
  const complete = fields.every(([key]) => String(form[key] ?? '').trim().length > 0)

  function submit() {
    if (!complete) return
    // Numeric fields must go to FastAPI as numbers, not strings.
    const payload = { ...form }
// phone and pincode are validated as STRINGS server-side (.isdigit()),
    // so they must not be converted to numbers.
    const stringNumericFields = new Set(['phone', 'pincode'])
    fields.forEach(([key, , kind]) => {
      if (kind === 'numeric' && !stringNumericFields.has(key)) {
        payload[key] = Number(payload[key])
      }
    })
    dispatch(submitProfileCompletion(payload))
  }

  return (
    <View className="flex-1 bg-paper">
      <View style={{ paddingTop: insets.top }} className="bg-brand-800 pb-5">
        <View className="flex-row items-center px-5 pt-3">
          <View className="flex-1">
            <Text className="font-display text-white" style={{ fontSize: 19, letterSpacing: -0.5 }}>
              Complete your profile
            </Text>
            <Text className="mt-1 font-sans text-brand-300" style={{ fontSize: 12.5 }}>
              A few details before you can continue
            </Text>
          </View>
          <Pressable onPress={() => dispatch(logoutUser())} accessibilityLabel="Sign out" className="p-2">
            <LogOut size={19} color="#c3dccd" />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32, width: '100%', maxWidth: 640, alignSelf: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <ErrorBanner message={translateMessage(errorMessage)} />

          {fields.map(([key, label, kind]) => (
            <Field
              key={key}
              label={label}
              value={String(form[key] ?? '')}
              onChangeText={(value) => setForm((prev) => ({ ...prev, [key]: value }))}
              keyboardType={kind === 'numeric' ? 'numeric' : 'default'}
              multiline={kind === 'multiline'}
              placeholder={label}
            />
          ))}

          <PrimaryButton
            label="Save and continue"
            onPress={submit}
            loading={loading}
            disabled={!complete}
            icon={<ArrowRight size={16} color="#ffffff" />}
            full
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
