// Language and Dark Mode, as two rows of a profile's settings. They used to sit
// in every dashboard header; the header now keeps only weather, messages,
// notifications and sign out, and these live in each role's profile.
import { useState } from 'react'
import { View, Text, Pressable, Switch } from 'react-native'
import { ChevronRight, Globe, Moon, Sun } from 'lucide-react-native'
import LanguageSheet from './LanguageSheet'
import { useLanguage } from '../i18n/LanguageContext'
import { useTheme } from '../theme/ThemeContext'
import { COLORS } from '../theme/tokens'
import { createStyles } from '../theme/createStyles'

export default function PreferenceRows({ style }) {
  const { t, language, languages } = useLanguage()
  const { isDark, setTheme } = useTheme()
  const [languageOpen, setLanguageOpen] = useState(false)
  const current = languages.find((item) => item.code === language)?.name || ''

  return (
    <View style={style}>
      <Pressable onPress={() => setLanguageOpen(true)} style={styles.row} accessibilityRole="button" accessibilityLabel={t('language.label')}>
        <Globe size={16} color={COLORS.brand[700]} />
        <Text style={styles.label}>{t('language.label')}</Text>
        <Text style={styles.value} numberOfLines={1}>{current}</Text>
        <ChevronRight size={16} color={COLORS.slate[400]} />
      </Pressable>
      <Pressable onPress={() => setTheme(isDark ? 'light' : 'dark')} style={styles.row} accessibilityRole="switch" accessibilityState={{ checked: isDark }}>
        {isDark ? <Moon size={16} color={COLORS.brand[700]} /> : <Sun size={16} color={COLORS.brand[700]} />}
        <Text style={styles.label}>{t('ui.shared.darkMode')}</Text>
        <Switch
          value={isDark}
          onValueChange={(on) => setTheme(on ? 'dark' : 'light')}
          trackColor={{ false: COLORS.slate[300], true: '#2e7d55' }}
          thumbColor="#ffffff"
        />
      </Pressable>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
    </View>
  )
}

const styles = createStyles((c) => ({
  row: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10.5, borderBottomWidth: 1, borderColor: c.borderSoft, paddingVertical: 8 },
  label: { flex: 1, fontSize: 14, fontFamily: 'Inter_700Bold', color: c.text },
  value: { maxWidth: 140, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
}))
