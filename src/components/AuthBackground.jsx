// The Login / Sign-up backdrop, as on the web's AuthShell panel: the Crew&Build
// city-under-construction photo (web public/octabuild/octabuild-mini-city.png)
// under the same deep-green scrim, so the white headline and the form card
// read clearly over it.
import { StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'

// Web: linear-gradient(180deg, rgba(6,45,31,.72) 0%, rgba(6,45,31,.55) 45%, rgba(6,45,31,.8) 100%)
const SCRIM = ['rgba(6,45,31,0.72)', 'rgba(6,45,31,0.55)', 'rgba(6,45,31,0.8)']
export const AUTH_BACKGROUND = '#062d1f'

export default function AuthBackground() {
  return (
    <>
      <Image
        source={require('../../assets/auth-city.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition="center"
      />
      <LinearGradient colors={SCRIM} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
    </>
  )
}
