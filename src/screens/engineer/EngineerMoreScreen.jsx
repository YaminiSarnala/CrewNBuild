// The Site Engineer's "More" tab: the web sections that do not fit the five
// bottom tabs — the account menu's Profile Settings, the top bar's Live Camera
// (opens on a chosen project), Messages and Notifications.
// Labels use the web keys (ui.*, dash.engineer.*).
import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Bell, Boxes, CalendarDays, Camera, ChevronRight, ClipboardList, LifeBuoy, MessageCircle, Settings } from 'lucide-react-native'
import DashboardShell, { useAsyncData } from '../../components/DashboardShell'
import { Section, SheetModal } from '../../components/builder/BuilderUi'
import HelpCenterSheet from '../../components/HelpCenterSheet'
import { useLanguage } from '../../i18n/LanguageContext'
import { useNotifications } from '../../notifications/NotificationsContext'
import { fetchEngineerProjects } from '../../api/engineers'
import { COLORS } from '../../theme/tokens'
import { ink, line, soft } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

const TONES = {
  rose: { bg: '#fff1f2', border: '#fecdd3', fg: '#e11d48' },
  violet: { bg: '#f5f3ff', border: '#ddd6fe', fg: '#6d28d9' },
    slate: { bg: '#f8fafc', border: '#e2e8f0', fg: '#475569' },
  orange: { bg: '#fff7ed', border: '#fed7aa', fg: '#ea580c' },
   amber: { bg: '#fffbeb', border: '#fde68a', fg: '#b45309' },
  brand: { bg: '#f0f6f2', border: '#c3dccd', fg: '#1a5038' },
  sky: { bg: '#f0f9ff', border: '#bae6fd', fg: '#0369a1' },
}

export default function EngineerMoreScreen({ navigation }) {
  const { t, td } = useLanguage()
  const { unreadCount, unreadMessages } = useNotifications()
  const projects = useAsyncData(fetchEngineerProjects, [])
  const projectList = Array.isArray(projects.data) ? projects.data : []
  const [pickCamera, setPickCamera] = useState(false)
    const [showHelp, setShowHelp] = useState(false)

  const openCamera = (project) => {
    setPickCamera(false)
    navigation.navigate('LiveCamera', { projectId: project.id, projectTitle: project.title })
  }
  const liveCamera = () => {
    if (projectList.length === 1) openCamera(projectList[0])
    else setPickCamera(true)
  }

  const menu = [
    // The web top bar's Calendar (the site log) and the Daily Logs list.
    { id: 'calendar', title: t('ui.calendar'), Icon: CalendarDays, tone: TONES.brand, onPress: () => navigation.navigate('EngineerSiteLog', { project: projectList[0] }) },
    { id: 'logs', title: t('se.savedDailyRecords'), Icon: ClipboardList, tone: TONES.sky, onPress: () => navigation.navigate('EngineerSiteLog', { project: projectList[0], view: 'logs' }) },
    // The web sidebar's Store Requests (requests sent to the Store Manager).
    { id: 'storeRequests', title: t('store.engineer.navStoreRequests'), Icon: Boxes, tone: TONES.violet, onPress: () => navigation.navigate('EngineerStoreRequests') },
    { id: 'camera', title: t('dash.engineer.hero.liveCamera'), Icon: Camera, tone: TONES.rose, onPress: liveCamera },
    { id: 'messages', title: t('ui.messages'), Icon: MessageCircle, tone: TONES.orange, badge: unreadMessages, onPress: () => navigation.navigate('Messages') },
    { id: 'notifications', title: t('dash.engineer.notifications'), Icon: Bell, tone: TONES.amber, badge: unreadCount, onPress: () => navigation.navigate('Notifications') },    { id: 'settings', title: t('ui.profileSettings'), Icon: Settings, tone: TONES.slate, onPress: () => navigation.navigate('EngineerProfile') },
        // The web account menu's Help & Feedback (opens the Help Center).
    { id: 'help', title: t('ui.helpFeedback'), Icon: LifeBuoy, tone: TONES.sky, onPress: () => setShowHelp(true) },
  ]

  return (
    <DashboardShell refreshing={false} onRefresh={() => projects.reload()} onOpenNotifications={() => navigation.navigate('Notifications')}>
      <Section>
        {menu.map(({ id, title, Icon, tone, badge, onPress }) => (
          <Pressable key={id} onPress={onPress} style={styles.em1}>
            <View style={[styles.em2, { backgroundColor: soft(tone.bg, tone.fg), borderColor: line(tone.border, tone.fg) }]}>
              <Icon size={19} color={ink(tone.fg)} />
            </View>
            <Text style={styles.em3}>{title}</Text>
            {badge ? (
              <View style={styles.em4}>
                <Text style={styles.em5}>{badge > 9 ? '9+' : badge}</Text>
              </View>
            ) : null}
            <ChevronRight size={18} color={COLORS.slate[400]} />
          </Pressable>
        ))}
      </Section>

      <SheetModal visible={pickCamera} title={t('dash.engineer.hero.liveCamera')} onClose={() => setPickCamera(false)}>
        {projectList.length ? projectList.map((project) => (
          <Pressable key={project.id} onPress={() => openCamera(project)} style={styles.em6}>
            <Text style={styles.em7} numberOfLines={1}>{td(project.title)}</Text>
            <ChevronRight size={16} color={COLORS.slate[400]} />
          </Pressable>
        )) : (
          <Text style={styles.em8}>{t('dash.engineer.noAssignedProjects')}</Text>
        )}
      </SheetModal>
      <HelpCenterSheet visible={showHelp} onClose={() => setShowHelp(false)} />
    </DashboardShell>
  )
}

const styles = createStyles((c) => ({
  em1: { marginBottom: 8.75, flexDirection: 'row', alignItems: 'center', gap: 10.5, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, padding: 12.25 },
  em2: { height: 35, width: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  em3: { flex: 1, fontSize: 14, fontWeight: '800', color: c.text },
  em4: { minWidth: 17.5, alignItems: 'center', borderRadius: 9999, backgroundColor: '#e11d48', paddingHorizontal: 5.25, paddingVertical: 1.75 },
  em5: { fontSize: 10, fontWeight: '800', color: '#ffffff' },
  em6: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 10.5 },
  em7: { flex: 1, fontSize: 14, fontWeight: '600', color: c.text },
  em8: { paddingVertical: 21, textAlign: 'center', fontSize: 14, lineHeight: 20, fontWeight: '600', color: c.textMuted },
}))