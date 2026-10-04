// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/FinalCallToAction.jsx.
//
// Reproduced: the rounded deep-green panel with its faint grid, the amber dot
// cluster, the label, two-tone headline and body, the cream call to action, the
// framed builder character on its mint gradient, and the tilted speech chip.
// ---------------------------------------------------------------------------
import { View, Text, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowRight } from 'lucide-react-native'
import { roleMeta } from './content'
import { CreamButton, GUTTER, OC, Reveal, RoleCharacter, SectionLabel } from './shared'

export function FinalCallToAction({ text, onStart }) {
  const { width } = useWindowDimensions()
  // Web: text-[3.4rem] at the narrow breakpoint.
  const headlineSize = Math.min(width * 0.13, 54)

  return (
    <View style={{ backgroundColor: OC.paper, paddingTop: 0, paddingBottom: 55, paddingHorizontal: 18 }}>
      <View
        className="overflow-hidden"
        style={{
          minHeight: 520,
          borderRadius: 16,
          backgroundColor: OC.deep,
          paddingHorizontal: 27,
          paddingVertical: 58,
        }}
      >
        {/* Amber dot cluster — web draws it with stacked box-shadows. */}
        <View pointerEvents="none" style={{ position: 'absolute', right: '31%', top: '24%' }}>
          <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: OC.amber }} />
          <View
            style={{
              position: 'absolute',
              left: 70,
              top: 110,
              width: 11,
              height: 11,
              borderRadius: 5.5,
              backgroundColor: OC.amber,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: -95,
              top: 220,
              width: 9,
              height: 9,
              borderRadius: 4.5,
              backgroundColor: 'rgba(244,183,64,0.8)',
            }}
          />
        </View>

        <View style={{ zIndex: 2 }}>
          <Reveal>
            <SectionLabel tone="light">{text.final.label}</SectionLabel>
          </Reveal>

          <Reveal delay={70}>
            <Text
              className="mt-5 font-display text-white"
              style={{ fontSize: headlineSize, lineHeight: headlineSize * 0.98, letterSpacing: -2.6 }}
            >
              {text.final.headline}
              {'\n'}
              <Text style={{ color: '#a9d6bc' }}>{text.final.highlight}</Text>
            </Text>
          </Reveal>

          <Reveal delay={140}>
            <Text
              className="mt-6 font-sans"
              style={{ fontSize: 13.5, lineHeight: 23, color: '#b9d8c5', maxWidth: 330 }}
            >
              {text.final.body}
            </Text>
          </Reveal>

          <Reveal delay={200}>
            <View className="mt-8">
              <CreamButton
                label={text.nav.start}
                onPress={onStart}
                icon={<ArrowRight size={17} color={OC.green} />}
              />
            </View>
          </Reveal>
        </View>

        {/* Framed builder character */}
        <View
          style={{ position: 'absolute', right: '6%', bottom: -7, width: 185, height: 250 }}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['#eaf5ee', '#b9d8c5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 185,
              height: 250,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              borderBottomLeftRadius: 14,
              borderBottomRightRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              overflow: 'hidden',
              justifyContent: 'flex-end',
            }}
          >
            <RoleCharacter role={roleMeta[1]} height={244} animate={false} />
          </LinearGradient>

          {/* Speech chip */}
          <View
            style={{
              position: 'absolute',
              right: -21,
              top: 4,
              paddingHorizontal: 14,
              paddingVertical: 11,
              borderRadius: 10,
              backgroundColor: '#ffffff',
              transform: [{ rotate: '4deg' }],
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <Text className="font-sansBold" style={{ fontSize: 8, color: OC.green }}>
              {text.final.speech}
            </Text>
            <Text style={{ fontSize: 13, color: OC.amber }}>↗</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
