// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/SiteHeader.jsx.
//
// Reproduced: a solid amber bar across the top; once the visitor scrolls past
// 40px the bar and everything in it fade out and only the logo remains, on its
// own amber badge in the corner. The menu closes itself when that happens.
//
// Native differences:
//   - window.scrollY -> a `scrolled` prop, driven by the page ScrollView's
//     onScroll (native has no window scroll object).
//   - The three nav links are in-page anchors (#roles, #how, #world). A native
//     ScrollView cannot follow an anchor, so they scroll to a measured Y offset
//     supplied by the parent instead.
//   - The web bar shows the links inline at >=701px and collapses them into a
//     sheet below that. A phone is always below it, so only the sheet exists.
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'
import { View, Text, Pressable, Modal } from 'react-native'
import { MotiView } from 'moti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ArrowRight, Globe, Menu, X } from 'lucide-react-native'
import { AmberSurface, Brand, GreenButton, OC, EASE_SOFT, GUTTER } from './shared'

export const HEADER_HEIGHT = 62

export function SiteHeader({
  text,
  isArabic,
  onToggleLanguage,
  scrolled,
  onLogin,
  onSignup,
  onJumpTo,
}) {
  const insets = useSafeAreaInsets()
  const [menuOpen, setMenuOpen] = useState(false)

  // The bar would otherwise leave with the menu still open, and it would be
  // open again on return. Same guard as the web version.
  useEffect(() => {
    if (scrolled) setMenuOpen(false)
  }, [scrolled])

  const jump = (section) => {
    setMenuOpen(false)
    onJumpTo?.(section)
  }

  return (
    <>
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }}
        pointerEvents="box-none"
      >
        {/* The amber bar itself fades out on scroll. */}
        <MotiView
          animate={{ opacity: scrolled ? 0 : 1 }}
          transition={{ type: 'timing', duration: 300, easing: EASE_SOFT }}
          pointerEvents={scrolled ? 'none' : 'auto'}
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        >
          <AmberSurface
            style={{
              paddingTop: insets.top,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(8,62,43,0.16)',
            }}
          >
            <View style={{ height: HEADER_HEIGHT }} />
          </AmberSurface>
          {/* Web: 0 6px 0 #d2911d — the solid lip under the bar. */}
          <View style={{ height: 4, backgroundColor: '#d2911d' }} />
        </MotiView>

        <View
          style={{
            paddingTop: insets.top,
            height: insets.top + HEADER_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: GUTTER,
            gap: 10,
          }}
          pointerEvents="box-none"
        >
          {/* Logo gains its own amber badge once the bar is gone. */}
          {scrolled ? (
            <AmberSurface
              radius={999}
              style={{
                paddingLeft: 14,
                paddingRight: 18,
                paddingVertical: 7,
                borderWidth: 1,
                borderColor: 'rgba(8,62,43,0.16)',
              }}
            >
              <Brand size={30} onPress={() => jump('top')} />
            </AmberSurface>
          ) : (
            <Brand size={38} onPress={() => jump('top')} />
          )}

          <View style={{ flex: 1 }} />

          {/* Language toggle — web: bg-white/[.34] with a deep outline. */}
          <MotiView
            animate={{ opacity: scrolled ? 0 : 1 }}
            transition={{ type: 'timing', duration: 300 }}
            pointerEvents={scrolled ? 'none' : 'auto'}
          >
            <Pressable
              onPress={onToggleLanguage}
              accessibilityRole="button"
              accessibilityLabel={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
              className="flex-row items-center rounded-full active:opacity-70"
              style={{
                gap: 7,
                minHeight: 33,
                paddingHorizontal: 11,
                backgroundColor: 'rgba(255,255,255,0.34)',
                borderWidth: 1,
                borderColor: 'rgba(8,62,43,0.3)',
              }}
            >
              <Globe size={13} color={OC.deep} />
              <Text className="font-sansBold" style={{ fontSize: 10, color: OC.deep }}>
                {isArabic ? 'English' : 'العربية'}
              </Text>
            </Pressable>
          </MotiView>

          {/* Menu button stays interactive after the bar fades, so navigation
              is never unreachable — same guarantee as the web version. */}
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Toggle menu"
            style={{ pointerEvents: 'auto' }}
          >
            {scrolled ? (
              <AmberSurface
                radius={999}
                style={{
                  width: 38,
                  height: 38,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(8,62,43,0.16)',
                }}
              >
                <Menu size={21} color={OC.ink} />
              </AmberSurface>
            ) : (
              <View style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                <Menu size={21} color={OC.ink} />
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Nav sheet — web renders this below the bar on narrow screens. */}
      <Modal visible={menuOpen} animationType="fade" transparent onRequestClose={() => setMenuOpen(false)}>
        <Pressable className="flex-1 bg-black/45" onPress={() => setMenuOpen(false)} />
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            paddingTop: insets.top,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            overflow: 'hidden',
          }}
        >
          <AmberSurface style={{ paddingBottom: 16 }}>
            <View
              style={{
                height: HEADER_HEIGHT,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: GUTTER,
              }}
            >
              <Brand size={38} />
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => setMenuOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
                className="p-2"
              >
                <X size={22} color={OC.ink} />
              </Pressable>
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
              {[
                { key: 'roles', label: text.nav.roles },
                { key: 'how', label: text.nav.how },
                { key: 'world', label: text.nav.world },
              ].map((link, index) => (
                <Pressable
                  key={link.key}
                  onPress={() => jump(link.key)}
                  accessibilityRole="button"
                  style={{
                    paddingVertical: 15,
                    borderBottomWidth: index < 2 ? 1 : 0,
                    borderBottomColor: 'rgba(8,62,43,0.16)',
                  }}
                >
                  <Text className="font-sansBold" style={{ fontSize: 12, color: 'rgba(8,62,43,0.8)' }}>
                    {link.label}
                  </Text>
                </Pressable>
              ))}

              <View className="flex-row items-center" style={{ gap: 10, paddingTop: 16 }}>
                <Pressable
                  onPress={() => {
                    setMenuOpen(false)
                    onLogin?.()
                  }}
                  accessibilityRole="button"
                  className="flex-1 items-center justify-center rounded-full"
                  style={{ minHeight: 42, borderWidth: 1, borderColor: 'rgba(8,62,43,0.35)' }}
                >
                  <Text className="font-sansBold" style={{ fontSize: 11, color: OC.deep }}>
                    {text.nav.signIn}
                  </Text>
                </Pressable>
                <GreenButton
                  label={text.nav.start}
                  onPress={() => {
                    setMenuOpen(false)
                    onSignup?.()
                  }}
                  icon={<ArrowRight size={14} color="#ffffff" />}
                  small
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </AmberSurface>
        </View>
      </Modal>
    </>
  )
}