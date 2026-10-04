// Swiggy/Rapido-style bottom tab bar shared by all four roles.
// White floating bar, brand-green active state, safe-area aware.
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Platform } from 'react-native'
import { COLORS, SHADOW } from '../theme/tokens'
import { TAB_CONFIGS } from './tabConfigs'

const Tab = createBottomTabNavigator()

function makeRoleTabs(role) {
  const tabs = TAB_CONFIGS[role]
  return function RoleTabsNavigator() {
    return (
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.brand[700],
          tabBarInactiveTintColor: COLORS.slate[400],
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 0,
            height: Platform.OS === 'ios' ? 86 : 66,
            paddingTop: 8,
            ...SHADOW.card,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '800',
            marginBottom: Platform.OS === 'ios' ? 0 : 10,
          },
        }}
      >
        {tabs.map(({ name, label, icon: Icon, component }) => (
          <Tab.Screen
            key={name}
            name={name}
            component={component}
            options={{
              tabBarLabel: label,
              tabBarIcon: ({ color, focused }) => (
                <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 1.8} />
              ),
            }}
          />
        ))}
      </Tab.Navigator>
    )
  }
}

export const OwnerTabs = makeRoleTabs('OWNER')
export const ContractorTabs = makeRoleTabs('CONTRACTOR')
export const SupplierTabs = makeRoleTabs('SUPPLIER')
export const EngineerTabs = makeRoleTabs('ENGINEER')