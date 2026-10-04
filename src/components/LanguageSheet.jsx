// Language picker — the mobile equivalent of the web navbar's <select>.
// Lists all 7 languages in their own script, exactly as LANGUAGES defines them.
import { Modal, View, Text, Pressable, ScrollView } from 'react-native'
import { Check, X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '../i18n/LanguageContext'
import { SHADOW } from '../theme/tokens'

export default function LanguageSheet({ visible, onClose }) {
  const insets = useSafeAreaInsets()
  const { languages, language, setLanguage, t, rtlReloadNeeded, dismissRtlNotice } = useLanguage()

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose} />
      <View
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white"
        style={[SHADOW.float, { paddingBottom: insets.bottom + 12 }]}
      >
        <View className="flex-row items-center justify-between px-5 pt-5 pb-2">
          <Text className="font-display text-graphite" style={{ fontSize: 18, letterSpacing: -0.4 }}>
            {t('language.label')}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" className="p-1">
            <X size={20} color="#64748b" />
          </Pressable>
        </View>

        {rtlReloadNeeded ? (
          <View className="mx-5 mb-2 rounded-xl bg-brand-50 px-4 py-3">
            <Text className="font-sans text-brand-800" style={{ fontSize: 12.5, lineHeight: 18 }}>
              Right-to-left layout applies after you close and reopen the app.
            </Text>
            <Pressable onPress={dismissRtlNotice} className="mt-1.5">
              <Text className="font-sansBold text-brand-700" style={{ fontSize: 12 }}>
                Got it
              </Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView className="px-3" style={{ maxHeight: 360 }}>
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
                className={`mx-2 my-1 flex-row items-center justify-between rounded-2xl px-4 py-3.5 ${
                  active ? 'bg-brand-50' : 'active:bg-slate-50'
                }`}
              >
                <Text
                  className={active ? 'font-sansBold text-brand-800' : 'font-sansMedium text-graphite'}
                  style={{ fontSize: 16 }}
                >
                  {item.name}
                </Text>
                {active ? <Check size={18} color="#134127" /> : null}
              </Pressable>
            )
          })}
        </ScrollView>
      </View>
    </Modal>
  )
}
