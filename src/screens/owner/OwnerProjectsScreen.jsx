// Port of the web Projects page (ProjectListTable in ownerProjectViews.jsx):
// one card per project with its builder, size, progress and active amount,
// and the card's own actions -- Edit requirement, Delete, Assign Builder.
// Tapping a card opens the project as a page of its own (OwnerProjectScreen).
//
// The web also lists estimate drafts saved in the browser; the app has no
// drafts yet, so every card here is a real project.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Image } from 'expo-image'
import { HardHat, MapPin, Pencil, Plus, Save, Trash2, X } from 'lucide-react-native'
import DashboardShell, { PanelState } from '../../components/DashboardShell'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { useNotifications } from '../../notifications/NotificationsContext'
import { BudgetInWords, FormNotice, SelectField, TextField } from '../../components/form'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { deleteOwnerProject, fetchOwnerProjects, updateProjectRequirement } from '../../api/projects'
import { imageSource } from '../../api/client'
import { floorCountFor, floorOptionsForCountry, floorTypeForCount, floorTypeLabel } from '../../utils/floorOptions'
import { FLOOR_TYPE_KEYS, optionLabel } from '../../i18n/optionKeys'
import { COLORS } from '../../theme/tokens'
import {
  apiDetail, buildingTypeText, clampPercent, constructionTypeText, defaultProjectImage, money,
  normalizeEstimateText, projectBuilderContext,
} from './ownerHelpers'
import { createStyles } from '../../theme/createStyles'

