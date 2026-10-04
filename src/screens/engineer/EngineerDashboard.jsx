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
                className="mb-3 flex-row items-center active:opacity-70"
                style={{ gap: 10 }}
              >
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
                  <HardHat size={16} color="#134127" />
                </View>
                <View className="flex-1">
                  <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }} numberOfLines={1}>
                    {project.title}
                  </Text>
                  <Text className="font-sans text-slate-500" style={{ fontSize: 12 }}>
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
              <View key={item.id} className="mb-4 rounded-2xl bg-slate-50 p-4">
                <Text className="font-sansBold text-graphite" style={{ fontSize: 14.5 }}>
                  {item.title}
                </Text>
                <Text className="mt-1 font-sans text-slate-500" style={{ fontSize: 12.5 }}>
                  {item.pincode || '—'} {item.building_type ? `· ${item.building_type}` : ''}
                </Text>
                <Pressable
                  onPress={() => apply(item.id)}
                  className="mt-3 flex-row items-center justify-center rounded-full bg-brand-800 py-2.5 active:bg-brand-700"
                  style={{ gap: 6 }}
                >
                  <Send size={14} color="#ffffff" />
                  <Text className="font-sansBold text-white" style={{ fontSize: 13 }}>
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
              <View key={request.id} className="mb-3 flex-row items-center" style={{ gap: 10 }}>
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <ClipboardList size={16} color="#475569" />
                </View>
                <View className="flex-1">
                  <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }}>
                    {request.material_name || `Request #${request.id}`}
                  </Text>
                  <Text className="font-sans text-slate-500" style={{ fontSize: 12 }}>
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
