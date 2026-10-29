// Port of web pages/contractor/ContractorProfileSettings.jsx (+ the dashboard's
// saveContractorSettingsChanges and DeleteAccountSection).
//
// Reads GET /contractors/{id}/profile and saves through PATCH
// /auth/complete-profile with the FULL builder payload, exactly as the web
// builds it, so a save never blanks a field this screen does not show. The
// profile photo uses PATCH /auth/profile-image and the company logo PATCH
// /auth/business-logo, both after POST /files/upload. Account deletion is
// DELETE /account.
// Strings use the web cps.* / ps.* / account.* keys; mobile-only ones are mobile.account.*.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, Alert, Switch } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { useDispatch, useSelector } from 'react-redux'
import { Camera, Plus, Trash2, Building2, ImagePlus } from 'lucide-react-native'
import { Panel, PanelState } from '../../components/DashboardShell'
import { ActionButton, LabeledInput, Notice, Section, StackScreenShell } from '../../components/builder/BuilderUi'
import { fetchContractorProfile } from '../../api/profiles'
import { completeUserProfile, deleteOwnAccount, updateBusinessLogo, updateProfileImage } from '../../api/auth'
import { uploadLocalFile } from '../../api/upload'
import { imageUrl } from '../../api/client'
import { logoutUser, mergeUser } from '../../store/authSlice'
import {
  PORTFOLIO_MAX_IMAGES, PORTFOLIO_MAX_PROJECTS, apiErrorText, normalizePortfolioProjects, profileListString,
  splitEditableList,
} from '../../utils/builderHelpers'
import { COLORS } from '../../theme/tokens'
import { useLanguage } from '../../i18n/LanguageContext'
import { BUSINESS_TYPE_KEYS, EQUIPMENT_OPTION_KEYS, SERVICE_OPTION_KEYS, optionLabel } from '../../i18n/optionKeys'

// Same option lists as web pages/auth/profileConstants.js. Stored values are
// these English strings; anything else a builder saved is kept as it is.
// Only the displayed label is translated (optionKeys), as on the web.
const SERVICE_OPTIONS = ['Residential Construction', 'Commercial Construction', 'Renovation & Remodeling', 'Interior Work', 'Structural Work', 'Plumbing & Electrical']
const EQUIPMENT_OPTIONS = ['Concrete Mixer', 'Excavator', 'Scaffolding', 'Bar Bending Machine', 'Concrete Vibrator', 'Safety Equipment']
const BUSINESS_TYPES = ['Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Public Limited', 'One Person Company', 'Trust / Society']

const uploadedUrl = (uploaded) => uploaded?.url || uploaded?.file_url || uploaded?.path || ''

function formFromProfile(profile, user) {
  const source = profile || {}
  return {
    name: source.name ?? user?.name ?? '',
    phone: source.phone ?? user?.phone ?? '',
    address: source.address ?? user?.address ?? '',
    pincode: source.pincode ?? user?.pincode ?? '',
    company_name: source.company_name ?? '',
    license_number: source.license_number ?? '',
    experience_years: source.experience_years == null ? '' : String(source.experience_years),
    about: source.about ?? '',
    gstin: source.gstin ?? '',
    pan: source.pan ?? '',
    website: source.website ?? '',
    business_type: source.business_type ?? '',
    registration_year: source.registration_year == null ? '' : String(source.registration_year),
    team_size: source.team_size == null ? '' : String(source.team_size),
    insurance_available: Boolean(source.insurance_available),
    service_locations: profileListString(source.service_locations),
    services_offered: splitEditableList(profileListString(source.services_offered)),
    equipment_owned: splitEditableList(profileListString(source.equipment_owned)),
    completed_project_details: normalizePortfolioProjects(source.completed_project_details || []),
  }
}

