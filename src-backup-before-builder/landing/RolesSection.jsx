// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/RolesSection.jsx.
//
// Reproduced: the deep-green band with its amber top hairline, the section
// label and two-tone headline, the body copy, the dashed ring behind the
// showcased character with its idle motion and ground shadow, the sparkle
// caption, and the five role tiles — the active one turning solid green with an
// amber tilted icon and its benefit line revealed. The equipment role keeps its
// "coming soon" chip.
//
// Native difference: the web pins the showcase inside a 400vh track and swaps
// the role as you scroll through it. Scroll-driven pinning has no clean native
// equivalent and would fight the page's own scrolling, so on mobile the tiles
// are tapped — which is what the web falls back to at its narrow breakpoint,
// where the track collapses to content height.
// ---------------------------------------------------------------------------
import { View, Text, Pressable, useWindowDimensions } from 'react-native'
import { MotiView } from 'moti'
import { ChevronRight, Sparkles } from 'lucide-react-native'
import { roleMeta } from './content'
import { ComingSoonChip, GUTTER, OC, Reveal, RoleCharacter, SectionLabel } from './shared'

function RoleTile({ role, index, isActive, onPress, comingSoonLabel }) {
  const Icon = roleMeta[index].icon
  const isUpcoming = roleMeta[index].comingSoon

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      className="w-full flex-row items-center rounded-xl"
      style={{
        gap: 15,
        paddingHorizontal: 17,
        paddingVertical: 16,
        borderWidth: 1,
        backgroundColor: isActive ? OC.green : 'rgba(255,255,255,0.08)',
        borderColor: isActive ? OC.green : 'rgba(255,255,255,0.2)',
        // Web lifts the active tile sideways; on a phone the row is full width,
        // so it lifts vertically instead to avoid clipping at the edge.
        transform: [{ translateY: isActive ? -2 : 0 }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: isActive ? 18 : 0 },
        shadowOpacity: isActive ? 0.2 : 0,
        shadowRadius: 17,
        elevation: isActive ? 6 : 0,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isActive ? OC.amber : 'rgba(223,240,232,0.16)',
          transform: isActive ? [{ rotate: '-12deg' }, { scale: 1.08 }] : [],
        }}
      >
        <Icon size={18} color={isActive ? OC.deep : '#d5f1de'} />
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text className="font-sansBold text-white" style={{ fontSize: 14 }}>
            {role.title}
          </Text>
          {isUpcoming ? <ComingSoonChip label={comingSoonLabel} /> : null}
        </View>

        <Text
          className="font-sans"
          style={{ fontSize: 10, color: isActive ? '#dcf4e3' : '#b9d8c5' }}
        >
          {role.short}
        </Text>

        {isActive ? (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 260 }}
          >
            <Text className="font-sansBold" style={{ fontSize: 10, color: OC.amber }}>
              {role.benefit}
            </Text>
          </MotiView>
        ) : null}
      </View>

      <ChevronRight size={17} color={isActive ? '#c9e4d3' : '#a9d6bc'} />
    </Pressable>
  )
}

export function RolesSection({ text, activeIndex, onSelect }) {
  const { width } = useWindowDimensions()
  const meta = roleMeta[activeIndex]

  // Web: text-[3.3rem] at the narrow breakpoint.
  const headlineSize = Math.min(width * 0.125, 53)

  return (
    <View
      style={{
        backgroundColor: OC.deep,
        paddingTop: 84,
        paddingBottom: 90,
        paddingHorizontal: GUTTER,
      }}
    >
      {/* Web: a 1px amber-to-transparent hairline across the top edge. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(244,183,64,0.55)',
        }}
      />

      <Reveal>
        <SectionLabel tone="light">{text.rolesSection.label}</SectionLabel>
      </Reveal>

      <Reveal delay={70}>
        <Text
          className="mt-5 font-display text-white"
          style={{ fontSize: headlineSize, lineHeight: headlineSize * 0.98, letterSpacing: -2.6 }}
        >
          {text.rolesSection.headline}
          {'\n'}
          <Text style={{ color: '#a9d6bc' }}>{text.rolesSection.highlight}</Text>
        </Text>
      </Reveal>

      <Reveal delay={140}>
        <Text className="mt-6 font-sans" style={{ fontSize: 13, lineHeight: 23, color: '#b9d8c5' }}>
          {text.rolesSection.body}
        </Text>
      </Reveal>

      {/* -------------------------- Showcase -------------------------- */}
      <View
        className="mt-11 items-center justify-center"
        style={{ height: 360, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)' }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 240,
            height: 240,
            borderRadius: 120,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: 'rgba(255,255,255,0.35)',
            transform: [{ rotate: '-18deg' }],
          }}
        />

        {/* Ground shadow */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 43,
            width: 180,
            height: 24,
            borderRadius: 12,
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}
        />

        <MotiView
          key={activeIndex}
          from={{ opacity: 0, translateY: 16, scale: 0.92 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'timing', duration: 350 }}
          style={{ width: 190, height: 265, justifyContent: 'flex-end' }}
        >
          <RoleCharacter role={meta} height={265} />
        </MotiView>

        <View className="absolute flex-row items-center" style={{ bottom: 15, gap: 7 }}>
          <Sparkles size={14} color={OC.amber} />
          <Text className="font-sansBold" style={{ fontSize: 10, color: '#d1ebda' }}>
            {text.rolesSection.caption}
          </Text>
        </View>
      </View>

      {/* ---------------------------- Tiles ---------------------------- */}
      <View className="mt-7" style={{ gap: 10 }}>
        {text.roles.map((role, index) => (
          <Reveal key={role.title} delay={index * 60}>
            <RoleTile
              role={role}
              index={index}
              isActive={activeIndex === index}
              comingSoonLabel={text.comingSoon}
              onPress={() => onSelect(index)}
            />
          </Reveal>
        ))}
      </View>
    </View>
  )
}