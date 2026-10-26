// A project's cameras as a full screen. The content is the shared
// ProjectCameraPanel (the web's ProjectCameraPanel + ProjectCameraViewer), so
// the Owner, the Builder and the Site Engineer all get the same thing: the
// one-time recorder verification, then Live and Recorded playback.
import { View, ScrollView, KeyboardAvoidingView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ScreenHeader from '../../components/ScreenHeader'
import { ContentWrap } from '../../components/Responsive'
import { InsetArea } from '../../components/DashboardShell'
import ProjectCameraPanel from '../../components/cctv/ProjectCameraPanel'
import { useLanguage } from '../../i18n/LanguageContext'
import { useResponsive } from '../../hooks/useResponsive'
import { createStyles } from '../../theme/createStyles'

export default function LiveCameraScreen({ navigation, route }) {
  // Full-screen pages draw under the Android navigation buttons; keep the end clear of them.
  const insets = useSafeAreaInsets()
  const { t, td } = useLanguage()
  const { gutter } = useResponsive()
  const { projectId, projectTitle } = route.params || {}
  return (
    <View style={styles.view}>
      <ScreenHeader title={t('ui.liveCamera')} subtitle={td(projectTitle)} onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 14, paddingBottom: 40 + insets.bottom }}>
        <ContentWrap>
          <InsetArea>
          <ProjectCameraPanel projectId={projectId} projectTitle={projectTitle} />
        </InsetArea>
          </ContentWrap>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1, backgroundColor: c.canvas },
}))