const numericText = (value) => {
  const cleaned = String(value).replace(/[^0-9.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  return rest.length ? `${whole}.${rest.join('')}` : whole
}

const PILL_TONES = {
  positive: 'tone',
  info: 'tone2',
  accent: 'tone3',
}

function CardPill({ text, tone, icon: Icon }) {
  // One tone style: its background on the pill, its colour on the label.
  const look = styles[PILL_TONES[tone]]
  return (
    <View style={[styles.view, look, { gap: 4, maxWidth: '100%' }]}>
      {Icon ? <Icon size={11} color={COLORS.brand[700]} /> : null}
      <Text style={[styles.text, { color: look.color, fontSize: 10.5 }]} numberOfLines={1}>{text}</Text>
    </View>
  )
}

// Edit Requirement on the card: title, budget, land area and floors. Every
// other field is sent back exactly as saved, because the endpoint replaces the
// whole requirement and resets an omitted budget, land area or floors.
function EditRequirement({ project, onSaved, onCancel }) {
  const { t } = useLanguage()
  const country = project.project_country || ''
  const [form, setForm] = useState(() => ({
    title: project.title || '',
    budget: project.budget ? String(project.budget) : '',
    land_area: project.land_area ? String(project.land_area) : '',
    floors: project.floors || 1,
    // What the save sends: the code actually stored, untouched unless changed.
    floor_type: project.floor_type || '',
    // What the dropdown shows: the stored code, or the option matching the
    // floor count of a project that predates floor_type.
    floor_type_shown: project.floor_type || floorTypeForCount(country, project.floors),
  }))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', tone: 'info' })

  const save = async () => {
    setSaving(true)
    setMessage({ text: '', tone: 'info' })
    try {
      // Saved to the project record, so the fallback title stays English.
      await updateProjectRequirement(project.id, {
        title: form.title.trim() || project.title || 'Untitled project',
        description: project.description || '',
        address: project.address || '',
        pincode: project.pincode || '',
        building_type: project.building_type || 'RESIDENTIAL',
        construction_type: project.construction_type || 'CONTRACTOR',
        budget: Number(form.budget || 0),
        land_area: Number(form.land_area || 0),
        floors: Number(form.floors || 1),
        floor_type: form.floor_type || null,
      })
      setMessage({ text: t('dash.owner.estimates.editSaved'), tone: 'success' })
      await onSaved()
    } catch (error) {
      setMessage({ text: apiDetail(error, t('ui.owner.updateRequirementFailed')), tone: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    // Claims its own touches, so tapping inside the form does not open the project.
    <View style={styles.view2} onStartShouldSetResponder={() => true}>
      <Text style={[styles.text2, { fontSize: 10, letterSpacing: 1.4 }]}>
        {t('dash.owner.estimates.editRequirement')}
      </Text>
      <TextField label={t('dash.owner.estimates.editTitle')} value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TextField
          containerStyle={{ flex: 1 }}
          label={t('dash.owner.estimates.editBudget')}
          value={form.budget}
          onChangeText={(value) => setForm((current) => ({ ...current, budget: numericText(value) }))}
          keyboardType="decimal-pad"
        />
        <TextField
          containerStyle={{ flex: 1 }}
          label={t('dash.owner.estimates.editLandArea')}
          value={form.land_area}
          onChangeText={(value) => setForm((current) => ({ ...current, land_area: numericText(value) }))}
          keyboardType="decimal-pad"
        />
      </View>
      <BudgetInWords value={form.budget} country={country || 'India'} />
      <SelectField
        label={t('dash.owner.estimates.editFloors')}
        value={form.floor_type_shown || ''}
        onChange={(value) => setForm((current) => ({
          ...current,
          floor_type: value,
          floor_type_shown: value,
          // Keep the count in step with the chosen code; the save posts `floors`.
          floors: floorCountFor(country, value, current.floors),
        }))}
        placeholder={t('cps.selectField', { label: t('dash.common.floors') })}
        options={floorOptionsForCountry(country).map((option) => ({ value: option.value, label: floorTypeLabel(option.value) }))}
      />
      <FormNotice message={message.text} tone={message.tone} style={{ marginBottom: 10 }} />
      <View style={[styles.view3, { gap: 8 }]}>
        <Pressable
          onPress={save}
          disabled={saving}
          style={[styles.pressable, saving ? styles.pressable2 : null, { gap: 6 }]}
        >
          <Save size={13} color="#ffffff" />
          <Text style={[styles.text3, { fontSize: 12 }]}>
            {saving ? t('dash.common.saving') : t('dash.common.save')}
          </Text>
        </Pressable>
        <Pressable onPress={onCancel} style={[styles.pressable3, { gap: 6 }]}>
          <X size={13} color={COLORS.slate[500]} />
          <Text style={[styles.text4, { fontSize: 12 }]}>{t('dash.common.cancel')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function ProjectCard({ project, width, editing, deleting, onOpen, onEdit, onCancelEdit, onSaved, onDelete, onAssignBuilder }) {
  const { t, td } = useLanguage()
  const completion = clampPercent(project.completion_percentage)
  const builderContext = projectBuilderContext(project)
  const country = project.project_country || 'India'
  // The finalized contract once confirmed, else the awarded quotation, else the
  // stored budget, or "Not set". Never an invented amount.
  const activeBudget = project.contract_amount ?? project.awarded_amount ?? project.budget
  const budgetLabel = Number(activeBudget) > 0 ? money(activeBudget, country) : t('dash.common.notSet')
  // Many projects repeat the title as the description; only a description
  // that says something new gets a line.
  const describes = project.description && normalizeEstimateText(project.description) !== normalizeEstimateText(project.title)
  const builderText = builderContext.kind === 'self'
    ? constructionTypeText(project.construction_type, t)
    : builderContext.kind === 'builder'
      ? `${t('dash.common.builder')}: ${td(builderContext.name)}`
      : t('dash.owner.estimates.lookingForBuilder')
  const title = td(project.title)
  const buildText = (project.floor_type ? optionLabel(t, FLOOR_TYPE_KEYS, project.floor_type) : '')
    || buildingTypeText(project.building_type, t)
    || t('dash.owner.floorsCount', { floors: project.floors || 1 })

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      style={[styles.pressable4, { width }]}
    >
      <View style={[styles.view4, { gap: 12 }]}>
        <Image
          source={project.cover_image_url ? imageSource(project.cover_image_url) : { uri: defaultProjectImage }}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.brand[50] }}
          contentFit="cover"
        />
        <View style={styles.view5}>
          <Text style={[styles.text5, { fontSize: 15 }]} numberOfLines={2}>{title}</Text>
          <View style={[styles.view6, { gap: 4 }]}>
            <MapPin size={11} color={COLORS.slate[400]} />
            <Text style={[styles.text6, { fontSize: 11.5 }]} numberOfLines={1}>
              {`${td(project.address) || t('dash.owner.estimates.locationNotSet')} ${project.pincode || ''}`.trim()}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.view7, { gap: 6 }]}>
        <CardPill text={builderText} tone="positive" icon={HardHat} />
        <CardPill text={t('dash.owner.sqft', { area: project.land_area ?? 0 })} tone="info" />
        <CardPill text={buildText} tone="accent" />
      </View>

      {describes ? (
        <Text style={[styles.text7, { fontSize: 11.5 }]} numberOfLines={1}>{td(project.description)}</Text>
      ) : null}

      <View style={[styles.view8, { gap: 8 }]}>
        <Text style={[styles.text8, { fontSize: 11.5 }]}>
          {`${completion}% ${t('dash.owner.projectList.completion')}`}
        </Text>
        <Text style={[styles.text9, { fontSize: 14 }]}>{budgetLabel}</Text>
      </View>
      <View style={styles.view9}>
        <View style={[styles.view10, { width: `${completion}%` }]} />
      </View>

      <View style={[styles.view11, { gap: 8 }]}>
        {!editing ? (
          <Pressable onPress={onEdit} style={[styles.pressable5, { gap: 5 }]}>
            <Pencil size={12} color={COLORS.graphite} />
            <Text style={[styles.text5, { fontSize: 11.5 }]}>{t('dash.owner.estimates.edit')}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDelete}
          disabled={deleting}
          style={[styles.pressable6, deleting ? styles.pressable2 : null, { gap: 5 }]}
        >
          <Trash2 size={12} color="#dc2626" />
          <Text style={[styles.text10, { fontSize: 11.5 }]}>
            {deleting ? t('dash.common.deleting') : t('dash.common.delete')}
          </Text>
        </Pressable>
        {/* Assigned means awarded (projects.contractor_id), not merely an accepted quotation. */}
        {project.construction_type !== 'SELF_CONSTRUCTION' ? (
          <Pressable
            onPress={onAssignBuilder}
            style={[styles.pressable7, { gap: 5 }]}
          >
            <HardHat size={12} color={COLORS.brand[800]} />
            <Text style={[styles.text11, { fontSize: 11.5 }]}>
              {project.contractor_id ? t('quote.builderAssignedButton') : t('quote.assignBuilder')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {editing ? <EditRequirement project={project} onSaved={onSaved} onCancel={onCancelEdit} /> : null}
    </Pressable>
  )
}

export default function OwnerProjectsScreen({ navigation, route }) {
  const { t, td } = useLanguage()
  const { columns, gutter } = useResponsive()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteMessage, setDeleteMessage] = useState({ text: '', tone: 'success' })

  const load = useCallback(async () => {
    try {
      const list = await fetchOwnerProjects()
      setProjects(Array.isArray(list) ? list : [])
      setError('')
    } catch (loadError) {
      setError(apiDetail(loadError, t('dash.err.loadProjects')))
    } finally {
      setLoading(false)
    }
  }, [t])

  const { markSectionRead } = useNotifications()
  // Opening Projects clears its project / estimate notifications, as on the web.
  useFocusEffect(useCallback(() => {
    load()
    markSectionRead('projects')
  }, [load, markSectionRead]))
  useLiveRefresh(load)

  // Older links into this tab carried a project to open; it is a page of its own now.
  useEffect(() => {
    const projectId = route?.params?.projectId
    if (!projectId) return
    const tab = route?.params?.section || route?.params?.tab
    navigation.setParams({ projectId: undefined, section: undefined, tab: undefined })
    navigation.navigate('OwnerProject', { projectId, ...(tab ? { tab } : {}) })
  }, [route?.params?.projectId, route?.params?.section, route?.params?.tab, navigation])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const confirmDelete = (project) => {
    Alert.alert(
      t('dash.owner.estimates.deleteTitle'),
      `${t('dash.owner.estimates.deleteBody')}\n\n${td(project.title) || t('dash.common.untitledEstimate')}`,
      [
        { text: t('dash.common.cancel'), style: 'cancel' },
        { text: t('dash.common.delete'), style: 'destructive', onPress: () => deleteProject(project) },
      ],
    )
  }

  const deleteProject = async (project) => {
    setDeleteMessage({ text: '', tone: 'success' })
    setDeletingId(project.id)
    try {
      await deleteOwnerProject(project.id)
      await load()
      setDeleteMessage({ text: t('dash.msg.projectDeleted'), tone: 'success' })
    } catch (deleteError) {
      // The server refuses a project that has started or has a live award, and says why.
      setDeleteMessage({ text: apiDetail(deleteError, t('dash.err.deleteProject')), tone: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  const cardWidth = columns > 1 ? `${(100 - (columns - 1) * 2) / columns}%` : '100%'

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <View style={{ paddingHorizontal: gutter }}>
      <View style={[styles.view12, { gap: 12 }]}>
        <Text style={[styles.text9, { fontSize: 19, letterSpacing: -0.4 }]}>{t('ui.projects')}</Text>
        <Pressable
          onPress={() => navigation.navigate('CreateProject')}
          accessibilityRole="button"
          style={[styles.pressable8, { gap: 6 }]}
        >
          <Plus size={15} color="#ffffff" />
          <Text style={[styles.text3, { fontSize: 12.5 }]}>{t('ui.createProject')}</Text>
        </Pressable>
      </View>

      <FormNotice message={deleteMessage.text} tone={deleteMessage.tone} style={{ marginBottom: 12 }} />

      <PanelState
        loading={loading}
        error={error}
        empty={!projects.length}
        emptyText={`${t('dash.owner.projects.emptyTitle')}. ${t('dash.owner.projects.emptySub')}`}
      >
        <View style={styles.view13}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              width={cardWidth}
              editing={editingId === project.id}
              deleting={deletingId === project.id}
              onOpen={() => navigation.navigate('OwnerProject', { projectId: project.id })}
              onEdit={() => setEditingId(project.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaved={load}
              onDelete={() => confirmDelete(project)}
              onAssignBuilder={() => navigation.navigate('OwnerProject', { projectId: project.id, tab: 'assignBuilder' })}
            />
          ))}
        </View>
      </PanelState>
      </View>
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  tone: { backgroundColor: c.emeraldSoft, color: c.emeraldTextStrong },
  tone2: { backgroundColor: c.skySoft, color: c.skyTextStrong },
  tone3: { backgroundColor: c.amberSoft, color: c.amberTextStrong },
  view: { flexDirection: 'row', alignItems: 'center', borderRadius: 9999, paddingHorizontal: 8.75, paddingVertical: 3.5 },
  text: { fontFamily: 'Inter_700Bold' },
  view2: { marginTop: 10.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.brandBorder, backgroundColor: c.brandSoft40, padding: 10.5 },
  text2: { marginBottom: 7, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.brandTextStrong },
  view3: { flexDirection: 'row' },
  pressable: { height: 31.5, flexDirection: 'row', alignItems: 'center', borderRadius: 7, backgroundColor: '#134127', paddingHorizontal: 10.5 },
  pressable2: { opacity: 0.6 },
  text3: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  pressable3: { height: 31.5, flexDirection: 'row', alignItems: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5 },
  text4: { fontFamily: 'Inter_700Bold', color: c.textMuted },
  pressable4: { marginBottom: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view4: { flexDirection: 'row', alignItems: 'flex-start' },
  view5: { flex: 1 },
  text5: { fontFamily: 'Inter_700Bold', color: c.text },
  view6: { marginTop: 1.75, flexDirection: 'row', alignItems: 'center' },
  text6: { flex: 1, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view7: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap' },
  text7: { marginTop: 7, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view8: { marginTop: 8.75, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text8: { fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  text9: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  view9: { marginTop: 5.25, height: 5.25, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.mutedStrong },
  view10: { height: '100%', borderRadius: 9999, backgroundColor: '#10b981' },
  view11: { marginTop: 10.5, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  pressable5: { height: 28, flexDirection: 'row', alignItems: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 8.75 },
  pressable6: { height: 28, flexDirection: 'row', alignItems: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.redBorderSoft, backgroundColor: c.redSoft, paddingHorizontal: 8.75 },
  text10: { fontFamily: 'Inter_700Bold', color: c.redTextSoft },
  pressable7: { marginLeft: 'auto', height: 28, flexDirection: 'row', alignItems: 'center', borderRadius: 7, borderWidth: 1, borderColor: c.emeraldBorderSoft, backgroundColor: c.emeraldSoft, paddingHorizontal: 8.75 },
  text11: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  view12: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pressable8: { height: 31.5, flexDirection: 'row', alignItems: 'center', borderRadius: 10.5, backgroundColor: '#1a5038', paddingHorizontal: 10.5 },
  view13: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
}))
