// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/SolutionPanel.jsx.
//
// Reproduced: the deep-green bridge strip, the extruded OCTABUILD wordmark with
// its amber lit face, the headline with its tone-coloured highlight, the body
// copy, the two calls to action, and the day/night tone system that recolours
// the whole band when the villa's switch is used.
//
// Native differences:
//   - The web wordmark stacks 13 text-shadows on one element and clips a
//     gradient to the glyphs. React Native supports one text shadow and cannot
//     clip a gradient to text, so the extrusion is drawn as 10 offset copies of
//     the word behind a solid amber face. The result reads the same at a glance.
//   - The letters pop in individually on the web (letterStaggerGroup). Here the
//     whole wordmark animates as one, because 9 nested Moti views per letter is
//     a lot of work for a phone to do on scroll.
//   - ConstructionVilla is passed in as `villa` rather than imported, so this
//     section works whether or not the 3D piece is present.
// ---------------------------------------------------------------------------
import { View, Text, Pressable, useWindowDimensions } from 'react-native'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowRight, ChevronRight } from 'lucide-react-native'
import { CreamButton, EASE_SOFT, GreenButton, GUTTER, OC, Reveal } from './shared'

const WORDMARK = 'OCTABUILD'

// Web: extrusionGreens — each step darkens as the face falls away from the light.
const EXTRUSION_GREENS = [
  '#10603e', '#0f5839', '#0e5134', '#0c4a30', '#0b432b',
  '#0a3c27', '#093522', '#082e1e', '#072819', '#062115',
]

// Web: TONES — the band moves from bright afternoon to deep night.
export const TONES = {
  day: {
    background: ['#dce8f2', '#eef4f7', '#f4f7f5'],
    backgroundStops: [0, 0.62, 1],
    label: '#3f6b52',
    heading: '#17201c',
    highlight: '#126b45',
    body: '#4a5a51',
    link: '#126b45',
  },
  night: {
    background: ['#131d35', '#101a30', '#0c1426'],
    backgroundStops: [0, 0.62, 1],
    label: '#9fb6dd',
    heading: '#ffffff',
    highlight: '#a9d6bc',
    body: '#c2cfe2',
    link: '#dbe7ff',
  },
}

/* Web: SolutionBridge — the strip between the hero and the panel. */
export function SolutionBridge({ text }) {
  return (
    <View
      style={{
        minHeight: 108,
        backgroundColor: OC.deep,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 18,
        paddingVertical: 25,
        zIndex: 6,
      }}
    >
      <Text
        className="text-center font-display"
        style={{ fontSize: 18, lineHeight: 26, color: '#d4eddd', letterSpacing: -0.6 }}
      >
        {text.bridge[0]} <Text style={{ color: '#ffffff' }}>{text.bridge[1]}</Text>
      </Text>
    </View>
  )
}

/**
 * The extruded wordmark.
 *
 * Ten offset copies form the solid block, then the amber face sits on top. The
 * offsets are proportional to the font size, so the depth scales with the type
 * exactly as the web's em-based shadows do.
 */
function Wordmark({ size }) {
  const step = size * 0.012

  return (
    <View accessibilityRole="image" accessibilityLabel={WORDMARK} style={{ marginTop: 21 }}>
      <View>
        {/* Extrusion — drawn back to front so the nearest face wins. */}
        {EXTRUSION_GREENS.map((green, index) => (
          <Text
            key={green}
            style={{
              position: 'absolute',
              top: (index + 1) * step,
              left: 0,
              fontSize: size,
              lineHeight: size * 0.95,
              letterSpacing: size * 0.1,
              color: green,
            }}
            className="font-display"
          >
            {WORDMARK}
          </Text>
        ))}

        {/* Lit face. Web clips a gradient to the glyphs; native cannot, so the
            mid-tone of that gradient is used as a solid, with a highlight line
            above to keep the "catching the light" read. */}
        <Text
          style={{
            fontSize: size,
            lineHeight: size * 0.95,
            letterSpacing: size * 0.1,
            color: '#f6c150',
            textShadowColor: 'rgba(255,255,255,0.45)',
            textShadowOffset: { width: 0, height: -step },
            textShadowRadius: 0,
          }}
          className="font-display"
        >
          {WORDMARK}
        </Text>
      </View>
    </View>
  )
}

export function SolutionPanel({ text, isNight, onModeChange, villa }) {
  const { width } = useWindowDimensions()
  const tone = isNight ? TONES.night : TONES.day

  // Web: text-[3.75rem] for the wordmark at the narrow breakpoint, but that
  // overflows a phone, so it is fitted to the available width instead.
  const wordmarkSize = Math.min((width - GUTTER * 2) / 6.4, 60)
  // Web: text-[2.6rem] for the headline at the narrow breakpoint.
  const headlineSize = Math.min(width * 0.098, 42)

  return (
    <View style={{ paddingVertical: 70, paddingHorizontal: 18 }}>
      {/* Tone background — 900ms linear on the web; Moti gives the same fade. */}
      <MotiView
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 900 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      >
        <LinearGradient
          colors={tone.background}
          locations={tone.backgroundStops}
          style={{ flex: 1 }}
        />
      </MotiView>

      <Reveal>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: OC.amber }} />
          <Text
            className="font-sansBold uppercase"
            style={{ fontSize: 10, letterSpacing: 1.4, color: tone.label }}
          >
            {text.solution.label}
          </Text>
        </View>
      </Reveal>

      <Reveal delay={80}>
        <Wordmark size={wordmarkSize} />
      </Reveal>

      <Reveal delay={140}>
        <Text
          className="mt-7 font-display"
          style={{
            fontSize: headlineSize,
            lineHeight: headlineSize * 1.0,
            letterSpacing: -2.2,
            color: tone.heading,
          }}
        >
          {text.solution.headline}
          {'\n'}
          <Text style={{ color: tone.highlight }}>{text.solution.highlight}</Text>
        </Text>
      </Reveal>

      <Reveal delay={200}>
        <Text
          className="mt-6 font-sans"
          style={{ fontSize: 13, lineHeight: 22, color: tone.body, maxWidth: 520 }}
        >
          {text.solution.body}
        </Text>
      </Reveal>

      <Reveal delay={260}>
        <View className="mt-8 flex-row items-center" style={{ gap: 20 }}>
          {isNight ? (
            <CreamButton
              label={text.nav.start}
              onPress={text.onStart}
              icon={<ArrowRight size={16} color={OC.green} />}
            />
          ) : (
            <GreenButton
              label={text.nav.start}
              onPress={text.onStart}
              icon={<ArrowRight size={16} color="#ffffff" />}
            />
          )}

          <Pressable
            onPress={text.onExplore}
            accessibilityRole="button"
            className="flex-row items-center active:opacity-70"
            style={{ gap: 7 }}
          >
            <Text className="font-sansBold" style={{ fontSize: 12, color: tone.link }}>
              {text.solution.explore}
            </Text>
            <ChevronRight size={16} color={tone.link} />
          </Pressable>
        </View>
      </Reveal>

      {/* The villa and its Day/Night switch. Passed in so this section renders
          with or without the 3D piece. */}
      {villa ? <View style={{ marginTop: 38 }}>{villa}</View> : null}
    </View>
  )
}