// The Site Engineer's Profile Settings — port of the web EngineerProfileSection
// with the sections the web shows under it (EmailVerificationSection ->
// EmailSection, DeleteAccountSection -> Delete Account). The profile reads as plain information until Edit; one
// Save for the whole form. Photo: the same picker as every dashboard.
// Wired to: PUT /auth/complete-profile (completeUserProfile), POST /files/upload
// + PATCH /auth/profile-image, the e-mail code endpoints and Delete Account.
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image' 
import { useDispatch, useSelector } from 'react-redux' 
import { Pencil, ShieldCheck, Trash2, UserRound, X } from 'lucide-react-native' 
import { useLanguage } from '../../i18n/LanguageContext' 
import { completeUserProfile } from '../../api/auth' 
import { mergeUser } from '../../store/authSlice' 
import { useProfilePhoto } from '../../hooks/useProfilePhoto' 
import { usePincodeAreaLookup } from '../../hooks/usePincodeAreaLookup' 
import { avatarFromPath } from '../../utils/avatars' 
import { apiErrorText } from '../../utils/builderHelpers' 
import { baseFieldErrors, fieldErrorsFrom } from '../../utils/profileValidation'
import { engineerCategoryChoices, engineerCategoryLabel, requiredProfileFields } from '../../utils/engineerProfile'
import EmailSection from '../../components/EmailSection'
import PhoneChangeSection from '../../components/PhoneChangeSection'
import { PincodeAreaHint } from '../../components/form'
import { ActionButton, LabeledInput, Section, SelectChip, StackScreenShell } from '../../components/builder/BuilderUi'
import { toast } from '../../components/Toast'
import { ink, line, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

function buildForm(user, profile) {
  return {
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    pincode: user?.pincode || '',
    experience_years: String(profile?.experience_years ?? 0),
    qualification: profile?.qualification || '',
    specialization: profile?.specialization || '',
    license_number: profile?.license_number || '',
    about: profile?.about || '',
  }
}

function DetailRow({ label, value, required = false }) {
  const satisfied = value !== null && value !== undefined && value !== ''
  return (
    <View style={styles.pr3}>
      <Text style={styles.pr4}>
        {label}{required ? <Text style={satisfied ? styles.pr1 : styles.pr2}> *</Text> : null}
      </Text>
      <Text style={styles.pr5}>{satisfied ? String(value) : '—'}</Text>
    </View>
  )
}

export default function EngineerProfileScreen({ navigation }) {
  const { t, td } = useLanguage()
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const profile = user?.engineer_profile || {}
  const required = requiredProfileFields(user)
  const { changePhoto, busy: photoBusy } = useProfilePhoto()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => buildForm(user, profile))
  const [saving, setSaving] = useState(false)
  // Each failing field is highlighted with its message under it; the result
  // of a save shows as a toast at the bottom.
  const [errors, setErrors] = useState({})
  const unsaved = useRef(false)

  // Never overwrite what is being typed with a refreshed account.
  useEffect(() => {
    if (editing || unsaved.current) return
    setForm(buildForm(user, profile))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, user?.phone, user?.address, user?.pincode, profile?.experience_years, profile?.qualification, profile?.specialization, profile?.license_number, profile?.about])

  const update = (field) => (value) => {
    unsaved.current = true
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
  }
  // The pincode fills an empty address only.
  const applyResolvedArea = useCallback((area) => {
    setForm((current) => (current.address ? current : { ...current, address: area.display || current.address }))
  }, [])
  const lookupState = usePincodeAreaLookup(editing ? form.pincode : '', applyResolvedArea, user?.country_of_residence)

  const startEditing = () => {
    setErrors({})
    setForm(buildForm(user, profile))
    unsaved.current = false
    setEditing(true)
  }
  const cancel = () => {
    unsaved.current = false
    setForm(buildForm(user, profile))
    setErrors({})
    setEditing(false)
  }

  async function save() {
    if (saving) return
    const problems = Object.fromEntries(Object.entries(baseFieldErrors(form, user?.country_of_residence)).map(([key, value]) => [key, td(String(value))]))
    if (Object.keys(problems).length) {
      setErrors(problems)
      const list = Object.values(problems)
      toast.error(list.length === 1 ? list[0] : t('cp.val.completeFields'))
      return
    }
    setSaving(true)
    setErrors({})
    try {
      const updated = await completeUserProfile({
        ...form,
        experience_years: Number(form.experience_years || 0),
        profile_image_url: user?.profile_image_url || '',
      })
      dispatch(mergeUser(updated?.user || updated || {}))
      unsaved.current = false
      setEditing(false)
      toast.success(t('dash.engineer.msg.profileSaved'))
    } catch (saveError) {
      setErrors(Object.fromEntries(Object.entries(fieldErrorsFrom(saveError)).map(([key, value]) => [key, td(String(value))])))
      toast.error(apiErrorText(saveError, t('dash.engineer.msg.unableSaveProfile')))
    } finally {
      setSaving(false)
    }
  }

  async function uploadPhoto() {
    if (await changePhoto('library')) toast.success(t('dash.engineer.msg.profilePhotoUpdated'))
  }

  const categoryChoices = engineerCategoryChoices(profile?.specialization, form.specialization)
  const mark = (field) => (required.has(field) ? ' *' : '')

  return (
    <StackScreenShell title={t('ui.profileSettings')} onBack={() => navigation.goBack()}>
      <Section>
        <View style={styles.pr6}>
          <View style={styles.pr7}>
            <View style={styles.pr8}>
                          <UserRound size={18} color={ink('#1a5038')} />
              <Text style={styles.pr9} numberOfLines={1}>{t('dash.engineer.profileSettingsSub')}</Text>
            </View>
            {!editing ? <ActionButton small label={t('dash.common.edit')} icon={Pencil} onPress={startEditing} /> : null}
          </View>

          {/* The photo sits above the fields it belongs to. */}
          <View style={styles.pr10}>
            <Text style={styles.pr4}>{t('dash.engineer.profilePhoto')}</Text>
            <Image source={avatarFromPath(user?.profile_image_url, 'ENGINEER')} style={{ width: 112, height: 112, borderRadius: 16 }} contentFit="cover" />
            <ActionButton small tone="outline" label={t('dash.engineer.uploadPhoto')} busy={photoBusy} onPress={uploadPhoto} />
            <View style={styles.pr11}>
                        <ShieldCheck size={13} color={ink('#1a5038')} />
              <Text style={styles.pr12}>{t('role.engineer')}</Text>
            </View>
            <Text style={styles.pr13}>{t('dash.engineer.profileVisibleNote')}</Text>
          </View>

          {editing ? (
            <View>
              <LabeledInput label={`${t('dash.engineer.fullName')}${mark('name')}`} value={form.name} error={errors.name} onChangeText={update('name')} />
              <LabeledInput label={`${t('dash.common.email')}${mark('email')}`} value={user?.email || ''} error={errors.email} editable={false} />
              <LabeledInput label={`${t('dash.common.phone')}${mark('phone')}`} value={form.phone} error={errors.phone} keyboardType="phone-pad" onChangeText={(value) => update('phone')(value.replace(/\D/g, '').slice(-10))} />
              <LabeledInput label={`${t('dash.common.address')}${mark('address')}`} value={form.address} error={errors.address} onChangeText={update('address')} />
              <LabeledInput label={`${t('dash.common.pincode')}${mark('pincode')}`} value={form.pincode} error={errors.pincode} keyboardType="number-pad" onChangeText={(value) => update('pincode')(value.replace(/\D/g, '').slice(-6))} />
              <PincodeAreaHint lookupState={lookupState} />
              <LabeledInput label={t('dash.engineer.experienceYears')} value={form.experience_years} error={errors.experience_years} keyboardType="number-pad" onChangeText={(value) => update('experience_years')(value.replace(/\D/g, ''))} />
              <LabeledInput label={t('dash.engineer.qualification')} value={form.qualification} error={errors.qualification} placeholder={t('ps.eng.qualificationPlaceholder')} onChangeText={update('qualification')} />
              <Text style={styles.pr14}>{`${t('profile.engineerCategory')}${mark('specialization')}`}</Text>
              <View style={[styles.pr15, errors.specialization ? styles.prInvalid : null]}>
                <SelectChip
                  placeholder={t('profile.engineerCategorySelect')}
                  value={form.specialization}
                  onChange={update('specialization')}
                  options={categoryChoices.map((category) => ({ value: category, label: engineerCategoryLabel(category, t, td) }))}
                />
              </View>
              {errors.specialization ? <Text style={styles.prError}>{errors.specialization}</Text> : null}
              <LabeledInput label={t('dash.engineer.licenseNumber')} value={form.license_number} error={errors.license_number} onChangeText={update('license_number')} />
              <LabeledInput label={t('dash.msg.about')} value={form.about} error={errors.about} multiline placeholder={t('dash.engineer.aboutPlaceholder')} onChangeText={update('about')} />
            </View>
          ) : (
            <View>
              <DetailRow required={required.has('name')} label={t('dash.engineer.fullName')} value={td(user?.name)} />
              <DetailRow required={required.has('email')} label={t('dash.common.email')} value={user?.email} />
              <DetailRow required={required.has('phone')} label={t('dash.common.phone')} value={user?.phone} />
              <DetailRow required={required.has('address')} label={t('dash.common.address')} value={td(user?.address)} />
              <DetailRow required={required.has('pincode')} label={t('dash.common.pincode')} value={user?.pincode} />
              <DetailRow required={required.has('specialization')} label={t('profile.engineerCategory')} value={profile?.specialization ? engineerCategoryLabel(profile.specialization, t, td) : ''} />
              <DetailRow label={t('dash.engineer.experienceYears')} value={profile?.experience_years} />
              <DetailRow label={t('dash.engineer.qualification')} value={td(profile?.qualification)} />
              <DetailRow label={t('dash.engineer.licenseNumber')} value={profile?.license_number} />
              <DetailRow label={t('dash.msg.about')} value={td(profile?.about)} />
            </View>
          )}
        </View>
      </Section>

      {/* One Save for the whole profile, only while editing. */}
      {editing ? (
        <Section>
          <View style={styles.pr17}>
            <View style={styles.pr18}>
              <ActionButton tone="outline" label={t('ce.cancel')} icon={X} disabled={saving} onPress={cancel} />
              <ActionButton label={saving ? t('dash.common.saving') : t('dash.engineer.saveProfile')} busy={saving} onPress={save} />
            </View>
          </View>
        </Section>
      ) : null}

      <Section><PhoneChangeSection /></Section>

      <Section><EmailSection /></Section>
      <Section>




        <View style={styles.pr19}>
          <Text style={styles.pr20}>{t('account.delete')}</Text>
          <Text style={styles.pr21}>{t('account.deleteSub')}</Text>
          <View style={styles.pr22}>
            <ActionButton tone="danger" icon={Trash2} label={t('account.delete')} onPress={() => navigation.navigate('DeleteAccount')} />
          </View>
        </View>
      </Section>
    </StackScreenShell>
  )
}

