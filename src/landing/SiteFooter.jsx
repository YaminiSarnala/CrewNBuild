// ---------------------------------------------------------------------------
// Port of the web src/components/landing/octabuild/SiteFooter.jsx.
//
// Reproduced: the near-black band, the brand block with tagline and three social
// buttons, the Platform / For you / Contact columns, the amber rule, the
// copyright row, the three policy links and the English/العربية switch. The
// equipment role keeps its "coming soon" marker in the For you column.
//
// Native differences:
//   - The web uses a 4-column grid, collapsing to 2. A phone stacks them.
//   - href="#roles" anchors become onJumpTo callbacks; mailto: and tel: links
//     open through Linking.
// ---------------------------------------------------------------------------
import { View, Text, Pressable, Linking } from 'react-native'
import { Clock, Globe, Camera, Briefcase, Mail, MapPin, Phone } from 'lucide-react-native'
import { roleMeta } from './content'
import { Brand, GUTTER, OC } from './shared'

const AMBER_BORDER = 'rgba(244,183,64,0.3)'

function ColumnHeading({ children }) {
  return (
    <Text
      className="font-sansBold uppercase"
      style={{ fontSize: 10, letterSpacing: 1.6, color: OC.amber }}
    >
      {children}
    </Text>
  )
}

function ColumnLink({ label, onPress, suffix }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:opacity-70">
      <Text className="font-sansSemi" style={{ fontSize: 12, lineHeight: 19, color: '#b6bfb8' }}>
        {label}
        {suffix ? (
          <Text
            className="font-sansBold uppercase"
            style={{ fontSize: 9, letterSpacing: 0.9, color: OC.amber }}
          >
            {'  '}
            {suffix}
          </Text>
        ) : null}
      </Text>
    </Pressable>
  )
}

function SocialButton({ icon: Icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center rounded-full active:opacity-70"
      style={{ width: 38, height: 38, borderWidth: 1, borderColor: AMBER_BORDER }}
    >
      <Icon size={17} color={OC.amber} />
    </Pressable>
  )
}

function ContactRow({ icon: Icon, children }) {
  return (
    <View className="flex-row items-start" style={{ gap: 10 }}>
      <Icon size={15} color={OC.amber} style={{ marginTop: 1 }} />
      {children}
    </View>
  )
}

export function SiteFooter({ text, language, onSelectLanguage, onJumpTo, onLogin, onSignup, onRole }) {
  const open = (url) => Linking.openURL(url).catch(() => {})

  return (
    <View style={{ backgroundColor: OC.night, paddingTop: 56, paddingBottom: 22, paddingHorizontal: GUTTER }}>
      {/* Brand */}
      <Brand light size={38} onPress={() => onJumpTo?.('top')} />
      <Text className="mt-5 font-sans" style={{ fontSize: 12, lineHeight: 21, color: '#98a19a' }}>
        {text.footer.tagline}
      </Text>
      <View className="mt-6 flex-row" style={{ gap: 10 }}>
              <SocialButton icon={Camera} label="OCTABUILD on Instagram" onPress={() => open('https://instagram.com')} />
        <SocialButton icon={Briefcase} label="OCTABUILD on LinkedIn" onPress={() => open('https://linkedin.com')} />
        <SocialButton icon={Globe} label="OCTABUILD on Facebook" onPress={() => open('https://facebook.com')} />
      </View>

      {/* Platform */}
      <View className="mt-9">
        <ColumnHeading>{text.footer.platform}</ColumnHeading>
        <View className="mt-5" style={{ gap: 13 }}>
          <ColumnLink label={text.nav.roles} onPress={() => onJumpTo?.('roles')} />
          <ColumnLink label={text.nav.how} onPress={() => onJumpTo?.('how')} />
          <ColumnLink label={text.nav.world} onPress={() => onJumpTo?.('world')} />
          <ColumnLink label={text.nav.start} onPress={onSignup} />
          <ColumnLink label={text.nav.signIn} onPress={onLogin} />
        </View>
      </View>

      {/* For you — each role goes to its own sign-up, or the coming-soon screen. */}
      <View className="mt-9">
        <ColumnHeading>{text.footer.forYou}</ColumnHeading>
        <View className="mt-5" style={{ gap: 13 }}>
          {text.roles.map((role, index) => (
            <ColumnLink
              key={role.title}
              label={role.title}
              suffix={roleMeta[index].comingSoon ? text.comingSoon : null}
              onPress={() => onRole?.(roleMeta[index].key)}
            />
          ))}
        </View>
      </View>

      {/* Contact */}
      <View className="mt-9">
        <ColumnHeading>{text.footer.contact}</ColumnHeading>
        <View className="mt-5" style={{ gap: 13 }}>
          <ContactRow icon={MapPin}>
            <Text className="font-sansSemi" style={{ fontSize: 12, lineHeight: 19, color: '#b6bfb8' }}>
              {text.footer.city}
            </Text>
          </ContactRow>
          <ContactRow icon={Mail}>
            <Pressable onPress={() => open('mailto:hello@octabuild.com.kw')}>
              <Text className="font-sansSemi" style={{ fontSize: 12, color: '#b6bfb8' }}>
                hello@octabuild.com.kw
              </Text>
            </Pressable>
          </ContactRow>
          <ContactRow icon={Phone}>
            <Pressable onPress={() => open('tel:+96522223333')}>
              <Text className="font-sansSemi" style={{ fontSize: 12, color: '#b6bfb8' }}>
                +965 2222 3333
              </Text>
            </Pressable>
          </ContactRow>
          <ContactRow icon={Clock}>
            <Text className="font-sansSemi" style={{ fontSize: 12, lineHeight: 19, color: '#b6bfb8' }}>
              {text.footer.hours}
            </Text>
          </ContactRow>
        </View>
      </View>

      {/* Amber rule */}
      <View style={{ height: 1, marginTop: 38, marginBottom: 18, backgroundColor: 'rgba(244,183,64,0.35)' }} />

      <Text className="font-sans" style={{ fontSize: 11, color: '#7b847d' }}>
        © {new Date().getFullYear()} OCTABUILD. {text.footer.rights}
      </Text>

      <View className="mt-3 flex-row flex-wrap" style={{ gap: 20 }}>
        {[text.footer.privacy, text.footer.terms, text.footer.cookies].map((label) => (
          <Pressable key={label} accessibilityRole="button" className="active:opacity-70">
            <Text className="font-sans" style={{ fontSize: 11, color: '#7b847d' }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Language switch */}
      <View className="mt-3 flex-row items-center" accessibilityLabel={text.footer.language}>
        {[
          { code: 'en', label: 'English' },
          { code: 'ar', label: 'العربية' },
        ].map((option, index) => (
          <View key={option.code} className="flex-row items-center">
            {index > 0 ? (
              <Text style={{ marginHorizontal: 8, color: OC.amber }}>|</Text>
            ) : null}
            <Pressable
              onPress={() => onSelectLanguage?.(option.code)}
              accessibilityRole="button"
              accessibilityState={{ selected: language === option.code }}
            >
              <Text
                className={language === option.code ? 'font-sansBold' : 'font-sansSemi'}
                style={{ fontSize: 11, color: language === option.code ? OC.amber : '#98a19a' }}
              >
                {option.label}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  )
}
