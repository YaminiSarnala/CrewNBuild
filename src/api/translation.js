import { apiClient } from './client'

// Display translation of text people typed -- project descriptions, names,
// company details. The interface's own words come from the key table in
// src/i18n/translations.js and never pass through here.
//
// The backend keeps the stored value untouched and answers with a map of
// source string -> string to display. `configured` is false when no provider
// key is set, which is the signal to stop asking.
export async function translateTexts(texts, target) {
  const { data } = await apiClient.post('/translate', { texts, target })
  return {
    translations: data?.translations || {},
    configured: data?.configured !== false,
  }
}

// The backend refuses more than this in one request.
export const MAX_TEXTS_PER_REQUEST = 100
