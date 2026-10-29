import { apiClient } from './client'

// Property listings — houses and plots for sale.
//
// One module for both roles. A House Owner and a Builder call exactly these
// endpoints against exactly one backend entity; there is no per-role property
// API and no second property model.
//
// The seller is always taken from the authenticated token on the server, so no
// function here sends a seller id.

/** Published listings any signed-in user may browse. Filters are the ones the backend supports. */
export async function fetchPropertyListings(filters = {}) {
  const params = {}
  if (filters.search) params.search = filters.search
  if (filters.propertyType) params.property_type = filters.propertyType
  if (filters.listingType) params.listing_type = filters.listingType
  if (filters.pincode) params.pincode = filters.pincode
  if (filters.city) params.city = filters.city
  if (filters.minPrice) params.min_price = filters.minPrice
  if (filters.maxPrice) params.max_price = filters.maxPrice
  if (filters.bedrooms) params.bedrooms = filters.bedrooms
  const response = await apiClient.get('/property-listings', { params })
  return response.data
}

/** One listing (gallery included). Seller contact is included only when the backend says it may be. */
export async function fetchPropertyListing(listingId) {
  const response = await apiClient.get(`/property-listings/${listingId}`)
  return response.data
}

/** The signed-in seller's own listings, every status included. */
export async function fetchMyPropertyListings() {
  const response = await apiClient.get('/property-listings/mine')
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
    offer_amount: offerAmount === '' || offerAmount === undefined || offerAmount === null ? null : Number(offerAmount),
  })
  return response.data
}

/** Enquiries on one of the caller's own listings. */
export async function fetchPropertyListingRequests(listingId) {
  const response = await apiClient.get(`/property-listings/${listingId}/requests`)
  return response.data
}