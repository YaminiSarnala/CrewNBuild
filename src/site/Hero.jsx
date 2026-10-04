// Port of the web src/components/site/Hero.jsx — responsive for phone + tablet.
// Same background with fallback, same overlay gradient, same four feature pills,
// same trust row, same avatar cluster, same three stats, and the same staggered
// entrance delays (0 / .12 / .22 / .32 / .42 / .5 / .68s).
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState } from 'react'
import { View, Text } from 'react-native'
import { Image } from 'expo-image'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowRight, Award, BadgeCheck, Lock, CirclePlay as PlayCircle, ShieldCheck, Sparkles } from 'lucide-react-native'
import { IMG, MEDIA } from './data.js'
import { useLanguage } from '../i18n/LanguageContext'
import { useResponsive } from '../hooks/useResponsive'
import { ContentWrap } from '../components/Responsive'
import { PrimaryButton, GhostButton, Pill, StatCard } from '../components/ui'
import { SHADOW, TYPE, EASE_SIGNATURE } from '../theme/tokens'

const FEATURE_PILLS = [
  { icon: Sparkles, labelKey: 'site.hero.pill.ai' },
  { icon: ShieldCheck, labelKey: 'site.hero.pill.transparent' },
  { icon: ShieldCheck, labelKey: 'site.hero.pill.verified' },
  { icon: Lock, labelKey: 'site.hero.pill.secure' },
]

const AVATARS = [
  'https://randomuser.me/api/portraits/men/32.jpg',
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/75.jpg',
  'https://randomuser.me/api/portraits/women/68.jpg',
]

const TRUST_ITEMS = [
  { icon: ShieldCheck, labelKey: 'site.hero.trust.rera' },
  { icon: Award, labelKey: 'site.hero.trust.iso' },
  { icon: BadgeCheck, labelKey: 'site.hero.trust.warranty' },
]

const HERO_STATS = [
  { value: '850+', labelKey: 'site.hero.stat.projects' },
  { value: '98%', labelKey: 'site.hero.stat.ontime' },
  { value: '25+', labelKey: 'site.hero.stat.years' },
]

function Enter({ delay, children, y = 26 }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: y }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 700, delay, easing: EASE_SIGNATURE }}
    >
      {children}
    </MotiView>
  )
}

