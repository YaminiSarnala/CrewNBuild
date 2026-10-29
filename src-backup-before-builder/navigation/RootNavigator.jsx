// ---------------------------------------------------------------------------
// Port of the web src/app/router/AppRouter.jsx.
//
// The web app used <ProtectedRoute> with three rules, all reproduced here:
//   1. no token       -> /login
//   2. wrong role     -> that role's own dashboard
//   3. profile_complete === false -> /complete-profile
//
// The mobile difference: because SecureStore is async, we hold on a splash
// screen until `hydrated` is true. Without that the app would briefly show the
// landing page to an already-logged-in user on every cold start.
// ---------------------------------------------------------------------------
import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Image } from 'expo-image'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useDispatch, useSelector } from 'react-redux'

import LandingScreen from '../screens/LandingScreen'
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

import { restoreSession, sessionExpired } from '../store/authSlice'
import { onAuthExpired } from '../api/client'

import BuilderSubscriptionScreen from '../screens/contractor/BuilderSubscriptionScreen'
import BuilderPortfolioScreen from '../screens/contractor/BuilderPortfolioScreen'
import BuilderProfileSettingsScreen from '../screens/contractor/BuilderProfileSettingsScreen'

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
    <View className="flex-1 items-center justify-center bg-brand-800">
      <Image source={require('../../assets/logo.png')} style={{ width: 72, height: 80 }} contentFit="contain" />
      <ActivityIndicator color="#c3dccd" style={{ marginTop: 24 }} />
    </View>
  )
}

export default function RootNavigator() {
  const dispatch = useDispatch()
  const { user, accessToken, hydrated } = useSelector((state) => state.auth)

  // Read the stored session once on launch.
  useEffect(() => {
    dispatch(restoreSession())
  }, [dispatch])

  // Replaces the web's window 'gharbano_auth_expired' event listener.
  useEffect(() => onAuthExpired(() => dispatch(sessionExpired())), [dispatch])

  if (!hydrated) return <SplashGate />

  const signedIn = Boolean(accessToken && user)
const needsLocationPincode =
  signedIn &&
  ['OWNER', 'CONTRACTOR', 'SUPPLIER', 'ENGINEER'].includes(user?.role) &&
  String(user?.country_of_residence || 'India').trim().toLowerCase() === 'india' &&
  !String(user?.pincode || '').trim()
    const dashboard = DASHBOARD_BY_ROLE[user?.role] || DASHBOARD_BY_ROLE.OWNER

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {!signedIn ? (
          <>
            {/* Landing is the first screen an unauthenticated user sees. */}
            {/* <Stack.Screen name="Landing" component={LandingScreen} /> */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
                        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Estimate" component={EstimateScreen} />
          </>
        ) : needsLocationPincode ? (
  <>
    <Stack.Screen name="PincodeSetup" component={PincodeSetupScreen} />
    <Stack.Screen name={dashboard.name} component={dashboard.component} />
  </>
) : (
          <>
            <Stack.Screen name={dashboard.name} component={dashboard.component} />
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
            )}x
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
