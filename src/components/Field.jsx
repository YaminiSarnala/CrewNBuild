// Shared form primitives matching the web's auth input styling.
import { View, Text, TextInput, Pressable } from 'react-native'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react-native'

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
    <View className="mb-4">
      {label ? (
        <Text className="mb-1.5 font-sansSemi text-slate-600" style={{ fontSize: 13 }}>
          {label}
        </Text>
      ) : null}
      <View className="relative">
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
          className={`rounded-2xl border bg-white px-4 font-sans text-graphite ${
            error ? 'border-warm' : 'border-slate-200'
          }`}
          style={{
            fontSize: 15,
            paddingVertical: multiline ? 14 : 15,
            minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
            paddingRight: secure ? 46 : 16,
          }}
          {...rest}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            className="absolute right-3 top-0 bottom-0 justify-center px-1"
          >
            {hidden ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="mt-1.5 font-sans text-warm" style={{ fontSize: 12 }}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <View className="mb-4 rounded-2xl border border-warm/30 bg-warm/10 px-4 py-3">
      <Text className="font-sansMedium text-warm" style={{ fontSize: 13, lineHeight: 19 }}>
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
      className={`mb-3 flex-row items-center rounded-2xl border p-4 ${
        selected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white active:bg-slate-50'
      }`}
      style={{ gap: 12 }}
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-xl ${selected ? 'bg-brand-800' : 'bg-slate-100'}`}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text className={`font-sansBold ${selected ? 'text-brand-800' : 'text-graphite'}`} style={{ fontSize: 15 }}>
          {label}
        </Text>
        <Text className="mt-0.5 font-sans text-slate-500" style={{ fontSize: 12.5 }}>
          {description}
        </Text>
      </View>
      <View
        className={`h-5 w-5 rounded-full border-2 ${
          selected ? 'border-brand-700 bg-brand-700' : 'border-slate-300'
        }`}
      />
    </Pressable>
  )
}
