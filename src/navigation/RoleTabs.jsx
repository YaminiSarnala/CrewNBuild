// Swiggy/Rapido-style bottom tab bar shared by all four roles.
// White floating bar, brand-green active state, safe-area aware.
//
// Builder (CONTRACTOR) only: tab labels follow the selected language (web keys)
// and the tabs carry the web sidebar's badges (BuilderInbox).
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '../i18n/LanguageContext'
import { useNotifications } from '../notifications/NotificationsContext'
import { useTheme } from '../theme/ThemeContext'
import { COLORS, SHADOW } from '../theme/tokens'
import { TAB_CONFIGS } from './tabConfigs'
import { BuilderInboxProvider, useBuilderInbox } from '../components/builder/BuilderInbox'

const Tab = createBottomTabNavigator()

const badgeText = (count) => (count > 0 ? (count > 9 ? '9+' : count) : undefined)

/** The web sidebar badges, per Builder tab. */
function builderBadges(inbox) {
  const counts = inbox.notificationCounts || {}
  return {
    ContractorRequestsTab: badgeText(inbox.unreadRequests),
    ContractorProjectsTab: badgeText(counts.projects || 0),
    ContractorPartnersTab: badgeText(counts.engineers || 0),
    // Find Clients, Messages and the profile live under More.
    ContractorMoreTab: badgeText((inbox.unseenClients || counts.findClients || 0) + (inbox.unreadMessages || 0) + (counts.profile || 0)),
  }
}

function makeRoleTabs(role) {
  const tabs = TAB_CONFIGS[role]

  // `badges` (Builder only) overrides the per-tab notification badge.
  function TabsNavigator({ badges }) {
    // Android draws edge-to-edge, so the bar must clear the system navigation
    // buttons itself; a fixed height would put the tabs underneath them.
    const insets = useSafeAreaInsets()
    const { t } = useLanguage()
    const { badgeCounts } = useNotifications()
    const { isDark } = useTheme()
    const bottom = Math.max(insets.bottom, 8)
    return (
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.brand[700],
          tabBarInactiveTintColor: COLORS.slate[400],
          tabBarStyle: {
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            borderTopWidth: 0,
            height: 58 + bottom,
            paddingTop: 8,
            paddingBottom: bottom,
            ...SHADOW.card,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '800',
          },
          tabBarBadgeStyle: { backgroundColor: '#e11d48', color: '#fff', fontSize: 10, fontWeight: '800' },
        }}
      >
        {tabs.map(({ name, label, labelKey, badgeSections, icon: Icon, component }) => {
          // Unread notifications for the sections this tab leads to, as the web's nav badges.
          const sectionBadge = (badgeSections || []).reduce((total, section) => total + Number(badgeCounts?.[section] || 0), 0)
          const badge = badges ? badges[name] : badgeText(sectionBadge)
          return (
            <Tab.Screen
              key={name}
              name={name}
              component={component}
              options={{
                tabBarLabel: labelKey ? t(labelKey) : label,
                tabBarBadge: badge,
                tabBarIcon: ({ color, focused }) => (
                  <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
                ),
              }}
            />
          )
        })}
      </Tab.Navigator>
    )
  }

  if (role !== 'CONTRACTOR') {
    return function RoleTabsNavigator() {
      return <TabsNavigator />
    }
  }

  function BuilderTabsWithBadges() {
    const inbox = useBuilderInbox()
    return <TabsNavigator badges={builderBadges(inbox)} />
  }
  return function RoleTabsNavigator() {
    return (
      <BuilderInboxProvider>
        <BuilderTabsWithBadges />
      </BuilderInboxProvider>
    )
  }
}

export const OwnerTabs = makeRoleTabs('OWNER')
export const ContractorTabs = makeRoleTabs('CONTRACTOR')
export const SupplierTabs = makeRoleTabs('SUPPLIER')
export const EngineerTabs = makeRoleTabs('ENGINEER')