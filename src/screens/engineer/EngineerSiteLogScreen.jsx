// The Site Engineer's site log — port of the web
// pages/contractor/SiteEngineerDashboard.jsx as the ENGINEER sees it
// (EngineerDashboard 'calendar' and 'dailyLogs'):
//   the month calendar (each day coloured by what it holds: text, photos,
//   videos, open today; Sundays are holidays), and the selected day's record:
//   the day at a glance, Work Done, Progress with the optional BOQ activity,
//   Materials Used (stock, quantities used, cost), Labour (supplier crews'
//   attendance + workers / labour cost), Equipment (supplier rentals' hours,
//   purchases, other equipment), Photos & Videos, Other Expenses, the day's
//   total, Save Progress / Close Day, and the project's Material History.
// The 'logs' view lists every saved daily record instead of the calendar.
// Only today, before the site's cutoff and while the day is open, can be edited
// — the server enforces the same rule.
// Wired to: GET /cost-tool/projects/{id}/summary (?work_date=), GET /timelines/
// project/{id}, POST /projects/{id}/daily-workflow, DELETE /project-photos/{id},
// the labour / equipment request endpoints (+ daily records / usage).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, Modal, Alert, ActivityIndicator } from 'react-native'
import { useSelector } from 'react-redux'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import * as ImagePicker from 'expo-image-picker'
import {
  Camera, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CirclePlay, History as HistoryIcon, Lock, Plus,
  RefreshCw, Save, Search, X,
} from 'lucide-react-native'
import { useLanguage } from '../../i18n/LanguageContext'
import DashboardShell, { useAsyncData } from '../../components/DashboardShell'
import { Notice, Section, SelectChip } from '../../components/builder/BuilderUi'
import { BudgetInWords } from '../../components/form'
import { fetchEngineerProjects } from '../../api/engineers'
import { fetchCostToolSummary } from '../../api/costTool'
import { deleteProjectPhoto, fetchProjectTimelineEntries, saveDailyWorkflow } from '../../api/projects'
import {
  fetchEquipmentUsage, fetchLaborDailyRecords, fetchProjectEquipmentRequests, fetchProjectLaborRequests,
} from '../../api/siteResources'
import { imageUrl } from '../../api/client'
import { formatMoney } from '../../utils/countryConfig'
import { formatDate, formatTime } from '../../utils/formatters'
import { completionPercent, completionText, scheduleText, todayCalendarDate } from '../../utils/builderHelpers'
import { optionLabel } from '../../i18n/optionKeys'
import {
  agreedPurchases, canRecordOnDate, dailyCostSummary, hasResourceOnDate, labourRequestsForDate, recordForDate,
  rentalChargeForDate, rentalsForDate,
} from '../../utils/siteResources'
import {
  EMPTY_HISTORY_FILTERS, buildMaterialHistory, isMaterialCostOverride, todayUsageSummary, usageChanges,
} from '../../utils/siteMaterialHistory'
import { LabourCards, PaymentsList, PurchasedEquipment, ReceivedMaterials, RentalCards, Tag } from './siteDayResources'
import MaterialHistoryPanel from './MaterialHistoryPanel'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

const emptyForm = { work_title: '', activity_category: '', boq_reference: '', activity_unit: '', planned_quantity: '', completed_quantity: '', detailed_remarks: '', labour_worker_count: '', labour_cost: '', material_cost: '', equipment_cost: '', total_expenses: '', material_used: '', equipment_used: '', inspection_remarks: '' }
const numericFields = new Set(['labour_worker_count', 'labour_cost', 'material_cost', 'equipment_cost', 'total_expenses'])
const BASE_ACTIVITY_CATEGORIES = ['Concrete', 'Masonry', 'Finishes', 'Excavation', 'Reinforcement', 'Formwork', 'Plaster', 'Tiling', 'Painting', 'Waterproofing', 'Boundary Wall', 'MEP']
const BASE_ACTIVITY_UNITS = ['m2', 'm3', 'm', 'kg', 'ton', 'bags', 'nos']
const ACTIVITY_CATEGORY_KEYS = {
  Concrete: 'opt.category.concrete', Masonry: 'opt.activity.masonry', Finishes: 'opt.activity.finishes', Excavation: 'opt.activity.excavation',
  Reinforcement: 'opt.activity.reinforcement', Formwork: 'opt.activity.formwork', Plaster: 'opt.activity.plaster', Tiling: 'opt.activity.tiling',
  Painting: 'opt.activity.painting', Waterproofing: 'opt.category.waterproofing', 'Boundary Wall': 'opt.activity.boundaryWall', MEP: 'opt.activity.mep',
}
const ACTIVITY_UNIT_KEYS = { ton: 'opt.unit.ton', bags: 'opt.unit.bags', nos: 'opt.unit.nos' }
const UNIT_SYMBOLS = new Set(['m', 'm2', 'm3', 'mm', 'cm', 'km', 'sqm', 'sqft', 'cum', 'cft', 'rmt', 'kg', 'g', 'mt', 'l', 'ltr', 'ml', '%'])
const STATUS_LABEL_KEYS = { OPEN: 'ui.status.open', IN_PROGRESS: 'ui.status.inProgress', CLOSED: 'ui.status.closed', COMPLETED: 'ui.status.closed' }
const CONTENT_LABEL_KEYS = { '100': 'se.cal.text', '110': 'se.cal.textPhoto', '101': 'se.cal.textVideo', '111': 'se.cal.textMedia', '010': 'se.cal.photo', '001': 'se.cal.video', '011': 'se.cal.photoVideo' }
const CELL_TONES = { open: ['#CFEBDD', '#03572E'], all: ['#F3E8FD', '#9146D8'], video: ['#F6EADB', '#F58A00'], photo: ['#E7F0FD', '#1683E8'], text: ['#FCE7F3', '#DB2777'] }
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const STOCK_TONES = { out: ['#ffe4e6', '#be123c'], low: ['#e0eee6', '#134127'], in: ['#d1fae5', '#047857'] }
const MEDIA_CAPTION = /Site Media:[^.]*\.?/gi

const dateKeyOf = (value) => String(value || '').slice(0, 10)
const statusLabel = (status, t) => (STATUS_LABEL_KEYS[status] ? t(STATUS_LABEL_KEYS[status]) : status ? t('ui.status.unknown') : t('ui.status.open'))
const hasEnteredText = (row) => Boolean(row && [row.work_type, row.progress_note, row.inspection_remarks, row.material_used, row.equipment_used]
  .some((value) => String(value || '').replace(MEDIA_CAPTION, '').trim()))
const formatQty = (value) => { const number = Number(value || 0); return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2))) }
const stockStatusKey = (remaining, minimumStock) => (Number(remaining || 0) <= 0 ? 'out' : Number(minimumStock || 0) && Number(remaining || 0) <= Number(minimumStock || 0) ? 'low' : 'in')
const normalizeUsage = (usage) => Object.fromEntries(Object.entries(usage || {}).map(([material, value]) => [material, Number(value) || 0]))
const snapshotOf = (form, usage) => JSON.stringify({ form, usage: normalizeUsage(usage) })
const apiErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((item) => item.msg).filter(Boolean).join(' ') || fallback
  return fallback
}
function workingDayNumber(startDate, date) {
  if (!startDate || !date || date < dateKeyOf(startDate)) return null
  const [y, m, d] = dateKeyOf(startDate).split('-').map(Number)
  const cursor = new Date(y, m - 1, d)
  let count = 0
  while (todayCalendarDate(cursor) <= date) {
    if (cursor.getDay() !== 0) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count || null
}
function monthCells(month) {
  const year = month.getFullYear()
  const value = month.getMonth()
  const cells = []
  for (let blank = 0; blank < new Date(year, value, 1).getDay(); blank += 1) cells.push(null)
  for (let day = 1; day <= new Date(year, value + 1, 0).getDate(); day += 1) cells.push(new Date(year, value, day))
  return cells
}
const confirmAsync = (title, body, okLabel, cancelLabel) => new Promise((resolve) => {
  Alert.alert(title, body, [
    { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
    { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) })
})
const assetPart = (asset, fallbackName, fallbackType) => ({
  uri: asset.uri,
  name: asset.fileName || fallbackName,
  type: asset.mimeType || fallbackType,
})

function Field({ label, required = false, optional = false, hint = '', error = '', children }) {
  const { t } = useLanguage()
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}{required ? <Text style={styles.required}> *</Text> : null}{optional ? <Text style={styles.optional}>{` (${t('se.form.optional')})`}</Text> : null}
      </Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  )
}

function Input({ invalid = false, editable = true, multiline = false, inputRef, ...props }) {
  return (
    <TextInput
      ref={inputRef}
      {...props}
      editable={editable}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      placeholderTextColor={COLORS.slate[400]}
      style={[multiline ? styles.textArea : styles.input, invalid ? styles.inputInvalid : null, !editable ? styles.inputDisabled : null]}
    />
  )
}

function FormSection({ title, aside = null, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {aside}
      </View>
      {children}
    </View>
  )
}