export default function Hero({ onEstimate, onViewWork }) {
  const { t } = useLanguage()
  const { height, isTablet, isLandscape, scale, gutter } = useResponsive()
  const insets = useSafeAreaInsets()
  const [bgFailed, setBgFailed] = useState(false)

  // On the web the copy sat in a max-w-xl column beside the photo at lg+.
  // On a tablet we reproduce that: copy constrained to ~58% instead of full width.
  const copyWidth = isTablet && isLandscape ? '58%' : isTablet ? '78%' : '100%'
  const titleSize = scale(TYPE.heroTitle)
  // Buttons sit side by side once there is room for them.
  const buttonsInline = isTablet

  return (
    <View className="relative overflow-hidden bg-paper" style={{ minHeight: height * (isTablet ? 0.8 : 0.92) }}>
      <View style={{ position: 'absolute', inset: 0 }}>
        <Image
          source={bgFailed ? { uri: IMG.heroConstruction } : MEDIA.heroBackgroundLocal}
          onError={() => setBgFailed(true)}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          contentPosition={bgFailed ? 'center' : 'bottom'}
          transition={300}
        />
      </View>

      {/* Readability overlay. On tablets it runs left-to-right like the web's
          lg:bg-gradient-to-r; on phones top-to-bottom. */}
      <LinearGradient
        colors={
          isTablet
            ? ['rgba(252,250,243,1)', 'rgba(252,250,243,0.85)', 'rgba(252,250,243,0.05)']
            : ['rgba(252,250,243,0.97)', 'rgba(252,250,243,0.68)', 'rgba(252,250,243,0.18)']
        }
        locations={[0, 0.55, 1]}
        start={isTablet ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
        end={isTablet ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(252,250,243,0)', '#fcfaf3']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 112 }}
        pointerEvents="none"
      />

      <ContentWrap style={{ flex: 1 }}>
<View style={{ flex: 1, paddingHorizontal: gutter, paddingTop: insets.top + (isTablet ? 96 : 84), paddingBottom: 32 }}> 
         <View style={{ width: copyWidth }}>
            <Enter delay={0}>
              <Text
                className="font-display text-brand-800"
                style={{ fontSize: titleSize, lineHeight: titleSize * 1.06, letterSpacing: -1.2 }}
              >
                {t('site.hero.title1')}
                {'\n'}
                {t('site.hero.title2')}
                {'\n'}
                <Text className="text-brand-600">{t('site.hero.title3')}</Text>
              </Text>
            </Enter>

            <Enter delay={120}>
              <Text
                className="mt-4 font-sans text-slate-600"
                style={{ fontSize: scale(16), lineHeight: scale(16) * 1.55 }}
              >
                {t('site.hero.sub')}
              </Text>
            </Enter>

            <Enter delay={220}>
              <View className="mt-5 flex-row flex-wrap" style={{ gap: 10 }}>
                {FEATURE_PILLS.map(({ icon: Icon, labelKey }) => (
                  <Pill key={labelKey} label={t(labelKey)} icon={<Icon size={14} color="#236645" />} />
                ))}
              </View>
            </Enter>

            <Enter delay={320}>
              <View
                className="mt-5"
                style={{ gap: 12, flexDirection: buttonsInline ? 'row' : 'column' }}
              >
                <PrimaryButton
                  label={t('site.hero.cta.estimate')}
                  onPress={onEstimate}
                  icon={<ArrowRight size={16} color="#ffffff" />}
                  full={!buttonsInline}
                />
                <GhostButton
                  label={t('site.hero.cta.work')}
                  onPress={onViewWork}
                  icon={<PlayCircle size={16} color="#236645" />}
                  full={!buttonsInline}
                />
              </View>
            </Enter>

            <Enter delay={420}>
              <View className="mt-5 flex-row flex-wrap" style={{ gap: 14 }}>
                {TRUST_ITEMS.map(({ icon: Icon, labelKey }) => (
                  <View key={labelKey} className="flex-row items-center" style={{ gap: 6 }}>
                    <Icon size={14} color="#236645" />
                    <Text className="font-sans text-slate-600" style={{ fontSize: scale(13) }}>
                      {t(labelKey)}
                    </Text>
                  </View>
                ))}
              </View>
            </Enter>

            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 800, delay: 500, easing: EASE_SIGNATURE }}
              className="mt-6 flex-row items-center"
              style={{ gap: 14 }}
            >
              <View className="flex-row">
                {AVATARS.map((uri, index) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      borderWidth: 2,
                      borderColor: '#fcfaf3',
                      marginLeft: index === 0 ? 0 : -12,
                    }}
                    contentFit="cover"
                  />
                ))}
              </View>
              <View className="flex-1">
                <Text className="font-sansBold text-graphite" style={{ fontSize: scale(14) }}>
                  {t('site.hero.social.trusted')}
                </Text>
                <View className="mt-0.5 flex-row items-center" style={{ gap: 6 }}>
                  <Text style={{ fontSize: scale(13), color: '#fbbf24' }}>★★★★★</Text>
                  <Text className="font-sans text-slate-500" style={{ fontSize: scale(13) }}>
                    {t('site.hero.social.rating')}
                  </Text>
                </View>
              </View>
            </MotiView>
          </View>

          {/* Track-record stats — pinned to the bottom of the first screen. */}
          <Enter delay={680} y={24}>
            <View className="mt-8 flex-row rounded-2xl border border-slate-200 bg-white/90" style={SHADOW.soft}>
              {HERO_STATS.map((stat, index) => (
                <View key={stat.labelKey} className="flex-1 flex-row">
                  {index > 0 ? <View className="w-px bg-slate-100" /> : null}
                  <StatCard value={stat.value} label={t(stat.labelKey)} />
                </View>
              ))}
            </View>
          </Enter>
        </View>
      </ContentWrap>
    </View>
  )
}
