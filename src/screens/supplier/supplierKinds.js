// Port of web pages/auth/supplierProfileKinds.js, the supplier lists of
// pages/auth/profileConstants.js and supplierCategoryMissing from
// pages/auth/profileHelpers.js.
//
// The Supplier Category saved on the account (supplier_profiles.supplier_category)
// decides which supplier this is: Material, Labour or Equipment. Every kind
// writes the same profile columns; only the wording, the "what you supply" list
// and the verification documents change.

export const MATERIAL = 'material'
export const LABOUR = 'labour'
export const EQUIPMENT = 'equipment'

// What kind of supplier this is (stored values, also the onboarding order).
export const supplierTypeOptions = ['Material Supplier', 'Labor Supplier', 'Equipment Supplier']
export const SUPPLIER_CATEGORY_CHOICES = ['Material Supplier', 'Equipment Supplier', 'Labor Supplier']

// The product categories a Material Supplier sells.
export const supplierCategoryOptions = [
  'Cement', 'Iron', 'Sand', 'Bricks', 'Tiles', 'Paint', 'Electrical', 'Plumbing', 'Wood', 'Furnitures', 'Interior',
]

export const businessTypeOptions = [
  'Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Public Limited', 'One Person Company', 'Trust / Society',
]

export const supplierDocumentTypes = [
  'Shop License', 'GST Certificate', 'PAN Card', 'Trade License', 'Material Quality Certificate', 'Insurance Certificate',
]

const KIND_BY_CATEGORY = {
  'material supplier': MATERIAL,
  'labor supplier': LABOUR,
  'labour supplier': LABOUR,
  'equipment supplier': EQUIPMENT,
}

/** The form kind for a saved or chosen Supplier Category; null when there is none yet. */
export function supplierKind(category) {
  return KIND_BY_CATEGORY[String(category || '').trim().toLowerCase()] || null
}

export const SUPPLIER_DOCUMENTS = {
  [MATERIAL]: supplierDocumentTypes,
  [LABOUR]: ['Labour Licence', 'GST Certificate', 'PAN Card', 'Trade License', 'Insurance Certificate'],
  [EQUIPMENT]: ['Shop License', 'GST Certificate', 'PAN Card', 'Trade License', 'Insurance Certificate', 'Equipment Fitness Certificate'],
}

export function supplierDocumentsFor(kind) {
  return SUPPLIER_DOCUMENTS[kind] || []
}

const TEXT_KEYS = {
  [MATERIAL]: {
    storeDetails: 'ps.sup.storeDetails', storeDetailsSub: 'ps.sup.storeDetailsSub',
    storeImage: 'ps.sup.storeImage', storeImageNote: 'ps.sup.storeImageNote',
    profile: 'ps.sup.profile', profileSub: 'ps.sup.profileSub',
    logo: 'ps.sup.storeLogo', logoNote: 'ps.sup.storeLogoNote',
    name: 'ps.sup.storeName', namePlaceholder: 'ps.sup.storeNamePlaceholder',
    about: 'ps.sup.aboutStore', aboutPlaceholder: 'ps.sup.aboutStorePlaceholder',
    locations: 'ps.sup.deliveryLocations', primaryLocation: 'ps.sup.primaryLocation',
    supply: 'ps.sup.productCategories', supplySub: 'ps.sup.productCategoriesSub',
    documentsHint: 'ps.sup.documentsHint',
    valName: 'cp.val.storeName', valAbout: 'cp.val.aboutStore',
    valLocation: 'cp.val.deliveryLocation', valSupply: 'cp.val.productCategory',
  },
  [LABOUR]: {
    storeDetails: 'ps.sup.labour.details', storeDetailsSub: 'ps.sup.labour.detailsSub',
    storeImage: 'ps.sup.labour.image', storeImageNote: 'ps.sup.labour.imageNote',
    profile: 'ps.sup.labour.profile', profileSub: 'ps.sup.labour.profileSub',
    logo: 'ps.sup.labour.logo', logoNote: 'ps.sup.labour.logoNote',
    name: 'ps.sup.labour.name', namePlaceholder: 'ps.sup.labour.namePlaceholder',
    about: 'ps.sup.labour.about', aboutPlaceholder: 'ps.sup.labour.aboutPlaceholder',
    locations: 'ps.sup.labour.locations', primaryLocation: 'ps.sup.labour.primaryLocation',
    supply: 'ps.sup.labour.supply', supplySub: 'ps.sup.labour.supplySub',
    documentsHint: 'ps.sup.labour.documentsHint',
    valName: 'cp.val.labour.name', valAbout: 'cp.val.labour.about',
    valLocation: 'cp.val.labour.location', valSupply: 'cp.val.labour.supply',
  },
  [EQUIPMENT]: {
    storeDetails: 'ps.sup.equipment.details', storeDetailsSub: 'ps.sup.equipment.detailsSub',
    storeImage: 'ps.sup.equipment.image', storeImageNote: 'ps.sup.equipment.imageNote',
    profile: 'ps.sup.equipment.profile', profileSub: 'ps.sup.equipment.profileSub',
    logo: 'ps.sup.equipment.logo', logoNote: 'ps.sup.equipment.logoNote',
    name: 'ps.sup.equipment.name', namePlaceholder: 'ps.sup.equipment.namePlaceholder',
    about: 'ps.sup.equipment.about', aboutPlaceholder: 'ps.sup.equipment.aboutPlaceholder',
    locations: 'ps.sup.equipment.locations', primaryLocation: 'ps.sup.equipment.primaryLocation',
    supply: 'ps.sup.equipment.supply', supplySub: 'ps.sup.equipment.supplySub',
    documentsHint: 'ps.sup.equipment.documentsHint',
    valName: 'cp.val.equipment.name', valAbout: 'cp.val.equipment.about',
    valLocation: 'cp.val.equipment.location', valSupply: 'cp.val.equipment.supply',
  },
}

/** Translation keys for a kind; before a category is chosen, the general (material) wording. */
export function supplierTextKeys(kind) {
  return TEXT_KEYS[kind] || TEXT_KEYS[MATERIAL]
}

const sameValue = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase()

/** Whether `value` is in `list`, ignoring case and surrounding spaces. */
export function includesValue(list, value) {
  return (list || []).some((item) => sameValue(item, value))
}

/** Toggle `value` in `list` (case-insensitive), keeping the saved spelling. */
export function toggleValue(list, value) {
  return includesValue(list, value)
    ? list.filter((item) => !sameValue(item, value))
    : [...list, value]
}

/** A Material Supplier's product categories, plus anything already saved. */
export function materialSupplyOptions(saved = []) {
  const out = []
  for (const value of [...supplierCategoryOptions, ...saved]) {
    const clean = String(value || '').trim()
    if (clean && !includesValue(out, clean)) out.push(clean)
  }
  return out
}

/** A comma list or an array, as trimmed non-empty strings. */
export function listOf(value) {
  return (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(item).trim())
    .filter(Boolean)
}

/** A new supplier still has to choose a Supplier Category (the server says so). */
export function supplierCategoryMissing(user) {
  return user?.role === 'SUPPLIER'
    && Boolean(user?.profile_completion?.missing_fields?.some(({ field }) => field === 'supplier_category'))
}
