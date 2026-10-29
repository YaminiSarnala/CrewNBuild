// Friendly display labels for codes stored in the database. The stored values
// (CONTRACTOR / SELF_CONSTRUCTION / OWNER_TO_CONTRACTOR …) are internal API
// contracts; these helpers render them as user-facing names.
//
// As on the web (utils/roleLabels.js), the label follows the selected language:
// a passed `t` is used, otherwise the active language is read directly.
import { translatorFrom } from '../i18n/LanguageContext'

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

// Web translation keys for the labels above.
const CONSTRUCTION_TYPE_LABEL_KEYS = {
  CONTRACTOR: 'role.builder',
  SELF_CONSTRUCTION: 'ui.shared.selfConstruction',
}

const REQUEST_TYPE_LABEL_KEYS = {
  OWNER_TO_CONTRACTOR: 'dash.common.builderRequest',
  CONTRACTOR_TO_OWNER: 'dash.common.builderRequest',
  OWNER_TO_SUPPLIER: 'dash.common.supplierRequest',
  CONTRACTOR_TO_SUPPLIER: 'dash.common.supplierRequest',
  SUPPLIER_TO_OWNER: 'dash.common.supplierRequest',
  SUPPLIER_TO_CONTRACTOR: 'dash.common.supplierRequest',
  SUPPLIER_TO_SUPPLIER: 'dash.common.supplierRequest',
}

export const constructionTypeLabel = (value, t) =>
  (CONSTRUCTION_TYPE_LABEL_KEYS[value] ? translatorFrom(t)(CONSTRUCTION_TYPE_LABEL_KEYS[value]) : CONSTRUCTION_TYPE_LABELS[value]) || value || ''

export const requestTypeLabel = (value, t) =>
  (REQUEST_TYPE_LABEL_KEYS[value] ? translatorFrom(t)(REQUEST_TYPE_LABEL_KEYS[value]) : REQUEST_TYPE_LABELS[value]) || value || ''