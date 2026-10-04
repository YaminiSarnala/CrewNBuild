// Port of the engineer's My Projects section: assigned projects, site
// activity, and progress updates via the same endpoint the web uses.
import { useState } from 'react'
import { View, Text, Pressable, ScrollView, Alert, TextInput } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ChevronLeft, HardHat, MapPin, Minus, Plus } from 'lucide-react-native'
import DashboardShell, { Panel, PanelState, useAsyncData } from '../../components/DashboardShell'
import { fetchEngineerProjects } from '../../api/engineers'
import { fetchProjectTimelineEntries, updateProjectProgress, saveDailyWorkflow } from '../../api/projects'
import { COLORS } from '../../theme/tokens'


function DailyLogPanel({ projectId, onSaved }) {
  const [workType, setWorkType] = useState('')
  const [workers, setWorkers] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)

  async function pickPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach site photos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    })
    if (!result.canceled) setPhotos((current) => [...current, ...result.assets])
  }

  async function submit() {
    if (!workType.trim()) {
      Alert.alert('Missing details', 'Describe today\'s work before saving.')
      return
    }
    setBusy(true)
    try {
      const payload = new FormData()
      payload.append('work_date', new Date().toISOString().slice(0, 10))
      payload.append('action', 'SAVE')
      payload.append('work_type', workType.trim())
      payload.append('labour_worker_count', String(Number(workers) || 0))
      payload.append('material_cost', '0')
      payload.append('material_usage', '[]')
      photos.forEach((photo, index) => {
        payload.append('images', {
          uri: photo.uri,
          name: photo.fileName || `site-photo-${index}.jpg`,
          type: photo.mimeType || 'image/jpeg',
        })
      })
      await saveDailyWorkflow(projectId, payload)
      setWorkType('')
      setWorkers('')
      setPhotos([])
      Alert.alert('Saved', 'Today\'s site record has been logged.')
      onSaved()
    } catch (error) {
      Alert.alert('Could not save', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Today's site log">
      <TextInput
        value={workType}
        onChangeText={setWorkType}
        placeholder="Work done today (e.g. Slab casting, 2nd floor)"
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite"
        placeholderTextColor={COLORS.slate[400]}
      />
      <TextInput
        value={workers}
        onChangeText={setWorkers}
        placeholder="Workers on site"
        keyboardType="number-pad"
        className="mt-2 h-11 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-graphite"
        placeholderTextColor={COLORS.slate[400]}
      />
      <Pressable onPress={pickPhotos} className="mt-2 h-11 items-center justify-center rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/50">
        <Text className="text-[13px] font-extrabold text-brand-700">
          {photos.length ? `${photos.length} photo(s) ready — add more` : 'Add site photos'}
        </Text>
      </Pressable>
      <Pressable onPress={submit} disabled={busy} className={`mt-3 h-11 items-center justify-center rounded-xl bg-brand-700 ${busy ? 'opacity-50' : ''}`}>
        <Text className="text-[13px] font-extrabold text-white">{busy ? 'Saving…' : 'Save daily record'}</Text>
      </Pressable>
    </Panel>
    
  )
}
function ProjectDetail({ project, onBack, onProgressSaved, navigation }) {
    const [progress, setProgress] = useState(Math.min(Number(project.completion_percentage || 0), 100))
  const [saving, setSaving] = useState(false)
  const timeline = useAsyncData(() => fetchProjectTimelineEntries(project.id), [project.id])
  const timelineList = Array.isArray(timeline.data) ? timeline.data : []

  async function saveProgress() {
    setSaving(true)
    try {
      await updateProjectProgress(project.id, progress)
      Alert.alert('Progress updated', `${project.project_title || project.title} is now at ${progress}%.`)
      onProgressSaved()
    } catch (error) {
      Alert.alert('Could not update', error?.response?.data?.detail || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View>
      <Pressable onPress={onBack} className="mb-3 flex-row items-center gap-1">
        <ChevronLeft size={18} color={COLORS.brand[700]} />
        <Text className="text-sm font-extrabold text-brand-700">My projects</Text>
      </Pressable>
            <Pressable
        onPress={() => navigation.navigate('LiveCamera', { projectId: project.id, projectTitle: project.project_title || project.title })}
        className="mb-1 mt-2 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50"
      >
        <Text className="text-[13px] font-extrabold text-brand-800">📹 Live site camera</Text>
      </Pressable>
      <Text className="text-xl font-extrabold text-graphite">{project.project_title || project.title}</Text>
      <Text className="mt-1 text-xs font-semibold text-slate-500">
        {project.address || 'Location not set'}{project.pincode ? ` · ${project.pincode}` : ''}
      </Text>

      <Panel title="Site progress" className="mt-4">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => setProgress((p) => Math.max(0, p - 5))} className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <Minus size={16} color={COLORS.graphite} />
          </Pressable>
          <View className="flex-1 items-center">
            <Text className="text-3xl font-extrabold text-brand-700">{progress}%</Text>
            <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <View className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
            </View>
          </View>
          <Pressable onPress={() => setProgress((p) => Math.min(100, p + 5))} className="h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <Plus size={16} color={COLORS.graphite} />
          </Pressable>
        </View>
        <Pressable onPress={saveProgress} disabled={saving} className={`mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 ${saving ? 'opacity-50' : ''}`}>
          <Text className="text-[13px] font-extrabold text-white">{saving ? 'Saving…' : 'Save progress'}</Text>
        </Pressable>
      </Panel>
      <DailyLogPanel projectId={project.id} onSaved={() => timeline.reload()} />
      <Panel title="Site activity">
        <PanelState loading={timeline.loading} error={timeline.error} empty={!timelineList.length} emptyText="No daily records yet. Full daily-log entry with photos arrives in the next update.">
          {timelineList.map((entry, index) => (
            <View key={entry.id || index} className="border-b border-slate-100 py-3">
              <Text className="text-xs font-extrabold text-brand-700">{String(entry.date || entry.work_date || '').slice(0, 10)}</Text>
              <Text className="mt-1 text-[13px] font-semibold text-graphite">{entry.work_type || entry.description || 'Daily site record'}</Text>
            </View>
          ))}
        </PanelState>
      </Panel>
    </View>
  )
}

export default function EngineerProjectsScreen({ navigation }) {
  const [selected, setSelected] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const projects = useAsyncData(fetchEngineerProjects, [])
  const projectList = Array.isArray(projects.data) ? projects.data : []

  const onRefresh = async () => {
    setRefreshing(true)
    await projects.reload()
    setRefreshing(false)
  }

  return (
    <DashboardShell refreshing={refreshing} onRefresh={onRefresh} onOpenNotifications={() => navigation.navigate('Notifications')}>
      {selected ? (
        <ProjectDetail project={selected} navigation={navigation} onBack={() => setSelected(null)} onProgressSaved={() => projects.reload()} />      ) : (
        <Panel title="My projects">
          <PanelState loading={projects.loading} error={projects.error} empty={!projectList.length} emptyText="No projects assigned yet. Join a builder's team from the Jobs tab.">
            {projectList.map((project) => {
              const completion = Math.min(Number(project.completion_percentage || 0), 100)
              return (
                <Pressable key={project.id} onPress={() => setSelected(project)} className="mb-3 rounded-3xl border border-slate-200 bg-white p-4">
                  <View className="flex-row items-center gap-2">
                    <HardHat size={16} color={COLORS.brand[700]} />
                    <Text className="flex-1 text-[15px] font-extrabold text-graphite" numberOfLines={1}>{project.project_title || project.title || 'Project'}</Text>
                    <Text className="text-xs font-extrabold text-brand-700">{completion}%</Text>
                  </View>
                  <View className="mt-2 flex-row items-center gap-1.5">
                    <MapPin size={12} color={COLORS.slate[400]} />
                    <Text className="flex-1 text-xs font-semibold text-slate-500" numberOfLines={1}>
                      {project.address || 'Location not set'}{project.pincode ? ` · ${project.pincode}` : ''}
                    </Text>
                  </View>
                  <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <View className="h-full rounded-full bg-brand-600" style={{ width: `${completion}%` }} />
                  </View>
                </Pressable>
              )
            })}
          </PanelState>
        </Panel>
        
      )}
    </DashboardShell>
  )
}