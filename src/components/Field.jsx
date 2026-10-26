// Shared form primitives matching the web's auth input styling.
import { View, Text, TextInput, Pressable } from 'react-native'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react-native'
import { createStyles } from '../theme/createStyles'

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  error,
  multiline = false,
  ...rest
}) {
  const [hidden, setHidden] = useState(secure)
  return (
    <View style={styles.view}>
      {label ? (
        <Text style={[styles.text, { fontSize: 13 }]}>
          {label}
        </Text>
      ) : null}
      <View style={styles.view2}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          style={[styles.textInput, error ? styles.textInput2 : styles.textInput3, {
            fontSize: 15,
            paddingVertical: multiline ? 14 : 15,
            minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
            paddingRight: secure ? 46 : 16,
          }]}
          {...rest}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={styles.pressable}
          >
            {hidden ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.text2, { fontSize: 12 }]}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <View style={styles.view3}>
      <Text style={[styles.text3, { fontSize: 13, lineHeight: 19 }]}>
        {message}
      </Text>
    </View>
  )
}

export function RoleCard({ label, description, selected, onPress, icon }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.pressable2, selected ? styles.pressable3 : styles.pressable4, { gap: 12 }]}
    >
      <View
        style={[styles.view4, selected ? styles.view5 : styles.view6]}
      >
        {icon}
      </View>
      <View style={styles.view7}>
        <Text style={[styles.text4, selected ? styles.text5 : styles.text6, { fontSize: 15 }]}>
          {label}
        </Text>
        <Text style={[styles.text7, { fontSize: 12.5 }]}>
          {description}
        </Text>
      </View>
      <View
        style={[styles.view8, selected ? styles.view9 : styles.view10]}
      />
    </Pressable>
  )
}

const styles = createStyles((c) => ({
  view: { marginBottom: 14 },
  text: { marginBottom: 5.25, fontFamily: 'Inter_600SemiBold', color: c.textSecondary },
  view2: { position: 'relative' },
  textInput: { borderRadius: 14, borderWidth: 1, backgroundColor: c.card, paddingHorizontal: 14, fontFamily: 'Inter_400Regular', color: c.text },
  textInput2: { borderColor: '#dc2626' },
  textInput3: { borderColor: c.border },
  pressable: { position: 'absolute', right: 10.5, top: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 3.5 },
  text2: { marginTop: 5.25, fontFamily: 'Inter_400Regular', color: '#dc2626' },
  view3: { marginBottom: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(220, 38, 38, 0.3)', backgroundColor: 'rgba(220, 38, 38, 0.1)', paddingHorizontal: 14, paddingVertical: 10.5 },
  text3: { fontFamily: 'Inter_500Medium', color: '#dc2626' },
  pressable2: { marginBottom: 10.5, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 14 },
  pressable3: { borderColor: '#236645', backgroundColor: c.brandSoft },
  pressable4: { borderColor: c.border, backgroundColor: c.card },
  view4: { height: 35, width: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 10.5 },
  view5: { backgroundColor: '#134127' },
  view6: { backgroundColor: c.muted },
  view7: { flex: 1 },
  text4: { fontFamily: 'Inter_700Bold' },
  text5: { color: c.brandTextStrong },
  text6: { color: c.text },
  text7: { marginTop: 1.75, fontFamily: 'Inter_400Regular', color: c.textMuted },
  view8: { height: 17.5, width: 17.5, borderRadius: 9999, borderWidth: 2 },
  view9: { borderColor: '#1a5038', backgroundColor: '#1a5038' },
  view10: { borderColor: c.borderStrong },
}))
