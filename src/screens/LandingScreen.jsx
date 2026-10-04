// ---------------------------------------------------------------------------
// Port of the web src/pages/site/Home.jsx (OCTABUILD landing).
//
// Section order matches the web exactly:
//   SiteHeader
//   HeroBackdrop [ HeroContent + SolutionBridge + SolutionPanel ]
//   RolesSection
//   HowItWorksSection
//   PlatformSection
//   WorldSection
//   FinalCallToAction
//   SiteFooter
//
// Native differences:
//   - window.scrollY -> the ScrollView's onScroll, which drives the header's
//     collapse and the in-page jumps the nav links used anchors for.
//   - The hero role rotates on a 5.2s timer, as on the web. Any manual choice
//     stops the timer so it cannot fight the visitor.
//   - ConstructionVilla renders through expo-gl. Three.js draws into the GL
//     context expo-gl provides, so the scene code is unchanged.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, View, StatusBar } from 'react-native'
import { useLanguage } from '../landing/useLanguage'
import { SiteHeader } from '../landing/SiteHeader'
import { HeroBackdrop, HeroContent } from '../landing/HeroSection'
import { SolutionBridge, SolutionPanel } from '../landing/SolutionPanel'
import ConstructionVilla from '../landing/ConstructionVilla'
import { RolesSection } from '../landing/RolesSection'
import { HowItWorksSection } from '../landing/HowItWorksSection'
import { PlatformSection } from '../landing/PlatformSection'
import { WorldSection } from '../landing/WorldSection'
import { FinalCallToAction } from '../landing/FinalCallToAction'
import { SiteFooter } from '../landing/SiteFooter'
import { roleDestination, roleMeta } from '../landing/content'
import { OC } from '../landing/shared'

const HERO_ROTATION_MS = 5200

export default function LandingScreen({ navigation }) {
  const { language, setLanguage, text, isArabic } = useLanguage()

  const [heroRole, setHeroRole] = useState(0)
  const [activeRole, setActiveRole] = useState(0)
  const [isNight, setIsNight] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const scrollRef = useRef(null)
  const rotationRef = useRef(null)
  // Measured Y offsets, standing in for the web's #roles / #how / #world anchors.
  const sectionOffsets = useRef({ top: 0, roles: 0, how: 0, world: 0 })

  const goSignup = () => navigation.navigate('Signup')
  const goLogin = () => navigation.navigate('Login')

  // Web: the five roles rotate on a timer until the visitor picks one.
  useEffect(() => {
    rotationRef.current = setInterval(() => {
      setHeroRole((current) => (current + 1) % roleMeta.length)
    }, HERO_ROTATION_MS)
    return () => clearInterval(rotationRef.current)
  }, [])

  const selectHeroRole = useCallback((index) => {
    if (rotationRef.current) {
      clearInterval(rotationRef.current)
      rotationRef.current = null
    }
    setHeroRole(index)
  }, [])

  const onScroll = useCallback(
    (event) => {
      const y = event.nativeEvent.contentOffset.y
      const next = y > 40
      if (next !== scrolled) setScrolled(next)
    },
    [scrolled],
  )

  const jumpTo = useCallback((section) => {
    const y = sectionOffsets.current[section] ?? 0
    scrollRef.current?.scrollTo({ y, animated: true })
  }, [])

  const measure = (key) => (event) => {
    sectionOffsets.current[key] = event.nativeEvent.layout.y
  }

  // Each role tile leads to its own sign-up, or the coming-soon screen.
  const openRole = useCallback(
    (key) => {
      const destination = roleDestination(key)
      if (destination.screen === 'Signup') navigation.navigate('Signup', destination.params)
      else goSignup()
    },
    [navigation],
  )

  const toggleLanguage = () => setLanguage(isArabic ? 'en' : 'ar')

  // SolutionPanel reads its two actions off the copy object, so they are
  // attached here rather than threaded through as extra props.
  const solutionText = { ...text, onStart: goSignup, onExplore: () => jumpTo('roles') }

  return (
    <View className="flex-1" style={{ backgroundColor: OC.paper }}>
      <StatusBar barStyle="light-content" />

      <SiteHeader
        text={text}
        isArabic={isArabic}
        onToggleLanguage={toggleLanguage}
        scrolled={scrolled}
        onLogin={goLogin}
        onSignup={goSignup}
        onJumpTo={jumpTo}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
      >
        <View onLayout={measure('top')}>
          <HeroBackdrop>
            <HeroContent activeIndex={heroRole} onSelect={selectHeroRole} text={text} />
            <SolutionBridge text={text} />
            <SolutionPanel
              text={solutionText}
              isNight={isNight}
              onModeChange={setIsNight}
              villa={<ConstructionVilla isNight={isNight} onModeChange={setIsNight} />}
            />
          </HeroBackdrop>
        </View>

        <View onLayout={measure('roles')}>
          <RolesSection text={text} activeIndex={activeRole} onSelect={setActiveRole} />
        </View>

        <View onLayout={measure('how')}>
          <HowItWorksSection text={text} />
        </View>

        <PlatformSection text={text} />

        <View onLayout={measure('world')}>
          <WorldSection text={text} />
        </View>

        <FinalCallToAction text={text} onStart={goSignup} />

        <SiteFooter
          text={text}
          language={language}
          onSelectLanguage={setLanguage}
          onJumpTo={jumpTo}
          onLogin={goLogin}
          onSignup={goSignup}
          onRole={openRole}
        />
      </ScrollView>
    </View>
  )
}