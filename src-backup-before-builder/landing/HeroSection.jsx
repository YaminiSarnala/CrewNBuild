// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/HeroSection.jsx.
//
// Reproduced: the city photo with its readability scrim, the amber and green
// blooms, the kicker row, the role eyebrow chip, the two-line question headline
// with its pale-green second line, the helper copy, the 1-5 role dots, the
// framed character with contact shadow, the two dashed rings, the scene badges
// and the two footer checks.
//
// Native differences:
//   - The web scrim is a horizontal gradient because the copy sits beside the
//     artwork on a desktop. On a phone the copy sits above it, so the scrim runs
//     top-to-bottom — which is what the web itself does at its narrow breakpoint.
//   - min-h-svh -> a measured window height.
//   - Keyboard arrow navigation is dropped (no hardware keys); the on-screen
//     arrows and the numbered dots both remain.
//   - HeroBackdrop wraps the hero, bridge and solution panel in one background
//     box, exactly as on the web.
// ---------------------------------------------------------------------------
import { View, Text, Pressable, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native'
import { roleMeta, LANDING_ART } from './content'
import { DashedRing, EASE_SOFT, GUTTER, OC, RoleCharacter } from './shared'
import { HEADER_HEIGHT } from './SiteHeader'

/**
 * The photo and its scrim span the hero, the bridge and the solution panel, so
 * the whole block shares one background box — same as the web.
 */
export function HeroBackdrop({ children, minHeight }) {
  return (
    <View style={{ minHeight, backgroundColor: OC.deep, overflow: 'hidden' }}>
      <Image
        source={LANDING_ART.city}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        contentFit="cover"
        contentPosition="top center"
        transition={300}
      />

      {/* Web scrim stops, applied vertically for the phone layout. */}
      <LinearGradient
        colors={[
          'rgba(6,45,31,0.90)',
          'rgba(6,45,31,0.82)',
          'rgba(6,45,31,0.55)',
          'rgba(6,45,31,0.20)',
          'rgba(6,45,31,0.12)',
        ]}
        locations={[0, 0.38, 0.6, 0.8, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      />

      {/* Amber bloom, top right */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: '6%',
          top: '8%',
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: 'rgba(244,183,64,0.14)',
          opacity: 0.4,
        }}
      />
      {/* Green bloom, bottom left */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: '4%',
          bottom: '10%',
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(18,107,69,0.08)',
          opacity: 0.4,
        }}
      />

      {children}
    </View>
  )
}

function SlideArrow({ icon: Icon, label, onPress, side }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={{
        position: 'absolute',
        top: '46%',
        [side]: 2,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={30} color="rgba(255,255,255,0.85)" />
    </Pressable>
  )
}

function SceneBadge({ children, style }) {
  return (
    <View
      className="absolute flex-row items-center rounded-lg"
      style={[
        {
          gap: 8,
          paddingHorizontal: 13,
          paddingVertical: 10,
          backgroundColor: 'rgba(6,45,31,0.64)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.35)',
        },
        style,
      ]}
      pointerEvents="none"
    >
      <Text className="font-sansBold text-white" style={{ fontSize: 10 }}>
        {children}
      </Text>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: OC.amber }} />
    </View>
  )
}

