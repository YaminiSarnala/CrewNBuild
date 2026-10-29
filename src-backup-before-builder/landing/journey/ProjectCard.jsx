// Port of the web journey/ProjectCard.jsx.
// Step 3 — the project is live and progress is visible day by day.
import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import { Activity } from 'lucide-react-native'
import { CardShell, cardTones } from './CardShell'
import { Pill } from './Pill'
import { ProgressBar } from './ProgressBar'
import { LANDING_ART } from '../content'
import { OC } from '../shared'
import { sampleProject } from '../journeyData'

export function ProjectCard({ copy, highlighted }) {
  const { progress, milestones, activeMilestone } = sampleProject
  const tone = cardTones(highlighted)

  return (
    <CardShell
      icon={Activity}
      label={copy.label}
      highlighted={highlighted}
      action={<Pill>{copy.day}</Pill>}
    >
      <View className="flex-row flex-wrap items-baseline justify-between" style={{ gap: 8 }}>
        <Text className="font-sansBold" style={{ fontSize: 16, color: tone.ink }}>
          {copy.title}
        </Text>
        <Text className="font-sansBold" style={{ fontSize: 14, color: OC.green }}>
          {copy.progressValue}
        </Text>
      </View>

      <ProgressBar value={progress} label={copy.progressLabel} style={{ marginTop: 12 }} />

      {/* Milestone rail — one dot per stage, filled up to the current one. */}
      <View className="mt-4 flex-row" style={{ gap: 4 }}>
        {milestones.map((milestone, index) => {
          const done = index < activeMilestone
          const current = index === activeMilestone

          return (
            <View key={milestone} className="flex-1 items-center" style={{ gap: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: done || current ? '#1a8659' : OC.lineStrong,
                  borderWidth: current ? 4 : 0,
                  borderColor: '#d5ebe0',
                }}
              />
              <Text
                className={current ? 'font-sansSemi' : 'font-sans'}
                style={{ fontSize: 10, lineHeight: 12, textAlign: 'center', color: current ? tone.ink : tone.faint }}
                numberOfLines={1}
              >
                {copy.milestones[milestone]}
              </Text>
            </View>
          )
        })}
      </View>

      <View
        className="mt-5 flex-row items-center"
        style={{
          gap: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: OC.line,
          backgroundColor: OC.paper,
          padding: 12,
        }}
      >
        <Image
          source={LANDING_ART.siteUpdate}
          accessibilityLabel={copy.photoLabel}
          style={{ width: 64, height: 64, borderRadius: 8, borderWidth: 1, borderColor: OC.line }}
          contentFit="cover"
        />
        <View style={{ flex: 1 }}>
          <Text
            className="font-sansBold uppercase"
            style={{ fontSize: 11, letterSpacing: 1.3, color: tone.faint }}
          >
            {copy.updateLabel}
          </Text>
          <Text className="mt-0.5 font-sans" style={{ fontSize: 14, lineHeight: 19, color: tone.ink }}>
            {copy.update}
          </Text>
        </View>
      </View>
    </CardShell>
  )
}