const styles = createStyles((c) => ({
  pr1: { color: c.textFaint },
  pr2: { color: ink('#e11d48') },
  pr3: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 7 },
  pr4: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  pr5: { marginTop: 1.75, fontSize: 14, lineHeight: 20, fontWeight: '700', color: c.text },
  pr6: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  pr7: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10.5 },
  pr8: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  pr9: { flex: 1, fontFamily: 'Manrope_800ExtraBold', fontSize: 15, color: c.text },
  pr10: { marginBottom: 10.5, alignItems: 'center', gap: 7, borderBottomWidth: 1, borderColor: c.borderSoft, paddingBottom: 10.5 },
  pr11: { flexDirection: 'row', alignItems: 'center', gap: 5.25, borderRadius: 9999, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 3.5 },
  pr12: { fontSize: 11, fontWeight: '800', color: c.brandTextStrong },
  pr13: { textAlign: 'center', fontSize: 11, fontWeight: '500', color: c.textMuted },
  pr14: { marginBottom: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  pr15: { marginBottom: 10.5, flexDirection: 'row' },
  prInvalid: { marginBottom: 3.5, alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, borderColor: '#dc2626' },
  prError: { marginBottom: 10.5, fontSize: 11.5, fontWeight: '600', color: '#dc2626' },
  pr17: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 10.5 },
  pr18: { flexDirection: 'row', justifyContent: 'flex-end', gap: 7 },
   pr19: { borderRadius: 16, borderWidth: 1, borderColor: line('#fecdd3', '#e11d48'), backgroundColor: soft('#fff1f2', '#e11d48'), padding: 14 },
  pr20: { fontSize: 15, fontWeight: '800', color: ink('#be123c') },
  pr21: { marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '500', color: ink('#be123c') },
  pr22: { marginTop: 10.5, flexDirection: 'row' },
}))