// Temporary body for a screen whose phase has not landed yet. Keeps the app
// compiling and navigable while screens are ported one phase at a time.
import { View, Text, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowLeft } from 'lucide-react-native'
import { COLORS } from '../../theme/tokens'
import { createStyles } from '../../theme/createStyles'

export default function PlaceholderScreen({ navigation, title = 'Coming soon', phase }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.view, { paddingTop: insets.top }]}>
      {navigation?.canGoBack?.() && (
        <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Back" style={styles.pressable}>
          <ArrowLeft size={20} color={COLORS.brand[800]} />
        </Pressable>
      )}
      <View style={styles.view2}>
        <Text style={styles.text}>{title}</Text>
        <Text style={styles.text2}>
          This section is being ported from the web app{phase ? ` (Phase ${phase})` : ''}.
        </Text>
      </View>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1, backgroundColor: c.brandSoft },
  pressable: { marginLeft: 10.5, marginTop: 7, alignSelf: 'flex-start', padding: 7 },
  view2: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  text: { fontSize: 15.75, lineHeight: 24.5, fontWeight: '800', color: c.brandTextStrong },
  text2: { marginTop: 7, textAlign: 'center', fontSize: 12.25, lineHeight: 17.5, color: c.textMuted },
}))
