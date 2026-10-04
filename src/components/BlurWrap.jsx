// Small helper so the navbar reads as frosted glass without pulling in
// expo-blur (which needs a config plugin). A high-opacity surface plus a
// hairline border gives the same visual weight as the web's backdrop-blur.
import { View } from 'react-native'

export function BlurWrap({ children }) {
  return (
    <View className="border-b border-slate-200/70 bg-paper/95">
      {children}
    </View>
  )
}
