// A centred dialog over a dimmed screen, the native counterpart of the web's
// fixed `role="dialog"` boxes. Tapping outside closes it unless `busy`.
import { View, Text, Pressable, Modal, KeyboardAvoidingView, ScrollView } from 'react-native'
import { createStyles } from '../theme/createStyles'

export default function Dialog({ visible, title, subtitle, onClose, busy = false, children, footer }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && onClose?.()}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable style={styles.pressable} onPress={() => !busy && onClose?.()}>
          <Pressable style={[styles.pressable2, { maxWidth: 440, maxHeight: '88%' }]} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              {title ? (
                <Text style={[styles.text, { fontSize: 17 }]}>{title}</Text>
              ) : null}
              {subtitle ? (
                <Text style={[styles.text2, { fontSize: 13 }]} numberOfLines={1}>{subtitle}</Text>
              ) : null}
              {children}
            </ScrollView>
            {footer ? <View style={[styles.view, { gap: 8 }]}>{footer}</View> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// The three button looks the web dialogs use.
const LOOKS = {
  primary: { box: 'tone', text: 'tone2' },
  secondary: { box: 'tone3', text: 'text3' },
  danger: { box: 'tone4', text: 'tone5' },
}

export function DialogButton({ label, onPress, look = 'primary', disabled = false, style }) {
  const { box, text } = LOOKS[look]
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.pressable3, styles[box], disabled ? styles.pressable4 : null, style]}
    >
      <Text style={[styles.text4, styles[text], { fontSize: 13 }]}>{label}</Text>
    </Pressable>
  )
}

// One "label ............ value" line of a dialog's summary.
export function DialogRow({ label, value, strong = false }) {
  return (
    <View style={[styles.view2, { gap: 12 }]}>
      <Text style={[styles.text5, { fontSize: 13 }]}>{label}</Text>
      <Text style={[styles.text6, strong ? styles.text4 : styles.text7, styles.text3, { fontSize: 13 }]}>{value}</Text>
    </View>
  )
}

const styles = createStyles((c) => ({
  pressable: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', paddingHorizontal: 14 },
  pressable2: { width: '100%', borderRadius: 21, backgroundColor: c.card, padding: 17.5 },
  text: { fontFamily: 'Manrope_800ExtraBold', color: c.text },
  text2: { marginTop: 1.75, fontFamily: 'Inter_600SemiBold', color: c.textMuted },
  view: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end' },
  tone: { backgroundColor: '#1a5038' },
  tone2: { color: '#ffffff' },
  tone3: { borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  text3: { color: c.text },
  tone4: { borderWidth: 1, borderColor: c.redBorder, backgroundColor: c.redSoft },
  tone5: { color: c.redText },
  pressable3: { minHeight: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5, paddingHorizontal: 14, paddingVertical: 7 },
  pressable4: { opacity: 0.5 },
  text4: { fontFamily: 'Inter_700Bold' },
  view2: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.75 },
  text5: { fontFamily: 'Inter_400Regular', color: c.textMuted },
  text6: { flex: 1, textAlign: 'right' },
  text7: { fontFamily: 'Inter_600SemiBold' },
}))