export function HeroContent({ text, activeIndex, onSelect }) {
  const { height: windowHeight, width } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const role = text.roles[activeIndex]
  const meta = roleMeta[activeIndex]
  const RoleIcon = meta.icon

  const showPreviousRole = () => onSelect((activeIndex + roleMeta.length - 1) % roleMeta.length)
  const showNextRole = () => onSelect((activeIndex + 1) % roleMeta.length)

  // Web: text-[clamp(1.6rem,min(7.4vw,5.4vh),3rem)] at the narrow breakpoint.
  const titleSize = Math.min(Math.max(width * 0.074, 25.6), 34)
  const isWide = width >= 500
  const frameWidth = isWide ? 200 : 170
  const frameHeight = isWide ? 286 : 242

  return (
    <View
      style={{
        minHeight: windowHeight * 0.92,
        paddingTop: insets.top + HEADER_HEIGHT + 30,
        paddingBottom: 30,
        paddingHorizontal: GUTTER,
      }}
    >
      {/* ---------------------------- Copy ---------------------------- */}
      <View style={{ zIndex: 5 }}>
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: OC.amber }} />
          <Text
            className="font-sansBold uppercase"
            style={{ fontSize: 10, letterSpacing: 1.4, color: '#f0f8f2' }}
          >
            {text.heroKicker}
          </Text>
        </View>

        {/* Re-mounts on role or language change so the entrance replays. */}
        <MotiView
          key={`${text.direction}-${activeIndex}`}
          from={{ opacity: 0, translateY: 18 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 450, easing: EASE_SOFT }}
        >
          <View
            className="mt-6 flex-row items-center self-start rounded-full"
            style={{
              gap: 9,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.3)',
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: OC.amber,
              }}
            >
              <RoleIcon size={15} color={OC.deep} />
            </View>
            <Text className="font-sansBold text-white" style={{ fontSize: 11 }}>
              {role.eyebrow}
            </Text>
          </View>

          <Text
            className="mt-5 font-display text-white"
            style={{ fontSize: titleSize, lineHeight: titleSize * 1.15, letterSpacing: -1.6 }}
          >
            {role.questions[0]}
            {'\n'}
            <Text style={{ color: '#b9efc9' }}>{role.questions[1]}</Text>
          </Text>

          <Text
            className="mt-5 font-sans"
            style={{ fontSize: 12.5, lineHeight: 18, color: '#e3f2e7', maxWidth: 310 }}
          >
            {text.heroHelper}
          </Text>
        </MotiView>

        {/* Numbered role dots — five roles in this design. */}
        <View className="mt-6 flex-row" style={{ gap: 7 }}>
          {roleMeta.map((entry, index) => {
            const active = activeIndex === index
            return (
              <Pressable
                key={entry.key}
                onPress={() => onSelect(index)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  backgroundColor: active ? OC.amber : 'transparent',
                  borderColor: active ? OC.amber : 'rgba(255,255,255,0.45)',
                  transform: [{ translateY: active ? -3 : 0 }],
                }}
              >
                <Text
                  className="font-sansBold"
                  style={{ fontSize: 10, color: active ? OC.deep : '#ffffff' }}
                >
                  {index + 1}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* ------------------------ Character scene ------------------------ */}
      <View style={{ position: 'absolute', right: '10%', bottom: 70 }} pointerEvents="none">
        <DashedRing size={76} style={{ right: 118, top: -24 }} duration={2800} />
        <DashedRing size={95} style={{ right: -22, bottom: 8 }} duration={3400} />

        <MotiView
          key={activeIndex}
          from={{ opacity: 0, translateY: 20, scale: 0.86, rotate: '-5deg' }}
          animate={{ opacity: 1, translateY: 0, scale: 1, rotate: '0deg' }}
          transition={{ type: 'timing', duration: 550, easing: EASE_SOFT }}
        >
          {/* Arch frame — web: rounded-t-[110px] rounded-b-[20px] glass panel */}
          <View
            style={{
              width: frameWidth,
              height: frameHeight,
              borderTopLeftRadius: frameWidth / 2,
              borderTopRightRadius: frameWidth / 2,
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.5)',
              overflow: 'hidden',
              justifyContent: 'flex-end',
            }}
          >
            <RoleCharacter role={meta} height={frameHeight - 6} />
          </View>
          {/* Contact shadow */}
          <View
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              bottom: -8,
              height: 22,
              borderRadius: 11,
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          />
        </MotiView>
      </View>

      {/* Scene badges — web hides these below its wide breakpoint. */}
      {isWide ? (
        <>
          <SceneBadge style={{ left: '42%', top: '30%' }}>{role.eyebrow}</SceneBadge>
          <SceneBadge style={{ right: '8%', top: '22%' }}>{text.sceneBadge}</SceneBadge>
        </>
      ) : null}

      {/* Slide arrows */}
      <SlideArrow icon={ChevronLeft} label={text.prevRole} onPress={showPreviousRole} side="left" />
      <SlideArrow icon={ChevronRight} label={text.nextRole} onPress={showNextRole} side="right" />

      {/* Footer checks */}
      <View
        className="absolute flex-row justify-between"
        style={{ left: 18, right: 18, bottom: 16 }}
        pointerEvents="none"
      >
        {[text.sceneFooter[0], text.sceneFooter[1]].map((label) => (
          <View key={label} className="flex-row items-center" style={{ gap: 6 }}>
            <Check size={12} color="#e4f2e8" />
            <Text className="font-sansBold" style={{ fontSize: 8.5, color: '#e4f2e8' }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}