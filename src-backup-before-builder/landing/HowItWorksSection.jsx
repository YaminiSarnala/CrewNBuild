// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/HowItWorksSection.jsx.
//
// Five stages, one flow. The web draws them along a horizontal rail on wide
// screens and folds the same markup into a vertical timeline on narrow ones.
// A phone is always narrow, so only the vertical timeline exists here — the
// numbered badges, the connecting rule between them, and the closing footnote.
// ---------------------------------------------------------------------------
import { View, Text } from 'react-native'
import { GUTTER, OC, Reveal, SectionLabel } from './shared'
import { flowSteps } from './journeyData'

export function HowItWorksSection({ text }) {
  const copy = text.howItWorks

  return (
    <View style={{ backgroundColor: OC.paper, paddingVertical: 72, paddingHorizontal: GUTTER }}>
      <Reveal>
        <View className="items-center">
          <SectionLabel>{copy.eyebrow}</SectionLabel>
          <Text
            className="mt-3 text-center font-display"
            style={{ fontSize: 27, lineHeight: 33, letterSpacing: -1, color: OC.ink }}
          >
            {copy.title}
          </Text>
        </View>
      </Reveal>

      <View className="mt-12">
        {flowSteps.map((step, index) => {
          const StepIcon = step.icon
          const isLast = index === flowSteps.length - 1

          return (
            <Reveal key={step.key} delay={index * 70}>
              <View className="flex-row" style={{ gap: 16 }}>
                {/* Badge rail — the rule between badges is the vertical form of
                    the web's horizontal progress line. */}
                <View className="items-center">
                  <View
                    className="items-center justify-center"
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: OC.line,
                      backgroundColor: '#ffffff',
                      shadowColor: '#126b45',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.08,
                      shadowRadius: 12,
                      elevation: 2,
                    }}
                  >
                    <StepIcon size={20} color={OC.green} strokeWidth={1.6} />
                  </View>
                  {!isLast ? (
                    <View style={{ width: 1, flex: 1, marginTop: 8, backgroundColor: OC.line }} />
                  ) : null}
                </View>

                <View style={{ flex: 1, paddingBottom: 40 }}>
                  <Text
                    className="font-sansBold"
                    style={{ fontSize: 12, letterSpacing: 1.7, color: '#1a8659' }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </Text>
                  <Text className="mt-1.5 font-sansBold" style={{ fontSize: 16, color: OC.ink }}>
                    {copy.steps[step.key].title}
                  </Text>
                  <Text
                    className="mt-1.5 font-sans"
                    style={{ fontSize: 13.5, lineHeight: 21, color: OC.muted }}
                  >
                    {copy.steps[step.key].description}
                  </Text>
                </View>
              </View>
            </Reveal>
          )
        })}
      </View>

      <Reveal delay={120}>
        <Text
          className="mt-4 text-center font-sansSemi"
          style={{ fontSize: 15, lineHeight: 23, color: OC.ink }}
        >
          {copy.footnote}
        </Text>
      </Reveal>
    </View>
  )
}