function ChipPicker({ label, options, labelKeys, value, onChange }) {
  const { t } = useLanguage()
  const all = [...options, ...value.filter((item) => !options.includes(item))]
  const toggle = (item) => onChange(value.includes(item) ? value.filter((entry) => entry !== item) : [...value, item])
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-xs font-bold text-slate-600">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {all.map((item) => {
          const on = value.includes(item)
          return (
            <Pressable key={item} onPress={() => toggle(item)} className={`rounded-full px-3 py-1.5 ${on ? 'bg-brand-700' : 'border border-slate-200 bg-white'}`}>
              <Text className={`text-[11px] font-extrabold ${on ? 'text-white' : 'text-slate-600'}`}>{optionLabel(t, labelKeys, item)}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

async function pickImage(aspect, t) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    Alert.alert(t('mobile.account.permissionTitle'), t('mobile.account.permissionImage'))
    return null
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: Boolean(aspect), aspect })
  if (result.canceled) return null
  return result.assets?.[0] || null
}

export default function BuilderProfileSettingsScreen({ navigation }) {
  const { t } = useLanguage()
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(() => formFromProfile(null, user))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [uploading, setUploading] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadError('')
    try {
      const details = await fetchContractorProfile(user.id)
      setProfile(details)
      setForm(formFromProfile(details, user))
    } catch (error) {
      setLoadError(apiErrorText(error, t('dash.err.loadBuilderProfile')))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  async function save() {
    // Never save without the loaded profile: the payload is the full builder
    // profile, so saving from an empty form would blank every hidden field.
    if (!profile) { setMessage({ tone: 'error', text: t('mobile.account.settings.notLoadedSave') }); return }
    if (!form.name.trim()) { setMessage({ tone: 'error', text: t('mobile.account.settings.enterName') }); return }
    if (form.pincode && !/^\d{4,6}$/.test(form.pincode.trim())) { setMessage({ tone: 'error', text: t('site.estimate.errPincode') }); return }
    setSaving(true)
    setMessage(null)
    const current = profile || {}
    // The web's payload, field for field.
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      pincode: form.pincode.trim(),
      company_name: form.company_name.trim() || current.company_name || user?.name || '',
      company_logo_url: current.company_logo_url || '',
      profile_image_url: current.profile_image_url || user?.profile_image_url || '',
      license_number: form.license_number.trim(),
      experience_years: Number(form.experience_years || 0),
      about: form.about.trim(),
      gstin: form.gstin.trim(),
      pan: form.pan.trim(),
      website: form.website.trim(),
      business_type: form.business_type,
      registration_year: form.registration_year === '' ? null : Number(form.registration_year),
      team_size: form.team_size.trim(),
      insurance_available: Boolean(form.insurance_available),
      service_locations: profileListString(splitEditableList(form.service_locations)),
      services_offered: profileListString(form.services_offered),
      equipment_owned: profileListString(form.equipment_owned),
      documents: profileListString(current.documents),
      gallery: profileListString(current.gallery),
      completed_project_details: JSON.stringify(normalizePortfolioProjects(form.completed_project_details)),
    }
    try {
      const updatedUser = await completeUserProfile(payload)
      dispatch(mergeUser(updatedUser?.user || updatedUser || {}))
      const refreshed = await fetchContractorProfile(user.id)
      setProfile(refreshed)
      setForm(formFromProfile(refreshed, user))
      setMessage({ tone: 'success', text: t('dash.msg.profileSaved') })
    } catch (error) {
      setMessage({ tone: 'error', text: apiErrorText(error, t('cps.errSaveChanges')) })
    } finally {
      setSaving(false)
    }
  }

  async function changePhoto(kind) {
    if (!profile) return
    const asset = await pickImage([1, 1], t)
    if (!asset) return
    setUploading(kind)
    setMessage({ tone: 'info', text: kind === 'logo' ? t('cp.msg.uploadingLogo') : t('dash.msg.uploadingProfileImage') })
    try {
      const fileUrl = uploadedUrl(await uploadLocalFile(asset, kind === 'logo' ? 'logo.jpg' : 'profile.jpg'))
      if (kind === 'logo') {
        const updatedProfile = await updateBusinessLogo(fileUrl)
        setProfile((currentProfile) => ({ ...(currentProfile || {}), ...(updatedProfile || {}), company_logo_url: updatedProfile?.company_logo_url || fileUrl }))
        setMessage({ tone: 'success', text: t('cp.msg.logoUploaded') })
      } else {
        const updated = await updateProfileImage(fileUrl)
        dispatch(mergeUser(updated?.user || updated || { profile_image_url: fileUrl }))
        setProfile((currentProfile) => ({ ...(currentProfile || {}), profile_image_url: fileUrl }))
        setMessage({ tone: 'success', text: t('dash.msg.profileImageUpdated') })
      }
    } catch (error) {
      setMessage({ tone: 'error', text: apiErrorText(error, t('cps.uploadFailed')) })
    } finally {
      setUploading('')
    }
  }

  // ---- Portfolio (completed projects) ---------------------------------------
  const portfolio = form.completed_project_details
  const setPortfolio = (next) => update('completed_project_details', next)
  const updateProject = (index, field, value) => setPortfolio(portfolio.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  const addProject = () => {
    if (portfolio.length >= PORTFOLIO_MAX_PROJECTS) return
    setPortfolio([...portfolio, { title: '', location: '', description: '', images: [] }])
  }
  const removeProject = (index) => setPortfolio(portfolio.filter((_, i) => i !== index))
  async function addProjectImage(index) {
    if ((portfolio[index]?.images || []).length >= PORTFOLIO_MAX_IMAGES) return
    const asset = await pickImage(null, t)
    if (!asset) return
    setUploading(`portfolio-${index}`)
    try {
      const fileUrl = uploadedUrl(await uploadLocalFile(asset, 'portfolio.jpg'))
      // Functional update: text typed while the photo uploaded is kept.
      setForm((current) => ({
        ...current,
        completed_project_details: current.completed_project_details.map((item, i) => (
          i === index ? { ...item, images: [...(item.images || []), fileUrl].slice(0, PORTFOLIO_MAX_IMAGES) } : item
        )),
      }))
    } catch (error) {
      setMessage({ tone: 'error', text: apiErrorText(error, t('cps.uploadFailed')) })
    } finally {
      setUploading('')
    }
  }
  const removeProjectImage = (index, url) => setPortfolio(portfolio.map((item, i) => (i === index ? { ...item, images: item.images.filter((image) => image !== url) } : item)))

  function confirmDelete() {
    Alert.alert(
      t('account.deleteTitle'),
      t('account.deleteBody'),
      [
        { text: t('dash.common.cancel'), style: 'cancel' },
        {
          text: t('account.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              await deleteOwnAccount()
              dispatch(logoutUser())
            } catch (error) {
              setDeleting(false)
              Alert.alert(t('account.delete'), apiErrorText(error, t('account.deleteFailed')))
            }
          },
        },
      ],
    )
  }

  const photoUrl = profile?.profile_image_url || user?.profile_image_url
  const logoUrl = profile?.company_logo_url

  return (
    <StackScreenShell title={t('ui.profileSettings')} subtitle={t('ps.con.builderProfile')} onBack={() => navigation.goBack()} refreshing={loading && !!profile} onRefresh={load}>
      <Section><Notice tone={message?.tone} text={message?.text} /></Section>
      <Panel title={t('mobile.account.settings.photoAndLogo')}>
        <PanelState loading={loading && !profile} error={loadError} empty={false}>
          <View className="flex-row justify-around">
            {[
              ['photo', t('ps.eng.profilePhoto'), photoUrl],
              ['logo', t('ps.con.companyLogo'), logoUrl],
            ].map(([kind, label, url]) => (
              <Pressable key={kind} onPress={() => changePhoto(kind)} disabled={Boolean(uploading) || !profile} className="items-center">
                <View className={`h-20 w-20 overflow-hidden rounded-full bg-brand-100 ${uploading === kind ? 'opacity-50' : ''}`}>
                  {url ? (
                    <Image source={{ uri: imageUrl(url) }} style={{ width: 80, height: 80 }} contentFit="cover" />
                  ) : (
                    <View className="h-full w-full items-center justify-center">
                      {kind === 'logo' ? <Building2 size={26} color={COLORS.brand[700]} /> : <Text className="text-2xl font-extrabold text-brand-800">{(user?.name || 'B').slice(0, 1).toUpperCase()}</Text>}
                    </View>
                  )}
                </View>
                <View className="-mt-5 ml-14 h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-700">
                  <Camera size={13} color="#fff" />
                </View>
                <Text className="mt-1 text-xs font-bold text-slate-600">{label}</Text>
              </Pressable>
            ))}
          </View>
        </PanelState>
      </Panel>

      <Panel title={t('cps.personalInformation')}>
        <LabeledInput label={`${t('ps.name')} *`} value={form.name} onChangeText={(value) => update('name', value)} />
        <LabeledInput label={t('ps.phoneShort')} value={form.phone} onChangeText={(value) => update('phone', value)} keyboardType="phone-pad" />
        <LabeledInput label={t('ps.address')} value={form.address} onChangeText={(value) => update('address', value)} />
        <LabeledInput label={t('ps.pincode')} value={form.pincode} onChangeText={(value) => update('pincode', value.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} />
        <Text className="text-[11px] font-semibold text-slate-400">{t('ps.email')}: {user?.email || '—'}</Text>
      </Panel>

      <Panel title={t('cps.professionalInformation')}>
        <LabeledInput label={t('ps.con.companyName')} value={form.company_name} onChangeText={(value) => update('company_name', value)} />
        <Text className="mb-1.5 text-xs font-bold text-slate-600">{t('ps.businessType')}</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
          {BUSINESS_TYPES.map((item) => {
            const on = form.business_type === item
            return (
              <Pressable key={item} onPress={() => update('business_type', on ? '' : item)} className={`rounded-full px-3 py-1.5 ${on ? 'bg-brand-700' : 'border border-slate-200 bg-white'}`}>
                <Text className={`text-[11px] font-extrabold ${on ? 'text-white' : 'text-slate-600'}`}>{optionLabel(t, BUSINESS_TYPE_KEYS, item)}</Text>
              </Pressable>
            )
          })}
        </View>
        <LabeledInput label={t('ps.con.licenseNumber')} value={form.license_number} onChangeText={(value) => update('license_number', value)} autoCapitalize="characters" />
        <LabeledInput label={t('ps.gstin')} value={form.gstin} onChangeText={(value) => update('gstin', value.toUpperCase())} autoCapitalize="characters" />
        <LabeledInput label={t('ps.pan')} value={form.pan} onChangeText={(value) => update('pan', value.toUpperCase())} autoCapitalize="characters" maxLength={10} />
        <LabeledInput label={t('ps.website')} value={form.website} onChangeText={(value) => update('website', value)} autoCapitalize="none" keyboardType="url" />
        <LabeledInput label={t('ps.registrationYear')} value={form.registration_year} onChangeText={(value) => update('registration_year', value.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={4} />
        <LabeledInput label={t('cps.yearsOfExperience')} value={form.experience_years} onChangeText={(value) => update('experience_years', value.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={2} />
        <LabeledInput label={t('ps.con.teamSize')} value={form.team_size} onChangeText={(value) => update('team_size', value)} />
        <View className="mb-3 flex-row items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
          <Text className="text-[13px] font-bold text-slate-700">{t('cps.insuranceAvailable')}</Text>
          <Switch value={form.insurance_available} onValueChange={(value) => update('insurance_available', value)} trackColor={{ true: COLORS.brand[500] }} />
        </View>
        <LabeledInput label={t('ps.eng.about')} value={form.about} onChangeText={(value) => update('about', value)} multiline maxLength={2000} />
      </Panel>

      <Panel title={t('cps.servicesWork')}>
        <ChipPicker label={t('ps.con.servicesOffered')} options={SERVICE_OPTIONS} labelKeys={SERVICE_OPTION_KEYS} value={form.services_offered} onChange={(value) => update('services_offered', value)} />
        <ChipPicker label={t('ps.con.equipmentOwned')} options={EQUIPMENT_OPTIONS} labelKeys={EQUIPMENT_OPTION_KEYS} value={form.equipment_owned} onChange={(value) => update('equipment_owned', value)} />
        <LabeledInput label={t('ps.con.serviceLocations')} hint={t('cps.serviceLocationsHint')} value={form.service_locations} onChangeText={(value) => update('service_locations', value)} />
      </Panel>

      <Panel
        title={`${t('cps.completedProjects')} (${portfolio.length}/${PORTFOLIO_MAX_PROJECTS})`}
        action={portfolio.length < PORTFOLIO_MAX_PROJECTS ? <ActionButton small tone="brandOutline" icon={Plus} label={t('cps.portfolio.add')} onPress={addProject} /> : null}
      >
        {!portfolio.length ? <Text className="text-[13px] font-semibold text-slate-400">{t('cps.portfolio.empty')}</Text> : null}
        {portfolio.map((item, index) => (
          <View key={`portfolio-${index}`} className="mb-3 rounded-2xl border border-slate-200 p-3">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-xs font-extrabold text-slate-500">{t('ui.requests.project', { n: index + 1 })}</Text>
              <Pressable onPress={() => removeProject(index)} accessibilityLabel={t('shop.remove')}><Trash2 size={16} color="#e11d48" /></Pressable>
            </View>
            <LabeledInput label={t('dash.owner.projectForm.titlePh')} value={item.title} onChangeText={(value) => updateProject(index, 'title', value)} />
            <LabeledInput label={t('ps.location')} value={item.location} onChangeText={(value) => updateProject(index, 'location', value)} />
            <LabeledInput label={t('dash.common.description')} value={item.description} onChangeText={(value) => updateProject(index, 'description', value)} multiline />
            <View className="flex-row flex-wrap gap-2">
              {(item.images || []).map((url) => (
                <Pressable key={url} onLongPress={() => removeProjectImage(index, url)} onPress={() => removeProjectImage(index, url)} className="h-16 w-16 overflow-hidden rounded-lg bg-slate-100">
                  <Image source={{ uri: imageUrl(url) }} style={{ width: 64, height: 64 }} contentFit="cover" />
                </Pressable>
              ))}
              {(item.images || []).length < PORTFOLIO_MAX_IMAGES ? (
                <Pressable onPress={() => addProjectImage(index)} disabled={Boolean(uploading)} className={`h-16 w-16 items-center justify-center rounded-lg border border-dashed border-brand-300 bg-brand-50 ${uploading === `portfolio-${index}` ? 'opacity-50' : ''}`}>
                  <ImagePlus size={18} color={COLORS.brand[700]} />
                </Pressable>
              ) : null}
            </View>
            {(item.images || []).length ? <Text className="mt-1 text-[10px] text-slate-400">{t('mobile.account.tapPhotoToRemove')}</Text> : null}
          </View>
        ))}
        <Text className="text-[11px] font-semibold text-slate-400">{t('mobile.account.settings.savedWithProfile')}</Text>
      </Panel>

      <Section>
        <ActionButton label={saving ? t('dash.common.saving') : t('dash.engineer.saveProfile')} busy={saving} disabled={loading || !profile || Boolean(uploading)} onPress={save} />
      </Section>

      <Panel title={t('account.delete')}>
        <Text className="mb-3 text-xs font-semibold text-slate-500">{t('account.deleteSub')}</Text>
        <ActionButton label={t('account.delete')} tone="danger" icon={Trash2} busy={deleting} onPress={confirmDelete} />
      </Panel>
    </StackScreenShell>
  )
}