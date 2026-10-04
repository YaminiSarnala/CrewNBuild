// ---------------------------------------------------------------------------
// Ports of the web marketing sections, collected into one module because on
// mobile they are all consumed by a single scrolling LandingScreen:
//   TrustBar, ServicesSection, StatsSection, ProjectsSection, WhyUsSection,
//   ProcessSection, TestimonialsSection, FaqSection, CTASection, Footer
//
// IMPORTANT: every string goes through t() using the SAME translation keys the
// web app uses, so all 7 languages work here exactly as they do on the web.
// site/data.js supplies only the non-translatable parts (images, names, values).
// ---------------------------------------------------------------------------
import { useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { MotiView } from 'moti'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowRight,
  Check,
  ChevronDown,
  ShieldCheck,
  Award,
  Clock,
  Users,
  HardHat,
  Wallet,
  BadgeCheck,
} from 'lucide-react-native'
import { SERVICES, PROJECTS, TESTIMONIALS } from './data.js'
import { Reveal, SectionHeading, SmartImage, Stars, PrimaryButton, GhostButton, Eyebrow } from '../components/ui'
import { ContentWrap, Grid } from '../components/Responsive'
import { useResponsive } from '../hooks/useResponsive'
import { SHADOW, TYPE } from '../theme/tokens'
import { useLanguage } from '../i18n/LanguageContext'

/* Section shell: full-bleed background colour, content centred and width-capped
   on tablets, with breakpoint-aware horizontal padding. Replaces the web's
   `container-x` (mx-auto max-w-7xl px-5 sm:px-8). */
function Section({ className = '', children }) {
  const { gutter, isTablet } = useResponsive()
  return (
    <View className={className} style={{ paddingVertical: isTablet ? 64 : 56 }}>
      <ContentWrap>
        <View style={{ paddingHorizontal: gutter }}>{children}</View>
      </ContentWrap>
    </View>
  )
}

/* ---------------------------------- TrustBar ---------------------------------- */
const TRUST_BADGES = [
  { icon: Award, key: 'site.trust.iso' },
  { icon: ShieldCheck, key: 'site.trust.rera' },
  { icon: HardHat, key: 'site.trust.engineers' },
  { icon: BadgeCheck, key: 'site.trust.warranty' },
  { icon: Wallet, key: 'site.trust.cidc' },
]

