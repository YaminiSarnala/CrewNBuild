// Port of the web journey/BuilderCard.jsx.
// Step 2 — a nearby builder responds with a price.
import { View, Text, Pressable } from 'react-native'
import { ArrowRight, BadgeCheck, Building2, MapPin } from 'lucide-react-native'
import { CardShell, cardTones } from './CardShell'
import { Pill } from './Pill'
import { OC, RoleFace } from '../shared'
import { roleMeta } from '../content'

const builderFace = roleMeta.find((role) => role.key === 'builder').face

export function BuilderCard({ copy, highlighted }) {
  const tone = cardTones(highlighted)

  return (
    <CardShell icon={Building2} label={copy.label} highlighted={highlighted}>
      <Text className="font-sansBold" style={{ fontSize: 16, color: tone.ink }}>
        {copy.title}
      </Text>

      <View className="mt-4 flex-row items-center" style={{ gap: 12 }}>
        <RoleFace source={builderFace} size={40} />
        <View style={{ flex: 1 }}>
          <Text className="font-sansBold" style={{ fontSize: 14, color: tone.ink }} numberOfLines={1}>
            {copy.company}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center" style={{ gap: 6 }}>
            <Pill icon={MapPin}>{copy.distance}</Pill>
            <Pill tone="brand" icon={BadgeCheck}>
              {copy.verified}
            </Pill>
          </View>
        </View>
      </View>

      <View
        className="mt-5"
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#d5ebe0',
          backgroundColor: 'rgba(236,246,241,0.6)',
          padding: 16,
        }}
      >
        <Text className="font-sansSemi" style={{ fontSize: 11.5, color: '#0e5537' }}>
          {copy.quotationLabel}
        </Text>
        <Text className="mt-1 font-display" style={{ fontSize: 24, letterSpacing: -0.6, color: tone.ink }}>
          {copy.amount}
        </Text>
        <Text className="mt-1 font-sans" style={{ fontSize: 11.5, color: tone.muted }}>
          {copy.duration}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        className="mt-4 w-full flex-row items-center justify-center active:opacity-80"
        style={{
          gap: 8,
          minHeight: 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: OC.line,
          backgroundColor: '#ffffff',
        }}
      >
        <Text className="font-sansSemi" style={{ fontSize: 15, color: OC.ink }}>
          {copy.cta}
        </Text>
        <ArrowRight size={16} color={OC.ink} strokeWidth={2.25} />
      </Pressable>
    </CardShell>
  )
}

