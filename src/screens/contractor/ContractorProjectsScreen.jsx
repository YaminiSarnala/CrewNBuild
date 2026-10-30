// Port of web contractorProjectViews.jsx (ContractorProjectsTable +
// ContractorProjectDetail). Same data: fetchOwnerProjects (backend scopes to
// the contractor's assigned projects), per-project engineer + suppliers,
// timeline entries for Activity, escrow_milestones for Payments.
// Visible text uses the web's keys (dash.*, team.*, specialist.*, se.*, owner.pa.*) via t().
import { useCallback, useEffect, useState } from 'react'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import * as ImagePicker from 'expo-image-picker'
import {
  analysisFigures,
  budgetRows,
  materialRows,
  recentExpenses,
  spendingTrend,
  workItemProgress,
} from '../../utils/ownerProjectAnalysis'
import { View, Text, Pressable, ScrollView, Alert, TextInput } from 'react-native'
import { ChevronLeft, HardHat, MapPin, CalendarDays, UserPlus, X, Truck, Users } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import {
  fetchBuilderProjectsWithAssignments,
  fetchProjectTimelineEntries,
  updateProjectProgress,
  saveTimelineUpdate,
  saveDailyWorkflow,
} from '../../api/projects'
import {
  fetchEngineerTeam,
  assignEngineerToProject,
  unassignEngineerFromProject,
  fetchProjectEngineer,
  fetchProjectSuppliers,
  fetchContractorSuppliers,
  assignSupplierToProject,
  unassignSupplierFromProject,
  fetchProjectSpecialistTeam,
  fetchProjectSpecialistCandidates,
  sendProjectSpecialistRequest,
} from '../../api/engineers'

import { fetchCostToolSummary } from '../../api/costTool'
import { COLORS } from '../../theme/tokens'
import SiteDayRecords from '../../components/builder/SiteDayRecords'
import { Section, SegmentTabs, Badge, ActionButton, Notice } from '../../components/builder/BuilderUi'
import {
  PROJECT_CATEGORY_TABS, SITE_ENGINEER_CATEGORY, SUPPLIER_CATEGORY_ORDER, apiErrorText, asList, buildingTypeText,
  completionPercent, completionText, formatDisplayDate, groupProjectsByCategory, money, progressLabel,
  projectStatusText, scheduleText, scheduleWidth,
} from '../../utils/builderHelpers'
import { constructionTypeLabel } from '../../utils/roleLabels'
import { useLanguage } from '../../i18n/LanguageContext'
import { optionLabel } from '../../i18n/optionKeys'
import { createStyles } from '../../theme/createStyles'
import { useMarkSectionRead } from '../../components/builder/BuilderInbox'

// Tab labels are keys (web contractorConstants.projectDetailTabs), translated at render.
const TABS = [
  { id: 'details', labelKey: 'ui.overview' },
  { id: 'activity', labelKey: 'ui.siteActivity' },
  { id: 'team', labelKey: 'ui.team' },
  { id: 'payments', labelKey: 'ui.payments' },
  { id: 'analysis', labelKey: 'owner.analysis.title' },
  { id: 'liveCamera', labelKey: 'ui.liveCamera' },
]

// Display keys for stored option values (web optionKeys SUPPLIER_TYPE_KEYS and
// profileConstants ENGINEER_CATEGORY_LABEL_KEYS); the stored value is unchanged.
const SUPPLIER_TYPE_KEYS = {
  'Material Supplier': 'opt.supplierType.material',
  'Labor Supplier': 'opt.supplierType.labor',
  'Equipment Supplier': 'opt.supplierType.equipment',
}
const ENGINEER_CATEGORY_LABEL_KEYS = {
  'Site Engineer': 'role.engineer',
  'Soil Engineer': 'ui.profile.engCat.soilEngineer',
  'Survey Engineer': 'ui.profile.engCat.surveyEngineer',
  Architecture: 'ui.profile.engCat.architecture',
  'Structural Engineer': 'ui.profile.engCat.structuralEngineer',
  'Civil Engineer': 'ui.profile.engCat.civilEngineer',
  'Electrical Engineer': 'ui.profile.engCat.electricalEngineer',
  Plumbing: 'opt.category.plumbing',
  'Mechanical Engineer': 'ui.profile.engCat.mechanicalEngineer',
  HVAC: 'ui.profile.engCat.hvac',
  'Quantity Surveyor': 'ui.profile.engCat.quantitySurveyor',
  Safety: 'opt.category.safety',
  'Construction Safety': 'ui.profile.engCat.constructionSafety',
  'Finishing / Painter': 'ui.profile.engCat.finishingPainter',
}
// web utils/roleLabels CONSTRUCTION_TYPE_LABEL_KEYS
const CONSTRUCTION_TYPE_LABEL_KEYS = {
  CONTRACTOR: 'role.builder',
  SELF_CONSTRUCTION: 'ui.shared.selfConstruction',
}
const STOCK_STATUS_KEYS = {
  IN_STOCK: 'owner.pa.stockIn',
  LOW_STOCK: 'owner.pa.stockLow',
  OUT_OF_STOCK: 'owner.pa.stockOut',
}

function inr(value) {
  const amount = Number(value || 0)
  if (!amount) return '—'
  return `₹${amount.toLocaleString('en-IN')}`
}

function StatusChip({ label, tone = 'brand' }) {
  const bg = tone === 'positive' ? 'tone' : tone === 'muted' ? 'tone2' : 'tone3'
  const fg = tone === 'muted' ? 'text' : 'tone4'
  return (
    <View style={[styles.view, styles[bg]]}>
      <Text style={[styles.text2, styles[fg]]}>{label}</Text>
    </View>
  )
}

// The builder's project card (web ContractorProjectsTable): owner, area, type,
// planned dates, Site Engineer assignment, progress and the contract amount.
function ProjectCard({ project, onPress }) {
  const { t } = useLanguage()
  const progress = progressLabel(project, t)
  const barWidth = completionPercent(project) !== null
    ? completionPercent(project)
    : project.work_started === true ? scheduleWidth(project) : 0
  const schedule = scheduleText(project, t)
  const ownerName = project.owner?.name || project.owner_name || ''
  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <View style={styles.view2}>
        <HardHat size={16} color={COLORS.brand[700]} />
        <Text style={styles.text3} numberOfLines={1}>
          {project.project_title || project.title || t('dash.common.project')}
        </Text>
        <StatusChip label={projectStatusText(project.status || 'active', t)} />
      </View>
      <View style={styles.view3}>
        <MapPin size={12} color={COLORS.slate[400]} />
        <Text style={styles.text4} numberOfLines={1}>
          {project.address || t('dash.owner.estimates.locationNotSet')}{project.pincode ? ` · ${project.pincode}` : ''}
        </Text>
      </View>
      <Text style={styles.text5} numberOfLines={1}>
        {[ownerName, t('dash.owner.sqft', { area: project.land_area ?? 0 }), buildingTypeText(project.building_type, t) || null].filter(Boolean).join(' · ')}
      </Text>
      <View style={styles.view4}>
        <CalendarDays size={11} color={COLORS.slate[400]} />
        <Text style={styles.text6}>
          {formatDisplayDate(project.start_date, undefined, t)} → {formatDisplayDate(project.end_date, undefined, t)}
        </Text>
      </View>
      <View style={styles.view5}>
        <Text style={styles.text6}>{t('dash.contractor.siteEngineer')}:</Text>
        {project.assigned_engineer ? (
          <>
            <Badge label={t('dash.contractor.assigned')} bg="#ecfdf5" fg="#047857" />
            <Text style={styles.text7} numberOfLines={1}>{project.assigned_engineer.name}</Text>
          </>
        ) : (
          <Badge label={t('dash.contractor.assignmentRequired')} />
        )}
      </View>
      <View style={styles.view6}>
        <Text style={styles.text6}>{progress ? `${t('dash.contractor.progress')}: ${progress}` : ''}</Text>
        <Text style={styles.text8}>{money(project.contract_amount ?? project.awarded_amount ?? project.budget, project.project_country)}</Text>
      </View>
      <View style={styles.view7}>
        <View style={[styles.view8, { width: `${barWidth}%` }]} />
      </View>
      {schedule ? <Text style={styles.text9} numberOfLines={1}>{t('progress.schedule')}: {schedule}</Text> : null}
    </Pressable>
  )
}

