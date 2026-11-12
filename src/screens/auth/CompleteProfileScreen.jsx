// Port of the web src/pages/auth/CompleteProfilePage.jsx.
//
// Opened by useProfileGate when an action needs profile data (the web no
// longer forces this form after signup). Saving returns to the screen that
// asked and replays the action it was in the middle of.
//
// The House Owner sees the web's one-step Profile Details: name and e-mail
// (read-only), phone, country of residence, pincode with its post office,
// location and address, each opened on the saved value. "Complete" is the
// server's rule (User.profile_completion_fields): name, e-mail, phone, address
// and pincode, so a phone-first account adds its e-mail here first, and a
// changed Indian number passes the WhatsApp check where the server has it on.
// Builders and engineers get their role's required fields below the common
// ones; the web's multi-step wizards collect more optional detail, which stays
// in the role's own profile settings.
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, KeyboardAvoidingView, Pressable } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react-native'
import { Field, ErrorBanner } from '../../components/Field'
import { PrimaryButton } from '../../components/ui'
import EmailSection from '../../components/EmailSection'
import { PhoneCodeCheck, usePhoneConfig } from '../../components/WhatsAppCode'
import { useLanguage } from '../../i18n/LanguageContext'
import { submitProfileCompletion, clearAuthError } from '../../store/authSlice'
import { clearPendingProfileAction, takePendingProfileAction } from '../../hooks/useProfileGate'
import { createStyles } from '../../theme/createStyles'
import { PincodeAreaHint } from '../../components/form'
import { usePincodeAreaLookup } from '../../hooks/usePincodeAreaLookup'
import { baseFieldErrors, digitsOf, isIndia, ownerProfileFields } from '../../utils/profileValidation'
import SupplierCompleteProfile from '../supplier/SupplierCompleteProfile'

// The web's RESIDENCE_COUNTRIES: the API refuses any other country on this save.
const RESIDENCE_COUNTRY = 'India'

// [key, label, kind, required] — the role's own fields after the common ones.
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
  // SUPPLIER: its own form, screens/supplier/SupplierCompleteProfile.jsx.
  ENGINEER: [
    ['specialization', 'Specialization', 'text', true],
    ['qualification', 'Qualification', 'text', false],
    ['experience_years', 'Years of experience', 'number', false],
  ],
}

const textOf = (value) => (value == null ? '' : String(value))
const branchDisplay = (branch) => branch?.display || branch?.name || ''

// The form opens on what is saved: the account's own columns, and an engineer's
// details from engineer_profile (as the web's savedEngineer).
function initialForm(user, roleFields) {
  const saved = user?.role === 'ENGINEER' ? (user?.engineer_profile || {}) : {}
  return {
    phone: textOf(user?.phone),
    address: textOf(user?.address),
    pincode: textOf(user?.pincode),
    location: textOf(user?.location),
    ...Object.fromEntries(roleFields.map(([key]) => [key, textOf(user?.[key] ?? saved[key])])),
  }
}

function roleFieldErrors(form, roleFields) {
  const errors = {}
  roleFields.forEach(([key, , kind, required]) => {
    const value = String(form[key] ?? '').trim()
    if (required && !value) errors[key] = 'This field is required.'
    else if (key === 'experience_years' && value && (!/^\d+$/.test(value) || (required && Number(value) < 1))) {
      errors[key] = 'Enter whole years (at least 1).'
    } else if (kind === 'number' && value && Number.isNaN(Number(value))) errors[key] = 'Enter a number.'
  })
  return errors
}

// A supplier gets the web's supplier form (store, product categories, delivery
// locations, documents); every other role the form below.
export default function CompleteProfileScreen({ navigation }) {
  const role = useSelector((state) => state.auth.user?.role)
  return role === 'SUPPLIER' ? <SupplierCompleteProfile navigation={navigation} /> : <RoleCompleteProfile navigation={navigation} />
}

