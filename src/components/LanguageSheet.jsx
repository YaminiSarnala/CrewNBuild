// Language picker — the mobile equivalent of the web navbar's <select>.
// Lists all 7 languages in their own script, exactly as LANGUAGES defines them.
import { Modal, View, Text, Pressable, ScrollView } from 'react-native'
import { Check, X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '../i18n/LanguageContext'
import { SHADOW, COLORS } from '../theme/tokens'
import { createStyles } from '../theme/createStyles'

export default function LanguageSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets()
  const { languages, language, setLanguage, t, rtlReloadNeeded, dismissRtlNotice } = useLanguage()

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.pressable} onPress={onClose} />
      <View
        style={[styles.view, [SHADOW.float, { paddingBottom: insets.bottom + 12 }]]}
      >
        <View style={styles.view2}>
          <Text style={[styles.text, { fontSize: 18, letterSpacing: -0.4 }]}>
            {t('language.label')}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.pressable2}>
            <X size={20} color="#64748b" />
          </Pressable>
        </View>

        {rtlReloadNeeded ? (
          <View style={styles.view3}>
            <Text style={[styles.text2, { fontSize: 12.5, lineHeight: 18 }]}>
              Right-to-left layout applies after you close and reopen the app.
            </Text>
            <Pressable onPress={dismissRtlNotice} style={styles.pressable3}>
              <Text style={[styles.text3, { fontSize: 12 }]}>
                Got it
              </Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView style={[styles.scrollView, { maxHeight: 360 }]}>
          {languages.map((item) => {
            const active = item.code === language
            return (
              <Pressable
                key={item.code}
                onPress={() => {
                  setLanguage(item.code)
                  onClose()
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.pressable4, styles[active ? 'pressable5' : 'active:bg-slate-50']]}
              >
                <Text
                  style={[active ? styles.text4 : styles.text5, { fontSize: 16 }]}
                >
                  {item.name}
                </Text>
                {active ? <Check size={18} color={COLORS.brand[800]} /> : null}
              </Pressable>
            )
          })}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = createStyles((c) => ({
  pressable: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  view: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 21, borderTopRightRadius: 21, backgroundColor: c.card },
  view2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17.5, paddingTop: 17.5, paddingBottom: 7 },
  text: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  pressable2: { padding: 3.5 },
  view3: { marginHorizontal: 17.5, marginBottom: 7, borderRadius: 10.5, backgroundColor: c.brandSoft, paddingHorizontal: 14, paddingVertical: 10.5 },
  text2: { fontFamily: 'Inter_400Regular', color: c.brandTextStrong },
  pressable3: { marginTop: 5.25 },
  text3: { fontFamily: 'Inter_700Bold', color: c.brandText },
  scrollView: { paddingHorizontal: 10.5 },
  pressable4: { marginHorizontal: 7, marginVertical: 3.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12.25 },
  pressable5: { backgroundColor: c.brandSoft },
  text4: { fontFamily: 'Inter_700Bold', color: c.brandTextStrong },
  text5: { fontFamily: 'Inter_500Medium', color: c.text },
}))