function DetailField({ label, value }) {
  const { t } = useLanguage()
  return (
    <View style={styles.view9}>
      <Text style={styles.text10}>{label}</Text>
      <Text style={styles.text11} numberOfLines={1}>{value || t('dash.common.notSet')}</Text>
    </View>
  )
}

function ProjectDetail({ project, onBack, onProgressSaved, onTeamChanged, navigation }) {
  const { t } = useLanguage()
  const engineerCategoryLabel = (category) => optionLabel(t, ENGINEER_CATEGORY_LABEL_KEYS, category)
  const [activeTab, setActiveTab] = useState('details')
  const [dailyForm, setDailyForm] = useState({
    work_title: '',
    activity_category: '',
    boq_reference: '',
    activity_unit: '',
    planned_quantity: '',
    completed_quantity: '',
    detailed_remarks: '',
    labour_worker_count: '',
    labour_cost: '',
    material_cost: '',
    equipment_cost: '',
    total_expenses: '',
    material_used: '',
    equipment_used: '',
    inspection_remarks: '',
  })
  const [dailyWorkDate, setDailyWorkDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [savingDaily, setSavingDaily] = useState(false)
  const [dailyPhotos, setDailyPhotos] = useState([])
  const [dailyVideos, setDailyVideos] = useState([])
  const [dailyAction, setDailyAction] = useState('IN_PROGRESS')

  async function pickDailyMedia(kind) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'photo' ? ['images'] : ['videos'],
        allowsMultipleSelection: true,
        quality: 0.8,
      })
      if (result.canceled) return
      const assets = result.assets || []
      if (kind === 'photo') setDailyPhotos((current) => [...current, ...assets])
      else setDailyVideos((current) => [...current, ...assets])
    } catch (error) {
      Alert.alert(t('mobile.projects.galleryFailed'), error?.message || t('mobile.projects.tryAgain'))
    }
  }
  const updateDailyField = (key, value) =>
    setDailyForm((current) => ({ ...current, [key]: value }))
  const [activityText, setActivityText] = useState('')
  const [savingActivity, setSavingActivity] = useState(false)
  const [timelineRefresh, setTimelineRefresh] = useState(0)
  const timeline = useAsyncData(() => fetchProjectTimelineEntries(project.id), [project.id, timelineRefresh])
  const analysis = useAsyncData(
() => fetchCostToolSummary(project.id),
  [project.id]
)
  const engineer = useAsyncData(() => fetchProjectEngineer(project.id).catch(() => ({ engineer: null })), [project.id])
  const suppliers = useAsyncData(() => fetchProjectSuppliers(project.id).catch(() => []), [project.id])
    const mySuppliers = useAsyncData(() => fetchContractorSuppliers().catch(() => []), [])
  const [supplierBusyId, setSupplierBusyId] = useState(null)
  // Site Engineer assignment from the project Team tab (web ContractorProjectDetail).
  const team = useAsyncData(() => fetchEngineerTeam().catch(() => ({ active: [] })), [])
  const [teamSection, setTeamSection] = useState('siteEngineer')
  const [selectedEngineerId, setSelectedEngineerId] = useState(null)
  const [engineerBusy, setEngineerBusy] = useState(false)
  const [engineerMessage, setEngineerMessage] = useState(null)
  // Only Site Engineers may hold a project's Site Engineer slot; the server checks the same.
  const siteEngineers = asList(team.data?.active).filter(
    (member) => String(member.specialization || member.category || '').trim() === SITE_ENGINEER_CATEGORY,
  )

  async function assignSiteEngineer() {
    if (!selectedEngineerId) return
    setEngineerBusy(true)
    setEngineerMessage(null)
    try {
      await assignEngineerToProject(project.id, selectedEngineerId)
      setSelectedEngineerId(null)
      setEngineerMessage({ tone: 'success', text: t('dash.msg.engineerAssigned') })
      await Promise.all([engineer.reload(), team.reload()])
      onTeamChanged?.()
    } catch (error) {
      setEngineerMessage({ tone: 'error', text: apiErrorText(error, t('dash.err.assignEngineer'), t) })
    } finally {
      setEngineerBusy(false)
    }
  }

  function confirmUnassignSiteEngineer(current) {
    Alert.alert(t('mobile.projects.unassignEngineerTitle'), t('dash.contractor.removeEngineer', { name: current.name || t('ce.engineerFallback') }), [
      { text: t('dash.common.cancel'), style: 'cancel' },
      {
        text: t('dash.contractor.unassign'),
        style: 'destructive',
        onPress: async () => {
          setEngineerBusy(true)
          setEngineerMessage(null)
          try {
            await unassignEngineerFromProject(project.id, current.user_id || current.id)
            setEngineerMessage({ tone: 'success', text: t('dash.msg.engineerRemoved') })
            await Promise.all([engineer.reload(), team.reload()])
            onTeamChanged?.()
          } catch (error) {
            setEngineerMessage({ tone: 'error', text: apiErrorText(error, t('dash.err.unassignEngineer'), t) })
          } finally {
            setEngineerBusy(false)
          }
        },
      },
    ])
  }
  const [progressValue, setProgressValue] = useState(
    String(project.completion_percentage ?? 0)
  )
  const [savingProgress, setSavingProgress] = useState(false)
    // Project specialist team
  const [specialistRows, setSpecialistRows] = useState([])
  const [specialistsLoading, setSpecialistsLoading] = useState(false)
  const [specialistsError, setSpecialistsError] = useState('')
  const [openSpecialistCategory, setOpenSpecialistCategory] = useState('')
  const [specialistCandidates, setSpecialistCandidates] = useState([])
  const [specialistBusyId, setSpecialistBusyId] = useState(null)
  const [specialistMessage, setSpecialistMessage] = useState('')
    const loadSpecialistTeam = useCallback(async () => {
    setSpecialistsLoading(true)
    setSpecialistsError('')
    try {
      const result = await fetchProjectSpecialistTeam(project.id)
      setSpecialistRows(Array.isArray(result) ? result : [])
    } catch (error) {
      setSpecialistsError(
        error?.response?.data?.detail || t('specialist.loadFailed')
      )
    } finally {
      setSpecialistsLoading(false)
    }
  }, [project.id])

  useEffect(() => {
    if (activeTab === 'team') {
      loadSpecialistTeam()
    }
  }, [activeTab, loadSpecialistTeam])

  async function toggleSpecialistCategory(category) {
    setSpecialistMessage('')
    if (openSpecialistCategory === category) {
      setOpenSpecialistCategory('')
      setSpecialistCandidates([])
      return
    }

    setOpenSpecialistCategory(category)
    setSpecialistCandidates([])
    try {
      const result = await fetchProjectSpecialistCandidates(project.id, category)
      setSpecialistCandidates(Array.isArray(result) ? result : [])
    } catch (error) {
      setSpecialistMessage(
        error?.response?.data?.detail || t('specialist.loadFailed')
      )
    }
  }

  async function requestSpecialist(engineerId, category) {
    setSpecialistBusyId(engineerId)
    setSpecialistMessage('')
    try {
      await sendProjectSpecialistRequest(project.id, engineerId)
      await loadSpecialistTeam()
      const result = await fetchProjectSpecialistCandidates(project.id, category)
      setSpecialistCandidates(Array.isArray(result) ? result : [])
      setSpecialistMessage(t('specialist.requestSent'))
    } catch (error) {
      setSpecialistMessage(
        error?.response?.data?.detail || t('specialist.requestFailed')
      )
    } finally {
      setSpecialistBusyId(null)
    }
  }

  const mySupplierList = Array.isArray(mySuppliers.data) ? mySuppliers.data : []

  async function changeSupplier(supplier, assign) {
    const engineerId = (engineer.data?.engineer || {}).user_id
    if (assign && !engineerId) {
      Alert.alert(t('mobile.projects.assignEngineerFirst'), t('team.supplierNeedsEngineer'))
      return
    }
    const supplierId = supplier.user_id || supplier.id
    setSupplierBusyId(supplierId)
    try {
      if (assign) await assignSupplierToProject(project.id, supplierId, engineerId)
      else await unassignSupplierFromProject(project.id, supplierId, supplier.engineer_id || engineerId)
      await suppliers.reload()
    } catch (error) {
      Alert.alert(t('mobile.projects.couldNotUpdate'), error?.response?.data?.detail || t('mobile.projects.tryAgain'))
    } finally {
      setSupplierBusyId(null)
    }
  }

  async function saveProgress() {
    const value = Number(progressValue)

    if (
      progressValue.trim() === '' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    ) {
      Alert.alert(t('mobile.projects.invalidProgress'), t('mobile.projects.percentRange'))
      return
    }

    setSavingProgress(true)
    try {
      await updateProjectProgress(project.id, value)
      setProgressValue(String(value))
      await onProgressSaved?.(value)
      Alert.alert(t('mobile.projects.progressUpdated'), t('mobile.projects.progressSavedBody'))
    } catch (error) {
      Alert.alert(
        t('mobile.projects.progressFailed'),
        error?.response?.data?.detail || error?.message || t('mobile.projects.tryAgain')
      )
    } finally {
      setSavingProgress(false)
    }
  }

  async function saveDailyRecord(action) {
    if (!dailyForm.work_title.trim()) {
      Alert.alert(t('ui.shared.required'), t('se.form.errWorkTitle'))
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dailyWorkDate)) {
      Alert.alert(t('mobile.projects.invalidDate'), t('mobile.projects.dateFormat'))
      return
    }

    const submit = async () => {
      setSavingDaily(true)
      try {
        const payload = new FormData()
        payload.append('work_date', dailyWorkDate)
        payload.append('action', action)

        const numericFields = new Set([
          'labour_worker_count', 'labour_cost', 'material_cost',
          'equipment_cost', 'total_expenses',
        ])
        Object.entries(dailyForm).forEach(([key, value]) => {
          payload.append(
            key,
            numericFields.has(key) ? String(Number(value) || 0) : String(value ?? '')
          )
        })
        payload.append('material_usage', '[]')

        const appendMedia = (field, asset, fallbackName) => {
          if (!asset?.uri) return
          const name = asset.fileName || asset.uri.split('/').pop() || fallbackName
          const mimeType = asset.mimeType || (
            field === 'videos' ? 'video/mp4' : 'image/jpeg'
          )
          payload.append(field, { uri: asset.uri, name, type: mimeType })
        }
        dailyPhotos.forEach((asset) => appendMedia('images', asset, 'site-photo.jpg'))
        dailyVideos.forEach((asset) => appendMedia('videos', asset, 'site-video.mp4'))

        await saveDailyWorkflow(project.id, payload)
        setDailyPhotos([])
        setDailyVideos([])
        setTimelineRefresh((value) => value + 1)
        Alert.alert(t('mobile.projects.saved'), action === 'CLOSED' ? t('se.dayClosed') : t('mobile.projects.dailySaved'))
      } catch (error) {
        Alert.alert(
          t('mobile.projects.couldNotSave'),
          error?.response?.data?.detail || error?.message || t('mobile.projects.tryAgain')
        )
      } finally {
        setSavingDaily(false)
      }
    }

    if (action === 'CLOSED') {
      Alert.alert(t('mobile.projects.closeDayTitle'), t('se.form.closeDayHint'), [
        { text: t('dash.common.cancel'), style: 'cancel' },
        { text: t('se.form.closeDay'), onPress: submit },
      ])
    } else {
      await submit()
    }
  }

  async function saveActivity() {
    if (!activityText.trim()) {
      Alert.alert(t('mobile.projects.missingDetails'), t('mobile.projects.describeWork'))
      return
    }
    setSavingActivity(true)
    try {
      const payload = new FormData()
      payload.append('work_date', new Date().toISOString().slice(0, 10))
      payload.append('work_type', activityText.trim())
      await saveTimelineUpdate(project.id, payload)
      setActivityText('')
      setTimelineRefresh((value) => value + 1)
      Alert.alert(t('mobile.projects.saved'), t('mobile.projects.activityRecorded'))
    } catch (error) {
      Alert.alert(t('mobile.projects.couldNotSave'), error?.response?.data?.detail || t('mobile.projects.tryAgain'))
    } finally {
      setSavingActivity(false)
    }
  }

  const timelineList = Array.isArray(timeline.data) ? timeline.data : []
  const supplierList = Array.isArray(suppliers.data) ? suppliers.data : []
  const assignedEngineer = engineer.data?.engineer || null
  const milestones = Array.isArray(project.escrow_milestones) ? project.escrow_milestones : []

  return (
    <View>
      <Section>
      <Pressable onPress={onBack} style={styles.pressable2}>
        <ChevronLeft size={18} color={COLORS.brand[700]} />
        <Text style={styles.text12}>{t('dash.owner.projectDetails.backToProjects')}</Text>
      </Pressable>

      <Text style={styles.text13}>{project.project_title || project.title}</Text>
      <Text style={styles.text14}>
        {project.address || t('dash.owner.estimates.locationNotSet')}{project.pincode ? ` · ${project.pincode}` : ''}
      </Text>

      {/* Sub-tab strip — same 4 tabs as web ContractorProjectDetail */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={{ gap: 6 }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.pressable3, active ? styles.pressable4 : styles.pressable5]}
            >
              <Text style={[styles.text15, active ? styles.text16 : styles.text]}>{t(tab.labelKey)}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      </Section>

      <View>
        {activeTab === 'details' && (
          <>
            <Section>
            <View style={styles.view10}>
            <DetailField
              label={t('dash.common.constructionType')}
              value={CONSTRUCTION_TYPE_LABEL_KEYS[project.construction_type] ? t(CONSTRUCTION_TYPE_LABEL_KEYS[project.construction_type]) : constructionTypeLabel(project.construction_type)}
            />
            <DetailField label={t('dash.common.buildingType')} value={buildingTypeText(project.building_type, t)} />
            <DetailField label={t('dash.common.landArea')} value={project.land_area ? `${project.land_area} ${t('dash.owner.profile.sqFt')}` : null} />
            <DetailField label={t('dash.common.floors')} value={project.floors != null ? String(project.floors) : null} />
            <DetailField label={t('dash.common.status')} value={projectStatusText(project.status || 'active', t)} />
            <DetailField label={t('dash.common.pincode')} value={project.pincode} />
            {completionPercent(project) !== null ? <DetailField label={t('progress.completion')} value={completionText(project, t)} /> : null}
            <DetailField label={t('progress.schedule')} value={scheduleText(project, t) || null} />
            {project.contract_amount != null ? <DetailField label={t('dash.common.contractValue')} value={money(project.contract_amount, project.project_country)} /> : null}
            {project.contract_amount == null && project.awarded_amount != null ? <DetailField label={t('request.flow.builderQuotation')} value={money(project.awarded_amount, project.project_country)} /> : null}
            <DetailField
              label={t(project.contract_amount != null || project.awarded_amount != null ? 'dash.common.originalBudget' : 'dash.common.budget')}
              value={project.budget ? money(project.budget, project.project_country) : null}
            />
            <DetailField label={t('dash.owner.projectDetails.startDate')} value={formatDisplayDate(project.start_date, undefined, t)} />
            <DetailField label={t('dash.owner.projectDetails.endDate')} value={formatDisplayDate(project.end_date, undefined, t)} />
          </View>
          {project.description ? (
            <View style={styles.view11}>
              <Text style={styles.text10}>{t('dash.common.description')}</Text>
              <Text style={styles.text17}>{project.description}</Text>
            </View>
          ) : null}
          </Section>
          <Panel title={t('mobile.projects.updateProgress')}>
            <Text style={styles.text18}>
              {t('mobile.projects.updateProgressHint')}
            </Text>
            <View style={styles.view12}>
              <TextInput
                value={progressValue}
                onChangeText={setProgressValue}
                keyboardType="numeric"
                editable={!savingProgress}
                maxLength={3}
                accessibilityLabel={t('se.projectCompletion')}
                style={styles.textInput}
                placeholder="0–100"
              />
              <Pressable
                onPress={saveProgress}
                disabled={savingProgress}
                style={[styles.pressable6, savingProgress ? styles.pressable7 : styles.pressable4]}
              >
                <Text style={styles.text19}>
                  {savingProgress ? t('se.form.saving') : t('se.form.saveProgress')}
                </Text>
              </Pressable>
            </View>
          </Panel>
          </>
        )}

        {activeTab === 'activity' && (
          <>
          <Panel title={t('se.savedDailyRecords')}>
            <SiteDayRecords project={project} onViewPlans={() => navigation?.navigate('BuilderSubscription')} />
          </Panel>
          <Panel title={t('mobile.projects.dailyWorkLog')}>
            <Text style={styles.text18}>
              {t('se.form.requiredHint')}
            </Text>
            <View style={styles.view13}>
              <Text style={styles.text20}>
                {t('mobile.projects.workDate')}
              </Text>
              <TextInput
                value={dailyWorkDate}
                onChangeText={setDailyWorkDate}
                placeholder="YYYY-MM-DD"
                editable={!savingDaily}
                accessibilityLabel={t('mobile.projects.workDate')}
                style={styles.textInput2}
                placeholderTextColor={COLORS.slate[400]}
              />
            </View>
            {[
              ['work_title', `${t('se.form.workTitle')} *`],
              ['activity_category', t('se.activityCategory')],
              ['boq_reference', t('se.boqReference')],
              ['activity_unit', t('se.activityUnit')],
              ['planned_quantity', t('se.plannedQuantity')],
              ['completed_quantity', t('se.completedQuantity')],
              ['detailed_remarks', t('se.detailedRemarks')],
              ['labour_worker_count', t('se.form.workers')],
              ['labour_cost', t('se.form.labourCost')],
              ['material_cost', t('se.form.materialCost')],
              ['equipment_cost', t('se.form.equipmentCost')],
              ['total_expenses', t('se.form.otherExpenses')],
              ['material_used', t('se.materialUsed')],
              ['equipment_used', t('se.form.equipmentUsed')],
              ['inspection_remarks', t('se.inspectionRemarks')],
            ].map(([key, label]) => (
              <View key={key} style={styles.view13}>
                <Text style={styles.text20}>{label}</Text>
                <TextInput
                  value={dailyForm[key]}
                  onChangeText={(value) => updateDailyField(key, value)}
                  placeholder={label}
                  editable={!savingDaily}
                  keyboardType={[
                    'planned_quantity', 'completed_quantity',
                    'labour_worker_count', 'labour_cost', 'material_cost',
                    'equipment_cost', 'total_expenses',
                  ].includes(key) ? 'decimal-pad' : 'default'}
                  multiline={['detailed_remarks', 'inspection_remarks'].includes(key)}
                  style={styles.textInput2}
                  placeholderTextColor={COLORS.slate[400]}
                />
              </View>
            ))}
            <View style={styles.view14}>
              <Pressable
                onPress={() => pickDailyMedia('photo')}
                disabled={savingDaily}
                style={styles.pressable8}
              >
                <Text style={styles.text21}>
                  {t('se.addSitePhotos')} ({dailyPhotos.length})
                </Text>
              </Pressable>
              {dailyPhotos.map((asset, index) => (
                <View key={`${asset.uri}-${index}`} style={styles.view15}>
                  <Text numberOfLines={1} style={styles.text22}>
                    {asset.fileName || t('se.selectedPhoto', { index: index + 1 })}
                  </Text>
                  <Pressable onPress={() => setDailyPhotos((current) => current.filter((_, i) => i !== index))}>
                    <Text style={styles.text23}>{t('se.removePhoto')}</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() => pickDailyMedia('video')}
                disabled={savingDaily}
                style={styles.pressable8}
              >
                <Text style={styles.text21}>
                  {t('se.addSiteVideos')} ({dailyVideos.length})
                </Text>
              </Pressable>
              {dailyVideos.map((asset, index) => (
                <View key={`${asset.uri}-${index}`} style={styles.view15}>
                  <Text numberOfLines={1} style={styles.text22}>
                    {asset.fileName || t('mobile.projects.day.videoN', { index: index + 1 })}
                  </Text>
                  <Pressable onPress={() => setDailyVideos((current) => current.filter((_, i) => i !== index))}>
                    <Text style={styles.text23}>{t('se.removeVideo')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            <View style={styles.view16}>
              <Pressable
                onPress={() => saveDailyRecord('IN_PROGRESS')}
                disabled={savingDaily}
                style={styles.pressable9}
              >
                <Text style={styles.text19}>
                  {savingDaily ? t('se.form.saving') : t('se.form.saveProgress')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => saveDailyRecord('CLOSED')}
                disabled={savingDaily}
                style={styles.pressable10}
              >
                <Text style={styles.text19}>{t('se.form.closeDay')}</Text>
              </Pressable>
            </View>
          </Panel>
          <Panel title={t('ui.siteActivity')}>
            <Text style={styles.text18}>
              {t('mobile.projects.activityHint')}
            </Text>
            <TextInput
              value={activityText}
              onChangeText={setActivityText}
              placeholder={t('mobile.projects.activityPlaceholder')}
              multiline
              editable={!savingActivity}
              accessibilityLabel={t('mobile.projects.activityPlaceholder')}
              style={styles.textInput3}
              placeholderTextColor={COLORS.slate[400]}
              textAlignVertical="top"
            />
            <Pressable
              onPress={saveActivity}
              disabled={savingActivity}
              style={[styles.pressable11, savingActivity ? styles.pressable7 : styles.pressable4]}
            >
              <Text style={styles.text19}>
                {savingActivity ? t('se.form.saving') : t('mobile.projects.saveSiteUpdate')}
              </Text>
            </Pressable>
            <PanelState loading={timeline.loading} error={timeline.error} empty={!timelineList.length} emptyText={t('se.noDailyLogs')}>
              {timelineList.map((entry, index) => (
                <View key={entry.id || index} style={styles.view17}>
                  <Text style={styles.text24}>
                    {String(entry.date || entry.work_date || '').slice(0, 10)}
                  </Text>
                  <Text style={styles.text25}>
                    {entry.work_type || entry.description || t('se.dailySiteRecord')}
                  </Text>
                  {!!(entry.images || []).length && (
                    <Text style={styles.text26}>
                      {t((entry.images || []).length === 1 ? 'se.photoOne' : 'se.photoMany', { count: (entry.images || []).length })}
                    </Text>
                  )}
                </View>
              ))}
            </PanelState>
          </Panel>
          </>
        )}

        {activeTab === 'team' && (
          <>
            {/* The three Team areas, as on the web: Site Engineer, Suppliers, Specialists. */}
            <Section>
              <SegmentTabs
                tabs={[
                  { id: 'siteEngineer', label: t('dash.contractor.siteEngineer'), icon: HardHat },
                  { id: 'suppliers', label: t('team.suppliers'), icon: Truck },
                  { id: 'specialists', label: t('team.specialists'), icon: Users },
                ]}
                active={teamSection}
                onChange={setTeamSection}
              />
            </Section>

            {teamSection === 'siteEngineer' && (
            <Panel title={t('dash.contractor.siteEngineer')} action={assignedEngineer ? <Badge label={t('team.assigned')} bg="#ecfdf5" fg="#047857" /> : <Badge label={t('team.notAssigned')} bg="#fff1f2" fg="#e11d48" />}>
              <Notice tone={engineerMessage?.tone} text={engineerMessage?.text} />
              <PanelState loading={engineer.loading} error={engineer.error} empty={false}>
                {assignedEngineer ? (
                  <View style={styles.view18}>
                    <View style={styles.view19}>
                      <Text style={styles.text27}>{assignedEngineer.name || assignedEngineer.full_name}</Text>
                      <Text style={styles.text28}>
                        {engineerCategoryLabel(assignedEngineer.category || assignedEngineer.specialization || SITE_ENGINEER_CATEGORY)} · {t('dash.contractor.engineerMeta', { pincode: assignedEngineer.pincode || '—', years: assignedEngineer.experience_years || 0 })}
                      </Text>
                    </View>
                    <ActionButton small tone="danger" icon={X} label={t('dash.contractor.unassign')} disabled={engineerBusy} onPress={() => confirmUnassignSiteEngineer(assignedEngineer)} />
                  </View>
                ) : (
                  <View>
                    <Text style={styles.text29}>{t('team.availableSiteEngineers')}</Text>
                    {siteEngineers.length ? siteEngineers.map((member) => {
                      const busyElsewhere = Boolean(member.working_on_project)
                      const on = selectedEngineerId === member.user_id
                      return (
                        <Pressable
                          key={member.user_id}
                          disabled={busyElsewhere}
                          onPress={() => setSelectedEngineerId(on ? null : member.user_id)}
                          style={[styles.pressable12, on ? styles.pressable13 : styles.pressable14, busyElsewhere ? styles.pressable15 : null]}
                        >
                          <Text style={styles.text30}>{member.name}</Text>
                          <Text style={styles.text31}>
                            {busyElsewhere ? t('ce.workingOnAnotherProject') : (member.pincode || t('dash.contractor.noPincode'))}
                          </Text>
                        </Pressable>
                      )
                    }) : (
                      <View style={styles.view20}>
                        <Text style={styles.text30}>{t('team.noSiteEngineersTitle')}</Text>
                        <Text style={styles.text32}>{t('team.noSiteEngineersSub')}</Text>
                        <ActionButton small tone="brandOutline" label={t('team.manageSiteEngineers')} onPress={() => navigation?.navigate('ContractorPartnersTab')} style={styles.actionButton} />
                      </View>
                    )}
                    {siteEngineers.length ? (
                      <ActionButton icon={UserPlus} label={t('team.assignEngineer')} disabled={!selectedEngineerId} busy={engineerBusy} onPress={assignSiteEngineer} style={styles.actionButton2} />
                    ) : null}
                  </View>
                )}
              </PanelState>
            </Panel>
            )}

            {teamSection === 'specialists' && (
            <Panel title={t('team.specialists')}>
              {specialistsLoading ? (
                <Text style={styles.text33}>
                  {t('specialist.loading')}
                </Text>
              ) : specialistsError ? (
                <Text style={styles.text34}>
                  {specialistsError}
                </Text>
              ) : specialistRows.length === 0 ? (
                <Text style={styles.text33}>
                  {t('mobile.projects.noSpecialistCategories')}
                </Text>
              ) : (
                specialistRows.map((row) => {
                  const category = row.category
                  const isOpen = openSpecialistCategory === category

                  return (
                    <View
                      key={category}
                      style={styles.view17}
                    >
                      <View style={styles.view2}>
                        <View style={styles.view19}>
                          <Text style={styles.text8}>
                            {engineerCategoryLabel(category)}
                          </Text>
                          <Text style={styles.text14}>
                            {row.engineer?.name || t('specialist.nobodyYet')}
                          </Text>
                        </View>

                        <StatusChip
                          label={
                            row.status === 'accepted'
                              ? t('specialist.assigned')
                              : row.status === 'pending'
                                ? t('specialist.pending')
                                : t('specialist.open')
                          }
                          tone={row.status === 'accepted' ? 'positive' : 'muted'}
                        />

                        <Pressable
                          onPress={() => toggleSpecialistCategory(category)}
                          style={styles.pressable16}
                        >
                          <Text style={styles.text35}>
                            {isOpen ? t('dash.common.close') : t('specialist.view')}
                          </Text>
                        </Pressable>
                      </View>

                      {isOpen && (
                        <View style={styles.view21}>
                          {specialistCandidates.length === 0 ? (
                            <Text style={styles.text36}>
                              {t('specialist.noCandidates', { category: engineerCategoryLabel(category) })}
                            </Text>
                          ) : (
                            specialistCandidates.map((candidate) => {
                              const id = candidate.user_id
                              const requestStatus = candidate.request_status

                              return (
                                <View
                                  key={id}
                                  style={styles.view22}
                                >
                                  <View style={styles.view19}>
                                    <Text style={styles.text37}>
                                      {candidate.name || t('ce.engineerFallback')}
                                    </Text>
                                    <Text style={styles.text38}>
                                      {candidate.pincode || t('dash.contractor.noPincode')}
                                    </Text>
                                    {requestStatus === 'accepted' && (
                                      <Text style={styles.text39}>
                                        {t('specialist.assigned')}
                                      </Text>
                                    )}
                                    {requestStatus === 'pending' && (
                                      <Text style={styles.text40}>
                                        {t('specialist.pending')}
                                      </Text>
                                    )}
                                  </View>

                                  {requestStatus !== 'accepted' &&
                                    requestStatus !== 'pending' && (
                                      <Pressable
                                        onPress={() => requestSpecialist(id, category)}
                                        disabled={
                                          specialistBusyId === id ||
                                          candidate.can_request === false
                                        }
                                        style={[styles.pressable17, specialistBusyId === id ||
                                          candidate.can_request === false ? styles.pressable18 : styles.pressable4]}
                                      >
                                        <Text style={styles.text35}>
                                          {specialistBusyId === id
                                            ? t('ce.sending')
                                            : candidate.can_request === false
                                              ? t('progress.notAvailable')
                                              : t('specialist.sendRequest')}
                                        </Text>
                                      </Pressable>
                                    )}
                                </View>
                              )
                            })
                          )}
                        </View>
                      )}
                    </View>
                  )
                })
              )}

              {!!specialistMessage && (
                <Text style={styles.text41}>
                  {specialistMessage}
                </Text>
              )}
            </Panel>
            )}

            {teamSection === 'suppliers' && (
            <>
            <Panel title={t('team.suppliers')} action={supplierList.length ? <Badge label={t('team.suppliersAssignedCount', { count: supplierList.length })} bg="#ecfdf5" fg="#047857" /> : <Badge label={t('team.notAssigned')} bg="#fff1f2" fg="#e11d48" />}>
              <PanelState loading={suppliers.loading} error={suppliers.error} empty={!supplierList.length} emptyText={t('mobile.projects.noProjectSuppliers')}>
                {supplierList.map((supplier, index) => {
                  const id = supplier.user_id || supplier.id
                  return (
                    <View key={id || index} style={styles.view23}>
                      <View style={styles.view19}>
                        <Text style={styles.text30}>{supplier.store_name || supplier.business_name || supplier.name}</Text>
                        {!!(supplier.supplier_category || supplier.material_types) && (
                          <Text style={styles.text28}>{supplier.supplier_category ? optionLabel(t, SUPPLIER_TYPE_KEYS, supplier.supplier_category) : String(supplier.material_types)}</Text>
                        )}
                      </View>
                      <Pressable onPress={() => changeSupplier(supplier, false)} disabled={supplierBusyId === id} style={styles.pressable19}>
                        <Text style={styles.text42}>{t('dash.contractor.unassign')}</Text>
                      </Pressable>
                    </View>
                  )
                })}
              </PanelState>
            </Panel>
            <Panel title={t('mobile.projects.assignSupplier')}>
              {!assignedEngineer && mySupplierList.length ? (
                <Notice tone="warn" text={t('team.supplierNeedsEngineer')} />
              ) : null}
              <PanelState loading={mySuppliers.loading} empty={!mySupplierList.length} emptyText={`${t('team.noSuppliersTitle')}. ${t('team.noSuppliersSub')}`}>
                {/* Grouped by the category each supplier saved on their profile (web parity). */}
                {[...SUPPLIER_CATEGORY_ORDER, null].map((category) => {
                  const group = mySupplierList.filter((supplier) => (category
                    ? supplier.supplier_category === category
                    : !SUPPLIER_CATEGORY_ORDER.includes(supplier.supplier_category)))
                  if (!group.length) return null
                  return (
                    <View key={category || 'other'} style={styles.view24}>
                      <Text style={styles.text43}>{category ? optionLabel(t, SUPPLIER_TYPE_KEYS, category) : t('team.supplierNoCategory')} <Text style={styles.text44}>({group.length})</Text></Text>
                      {group.map((supplier) => {
                        const id = supplier.user_id || supplier.id
                        const assigned = supplierList.some((item) => (item.user_id || item.id) === id)
                        return (
                          <View key={id} style={styles.view23}>
                            <View style={styles.view19}>
                              <Text style={styles.text30}>{supplier.store_name || supplier.business_name || supplier.name}</Text>
                              <Text style={styles.text31}>{supplier.pincode || '—'}</Text>
                            </View>
                            {assigned ? (
                              <Badge label={t('team.assigned')} bg="#ecfdf5" fg="#047857" />
                            ) : (
                              <Pressable onPress={() => changeSupplier(supplier, true)} disabled={supplierBusyId === id || !assignedEngineer} style={[styles.pressable20, assignedEngineer ? styles.pressable4 : styles.pressable18]}>
                                <Text style={styles.text35}>{t('team.assign')}</Text>
                              </Pressable>
                            )}
                          </View>
                        )
                      })}
                    </View>
                  )
                })}
              </PanelState>
            </Panel>
            </>
            )}
          </>
        )}

        {activeTab === 'payments' && (
          <Panel title={t('dash.owner.escrow.title')}>
            <PanelState empty={!milestones.length} emptyText={t('dash.owner.projectDetails.noMilestones')}>
              {milestones.map((milestone) => (
                <View key={milestone.id} style={styles.view25}>
                  <Text style={styles.text45}>{milestone.name}</Text>
                  <View style={styles.view26}>
                    <Text style={styles.text46}>{inr(milestone.amount)}</Text>
                    <StatusChip label={projectStatusText(milestone.status || 'PENDING', t)} tone={milestone.status === 'RELEASED' ? 'positive' : 'muted'} />
                  </View>
                </View>
              ))}
            </PanelState>
          </Panel>
        )}

        {activeTab === 'analysis' && (
  <Panel title={t('owner.analysis.title')}>
    <PanelState
      loading={analysis.loading}
      error={analysis.error}
      empty={!analysis.data}
      emptyText={t('mobile.projects.analysisUnavailable')}
    >
      {analysis.data && (() => {
        const data = analysis.data
        const dashboard = data.dashboard || {}
       const figures = analysisFigures(dashboard)
const trend = spendingTrend(data.registers)
const workItems = workItemProgress(data.registers)
const budgetBreakdown = budgetRows(project, dashboard)
const materialDetails = materialRows(data.materials)
const recentExpenseItems = recentExpenses(data.expenses)

const budget = figures?.budget ?? 0
const spent = figures?.spent ?? 0
const completion = dashboard.project_completion
  

        return (
          <>
            <View style={styles.view27}>
              <Text style={styles.text47}>
                {t('owner.pa.totalBudget')}
              </Text>
              <Text style={styles.text48}>
                {budget > 0 ? inr(budget) : t('dash.common.notSet')}
              </Text>
            </View>

            <View style={styles.view27}>
              <Text style={styles.text47}>
                {t('owner.pa.amountSpent')}
              </Text>
              <Text style={styles.text48}>
                {inr(spent)}
              </Text>
            </View>

            <View style={styles.view27}>
              <Text style={styles.text47}>
                {t('owner.pa.remainingBudget')}
              </Text>
              <Text style={styles.text48}>
                {budget > 0 ? inr(budget - spent) : t('progress.notAvailable')}
              </Text>
            </View>

            <View style={styles.view28}>
              <Text style={styles.text47}>
                {t('owner.pa.overallProgress')}
              </Text>
              <Text style={styles.text48}>
                {completion == null
                  ? t('progress.notAvailable')
                  : `${completion}%`}
              </Text>
            </View>


<Panel title={t('owner.pa.budgetBreakdown')}>
  {budgetBreakdown.map((row) => (
    <View
      key={row.key}
      style={styles.view25}
    >
      <View style={styles.view29}>
        <Text style={styles.text49}>
          {row.labelKey ? t(row.labelKey) : row.key.replace('_cost', '').replace('_', ' ')}
        </Text>
        <Text style={styles.text50}>
          {t('owner.pa.colPlanned')}: {row.planned == null ? t('dash.common.notSet') : inr(row.planned)}
        </Text>
      </View>
      <View style={styles.view26}>
        <Text style={styles.text51}>{inr(row.actual)}</Text>
        <Text style={styles.text50}>
          {row.percent == null ? '—' : `${row.percent}%`}
        </Text>
      </View>
    </View>
  ))}
</Panel>

<Panel title={t('owner.pa.spendTrend')}>
  <PanelState empty={!trend.length} emptyText={t('owner.pa.noTrend')}>
    {trend.slice(-8).map((point) => (
      <View
        key={point.date}
        style={styles.view30}
      >
        <Text style={styles.text38}>{point.date}</Text>
        <View style={styles.view26}>
          <Text style={styles.text49}>{inr(point.daily)}</Text>
          <Text style={styles.text38}>
            {t('owner.pa.cumulative')}: {inr(point.cumulative)}
          </Text>
        </View>
      </View>
    ))}
  </PanelState>
</Panel>

<Panel title={t('owner.pa.phaseProgress')}>
  <PanelState empty={!workItems.length} emptyText={t('owner.pa.noPhaseProgress')}>
    {workItems.map((item) => (
      <View
        key={item.reference}
        style={styles.view17}
      >
        <View style={styles.view31}>
          <Text style={styles.text52}>
            {item.label}
          </Text>
          <Text style={styles.text53}>
            {item.percent}%
          </Text>
        </View>
        <View style={styles.view32}>
          <View
            style={[styles.view8, { width: `${item.percent}%` }]}
          />
        </View>
        <Text style={styles.text50}>
          {item.status === 'completed'
            ? t('owner.pa.statusCompleted')
            : item.status === 'ongoing'
              ? t('owner.pa.statusOngoing')
              : t('owner.pa.statusNotStarted')}
          {item.unit ? ` · ${item.completed} / ${item.planned} ${item.unit}` : ''}
        </Text>
      </View>
    ))}
  </PanelState>
</Panel>
            <Panel title={t('owner.pa.materialUsage')}>
              <PanelState
empty={!materialDetails.length}
                emptyText={t('owner.pa.noMaterials')}
              >
               {materialDetails.map((item) => (
                  <View
                    key={item.id ?? item.material}
                    style={styles.view17}
                  >
                    <Text style={styles.text51}>
                      {item.material || t('owner.pa.colMaterial')}
                    </Text>
                    <Text style={styles.text50}>
                      {t('owner.pa.colReceived')}: {Number(item.received || 0)} {item.unit || ''}
                      {' · '}{t('owner.pa.colUsed')}: {Number(item.used || 0)} {item.unit || ''}
                      {' · '}{t('owner.pa.colRemaining')}: {Number(item.remaining || 0)} {item.unit || ''}
                    </Text>
                    <Text style={styles.text54}>
                      {t('owner.pa.colStatus')}: {t(STOCK_STATUS_KEYS[item.status || 'IN_STOCK'] || 'owner.pa.stockIn')}
                    </Text>
                  </View>
                ))}
              </PanelState>
            </Panel>
<Panel title={t('owner.pa.recentExpenses')}>
  <PanelState
    empty={!recentExpenseItems.length}
    emptyText={t('owner.pa.noExpenses')}
  >
    {recentExpenseItems.map((expense) => (
      <View
        key={expense.id}
        style={styles.view33}
      >
        <View style={styles.view19}>
          <Text style={styles.text49}>
            {expense.description || '—'}
          </Text>
          <Text style={styles.text50}>
            {expense.expense_date || '—'} · {expense.category || '—'}
          </Text>
        </View>
        <Text style={styles.text51}>
          {inr(expense.amount)}
        </Text>
      </View>
    ))}
  </PanelState>
</Panel>

          </>
        )
      })()}
    </PanelState>
  </Panel>
)}

                {activeTab === 'liveCamera' && (
          <Panel title={t('ui.liveCamera')}>
            <Text style={styles.text55}>
              {t('mobile.projects.liveCameraHint')}
            </Text>

            <Pressable
              onPress={() =>
                navigation.navigate('LiveCamera', {
                  projectId: project.id,
                  projectTitle:
                    project.project_title || project.title || t('dash.common.project'),
                })
              }
              style={styles.pressable21}
            >
              <Text style={styles.text56}>
                {t('mobile.projects.openLiveCamera')}
              </Text>
            </Pressable>
          </Panel>
        )}
      </View>
    </View>
  )
}

export default function ContractorProjectsScreen({ navigation }) {
  useMarkSectionRead('projects')
  const { t } = useLanguage()
  const [selected, setSelected] = useState(null)
  const [category, setCategory] = useState('current')
  const [refreshing, setRefreshing] = useState(false)
  const projects = useAsyncData(fetchBuilderProjectsWithAssignments, [])
  useLiveRefresh(() => projects.reload())
  const projectList = Array.isArray(projects.data) ? projects.data : []
  const groups = groupProjectsByCategory(projectList)
  const activeCategory = PROJECT_CATEGORY_TABS.find((tab) => tab.id === category) || PROJECT_CATEGORY_TABS[0]
  const shown = groups[activeCategory.id] || []

  // After any reload, the open project is replaced by its fresh copy (web parity).
  useEffect(() => {
    if (!Array.isArray(projects.data)) return
    setSelected((current) => (current ? projects.data.find((project) => project.id === current.id) || current : current))
  }, [projects.data])

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await projects.reload()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      {selected ? (
        <ProjectDetail
          project={selected}
          navigation={navigation}
          onBack={() => setSelected(null)}
          onProgressSaved={async (value) => {
            setSelected((current) =>
              current ? { ...current, completion_percentage: value } : current
            )
            await projects.reload()
          }}
          onTeamChanged={() => projects.reload()}
        />
      ) : (
        <>
          {/* All three category tabs always render, including empty ones. */}
          <Section>
            <SegmentTabs
              tabs={PROJECT_CATEGORY_TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey), count: groups[tab.id].length }))}
              active={activeCategory.id}
              onChange={setCategory}
            />
          </Section>
          <Panel title={t('ui.projects')}>
            <PanelState
              loading={projects.loading}
              error={projects.error}
              empty={!shown.length}
              emptyText={projectList.length ? t(activeCategory.emptyKey) : t('ui.contractor.noProjectsAssigned')}
            >
              {shown.map((project) => (
                <ProjectCard key={project.id} project={project} onPress={() => setSelected(project)} />
              ))}
            </PanelState>
          </Panel>
        </>
      )}
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  tone: { backgroundColor: c.brandSoftStrong },
  tone2: { backgroundColor: c.muted },
  tone3: { backgroundColor: c.brandSoft },
  text: { color: c.textMuted },
  tone4: { color: c.brandTextStrong },
  view: { alignSelf: 'flex-start', borderRadius: 9999, paddingHorizontal: 10.5, paddingVertical: 3.5 },
  text2: { fontSize: 11, fontWeight: '800' },
  pressable: { marginBottom: 10.5, borderRadius: 24, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view2: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text3: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text },
  view3: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text4: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  text5: { marginTop: 3.5, fontSize: 11, fontWeight: '600', color: c.textMuted },
  view4: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  text6: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  view5: { marginTop: 5.25, flexDirection: 'row', alignItems: 'center', gap: 7 },
  text7: { flex: 1, fontSize: 11, fontWeight: '700', color: c.textSoft },
  view6: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text8: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: c.text },
  view7: { marginTop: 5.25, height: 5.25, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.muted },
  view8: { height: '100%', borderRadius: 9999, backgroundColor: '#236645' },
  text9: { marginTop: 3.5, fontSize: 10, fontWeight: '600', color: c.textFaint },
  view9: { width: '48%', borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7 },
  text10: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  text11: { marginTop: 1.75, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.text },
  pressable2: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  text12: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: c.brandText },
  text13: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: c.text },
  text14: { marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  scrollView: { marginTop: 14 },
  pressable3: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7 },
  pressable4: { backgroundColor: '#1a5038' },
  pressable5: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  text15: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  text16: { color: '#ffffff' },
  view10: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8.75 },
  view11: { marginTop: 8.75, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7 },
  text17: { marginTop: 1.75, fontSize: 12, lineHeight: 17.5, fontWeight: '600', color: c.text },
  text18: { marginBottom: 7, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  view12: { flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  textInput: { height: 42, flex: 1, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 16, lineHeight: 24, fontWeight: '700', color: c.text },
  pressable6: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10.5 },
  pressable7: { backgroundColor: '#94a3b8' },
  text19: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: '#ffffff' },
  view13: { marginBottom: 10.5 },
  text20: { marginBottom: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  textInput2: { borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, paddingVertical: 10.5, fontSize: 14, lineHeight: 20, fontWeight: '600', color: c.text },
  view14: { marginBottom: 10.5, gap: 7 },
  pressable8: { alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft, paddingHorizontal: 10.5, paddingVertical: 10.5 },
  text21: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.brandTextStrong },
  view15: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7 },
  text22: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.text },
  text23: { marginLeft: 10.5, fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.roseTextSoft },
  view16: { flexDirection: 'row', gap: 7 },
  pressable9: { flex: 1, alignItems: 'center', borderRadius: 12, backgroundColor: '#1a5038', paddingHorizontal: 10.5, paddingVertical: 10.5 },
  pressable10: { flex: 1, alignItems: 'center', borderRadius: 12, backgroundColor: '#334155', paddingHorizontal: 10.5, paddingVertical: 10.5 },
  textInput3: { minHeight: 70, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, paddingVertical: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  pressable11: { marginTop: 7, alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10.5 },
  view17: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text24: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.brandText },
  text25: { marginTop: 3.5, fontSize: 13, fontWeight: '600', color: c.text },
  text26: { marginTop: 1.75, fontSize: 11, fontWeight: '600', color: c.textFaint },
  view18: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 10.5 },
  view19: { flex: 1 },
  text27: { fontSize: 15, fontWeight: '800', color: c.text },
  text28: { marginTop: 1.75, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  text29: { marginBottom: 7, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textSecondary },
  pressable12: { marginBottom: 7, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  pressable13: { borderColor: '#1a5038', backgroundColor: c.brandSoft },
  pressable14: { borderColor: c.border, backgroundColor: c.card },
  pressable15: { opacity: 0.5 },
  text30: { fontSize: 14, fontWeight: '800', color: c.text },
  text31: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  view20: { alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 21 },
  text32: { marginTop: 3.5, textAlign: 'center', fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  actionButton: { marginTop: 10.5 },
  actionButton2: { marginTop: 3.5 },
  text33: { paddingVertical: 10.5, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  text34: { paddingVertical: 10.5, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.roseTextSoft },
  pressable16: { borderRadius: 8, backgroundColor: '#1a5038', paddingHorizontal: 10.5, paddingVertical: 7 },
  text35: { fontSize: 10, fontWeight: '800', color: '#ffffff' },
  view21: { marginTop: 10.5, borderTopWidth: 1, borderColor: c.borderSoft, paddingTop: 7 },
  text36: { paddingVertical: 7, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.textMuted },
  view22: { flexDirection: 'row', alignItems: 'center', gap: 7, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text37: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: c.text },
  text38: { fontSize: 12, lineHeight: 16, color: c.textMuted },
  text39: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.emeraldText },
  text40: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.amberText },
  pressable17: { borderRadius: 8, paddingHorizontal: 10.5, paddingVertical: 7 },
  pressable18: { backgroundColor: c.mutedStronger },
  text41: { marginTop: 7, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.brandText },
  view23: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  pressable19: { borderRadius: 8, borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft, paddingHorizontal: 8.75, paddingVertical: 5.25 },
  text42: { fontSize: 10, fontWeight: '800', color: c.roseText },
  view24: { marginBottom: 7 },
  text43: { marginBottom: 3.5, marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '800', color: c.textSoft },
  text44: { fontWeight: '600', color: c.textFaint },
  pressable20: { borderRadius: 8, paddingHorizontal: 10.5, paddingVertical: 5.25 },
  view25: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text45: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
  view26: { alignItems: 'flex-end' },
  text46: { fontSize: 15, fontWeight: '800', color: c.brandText },
  view27: { marginBottom: 10.5, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10.5 },
  text47: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textMuted },
  text48: { marginTop: 3.5, fontSize: 18, lineHeight: 28, fontWeight: '800', color: c.text },
  view28: { borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 10.5 },
  view29: { flex: 1, paddingRight: 10.5 },
  text49: { fontWeight: '700', color: c.text },
  text50: { marginTop: 3.5, fontSize: 12, lineHeight: 16, color: c.textMuted },
  text51: { fontWeight: '800', color: c.text },
  view30: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  view31: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10.5 },
  text52: { flex: 1, fontWeight: '700', color: c.text },
  text53: { fontWeight: '800', color: c.brandText },
  view32: { marginTop: 7, height: 7, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.muted },
  text54: { marginTop: 3.5, fontSize: 12, lineHeight: 16, fontWeight: '700', color: c.textMuted },
  view33: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text55: { fontSize: 14, lineHeight: 20, color: c.textSecondary },
  pressable21: { marginTop: 10.5, alignItems: 'center', borderRadius: 12, backgroundColor: '#1a5038', paddingHorizontal: 14, paddingVertical: 10.5 },
  text56: { fontWeight: '800', color: '#ffffff' },
}))
