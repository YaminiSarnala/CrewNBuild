// Pieces of the web Builder dashboard (pages/contractor/contractorTopSection.jsx,
// components/dashboard/DashboardHero.jsx + HeroConstructionScene.jsx and
// ContractorAnalyticsSection.jsx), drawn for the phone:
//   - WelcomeBanner: avatar, "Welcome, {name}", the subtitle and the same
//     vector construction scene (react-native-svg instead of <svg>).
//   - StatCard: the four coloured figure cards.
//   - DonutChart / BudgetRing: Requests by Status and Budget Overview.
import { View, Text, Pressable } from 'react-native'
import { Image } from 'expo-image'
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { ChevronRight } from 'lucide-react-native'
import { LinearGradient as Gradient } from 'expo-linear-gradient'
import { avatarFromPath } from '../../utils/avatars'
import { ink, line, soft, softStrong, isDarkTheme } from '../../theme/tint'
import { createStyles } from '../../theme/createStyles'

// ---- Hero construction scene (web HeroConstructionScene, same geometry) -----
const WHITE = '#ffffff'
const PAPER = '#f7faf7'
const MINT = '#dff0e8'
const SHADE = '#cbe0d4'
const LIGHT = '#add8c3'
const MID = '#7bc2a2'
const GREEN = '#126b45'
const DEEP_GREEN = '#0e5537'
const SLAB = '#9fb8ab'
const STEEL = '#4f6b5d'
const FRAME = '#8fa79b'

function Tree({ x, y, scale = 1, tone = GREEN }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Rect x="-1.5" y="-2" width="3" height="14" rx="1.3" fill={DEEP_GREEN} />
      <Circle cx="0" cy="-11" r="9" fill={tone} />
      <Circle cx="-6" cy="-4.5" r="6.6" fill={tone} />
      <Circle cx="6" cy="-4.5" r="6.6" fill={tone} opacity="0.85" />
    </G>
  )
}

