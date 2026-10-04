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

export async function sendPropertyRequest(listingId, offerAmount) {
  const response = await apiClient.post(`/property-listings/${listingId}/request`, {
    offer_amount: offerAmount === '' || offerAmount == null ? null : Number(offerAmount),
  })
  return response.data
}