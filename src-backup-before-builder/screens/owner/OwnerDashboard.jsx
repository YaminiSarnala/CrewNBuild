// Port of the web src/pages/owner/OwnerDashboard.jsx.
// Wired to: GET /owners/projects, GET /contractors/nearby, GET /suppliers/nearby,
// GET /project-requests/incoming.
import { useState, useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useSelector } from 'react-redux'
import { Plus, MapPin, ChevronRight } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, MetricRow, useAsyncData } from '../../components/DashboardShell'
import LanguageSheet from '../../components/LanguageSheet'
import { PrimaryButton } from '../../components/ui'
import { fetchOwnerProjects, fetchNearbyContractors, fetchNearbySuppliers } from '../../api/projects'
import { fetchIncomingRequests } from '../../api/requests'
import { useLanguage } from '../../i18n/LanguageContext'

function ProjectRow({ project, onPress }) {
  const progress = Number(project.completion_percentage || 0)
  return (
    <Pressable onPress={onPress} className="mb-3 active:opacity-70">
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View className="flex-1">
          <Text className="font-sansBold text-graphite" style={{ fontSize: 14.5 }} numberOfLines={1}>
            {project.title}
          </Text>
          <View className="mt-1 flex-row items-center" style={{ gap: 4 }}>
            <MapPin size={11} color="#94a3b8" />
            <Text className="font-sans text-slate-500" style={{ fontSize: 12 }} numberOfLines={1}>
              {project.address || project.pincode}
            </Text>
          </View>
          <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <View className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(progress, 100)}%` }} />
          </View>
        </View>
        <Text className="font-display text-brand-800" style={{ fontSize: 15 }}>
          {progress}%
        </Text>
        <ChevronRight size={16} color="#cbd5e1" />
      </View>
    </Pressable>
  )
}

export default function OwnerDashboard({ navigation }) {
  const { t } = useLanguage()
  const user = useSelector((state) => state.auth.user)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const projects = useAsyncData(fetchOwnerProjects, [])
  const contractors = useAsyncData(
    () => fetchNearbyContractors(user?.pincode),
    [user?.pincode]
  )
  const suppliers = useAsyncData(
    () => fetchNearbySuppliers(user?.pincode),
    [user?.pincode]
  )
  const requests = useAsyncData(fetchIncomingRequests, [])

  const onRefresh = useCallback(async () => {
  setRefreshing(true)

  try {
    await Promise.all([
      projects.reload(),
      contractors.reload(),
      suppliers.reload(),
      requests.reload(),
    ])
  } finally {
    setRefreshing(false)
  }
}, [projects, contractors, suppliers, requests])

  const projectList = Array.isArray(projects.data) ? projects.data : []
  const activeCount = projectList.filter((p) => Number(p.completion_percentage || 0) < 100).length

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
            { label: 'Projects', value: String(projectList.length) },
            { label: 'Active', value: String(activeCount) },
            { label: 'Requests', value: String(Array.isArray(requests.data) ? requests.data.length : 0) },
          ]}
        />

        <View className="mx-5 mb-4">
          <PrimaryButton
            label="Start a new project"
            onPress={() => navigation.navigate('CreateProject')}
            icon={<Plus size={16} color="#ffffff" />}
            full
          />
        </View>

        <Panel title="My projects">
          <PanelState
            loading={projects.loading}
            error={projects.error}
            empty={projectList.length === 0}
            emptyText="No projects yet. Create your first one above."
          >
            {projectList.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: project.id })}
              />
            ))}
          </PanelState>
        </Panel>

        <Panel title="Builders near you">
  <PanelState
    loading={contractors.loading}
    error={contractors.error}
    empty={
      !Array.isArray(contractors.data) ||
      contractors.data.length === 0
    }
    emptyText="No builders found for your pincode yet."
  >
    {Array.isArray(contractors.data) &&
      contractors.data.slice(0, 5).map((item, index) => (
        <View
          key={item?.id ?? `contractor-${index}`}
          className="mb-3 flex-row items-center justify-between"
        >
          <View className="flex-1">
            <Text
              className="font-sansBold text-graphite"
              style={{ fontSize: 14 }}
            >
              {item?.company_name || item?.name || 'Builder'}
            </Text>

            <Text
              className="font-sans text-slate-500"
              style={{ fontSize: 12 }}
            >
              {item?.pincode || '—'}
              {' · '}
              {item?.experience_years
                ? `${item.experience_years} yrs`
                : '—'}
            </Text>
          </View>

          <Text
            className="font-display text-brand-700"
            style={{ fontSize: 13 }}
          >
            {item?.rating != null
              ? `★ ${Number(item.rating).toFixed(1)}`
              : '—'}
          </Text>
        </View>
      ))}
  </PanelState>
</Panel>

        <Panel title="Suppliers near you">
  <PanelState
    loading={suppliers.loading}
    error={suppliers.error}
    empty={
      !Array.isArray(suppliers.data) ||
      suppliers.data.length === 0
    }
    emptyText="No suppliers found for your pincode yet."
  >
    {Array.isArray(suppliers.data) &&
      suppliers.data.slice(0, 5).map((item, index) => (
        <View
          key={item?.id ?? `supplier-${index}`}
          className="mb-3"
        >
          <Text
            className="font-sansBold text-graphite"
            style={{ fontSize: 14 }}
          >
            {item?.store_name || item?.name || 'Supplier'}
          </Text>

          <Text
            className="font-sans text-slate-500"
            style={{ fontSize: 12 }}
          >
            {Array.isArray(item?.categories)
              ? item.categories.join(', ')
              : item?.categories || '—'}
          </Text>
        </View>
      ))}
  </PanelState>
</Panel>
      </DashboardShell>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </>
  )
}