export function HeroConstructionScene({ width = '100%', height = 70 }) {
  return (
    <Svg width={width} height={height} viewBox="180 0 240 100" preserveAspectRatio="xMidYMid meet">
      <Defs>
        <LinearGradient id="ocHeroField" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={MINT} stopOpacity="0" />
          <Stop offset="22%" stopColor={MINT} stopOpacity="0.34" />
          <Stop offset="58%" stopColor={MINT} stopOpacity="0.62" />
          <Stop offset="100%" stopColor={MINT} stopOpacity="0.72" />
        </LinearGradient>
        <LinearGradient id="ocHeroHillFar" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={MID} stopOpacity="0" />
          <Stop offset="35%" stopColor={MID} stopOpacity="0.4" />
          <Stop offset="100%" stopColor={MID} stopOpacity="0.5" />
        </LinearGradient>
        <LinearGradient id="ocHeroGround" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={LIGHT} stopOpacity="0" />
          <Stop offset="26%" stopColor={LIGHT} stopOpacity="0.75" />
          <Stop offset="100%" stopColor={LIGHT} stopOpacity="0.95" />
        </LinearGradient>
      </Defs>
      <Path d="M20 100 C 66 74, 118 56, 190 52 C 258 48, 300 30, 358 30 C 396 30, 412 40, 420 52 L420 100 Z" fill="url(#ocHeroField)" />
      <Path d="M60 90 C 128 66, 196 70, 250 84 L250 100 L60 100 Z" fill="url(#ocHeroHillFar)" />
      <Path d="M300 88 C 344 68, 388 72, 420 80 L420 100 L300 100 Z" fill={MID} opacity="0.3" />
      <Path d="M34 91 C 140 85, 320 85, 420 90 L420 100 L34 100 Z" fill="url(#ocHeroGround)" />

      {/* Tower crane */}
      <G>
        <Rect x="349" y="16" width="7.5" height="75" rx="1" fill={STEEL} />
        {[24, 35, 46, 57, 68, 79].map((y) => (
          <G key={y}>
            <Line x1="349.5" y1={y} x2="356" y2={y - 5.5} stroke={PAPER} strokeWidth="1.3" opacity="0.75" />
            <Line x1="349.5" y1={y - 5.5} x2="356" y2={y} stroke={PAPER} strokeWidth="1.3" opacity="0.45" />
          </G>
        ))}
        <Rect x="343" y="88" width="20" height="4" rx="1.4" fill={STEEL} />
        <Rect x="248" y="12" width="105" height="4.6" rx="1.6" fill={STEEL} />
        <Rect x="353" y="12" width="32" height="4.6" rx="1.6" fill={STEEL} />
        <Rect x="374" y="8" width="11" height="9" rx="1.6" fill={GREEN} />
        <Path d="M350 12 L352.5 2 L358 12" fill="none" stroke={STEEL} strokeWidth="2" strokeLinejoin="round" />
        <Line x1="352" y1="3" x2="256" y2="13" stroke={STEEL} strokeWidth="1.3" />
        <Line x1="355" y1="3" x2="381" y2="9.5" stroke={STEEL} strokeWidth="1.3" />
        <Rect x="345" y="17" width="10" height="8" rx="1.6" fill={PAPER} stroke={STEEL} strokeWidth="0.8" />
        <Line x1="286" y1="16.6" x2="286" y2="42" stroke={STEEL} strokeWidth="1.2" />
        <Rect x="281" y="42" width="10" height="5" rx="1.4" fill={STEEL} />
        <Rect x="278" y="47" width="16" height="6" rx="1.4" fill={FRAME} />
      </G>

      {/* Villa under construction */}
      <G>
        <Rect x="238" y="34" width="58" height="24" fill={WHITE} />
        <Rect x="288" y="34" width="8" height="24" fill={SHADE} />
        <Rect x="232" y="29.5" width="70" height="5" rx="1.6" fill={SLAB} />
        <Rect x="246" y="41" width="13" height="10" rx="1" fill={GREEN} opacity="0.68" />
        <Rect x="266" y="41" width="13" height="10" rx="1" fill={GREEN} opacity="0.52" />
        <Rect x="220" y="62" width="80" height="29" fill={PAPER} />
        <Rect x="292" y="62" width="8" height="29" fill={SHADE} />
        <Rect x="214" y="57.5" width="92" height="5" rx="1.6" fill={SLAB} />
        <Rect x="230" y="69" width="15" height="11" rx="1" fill={GREEN} opacity="0.68" />
        <Rect x="253" y="69" width="15" height="11" rx="1" fill={GREEN} opacity="0.52" />
        <Rect x="278" y="74" width="11" height="17" rx="1.2" fill={SHADE} />
        <Rect x="300" y="57.5" width="34" height="5" rx="1.6" fill={SLAB} />
        <Rect x="302" y="62" width="3.6" height="29" fill={FRAME} />
        <Rect x="315" y="62" width="3.6" height="29" fill={FRAME} />
        <Rect x="328" y="62" width="3.6" height="29" fill={FRAME} />
        <Rect x="300" y="75" width="34" height="3" fill={FRAME} />
        <G stroke={STEEL} strokeWidth="1.2" opacity="0.65">
          <Line x1="218" y1="48" x2="218" y2="91" />
          <Line x1="234" y1="48" x2="234" y2="91" />
          <Line x1="216" y1="58" x2="236" y2="58" />
          <Line x1="216" y1="72" x2="236" y2="72" />
          <Line x1="216" y1="86" x2="236" y2="86" />
        </G>
        <Rect x="196" y="84" width="18" height="3.6" rx="1.2" fill={FRAME} />
        <Rect x="198" y="87.6" width="18" height="3.6" rx="1.2" fill={SLAB} />
      </G>

      <Tree x={352} y={92} scale={0.9} tone={DEEP_GREEN} />
      <Tree x={382} y={92} scale={0.7} tone={GREEN} />
      <Tree x={404} y={92} scale={0.86} tone={DEEP_GREEN} />
    </Svg>
  )
}
/**
 * The web's cream "Welcome, {name}" banner (DashboardHero variant="cream").
 * Like the web it stays cream in the dark theme, so its text uses fixed
 * colours (#083E2B / #3d5246), not the theme utilities that turn light.
 */
export function WelcomeBanner({ name, subtitle, imagePath, title }) {
  return (
    <Gradient
      colors={['#F3F0E3', '#FEF6E9', '#FCF2E1']}
      locations={[0, 0.58, 1]}
      start={{ x: 0, y: 0.3 }}
      end={{ x: 1, y: 0.7 }}
      style={{ borderRadius: 20, borderWidth: 1, borderColor: '#f97316', overflow: 'hidden', padding: 14 }}
    >
      <View style={styles.view}>
        <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(244,183,64,0.5)' }}>
          <Image source={avatarFromPath(imagePath, 'CONTRACTOR')} style={{ width: 36, height: 36 }} contentFit="cover" />
        </View>
        <View style={styles.view2}>
          <Text style={[styles.text, { color: '#083E2B', letterSpacing: -0.3 }]} numberOfLines={2}>{title || name}</Text>
          <Gradient colors={['#f4b740', '#b27d1c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ marginTop: 4, height: 4, width: 26, borderRadius: 2 }} />
          <Text style={[styles.text2, { color: '#3d5246' }]}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.view3}>
        <HeroConstructionScene height={64} />
      </View>
    </Gradient>
  )
}

// Card themes of the web's four figure cards (blue / purple / green / orange).
const STAT_THEMES = {
  blue: { card: '#eff6ff', border: '#bfdbfe', chip: '#dbeafe', icon: '#1d4ed8', arrow: '#dbeafe' },
  purple: { card: '#faf5ff', border: '#e9d5ff', chip: '#f3e8ff', icon: '#7e22ce', arrow: '#f3e8ff' },
  green: { card: '#f0fdf4', border: '#bbf7d0', chip: '#dcfce7', icon: '#15803d', arrow: '#dcfce7' },
  orange: { card: '#fff7ed', border: '#fed7aa', chip: '#ffedd5', icon: '#ea580c', arrow: '#ffedd5' },
}

/** One of the four coloured figure cards (web ContractorAnalyticsSection). */
export function StatCard({ title, value, sub, theme = 'blue', icon: Icon, onPress }) {
  const colors = STAT_THEMES[theme] || STAT_THEMES.blue
  const chip = softStrong(colors.chip, colors.icon)
  const tone = ink(colors.icon)
  return (
    <Pressable
      onPress={onPress}
      style={[styles.pressable, { backgroundColor: soft(colors.card, colors.icon), borderColor: line(colors.border, colors.icon) }]}
    >
      <View style={styles.view4}>
        <View style={[styles.view5, { backgroundColor: chip }]}>
          {Icon ? <Icon size={19} color={tone} /> : null}
        </View>
        <View style={[styles.view6, { backgroundColor: chip }]}>
          <ChevronRight size={15} color={tone} />
        </View>
      </View>
      <Text style={styles.text3} numberOfLines={1}>{title}</Text>
      <Text style={styles.text4} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.text5} numberOfLines={1}>{sub}</Text>
    </Pressable>
  )
}

