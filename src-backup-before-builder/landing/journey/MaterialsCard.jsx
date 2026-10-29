// Port of the web journey/MaterialsCard.jsx.
// Step 4 — materials and stock stay attached to the same project.
import { View, Text, Pressable } from 'react-native'
import { Boxes } from 'lucide-react-native'
import { CardShell, cardTones } from './CardShell'
import { Pill } from './Pill'
import { ProgressBar } from './ProgressBar'
import { OC } from '../shared'
import { sampleProject } from '../journeyData'

export function MaterialsCard({ copy, highlighted }) {
  const tone = cardTones(highlighted)

  return (
    <CardShell icon={Boxes} label={copy.label} highlighted={highlighted}>
      <View className="flex-row flex-wrap items-baseline justify-between" style={{ gap: 8 }}>
        <Text className="font-sansBold" style={{ fontSize: 16, color: tone.ink }}>
          {copy.title}
        </Text>
        <Text className="font-sans" style={{ fontSize: 11.5, color: tone.faint }}>
          {copy.subtitle}
        </Text>
      </View>

      <View className="mt-4" style={{ gap: 16 }}>
        {sampleProject.materials.map((material) => {
          const item = copy.items[material.key]
          const low = material.status === 'low'

          return (
            <View key={material.key}>
              <View className="flex-row flex-wrap items-center justify-between" style={{ gap: 8 }}>
                <Text className="font-sansSemi" style={{ fontSize: 14, color: tone.ink }}>
                  {item.name}
                </Text>
                <Text className="font-sansMedium" style={{ fontSize: 14, color: tone.muted }}>
                  {item.quantity}
                </Text>
              </View>

              <ProgressBar
                value={material.level}
                tone={low ? 'accent' : 'brand'}
                label={item.name}
                style={{ marginTop: 8 }}
              />

              <View className="mt-2 flex-row items-center justify-between" style={{ gap: 8 }}>
                <Pill tone={low ? 'accent' : 'brand'} dot>
                  {low ? copy.lowStock : copy.inStock}
                </Pill>
                {low ? (
                  <Pressable
                    accessibilityRole="button"
                    className="rounded-lg active:opacity-70"
                    style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    <Text className="font-sansSemi" style={{ fontSize: 11.5, color: OC.green }}>
                      {copy.reorder}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>
    </CardShell>
  )
}
