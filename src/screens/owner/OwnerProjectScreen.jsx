// One project, opened as a page of its own: port of the web
// OwnerProjectWorkspace + the Overview and Payments views of ProjectDetailPanel.
//
// The tabs are the web's, in the web's order:
//   builder project: Find Builders | Requests | Assign Builder | Site Activity | Live Camera | Overview | Escrow | Payments
//   self-construction: Requests | Site Engineer | Suppliers | Site Activity | Live Camera | Overview | Escrow | Payments
// A builder project opens on Find Builders, a self-construction one on
// Requests, as on the web; `route.params.tab` opens another.
//
// Overview (with Edit) and Payments are full ports. The other tabs show the
// sections the app already had until their phases land.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, RefreshControl, KeyboardAvoidingView } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSelector } from 'react-redux'
import { Image } from 'expo-image'
import {
  Camera, FileText, HardHat, Images, LayoutDashboard, MapPin, PackageSearch, Pencil, Receipt, Save, ShoppingBag, Truck, UserCheck, Wallet, X,
} from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenHeader from '../../components/ScreenHeader'
import { Panel, PanelState, InsetArea } from '../../components/DashboardShell'
import { ContentWrap } from '../../components/Responsive'
import StatusPill from '../../components/StatusPill'
import { BudgetInWords, DateField, FormNotice, SelectField, TextField } from '../../components/form'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { fetchOwnerProjects, updateProjectRequirement } from '../../api/projects'
import { imageSource } from '../../api/client'
import { floorCountFor, floorOptionsForCountry, floorTypeForCount, floorTypeLabel } from '../../utils/floorOptions'
import { COMPLIANCE_STATUS_KEYS, optionLabel } from '../../i18n/optionKeys'
import { COLORS } from '../../theme/tokens'
import { userCountry } from '../../utils/countryConfig'
import {
  apiDetail, buildingTypeText, constructionTypeText, countryText, defaultProjectImage, formatProjectDate, money,
  projectScheduleProblem,
} from './ownerHelpers'
import SitePhotoCalendar from './SitePhotoCalendar'
import ProjectCameraPanel from '../../components/cctv/ProjectCameraPanel'
import { sendConversationMessage } from '../../api/messages'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useNotifications } from '../../notifications/NotificationsContext'
import OwnerSiteEngineerSection from './OwnerSiteEngineerSection'
import OwnerMarketplace from './marketplace/OwnerMarketplace'
import CartPanel from './marketplace/CartPanel'
import OrdersPanel from './marketplace/OrdersPanel'
import { AssignBuilderSection, FindBuildersSection, RequestsSection, useBuilderHiring } from './ownerBuilderSections'
import { createStyles } from '../../theme/createStyles'

function projectTabs(project, t) {
  const selfConstruction = project?.construction_type === 'SELF_CONSTRUCTION'
  return [
    ...(selfConstruction
      ? [
        { id: 'requests', label: t('ui.requests'), icon: FileText },
        { id: 'siteEngineer', label: t('role.engineer'), icon: HardHat },
        { id: 'suppliers', label: t('ui.suppliers'), icon: Truck },
      ]
      : [
        { id: 'builders', label: t('projectNav.findBuilders'), icon: HardHat },
        { id: 'requests', label: t('ui.requests'), icon: FileText },
        { id: 'assignBuilder', label: t('quote.assignBuilder'), icon: UserCheck },
      ]),
    { id: 'siteActivity', label: t('ui.siteActivity'), icon: Images },
    { id: 'liveCamera', label: t('ui.liveCamera'), icon: Camera },
    { id: 'overview', label: t('ui.overview'), icon: LayoutDashboard },
    { id: 'escrow', label: t('ui.escrow'), icon: Wallet },
    { id: 'payments', label: t('ui.payments'), icon: Receipt },
  ]
}

const firstTab = (project) => (project?.construction_type === 'SELF_CONSTRUCTION' ? 'requests' : 'builders')