function RoleCompleteProfile({ navigation }) {
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const { t, td, translateMessage } = useLanguage()
  const { user, status, errorMessage } = useSelector((state) => state.auth)
  const phoneConfig = usePhoneConfig()

  const roleFields = ROLE_FIELDS[user?.role] || []
  const country = RESIDENCE_COUNTRY
  const india = isIndia(country)
  const [form, setForm] = useState(() => initialForm(user, roleFields))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [phoneToken, setPhoneToken] = useState(null)
  const loading = status === 'loading'

  // The pincode's post offices, looked up while it is typed. The one picked is
  // saved as the account's location; re-resolving the saved pincode keeps the
  // saved location, so an untouched form is not asked to pick again.
  const savedLocationRef = useRef({ pincode: textOf(user?.pincode), location: textOf(user?.location) })
  // The address the pincode last filled in: an empty address (or one still
  // holding that value) follows the pincode; a typed one is never replaced.
  const autoAddressRef = useRef(user?.address && user.address === user?.location ? user.address : '')
  const [branch, setBranch] = useState(null)
  const applyDisplay = useCallback((display) => {
    if (!display) return
    const lastAuto = autoAddressRef.current
    setForm((current) => ({
      ...current,
      location: display,
      address: String(current.address || '').trim() && current.address !== lastAuto ? current.address : display,
    }))
    autoAddressRef.current = display
  }, [])
  const onAreaResolved = useCallback((area) => {
    const branches = Array.isArray(area?.post_offices) ? area.post_offices : []
    const saved = savedLocationRef.current
    const isSavedPincode = String(area?.pincode || '') === saved.pincode
    const savedBranch = isSavedPincode ? branches.find((item) => branchDisplay(item) === saved.location) || null : null
    const picked = branches.length === 1 ? branches[0] : savedBranch
    setBranch(picked)
    if (isSavedPincode && saved.location) return
    // Several post offices and none picked yet: the last pincode's location goes.
    if (branches.length > 1 && !picked) setForm((current) => ({ ...current, location: '' }))
    else applyDisplay(branchDisplay(picked) || area?.display || '')
  }, [applyDisplay])
  const pincodeLookup = usePincodeAreaLookup(form.pincode, onAreaResolved, country)
  const selectBranch = (picked) => {
    setBranch(picked)
    applyDisplay(branchDisplay(picked))
    if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: undefined }))
  }
  // Several post offices under the pincode and none chosen (a saved location for
  // the saved pincode counts as chosen).
  const branchMissing = pincodeLookup.status === 'success'
    && (pincodeLookup.branches || []).length > 1
    && !branch
    && !(form.pincode === savedLocationRef.current.pincode && form.location && form.location === savedLocationRef.current.location)

  // A changed Indian number needs the WhatsApp check where the server has it on.
  const phoneChanged = digitsOf(form.phone) !== digitsOf(user?.phone)
  const phoneCheckNeeded = phoneConfig.signup && india && phoneChanged && digitsOf(form.phone).length === 10

  useEffect(() => {
    dispatch(clearAuthError())
    // Leaving without saving drops the action that was waiting on this form.
    return () => clearPendingProfileAction()
  }, [dispatch])

  async function submit() {
    // Phone, address and pincode: the server's own rules (utils/profileValidation).
    // The name is read-only here, so its rule is left out.
    const { name: _name, ...baseErrors } = baseFieldErrors({ ...form, name: 'name' }, country)
    const nextErrors = { ...baseErrors, ...roleFieldErrors(form, roleFields) }
    if (!nextErrors.pincode && branchMissing) nextErrors.pincode = t('location.prompt.selectBranch')
    if (!nextErrors.phone && phoneCheckNeeded && !phoneToken) nextErrors.phone = t('signup.phone.verifyFirst')
    setErrors(Object.fromEntries(Object.entries(nextErrors).map(([key, text]) => [key, td(String(text))])))
    if (Object.keys(nextErrors).length) {
      setFormError(t('cp.val.completeFields'))
      return
    }
    // The completion rule needs an e-mail: a phone-first account adds and
    // verifies one in the section above the form (as the web).
    if (!user?.email) {
      setFormError(t('emailVerify.needEmail'))
      return
    }
    setFormError('')

    const payload = {
      // The API resets an omitted owner budget / land area / floors to 0 / 0 / 1,
      // so the owner's saved values travel with the form unchanged.
      ...(user?.role === 'OWNER' ? ownerProfileFields(user.owner_profile) : {}),
      ...form,
      name: user?.name || undefined,
      country_of_residence: country,
      // phone and pincode stay strings (validated with .isdigit() server-side).
      phone: digitsOf(form.phone),
      pincode: digitsOf(form.pincode),
      address: String(form.address || '').trim(),
      location: String(form.location || '').trim() || null,
      ...(phoneCheckNeeded && phoneToken ? { phone_verification_token: phoneToken } : {}),
    }
    if (payload.experience_years !== undefined) payload.experience_years = Number(payload.experience_years || 0)

    const result = await dispatch(submitProfileCompletion(payload))
    if (!submitProfileCompletion.fulfilled.match(result)) {
      // 422 carries per-field messages: {detail: {message, fields: {phone: '…'}}}
      const fields = result.meta?.fieldErrors
      if (fields) setErrors(Object.fromEntries(Object.entries(fields).map(([key, text]) => [key, td(String(text))])))
      // A spent or refused token needs a fresh check.
      if (fields?.phone) setPhoneToken(null)
      return
    }
    // Saved, but the server still counts the profile incomplete: say what is
    // missing instead of leaving the form looking stuck.
    if (result.payload?.profile_complete === false) {
      const missing = result.payload?.profile_completion?.missing_fields || []
      if (missing.some((item) => item?.field === 'email')) setFormError(t('emailVerify.needEmail'))
      else {
        setErrors(Object.fromEntries(missing.map((item) => [item.field, td(`${item.label} is required.`)])))
        setFormError(t('cp.val.completeFields'))
      }
      return
    }

    const resume = takePendingProfileAction()
    if (navigation.canGoBack()) navigation.goBack()
    // Let the asking screen come back into focus before replaying its action.
    if (resume) setTimeout(resume, 350)
  }

  const setField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
    setFormError('')
  }

  const readOnly = (label, value) => (
    <View style={styles.readOnly}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <View style={styles.readOnlyBox}>
        <Lock size={13} color="#94a3b8" />
        <Text style={styles.readOnlyText} numberOfLines={1}>{value || '—'}</Text>
      </View>
    </View>
  )

  return (
    <View style={styles.view}>
      <View style={[styles.view2, { paddingTop: insets.top }]}>
        <View style={[styles.view3, { gap: 6 }]}>
          {navigation.canGoBack() && (
            <Pressable onPress={() => navigation.goBack()} accessibilityLabel={t('dash.common.back')} style={styles.pressable}>
              <ArrowLeft size={20} color="#ffffff" />
            </Pressable>
          )}
          <View style={styles.view4}>
            <Text style={[styles.text2, { fontSize: 19, letterSpacing: -0.5 }]}>
              {t('cp.hero.completeProfile')}
            </Text>
            <Text style={[styles.text3, { fontSize: 12.5 }]} numberOfLines={2}>
              {user?.role === 'OWNER' ? t('ps.owner.subtitleProfile') : t('cp.profileHint')}
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

          {/* A phone-first account has no e-mail yet; completing needs one. */}
          {!user?.email ? (
            <View style={styles.emailBlock}>
              <EmailSection />
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>{t('ps.profileDetails')}</Text>
          {readOnly(t('ps.name'), user?.name)}
          {readOnly(t('ps.email'), user?.email)}

          <Field
            label={`${t('ps.phone')} *`}
            value={form.phone}
            onChangeText={(value) => setField('phone')(value.replace(/\D/g, '').slice(0, india ? 10 : 15))}
            keyboardType="phone-pad"
            placeholder="9876543210"
            maxLength={india ? 10 : 15}
            error={errors.phone}
          />
          {phoneCheckNeeded ? (
            <PhoneCodeCheck
              phone={digitsOf(form.phone)}
              onVerifiedChange={(token) => {
                setPhoneToken(token)
                if (token && errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }))
              }}
            />
          ) : null}

          {readOnly(t('signup.countryOfResidence'), t('country.india'))}
          <Text style={styles.hint}>{t('signup.countryOfResidenceHint')}</Text>

          <Field
            label={`${t('ps.pincode')} *`}
            value={form.pincode}
            onChangeText={(value) => setField('pincode')(value.replace(/\D/g, '').slice(0, india ? 6 : 10))}
            keyboardType="number-pad"
            placeholder="500001"
            maxLength={india ? 6 : 10}
            error={errors.pincode}
          />
          <PincodeAreaHint lookupState={pincodeLookup} selectedBranch={branch} onSelectBranch={selectBranch} />

          <Field
            label={t('ps.location')}
            value={form.location}
            onChangeText={setField('location')}
            placeholder={t('ps.locationPlaceholder')}
            error={errors.location}
          />
          <Field
            label={`${t('ps.address')} *`}
            value={form.address}
            onChangeText={setField('address')}
            placeholder={t('ps.addressPlaceholder')}
            multiline
            maxLength={500}
            error={errors.address}
          />

          {roleFields.map(([key, label, kind, required]) => (
            <Field
              key={key}
              label={required ? `${label} *` : `${label} (optional)`}
              value={form[key]}
              onChangeText={setField(key)}
              keyboardType={kind === 'number' ? 'number-pad' : 'default'}
              multiline={kind === 'multiline'}
              placeholder={label}
              error={errors[key]}
            />
          ))}

          <ErrorBanner message={formError} />
          <PrimaryButton
            label={t('cp.completeProfileBtn')}
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
  sectionTitle: { marginBottom: 10, fontSize: 15, fontFamily: 'Manrope_800ExtraBold', color: c.text },
  emailBlock: { marginBottom: 18, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  readOnly: { marginBottom: 14 },
  readOnlyLabel: { marginBottom: 5.25, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  readOnlyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.muted, paddingHorizontal: 14, paddingVertical: 14,
  },
  readOnlyText: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  hint: { marginTop: -8, marginBottom: 14, fontSize: 11.5, fontFamily: 'Inter_500Medium', color: c.textMuted },
}))
