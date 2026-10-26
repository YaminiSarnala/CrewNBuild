// Port of web contractorProjectViews.jsx (ContractorProjectsTable +
// ContractorProjectDetail). Same data: fetchOwnerProjects (backend scopes to
// the contractor's assigned projects), per-project engineer + suppliers,
// timeline entries for Activity, escrow_milestones for Payments.
import { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { ChevronLeft, HardHat, MapPin } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import {
  fetchOwnerProjects,
  fetchProjectTimelineEntries,
} from '../../api/projects'
import {
  fetchProjectEngineer, fetchProjectSuppliers, fetchContractorSuppliers,
  assignSupplierToProject, unassignSupplierFromProject,
} from '../../api/engineers'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

const TABS = [
  { id: 'details', label: 'Overview' },
  { id: 'activity', label: 'Activity' },
  { id: 'team', label: 'Team' },
  { id: 'payments', label: 'Payments' },
]

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

function ProjectCard({ project, onPress }) {
  const completion = Math.min(Number(project.completion_percentage || 0), 100)
  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      <View style={styles.view2}>
        <HardHat size={16} color={COLORS.brand[700]} />
        <Text style={styles.text3} numberOfLines={1}>
          {project.project_title || project.title || 'Project'}
        </Text>
        <StatusChip label={`${completion}%`} />
      </View>
      <View style={styles.view3}>
        <MapPin size={12} color={COLORS.slate[400]} />
        <Text style={styles.text4} numberOfLines={1}>
          {project.address || 'Location not set'}{project.pincode ? ` · ${project.pincode}` : ''}
        </Text>
      </View>
      <View style={styles.view4}>
        <View style={[styles.view5, { width: `${completion}%` }]} />
      </View>
    </Pressable>
  )
}

function DetailField({ label, value }) {
  return (
    <View style={styles.view6}>
      <Text style={styles.text5}>{label}</Text>
      <Text style={styles.text6} numberOfLines={1}>{value || 'Not set'}</Text>
    </View>
  )
}

