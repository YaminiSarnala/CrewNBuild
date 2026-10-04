// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/WorldSection.jsx.
//
// Reproduced: the full amber band with its dark top hairline, the label,
// two-tone headline and body, the four bullet points, the two tilted orbit
// rings, the 3D hub artwork, the three floating white note chips and the
// equipment miniatures anchored to the bottom left.
//
// Native difference: the web lays copy and artwork side by side. A phone stacks
// them, which is what the web itself does at its narrow breakpoint.
// ---------------------------------------------------------------------------
import { View, Text, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { LANDING_ART } from './content'
import { GUTTER, OC, Reveal, SectionLabel } from './shared'

function Note({ label, dotColor, style }) {
  return (
    <View
      className="absolute flex-row items-center rounded-lg"
      style={[
        {
          gap: 7,
          paddingHorizontal: 9,
          paddingVertical: 7,
          backgroundColor: '#ffffff',
          borderWidth: 1,
          borderColor: OC.line,
          shadowColor: '#126b45',
          shadowOffset: { width: 0, height: 11 },
          shadowOpacity: 0.08,
          shadowRadius: 11,
          elevation: 3,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: dotColor }} />
      <Text className="font-sansBold" style={{ fontSize: 8, color: OC.ink }}>
        {label}
      </Text>
    </View>
  )
}

export function WorldSection({ text }) {
  const { width } = useWindowDimensions()
  // Web: text-[clamp(3.3rem,5vw,5.5rem)] — fitted to phone width here.
  const headlineSize = Math.min(width * 0.125, 53)

  return (
    <View
      style={{
        backgroundColor: OC.amber,
        paddingTop: 84,
        paddingBottom: 90,
        paddingHorizontal: GUTTER,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(8,62,43,0.45)',
        }}
      />

      <Reveal>
        <SectionLabel tone="onAmber">{text.world.label}</SectionLabel>
      </Reveal>

      <Reveal delay={70}>
        <Text
          className="mt-5 font-display"
          style={{
            fontSize: headlineSize,
            lineHeight: headlineSize * 0.98,
            letterSpacing: -2.6,
            color: OC.ink,
          }}
        >
          {text.world.headline}
          {'\n'}
          <Text style={{ color: OC.green }}>{text.world.highlight}</Text>
        </Text>
      </Reveal>

      <Reveal delay={140}>
        <Text
          className="mt-7 font-sans"
          style={{ fontSize: 13.5, lineHeight: 23, color: 'rgba(8,62,43,0.8)' }}
        >
          {text.world.body}
        </Text>
      </Reveal>

      <Reveal delay={200}>
        <View className="mt-8" style={{ gap: 14 }}>
          {text.world.points.map((point) => (
            <View key={point} className="flex-row items-center" style={{ gap: 9 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: OC.green }} />
              <Text className="font-sansBold" style={{ fontSize: 11, color: OC.deep }}>
                {point}
              </Text>
            </View>
          ))}
        </View>
      </Reveal>

      {/* ------------------------- Orbit artwork ------------------------- */}
      <View className="mt-9 items-center justify-center" style={{ height: 350 }}>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 280,
            height: 140,
            borderRadius: 140,
            borderWidth: 1,
            borderColor: 'rgba(18,107,69,0.24)',
            transform: [{ rotate: '-18deg' }],
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 325,
            height: 200,
            borderRadius: 162,
            borderWidth: 1,
            borderColor: 'rgba(18,107,69,0.24)',
            transform: [{ rotate: '32deg' }],
          }}
        />

        <Image
          source={LANDING_ART.hub}
          style={{ width: 105, height: 105, zIndex: 2 }}
          contentFit="contain"
        />

        <Note label={text.world.notes[0]} dotColor={OC.green} style={{ left: 0, top: '21%' }} />
        <Note label={text.world.notes[1]} dotColor={OC.amber} style={{ right: 0, top: '17%' }} />
        <Note label={text.world.notes[2]} dotColor={OC.green} style={{ right: 0, bottom: '17%' }} />

        <Image
          source={LANDING_ART.equipment}
          style={{ position: 'absolute', width: 200, height: 112, left: -6, bottom: -14 }}
          contentFit="contain"
        />
      </View>
    </View>
  )
}
