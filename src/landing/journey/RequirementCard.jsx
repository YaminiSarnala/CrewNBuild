// Port of the web journey/RequirementCard.jsx.
// Step 1 — the house owner posts what they want to build.
import { View, Text } from 'react-native'
import { House as Home } from 'lucide-react-native'
import { CardShell, cardTones } from './CardShell'
import { Pill } from './Pill'
import { RoleFace } from '../shared'
import { roleMeta } from '../content'

const ownerFace = roleMeta.find((role) => role.key === 'home').face

export function RequirementCard({ copy, highlighted }) {
  const facts = [copy.area, copy.type, copy.location]
  const tone = cardTones(highlighted)

  return (
    <CardShell icon={Home} label={copy.label} highlighted={highlighted}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <RoleFace source={ownerFace} size={40} />
        <Text className="font-sansBold" style={{ fontSize: 16, color: tone.ink }}>
          {copy.projectName}
        </Text>
      </View>

      <View className="mt-3 flex-row flex-wrap" style={{ gap: 6 }}>
        {facts.map((fact) => (
          <Pill key={fact}>{fact}</Pill>
        ))}
      </View>

      <View
        className="mt-5 flex-row flex-wrap items-center justify-between"
        style={{ gap: 12, borderTopWidth: 1, borderTopColor: 'rgba(217,230,222,0.7)', paddingTop: 16 }}
      >
        <Text className="font-sansMedium" style={{ fontSize: 11.5, color: tone.faint }}>
          {copy.statusLabel}
        </Text>
        <Pill tone="accent" dot>
          {copy.status}
        </Pill>
      </View>

      <Text className="mt-3 font-sans" style={{ fontSize: 11.5, color: tone.faint }}>
        {copy.meta}
      </Text>
    </CardShell>
  )
}