function ProjectDetail({ project, onBack }) {
  const [activeTab, setActiveTab] = useState('details')
  const timeline = useAsyncData(() => fetchProjectTimelineEntries(project.id), [project.id])
  const engineer = useAsyncData(() => fetchProjectEngineer(project.id).catch(() => ({ engineer: null })), [project.id])
  const suppliers = useAsyncData(() => fetchProjectSuppliers(project.id).catch(() => []), [project.id])
    const mySuppliers = useAsyncData(() => fetchContractorSuppliers().catch(() => []), [])
  const [supplierBusyId, setSupplierBusyId] = useState(null)

  const mySupplierList = Array.isArray(mySuppliers.data) ? mySuppliers.data : []

  async function changeSupplier(supplier, assign) {
    const engineerId = (engineer.data?.engineer || {}).user_id
    if (assign && !engineerId) {
      Alert.alert('Assign an engineer first', 'A supplier is assigned to the site engineer — appoint one on this project before assigning suppliers.')
      return
    }
    const supplierId = supplier.user_id || supplier.id
    setSupplierBusyId(supplierId)
    try {
      if (assign) await assignSupplierToProject(project.id, supplierId, engineerId)
      else await unassignSupplierFromProject(project.id, supplierId, supplier.engineer_id || engineerId)
      await suppliers.reload()
    } catch (error) {
      Alert.alert('Could not update', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setSupplierBusyId(null)
    }
  }

  const timelineList = Array.isArray(timeline.data) ? timeline.data : []
  const supplierList = Array.isArray(suppliers.data) ? suppliers.data : []
  const assignedEngineer = engineer.data?.engineer || null
  const milestones = Array.isArray(project.escrow_milestones) ? project.escrow_milestones : []

  return (
    <View>
      <Pressable onPress={onBack} style={styles.pressable2}>
        <ChevronLeft size={18} color={COLORS.brand[700]} />
        <Text style={styles.text7}>All projects</Text>
      </Pressable>

      <Text style={styles.text8}>{project.project_title || project.title}</Text>
      <Text style={styles.text9}>
        {project.address || 'Location not set'}{project.pincode ? ` · ${project.pincode}` : ''}
      </Text>

      {/* Sub-tab strip — same 4 tabs as web ContractorProjectDetail */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.view7} contentContainerStyle={{ gap: 6 }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.pressable3, active ? styles.pressable4 : styles.pressable5]}
            >
              <Text style={[styles.text10, active ? styles.text11 : styles.text]}>{tab.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <View style={styles.view7}>
        {activeTab === 'details' && (
          <View style={styles.view8}>
            <DetailField label="Construction" value={project.construction_type} />
            <DetailField label="Building type" value={project.building_type} />
            <DetailField label="Land area" value={project.land_area ? `${project.land_area} Sq.ft` : null} />
            <DetailField label="Floors" value={project.floors != null ? String(project.floors) : null} />
            <DetailField label="Budget" value={inr(project.budget)} />
            <DetailField label="Status" value={project.status} />
          </View>
        )}

        {activeTab === 'activity' && (
          <Panel title="Site activity">
            <PanelState loading={timeline.loading} error={timeline.error} empty={!timelineList.length} emptyText="No site updates logged yet.">
              {timelineList.map((entry, index) => (
                <View key={entry.id || index} style={styles.view9}>
                  <Text style={styles.text12}>
                    {String(entry.date || entry.work_date || '').slice(0, 10)}
                  </Text>
                  <Text style={styles.text13}>
                    {entry.work_type || entry.description || 'Daily site record'}
                  </Text>
                  {!!(entry.images || []).length && (
                    <Text style={styles.text14}>
                      {(entry.images || []).length} photo(s)
                    </Text>
                  )}
                </View>
              ))}
            </PanelState>
          </Panel>
        )}

        {activeTab === 'team' && (
          <>
            <Panel title="Site engineer">
              <PanelState loading={engineer.loading} error={engineer.error} empty={!assignedEngineer} emptyText="No engineer assigned yet. Assign one from the Engineers tab.">
                {assignedEngineer && (
                  <View>
                    <Text style={styles.text15}>{assignedEngineer.name || assignedEngineer.full_name}</Text>
                    <Text style={styles.text16}>{assignedEngineer.category || 'Site Engineer'}</Text>
                  </View>
                )}
              </PanelState>
            </Panel>
                        <Panel title="Suppliers on this project">
              <PanelState loading={suppliers.loading} error={suppliers.error} empty={!supplierList.length} emptyText="No suppliers assigned to this project.">
                {supplierList.map((supplier, index) => {
                  const id = supplier.user_id || supplier.id
                  return (
                    <View key={id || index} style={styles.view10}>
                      <View style={styles.view11}>
                        <Text style={styles.text17}>{supplier.business_name || supplier.name}</Text>
                        {!!supplier.material_types && (
                          <Text style={styles.text16}>{String(supplier.material_types)}</Text>
                        )}
                      </View>
                      <Pressable onPress={() => changeSupplier(supplier, false)} disabled={supplierBusyId === id} style={styles.pressable6}>
                        <Text style={styles.text18}>Remove</Text>
                      </Pressable>
                    </View>
                  )
                })}
              </PanelState>
            </Panel>
            <Panel title="Assign a supplier">
              <PanelState loading={mySuppliers.loading} empty={!mySupplierList.length} emptyText="No approved suppliers yet — accept a supplier partnership from the Home tab first.">
                {mySupplierList
                  .filter((s) => !supplierList.some((assigned) => (assigned.user_id || assigned.id) === (s.user_id || s.id)))
                  .map((supplier) => {
                    const id = supplier.user_id || supplier.id
                    return (
                      <View key={id} style={styles.view10}>
                        <View style={styles.view11}>
                          <Text style={styles.text17}>{supplier.business_name || supplier.name}</Text>
                        </View>
                        <Pressable onPress={() => changeSupplier(supplier, true)} disabled={supplierBusyId === id} style={styles.pressable7}>
                          <Text style={styles.text19}>Assign</Text>
                        </Pressable>
                      </View>
                    )
                  })}
              </PanelState>
            </Panel>
          </>
        )}

        {activeTab === 'payments' && (
          <Panel title="Escrow milestones">
            <PanelState empty={!milestones.length} emptyText="No milestones set up for this project yet.">
              {milestones.map((milestone) => (
                <View key={milestone.id} style={styles.view12}>
                  <Text style={styles.text20}>{milestone.name}</Text>
                  <View style={styles.view13}>
                    <Text style={styles.text21}>{inr(milestone.amount)}</Text>
                    <StatusChip label={milestone.status || 'PENDING'} tone={milestone.status === 'RELEASED' ? 'positive' : 'muted'} />
                  </View>
                </View>
              ))}
            </PanelState>
          </Panel>
        )}
      </View>
    </View>
  )
}

export default function ContractorProjectsScreen({ navigation }) {
  const [selected, setSelected] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const projects = useAsyncData(fetchOwnerProjects, [])
  const projectList = Array.isArray(projects.data) ? projects.data : []

  const onRefresh = async () => {
    setRefreshing(true)
    await projects.reload()
    setRefreshing(false)
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      {selected ? (
        <ProjectDetail project={selected} onBack={() => setSelected(null)} />
      ) : (
        <Panel title="Project sites">
          <PanelState loading={projects.loading} error={projects.error} empty={!projectList.length} emptyText="No projects assigned yet. Accept a request to get started.">
            {projectList.map((project) => (
              <ProjectCard key={project.id} project={project} onPress={() => setSelected(project)} />
            ))}
          </PanelState>
        </Panel>
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
  pressable: { marginBottom: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view2: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text3: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text },
  view3: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text4: { flex: 1, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  view4: { marginTop: 10.5, height: 5.25, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.muted },
  view5: { height: '100%', borderRadius: 9999, backgroundColor: '#236645' },
  view6: { width: '48%', borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.subtle, paddingHorizontal: 10.5, paddingVertical: 7 },
  text5: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, color: c.textFaint },
  text6: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '700', color: c.text },
  pressable2: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  text7: { fontSize: 12.25, lineHeight: 17.5, fontWeight: '800', color: c.brandText },
  text8: { fontSize: 17.5, lineHeight: 24.5, fontWeight: '800', color: c.text },
  text9: { marginTop: 3.5, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  view7: { marginTop: 14 },
  pressable3: { borderRadius: 10.5, paddingHorizontal: 14, paddingVertical: 7 },
  pressable4: { backgroundColor: '#1a5038' },
  pressable5: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  text10: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  text11: { color: '#ffffff' },
  view8: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8.75 },
  view9: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text12: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: c.brandText },
  text13: { marginTop: 3.5, fontSize: 13, fontWeight: '600', color: c.text },
  text14: { marginTop: 1.75, fontSize: 11, fontWeight: '600', color: c.textFaint },
  text15: { fontSize: 15, fontWeight: '800', color: c.text },
  text16: { marginTop: 1.75, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  view10: { flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8.75 },
  view11: { flex: 1 },
  text17: { fontSize: 14, fontWeight: '800', color: c.text },
  pressable6: { borderRadius: 7, borderWidth: 1, borderColor: c.roseBorder, backgroundColor: c.roseSoft, paddingHorizontal: 8.75, paddingVertical: 5.25 },
  text18: { fontSize: 10, fontWeight: '800', color: c.roseText },
  pressable7: { borderRadius: 7, backgroundColor: '#1a5038', paddingHorizontal: 10.5, paddingVertical: 5.25 },
  text19: { fontSize: 10, fontWeight: '800', color: '#ffffff' },
  view12: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text20: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
  view13: { alignItems: 'flex-end' },
  text21: { fontSize: 15, fontWeight: '800', color: c.brandText },
}))
