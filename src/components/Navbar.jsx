// Port of the web src/components/site/Navbar.jsx — condensed for mobile into a
// translucent floating bar with the logo, a language picker and Sign in.
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { BlurWrap } from './BlurWrap'
import { Globe } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '../i18n/LanguageContext'
import { createStyles } from '../theme/createStyles'

export default function Navbar({ onLogin, onOpenLanguage }) {
  const insets = useSafeAreaInsets()
  const { t, language } = useLanguage()
  return (
    <View style={[styles.view, { paddingTop: insets.top }]}>
      <BlurWrap>
        <View style={styles.view2}>
          <View style={[styles.view3, { gap: 8 }]}>
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 28, height: 31 }}
              contentFit="contain"
            />
            <Text style={[styles.text, { fontSize: 17, letterSpacing: -0.5 }]}>
              OctaBuild
            </Text>
          </View>
          <View style={[styles.view3, { gap: 10 }]}>
            <Pressable
              onPress={onOpenLanguage}
              accessibilityRole="button"
              accessibilityLabel={t('language.label')}
              style={[styles.pressable, { gap: 5 }]}
            >
              <Globe size={14} color="#236645" />
              <Text style={[styles.text2, { fontSize: 11 }]}>
                {language}
              </Text>
            </Pressable>
            <Pressable
              onPress={onLogin}
              accessibilityRole="button"
              style={styles.pressable2}
            >
              <Text style={[styles.text3, { fontSize: 12 }]}>
                {t('site.nav.login')}
              </Text>
            </Pressable>
          </View>
        </View>
      </BlurWrap>
    </View>
  )
}

const styles = createStyles((c) => ({
  view: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 50 },
  view2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17.5, paddingVertical: 10.5 },
  view3: { flexDirection: 'row', alignItems: 'center' },
  text: { fontFamily: 'Manrope_800ExtraBold', color: c.brandTextStrong },
  pressable: { flexDirection: 'row', alignItems: 'center', borderRadius: 9999, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, paddingHorizontal: 10.5, paddingVertical: 7 },
  text2: { fontFamily: 'Inter_700Bold', textTransform: 'uppercase', color: c.text },
  pressable2: { borderRadius: 9999, backgroundColor: '#134127', paddingHorizontal: 14, paddingVertical: 7 },
  text3: { fontFamily: 'Inter_700Bold', color: '#ffffff' },
}))
