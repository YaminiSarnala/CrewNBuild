// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/PlatformSection.jsx.
//
// Shows the product instead of describing it: four cards, in the order a project
// actually moves through them, joined by a chevron rail.
//
// Native difference: the web pins the narration on one side while the cards
// scroll past on the other, and highlights whichever card you point at or have
// scrolled to. A phone has no pointer and stacks the column already — the web
// itself drops the tracker at that breakpoint — so the cards are tapped to
// highlight instead, with the first one highlighted on arrival.
// ---------------------------------------------------------------------------
import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { journeyCards } from './journeyData'
import { RequirementCard } from './journey/RequirementCard'
import { BuilderCard } from './journey/BuilderCard'
import { ProjectCard } from './journey/ProjectCard'
import { MaterialsCard } from './journey/MaterialsCard'
import { GUTTER, OC, Reveal, SectionLabel } from './shared'

const CARDS_BY_STEP = {
  requirement: RequirementCard,
  builder: BuilderCard,
  project: ProjectCard,
  materials: MaterialsCard,
}

export function PlatformSection({ text }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const copy = text.journey

  return (
    <View style={{ backgroundColor: OC.sunken, paddingVertical: 72, paddingHorizontal: GUTTER }}>
      <Reveal>
        <SectionLabel>{copy.eyebrow}</SectionLabel>
        <Text
          className="mt-3 font-display"
          style={{ fontSize: 27, lineHeight: 33, letterSpacing: -1, color: OC.ink }}
        >
          {copy.titleLine1}
          {'\n'}
          <Text style={{ color: OC.muted }}>{copy.titleLine2}</Text>
        </Text>
        <Text className="mt-4 font-sans" style={{ fontSize: 15, lineHeight: 24, color: OC.muted }}>
          {copy.subtitle}
        </Text>
      </Reveal>

      <View className="mt-10">
        {journeyCards.map((step, index) => {
          const Card = CARDS_BY_STEP[step]
          const isLast = index === journeyCards.length - 1

          return (
            <View key={step}>
              <Reveal delay={index * 70}>
                <Pressable onPress={() => setActiveIndex(index)} accessibilityRole="button">
                  <Card copy={copy.cards[step]} highlighted={index === activeIndex} />
                </Pressable>
              </Reveal>

              {!isLast ? (
                <View className="items-center" style={{ paddingVertical: 12 }} pointerEvents="none">
                  <View style={{ width: 1, height: 24, backgroundColor: OC.line }} />
                  <ChevronDown size={16} color={OC.faint} strokeWidth={2} style={{ marginTop: -4 }} />
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}
