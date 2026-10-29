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
import { createStyles } from '../../theme/createStyles'


function DailyLogPanel({ projectId, onSaved }) {
  const [workType, setWorkType] = useState('')
  const [workers, setWorkers] = useState('')
  const [photos, setPhotos] = useState([])
  const [busy, setBusy] = useState(false)

  async function pickPhotos() {
    // The system photo picker needs no permission; asking for one on Android
    // 13+ requests READ_MEDIA_IMAGES, which the app does not declare.
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
        style={styles.textInput}
        placeholderTextColor={COLORS.slate[400]}
      />
      <TextInput
        value={workers}
        onChangeText={setWorkers}
        placeholder="Workers on site"
        keyboardType="number-pad"
        style={styles.textInput2}
        placeholderTextColor={COLORS.slate[400]}
      />
      <Pressable onPress={pickPhotos} style={styles.pressable}>
        <Text style={styles.text}>
          {photos.length ? `${photos.length} photo(s) ready — add more` : 'Add site photos'}
        </Text>
      </Pressable>
      <Pressable onPress={submit} disabled={busy} style={[styles.pressable2, busy ? styles.pressable3 : null]}>
        <Text style={styles.text2}>{busy ? 'Saving…' : 'Save daily record'}</Text>
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
      <Pressable onPress={onBack} style={styles.pressable4}>
        <ChevronLeft size={18} color={COLORS.brand[700]} />
        <Text style={styles.text3}>My projects</Text>
      </Pressable>
            <Pressable
        onPress={() => navigation.navigate('LiveCamera', { projectId: project.id, projectTitle: project.project_title || project.title })}
        style={styles.pressable5}
      >
        <Text style={styles.text4}>📹 Live site camera</Text>
      </Pressable>
      <Text style={styles.text5}>{project.project_title || project.title}</Text>
      <Text style={styles.text6}>
        {project.address || 'Location not set'}{project.pincode ? ` · ${project.pincode}` : ''}
      </Text>

      <Panel title="Site progress" style={styles.panel}>
        <View style={styles.view}>
          <Pressable onPress={() => setProgress((p) => Math.max(0, p - 5))} style={styles.pressable6}>
            <Minus size={16} color={COLORS.graphite} />
          </Pressable>
          <View style={styles.view2}>
            <Text style={styles.text7}>{progress}%</Text>
            <View style={styles.view3}>
              <View style={[styles.view4, { width: `${progress}%` }]} />
            </View>
          </View>
          <Pressable onPress={() => setProgress((p) => Math.min(100, p + 5))} style={styles.pressable6}>
            <Plus size={16} color={COLORS.graphite} />
          </Pressable>
        </View>
        <Pressable onPress={saveProgress} disabled={saving} style={[styles.pressable7, saving ? styles.pressable3 : null]}>
          <Text style={styles.text2}>{saving ? 'Saving…' : 'Save progress'}</Text>
        </Pressable>
      </Panel>
      <DailyLogPanel projectId={project.id} onSaved={() => timeline.reload()} />
      <Panel title="Site activity">
        <PanelState loading={timeline.loading} error={timeline.error} empty={!timelineList.length} emptyText="No daily records yet. Full daily-log entry with photos arrives in the next update.">
          {timelineList.map((entry, index) => (
            <View key={entry.id || index} style={styles.view5}>
              <Text style={styles.text8}>{String(entry.date || entry.work_date || '').slice(0, 10)}</Text>
              <Text style={styles.text9}>{entry.work_type || entry.description || 'Daily site record'}</Text>
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
                <Pressable key={project.id} onPress={() => setSelected(project)} style={styles.pressable8}>
                  <View style={styles.view6}>
                    <HardHat size={16} color={COLORS.brand[700]} />
                    <Text style={styles.text10} numberOfLines={1}>{project.project_title || project.title || 'Project'}</Text>
                    <Text style={styles.text8}>{completion}%</Text>
                  </View>
                  <View style={styles.view7}>
                    <MapPin size={12} color={COLORS.slate[400]} />
                    <Text style={styles.text11} numberOfLines={1}>
                      {project.address || 'Location not set'}{project.pincode ? ` · ${project.pincode}` : ''}
                    </Text>
                  </View>
                  <View style={styles.view8}>
                    <View style={[styles.view4, { width: `${completion}%` }]} />
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

const styles = createStyles((c) => ({
  textInput: { height: 38.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  textInput2: { marginTop: 7, height: 38.5, borderRadius: 10.5, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, fontSize: 14, fontWeight: '600', color: c.text },
  pressable: { marginTop: 7, height: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, borderWidth: 2, borderStyle: 'dashed', borderColor: '#9dc5af', backgroundColor: c.brandSoft50 },
  text: { fontSize: 13, fontWeight: '800', color: c.brandText },
  pressable2: { marginTop: 10.5, height: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  pressable3: { opacity: 0.5 },
  text2: { fontSize: 13, fontWeight: '800', color: '#ffffff' },
  pressable4: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', gap: 3.5 },
  text3: { fontSize: 12.25, lineHeight: 17.5, fontWeight: '800', color: c.brandText },
  pressable5: { marginBottom: 3.5, marginTop: 7, height: 38.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10.5, borderWidth: 1, borderColor: c.brandBorderStrong, backgroundColor: c.brandSoft },
  text4: { fontSize: 13, fontWeight: '800', color: c.brandTextStrong },
  text5: { fontSize: 17.5, lineHeight: 24.5, fontWeight: '800', color: c.text },
  text6: { marginTop: 3.5, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  panel: { marginTop: 14 },
  view: { flexDirection: 'row', alignItems: 'center', gap: 10.5 },
  pressable6: { height: 35, width: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 9999, backgroundColor: c.muted },
  view2: { flex: 1, alignItems: 'center' },
  text7: { fontSize: 26.25, lineHeight: 31.5, fontWeight: '800', color: c.brandText },
  view3: { marginTop: 7, height: 5.25, width: '100%', overflow: 'hidden', borderRadius: 9999, backgroundColor: c.muted },
  view4: { height: '100%', borderRadius: 9999, backgroundColor: '#236645' },
  pressable7: { marginTop: 14, height: 38.5, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, backgroundColor: '#1a5038' },
  view5: { borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  text8: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: c.brandText },
  text9: { marginTop: 3.5, fontSize: 13, fontWeight: '600', color: c.text },
  pressable8: { marginBottom: 10.5, borderRadius: 21, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 14 },
  view6: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text10: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text },
  view7: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 5.25 },
  text11: { flex: 1, fontSize: 10.5, lineHeight: 14, fontWeight: '600', color: c.textMuted },
  view8: { marginTop: 10.5, height: 5.25, overflow: 'hidden', borderRadius: 9999, backgroundColor: c.muted },
}))
