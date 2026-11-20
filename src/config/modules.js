// Which parts of the app are live. Homeowner, Builder, Supplier (material,
// equipment, labour) and Site Engineer are finished and open in every build.
// Features still in progress show "Coming soon" -- flip a flag to open one.

/** Roles that get their real dashboard. Others land on the Coming soon screen. */
export const LIVE_ROLES = ['OWNER', 'CONTRACTOR', 'ENGINEER']

export const isRoleLive = (role) => LIVE_ROLES.includes(String(role || '').toUpperCase())

/** Supplier kinds (supplierKind: material / labour / equipment) whose dashboard is live. */
export const SUPPLIER_LIVE_KINDS = ['material', 'equipment', 'labour']

/** Whether this account gets its real dashboard (Supplier: by its saved kind). */
export function isAccountLive(user, kind) {
  if (isRoleLive(user?.role || 'OWNER')) return true
  return user?.role === 'SUPPLIER' && SUPPLIER_LIVE_KINDS.includes(kind)
}

/** Whether Sign up offers this role (Supplier once any supplier kind is live). */
export const isSignupRoleOpen = (role) => isRoleLive(role) || (role === 'SUPPLIER' && SUPPLIER_LIVE_KINDS.length > 0)

/** Owner-side features that lead into an unfinished module. true = Coming soon. */
export const COMING_SOON = {
  marketplace: false, // construction materials from suppliers (Buy & Sell, Order, Suppliers tab)
  property: false, // property buy & sell
  technician: true, // Book a technician
  siteEngineer: false, // project Site Engineer tab
}

/** Popup / panel copy per feature (translation keys). */
export const SOON_COPY = {
  marketplace: { titleKey: 'soon.marketplace.title', bodyKey: 'soon.marketplace.body' },
  property: { titleKey: 'soon.property.title', bodyKey: 'soon.property.body' },
  buySell: { titleKey: 'soon.buySell.title', bodyKey: 'soon.buySell.body' },
  technician: { titleKey: 'soon.technician.title', bodyKey: 'soon.technician.body' },
  siteEngineer: { titleKey: 'soon.siteEngineer.title', bodyKey: 'soon.siteEngineer.body' },
  SUPPLIER: { titleKey: 'soon.supplier.title', bodyKey: 'soon.supplier.body' },
  ENGINEER: { titleKey: 'soon.engineer.title', bodyKey: 'soon.engineer.body' },
}
