// Engineer categories and the account checks that depend on them (web
// pages/auth/profileConstants.js + profileHelpers.js). The stored value is the
// English category; only what is shown is translated, through the label keys.
export const STORE_MANAGER_CATEGORY = 'Store Manager'

export const ENGINEER_CATEGORY_OPTIONS = [
  'Site Engineer',
  'Soil Engineer',
  'Survey Engineer',
  'Architecture',
  'Structural Engineer',
  'Civil Engineer',
  'Electrical Engineer',
  'Plumbing',
  'Mechanical Engineer',
  'HVAC',
  'Quantity Surveyor',
  'Safety',
  'Construction Safety',
  'Finishing / Painter',
  STORE_MANAGER_CATEGORY,
]

export const ENGINEER_CATEGORY_LABEL_KEYS = {
  'Site Engineer': 'role.engineer',
  'Soil Engineer': 'ui.profile.engCat.soilEngineer',
  'Survey Engineer': 'ui.profile.engCat.surveyEngineer',
  Architecture: 'ui.profile.engCat.architecture',
  'Structural Engineer': 'ui.profile.engCat.structuralEngineer',
  'Civil Engineer': 'ui.profile.engCat.civilEngineer',
  'Electrical Engineer': 'ui.profile.engCat.electricalEngineer',
  Plumbing: 'opt.category.plumbing',
  'Mechanical Engineer': 'ui.profile.engCat.mechanicalEngineer',
  HVAC: 'ui.profile.engCat.hvac',
  'Quantity Surveyor': 'ui.profile.engCat.quantitySurveyor',
  Safety: 'opt.category.safety',
  'Construction Safety': 'ui.profile.engCat.constructionSafety',
  'Finishing / Painter': 'ui.profile.engCat.finishingPainter',
  [STORE_MANAGER_CATEGORY]: 'ui.profile.engCat.storeManager',
}

export function engineerCategoryLabel(category, t, td = (value) => value) {
  const key = ENGINEER_CATEGORY_LABEL_KEYS[category]
  return key ? t(key) : td(category || '')
}

export function isStoreManagerCategory(category) {
  return String(category || '').trim().toLowerCase() === STORE_MANAGER_CATEGORY.toLowerCase()
}

/** An ENGINEER whose category is Store Manager opens the Store Manager dashboard. */
export function isStoreManager(user) {
  return user?.role === 'ENGINEER' && isStoreManagerCategory(user?.engineer_profile?.specialization)
}

/**
 * The categories the profile form offers. A Store Manager keeps their category;
 * an engineer with another saved category cannot switch to Store Manager.
 */
export function engineerCategoryChoices(savedCategory, currentCategory) {
  const saved = String(savedCategory || '').trim()
  if (isStoreManagerCategory(saved)) return [saved]
  const choices = saved ? ENGINEER_CATEGORY_OPTIONS.filter((category) => !isStoreManagerCategory(category)) : ENGINEER_CATEGORY_OPTIONS
  const current = String(currentCategory || '').trim()
  return current && !choices.includes(current) ? [...choices, current] : choices
}

/** A new engineer chooses a category before the pincode step (web engineerCategoryMissing). */
export function engineerCategoryMissing(user) {
  return user?.role === 'ENGINEER'
    && Boolean(user?.profile_completion?.missing_fields?.some(({ field }) => field === 'specialization'))
}

/** The fields the API marks required for this account (web requiredProfileFields). */
export function requiredProfileFields(user) {
  const list = user?.profile_completion?.required_fields
  return new Set(Array.isArray(list) ? list.map((entry) => entry?.field).filter(Boolean) : [])
}