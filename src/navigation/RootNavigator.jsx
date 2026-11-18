// ---------------------------------------------------------------------------
// Port of the web src/app/router/AppRouter.jsx.
//
// Rules carried over from the web's <ProtectedRoute>:
//   1. no session -> Login
//   2. a role only ever sees its own dashboard
//   3. an Indian account without a pincode -> the pincode step first, and only
//      that (the web's postAuthPath / needsLocationPincode). Saving the pincode
//      updates the account, which switches this navigator to the dashboard.
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
import BuilderPortfolioScreen from '../screens/contractor/BuilderPortfolioScreen'
import BuilderSubscriptionScreen from '../screens/contractor/BuilderSubscriptionScreen'
import BuilderProfileSettingsScreen from '../screens/contractor/BuilderProfileSettingsScreen'
import FindClientsScreen from '../screens/contractor/FindClientsScreen'
import EstimateScreen from '../screens/EstimateScreen'
import LoginScreen from '../screens/auth/LoginScreen'
import SignupScreen from '../screens/auth/SignupScreen'
import CompleteProfileScreen from '../screens/auth/CompleteProfileScreen'
import PincodeSetupScreen from '../screens/auth/PincodeSetupScreen'
import SupplierCategoryScreen from '../screens/auth/SupplierCategoryScreen'
import EngineerCategoryScreen from '../screens/auth/EngineerCategoryScreen'
import EngineerSiteLogScreen from '../screens/engineer/EngineerSiteLogScreen'
import EngineerProfileScreen from '../screens/engineer/EngineerProfileScreen'
import EngineerStoreRequestsScreen from '../screens/engineer/EngineerStoreRequestsScreen'
import { engineerCategoryMissing, isStoreManager } from '../utils/engineerProfile'
import SupplierHome from '../screens/supplier/SupplierHome'
import SupplierProfileScreen from '../screens/supplier/SupplierProfileScreen'
import SupplierAddProductScreen from '../screens/supplier/SupplierAddProductScreen'
import SupplierListingScreen from '../screens/supplier/SupplierListingScreen'
import SupplierEditListingScreen from '../screens/supplier/SupplierEditListingScreen'
import SupplierEquipmentItemScreen from '../screens/supplier/SupplierEquipmentItemScreen'
import { EquipmentProvider } from '../screens/supplier/equipment/EquipmentContext'
import { LabourProvider } from '../screens/supplier/labour/LabourContext'
import SupplierLabourServiceScreen from '../screens/supplier/SupplierLabourServiceScreen'
import SupplierFindClientsScreen from '../screens/supplier/SupplierFindClientsScreen'
import SupplierMyProjectsScreen from '../screens/supplier/SupplierMyProjectsScreen'
import { SupplierProvider } from '../screens/supplier/SupplierContext'
import { supplierCategoryMissing } from '../screens/supplier/supplierKinds'
import { OwnerTabs, ContractorTabs, EngineerTabs } from './RoleTabs'
import NotificationsScreen from '../screens/shared/NotificationsScreen'
import WeatherScreen from '../screens/shared/WeatherScreen'
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen'
import LiveCameraScreen from '../screens/engineer/LiveCameraScreen'
import MessagesScreen from '../screens/shared/MessagesScreen'
import WeatherScreen from '../screens/weather/WeatherScreen'
import DeleteAccountScreen from '../screens/shared/DeleteAccountScreen'
import BookTechnicianScreen from '../screens/shared/BookTechnicianScreen'
import CreateProjectScreen from '../screens/owner/CreateProjectScreen'
import OwnerProjectScreen from '../screens/owner/OwnerProjectScreen'
import BuilderProfileScreen from '../screens/owner/BuilderProfileScreen'
import { NotificationsProvider } from '../notifications/NotificationsContext'
import { ComingSoonProvider, ComingSoonRoleScreen } from '../components/ComingSoon'
import { isRoleLive } from '../config/modules'

import { restoreSession, sessionExpired, setAuthenticatedUser } from '../store/authSlice'
import { onAuthExpired, onAuthRefreshed } from '../api/client'
import { createStyles } from '../theme/createStyles'

const Stack = createNativeStackNavigator()

// Mirrors rolePath() in the web router.
const DASHBOARD_BY_ROLE = {
  OWNER: { name: 'OwnerHome', component: OwnerTabs },
  CONTRACTOR: { name: 'ContractorHome', component: ContractorTabs },
  // Material / Labour / Equipment is decided inside, from the supplier profile.
  SUPPLIER: { name: 'SupplierHome', component: SupplierHome },
  ENGINEER: { name: 'EngineerHome', component: EngineerTabs },
}


