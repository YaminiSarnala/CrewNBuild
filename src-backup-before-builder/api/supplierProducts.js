import { apiClient } from './client'

export const fetchSupplierProducts = async () => (await apiClient.get('/supplier-products')).data
export const createSupplierProduct = async (payload) => (await apiClient.post('/supplier-products', payload)).data
export const updateSupplierProduct = async (id, payload) =>
  (await apiClient.patch(`/supplier-products/${id}`, payload)).data
export const updateSupplierProductPrice = async (id, payload) =>
  (await apiClient.patch(`/supplier-products/${id}/price`, payload)).data
export const deleteSupplierProduct = async (id) => (await apiClient.delete(`/supplier-products/${id}`)).data
