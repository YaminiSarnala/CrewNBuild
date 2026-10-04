// Temporary tab body until its phase lands. Keeps the app compiling and
// navigable while screens are ported one phase at a time.
import { View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function PlaceholderScreen({ title = 'Coming soon', phase }) {
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 items-center justify-center bg-brand-50 px-8" style={{ paddingTop: insets.top }}>
      <Text className="text-lg font-extrabold text-brand-800">{title}</Text>
      <Text className="mt-2 text-center text-sm text-slate-500">
        This section is being ported from the web app{phase ? ` (Phase ${phase})` : ''}.
      </Text>
    </View>
  )
}