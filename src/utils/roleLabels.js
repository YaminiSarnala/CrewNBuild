// Friendly display labels for codes stored in the database. The stored values
// (CONTRACTOR / SELF_CONSTRUCTION / OWNER_TO_CONTRACTOR …) are internal API
// contracts; these helpers render them as user-facing names.

export const CONSTRUCTION_TYPE_LABELS = {
  CONTRACTOR: 'Builder',
  SELF_CONSTRUCTION: 'Self construction',
}

export const REQUEST_TYPE_LABELS = {
  OWNER_TO_CONTRACTOR: 'Builder Request',
  CONTRACTOR_TO_OWNER: 'Builder Request',
  OWNER_TO_SUPPLIER: 'Supplier Request',
  CONTRACTOR_TO_SUPPLIER: 'Supplier Request',
}

export const constructionTypeLabel = (value) => CONSTRUCTION_TYPE_LABELS[value] || value || ''

export const requestTypeLabel = (value) => REQUEST_TYPE_LABELS[value] || value || ''