// Swiggy/Rapido-style bottom tab bar shared by all four roles.
// White floating bar, brand-green active state, safe-area aware.
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLanguage } from '../i18n/LanguageContext'
import { useNotifications } from '../notifications/NotificationsContext'
import { useTheme } from '../theme/ThemeContext'
import { COLORS, SHADOW } from '../theme/tokens'
import { TAB_CONFIGS } from './tabConfigs'

const Tab = createBottomTabNavigator()

function makeRoleTabs(role) {
  const tabs = TAB_CONFIGS[role]
  return function RoleTabsNavigator() {
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
        }}
      >
        {tabs.map(({ name, label, labelKey, badgeSections, icon: Icon, component }) => {
          // Unread notifications for the sections this tab leads to, as the web's nav badges.
          const badge = (badgeSections || []).reduce((total, section) => total + Number(badgeCounts[section] || 0), 0)
          return (
          <Tab.Screen
            key={name}
            name={name}
            component={component}
            options={{
              tabBarLabel: labelKey ? t(labelKey) : label,
              tabBarBadge: badge ? (badge > 9 ? '9+' : badge) : undefined,
              tabBarBadgeStyle: { backgroundColor: '#dc2626', fontSize: 10 },
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
}

export const OwnerTabs = makeRoleTabs('OWNER')
export const ContractorTabs = makeRoleTabs('CONTRACTOR')
export const SupplierTabs = makeRoleTabs('SUPPLIER')
export const EngineerTabs = makeRoleTabs('ENGINEER')