const polar = (cx, cy, r, angle) => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]

/** A donut (web Requests by Status). `slices`: [{ id, value, color }]. */
export function DonutChart({ slices, size = 128, thickness = 18, centerValue, centerLabel }) {
  const total = slices.reduce((sum, slice) => sum + Number(slice.value || 0), 0)
  const radius = (size - thickness) / 2
  const cx = size / 2
  let start = -Math.PI / 2
  return (
    <View style={[styles.view7, { width: size, height: size }]}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={cx} cy={cx} r={radius} stroke={isDarkTheme() ? '#1e293b' : '#eef2f0'} strokeWidth={thickness} fill="none" />
        {total > 0 && slices.filter((slice) => slice.value > 0).map((slice) => {
                    const sweep = (slice.value / total) * Math.PI * 2
          if (sweep >= Math.PI * 2 - 0.0001) {
            return <Circle key={slice.id} cx={cx} cy={cx} r={radius} stroke={slice.color} strokeWidth={thickness} fill="none" />
          }
          const [x1, y1] = polar(cx, cx, radius, start)
          const [x2, y2] = polar(cx, cx, radius, start + sweep)
          const large = sweep > Math.PI ? 1 : 0
          const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`
          start += sweep
          return <Path key={slice.id} d={d} stroke={slice.color} strokeWidth={thickness} fill="none" />
        })}
      </Svg>
      <Text style={styles.text6} numberOfLines={1} adjustsFontSizeToFit>{centerValue}</Text>
      {centerLabel ? <Text style={styles.text7}>{centerLabel}</Text> : null}
    </View>
  )
}

/** Spent against budget as a ring (web Budget Overview): green spent over amber. */
export function BudgetRing({ share, size = 128, thickness = 16, centerValue, centerLabel }) {
  const clamped = Math.max(0, Math.min(100, Number(share) || 0))
  return (
    <DonutChart
      size={size}
      thickness={thickness}
      centerValue={centerValue}
      centerLabel={centerLabel}
      slices={[
        { id: 'spent', value: clamped, color: '#1f7a4d' },
        { id: 'remaining', value: 100 - clamped, color: '#f5b31b' },
      ]}
    />
  )
}

const styles = createStyles((c) => ({
  view: { flexDirection: 'row', alignItems: 'flex-start', gap: 10.5 },
  view2: { flex: 1 },
  text: { fontFamily: 'Manrope_800ExtraBold', fontSize: 18 },
  text2: { marginTop: 5.25, fontSize: 12, fontWeight: '500', lineHeight: 17 },
  view3: { marginTop: 3.5 },
  pressable: { width: '48.5%', borderRadius: 16, borderWidth: 1, padding: 10.5 },
  view4: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  view5: { height: 35, width: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  view6: { height: 24.5, width: 24.5, alignItems: 'center', justifyContent: 'center', borderRadius: 9999 },
  text3: { marginTop: 7, fontSize: 12, fontWeight: '700', color: c.textSoft },
  text4: { marginTop: 1.75, fontSize: 22, fontWeight: '800', color: c.text },
  text5: { marginTop: 1.75, fontSize: 11, fontWeight: '600', color: c.textMuted },
  view7: { alignItems: 'center', justifyContent: 'center' },
  text6: { paddingHorizontal: 17.5, textAlign: 'center', fontSize: 18, fontWeight: '800', color: c.text },
  text7: { fontSize: 10, fontWeight: '600', color: c.textMuted },
}))
