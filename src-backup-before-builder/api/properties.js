// Port of web services/properties.js (browse + enquire + own listings).
// Listing management (create/edit/status/images) arrives with Phase 9b.
import { apiClient } from './client'

export async function fetchPropertyListings(filters = {}) {
  const params = {}
  if (filters.search) params.search = filters.search
  if (filters.propertyType) params.property_type = filters.propertyType
  if (filters.city) params.city = filters.city
  if (filters.pincode) params.pincode = filters.pincode
  const response = await apiClient.get('/property-listings', { params })
  return response.data
}

export async function fetchMyPropertyListings() {
  const response = await apiClient.get('/property-listings/mine')
  return response.data
}

/** One listing, in full (gallery included). */
export async function fetchPropertyListing(listingId) {
  const response = await apiClient.get(`/property-listings/${listingId}`)
  return response.data
}

// ---- Seller side (web PropertyBuySellHub "Sell" tab) -------------------------
// The seller is always taken from the token on the server; nothing here sends one.
export async function createPropertyListing(listingDetails) {
  const response = await apiClient.post('/property-listings', listingDetails)
  return response.data
}

export async function updatePropertyListing(listingId, changes) {
  const response = await apiClient.patch(`/property-listings/${listingId}`, changes)
  return response.data
}

/** Publish, withdraw, mark under offer or mark sold. The backend enforces legal moves. */
export async function updatePropertyListingStatus(listingId, status) {
  const response = await apiClient.patch(`/property-listings/${listingId}/status`, { status })
  return response.data
}

/** Replace the gallery with this ordered list of /files/upload URLs. */
export async function updatePropertyListingImages(listingId, imageUrls) {
  const response = await apiClient.put(`/property-listings/${listingId}/images`, { image_urls: imageUrls })
  return response.data
}

export async function deletePropertyListing(listingId) {
  const response = await apiClient.delete(`/property-listings/${listingId}`)
  return response.data
}

export async function sendPropertyRequest(listingId, offerAmount) {
  const response = await apiClient.post(`/property-listings/${listingId}/request`, {
    offer_amount: offerAmount === '' || offerAmount == null ? null : Number(offerAmount),
  })
  return response.data
}