function GlanceStat({ label, value, sub = '' }) {
  return (
    <View style={styles.glance}>
      <Text style={styles.glanceLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.glanceValue} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={styles.glanceSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  )
}

/** A chip list of free-text suggestions (the web's <datalist>). */
function Suggestions({ options, labelOf, onPick, visible }) {
  if (!visible || !options.length) return null
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions} keyboardShouldPersistTaps="handled">
      {options.map((option) => (
        <Pressable key={option} onPress={() => onPick(option)} style={styles.suggestion}>
          <Text style={styles.suggestionText}>{labelOf(option)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  )
}

function SiteVideo({ uri }) {
  const player = useVideoPlayer({ uri }, (instance) => { instance.loop = false; instance.play() })
  return <VideoView player={player} style={{ width: '100%', height: '70%' }} allowsFullscreen nativeControls contentFit="contain" />
}

export default function EngineerSiteLogScreen({ navigation, route }) {
  const { t, td } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const historyOnly = route.params?.view === 'logs'
  const projects = useAsyncData(fetchEngineerProjects, [])
  const projectList = useMemo(() => (Array.isArray(projects.data) ? projects.data : (route.params?.project ? [route.params.project] : [])), [projects.data, route.params?.project])
  const [projectId, setProjectId] = useState(route.params?.project?.id ? String(route.params.project.id) : '')
  const [workDate, setWorkDate] = useState('')
  const [month, setMonth] = useState(() => new Date())
  const [daySummary, setDaySummary] = useState({ registers: [], workflow: {} })
  const [allSummary, setAllSummary] = useState({ registers: [], workflow: {} })
  const [timeline, setTimeline] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [usedToday, setUsedToday] = useState({})
  const [photos, setPhotos] = useState([])
  const [videos, setVideos] = useState([])
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loadedKey, setLoadedKey] = useState('')
  const [photoViewer, setPhotoViewer] = useState(null)
  const [videoViewer, setVideoViewer] = useState(null)
  const [usageSearch, setUsageSearch] = useState('')
  const [usedOnly, setUsedOnly] = useState(false)
  const [boqOpen, setBoqOpen] = useState(false)
  const [focusField, setFocusField] = useState('')
  const [historyFilters, setHistoryFilters] = useState(EMPTY_HISTORY_FILTERS)
  const [touched, setTouched] = useState({})
  const [historyOpen, setHistoryOpen] = useState(false)
  const [supply, setSupply] = useState({ projectId: '', labour: [], equipment: [], error: '' })
  const [supplyLogs, setSupplyLogs] = useState({ labour: {}, equipment: {} })
  const [resourceDirty, setResourceDirty] = useState({})
  const [resourceReset, setResourceReset] = useState(0)
  const requestSeq = useRef(0)
  const savedSnapshot = useRef({ form: emptyForm, usage: {} })
  const pendingTouch = useRef(null)
  const workTitleRef = useRef(null)

  const project = projectList.find((item) => String(item.id) === String(projectId))
  const register = daySummary.registers?.[0] || null
  const viewKey = `${projectId}|${workDate}`
  const dayReady = loadedKey === viewKey
  const country = project?.project_country
  const money = (value) => formatMoney(value, country)
  const notify = (text, tone = 'info') => setNotice(text ? { text, tone } : null)

  useEffect(() => { if (!projectId && projectList.length) setProjectId(String(projectList[0].id)) }, [projectId, projectList])

  const refresh = useCallback(async () => {
    if (!projectId) return false
    const seq = requestSeq.current + 1
    requestSeq.current = seq
    const key = `${projectId}|${workDate}`
    setLoading(true)
    setLoadError('')
    try {
      const [day, all, entries] = await Promise.all([
        workDate ? fetchCostToolSummary(projectId, workDate) : Promise.resolve({ registers: [], workflow: {} }),
        fetchCostToolSummary(projectId),
        fetchProjectTimelineEntries(projectId),
      ])
      if (seq !== requestSeq.current) return false
      setDaySummary(day || { registers: [], workflow: {} })
      setAllSummary(all || { registers: [], workflow: {} })
      setTimeline(Array.isArray(entries) ? entries : [])
      const row = day?.registers?.[0]
      const sameDayTimeline = workDate
        ? (entries || []).find((item) => dateKeyOf(item.date) === workDate && item.title !== 'Material Request') || (entries || []).find((item) => dateKeyOf(item.date) === workDate)
        : null
      const savedUsage = Object.fromEntries((day?.materials || []).map((item) => [item.material, Number(item.used_today || 0)]))
      const usageCost = (day?.materials || []).reduce((sum, item) => sum + (Number(item.used_today || 0) || 0) * (Number(item.rate || 0) || 0), 0)
      const savedMaterialCost = Number(row?.material_cost || 0)
      const nextForm = row ? {
        work_title: row.work_type || '',
        activity_category: row.activity_category || '',
        boq_reference: row.boq_reference || '',
        activity_unit: row.activity_unit || '',
        planned_quantity: row.planned_quantity ?? '',
        completed_quantity: row.completed_quantity ?? '',
        detailed_remarks: row.progress_note || '',
        labour_worker_count: Number(row.labour_worker_count || day.dashboard?.total_workers || 0),
        labour_cost: Number(row.labour_cost || day.dashboard?.labour_cost || 0),
        material_cost: isMaterialCostOverride(savedMaterialCost, usageCost) ? savedMaterialCost : '',
        equipment_cost: Number(row.equipment_cost || day.dashboard?.machinery_cost || 0),
        total_expenses: Number(row.total_expenses || day.dashboard?.expenses || 0),
        material_used: row.material_used || (day.material_usages || []).filter((item) => Number(item.quantity_used) > 0).map((item) => `${item.material} ${item.quantity_used} ${item.unit}`).join(', '),
        equipment_used: row.equipment_used || (day.machinery_usages || []).map((item) => `${item.machine} ${item.hours} hours`).join(', '),
        inspection_remarks: row.inspection_remarks || sameDayTimeline?.description || '',
      } : emptyForm
      setForm(nextForm)
      setUsedToday(savedUsage)
      savedSnapshot.current = { form: nextForm, usage: savedUsage }
      setPhotos([]); setVideos([]); setNotice(null); setFieldErrors({})
      setBoqOpen(Boolean(nextForm.activity_category || nextForm.boq_reference || nextForm.activity_unit || String(nextForm.planned_quantity ?? '') !== '' || String(nextForm.completed_quantity ?? '') !== ''))
      setLoadedKey(key)
      return true
    } catch (error) {
      if (seq !== requestSeq.current) return false
      setLoadError(apiErrorMessage(error, t('se.errLoad')))
      return false
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [projectId, workDate]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { setHistoryFilters(EMPTY_HISTORY_FILTERS); setTouched({}); setHistoryOpen(false) }, [projectId])

  const workflow = allSummary.workflow || daySummary.workflow || {}
  const beforeCutoff = workDate === workflow.local_date && String(workflow.local_time || '99:99') < String(workflow.cutoff || '24:00')
  const editable = !historyOnly && user?.role === 'ENGINEER' && beforeCutoff && !['COMPLETED', 'CLOSED'].includes(register?.status)
  const recordsByDate = useMemo(() => Object.fromEntries((allSummary.registers || []).map((item) => [dateKeyOf(item.work_date), item])), [allSummary.registers])
  const photosByDate = useMemo(() => {
    const grouped = {}
    timeline.forEach((entry) => {
      const key = dateKeyOf(entry.date)
      const count = (entry.images || []).filter((item) => item.media_type !== 'video').length
      if (key && count) grouped[key] = (grouped[key] || 0) + count
    })
    return grouped
  }, [timeline])
  const videosByDate = useMemo(() => {
    const grouped = {}
    timeline.forEach((entry) => {
      const key = dateKeyOf(entry.date)
      const count = (entry.images || []).filter((item) => item.media_type === 'video').length
      if (key && count) grouped[key] = (grouped[key] || 0) + count
    })
    return grouped
  }, [timeline])
  const materials = useMemo(() => {
    const source = (daySummary.materials && daySummary.materials.length ? daySummary.materials : allSummary.materials) || []
    return source.map((item) => {
      const available = Number(item.available ?? item.remaining ?? 0) || 0
      const used = Number(usedToday[item.material] ?? item.used_today ?? 0) || 0
      return { ...item, available, usedToday: used, remaining: available - used }
    })
  }, [daySummary, allSummary, usedToday])
  const historyEntries = useMemo(() => buildMaterialHistory(allSummary.materials || [], allSummary.registers || []), [allSummary.materials, allSummary.registers])
  useEffect(() => {
    const pending = pendingTouch.current
    if (!pending) return
    pendingTouch.current = null
    const marks = {}
    historyEntries.forEach((entry) => {
      const change = pending.changes[entry.material]
      if (!change || entry.workDate !== pending.workDate) return
      if (pending.registerId != null && entry.registerId != null && entry.registerId !== pending.registerId) return
      marks[entry.key] = { change, at: pending.at }
    })
    if (Object.keys(marks).length) setTouched((current) => ({ ...current, ...marks }))
  }, [historyEntries])
  const cells = useMemo(() => monthCells(month), [month])
  const recordDates = Object.keys(recordsByDate).sort()
  const dayNumber = project?.start_date ? workingDayNumber(project.start_date, workDate) : recordDates.includes(workDate) ? recordDates.indexOf(workDate) + 1 : null
  const uploadedMedia = useMemo(() => timeline.filter((item) => dateKeyOf(item.date) === workDate).flatMap((item) => item.images || []), [timeline, workDate])
  const uploadedImages = uploadedMedia.filter((item) => item.media_type !== 'video')
  const uploadedVideos = uploadedMedia.filter((item) => item.media_type === 'video')
  const todayKey = workflow.local_date || todayCalendarDate()
  const displayedStatus = register?.status || (workDate === workflow.local_date ? 'OPEN' : 'CLOSED')
  const activityCategoryOptions = useMemo(() => [...new Set([...(allSummary.registers || []).map((item) => item.activity_category).filter(Boolean), ...BASE_ACTIVITY_CATEGORIES])], [allSummary.registers])
  const activityUnitOptions = useMemo(() => [...new Set([
    ...(allSummary.registers || []).map((item) => item.activity_unit), ...(allSummary.inventory || []).map((item) => item.unit), ...BASE_ACTIVITY_UNITS,
  ].filter(Boolean))], [allSummary.registers, allSummary.inventory])
  const activitySummary = useMemo(() => {
    const planned = Number(form.planned_quantity)
    const completedToday = Number(form.completed_quantity)
    const saved = register?.boq_activity
    const savedToDate = Number(saved?.completed_to_date ?? 0) || 0
    const savedToday = Number(saved?.completed_today ?? 0) || 0
    const reference = (form.boq_reference || '').trim()
    const priorDays = reference && saved?.boq_reference === reference ? Math.max(0, savedToDate - savedToday) : 0
    const completedToDate = priorDays + (Number.isFinite(completedToday) ? completedToday : 0)
    if (!Number.isFinite(planned) || planned <= 0) return { planned: null, completedToDate, remaining: null, percent: null }
    return { planned, completedToDate, remaining: Math.max(0, planned - completedToDate), percent: Math.min(100, Math.round((completedToDate / planned) * 100)) }
  }, [form.planned_quantity, form.completed_quantity, form.boq_reference, register])

  const usage = todayUsageSummary(materials, usedToday)
  const materialCostFromUsage = usage.cost
  const materialCostOverridden = form.material_cost !== '' && form.material_cost != null
  const materialCost = Number(form.material_cost || 0) > 0 ? Number(form.material_cost || 0) : materialCostFromUsage
  const resourceIsDirty = Object.values(resourceDirty).some(Boolean)
  const dirty = resourceIsDirty || (editable && dayReady && (snapshotOf(form, usedToday) !== snapshotOf(savedSnapshot.current.form, savedSnapshot.current.usage) || photos.length > 0 || videos.length > 0))

  // Labour and equipment requests for the project, read once per project.
  useEffect(() => {
    if (!projectId) { setSupply({ projectId: '', labour: [], equipment: [], error: '' }); return undefined }
    let current = true
    setSupplyLogs({ labour: {}, equipment: {} })
    setResourceDirty({})
    Promise.allSettled([fetchProjectLaborRequests(projectId), fetchProjectEquipmentRequests(projectId)]).then(([labour, equipment]) => {
      if (!current) return
      setSupply({
        projectId,
        labour: labour.status === 'fulfilled' ? labour.value || [] : [],
        equipment: equipment.status === 'fulfilled' ? equipment.value || [] : [],
        error: labour.status === 'rejected' || equipment.status === 'rejected' ? t('se.res.loadError') : '',
      })
    })
    return () => { current = false }
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps
  const supplyReady = supply.projectId === projectId
  const dayLabour = useMemo(() => (workDate ? labourRequestsForDate(supply.labour, workDate) : []), [supply.labour, workDate])
  const dayRentals = useMemo(() => (workDate ? rentalsForDate(supply.equipment, workDate) : []), [supply.equipment, workDate])
  const purchases = useMemo(() => agreedPurchases(supply.equipment), [supply.equipment])
  const loadLabourLogs = useCallback(async (id) => {
    const records = await fetchLaborDailyRecords(id)
    setSupplyLogs((current) => ({ ...current, labour: { ...current.labour, [id]: records || [] } }))
  }, [])
  const loadRentalLogs = useCallback(async (id) => {
    const logs = await fetchEquipmentUsage(id)
    setSupplyLogs((current) => ({ ...current, equipment: { ...current.equipment, [id]: logs || [] } }))
  }, [])
  useEffect(() => {
    const failed = () => setSupply((current) => ({ ...current, error: t('se.res.loadError') }))
    dayLabour.filter((request) => !supplyLogs.labour[request.id]).forEach((request) => loadLabourLogs(request.id).catch(failed))
    dayRentals.filter((rental) => !supplyLogs.equipment[rental.id]).forEach((rental) => loadRentalLogs(rental.id).catch(failed))
  }, [dayLabour, dayRentals]) // eslint-disable-line react-hooks/exhaustive-deps
  const markResourceDirty = useCallback((key, value) => setResourceDirty((current) => (Boolean(current[key]) === value ? current : { ...current, [key]: value })), [])
  const canRecord = (request) => !historyOnly && canRecordOnDate(request, { userId: user?.id, role: user?.role, date: workDate, todayKey })
  const rentalCharges = dayRentals.map((rental) => {
    const log = recordForDate(supplyLogs.equipment[rental.id] || [], workDate, 'usage_date')
    return rentalChargeForDate(rental, workDate, log ? log.hours_used : null)
  })
  const costSummary = dailyCostSummary({ materialCost, labourCost: Number(form.labour_cost || 0), otherEquipmentCost: Number(form.equipment_cost || 0), otherExpenses: Number(form.total_expenses || 0), rentalCharges })
  const crew = dayLabour.reduce((totals, request) => {
    const record = recordForDate(supplyLogs.labour[request.id] || [], workDate)
    return { present: totals.present + (record ? Number(record.present_count || 0) + Number(record.half_day_count || 0) : 0), allocated: totals.allocated + Number(request.workers_allocated || 0) }
  }, { present: 0, allocated: 0 })
  const receivedOrders = daySummary.received_orders || []
  const receivedValue = receivedOrders.reduce((total, order) => total + (Number(order.amount) || 0), 0)
  const paidOutToday = (daySummary.payments || []).filter((payment) => String(payment.direction).toUpperCase() === 'OUT').reduce((total, payment) => total + (Number(payment.amount) || 0), 0)
  const recordableResources = [...dayLabour, ...dayRentals].some(canRecord)

  // Leaving with unsaved edits asks first (the web's beforeunload).
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty
  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (!dirtyRef.current) return
    event.preventDefault()
    Alert.alert(t('se.form.unsaved'), t('se.form.confirmDiscard'), [
      { text: t('dash.common.cancel'), style: 'cancel' },
      { text: t('se.form.discard'), style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
    ])
  }), [navigation, t])
  const confirmLeave = async () => !dirty || confirmAsync(t('se.form.unsaved'), t('se.form.confirmDiscard'), t('se.form.discard'), t('dash.common.cancel'))

  const unitLabel = (unit) => {
    const value = String(unit || '')
    if (!value) return ''
    if (ACTIVITY_UNIT_KEYS[value]) return t(ACTIVITY_UNIT_KEYS[value])
    return UNIT_SYMBOLS.has(value.toLowerCase()) ? value : td(value)
  }
  const update = (key) => (value) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (fieldErrors[key]) setFieldErrors((current) => ({ ...current, [key]: '' }))
  }
  const updateUsage = (material, value) => {
    setUsedToday((current) => ({ ...current, [material]: value.replace(/[^\d.]/g, '') }))
    if (fieldErrors.materials?.[material]) setFieldErrors((current) => ({ ...current, materials: { ...current.materials, [material]: '' } }))
  }
  const selectCalendarDate = async (key) => {
    if (key !== workDate && !(await confirmLeave())) return
    resetResources()
    setWorkDate(key)
  }
  const backToCalendar = async () => {
    if (!(await confirmLeave())) return
    resetResources()
    setWorkDate('')
  }
  const selectProject = async (value) => {
    if (!value || value === projectId) return
    if (!(await confirmLeave())) return
    resetResources()
    setProjectId(value)
    setWorkDate('')
  }
  const reload = async () => { if (await confirmLeave()) { resetResources(); refresh() } }
  // Selecting another date or project leaves the cards' unsaved edits behind.
  const resetResources = () => { setResourceDirty({}); setResourceReset((count) => count + 1) }
  const discardChanges = () => {
    const saved = savedSnapshot.current
    setForm(saved.form); setUsedToday(saved.usage)
    setPhotos([]); setVideos([]); setFieldErrors({}); setNotice(null)
    resetResources()
  }
  const showHistoryFor = (material) => {
    setHistoryFilters({ ...EMPTY_HISTORY_FILTERS, material })
    setHistoryOpen(true)
  }

  const validate = () => {
    const errors = {}
    if (!String(form.work_title || '').trim()) errors.work_title = t('se.form.errWorkTitle')
    const materialErrors = {}
    materials.forEach((item) => {
      const used = Number(usedToday[item.material] ?? 0) || 0
      if (used > item.available) materialErrors[item.material] = t('se.errOnlyAvailable', { qty: formatQty(item.available), unit: unitLabel(item.unit), material: td(item.material) })
      else if (used < 0) materialErrors[item.material] = t('se.errNegative', { material: td(item.material) })
    })
    if (Object.keys(materialErrors).length) errors.materials = materialErrors
    return errors
  }

  async function save(action) {
    if (!editable || saving) return
    const errors = validate()
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      notify(errors.work_title || t('se.form.errFix'), 'error')
      if (errors.work_title) workTitleRef.current?.focus()
      else if (errors.materials) { setUsageSearch(''); setUsedOnly(false) }
      return
    }
    if (action === 'CLOSED' && !(await confirmAsync(t('se.form.closeDay'), t('se.form.confirmCloseDay'), t('se.form.closeDay'), t('dash.common.cancel')))) return
    const payload = new FormData()
    payload.append('work_date', workDate)
    payload.append('action', action)
    Object.entries(form).forEach(([key, value]) => {
      if (key === 'material_cost') return
      payload.append(key, numericFields.has(key) ? String(Number(value) || 0) : String(value ?? ''))
    })
    payload.append('material_cost', String(materialCost))
    payload.append('material_usage', JSON.stringify(materials.map((item) => ({ product_id: item.product_id ?? null, material_name: item.material, unit: item.unit || '', quantity_used: Number(usedToday[item.material] ?? 0) || 0 }))))
    photos.forEach((photo, index) => payload.append('images', assetPart(photo, `site-photo-${index + 1}.jpg`, 'image/jpeg')))
    videos.forEach((video, index) => payload.append('videos', assetPart(video, `site-video-${index + 1}.mp4`, 'video/mp4')))
    const submittedUsage = Object.fromEntries(materials.map((item) => [item.material, Number(usedToday[item.material] ?? 0) || 0]))
    const changes = usageChanges(savedSnapshot.current.usage, submittedUsage)
    setSaving(action)
    setNotice(null)
    try {
      await saveDailyWorkflow(projectId, payload)
      pendingTouch.current = Object.keys(changes).length ? { changes, workDate, registerId: register?.id ?? null, at: Date.now() } : null
      await refresh()
      notify(action === 'CLOSED' ? t('se.dayClosed') : t('se.progressSaved'), 'success')
    } catch (error) {
      notify(apiErrorMessage(error, t('se.errSave')), 'error')
    } finally {
      setSaving('')
    }
  }

  async function deleteMedia(item) {
    if (!editable) return
    const video = item.media_type === 'video'
    if (!(await confirmAsync(t(video ? 'se.deleteVideo' : 'se.deletePhoto'), t('se.confirmDeletePhoto'), t(video ? 'se.deleteVideo' : 'se.deletePhoto'), t('dash.common.cancel')))) return
    setSaving('MEDIA')
    try {
      await deleteProjectPhoto(item.id)
      // Deleting reloads the day; what was typed so far is kept.
      const keep = { form, usedToday, photos, videos }
      await refresh()
      setForm(keep.form); setUsedToday(keep.usedToday); setPhotos(keep.photos); setVideos(keep.videos)
      notify(t('se.photoDeleted'), 'success')
    } catch (error) {
      notify(apiErrorMessage(error, t('se.errDeletePhoto')), 'error')
    } finally {
      setSaving('')
    }
  }

  async function pickMedia(kind) {
    // The system picker needs no media permission.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [kind === 'video' ? 'videos' : 'images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    })
    if (result.canceled || !result.assets?.length) return
    if (kind === 'video') setVideos(result.assets)
    else setPhotos(result.assets)
  }

  const usageRows = materials.filter((item) => {
    const used = Number(usedToday[item.material] ?? 0) || 0
    if ((usedOnly || !editable) && used <= 0 && !fieldErrors.materials?.[item.material]) return false
    const search = usageSearch.trim().toLowerCase()
    return !search || item.material.toLowerCase().includes(search) || String(td(item.material)).toLowerCase().includes(search)
  })
  const legend = [
    { key: 'text', label: t('se.cal.text'), tone: CELL_TONES.text },
    { key: 'photo', label: t('se.cal.photo'), tone: CELL_TONES.photo },
    { key: 'video', label: t('se.cal.video'), tone: CELL_TONES.video },
    { key: 'all', label: t('se.cal.textMedia'), tone: CELL_TONES.all },
    { key: 'open', label: t('ui.status.open'), tone: CELL_TONES.open },
  ]
  const progressValue = !project ? '—' : completionPercent(project) !== null ? completionText(project, t) : project.work_started !== true ? t('progress.scheduleNotStarted') : scheduleText(project, t) || '—'



  return (
    <DashboardShell refreshing={false} onRefresh={reload} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <Section>
        <View style={styles.topRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
            <ChevronLeft size={17} color={COLORS.brand[700]} />
            <Text style={styles.backText}>{t('ui.myProjects')}</Text>
          </Pressable>
          <View style={styles.topActions}>
            {projectList.length > 1 ? (
              <SelectChip
                placeholder={t('se.selectProject')}
                value={projectId}
                onChange={selectProject}
                options={projectList.map((item) => ({ value: String(item.id), label: td(item.title) }))}
              />
            ) : null}
            <Pressable onPress={reload} disabled={!projectId || loading} accessibilityLabel={t('se.form.reload')} style={styles.iconButton}>
              {loading ? <ActivityIndicator size="small" color={COLORS.brand[700]} /> : <RefreshCw size={16} color={COLORS.slate[600]} />}
            </Pressable>
          </View>
        </View>

        {!workDate ? <Notice tone={notice?.tone === 'error' ? 'error' : notice?.tone === 'success' ? 'success' : 'info'} text={notice?.text} /> : null}
        {loadError && !workDate ? (
          <View style={styles.errorRow}>
            <Notice tone="error" text={loadError} />
            <Pressable onPress={refresh} style={styles.retry}><Text style={styles.retryText}>{t('se.form.retry')}</Text></Pressable>
          </View>
        ) : null}
        {!projectId && !projects.loading ? <Text style={styles.dashed}>{t('dash.engineer.noAssignedProjects')}</Text> : null}

        {/* Month calendar: tap a date to open its record below. */}
        {projectId && !historyOnly && !workDate ? (
          <View style={styles.calendar}>
            <View style={styles.calendarHead}>
              <View style={styles.inline}>
                               <CalendarDays size={16} color={ink('#03572E')} />
                <Text style={styles.monthTitle}>{`${t(`se.month.${month.getMonth()}`)} ${month.getFullYear()}`}</Text>
              </View>
              <View style={styles.inline}>
                <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} accessibilityLabel={t('se.cal.prevMonth')} style={styles.monthButton}>
                  <ChevronLeft size={15} color={COLORS.graphite} />
                </Pressable>
                <Pressable onPress={() => { const [y, m] = todayKey.split('-').map(Number); setMonth(new Date(y, m - 1, 1)) }} style={styles.todayButton}>
                  <Text style={styles.todayText}>{t('se.cal.today')}</Text>
                </Pressable>
                <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} accessibilityLabel={t('se.cal.nextMonth')} style={styles.monthButton}>
                  <ChevronRight size={15} color={COLORS.graphite} />
                </Pressable>
              </View>
            </View>
            <View style={styles.weekRow}>
              {WEEKDAYS.map((weekday) => <Text key={weekday} style={styles.weekday} numberOfLines={1}>{t(`se.weekday.${weekday}`)}</Text>)}
            </View>
            <View style={styles.grid}>
              {cells.map((date, index) => {
                if (!date) return <View key={`blank-${index}`} style={styles.cellSlot} />
                const key = todayCalendarDate(date)
                const row = recordsByDate[key]
                const hasPhotos = (photosByDate[key] || 0) > 0
                const hasVideo = (videosByDate[key] || 0) > 0
                const hasMedia = hasPhotos || hasVideo
                const hasText = hasEnteredText(row)
                const isSunday = date.getDay() === 0
                const current = key === todayKey
                const future = key > todayKey
                const closed = key < todayKey || ['CLOSED', 'COMPLETED'].includes(row?.status)
                const isClosed = isSunday || (closed && !hasText && !hasMedia)
                const isOpen = current && !isSunday && !hasText && !hasMedia
                const tone = isOpen ? CELL_TONES.open : hasText && hasPhotos && hasVideo ? CELL_TONES.all : hasVideo ? CELL_TONES.video : hasPhotos ? CELL_TONES.photo : hasText ? CELL_TONES.text : null
                const contentKey = CONTENT_LABEL_KEYS[`${hasText ? 1 : 0}${hasPhotos ? 1 : 0}${hasVideo ? 1 : 0}`]
                const label = isSunday ? t('se.cal.holiday') : isOpen ? statusLabel('OPEN', t) : contentKey ? t(contentKey) : ''
                const empty = key < todayKey && !row && !hasMedia && !hasResourceOnDate(supply.labour, supply.equipment, key)
                return (
                  <View key={key} style={styles.cellSlot}>
                    <Pressable
                      onPress={() => selectCalendarDate(key)}
                      disabled={future || isSunday || empty}
                      accessibilityLabel={`${formatDate(key, key, { weekday: 'long', day: 'numeric', month: 'long' })}, ${label || (isClosed ? statusLabel('CLOSED', t) : t('se.cal.noEntry'))}`}
                      style={[styles.cell, tone ? { backgroundColor: `${tone[1]}1F` } : null, future || isSunday ? styles.cellDisabled : null]}
                    >
                      <View style={[styles.cellNumber, current ? styles.cellToday : null]}>
                        <Text style={[styles.cellDate, current ? styles.cellDateToday : null]}>{date.getDate()}</Text>
                      </View>
                      {tone ? (
                        <View style={styles.cellTag}>
                          <View style={[styles.cellDot, { backgroundColor: tone[1] }]} />
                          <Text style={[styles.cellLabel, { color: ink(tone[1]) }]} numberOfLines={2}>{label}</Text>                    
                              </View>
                      ) : isSunday ? (
                        <Lock size={10} color={ink('#94a3b8')} style={{ marginTop: 4 }} />                      ) : isClosed ? (
                        <Text style={[styles.cellLabel, { color: ink('#8B929D') }]} numberOfLines={1}>{statusLabel('CLOSED', t)}</Text>                      ) : null}
                    </Pressable>
                  </View>
                )
              })}
            </View>
            <View style={styles.legend}>
              {legend.map((item) => (
                <View key={item.key} style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: `${item.tone[1]}1F` }]}><View style={[styles.legendDot, { backgroundColor: item.tone[1] }]} /></View>
                  <Text style={[styles.legendText, { color: ink(item.tone[1]) }]}>{item.label}</Text>    
                              </View>
              ))}
              <View style={styles.legendItem}>
                <View style={styles.legendClosed} />
                <Text style={styles.legendText}>{t('se.cal.closed')}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Daily Logs: every saved record, newest first. */}
        {projectId && historyOnly && !workDate ? (
          <View style={styles.card}>
            <View style={styles.inline}>
              <CalendarDays size={16} color={COLORS.brand[700]} />
              <Text style={styles.cardTitle}>{t('se.savedDailyRecords')}</Text>
            </View>
            {(allSummary.registers || []).length ? (
              <View style={styles.logList}>
                {[...(allSummary.registers || [])].sort((a, b) => String(b.work_date).localeCompare(String(a.work_date))).map((row) => (
                  <Pressable key={row.id || row.work_date} onPress={() => selectCalendarDate(dateKeyOf(row.work_date))} style={styles.logRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logTitle}>{td(row.work_type) || t('se.dailySiteRecord')}</Text>
                      <Text style={styles.small}>
                        {formatDate(row.work_date, row.work_date)}{row.last_updated_at ? ` · ${t('se.lastUpdated')}: ${formatTime(row.last_updated_at)}` : ''}{row.created_by_name ? ` · ${td(row.created_by_name)}` : ''} · {t('se.workers', { count: row.labour_worker_count || 0 })}
                      </Text>
                    </View>
                    <Tag tone={['CLOSED', 'COMPLETED'].includes(row.status) ? 'calc' : 'ok'}>{statusLabel(row.status, t)}</Tag>
                  </Pressable>
                ))}
              </View>
            ) : <Text style={styles.dashed}>{t('se.noDailyLogs')}</Text>}
          </View>
        ) : null}

        {projectId && !workDate && !historyOnly ? <Text style={styles.dashed}>{t('se.clickAvailableDate')}</Text> : null}

        {/* The selected day */}
        {workDate ? (
          <View style={styles.day}>
            <View style={styles.dayHead}>
              <View style={styles.dayHeadRow}>
                <Pressable onPress={backToCalendar} style={styles.backToCalendar}>
                  <ChevronLeft size={15} color={ink('#03572E')} />
                                    <Text style={styles.backToCalendarText}>{historyOnly ? t('se.savedDailyRecords') : t('se.cal.backToCalendar')}</Text>
                </Pressable>
                {project ? (
                  <Pressable onPress={() => navigation.navigate('LiveCamera', { projectId: project.id, projectTitle: project.title })} style={styles.liveButton}>
                    <Camera size={14} color="#ffffff" />
                    <Text style={styles.liveText}>{t('dash.engineer.hero.liveCamera')}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.dayTitle} numberOfLines={2}>{td(project?.title)}</Text>
              <Text style={styles.dayDate}>{dayNumber ? `${t('se.day')} ${dayNumber} · ` : ''}{formatDate(workDate, workDate, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</Text>
              {dayReady && (register?.last_updated_at || register?.created_by_name) ? (
                <Text style={styles.small}>
                  {register?.last_updated_at ? `${t('se.lastUpdated')}: ${formatTime(register.last_updated_at)}` : ''}
                  {register?.last_updated_at && register?.created_by_name ? ' · ' : ''}
                  {register?.created_by_name ? `${t('se.siteEngineer')}: ${td(register.created_by_name)}` : ''}
                </Text>
              ) : null}
              {dayReady ? (
                <View style={{ marginTop: 7, flexDirection: 'row' }}>
                  <Tag tone={['CLOSED', 'COMPLETED'].includes(displayedStatus) ? 'calc' : displayedStatus === 'IN_PROGRESS' ? 'entered' : 'ok'}>{statusLabel(displayedStatus, t)}</Tag>
                </View>
              ) : null}
            </View>

            {!dayReady ? (
              loadError ? (
                <View style={styles.dayBody}>
                  <Notice tone="error" text={loadError} />
                  <Pressable onPress={refresh} style={styles.retry}><Text style={styles.retryText}>{t('se.form.retry')}</Text></Pressable>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={COLORS.brand[700]} />
                  <Text style={styles.small}>{t('se.form.loadingDay')}</Text>
                </View>
              )
            ) : (
              <View style={styles.dayBody}>
                {/* The day at a glance */}
                <View style={styles.glanceGrid}>
                  <GlanceStat label={t('se.glance.work')} value={form.work_title ? td(form.work_title) : t('se.glance.noWork')} />
                  <GlanceStat label={t('se.glance.progress')} value={progressValue} sub={activitySummary.percent !== null ? `${t('se.activityProgress')}: ${activitySummary.percent}%` : project && completionPercent(project) !== null ? scheduleText(project, t) : ''} />
                  <GlanceStat label={t('se.glance.materials')} value={usage.usedCount ? money(materialCost) : t('se.glance.none')} sub={usage.usedCount ? t('se.res.materialCount', { count: usage.usedCount }) : ''} />
                  <GlanceStat label={t('se.res.glanceLabour')} value={dayLabour.length ? t('se.res.presentOf', { present: crew.present, allocated: crew.allocated }) : String(Number(form.labour_worker_count) || 0)} sub={dayLabour.length ? t('se.res.crewCount', { count: dayLabour.length }) : t('se.glance.workers')} />
                  <GlanceStat label={t('se.res.glanceEquipment')} value={money(costSummary.rental + costSummary.otherEquipment)} sub={costSummary.unpricedRentals ? t('se.res.unpricedShort', { count: costSummary.unpricedRentals }) : dayRentals.length ? t('se.res.rentalCount', { count: dayRentals.length }) : ''} />
                  <GlanceStat label={t('se.res.dayTotal')} value={money(costSummary.total)} sub={paidOutToday > 0 ? t('se.res.paidOutShort', { amount: money(paidOutToday) }) : ''} />
                </View>
                {supply.error ? <Notice tone="error" text={supply.error} /> : null}
                {editable ? <Text style={styles.small}><Text style={styles.required}>* </Text>{t('se.form.requiredHint')}</Text> : null}

                {/* Work done */}
                <FormSection title={t('se.form.sectionWork')}>
                  <Field label={t('se.form.workTitle')} required={editable} error={fieldErrors.work_title}>
                    <Input inputRef={workTitleRef} value={String(form.work_title)} onChangeText={update('work_title')} editable={editable} invalid={Boolean(fieldErrors.work_title)} placeholder={editable ? t('se.form.workTitlePlaceholder') : ''} maxLength={200} />
                  </Field>
                  <Field label={t('se.form.workDescription')} optional={editable}>
                    <Input multiline value={String(form.detailed_remarks)} onChangeText={update('detailed_remarks')} editable={editable} placeholder={editable ? t('se.form.workDescriptionPlaceholder') : ''} />
                  </Field>
                  <Field label={t('se.inspectionRemarks')} optional={editable}>
                    <Input multiline value={String(form.inspection_remarks)} onChangeText={update('inspection_remarks')} editable={editable} placeholder={editable ? t('se.form.inspectionPlaceholder') : ''} />
                  </Field>
                </FormSection>

                {/* Progress (read-only, calculated by the server) and the optional BOQ activity */}
                <FormSection title={t('se.form.sectionProgress')}>
                  {project && completionPercent(project) !== null ? (
                    <Field label={t('progress.completion')} hint={t('progress.autoHint')}>
                      <Text style={styles.readValue}>{completionText(project, t)}</Text>
                    </Field>
                  ) : null}
                  <Field label={t('progress.schedule')}>
                    <Text style={styles.readValue}>{(project && scheduleText(project, t)) || '—'}</Text>
                  </Field>
                  <View style={styles.fold}>
                    <Pressable onPress={() => setBoqOpen((value) => !value)} style={styles.foldHead}>
                      <Text style={styles.foldTitle}>{t('se.form.boqTitle')} <Text style={styles.optional}>({t('se.form.optional')})</Text></Text>
                      <View style={styles.inline}>
                        {activitySummary.percent !== null ? <Text style={styles.small}>{activitySummary.percent}%</Text> : null}
                        <ChevronDown size={15} color={COLORS.slate[500]} style={boqOpen ? { transform: [{ rotate: '180deg' }] } : null} />
                      </View>
                    </Pressable>
                    {boqOpen ? (
                      <View style={styles.foldBody}>
                        <Text style={styles.small}>{t('se.form.boqHint')}</Text>
                        <Field label={t('se.activityCategory')}>
                          <Input value={String(form.activity_category)} onChangeText={update('activity_category')} editable={editable} onFocus={() => setFocusField('category')} onBlur={() => setFocusField('')} />
                          <Suggestions
                            visible={editable && focusField === 'category'}
                            options={activityCategoryOptions}
                            labelOf={(option) => optionLabel(t, ACTIVITY_CATEGORY_KEYS, option)}
                            onPick={(option) => update('activity_category')(option)}
                          />
                        </Field>
                        <Field label={t('se.boqReference')}>
                          <Input value={String(form.boq_reference)} onChangeText={update('boq_reference')} editable={editable} />
                        </Field>
                        <View style={styles.pair}>
                          <View style={{ flex: 1 }}>
                            <Field label={t('se.plannedQuantity')}>
                              <Input value={String(form.planned_quantity)} onChangeText={(value) => update('planned_quantity')(value.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" editable={editable} />
                            </Field>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Field label={t('se.form.completedToday')}>
                              <Input value={String(form.completed_quantity)} onChangeText={(value) => update('completed_quantity')(value.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" editable={editable} />
                            </Field>
                          </View>
                        </View>
                        <Field label={t('se.activityUnit')}>
                          <Input value={String(form.activity_unit)} onChangeText={update('activity_unit')} editable={editable} onFocus={() => setFocusField('unit')} onBlur={() => setFocusField('')} />
                          <Suggestions
                            visible={editable && focusField === 'unit'}
                            options={activityUnitOptions}
                            labelOf={(option) => optionLabel(t, ACTIVITY_UNIT_KEYS, option)}
                            onPick={(option) => update('activity_unit')(option)}
                          />
                        </Field>
                        <Field label={t('se.activityProgress')}>
                          <View style={styles.progressBox}>
                            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${activitySummary.percent ?? 0}%` }]} /></View>
                            <Text style={styles.readValue}>{activitySummary.percent === null ? '—' : `${activitySummary.percent}%`}</Text>
                          </View>
                        </Field>
                        <Text style={styles.small}>
                          {activitySummary.remaining === null
                            ? t('se.remainingNotSet')
                            : t('se.form.activityReadout', { done: formatQty(activitySummary.completedToDate), planned: formatQty(activitySummary.planned), remaining: formatQty(activitySummary.remaining), unit: unitLabel(form.activity_unit) })}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </FormSection>

                {/* Materials used */}
                <FormSection
                  title={t('se.form.sectionMaterials')}
                  aside={materials.length > 0 ? <Text style={styles.small}>{`${t('se.mat.summary', { used: usage.usedCount, total: usage.stockCount })}${usage.cost > 0 ? ` · ${money(usage.cost)}` : ''}`}</Text> : null}
                >
                  {materials.length > 0 && editable ? (
                    <View style={styles.materialTools}>
                      <View style={styles.search}>
                        <Search size={15} color={COLORS.slate[400]} />
                        <TextInput value={usageSearch} onChangeText={setUsageSearch} placeholder={t('se.mat.search')} placeholderTextColor={COLORS.slate[400]} style={styles.searchInput} />
                      </View>
                      <Pressable onPress={() => setUsedOnly((value) => !value)} style={[styles.toggle, usedOnly ? styles.toggleOn : null]}>
                        <Text style={[styles.toggleText, usedOnly ? styles.toggleTextOn : null]}>{t('se.mat.usedOnly')}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {usageRows.map((item) => {
                    const usedQty = Number(usedToday[item.material] ?? 0) || 0
                    const rate = Number(item.rate ?? 0) || 0
                    const rowError = fieldErrors.materials?.[item.material]
                    const stock = STOCK_TONES[stockStatusKey(item.remaining, item.minimum_stock)]
                    return (
                      <View key={item.material} style={[styles.materialRow, rowError ? styles.materialError : usedQty > 0 ? styles.materialUsed : null]}>
                        <View style={styles.materialTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.materialName}>{td(item.material)}</Text>
                            {item.specification || item.supplier_name ? <Text style={styles.small}>{[item.specification ? td(item.specification) : '', item.supplier_name ? td(item.supplier_name) : ''].filter(Boolean).join(' · ')}</Text> : null}
                            <Text style={styles.small}>{usedQty > 0 ? t('se.mat.leftAfter', { qty: formatQty(item.remaining), unit: unitLabel(item.unit) }) : t('se.mat.inStock', { qty: formatQty(item.available), unit: unitLabel(item.unit) })}</Text>
                          </View>
                                                  <View style={[styles.stockTag, { backgroundColor: soft(stock[0], stock[1]) }]}>
                            <Text style={[styles.stockText, { color: ink(stock[1]) }]}>{t(`se.stock.${stockStatusKey(item.remaining, item.minimum_stock)}`)}</Text>
                          </View>
                        </View>
                        <View style={styles.materialBottom}>
                          <Text style={styles.small}>{rate > 0 ? `${t('se.rate')}: ${money(rate)}/${unitLabel(item.unit)}` : `${t('se.rate')}: —`}</Text>
                          {editable ? (
                            <View style={styles.inline}>
                              <TextInput
                                value={String(usedToday[item.material] ?? 0)}
                                onChangeText={(value) => updateUsage(item.material, value)}
                                keyboardType="decimal-pad"
                                selectTextOnFocus
                                accessibilityLabel={`${t('se.usedToday')}: ${td(item.material)}`}
                                style={[styles.usageInput, rowError ? styles.inputInvalid : null]}
                              />
                              <Text style={styles.small}>{unitLabel(item.unit)}</Text>
                            </View>
                          ) : (
                            <Text style={styles.materialName}>{`${formatQty(usedQty)} ${unitLabel(item.unit)}`}</Text>
                          )}
                          <Text style={styles.materialName}>{rate > 0 && usedQty > 0 ? money(usedQty * rate) : '—'}</Text>
                        </View>
                        {rowError ? <Text style={styles.fieldError}>{rowError}</Text> : null}
                        {historyEntries.some((entry) => entry.material === item.material) ? (
                          <Pressable onPress={() => showHistoryFor(item.material)} style={styles.historyLink}>
                            <HistoryIcon size={12} color={COLORS.brand[700]} />
                            <Text style={styles.linkText}>{t('se.mat.viewHistory')}</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )
                  })}
                  {!usageRows.length ? (
                    <Text style={styles.dashedSmall}>{!materials.length ? t('se.noMaterials') : usageSearch.trim() ? t('se.mat.noMatch') : t('se.mat.noneUsed')}</Text>
                  ) : null}
                  <Field label={t('se.form.materialCost')} hint={!materialCostOverridden ? t('se.form.materialCostAuto') : ''}>
                    {editable && materialCostOverridden ? (
                      <>
                        <Input value={String(form.material_cost)} onChangeText={(value) => update('material_cost')(value.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" />
                        <Pressable onPress={() => update('material_cost')('')}><Text style={styles.linkText}>{t('se.form.materialCostUseAuto', { amount: money(materialCostFromUsage) })}</Text></Pressable>
                      </>
                    ) : (
                      <View style={styles.readBox}>
                        <Text style={styles.readValue}>{money(materialCost)}</Text>
                        {editable ? <Pressable onPress={() => update('material_cost')(String(materialCostFromUsage))}><Text style={styles.linkText}>{t('se.form.materialCostEdit')}</Text></Pressable> : null}
                      </View>
                    )}
                    <BudgetInWords value={materialCost} country={country} style={styles.words} />
                  </Field>
                  <Field label={t('se.form.materialNotes')} optional={editable} hint={editable ? t('se.form.materialNotesHint') : ''}>
                    <Input value={String(form.material_used)} onChangeText={update('material_used')} editable={editable} />
                  </Field>
                  <ReceivedMaterials orders={receivedOrders} country={country} unitLabel={unitLabel} />
                </FormSection>

                                              {/* Labour */}
                <FormSection title={t('se.form.sectionLabour')} aside={dayLabour.length > 0 ? <Text style={styles.small}>{t('se.res.presentOf', { present: crew.present, allocated: crew.allocated })}</Text> : null}>
                  {supplyReady ? (
                    <LabourCards requests={dayLabour} date={workDate} recordsById={supplyLogs.labour} canRecord={canRecord} onSaved={loadLabourLogs} onDirtyChange={markResourceDirty} resetSignal={resourceReset} />
                  ) : (
                    <View style={styles.loadingRow}><ActivityIndicator size="small" color={COLORS.brand[700]} /><Text style={styles.small}>{t('se.res.loading')}</Text></View>
                  )}
                  <View style={styles.pair}>
                    <View style={{ flex: 1 }}>
                      <Field label={t('se.form.workers')}>
                        <Input value={String(form.labour_worker_count)} onChangeText={(value) => update('labour_worker_count')(value.replace(/\D/g, ''))} keyboardType="number-pad" editable={editable} />
                      </Field>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label={t('se.form.labourCost')} hint={t('se.res.labourManualHint')}>
                        <Input value={String(form.labour_cost)} onChangeText={(value) => update('labour_cost')(value.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" editable={editable} />
                        <BudgetInWords value={form.labour_cost} country={country} style={styles.words} />
                      </Field>
                    </View>
                  </View>
                  <PaymentsList payments={daySummary.payments || []} country={country} />
                </FormSection>

                {/* Equipment */}
                <FormSection title={t('se.form.sectionEquipment')} aside={dayRentals.length > 0 ? <Text style={styles.small}>{t('se.res.rentalsToday', { amount: money(costSummary.rental) })}</Text> : null}>
                  {supplyReady ? (
                    <RentalCards rentals={dayRentals} date={workDate} logsById={supplyLogs.equipment} canRecord={canRecord} country={country} onSaved={loadRentalLogs} onDirtyChange={markResourceDirty} resetSignal={resourceReset} />
                  ) : (
                    <View style={styles.loadingRow}><ActivityIndicator size="small" color={COLORS.brand[700]} /><Text style={styles.small}>{t('se.res.loading')}</Text></View>
                  )}
                  <PurchasedEquipment purchases={purchases} country={country} />
                  <View style={styles.subtleBox}>
                    <Field label={t('se.res.otherEquipment')} optional={editable} hint={editable ? t('se.res.otherEquipmentHint') : ''}>
                      <Input value={String(form.equipment_used)} onChangeText={update('equipment_used')} editable={editable} placeholder={editable ? t('se.form.equipmentPlaceholder') : ''} />
                    </Field>
                    <Field label={t('se.res.otherEquipmentCost')}>
                      <Input value={String(form.equipment_cost)} onChangeText={(value) => update('equipment_cost')(value.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" editable={editable} />
                      <BudgetInWords value={form.equipment_cost} country={country} style={styles.words} />
                    </Field>
                  </View>
                </FormSection>

                {/* Photos & videos */}
                <FormSection title={t('se.form.sectionMedia')}>
                  <Text style={styles.small}>{t('se.res.photosHint')}</Text>
                  {editable ? (
                    <Pressable onPress={() => pickMedia('photo')} style={styles.addMedia}>
                      <View style={styles.addCircle}><Plus size={18} color="#ffffff" /></View>
                      <Text style={styles.addText}>{photos.length ? t('se.photosSelected', { count: photos.length }) : t('se.addSitePhotos')}</Text>
                    </Pressable>
                  ) : null}
                  {photos.length > 0 ? (
                    <View style={styles.mediaBlock}>
                      <Text style={styles.mediaReady}>{t('se.photosReady', { count: photos.length })}</Text>
                      <View style={styles.thumbs}>
                        {photos.map((photo, index) => (
                          <View key={photo.uri} style={styles.thumbWrap}>
                            <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
                            <Pressable onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))} accessibilityLabel={t('se.removePhoto')} style={styles.removeDot}>
                              <X size={12} color="#ffffff" />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {uploadedImages.length > 0 ? (
                    <View style={styles.uploaded}>
                      <Text style={styles.uploadedTitle}>{`✓ ${t('se.photosUploaded', { count: uploadedImages.length })}`}</Text>
                      <View style={styles.thumbs}>
                        {uploadedImages.map((image) => (
                          <View key={image.id || image.image_url} style={styles.thumbWrap}>
                            <Pressable onPress={() => setPhotoViewer(image)}>
                              <Image source={{ uri: imageUrl(image.image_url) }} style={styles.thumb} contentFit="cover" />
                            </Pressable>
                            {editable ? (
                              <Pressable onPress={() => deleteMedia(image)} disabled={Boolean(saving)} accessibilityLabel={t('se.deletePhoto')} style={styles.removeDot}>
                                <X size={12} color="#ffffff" />
                              </Pressable>
                            ) : null}
                          </View>
                        ))}
                      </View>
                      {editable ? <Text style={styles.small}>{t('se.tapToDelete')}</Text> : null}
                    </View>
                  ) : null}
                  {!editable && !uploadedImages.length ? <Text style={styles.dashedSmall}>{t('se.noSitePhotos')}</Text> : null}

                  {editable ? (
                    <Pressable onPress={() => pickMedia('video')} style={styles.addMedia}>
                      <View style={styles.addCircle}><Plus size={18} color="#ffffff" /></View>
                      <Text style={styles.addText}>{videos.length ? t('se.videosSelected', { count: videos.length }) : t('se.addSiteVideos')}</Text>
                    </Pressable>
                  ) : null}
                  {videos.length > 0 ? (
                    <View style={styles.mediaBlock}>
                      <Text style={styles.mediaReady}>{t('se.videosReady', { count: videos.length })}</Text>
                      {videos.map((video, index) => (
                        <View key={video.uri} style={styles.videoRow}>
                          <Text style={[styles.small, { flex: 1 }]} numberOfLines={1}>{video.fileName || `${t('se.cal.video')} ${index + 1}`}</Text>
                          <Pressable onPress={() => setVideos((current) => current.filter((_, i) => i !== index))} accessibilityLabel={t('se.removeVideo')} style={styles.removeInline}>
                            <X size={12} color="#ffffff" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {uploadedVideos.length > 0 ? (
                    <View style={styles.uploaded}>
                      <Text style={styles.uploadedTitle}>{`✓ ${t('se.videosUploaded', { count: uploadedVideos.length })}`}</Text>
                      <View style={styles.thumbs}>
                        {uploadedVideos.map((video) => (
                          <View key={video.id || video.image_url} style={styles.thumbWrap}>
                            <Pressable onPress={() => setVideoViewer(video)} style={styles.videoThumb}>
                              <CirclePlay size={26} color="#ffffff" />
                            </Pressable>
                            {editable ? (
                              <Pressable onPress={() => deleteMedia(video)} disabled={Boolean(saving)} accessibilityLabel={t('se.deleteVideo')} style={styles.removeDot}>
                                <X size={12} color="#ffffff" />
                              </Pressable>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  {!editable && !uploadedVideos.length ? <Text style={styles.dashedSmall}>{t('se.noSiteVideos')}</Text> : null}
                </FormSection>

                {/* Other expenses */}
                <FormSection title={t('se.res.sectionOtherExpenses')}>
                  <Field label={t('se.form.otherExpenses')}>
                    <Input value={String(form.total_expenses)} onChangeText={(value) => update('total_expenses')(value.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" editable={editable} />
                    <BudgetInWords value={form.total_expenses} country={country} style={styles.words} />
                  </Field>
                </FormSection>

                {/* The day's cost, built from the sections above */}
                <View style={styles.total}>
                  <Text style={styles.totalHead}>{t('se.form.sectionTotal')}</Text>
                  {[
                    [t('se.res.costMaterials'), costSummary.material, materialCostOverridden ? 'entered' : 'calc'],
                    [t('se.res.costLabour'), costSummary.labour, 'entered'],
                    [t('se.res.costRentals'), costSummary.rental, 'calc'],
                    [t('se.res.costOtherEquipment'), costSummary.otherEquipment, 'entered'],
                    [t('se.res.costOtherExpenses'), costSummary.otherExpenses, 'entered'],
                  ].map(([label, value, source]) => (
                    <View key={label} style={styles.totalRow}>
                      <View style={[styles.inline, { flex: 1, flexWrap: 'wrap' }]}>
                        <Text style={styles.totalLabel}>{label}</Text>
                        <Tag tone={source}>{t(source === 'calc' ? 'se.res.calculated' : 'se.res.entered')}</Tag>
                      </View>
                      <Text style={styles.totalValue}>{money(value)}</Text>
                    </View>
                  ))}
                  <View style={styles.grand}>
                    <Text style={styles.grandLabel}>{t('se.res.dayTotal')}</Text>
                    <Text style={styles.grandValue}>{money(costSummary.total)}</Text>
                  </View>
                  <View style={styles.totalNotes}>
                    {costSummary.unpricedRentals > 0 ? <Text style={styles.fieldError}>{t('se.res.unpricedNote', { count: costSummary.unpricedRentals })}</Text> : null}
                    {costSummary.rental > 0 || costSummary.unpricedRentals > 0 ? <Text style={styles.small}>{t('se.res.rentalsNotSaved')}</Text> : null}
                    <Text style={styles.small}>{t('se.res.outsideTotal', { paid: money(paidOutToday), received: money(receivedValue) })}</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.noticePad}>
              {dayReady && loadError ? <Notice tone="error" text={loadError} /> : null}
              {notice ? <Notice tone={notice.tone === 'error' ? 'error' : notice.tone === 'success' ? 'success' : 'info'} text={notice.text} /> : null}
            </View>

            {editable && dayReady ? (
              <View style={styles.footer}>
                {dirty ? (
                  <View style={styles.dirtyRow}>
                    <View style={styles.inline}>
                      <View style={styles.dirtyDot} />
                      <Text style={styles.dirtyText}>{t('se.form.unsaved')}</Text>
                    </View>
                    <Pressable onPress={discardChanges} disabled={Boolean(saving)} style={styles.discard}>
                      <Text style={styles.discardText}>{t('se.form.discard')}</Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.footerButtons}>
                  <Pressable onPress={() => save('CLOSED')} disabled={Boolean(saving)} style={[styles.closeButton, saving ? styles.dim : null]}>
                    {saving === 'CLOSED' ? <ActivityIndicator size="small" color={COLORS.slate[700]} /> : <Lock size={15} color={COLORS.slate[700]} />}
                    <Text style={styles.closeText}>{saving === 'CLOSED' ? t('se.form.saving') : t('se.form.closeDay')}</Text>
                  </Pressable>
                  <Pressable onPress={() => save('IN_PROGRESS')} disabled={Boolean(saving)} style={[styles.saveButton, saving ? styles.dim : null]}>
                    {saving === 'IN_PROGRESS' ? <ActivityIndicator size="small" color="#ffffff" /> : <Save size={15} color="#ffffff" />}
                    <Text style={styles.saveText}>{saving === 'IN_PROGRESS' ? t('se.form.saving') : t('se.form.saveProgress')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {!editable && dayReady ? (
              <Text style={styles.readOnly}>{historyOnly ? t('se.readOnlyLogs') : t('se.readOnlyDay')}{!historyOnly && recordableResources ? ` ${t('se.res.pastDayHint')}` : ''}</Text>
            ) : null}
          </View>
        ) : null}

        {projectId && (workDate || historyOnly) ? (
          <MaterialHistoryPanel
            entries={historyEntries}
            filters={historyFilters}
            setFilters={setHistoryFilters}
            touched={touched}
            todayKey={todayKey}
            country={country}
            unitLabel={unitLabel}
            collapsible={!historyOnly}
            open={historyOnly || historyOpen}
            onToggle={() => setHistoryOpen((value) => !value)}
          />
        ) : null}
      </Section>

      <Modal visible={Boolean(photoViewer)} transparent animationType="fade" onRequestClose={() => setPhotoViewer(null)}>
        <View style={styles.viewer}>
          <Pressable onPress={() => setPhotoViewer(null)} accessibilityLabel={t('dash.common.close')} style={styles.viewerClose}>
            <X size={20} color="#ffffff" />
          </Pressable>
          {photoViewer ? <Image source={{ uri: imageUrl(photoViewer.image_url) }} style={{ width: '100%', height: '75%' }} contentFit="contain" /> : null}
        </View>
      </Modal>
      <Modal visible={Boolean(videoViewer)} transparent animationType="fade" onRequestClose={() => setVideoViewer(null)}>
        <View style={styles.viewer}>
          <Pressable onPress={() => setVideoViewer(null)} accessibilityLabel={t('dash.common.close')} style={styles.viewerClose}>
            <X size={20} color="#ffffff" />
          </Pressable>
          {videoViewer ? <SiteVideo uri={imageUrl(videoViewer.image_url)} /> : null}
        </View>
      </Modal>
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  topRow: { marginBottom: 10.5, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  backText: { fontSize: 12.5, fontWeight: '800', color: c.brandText },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  iconButton: { height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  errorRow: { gap: 7 },
  retry: { alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, borderColor: '#fda4af', backgroundColor: c.card, paddingHorizontal: 10.5, paddingVertical: 5 },
   retryText: { fontSize: 12, fontWeight: '800', color: ink('#be123c') },
  dashed: { marginTop: 10.5, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.brandBorderStrong, backgroundColor: c.card, paddingHorizontal: 14, paddingVertical: 24, textAlign: 'center', fontSize: 13, fontWeight: '700', color: c.textMuted },
  dashedSmall: { marginTop: 7, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, paddingHorizontal: 10.5, paddingVertical: 14, textAlign: 'center', fontSize: 12, fontWeight: '700', color: c.textFaint },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calendar: { borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 10.5 },
  calendarHead: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 15, fontWeight: '800', color: c.text },
  monthButton: { height: 30, width: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  todayButton: { height: 30, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10 },
  todayText: { fontSize: 12, fontWeight: '800', color: c.text },
  weekRow: { flexDirection: 'row', gap: 2 },
  weekday: { flex: 1, overflow: 'hidden', borderRadius: 6, backgroundColor: '#03572E1F', paddingVertical: 4, textAlign: 'center', fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', color: c.textSoft },
  grid: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap' },
  cellSlot: { width: '14.28%', padding: 1.5 },
  cell: { minHeight: 62, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 3 },
  cellDisabled: { opacity: 0.45 },
  cellNumber: { height: 22, width: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  cellToday: { backgroundColor: '#03572E' },
  cellDate: { fontSize: 12, fontWeight: '800', color: c.text },
  cellDateToday: { color: '#ffffff' },
  cellTag: { marginTop: 2, flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
  cellDot: { marginTop: 3, height: 5, width: 5, borderRadius: 2.5 },
  cellLabel: { flex: 1, fontSize: 8, lineHeight: 10, fontWeight: '800' },
  legend: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { height: 14, width: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 3 },
  legendDot: { height: 8, width: 8, borderRadius: 4 },
  legendClosed: { height: 14, width: 14, borderRadius: 3, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  legendText: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  card: { borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: c.text },
  logList: { marginTop: 10.5, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 12, paddingVertical: 10 },
  logTitle: { fontSize: 14, fontWeight: '800', color: c.text },
  small: { fontSize: 11.5, fontWeight: '600', color: c.textMuted },
  day: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  dayHead: { borderBottomWidth: 1, borderColor: c.borderSoft, padding: 14 },
  dayHeadRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  backToCalendar: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 9 },
  backToCalendarText: { fontSize: 12, fontWeight: '800', color: ink('#03572E') },
    liveButton: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, borderColor: '#b91c1c', backgroundColor: '#dc2626', paddingHorizontal: 10 },
  liveText: { fontSize: 12, fontWeight: '900', color: '#ffffff' },
  dayTitle: { marginTop: 10, fontFamily: 'Manrope_800ExtraBold', fontSize: 17, color: c.text },
  dayDate: { marginTop: 3, marginBottom: 3, fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.brandText },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 24 },
  dayBody: { gap: 10.5, padding: 12 },
  glanceGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 7 },
  glance: { width: '48.5%', borderRadius: 8, backgroundColor: c.subtle, paddingHorizontal: 10, paddingVertical: 8 },
  glanceLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textMuted },
  glanceValue: { fontSize: 14, fontWeight: '800', color: c.text },
  glanceSub: { fontSize: 11, fontWeight: '600', color: c.textMuted },
  section: { borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12 },
  sectionHead: { marginBottom: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: c.text },
  field: { marginBottom: 10 },
  fieldLabel: { marginBottom: 4, fontSize: 12, fontWeight: '700', color: c.textSecondary },
    required: { color: ink('#e11d48') },
  optional: { fontWeight: '600', color: c.textFaint },
  fieldError: { marginTop: 3, fontSize: 11.5, fontWeight: '700', color: ink('#e11d48') },
  fieldHint: { marginTop: 3, fontSize: 11.5, fontWeight: '600', color: c.textFaint },
  input: { height: 40, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10, fontSize: 14, fontWeight: '600', color: c.text },
  textArea: { minHeight: 76, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontWeight: '600', color: c.text },
  inputInvalid: { borderColor: '#fb7185' },
  inputDisabled: { backgroundColor: c.subtle, color: c.textSoft },
  readValue: { fontSize: 14, fontWeight: '800', color: c.text },
  readBox: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 10 },
  words: { marginTop: 4, marginBottom: 0 },
  pair: { flexDirection: 'row', gap: 8 },
  fold: { borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle },
  foldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, paddingHorizontal: 10, paddingVertical: 10 },
  foldTitle: { flex: 1, fontSize: 12, fontWeight: '800', color: c.textSoft },
  foldBody: { gap: 4, borderTopWidth: 1, borderColor: c.border, padding: 10 },
  suggestions: { gap: 6, paddingTop: 6 },
  suggestion: { borderRadius: 9999, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft, paddingHorizontal: 10, paddingVertical: 5 },
  suggestionText: { fontSize: 12, fontWeight: '700', color: c.brandTextStrong },
  progressBox: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10 },
  progressTrack: { height: 6, flex: 1, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.brandSoft },
  progressFill: { height: '100%', borderRadius: 9999, backgroundColor: '#2e7d55' },
  materialTools: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  search: { height: 36, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 9 },
  searchInput: { flex: 1, fontSize: 12.5, fontWeight: '600', color: c.text },
  toggle: { height: 36, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10 },
  toggleOn: { borderColor: '#03572E', backgroundColor: c.brandSoft },
  toggleText: { fontSize: 12, fontWeight: '800', color: c.textSoft },
  toggleTextOn: { color: ink('#03572E') },
  materialRow: { marginBottom: 7, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10 },
  materialUsed: { backgroundColor: c.brandSoft40 },
  materialError: { borderColor: line('#fecdd3', '#e11d48'), backgroundColor: soft('#fff1f2', '#e11d48') },
  materialTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  materialName: { fontSize: 13.5, fontWeight: '800', color: c.text },
  stockTag: { borderRadius: 9999, paddingHorizontal: 7, paddingVertical: 2 },
  stockText: { fontSize: 10, fontWeight: '800' },
  materialBottom: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  usageInput: { height: 36, width: 76, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 7, textAlign: 'right', fontSize: 14, fontWeight: '800', color: c.text },
  historyLink: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontSize: 11.5, fontWeight: '800', color: c.brandText },
  subtleBox: { marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, padding: 10 },
  addMedia: { marginTop: 8, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#9dc5af', backgroundColor: c.brandSoft50, paddingHorizontal: 10 },
  addCircle: { height: 30, width: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#236645' },
  addText: { fontSize: 13.5, fontWeight: '700', color: c.brandText },
  mediaBlock: { marginTop: 8 },
  mediaReady: { marginBottom: 4, fontSize: 12, fontWeight: '800', color: c.brandText },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap: { width: '30.5%' },
  thumb: { height: 76, width: '100%', borderRadius: 8, borderWidth: 1, borderColor: c.border },
  videoThumb: { height: 76, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#0f172a' },
  removeDot: { position: 'absolute', right: -5, top: -5, height: 22, width: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#e11d48' },
  removeInline: { height: 22, width: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#e11d48' },
  videoRow: { marginBottom: 5, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 8, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10, paddingVertical: 7 },
    uploaded: { marginTop: 8, gap: 5, borderRadius: 12, borderWidth: 1, borderColor: line('#a7f3d0', '#047857'), backgroundColor: c.subtle, padding: 8 },
  uploadedTitle: { fontSize: 12, fontWeight: '800', color: ink('#047857') },
  total: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: c.border },
  totalHead: { borderBottomWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontWeight: '800', color: c.text },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, borderBottomWidth: 1, borderColor: c.borderSoft, paddingHorizontal: 12, paddingVertical: 8 },
  totalLabel: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
  totalValue: { fontSize: 13.5, fontWeight: '800', color: c.text },
  grand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft, paddingHorizontal: 12, paddingVertical: 11 },
  grandLabel: { fontSize: 14, fontWeight: '800', color: c.brandTextStrong },
  grandValue: { fontSize: 20, fontWeight: '800', color: c.brandTextDeep },
  totalNotes: { gap: 3, paddingHorizontal: 12, paddingVertical: 9 },
  noticePad: { paddingHorizontal: 12 },
  footer: { gap: 8, borderTopWidth: 1, borderColor: c.borderSoft, padding: 12 },
  dirtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  dirtyDot: { height: 8, width: 8, borderRadius: 4, backgroundColor: '#2e7d55' },
  dirtyText: { fontSize: 12, fontWeight: '800', color: c.brandTextStrong },
  discard: { height: 34, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10 },
  discardText: { fontSize: 12, fontWeight: '800', color: c.textSoft },
  footerButtons: { flexDirection: 'row', gap: 8 },
  closeButton: { height: 44, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.card },
  closeText: { fontSize: 13.5, fontWeight: '800', color: c.textSoft },
  saveButton: { height: 44, flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, borderWidth: 2, borderColor: '#236645', backgroundColor: '#2e7d55' },
  saveText: { fontSize: 13.5, fontWeight: '800', color: '#ffffff' },
  dim: { opacity: 0.4 },
  readOnly: { borderTopWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontWeight: '700', color: c.brandTextStrong },
  viewer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.9)' },
  viewerClose: { position: 'absolute', right: 17.5, top: 42, zIndex: 10, height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
}))