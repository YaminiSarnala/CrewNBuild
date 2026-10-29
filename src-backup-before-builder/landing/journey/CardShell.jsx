// Port of the web journey/CardShell.jsx.
// Shared chrome for the product cards. The card the visitor is on takes the nav
// bar's amber; the two grey text tones darken to deep green there, or they lose
// their contrast. Web does that with [&_.text-oc-muted] selectors — native has
// no descendant selectors, so the tones are passed down explicitly instead.
import { View, Text } from 'react-native'
import { AmberSurface, OC } from '../shared'

export function CardShell({ icon: Icon, label, action, highlighted, children }) {
  const body = (
    <View style={{ padding: 16 }}>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <View
          className="items-center justify-center"
          style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#ecf6f1' }}
        >
          <Icon size={14} color={OC.green} strokeWidth={2} />
        </View>
        <Text
          className="font-sansBold uppercase"
          style={{ fontSize: 11, letterSpacing: 1.5, color: highlighted ? 'rgba(8,62,43,0.75)' : OC.faint }}
        >
          {label}
        </Text>
        {action ? <View style={{ marginLeft: 'auto' }}>{action}</View> : null}
      </View>

      <View className="mt-4">{children}</View>
    </View>
  )

  if (highlighted) {
    return (
      <AmberSurface radius={18} style={{ borderWidth: 1, borderColor: 'rgba(8,62,43,0.22)' }}>
        {body}
      </AmberSurface>
    )
  }

  return (
    <View
      style={{
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
      {body}
    </View>
  )
}

/** The muted/faint tones flip to deep green on a highlighted (amber) card. */
export function cardTones(highlighted) {
  return {
    ink: OC.ink,
    muted: highlighted ? OC.deep : OC.muted,
    faint: highlighted ? 'rgba(8,62,43,0.75)' : OC.faint,
  }
}
