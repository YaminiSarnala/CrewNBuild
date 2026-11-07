// The Login / Sign-up backdrop, as on the web's landing hero: the Crew&Build
// city-under-construction photo (web public/octabuild/octabuild-mini-city.png)
// under the hero's deep-green scrim, which runs across the screen — dark behind
// the headline on the reading side, fading so the city shows on the far side.
import { I18nManager, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'

// Web HeroSection: linear-gradient(90deg, rgba(6,45,31,.9) 0%, rgba(6,45,31,.82) 38%,
// rgba(6,45,31,.55) 60%, rgba(6,45,31,.2) 80%, rgba(6,45,31,.12) 100%) — 270deg in Arabic.
const SCRIM = ['rgba(6,45,31,0.9)', 'rgba(6,45,31,0.82)', 'rgba(6,45,31,0.55)', 'rgba(6,45,31,0.2)', 'rgba(6,45,31,0.12)']
const STOPS = [0, 0.38, 0.6, 0.8, 1]
export const AUTH_BACKGROUND = '#062d1f'

export default function AuthBackground() {
  // The dark side follows the text: left to right, or right to left in RTL.
  const rtl = I18nManager.isRTL
  return (
    <>
      <Image
        source={require('../../assets/auth-city.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
      />
      <LinearGradient
        colors={SCRIM}
        locations={STOPS}
        start={{ x: rtl ? 1 : 0, y: 0 }}
        end={{ x: rtl ? 0 : 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  )
}
