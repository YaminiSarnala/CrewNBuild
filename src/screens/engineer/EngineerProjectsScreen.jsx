// The Site Engineer's My Projects tab — port of the web EngineerMyProjectsSection:
// the compact project cards (cover, builder, status, pincode / type / end date,
// progress and amount, the schedule bar, Open Project). Opening a project goes
// to its site log, as on the web.
// Wired to: GET /engineers/my-projects.
import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import DashboardShell, { PanelState, useAsyncData } from '../../components/DashboardShell'
import { Section } from '../../components/builder/BuilderUi'
import { useNotifications } from '../../notifications/NotificationsContext'
import { useLiveRefresh } from '../../hooks/useLiveRefresh'
import { fetchEngineerProjects } from '../../api/engineers'
import { EngineerMyProjects } from './engineerParts'

export default function EngineerProjectsScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false)
  const projects = useAsyncData(fetchEngineerProjects, [])
  const { markSectionRead } = useNotifications()
  useLiveRefresh(() => projects.reload())
  // Opening My Projects clears its project notifications, as on the web.
  useFocusEffect(useCallback(() => { markSectionRead('projects') }, [markSectionRead]))
  const projectList = Array.isArray(projects.data) ? projects.data : []

  const onRefresh = async () => {
    setRefreshing(true)
    try { await projects.reload() } finally { setRefreshing(false) }
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <Section>
        <PanelState loading={projects.loading && !projects.data} error={projects.error} empty={false}>
          <EngineerMyProjects
            projectList={projectList}
            onOpenProject={(project) => navigation.navigate('EngineerSiteLog', { project })}
          />
        </PanelState>
      </Section>
    </DashboardShell>
  )
}