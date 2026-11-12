import { apiClient } from './client'

export const fetchSupplierProducts = async () => (await apiClient.get('/supplier-products')).data
export const createSupplierProduct = async (payload) => (await apiClient.post('/supplier-products', payload)).data
export const updateSupplierProduct = async (id, payload) =>
  (await apiClient.patch(`/supplier-products/${id}`, payload)).data
export const updateSupplierProductPrice = async (id, payload) =>
  (await apiClient.patch(`/supplier-products/${id}/price`, payload)).data
export const deleteSupplierProduct = async (id) => (await apiClient.delete(`/supplier-products/${id}`)).data
// Optional bulk pricing of one of the supplier's own listings.
export const fetchBulkPricing = async (id) => (await apiClient.get(`/supplier-products/${id}/bulk-pricing`)).data
export const saveBulkPricing = async (id, tiers) => (await apiClient.put(`/supplier-products/${id}/bulk-pricing`, { tiers })).data
