// Port of the web journey/Pill.jsx.
// Small status chip. The amber tone is the only place the warm colour appears in
// these cards — it marks a construction state, never an action.
import { View, Text } from 'react-native'
import { MotiView } from 'moti'

const TONES = {
  neutral: { bg: '#f1f5f3', text: '#61736a', border: '#d9e6de', dot: '#98a29d' },
  brand: { bg: '#ecf6f1', text: '#0e5537', border: '#d5ebe0', dot: '#22a06b' },
  accent: { bg: '#fef8ea', text: '#b27d1c', border: '#fceec9', dot: '#e8b23c' },
}

export function Pill({ tone = 'neutral', dot = false, icon: Icon, children }) {
  const palette = TONES[tone] || TONES.neutral

  return (
    <View
      className="flex-row items-center rounded-full"
      style={{
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        backgroundColor: palette.bg,
        borderColor: palette.border,
      }}
    >
      {dot ? (
        tone === 'accent' ? (
          // Web: animate-pulse-dot on the accent tone only.
          <MotiView
            from={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 700, loop: true, repeatReverse: true }}
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.dot }}
          />
        ) : (
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.dot }} />
        )
      ) : null}

      {Icon ? <Icon size={13} color={palette.text} strokeWidth={2} /> : null}

      <Text className="font-sansSemi" style={{ fontSize: 11.5, color: palette.text }}>
        {children}
      </Text>
    </View>
  )
}
