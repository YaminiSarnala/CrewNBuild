// Per-role bottom-tab definitions, mirroring the web sidebar menus:
//   web contractorConstants.js  -> Contractor tabs
//   web OwnerDashboard menu     -> Owner tabs
//   web supplierConstants.js    -> Supplier tabs
//   web EngineerDashboard menu  -> Engineer tabs
// Max 5 tabs per role (Swiggy / Rapido pattern). Sections that don't fit
// (Escrow, Help & Feedback, Find Clients for supplier) nest inside a tab.
import {
  LayoutDashboard, HardHat, Users, Crosshair, CircleUser,
  House as Home, ShoppingBag, ClipboardList, Package, Truck, Briefcase, PackageSearch,MessageCircle
} from 'lucide-react-native'

import OwnerDashboard from '../screens/owner/OwnerDashboard'
import ContractorDashboard from '../screens/contractor/ContractorDashboard'
import SupplierDashboard from '../screens/supplier/SupplierDashboard'
import EngineerDashboard from '../screens/engineer/EngineerDashboard'
import PlaceholderScreen from '../screens/shared/PlaceholderScreen'
import ContractorProjectsScreen from '../screens/contractor/ContractorProjectsScreen'
import ContractorEngineersScreen from '../screens/contractor/ContractorEngineersScreen'
import ContractorLeadsScreen from '../screens/contractor/ContractorLeadsScreen'
import ContractorRequestsScreen from '../screens/contractor/ContractorRequestsScreen'
import ContractorMoreScreen from '../screens/contractor/ContractorMoreScreen'
import ContractorShopScreen from '../screens/contractor/ContractorShopScreen'
import OwnerProjectsScreen from '../screens/owner/OwnerProjectsScreen'
import OwnerShopScreen from '../screens/owner/OwnerShopScreen'
import SupplierOrdersScreen from '../screens/supplier/SupplierOrdersScreen'
import SupplierRequestsScreen from '../screens/supplier/SupplierRequestsScreen'
import SupplierProductsScreen from '../screens/supplier/SupplierProductsScreen'
import EngineerProjectsScreen from '../screens/engineer/EngineerProjectsScreen'
import EngineerSuppliersScreen from '../screens/engineer/EngineerSuppliersScreen'
import EngineerJobsScreen from '../screens/engineer/EngineerJobsScreen'
import ProfileScreen from '../screens/shared/ProfileScreen'
import MessagesScreen from '../screens/shared/MessagesScreen'

// Until phases 2–5 land, non-Home tabs render a placeholder that names the
// phase which will build it. Swap `component` as each phase completes.
const soon = (title, phase) => (props) => (
  <PlaceholderScreen {...props} title={title} phase={phase} />
)

export const TAB_CONFIGS = {
  OWNER: [
    { name: 'OwnerHomeTab', label: 'Home', labelKey: 'site.nav.home', icon: Home, component: OwnerDashboard },
    { name: 'OwnerProjectsTab', label: 'Projects', labelKey: 'ui.projects', badgeSections: ['projects', 'estimates'], icon: HardHat, component: OwnerProjectsScreen },
    { name: 'OwnerShopTab', label: 'Buy & Sell', labelKey: 'ui.buySell', icon: Truck, component: OwnerShopScreen },
    { name: 'OwnerProfileTab', label: 'Profile', labelKey: 'ui.profile', badgeSections: ['profile'], icon: CircleUser, component: ProfileScreen },
  ],
  CONTRACTOR: [
    // labelKey: translated with the web's keys (mobile.* for app-only labels).
    { name: 'ContractorHomeTab', label: 'Home', labelKey: 'ui.dashboard', icon: LayoutDashboard, component: ContractorDashboard },
    { name: 'ContractorProjectsTab', label: 'Projects', labelKey: 'ui.projects', icon: HardHat, component: ContractorProjectsScreen },
    { name: 'ContractorRequestsTab', label: 'Requests', labelKey: 'ui.requests', icon: ClipboardList, component: ContractorRequestsScreen },
    { name: 'ContractorPartnersTab', label: 'My Partners', labelKey: 'ui.myPartners', icon: Users, component: ContractorEngineersScreen },
    { name: 'ContractorMoreTab', label: 'More', labelKey: 'mobile.tab.more', icon: PackageSearch, component: ContractorMoreScreen },
  ],
  SUPPLIER: [
    { name: 'SupplierHomeTab', label: 'Home', icon: LayoutDashboard, component: SupplierDashboard },
       { name: 'SupplierOrdersTab', label: 'Orders', icon: ShoppingBag, component: SupplierOrdersScreen },
    { name: 'SupplierRequestsTab', label: 'Requests', icon: ClipboardList, component: SupplierRequestsScreen },
    { name: 'SupplierProductsTab', label: 'Products', icon: Package, component: SupplierProductsScreen },
    { name: 'SupplierProfileTab', label: 'Profile', icon: CircleUser, component: ProfileScreen },  ],
  ENGINEER: [
    { name: 'EngineerHomeTab', label: 'Home', icon: LayoutDashboard, component: EngineerDashboard },
        { name: 'EngineerProjectsTab', label: 'Projects', icon: HardHat, component: EngineerProjectsScreen },
    { name: 'EngineerSuppliersTab', label: 'Suppliers', icon: PackageSearch, component: EngineerSuppliersScreen },
    { name: 'EngineerJobsTab', label: 'Jobs', icon: Briefcase, component: EngineerJobsScreen },
    { name: 'EngineerProfileTab', label: 'Profile', icon: CircleUser, component: ProfileScreen },  ],
}