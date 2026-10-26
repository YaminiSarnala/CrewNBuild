import { useCallback } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Provider } from 'react-redux'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter'

import { store } from './src/store'
import { ThemeProvider } from './src/theme/ThemeContext'
import { LanguageProvider } from './src/i18n/LanguageContext'
import RootNavigator from './src/navigation/RootNavigator'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function App() {
  // Same two families the web app loads from Google Fonts: Manrope + Inter.
  const [fontsLoaded, fontError] = useFonts({
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  })

  const onLayout = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <Provider store={store}>
        <ThemeProvider>
          <LanguageProvider>
            <SafeAreaProvider>
              {/* Every screen has the green header behind the status bar, so its icons stay light. */}
              <StatusBar style="light" />
              <RootNavigator />
            </SafeAreaProvider>
          </LanguageProvider>
        </ThemeProvider>
      </Provider>
    </GestureHandlerRootView>
  )
}
