// Port of the web src/components/site/Navbar.jsx — condensed for mobile into a
// translucent floating bar with the logo, a language picker and Sign in.
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import { BlurWrap } from './BlurWrap'
import { Globe } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '../i18n/LanguageContext'

export default function Navbar({ onLogin, onOpenLanguage }) {
  const insets = useSafeAreaInsets()
  const { t, language } = useLanguage()
  return (
    <View style={{ paddingTop: insets.top }} className="absolute left-0 right-0 top-0 z-50">
      <BlurWrap>
        <View className="flex-row items-center justify-between px-5 py-3">
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 28, height: 31 }}
              contentFit="contain"
            />
            <Text className="font-display text-brand-800" style={{ fontSize: 17, letterSpacing: -0.5 }}>
              OctaBuild
            </Text>
          </View>
          <View className="flex-row items-center" style={{ gap: 10 }}>
            <Pressable
              onPress={onOpenLanguage}
              accessibilityRole="button"
              accessibilityLabel={t('language.label')}
              className="flex-row items-center rounded-full border border-slate-200 bg-white px-3 py-2 active:bg-slate-50"
              style={{ gap: 5 }}
            >
              <Globe size={14} color="#236645" />
              <Text className="font-sansBold uppercase text-graphite" style={{ fontSize: 11 }}>
                {language}
              </Text>
            </Pressable>
            <Pressable
              onPress={onLogin}
              accessibilityRole="button"
              className="rounded-full bg-brand-800 px-4 py-2 active:bg-brand-700"
            >
              <Text className="font-sansBold text-white" style={{ fontSize: 12 }}>
                {t('site.nav.login')}
              </Text>
            </Pressable>
          </View>
        </View>
      </BlurWrap>
    </View>
  )
}
