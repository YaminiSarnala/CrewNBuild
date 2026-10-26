// Port of the web src/pages/engineer/EngineerDashboard.jsx.
// Wired to: GET /engineers/my-projects, GET /engineers/opportunities,
// GET /material-requests/mine, POST /engineers/opportunities/{id}/apply.
import { useState, useCallback } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { HardHat, Send, ClipboardList } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, MetricRow, useAsyncData } from '../../components/DashboardShell'
import LanguageSheet from '../../components/LanguageSheet'
import { fetchEngineerProjects, fetchEngineerOpportunities, applyEngineerOpportunity } from '../../api/engineers'
import { fetchMyMaterialRequests } from '../../api/materialRequests'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

export default function EngineerDashboard({ navigation }) {
  const [languageOpen, setLanguageOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const projects = useAsyncData(fetchEngineerProjects, [])
  const opportunities = useAsyncData(fetchEngineerOpportunities, [])
  const materials = useAsyncData(fetchMyMaterialRequests, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([projects.reload(), opportunities.reload(), materials.reload()])
    setRefreshing(false)
  }, [projects, opportunities, materials])

  async function apply(projectId) {
    try {
      await applyEngineerOpportunity(projectId)
      await opportunities.reload()
      Alert.alert('Applied', 'Your application has been sent.')
    } catch (error) {
      Alert.alert('Could not apply', error?.response?.data?.detail || 'Please try again.')
    }
  }

  const projectList = Array.isArray(projects.data) ? projects.data : []
  const opportunityList = Array.isArray(opportunities.data) ? opportunities.data : []
  const materialList = Array.isArray(materials.data) ? materials.data : []

  return (
    <>
      <DashboardShell
        refreshing={refreshing}
        onRefresh={onRefresh}
        onOpenLanguage={() => setLanguageOpen(true)}
        onOpenNotifications={() => navigation.navigate('Notifications')}
      >
        <MetricRow
          items={[
            { label: 'My sites', value: String(projectList.length) },
            { label: 'Openings', value: String(opportunityList.length) },
            { label: 'Requests', value: String(materialList.length) },
          ]}
        />

        <Panel title="My sites">
          <PanelState
            loading={projects.loading}
            error={projects.error}
            empty={projectList.length === 0}
            emptyText="You are not assigned to any site yet."
          >
            {projectList.map((project) => (
              <Pressable
                key={project.id}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: project.id })}
                style={[styles.view, { gap: 10 }]}
              >
                <View style={styles.view2}>
                  <HardHat size={16} color={COLORS.brand[800]} />
                </View>
                <View style={styles.view3}>
                  <Text style={[styles.text, { fontSize: 14 }]} numberOfLines={1}>
                    {project.title}
                  </Text>
                  <Text style={[styles.text2, { fontSize: 12 }]}>
                    {Number(project.completion_percentage || 0)}% complete
                  </Text>
                </View>
              </Pressable>
            ))}
          </PanelState>
        </Panel>

        <Panel title="Open positions">
          <PanelState
            loading={opportunities.loading}
            error={opportunities.error}
            empty={opportunityList.length === 0}
            emptyText="No open positions right now."
          >
            {opportunityList.map((item) => (
              <View key={item.id} style={styles.view4}>
                <Text style={[styles.text, { fontSize: 14.5 }]}>
                  {item.title}
                </Text>
                <Text style={[styles.text3, { fontSize: 12.5 }]}>
                  {item.pincode || '—'} {item.building_type ? `· ${item.building_type}` : ''}
                </Text>
                <Pressable
                  onPress={() => apply(item.id)}
                  style={[styles.pressable, { gap: 6 }]}
                >
                  <Send size={14} color="#ffffff" />
                  <Text style={[styles.text4, { fontSize: 13 }]}>
                    Apply
                  </Text>
                </Pressable>
              </View>
            ))}
          </PanelState>
        </Panel>

        <Panel title="My material requests">
          <PanelState
            loading={materials.loading}
            error={materials.error}
            empty={materialList.length === 0}
            emptyText="You have not raised any material requests."
          >
            {materialList.map((request) => (
              <View key={request.id} style={[styles.view, { gap: 10 }]}>
                <View style={styles.view5}>
                  <ClipboardList size={16} color="#475569" />
                </View>
                <View style={styles.view3}>
                  <Text style={[styles.text, { fontSize: 14 }]}>
                    {request.material_name || `Request #${request.id}`}
                  </Text>
                  <Text style={[styles.text2, { fontSize: 12 }]}>
                    {request.status || 'Pending'}
                  </Text>
                </View>
              </View>
            ))}
          </PanelState>
        </Panel>
      </DashboardShell>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center' },
  view2: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: c.brandSoft },
  view3: { flex: 1 },
  text: { fontFamily: 'Inter_700Bold', color: c.text },
  text2: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  view4: { marginBottom: 14, borderRadius: 14, backgroundColor: c.subtle, padding: 14 },
  text3: { marginTop: 3.5, fontFamily: 'Inter_400Regular', color: c.textMuted },
  pressable: { marginTop: 10.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: '#134127', paddingVertical: 8.75 },
  text4: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
  view5: { height: 31.5, width: 31.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: c.muted },
}))