export function TrustBar() {
  const { t } = useLanguage()
  const { gutter } = useResponsive()
  return (
    <View className="border-y border-slate-200 bg-white py-5">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: 22 }}
      >
        {TRUST_BADGES.map(({ icon: Icon, key }) => (
          <View key={key} className="flex-row items-center" style={{ gap: 8 }}>
            <Icon size={16} color="#236645" />
            <Text className="font-sansSemi text-slate-600" style={{ fontSize: 13 }}>
              {t(key)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

/* ------------------------------ ServicesSection ------------------------------ */
// SERVICES ids in data.js map onto site.services.card.<id> / <id>Blurb keys.
export function ServicesSection() {
  const { t } = useLanguage()
  return (
    <Section className="bg-paper">
      <SectionHeading
        eyebrow={t('site.services.eyebrow')}
        title={t('site.services.title')}
        highlight={t('site.services.highlight')}
        sub={t('site.services.sub')}
        align="left"
      />
      <Grid gap={16}>
        {SERVICES.map((service, index) => (
          <Reveal key={service.id} delay={index * 70}>
            <View className="overflow-hidden rounded-3xl border border-slate-200 bg-white" style={SHADOW.card}>
              <SmartImage source={service.image} style={{ width: '100%', height: 160 }} />
              <View className="p-5">
                <Text className="font-display text-graphite" style={{ fontSize: TYPE.cardTitle, letterSpacing: -0.4 }}>
                  {t(`site.services.card.${service.id}`)}
                </Text>
                <Text className="mt-2 font-sans text-slate-500" style={{ fontSize: 14, lineHeight: 21 }}>
                  {t(`site.services.card.${service.id}Blurb`)}
                </Text>
                <View className="mt-4" style={{ gap: 8 }}>
                  {service.points.map((point) => (
                    <View key={point} className="flex-row items-center" style={{ gap: 8 }}>
                      <View className="h-5 w-5 items-center justify-center rounded-full bg-brand-50">
                        <Check size={12} color="#236645" />
                      </View>
                      <Text className="font-sans text-slate-600" style={{ fontSize: 13 }}>
                        {point}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Reveal>
        ))}
      </Grid>
    </Section>
  )
}

/* -------------------------------- StatsSection -------------------------------- */
// Values stay in code (they are numerals); labels come from translations.
const STAT_ITEMS = [
  { value: '25+', key: 'site.stats.years' },
  { value: '850+', key: 'site.stats.projects' },
  { value: '120+', key: 'site.stats.engineers' },
  { value: '98%', key: 'site.stats.ontime' },
]

export function StatsSection() {
  const { t } = useLanguage()
  return (
    <Section className="bg-brand-800">
      <Eyebrow dark>{t('site.stats.eyebrow')}</Eyebrow>
      <View className="mt-4 flex-row flex-wrap">
        {STAT_ITEMS.map((stat, index) => (
          <View key={stat.key} style={{ width: '50%' }} className="px-1 py-4">
            <Reveal delay={index * 80}>
              <Text className="font-display text-white" style={{ fontSize: 30, letterSpacing: -1 }}>
                {stat.value}
              </Text>
              <Text className="mt-1 font-sansSemi text-brand-200" style={{ fontSize: 13 }}>
                {t(stat.key)}
              </Text>
            </Reveal>
          </View>
        ))}
      </View>
    </Section>
  )
}

/* ------------------------------ ProjectsSection ------------------------------ */
export function ProjectsSection({ limit = 6 }) {
  const { t } = useLanguage()
  return (
    <Section className="bg-white">
      <SectionHeading
        eyebrow={t('site.projects.eyebrow')}
        title={t('site.projects.title')}
        highlight={t('site.projects.highlight')}
        sub={t('site.projects.sub')}
        align="left"
      />
      <Grid gap={16}>
        {PROJECTS.slice(0, limit).map((project, index) => (
          <Reveal key={project.id} delay={index * 70}>
            <View className="overflow-hidden rounded-3xl bg-slate-900" style={SHADOW.float}>
              <SmartImage source={project.image} style={{ width: '100%', height: 210 }} />
              <LinearGradient
                colors={['transparent', 'rgba(15,23,42,0.92)']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 }}
                pointerEvents="none"
              />
              <View className="absolute bottom-0 left-0 right-0 p-5">
                <View className="self-start rounded-full bg-brand-500 px-3 py-1">
                  <Text className="font-sansBold uppercase text-white" style={{ fontSize: 10, letterSpacing: 1.2 }}>
                    {project.category}
                  </Text>
                </View>
                <Text className="mt-2 font-display text-white" style={{ fontSize: 18, letterSpacing: -0.4 }}>
                  {project.title}
                </Text>
                <Text className="mt-1 font-sans text-slate-300" style={{ fontSize: 12 }}>
                  {project.location} · {project.year} · {project.area}
                </Text>
              </View>
            </View>
          </Reveal>
        ))}
      </Grid>
    </Section>
  )
}

/* -------------------------------- WhyUsSection -------------------------------- */
// Web keys are site.why.r1t / r1b through r6t / r6b.
const WHY_ICONS = [ShieldCheck, Wallet, Clock, Users, HardHat, Award]

export function WhyUsSection() {
  const { t } = useLanguage()
  return (
    <Section className="bg-paper">
      <SectionHeading
        eyebrow={t('site.why.eyebrow')}
        title={t('site.why.titlePre')}
        highlight={t('site.why.titleHighlight')}
        sub={t('site.why.sub')}
        align="left"
      />
      <Grid gap={14}>
        {WHY_ICONS.map((Icon, index) => {
          const n = index + 1
          return (
            <Reveal key={n} delay={index * 70}>
              <View
                className="flex-row rounded-2xl border border-slate-200 bg-white p-5"
                style={[SHADOW.card, { gap: 14 }]}
              >
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-brand-50">
                  <Icon size={20} color="#134127" />
                </View>
                <View className="flex-1">
                  <Text className="font-display text-graphite" style={{ fontSize: 16, letterSpacing: -0.3 }}>
                    {t(`site.why.r${n}t`)}
                  </Text>
                  <Text className="mt-1.5 font-sans text-slate-500" style={{ fontSize: 13.5, lineHeight: 20 }}>
                    {t(`site.why.r${n}b`)}
                  </Text>
                </View>
              </View>
            </Reveal>
          )
        })}
      </Grid>
    </Section>
  )
}

/* ------------------------------- ProcessSection ------------------------------- */
// Web keys are site.process.s1t / s1b through s6t / s6b.
export function ProcessSection() {
  const { t } = useLanguage()
  const steps = [1, 2, 3, 4, 5, 6]
  return (
    <Section className="bg-white">
      <SectionHeading
        eyebrow={t('site.process.eyebrow')}
        title={t('site.process.title')}
        highlight={t('site.process.highlight')}
        sub={t('site.process.sub')}
        align="left"
      />
      <View className="mt-8">
        {steps.map((n, index) => (
          <Reveal key={n} delay={index * 60}>
            <View className="flex-row" style={{ gap: 14 }}>
              {/* Numbered rail — the content genuinely is an ordered sequence,
                  so the 01..06 markers carry real information, as on the web. */}
              <View className="items-center">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-800">
                  <Text className="font-display text-white" style={{ fontSize: 13 }}>
                    {String(n).padStart(2, '0')}
                  </Text>
                </View>
                {index < steps.length - 1 ? <View className="w-px flex-1 bg-brand-100" /> : null}
              </View>
              <View className="flex-1 pb-7">
                <Text className="font-display text-graphite" style={{ fontSize: 16, letterSpacing: -0.3 }}>
                  {t(`site.process.s${n}t`)}
                </Text>
                <Text className="mt-1.5 font-sans text-slate-500" style={{ fontSize: 13.5, lineHeight: 20 }}>
                  {t(`site.process.s${n}b`)}
                </Text>
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  )
}

/* ---------------------------- TestimonialsSection ---------------------------- */
// Quotes are translated (site.testi.q1..q3); names/photos come from data.js.
export function TestimonialsSection({ limit = 3 }) {
  const { t } = useLanguage()
  return (
    <Section className="bg-paper">
      <SectionHeading
        eyebrow={t('site.testi.eyebrow')}
        title={t('site.testi.title')}
        highlight={t('site.testi.highlight')}
        sub={t('site.testi.sub')}
        align="left"
      />
      <Grid gap={14}>
        {TESTIMONIALS.slice(0, limit).map((item, index) => {
          const n = index + 1
          const quote = n <= 3 ? t(`site.testi.q${n}`) : item.quote
          const role = n <= 3 ? t(`site.testi.r${n}`) : item.role
          return (
            <Reveal key={item.name} delay={index * 70}>
              <View className="rounded-3xl border border-slate-200 bg-white p-5" style={SHADOW.card}>
                <Stars rating={item.rating || 5} />
                <Text className="mt-3 font-sans text-slate-600" style={{ fontSize: 14, lineHeight: 22 }}>
                  {quote}
                </Text>
                <View className="mt-4 flex-row items-center" style={{ gap: 12 }}>
                  <SmartImage source={item.image} style={{ width: 42, height: 42, borderRadius: 21 }} />
                  <View className="flex-1">
                    <Text className="font-sansBold text-graphite" style={{ fontSize: 14 }}>
                      {item.name}
                    </Text>
                    <Text className="font-sans text-slate-500" style={{ fontSize: 12 }}>
                      {role}
                    </Text>
                  </View>
                </View>
              </View>
            </Reveal>
          )
        })}
      </Grid>
    </Section>
  )
}

/* --------------------------------- FaqSection --------------------------------- */
// Web keys are site.faq.q1 / a1 through q6 / a6.
export function FaqSection() {
  const { t } = useLanguage()
  const [openIndex, setOpenIndex] = useState(0)
  const items = [1, 2, 3, 4, 5, 6]
  return (
    <Section className="bg-white">
      <SectionHeading
        eyebrow={t('site.faq.eyebrow')}
        title={t('site.faq.title')}
        highlight={t('site.faq.highlight')}
        sub={t('site.faq.sub')}
        align="left"
      />
      <View className="mt-8" style={{ gap: 10 }}>
        {items.map((n, index) => {
          const open = openIndex === index
          return (
            <View key={n} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <Pressable
                onPress={() => setOpenIndex(open ? -1 : index)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                className="flex-row items-center justify-between px-5 py-4 active:bg-slate-50"
                style={{ gap: 12 }}
              >
                <Text className="flex-1 font-sansSemi text-graphite" style={{ fontSize: 14.5, lineHeight: 21 }}>
                  {t(`site.faq.q${n}`)}
                </Text>
                <MotiView animate={{ rotate: open ? '180deg' : '0deg' }} transition={{ type: 'timing', duration: 200 }}>
                  <ChevronDown size={18} color="#64748b" />
                </MotiView>
              </Pressable>
              {open ? (
                <MotiView
                  from={{ opacity: 0, translateY: -6 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 240 }}
                  className="px-5 pb-4"
                >
                  <Text className="font-sans text-slate-500" style={{ fontSize: 13.5, lineHeight: 21 }}>
                    {t(`site.faq.a${n}`)}
                  </Text>
                </MotiView>
              ) : null}
            </View>
          )
        })}
      </View>
    </Section>
  )
}

/* --------------------------------- CTASection --------------------------------- */
export function CTASection({ onPrimary, onSecondary }) {
  const { t } = useLanguage()
  return (
    <Section className="bg-brand-900">
      <Reveal>
        <Eyebrow dark>{t('site.cta.badge')}</Eyebrow>
      </Reveal>
      <Reveal delay={80}>
        <Text
          className="mt-4 font-display text-white"
          style={{ fontSize: TYPE.sectionTitle, lineHeight: TYPE.sectionTitle * 1.14, letterSpacing: -0.9 }}
        >
          {t('site.cta.title')}
        </Text>
      </Reveal>
      <Reveal delay={140}>
        <Text className="mt-3 font-sans text-brand-200" style={{ fontSize: 15, lineHeight: 23 }}>
          {t('site.cta.sub')}
        </Text>
      </Reveal>
      <Reveal delay={200}>
        <View className="mt-6" style={{ gap: 12 }}>
          <PrimaryButton
            label={t('site.nav.signup')}
            onPress={onPrimary}
            icon={<ArrowRight size={16} color="#ffffff" />}
            full
          />
          <GhostButton label={t('site.hero.cta.estimate')} onPress={onSecondary} full />
        </View>
      </Reveal>
    </Section>
  )
}

/* ----------------------------------- Footer ----------------------------------- */
export function Footer() {
  const { t } = useLanguage()
  const { gutter } = useResponsive()
  return (
    <View className="bg-brand-950 py-10">
      <ContentWrap>
        <View style={{ paddingHorizontal: gutter }}>
          <Text className="font-display text-white" style={{ fontSize: 20, letterSpacing: -0.6 }}>
            OctaBuild
          </Text>
          <Text className="mt-2 font-sans text-brand-300" style={{ fontSize: 13, lineHeight: 20 }}>
            {t('site.footer.tagline')}
          </Text>
          <View className="mt-6 h-px bg-white/10" />
          <Text className="mt-4 font-sans text-brand-400" style={{ fontSize: 11 }}>
            {t('site.footer.copyright')}
          </Text>
          <Text className="mt-1 font-sans text-brand-400" style={{ fontSize: 11 }}>
            {t('site.footer.built')}
          </Text>
        </View>
      </ContentWrap>
    </View>
  )
}