// The web's needsLocationPincode: India accounts pick their pincode (and post
// office) before any dashboard; other countries have no pincode lookup.
function needsLocationPincode(user) {
  return Boolean(user?.id)
    && Boolean(DASHBOARD_BY_ROLE[user.role])
    && String(user.country_of_residence || 'India').trim().toLowerCase() === 'india'
    && !String(user.pincode || '').trim()
}

function SplashGate() {
  return (
    <View style={styles.view}>
      <Image source={require('../../assets/icon.png')} style={{ width: 80, height: 80 }} contentFit="contain" />
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
  // Site Engineer is not live yet: one Coming soon screen instead of its
  // unfinished dashboard (src/config/modules.js). Supplier decides per kind.
  // A Store Manager (an ENGINEER with that category) has its own dashboard on the
  // web; on the phone it shows Coming soon until that module is built.
  const dashboard = (isRoleLive(user?.role || 'OWNER') && !isStoreManager(user)) || user?.role === 'SUPPLIER'    ? DASHBOARD_BY_ROLE[user?.role] || DASHBOARD_BY_ROLE.OWNER
    : { name: 'ComingSoonRole', component: ComingSoonRoleScreen }

  return (
    <NotificationsProvider signedIn={signedIn}>
    <SupplierProvider>
    <EquipmentProvider>
    <LabourProvider>
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
        ) : engineerCategoryMissing(user) ? (
          // Web: a new engineer chooses a category first (/engineer-category).
          <Stack.Screen name="EngineerCategory" component={EngineerCategoryScreen} />
        ) : supplierCategoryMissing(user) ? (
          // A new supplier chooses a Supplier Category before the pincode step.
          <Stack.Screen name="SupplierCategory" component={SupplierCategoryScreen} />
        ) : needsLocationPincode(user) ? (
          <Stack.Screen name="PincodeSetup" component={PincodeSetupScreen} />
        ) : (
          <>
            <Stack.Screen name={dashboard.name} component={dashboard.component} />
            <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
            <Stack.Screen name="SupplierProfile" component={SupplierProfileScreen} />
            {/* Every role's profile opens the same Delete Account form. */}
                       <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
            {/* Site Engineer screens (web /engineer site log and profile). */}
            {user?.role === 'ENGINEER' && (
              <>
                <Stack.Screen name="EngineerSiteLog" component={EngineerSiteLogScreen} />
                <Stack.Screen name="EngineerProfile" component={EngineerProfileScreen} />
                                <Stack.Screen name="EngineerStoreRequests" component={EngineerStoreRequestsScreen} />
              </>
            )}
            {user?.role === 'SUPPLIER' && (
              <>
                {/* Products: the catalog picker, a listing's page and its editor. */}
                <Stack.Screen name="SupplierAddProduct" component={SupplierAddProductScreen} />
                <Stack.Screen name="SupplierListing" component={SupplierListingScreen} />
                <Stack.Screen name="SupplierEditListing" component={SupplierEditListingScreen} />
                <Stack.Screen name="SupplierEquipmentItem" component={SupplierEquipmentItemScreen} />
                <Stack.Screen name="SupplierLabourService" component={SupplierLabourServiceScreen} />
                {/* Opened from the Dashboard (no More tab). */}
                <Stack.Screen name="SupplierFindClients" component={SupplierFindClientsScreen} />
                <Stack.Screen name="SupplierMyProjects" component={SupplierMyProjectsScreen} />
              </>
            )}
            <Stack.Screen name="CreateProject" component={CreateProjectScreen} />
            <Stack.Screen name="OwnerProject" component={OwnerProjectScreen} />
            <Stack.Screen name="BuilderProfile" component={BuilderProfileScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
                        <Stack.Screen name="Weather" component={WeatherScreen} />
            <Stack.Screen name="LiveCamera" component={LiveCameraScreen} />
            <Stack.Screen name="Messages" component={MessagesScreen} />
            {/* Site Weather, from the header weather button on every dashboard. */}
            <Stack.Screen name="Weather" component={WeatherScreen} />
            <Stack.Screen name="BookTechnician" component={BookTechnicianScreen} />
            
            <Stack.Screen name="Estimate" component={EstimateScreen} />
            {/* Builder-only screens (web Plan & billing, Portfolio, Profile Settings). */}
            {user?.role === 'CONTRACTOR' && (
              <>
                <Stack.Screen name="BuilderSubscription" component={BuilderSubscriptionScreen} />
                <Stack.Screen name="BuilderPortfolio" component={BuilderPortfolioScreen} />
                <Stack.Screen name="BuilderProfileSettings" component={BuilderProfileSettingsScreen} />
                <Stack.Screen name="FindClients" component={FindClientsScreen} />
              </>
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </ComingSoonProvider>
    </LabourProvider>
    </EquipmentProvider>
    </SupplierProvider>
    </NotificationsProvider>
  )
}

const styles = createStyles((c) => ({
  view: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#134127' },
}))