// Port of the web ProjectForm (pages/owner/ownerProjectViews.jsx): the Create
// Project form and, beside it on the web / below it here, Get Estimate.
//
// The rules are the web's, unchanged:
//   - Location runs Country -> State -> Pincode -> Postal branch -> City ->
//     Address. For India the State, branch and City must all be the pincode's
//     own, as India Post reports it; a mismatch is shown in red and blocks Create.
//   - Both dates are required, end not before start.
//   - An estimate is sent only if the owner accepted it ("Yes"); otherwise the
//     project is created without one.
// Created projects open straight away on their own page.
import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView } from 'react-native'
import { useSelector } from 'react-redux'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { Calculator, Globe2, House as Home, ImagePlus, X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenHeader from '../../components/ScreenHeader'
import { Panel, InsetArea } from '../../components/DashboardShell'
import { ContentWrap } from '../../components/Responsive'
import { PrimaryButton } from '../../components/ui'
import {
  BudgetInWords, DateField, FormNotice, PincodeAreaHint, SelectField, TextField,
} from '../../components/form'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { usePincodeAreaLookup } from '../../hooks/usePincodeAreaLookup'
import { createProjectRequest } from '../../api/projects'
import { calculatePublicEstimate } from '../../api/estimates'
import { PROJECT_COUNTRIES, projectCityOptions, projectStateOptions } from '../../utils/projectLocations'
import { floorCountFor, floorOptionsForCountry, floorTypeLabel } from '../../utils/floorOptions'
import { userCountry } from '../../utils/countryConfig'
import { COLORS } from '../../theme/tokens'
import { apiDetail, countryText, money, projectScheduleProblem } from './ownerHelpers'
import { createStyles } from '../../theme/createStyles'

// Two place names are the same place when they differ only in case, spacing,
// punctuation or "&" for "and" ("Jammu & Kashmir" / "Jammu and Kashmir").
function placeKey(value) {
  return String(value || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '')
}
function samePlace(a, b) {
  return Boolean(placeKey(a)) && placeKey(a) === placeKey(b)
}
// India Post still spells a few states and union territories by older names.
const INDIA_POST_STATE_NAMES = {
  chattisgarh: ['Chhattisgarh'],
  pondicherry: ['Puducherry'],
  andamanandnicobar: ['Andaman and Nicobar Islands'],
  dadraandnagarhaveli: ['Dadra and Nagar Haveli and Daman and Diu'],
  damananddiu: ['Dadra and Nagar Haveli and Daman and Diu'],
  // Ladakh's pincodes are still filed under Jammu & Kashmir.
  jammuandkashmir: ['Jammu and Kashmir', 'Ladakh'],
}
function sameState(indiaPostState, formState) {
  return samePlace(indiaPostState, formState)
    || (INDIA_POST_STATE_NAMES[placeKey(indiaPostState)] || []).some((name) => samePlace(name, formState))
}
function uniquePlaces(values) {
  const seen = new Map()
  values.filter(Boolean).forEach((value) => { if (!seen.has(placeKey(value))) seen.set(placeKey(value), value) })
  return [...seen.values()]
}

const emptyProject = (country) => ({
  title: '',
  description: '',
  address: '',
  pincode: '',
  project_country: country,
  project_state: '',
  project_city: '',
  building_type: 'RESIDENTIAL',
  construction_type: 'CONTRACTOR',
  budget: '',
  land_area: '',
  floors: 1,
  floor_type: '',
  start_date: '',
  end_date: '',
})

function numericText(value) {
  // Digits and one decimal point, the way <input type="number"> accepts them.
  const cleaned = String(value).replace(/[^0-9.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  return rest.length ? `${whole}.${rest.join('')}` : whole
}

export default function CreateProjectScreen({ navigation }) {
  // Full-screen pages draw under the Android navigation buttons; keep the end clear of them.
  const insets = useSafeAreaInsets()
  const { t, td } = useLanguage()
  const { gutter, isTablet } = useResponsive()
  const user = useSelector((state) => state.auth.user)
  const defaultCountry = userCountry(user)

  const [projectDetails, setProjectDetails] = useState(() => emptyProject(defaultCountry))
  const [projectFormMessage, setProjectFormMessage] = useState({ text: '', tone: 'error' })
  // The estimate belongs to this draft only; only an accepted one is sent.
  const [finishingType, setFinishingType] = useState('standard')
  const [estimateResult, setEstimateResult] = useState(null)
  const [acceptedEstimate, setAcceptedEstimate] = useState(null)
  const [isEstimating, setIsEstimating] = useState(false)
  const [estimateMessage, setEstimateMessage] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [projectImage, setProjectImage] = useState(null)
  const [selectedPincodeBranch, setSelectedPincodeBranch] = useState(null)
  const [showLocationErrors, setShowLocationErrors] = useState(false)
  // City and Address the pincode filled in (not chosen by the owner). Those
  // follow the pincode and are cleared when it changes.
  const cityFromPincodeRef = useRef(false)
  const autoAddressRef = useRef('')
  const scrollRef = useRef(null)

  const updateProjectField = (field, value) => {
    setProjectDetails((current) => ({ ...current, [field]: value }))
  }

  const staleLocationReset = () => {
    const reset = {}
    if (cityFromPincodeRef.current) reset.project_city = ''
    if (autoAddressRef.current && projectDetails.address === autoAddressRef.current) reset.address = ''
    cityFromPincodeRef.current = false
    autoAddressRef.current = ''
    return reset
  }

  const handleCountryChange = (country) => {
    const reset = staleLocationReset()
    setSelectedPincodeBranch(null)
    setProjectDetails((current) => ({ ...current, ...reset, project_country: country, project_state: '', project_city: '' }))
  }

  const handleStateChange = (state) => {
    const reset = staleLocationReset()
    setSelectedPincodeBranch(null)
    setProjectDetails((current) => ({ ...current, ...reset, project_state: state, project_city: '' }))
  }

  const handlePincodeChange = (pincode) => {
    const reset = staleLocationReset()
    setSelectedPincodeBranch(null)
    setProjectDetails((current) => ({ ...current, ...reset, pincode }))
  }

  const handleCityChange = (city) => {
    cityFromPincodeRef.current = false
    updateProjectField('project_city', city)
  }

  // Picking a postal branch fills City from it, and Address too unless the
  // owner has typed their own.
  const selectPincodeBranch = (branch) => {
    const addressIsOwn = Boolean(String(projectDetails.address || '').trim()) && projectDetails.address !== autoAddressRef.current
    if (!addressIsOwn) autoAddressRef.current = branch.display
    if (branch.city) cityFromPincodeRef.current = true
    setSelectedPincodeBranch(branch)
    setProjectDetails((current) => ({
      ...current,
      project_city: branch.city || current.project_city,
      address: addressIsOwn ? current.address : branch.display,
    }))
  }

  const applyResolvedArea = useCallback((areaDetails) => {
    setProjectDetails((current) => {
      // A resolved Kuwait postal code means the project is in Kuwait.
      if (areaDetails.country === 'Kuwait') {
        return {
          ...current,
          address: areaDetails.display || current.address,
          pincode: areaDetails.pincode || current.pincode,
          project_country: 'Kuwait',
          project_state: areaDetails.state || current.project_state,
          project_city: areaDetails.city || current.project_city,
        }
      }
      // India: the State is only filled in when none was chosen yet; a chosen
      // State is checked against the pincode, never overwritten.
      const branches = Array.isArray(areaDetails.post_offices) ? areaDetails.post_offices : []
      const lookupStateNames = uniquePlaces(branches.map((branch) => branch.state))
      const matchingState = current.project_state
        ? ''
        : projectStateOptions('India').find((state) => lookupStateNames.some((name) => sameState(name, state))) || ''
      return {
        ...current,
        pincode: areaDetails.pincode || current.pincode,
        ...(matchingState ? { project_state: matchingState } : {}),
      }
    })
  }, [])
  const pincodeLookupState = usePincodeAreaLookup(projectDetails.pincode, applyResolvedArea, projectDetails.project_country)

  const isIndiaProject = (projectDetails.project_country || defaultCountry) === 'India'
  const lookupBranches = isIndiaProject && pincodeLookupState.status === 'success' ? pincodeLookupState.branches || [] : []
  const lookupStates = uniquePlaces(lookupBranches.map((branch) => branch.state))
  const lookupCities = uniquePlaces(lookupBranches.map((branch) => branch.city))
  const stateMismatch = lookupBranches.length > 0 && Boolean(projectDetails.project_state)
    && !lookupStates.some((state) => sameState(state, projectDetails.project_state))
  const branchMismatch = Boolean(selectedPincodeBranch) && lookupBranches.length > 0
    && !lookupBranches.some((branch) => branch.name === selectedPincodeBranch.name && branch.pincode === selectedPincodeBranch.pincode)
  const cityMismatch = lookupBranches.length > 0 && Boolean(projectDetails.project_city)
    && !lookupCities.some((city) => samePlace(city, projectDetails.project_city))
  const branchesSelectable = lookupBranches.length > 0 && Boolean(projectDetails.project_state) && !stateMismatch
  const missingState = isIndiaProject && showLocationErrors && !projectDetails.project_state
  const missingBranch = isIndiaProject && showLocationErrors && branchesSelectable && !selectedPincodeBranch
  const missingCity = isIndiaProject && showLocationErrors && !projectDetails.project_city
  const cityOptions = lookupBranches.length > 0
    ? [...lookupCities, ...(projectDetails.project_city && cityMismatch ? [projectDetails.project_city] : [])]
    : projectCityOptions(projectDetails.project_country, projectDetails.project_state)

  // A pincode with a single branch has nothing to choose between.
  const onlyBranch = branchesSelectable && lookupBranches.length === 1 ? lookupBranches[0] : null
  useEffect(() => {
    if (onlyBranch && !selectedPincodeBranch) selectPincodeBranch(onlyBranch)
    // selectPincodeBranch only writes state; listing it would re-run every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyBranch, selectedPincodeBranch])

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (!result.canceled && result.assets?.[0]) setProjectImage(result.assets[0])
  }

  // Always the values in the form right now, so asking again after a change
  // returns a figure for the new values.
  const requestEstimate = async () => {
    setEstimateMessage('')
    const plotArea = Number(projectDetails.land_area || 0)
    if (plotArea <= 0) {
      setEstimateMessage(t('cp.val.landArea'))
      return
    }
    setIsEstimating(true)
    setAcceptedEstimate(null)
    try {
      const country = projectDetails.project_country || defaultCountry
      setEstimateResult(await calculatePublicEstimate({
        country,
        location: [projectDetails.project_city, projectDetails.project_state].filter(Boolean).join(', '),
        pincode: projectDetails.pincode,
        plot_area: plotArea,
        floors: floorCountFor(country, projectDetails.floor_type, projectDetails.floors === '' ? 1 : projectDetails.floors),
        floor_type: projectDetails.floor_type || null,
        construction_type: projectDetails.construction_type,
        building_type: projectDetails.building_type,
        finishing_type: finishingType,
        budget: Number(projectDetails.budget || 0),
      }))
    } catch (error) {
      setEstimateResult(null)
      setEstimateMessage(apiDetail(error, t('site.estimate.errCalc')))
    } finally {
      setIsEstimating(false)
    }
  }

  const showFormMessage = (text, tone = 'error') => {
    setProjectFormMessage({ text, tone })
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }

  const submitProject = async () => {
    setProjectFormMessage({ text: '', tone: 'error' })
    if (!projectDetails.title.trim() || !projectDetails.description.trim() || !projectDetails.address.trim() || !projectDetails.pincode.trim()) {
      showFormMessage(t('cp.val.completeFields'))
      return
    }
    // An Indian pincode must be one India Post knows and maps to a district and state.
    if (isIndiaProject && pincodeLookupState.status !== 'success') {
      const pincodeMessageKeys = {
        loading: 'location.fetching',
        unknown: 'location.unknown',
        unmapped: 'location.unmapped',
        unavailable: 'location.unavailable',
      }
      showFormMessage(t(pincodeMessageKeys[pincodeLookupState.status] || 'location.invalid'))
      return
    }
    // ...and the State, Postal branch and City must all be the pincode's own.
    if (isIndiaProject) {
      const locationProblem = stateMismatch ? 'location.stateMismatch'
        : branchMismatch ? 'location.branchMismatch'
          : cityMismatch ? 'location.cityMismatch'
            : (!projectDetails.project_state || !selectedPincodeBranch || !projectDetails.project_city) ? 'location.selectValid'
              : ''
      if (locationProblem) {
        setShowLocationErrors(true)
        showFormMessage(t(locationProblem))
        return
      }
    }
    const scheduleProblem = projectScheduleProblem(projectDetails.start_date, projectDetails.end_date)
    if (scheduleProblem) {
      showFormMessage(t(scheduleProblem))
      return
    }
    setIsCreatingProject(true)

    const projectPayload = {
      title: projectDetails.title.trim(),
      description: projectDetails.description.trim(),
      address: projectDetails.address.trim(),
      pincode: projectDetails.pincode.trim(),
      project_country: projectDetails.project_country || defaultCountry,
      project_state: projectDetails.project_state || '',
      project_city: projectDetails.project_city || '',
      building_type: projectDetails.building_type,
      construction_type: projectDetails.construction_type,
      budget: projectDetails.budget === '' ? 0 : Number(projectDetails.budget),
      land_area: projectDetails.land_area === '' ? 0 : Number(projectDetails.land_area),
      floors: floorCountFor(projectDetails.project_country, projectDetails.floor_type, projectDetails.floors === '' ? 1 : projectDetails.floors),
      floor_type: projectDetails.floor_type || null,
      start_date: projectDetails.start_date,
      end_date: projectDetails.end_date,
      ...(acceptedEstimate ? {
        estimated_cost: acceptedEstimate.estimated_cost,
        estimated_duration_days: acceptedEstimate.estimated_duration_days,
        material_estimate: acceptedEstimate.material_estimate,
        labour_estimate: acceptedEstimate.labour_estimate,
      } : {}),
    }

    try {
      let payload = projectPayload
      if (projectImage) {
        // Multipart, as the web sends it; RN's FormData takes the file as {uri, name, type}.
        payload = new FormData()
        Object.entries(projectPayload).forEach(([key, value]) => {
          if (value !== null && value !== undefined) payload.append(key, String(value))
        })
        const name = projectImage.fileName || projectImage.uri.split('/').pop() || 'project.jpg'
        payload.append('image', { uri: projectImage.uri, name, type: projectImage.mimeType || 'image/jpeg' })
      }
      const createdProject = await createProjectRequest(payload)
      if (createdProject?.id) {
        navigation.replace('OwnerProject', { projectId: createdProject.id, created: true })
      } else {
        navigation.goBack()
      }
    } catch (error) {
      showFormMessage(apiDetail(error, t('dash.owner.projectForm.createError')))
    } finally {
      setIsCreatingProject(false)
    }
  }

  const estimateCountry = projectDetails.project_country || defaultCountry
  const estimateRows = estimateResult ? [
    [t('site.estimate.result.total'), money(estimateResult.estimated_cost, estimateCountry)],
    [t('site.estimate.result.perSqft'), money(estimateResult.rate_per_sqft, estimateCountry)],
    [t('site.estimate.result.builtUp'), `${Number(estimateResult.built_up_area || 0).toLocaleString('en-IN')} ${t('dash.owner.profile.sqFt')}`],
    [t('site.estimate.result.materials'), money(estimateResult.material_estimate, estimateCountry)],
    [t('site.estimate.result.labour'), money(estimateResult.labour_estimate, estimateCountry)],
    [t('site.estimate.result.duration'), t('site.estimate.result.days', { days: estimateResult.estimated_duration_days })],
  ] : []

  const isKuwait = projectDetails.project_country === 'Kuwait'
  const twoUp = isTablet ? { flexDirection: 'row', gap: 12 } : null
  const half = isTablet ? { flex: 1 } : null

  return (
    <View style={styles.view}>
      <ScreenHeader title={t('dash.common.createProject')} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 40 + insets.bottom }}
        >
          <ContentWrap>
          <InsetArea>
            <FormNotice message={projectFormMessage.text} tone={projectFormMessage.tone} style={{ marginBottom: 12 }} />

            <Panel title={t('dash.owner.projectForm.location')}>
              <View style={[styles.view2, { gap: 6 }]}>
                <Globe2 size={14} color={COLORS.brand[600]} />
                <Text style={[styles.text, { fontSize: 12 }]}>
                  {t('dash.owner.projectForm.where')}
                </Text>
              </View>
              <View style={twoUp}>
                <SelectField
                  containerStyle={half}
                  label={t('dash.owner.projectDetails.projectCountry')}
                  value={projectDetails.project_country}
                  onChange={(value) => value && handleCountryChange(value)}
                  options={PROJECT_COUNTRIES.map((country) => ({ value: country.value, label: countryText(country.value, t) || country.label }))}
                />
                <SelectField
                  containerStyle={half}
                  label={t('location.state')}
                  value={projectDetails.project_state}
                  onChange={handleStateChange}
                  placeholder={isKuwait ? t('dash.owner.projectForm.governorate') : t('dash.owner.projectForm.selectState')}
                  // The stored value stays the English place name; only the label follows the language.
                  options={projectStateOptions(projectDetails.project_country).map((state) => ({ value: state, label: td(state) }))}
                  invalid={stateMismatch || missingState}
                />
              </View>
              <TextField
                label={t('dash.common.pincode')}
                value={projectDetails.pincode}
                onChangeText={handlePincodeChange}
                placeholder={t('dash.common.pincode')}
                keyboardType="number-pad"
                maxLength={isIndiaProject ? 6 : 5}
                invalid={stateMismatch}
                error={stateMismatch ? t('location.stateMismatch') : ''}
              />
              {/* Every branch under the pincode until one is chosen (the
                  choice then shows in the Postal branch field); outside India,
                  the lookup line. */}
              {(!isIndiaProject || pincodeLookupState.status !== 'success' || (branchesSelectable && !selectedPincodeBranch)) ? (
                <PincodeAreaHint
                  lookupState={pincodeLookupState}
                  selectedBranch={selectedPincodeBranch}
                  onSelectBranch={selectPincodeBranch}
                />
              ) : null}
              <View style={twoUp}>
                {isIndiaProject ? (
                  <SelectField
                    containerStyle={half}
                    label={t('location.branch')}
                    value={selectedPincodeBranch?.name || ''}
                    onChange={(name) => {
                      const branch = lookupBranches.find((item) => item.name === name)
                      if (branch) selectPincodeBranch(branch)
                    }}
                    placeholder={t('location.selectBranch')}
                    disabled={!branchesSelectable}
                    options={(branchesSelectable ? lookupBranches : []).map((branch) => ({ value: branch.name, label: td(branch.name) }))}
                    invalid={branchMismatch || missingBranch}
                    error={branchMismatch ? t('location.branchMismatch') : ''}
                  />
                ) : null}
                <SelectField
                  containerStyle={half}
                  label={t('location.city')}
                  value={projectDetails.project_city}
                  onChange={handleCityChange}
                  placeholder={isKuwait ? t('dash.owner.projectForm.area') : t('dash.owner.projectForm.selectCity')}
                  disabled={!projectDetails.project_state}
                  options={cityOptions.map((city) => ({ value: city, label: td(city) }))}
                  invalid={cityMismatch || missingCity}
                  error={cityMismatch ? t('location.cityMismatch') : ''}
                />
              </View>
              <TextField
                label={t('dash.common.address')}
                value={projectDetails.address}
                onChangeText={(value) => updateProjectField('address', value)}
                placeholder={t('dash.owner.projectForm.addressPh')}
              />
            </Panel>

            <Panel title={t('dash.common.createProject')}>
              <TextField
                label={t('dash.common.projectName')}
                value={projectDetails.title}
                onChangeText={(value) => updateProjectField('title', value)}
                placeholder={t('dash.owner.projectForm.titlePh')}
              />
              <TextField
                label={t('dash.common.description')}
                value={projectDetails.description}
                onChangeText={(value) => updateProjectField('description', value)}
                placeholder={t('dash.owner.projectForm.descriptionPh')}
                multiline
              />

              <Pressable
                onPress={pickImage}
                accessibilityRole="button"
                style={[styles.pressable, { minHeight: 112 }]}
              >
                {projectImage ? (
                  <View style={{ width: '100%', height: 150 }}>
                    <Image source={{ uri: projectImage.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    <Pressable
                      onPress={() => setProjectImage(null)}
                      accessibilityLabel={t('dash.common.delete')}
                      style={styles.pressable2}
                    >
                      <X size={14} color="#ffffff" />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.view3}>
                    <ImagePlus size={22} color={COLORS.brand[600]} />
                    <Text style={[styles.text2, { fontSize: 13 }]}>
                      {t('dash.owner.projectForm.uploadImage')}
                    </Text>
                    <Text style={[styles.text3, { fontSize: 11.5 }]}>
                      {t('dash.owner.projectForm.imageNote')}
                    </Text>
                  </View>
                )}
              </Pressable>

              <View style={twoUp}>
                <SelectField
                  containerStyle={half}
                  label={t('dash.common.constructionType')}
                  value={projectDetails.construction_type}
                  onChange={(value) => value && updateProjectField('construction_type', value)}
                  options={[
                    { value: 'CONTRACTOR', label: t('dash.owner.projectForm.hireBuilder') },
                    { value: 'SELF_CONSTRUCTION', label: t('dash.owner.profile.selfConstruction') },
                  ]}
                />
                <SelectField
                  containerStyle={half}
                  label={t('dash.common.buildingType')}
                  value={projectDetails.building_type}
                  onChange={(value) => value && updateProjectField('building_type', value)}
                  options={[
                    { value: 'RESIDENTIAL', label: t('dash.common.residential') },
                    { value: 'COMMERCIAL', label: t('dash.common.commercial') },
                  ]}
                />
              </View>
              <View style={twoUp}>
                <TextField
                  containerStyle={half}
                  label={t('dash.common.landArea')}
                  value={String(projectDetails.land_area)}
                  onChangeText={(value) => updateProjectField('land_area', numericText(value))}
                  placeholder={t('dash.owner.projectForm.plotAreaPh')}
                  keyboardType="decimal-pad"
                />
                <SelectField
                  containerStyle={half}
                  label={t('dash.common.floors')}
                  value={projectDetails.floor_type || ''}
                  onChange={(value) => updateProjectField('floor_type', value)}
                  placeholder={t('cps.selectField', { label: t('dash.common.floors') })}
                  options={floorOptionsForCountry(projectDetails.project_country).map((option) => ({ value: option.value, label: floorTypeLabel(option.value) }))}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <DateField
                  containerStyle={{ flex: 1 }}
                  label={t('dash.owner.projectDetails.startDate')}
                  value={projectDetails.start_date}
                  max={projectDetails.end_date || undefined}
                  onChange={(value) => updateProjectField('start_date', value)}
                />
                <DateField
                  containerStyle={{ flex: 1 }}
                  label={t('dash.owner.projectDetails.endDate')}
                  value={projectDetails.end_date}
                  min={projectDetails.start_date || undefined}
                  onChange={(value) => updateProjectField('end_date', value)}
                />
              </View>
              <TextField
                label={t('dash.common.budget')}
                value={String(projectDetails.budget)}
                onChangeText={(value) => updateProjectField('budget', numericText(value))}
                placeholder={t('dash.common.budget')}
                keyboardType="decimal-pad"
              />
              <BudgetInWords value={projectDetails.budget} country={estimateCountry} />
            </Panel>

            {/* Get Estimate reads the form above and writes only to this draft. */}
            <Panel title={t('dash.owner.projectForm.getEstimate')}>
              <SelectField
                label={t('site.estimate.finishing')}
                value={finishingType}
                onChange={(value) => value && setFinishingType(value)}
                options={[
                  { value: 'standard', label: t('site.estimate.finStd') },
                  { value: 'premium', label: t('site.estimate.finPrem') },
                ]}
              />
              <Pressable
                onPress={requestEstimate}
                disabled={isEstimating}
                accessibilityRole="button"
                style={[styles.pressable3, isEstimating ? styles.pressable4 : null, { gap: 8 }]}
              >
                <Calculator size={16} color="#ffffff" />
                <Text style={[styles.text4, { fontSize: 13.5 }]}>
                  {isEstimating ? t('site.estimate.calculating') : t('dash.owner.projectForm.getEstimate')}
                </Text>
              </Pressable>
              <FormNotice message={estimateMessage} tone="error" style={{ marginTop: 10 }} />

              {estimateResult ? (
                <View style={styles.view4}>
                  {estimateRows.map(([label, value]) => (
                    <View key={label} style={[styles.view5, { gap: 12 }]}>
                      <Text style={[styles.text, { fontSize: 12 }]}>{label}</Text>
                      <Text style={[styles.text5, { fontSize: 13 }]}>{value}</Text>
                    </View>
                  ))}
                  {acceptedEstimate ? (
                    <View style={[styles.view6, { gap: 6 }]}>
                      <View style={styles.view7} />
                      <Text style={[styles.text6, { fontSize: 11 }]}>{t('ui.status.accepted')}</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.text7, { fontSize: 12 }]}>
                        {t('dash.owner.projectForm.applyEstimate')}
                      </Text>
                      <View style={[styles.view8, { gap: 8 }]}>
                        <Pressable onPress={() => setAcceptedEstimate(estimateResult)} style={styles.pressable5}>
                          <Text style={[styles.text4, { fontSize: 12.5 }]}>{t('dash.common.yes')}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setAcceptedEstimate(null)
                            setEstimateResult(null)
                          }}
                          style={styles.pressable6}
                        >
                          <Text style={[styles.text8, { fontSize: 12.5 }]}>{t('dash.common.no')}</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              ) : null}
            </Panel>

            <PrimaryButton
              label={isCreatingProject ? t('dash.owner.projectForm.creating') : t('dash.owner.projectForm.create')}
              onPress={submitProject}
              loading={isCreatingProject}
              disabled={isCreatingProject}
              icon={<Home size={16} color="#ffffff" />}
              full
            />
          </InsetArea>
          </ContentWrap>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1, backgroundColor: c.canvas },
  view2: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, fontFamily: 'Inter_400Regular', color: c.textMuted },
  pressable: { marginBottom: 10.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 10.5, borderWidth: 1, borderStyle: 'dashed', borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft },
  pressable2: { position: 'absolute', right: 7, top: 7, borderRadius: 9999, backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 5.25 },
  view3: { alignItems: 'center', paddingHorizontal: 10.5, paddingVertical: 14 },
  text2: { marginTop: 5.25, textAlign: 'center', fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  text3: { marginTop: 1.75, textAlign: 'center', fontFamily: 'Inter_400Regular', color: c.textFaint },
  pressable3: { height: 38.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  pressable4: { opacity: 0.6 },
  text4: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  view4: { marginTop: 10.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 10.5 },
  view5: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 3.5 },
  text5: { fontFamily: 'Inter_700Bold', color: c.text },
  view6: { marginTop: 10.5, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 9999, backgroundColor: c.emeraldSoft, paddingHorizontal: 10.5, paddingVertical: 3.5 },
  view7: { height: 5.25, width: 5.25, borderRadius: 9999, backgroundColor: '#10b981' },
  text6: { fontFamily: 'Inter_700Bold', color: c.emeraldText },
  text7: { marginTop: 10.5, fontFamily: 'Inter_700Bold', color: c.text },
  view8: { marginTop: 7, flexDirection: 'row' },
  pressable5: { height: 31.5, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#1a5038' },
  pressable6: { height: 31.5, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  text8: { fontFamily: 'Inter_700Bold', color: c.textMuted },
}))