// The Overview's Edit form, filled from the project as it is now. Only the
// fields PATCH /projects/{id}/requirement saves are offered.
function overviewDraftFrom(project) {
  const country = project?.project_country || 'India'
  const floorTypeShown = project?.floor_type || floorTypeForCount(country, project?.floors) || ''
  return {
    title: project?.title || '',
    description: project?.description || '',
    address: project?.address || '',
    building_type: project?.building_type || 'RESIDENTIAL',
    budget: project?.budget ? String(project.budget) : '',
    land_area: project?.land_area ? String(project.land_area) : '',
    floor_type: floorTypeShown,
    floor_type_initial: floorTypeShown,
    start_date: project?.start_date || '',
    end_date: project?.end_date || '',
  }
}

const numericText = (value) => {
  const cleaned = String(value).replace(/[^0-9.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  return rest.length ? `${whole}.${rest.join('')}` : whole
}

function OverviewEditForm({ project, onSaved, onCancel }) {
  const { t } = useLanguage()
  const [draft, setDraft] = useState(() => overviewDraftFrom(project))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const projectCountry = project.project_country || 'India'
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }))

  const save = async () => {
    if (!draft.title.trim() || !draft.description.trim() || !draft.address.trim()) {
      setMessage(t('cp.val.completeFields'))
      return
    }
    // A project with no dates may stay that way; once either date is entered
    // (or the project already has them) both are needed, end not before start.
    const datesTouched = Boolean(draft.start_date || draft.end_date || project.start_date || project.end_date)
    const scheduleProblem = datesTouched ? projectScheduleProblem(draft.start_date, draft.end_date) : ''
    if (scheduleProblem) {
      setMessage(t(scheduleProblem))
      return
    }
    setSaving(true)
    setMessage('')
    try {
      // The endpoint replaces the whole requirement (and resets an omitted
      // budget, land area or floors), so every field goes back: edited ones as
      // edited, the rest exactly as saved.
      await updateProjectRequirement(project.id, {
        title: draft.title.trim(),
        description: draft.description.trim(),
        address: draft.address.trim(),
        pincode: project.pincode || '',
        building_type: draft.building_type,
        construction_type: project.construction_type || 'CONTRACTOR',
        budget: draft.budget === '' ? 0 : Number(draft.budget),
        land_area: draft.land_area === '' ? 0 : Number(draft.land_area),
        // Floors only when the owner changed them; a null floor_type leaves the stored one alone.
        ...(draft.floor_type !== draft.floor_type_initial
          ? { floors: floorCountFor(projectCountry, draft.floor_type, project.floors || 1), floor_type: draft.floor_type || null }
          : { floors: project.floors || 1, floor_type: null }),
        ...(datesTouched ? { start_date: draft.start_date, end_date: draft.end_date } : {}),
      })
      await onSaved()
    } catch (error) {
      setMessage(apiDetail(error, t('ui.owner.updateRequirementFailed')))
    } finally {
      setSaving(false)
    }
  }

  const buildingOptions = [
    { value: 'RESIDENTIAL', label: t('dash.common.residential') },
    { value: 'COMMERCIAL', label: t('dash.common.commercial') },
    ...(!['RESIDENTIAL', 'COMMERCIAL'].includes(draft.building_type)
      ? [{ value: draft.building_type, label: buildingTypeText(draft.building_type, t) }]
      : []),
  ]

  return (
    <View style={styles.view}>
      <TextField label={t('dash.common.projectName')} value={draft.title} onChangeText={(value) => update('title', value)} />
      <TextField label={t('dash.common.description')} value={draft.description} onChangeText={(value) => update('description', value)} multiline />
      <TextField label={t('dash.common.address')} value={draft.address} onChangeText={(value) => update('address', value)} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <SelectField
          containerStyle={{ flex: 1 }}
          label={t('dash.common.buildingType')}
          value={draft.building_type}
          onChange={(value) => value && update('building_type', value)}
          options={buildingOptions}
        />
        <SelectField
          containerStyle={{ flex: 1 }}
          label={t('dash.common.floors')}
          value={draft.floor_type}
          onChange={(value) => update('floor_type', value)}
          placeholder={t('cps.selectField', { label: t('dash.common.floors') })}
          options={floorOptionsForCountry(projectCountry).map((option) => ({ value: option.value, label: floorTypeLabel(option.value) }))}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TextField
          containerStyle={{ flex: 1 }}
          label={t('dash.common.originalBudget')}
          value={draft.budget}
          onChangeText={(value) => update('budget', numericText(value))}
          keyboardType="decimal-pad"
        />
        <TextField
          containerStyle={{ flex: 1 }}
          label={t('dash.common.landArea')}
          value={draft.land_area}
          onChangeText={(value) => update('land_area', numericText(value))}
          keyboardType="decimal-pad"
        />
      </View>
      <BudgetInWords value={draft.budget} country={projectCountry} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <DateField
          containerStyle={{ flex: 1 }}
          label={t('dash.owner.projectDetails.startDate')}
          value={draft.start_date}
          max={draft.end_date || undefined}
          onChange={(value) => update('start_date', value)}
        />
        <DateField
          containerStyle={{ flex: 1 }}
          label={t('dash.owner.projectDetails.endDate')}
          value={draft.end_date}
          min={draft.start_date || undefined}
          onChange={(value) => update('end_date', value)}
        />
      </View>
      <FormNotice message={message} tone="error" style={{ marginBottom: 10 }} />
      <View style={[styles.view2, { gap: 8 }]}>
        <Pressable onPress={onCancel} style={[styles.pressable, { gap: 6 }]}>
          <X size={14} color={COLORS.slate[500]} />
          <Text style={[styles.text, { fontSize: 12.5 }]}>{t('dash.common.cancel')}</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={saving}
          style={[styles.pressable2, saving ? styles.pressable3 : null, { gap: 6 }]}
        >
          <Save size={14} color="#ffffff" />
          <Text style={[styles.text2, { fontSize: 12.5 }]}>
            {saving ? t('dash.common.saving') : t('dash.common.save')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

function OverviewSection({ project, ownerName, onSaved }) {
  const { t, td } = useLanguage()
  const { isTablet } = useResponsive()
  const [editing, setEditing] = useState(false)
  const [savedMessage, setSavedMessage] = useState('')
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const country = project.project_country

  const title = td(project.title)
  const budgetLabel = project.budget ? money(project.budget, country) : t('dash.common.notSet')
  // Present only once the awarded builder has confirmed.
  const contractValueLabel = project.contract_amount != null ? money(project.contract_amount, country) : null
  // Until a contract is confirmed, the awarded builder's quotation.
  const awardedQuotationLabel = project.contract_amount == null && project.awarded_amount != null ? money(project.awarded_amount, country) : null
  const floorsCount = Number(project.floors || 1)
  const facts = [
    contractValueLabel
      ? [t('dash.common.contractValue'), contractValueLabel, true]
      : awardedQuotationLabel ? [t('request.flow.builderQuotation'), awardedQuotationLabel, true] : null,
    [t('dash.common.originalBudget'), budgetLabel],
    [t('dash.owner.projectDetails.startDate'), formatProjectDate(project.start_date, t)],
    [t('dash.owner.projectDetails.endDate'), formatProjectDate(project.end_date, t)],
    [t('dash.common.landArea'), `${project.land_area || 0} ${t('dash.owner.profile.sqFt')}`],
    [
      t('dash.owner.projectDetails.projectType'),
      `${floorsCount === 1 ? t('dash.owner.contractors.floorsOne', { n: floorsCount }) : t('dash.owner.contractors.floorsMany', { n: floorsCount })} ${buildingTypeText(project.building_type, t)}`.trim(),
    ],
  ].filter(Boolean)

  const details = [
    [t('dash.common.projectName'), title],
    [t('dash.common.address'), td(project.address)],
    [t('dash.common.pincode'), project.pincode],
    [t('dash.owner.projectDetails.projectCountry'), countryText(project.project_country || 'India', t)],
    [t('dash.common.constructionType'), constructionTypeText(project.construction_type, t)],
    [t('dash.common.buildingType'), buildingTypeText(project.building_type, t)],
    [t('dash.common.floors'), project.floors != null ? String(project.floors) : ''],
    [
      t('dash.owner.projectDetails.compliance'),
      project.compliance_status
        ? optionLabel(t, COMPLIANCE_STATUS_KEYS, project.compliance_status)
        : t('dash.owner.projectDetails.pendingVerification'),
    ],
  ]

  // The estimate accepted on Create Project: four values written together and
  // NULL together, so one of them decides whether there is anything to show.
  const savedEstimate = project.estimated_cost == null ? [] : [
    [t('site.estimate.result.total'), money(project.estimated_cost, country)],
    [t('site.estimate.result.materials'), money(project.material_estimate, country)],
    [t('site.estimate.result.labour'), money(project.labour_estimate, country)],
    [t('site.estimate.result.duration'), t('site.estimate.result.days', { days: project.estimated_duration_days })],
  ]

  const tileWidth = isTablet ? '32%' : '48.5%'

  return (
    <View style={styles.view3}>
      <FormNotice message={!editing ? savedMessage : ''} tone="success" style={{ marginBottom: 12 }} />
      {editing ? (
        <OverviewEditForm
          project={project}
          onCancel={() => setEditing(false)}
          onSaved={async () => {
            await onSaved()
            setEditing(false)
            setSavedMessage(t('dash.owner.estimates.editSaved'))
          }}
        />
      ) : null}

      <View style={[styles.view4, { gap: 12 }]}>
        <Image
          source={project.cover_image_url ? imageSource(project.cover_image_url) : { uri: defaultProjectImage }}
          style={{ width: 60, height: 60, borderRadius: 14, backgroundColor: COLORS.brand[50] }}
          contentFit="cover"
        />
        <View style={styles.view5}>
          <Text style={[styles.text3, { fontSize: 17, lineHeight: 22 }]}>{title}</Text>
          <View style={styles.view6}>
            <StatusPill status={project.status || 'active'} />
          </View>
          <Text style={[styles.text4, { fontSize: 12.5 }]}>
            {td(ownerName) || t('dash.owner.profile.homeOwner')}
          </Text>
          <View style={[styles.view7, { gap: 4 }]}>
            <MapPin size={12} color={COLORS.slate[400]} style={{ marginTop: 2 }} />
            <Text style={[styles.text5, { fontSize: 12 }]}>
              {`${td(project.address) || ''} ${project.pincode || ''}`.trim() || t('dash.common.notSet')}
            </Text>
          </View>
        </View>
        {!editing ? (
          <Pressable
            onPress={() => {
              setSavedMessage('')
              setEditing(true)
            }}
            accessibilityRole="button"
            accessibilityLabel={t('dash.common.edit')}
            style={[styles.pressable4, { gap: 6 }]}
          >
            <Pencil size={14} color={COLORS.brand[800]} />
            <Text style={[styles.text6, { fontSize: 12 }]}>{t('dash.common.edit')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Key facts. The active amount (contract value, or the awarded
          builder's quotation) is the highlighted tile. */}
      <View style={[styles.view8, { rowGap: 8 }]}>
        {facts.map(([label, value, highlight]) => (
          <View
            key={label}
            style={[styles.view9, highlight ? styles.view10 : styles.view11, { width: tileWidth }]}
          >
            <Text style={[styles.text7, { fontSize: 11 }]}>{label}</Text>
            <Text style={[styles.text8, highlight ? styles.text9 : styles.text10, { fontSize: 14.5 }]}>
              {value || t('dash.common.notSet')}
            </Text>
          </View>
        ))}
      </View>

      {td(project.description) ? (
        <View style={styles.view12}>
          <Text style={[styles.text11, { fontSize: 13.5 }]}>{t('dash.common.description')}</Text>
          <Text style={[styles.text12, { fontSize: 13, lineHeight: 20 }]} numberOfLines={descriptionOpen ? undefined : 3}>
            {td(project.description)}
          </Text>
          {String(project.description || '').length > 160 ? (
            <Pressable onPress={() => setDescriptionOpen((open) => !open)} style={styles.pressable5}>
              <Text style={[styles.text13, { fontSize: 12 }]}>
                {descriptionOpen ? t('catalog.showLess') : t('catalog.showMore')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.view12}>
        <Text style={[styles.text11, { fontSize: 13.5 }]}>{t('site.estimate.details')}</Text>
        {details.map(([label, value]) => (
          <View key={label} style={[styles.view13, { gap: 16 }]}>
            <Text style={[styles.text14, { fontSize: 13 }]}>{label}</Text>
            <Text style={[styles.text15, { fontSize: 13 }]}>
              {value || t('dash.common.notSet')}
            </Text>
          </View>
        ))}
      </View>

      {savedEstimate.length ? (
        <View style={styles.view12}>
          <Text style={[styles.text11, { fontSize: 13.5 }]}>{t('cp.savedEstimate')}</Text>
          <View style={[styles.view14, { rowGap: 8 }]}>
            {savedEstimate.map(([label, value]) => (
              <View key={label} style={[styles.view15, { width: '48.5%' }]}>
                <Text style={[styles.text7, { fontSize: 11 }]}>{label}</Text>
                <Text style={[styles.text16, { fontSize: 13 }]}>{value || t('dash.common.notSet')}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

function PaymentsSection({ project }) {
  const { t, td } = useLanguage()
  const milestones = Array.isArray(project.escrow_milestones) ? project.escrow_milestones : []
  return (
    <Panel title={t('ui.payments')}>
      <PanelState empty={!milestones.length} emptyText={`${t('dash.owner.projectDetails.noMilestones')} ${t('dash.owner.projectDetails.milestonesHint')}`}>
        {milestones.map((milestone) => (
          <View key={milestone.id} style={[styles.view16, { gap: 12 }]}>
            <View style={styles.view5}>
              <Text style={[styles.text11, { fontSize: 14 }]}>{td(milestone.name)}</Text>
              <Text style={[styles.text14, { fontSize: 11.5 }]}>{t('dash.owner.projectDetails.escrowMilestone')}</Text>
            </View>
            <View style={[styles.view17, { gap: 4 }]}>
              <Text style={[styles.text17, { fontSize: 15 }]}>{money(milestone.amount, project.project_country)}</Text>
              <StatusPill status={milestone.status} />
            </View>
          </View>
        ))}
      </PanelState>
    </Panel>
  )
}

// Port of the web OwnerEscrowSection.
function EscrowSection({ project }) {
  const { t, td } = useLanguage()
  const milestones = Array.isArray(project.escrow_milestones) ? project.escrow_milestones : []
  return (
    <Panel title={t('dash.owner.escrow.title')}>
      <PanelState empty={!milestones.length} emptyText={`${t('dash.owner.escrow.emptyTitle')}. ${t('dash.owner.escrow.emptySub')}`}>
        {milestones.map((milestone) => (
          <View key={milestone.id} style={[styles.view18, { gap: 10 }]}>
            <Text style={[styles.text18, { fontSize: 13.5 }]}>{td(milestone.name)}</Text>
            <View style={[styles.view17, { gap: 4 }]}>
              <Text style={[styles.text11, { fontSize: 13.5 }]}>{money(milestone.amount, project.project_country)}</Text>
              <StatusPill status={milestone.status} />
            </View>
          </View>
        ))}
      </PanelState>
    </Panel>
  )
}

// Site Activity: the site media calendar, and Request Update -- a chat message
// to the assigned builder, composed in English as on the web because it is
// stored and read by the builder.
function SiteActivitySection({ project, user }) {
  const { t } = useLanguage()
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const requestUpdate = async () => {
    setMessage('')
    if (!project.contractor_id) {
      setMessage(t('dash.err.noBuilderAssigned'))
      return
    }
    setSending(true)
    try {
      await sendConversationMessage({
        receiver_id: project.contractor_id,
        body: `${user?.name || 'Homeowner'} requested a site update for ${project.title || 'this project'}. Please share the latest progress, photos, and current work status.`,
        message_type: 'TEXT',
      })
      setMessage(t('dash.msg.updateRequestSent'))
    } catch (error) {
      setMessage(apiDetail(error, t('dash.err.requestProjectUpdate')))
    } finally {
      setSending(false)
    }
  }
  return <SitePhotoCalendar project={project} onRequestUpdate={requestUpdate} requestingUpdate={sending} updateMessage={message} />
}

// Port of the web OwnerSupplierHub for a self-construction project: Suppliers
// (the materials marketplace) and Orders, with the project's cart opened from
// the marketplace's Cart button.
function SuppliersSection({ project, user }) {
  const { t } = useLanguage()
  const [view, setView] = useState('suppliers')
  const country = project.project_country || userCountry(user)
  const pincode = project.pincode || user?.pincode
  const tabs = [
    { id: 'suppliers', label: t('ui.suppliers'), icon: PackageSearch },
    { id: 'orders', label: t('shop.orders'), icon: ShoppingBag },
  ]
  return (
    <View>
      <View style={[styles.view19, { gap: 4 }]}>
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = view === id || (id === 'suppliers' && view === 'cart')
          return (
            <Pressable
              key={id}
              onPress={() => setView(id)}
              style={[styles.pressable6, active ? styles.pressable7 : null, { gap: 6 }]}
            >
              <Icon size={13} color={active ? '#ffffff' : COLORS.slate[500]} />
              <Text style={[styles.text19, active ? styles.text20 : styles.text21, { fontSize: 12 }]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
      {view === 'suppliers' && (
        <OwnerMarketplace projectId={project.id} pincode={pincode} country={country} onOpenCart={() => setView('cart')} />
      )}
      {view === 'cart' && <CartPanel projectId={project.id} country={country} onBack={() => setView('suppliers')} />}
      {view === 'orders' && <OrdersPanel projectId={project.id} country={country} />}
    </View>
  )
}

export default function OwnerProjectScreen({ navigation, route }) {
  // Full-screen pages draw under the Android navigation buttons; keep the end clear of them.
  const insets = useSafeAreaInsets()
  const { t, td } = useLanguage()
  const { gutter } = useResponsive()
  const user = useSelector((state) => state.auth.user)
  const projectId = route?.params?.projectId
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState(route?.params?.tab || null)
  const [createdNotice, setCreatedNotice] = useState(Boolean(route?.params?.created))
  const tabsRef = useRef(null)
  // A request opened from elsewhere (a notification) starts expanded.
  const [linkedRequestId] = useState(route?.params?.requestId || null)

  const load = useCallback(async () => {
    try {
      const list = await fetchOwnerProjects()
      const match = (Array.isArray(list) ? list : []).find((item) => String(item.id) === String(projectId))
      setProject(match || null)
      setError(match ? '' : t('dash.err.loadProjects'))
    } catch (loadError) {
      setError(apiDetail(loadError, t('dash.err.loadProjects')))
    } finally {
      setLoading(false)
    }
  }, [projectId, t])

  // Re-read whenever the page comes back into view (after Live Camera, etc.).
  useFocusEffect(useCallback(() => { load() }, [load]))

  // Another screen asked for a particular tab (Home's "Order Product", the
  // Projects list's "Assign Builder").
  useEffect(() => {
    const requested = route?.params?.tab
    if (requested) {
      setTab(requested)
      navigation.setParams({ tab: undefined })
    }
  }, [route?.params?.tab, navigation])

  // This project's requests and every builder-hiring action (Phase 3).
  const hiring = useBuilderHiring(project, load)
  // A request, quotation or assignment changed: reload the project and its requests.
  useLiveRefresh(() => {
    load()
    hiring.reloadRequests()
  })
  const { badgeCounts, markSectionRead } = useNotifications()

  const tabs = useMemo(() => (project ? projectTabs(project, t) : []), [project, t])
  // A tab this project does not have (Suppliers on a builder project) falls
  // back to the project's first tab, as the web redirects.
  const activeTab = tabs.some((entry) => entry.id === tab) ? tab : firstTab(project)

  // Tabs that are a section of their own carry its unread count, and opening
  // one clears it (the web's SECTION_NOTIFICATION_MODULES).
  const TAB_SECTIONS = { requests: 'requests', builders: 'builders', suppliers: 'suppliers', escrow: 'escrow' }
  useEffect(() => {
    if (project && TAB_SECTIONS[activeTab]) markSectionRead(TAB_SECTIONS[activeTab])
    // markSectionRead changes with the list; only a new tab should clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, project?.id])

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([load(), hiring.reloadRequests()])
    setRefreshing(false)
  }

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('OwnerHome', { screen: 'OwnerProjectsTab' })
  }

  const title = project ? td(project.title) : ''
  const subtitle = project ? `${td(project.address) || ''} ${project.pincode || ''}`.trim() : ''

  return (
    <View style={styles.view20}>
      <ScreenHeader title={title || t('ui.projects')} subtitle={subtitle} onBack={goBack} />
      {project ? (
        <View style={styles.view21}>
          <ScrollView
            ref={tabsRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingHorizontal: gutter - 8, paddingVertical: 8 }}
          >
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id
              // Live Camera stands out in red, as on the web.
              const live = id === 'liveCamera'
              const box = live ? (active ? 'tone' : 'tone2') : active ? 'pressable7' : 'tone3'
              const ink = live || active ? '#ffffff' : COLORS.slate[500]
              return (
                <Pressable
                  key={id}
                  onPress={() => setTab(id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.pressable8, styles[box], { gap: 6 }]}
                >
                  <Icon size={13} color={ink} />
                  <Text style={[styles.text19, { fontSize: 12, color: ink }]}>{label}</Text>
                  {!active && TAB_SECTIONS[id] && badgeCounts[TAB_SECTIONS[id]] ? (
                    <View style={styles.view22}>
                      <Text style={[styles.text2, { fontSize: 9 }]}>
                        {badgeCounts[TAB_SECTIONS[id]] > 9 ? '9+' : badgeCounts[TAB_SECTIONS[id]]}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              )
            })}
          </ScrollView>
        </View>
      ) : null}

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 14, paddingBottom: 40 + insets.bottom }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand[700]} />}
        >
          <ContentWrap>
          <InsetArea>
            {createdNotice ? (
              <Pressable onPress={() => setCreatedNotice(false)}>
                <FormNotice message={t('dash.owner.projectForm.created')} tone="success" style={{ marginBottom: 12 }} />
              </Pressable>
            ) : null}
            {!project ? (
              <PanelState loading={loading} error={error}>{null}</PanelState>
            ) : (
              <>
                {activeTab === 'overview' && <OverviewSection project={project} ownerName={user?.name} onSaved={load} />}
                {activeTab === 'payments' && <PaymentsSection project={project} />}
                {activeTab === 'escrow' && <EscrowSection project={project} />}
                {activeTab === 'requests' && <RequestsSection project={project} hiring={hiring} initialRequestId={linkedRequestId} />}
                {activeTab === 'builders' && (
                  <FindBuildersSection
                    project={project}
                    user={user}
                    hiring={hiring}
                    onViewProfile={(contractor) => navigation.navigate('BuilderProfile', { contractorId: contractor.user_id })}
                  />
                )}
                {activeTab === 'assignBuilder' && <AssignBuilderSection project={project} hiring={hiring} />}
                {activeTab === 'siteEngineer' && <OwnerSiteEngineerSection project={project} />}
                {activeTab === 'suppliers' && <SuppliersSection project={project} user={user} />}
                {activeTab === 'siteActivity' && <SiteActivitySection project={project} user={user} />}
                {activeTab === 'liveCamera' && <ProjectCameraPanel projectId={project.id} projectTitle={project.title} />}
              </>
            )}
          </InsetArea>
          </ContentWrap>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 14, borderRadius: 14, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft40, padding: 12.25 },
  view2: { flexDirection: 'row', justifyContent: 'flex-end' },
  pressable: { height: 35, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 12.25 },
  text: { fontFamily: 'Inter_700Bold', color: c.textMuted },
  pressable2: { height: 35, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, backgroundColor: '#1a5038', paddingHorizontal: 14 },
  pressable3: { opacity: 0.6 },
  text2: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  view3: { borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view4: { flexDirection: 'row', alignItems: 'flex-start' },
  view5: { flex: 1 },
  text3: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view6: { marginTop: 3.5, alignSelf: 'flex-start' },
  text4: { marginTop: 3.5, fontFamily: 'Inter_600SemiBold', color: c.text },
  view7: { marginTop: 1.75, flexDirection: 'row', alignItems: 'flex-start' },
  text5: { flex: 1, fontFamily: 'Inter_400Regular', color: c.textMuted },
  pressable4: { height: 35, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5 },
  text6: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  view8: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  view9: { borderRadius: 10.5, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  view10: { borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft },
  view11: { backgroundColor: c.subtle },
  text7: { fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  text8: { marginTop: 1.75, fontFamily: 'Manrope_800ExtraBold' },
  text9: { color: c.brandTextStrong },
  text10: { color: c.text },
  view12: { marginTop: 17.5 },
  text11: { fontFamily: 'Inter_700Bold', color: c.text },
  text12: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  pressable5: { marginTop: 3.5, alignSelf: 'flex-start', paddingVertical: 3.5 },
  text13: { fontFamily: 'Inter_700Bold', color: c.brandTextSoft },
  view13: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  text14: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  text15: { flex: 1, textAlign: 'right', fontFamily: 'Inter_600SemiBold', color: c.text },
  view14: { marginTop: 7, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  view15: { borderRadius: 10.5, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  text16: { marginTop: 1.75, fontFamily: 'Inter_700Bold', color: c.text },
  view16: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  view17: { alignItems: 'flex-end' },
  text17: { fontFamily: 'Manrope_800ExtraBold', color: c.brandTextStrong },
  view18: { marginBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10.5, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10.5, paddingVertical: 8.75 },
  text18: { flex: 1, fontFamily: 'Inter_600SemiBold', color: c.text },
  view19: { marginBottom: 10.5, flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 3.5 },
  pressable6: { height: 31.5, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10.5 },
  pressable7: { backgroundColor: '#1a5038' },
  text19: { fontFamily: 'Inter_700Bold' },
  text20: { color: '#ffffff' },
  text21: { color: c.textMuted },
  view20: { flex: 1, backgroundColor: c.canvas },
  view21: { borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.card },
  tone: { backgroundColor: '#b91c1c' },
  tone2: { backgroundColor: '#dc2626' },
  tone3: { backgroundColor: c.card },
  pressable8: { height: 31.5, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, paddingHorizontal: 12.25 },
  view22: { height: 14, minWidth: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#dc2626', paddingHorizontal: 3.5 },
}))
