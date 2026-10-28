// Which parts of the app are live. Homeowner is finished and Builder is being
// built by the team, so both stay open; Supplier and Site Engineer (and the
// owner features that depend on them) show "Coming soon" until they are ready.
// Flip a flag to open a module — nothing else needs to change.

/** Roles that get their real dashboard. Others land on the Coming soon screen. */
export const LIVE_ROLES = ['OWNER', 'CONTRACTOR']

export const isRoleLive = (role) => LIVE_ROLES.includes(String(role || '').toUpperCase())

/** Owner-side features that lead into an unfinished module. true = Coming soon. */
export const COMING_SOON = {
  marketplace: true, // construction materials from suppliers (Buy & Sell, Order, Suppliers tab)
  property: true, // property buy & sell
  technician: true, // Book a technician
  siteEngineer: true, // project Site Engineer tab
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
