// ---------------------------------------------------------------------------
// Port of the web src/app/router/AppRouter.jsx.
//
// Rules carried over from the web's <ProtectedRoute>:
//   1. no session -> Login
//   2. a role only ever sees its own dashboard
// An unfinished profile no longer blocks the dashboard (same as the web): the
// actions that need profile data open CompleteProfile themselves through
// useProfileGate and carry on once it is saved.
//
// SecureStore is async, so we hold on a splash screen until `hydrated` is
// true; the stored session is confirmed with /auth/refresh during that time.
// There is no landing page on mobile: signed-out users start at Login.
// ---------------------------------------------------------------------------
import { useEffect, useRef } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native'
import { useTheme } from '../theme/ThemeContext'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useDispatch, useSelector } from 'react-redux'

import EstimateScreen from '../screens/EstimateScreen'
import LoginScreen from '../screens/auth/LoginScreen'
import SignupScreen from '../screens/auth/SignupScreen'
import CompleteProfileScreen from '../screens/auth/CompleteProfileScreen'
import PincodeSetupScreen from '../screens/auth/PincodeSetupScreen'
import { OwnerTabs, ContractorTabs, SupplierTabs, EngineerTabs } from './RoleTabs'
import NotificationsScreen from '../screens/shared/NotificationsScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'
import LiveCameraScreen from '../screens/engineer/LiveCameraScreen'
import MessagesScreen from '../screens/shared/MessagesScreen'
import BookTechnicianScreen from '../screens/shared/BookTechnicianScreen'
import CreateProjectScreen from '../screens/owner/CreateProjectScreen'
import OwnerProjectScreen from '../screens/owner/OwnerProjectScreen'
import BuilderProfileScreen from '../screens/owner/BuilderProfileScreen'
import { NotificationsProvider } from '../notifications/NotificationsContext'
import { ComingSoonProvider, ComingSoonRoleScreen } from '../components/ComingSoon'
import { isRoleLive } from '../config/modules'
import BuilderSubscriptionScreen from '../screens/contractor/BuilderSubscriptionScreen'
import BuilderPortfolioScreen from '../screens/contractor/BuilderPortfolioScreen'
import BuilderProfileSettingsScreen from '../screens/contractor/BuilderProfileSettingsScreen'

import { restoreSession, sessionExpired, setAuthenticatedUser } from '../store/authSlice'
import { onAuthExpired, onAuthRefreshed } from '../api/client'
import { createStyles } from '../theme/createStyles'

const Stack = createNativeStackNavigator()

// Mirrors rolePath() in the web router.
const DASHBOARD_BY_ROLE = {
  OWNER: { name: 'OwnerHome', component: OwnerTabs },
  CONTRACTOR: { name: 'ContractorHome', component: ContractorTabs },
  SUPPLIER: { name: 'SupplierHome', component: SupplierTabs },
  ENGINEER: { name: 'EngineerHome', component: EngineerTabs },
}


function SplashGate() {
  return (
    <View style={styles.view}>
      <Image source={require('../../assets/logo.png')} style={{ width: 72, height: 80 }} contentFit="contain" />
      <ActivityIndicator color="#c3dccd" style={{ marginTop: 24 }} />
    </View>
  )
}

export default function RootNavigator() {
  const dispatch = useDispatch()
  const { user, hydrated } = useSelector((state) => state.auth)
  const { theme, isDark } = useTheme()
  // Screens read COLORS while rendering, so a theme change remounts the
  // navigator (keyed on the theme); the last navigation state is kept and
  // restored, so the person stays on the screen they were on.
  const navigationState = useRef(undefined)

  // Read and confirm the stored session once on launch.
  useEffect(() => {
    dispatch(restoreSession())
  }, [dispatch])

  // Replace the web's 'gharbano_auth_expired' / 'gharbano_auth_refreshed' events.
  useEffect(() => onAuthExpired(() => dispatch(sessionExpired())), [dispatch])
  useEffect(() => onAuthRefreshed((session) => dispatch(setAuthenticatedUser(session))), [dispatch])

  if (!hydrated) return <SplashGate />

  // Signed in = the server confirmed an account (no login token is returned any more).
  const signedIn = Boolean(user)
  // Supplier / Site Engineer are not live yet: one Coming soon screen instead
  // of their unfinished dashboards (src/config/modules.js).
  const dashboard = isRoleLive(user?.role || 'OWNER')
    ? DASHBOARD_BY_ROLE[user?.role] || DASHBOARD_BY_ROLE.OWNER
    : { name: 'ComingSoonRole', component: ComingSoonRoleScreen }

  return (
    <NotificationsProvider signedIn={signedIn}>
    <ComingSoonProvider>
    <NavigationContainer
      key={theme}
      initialState={navigationState.current}
      onStateChange={(state) => { navigationState.current = state }}
      theme={isDark
        ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: '#020617', card: '#0f172a', border: '#1e293b' } }
        : DefaultTheme}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!signedIn ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Estimate" component={EstimateScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name={dashboard.name} component={dashboard.component} />
            <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
            <Stack.Screen name="CreateProject" component={CreateProjectScreen} />
            <Stack.Screen name="OwnerProject" component={OwnerProjectScreen} />
            <Stack.Screen name="BuilderProfile" component={BuilderProfileScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="LiveCamera" component={LiveCameraScreen} />
            <Stack.Screen name="Messages" component={MessagesScreen} />
            <Stack.Screen name="BookTechnician" component={BookTechnicianScreen} />
            <Stack.Screen name="Estimate" component={EstimateScreen} />
            {/* Builder-only screens (web Plan & billing, Portfolio, Profile Settings). */}
            {user?.role === 'CONTRACTOR' && (
              <>
                <Stack.Screen name="BuilderSubscription" component={BuilderSubscriptionScreen} />
                <Stack.Screen name="BuilderPortfolio" component={BuilderPortfolioScreen} />
                <Stack.Screen name="BuilderProfileSettings" component={BuilderProfileSettingsScreen} />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </ComingSoonProvider>
    </NotificationsProvider>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#134127' },
}))