import { apiClient } from './client'

export async function fetchContractorProfile(contractorId) {
  const response = await apiClient.get(`/contractors/${contractorId}/profile`)
  return response.data
}

export async function fetchSupplierProfile(supplierId) {
  const response = await apiClient.get(`/suppliers/${supplierId}/profile`)
  return response.data
}

export async function fetchSupplierClients(country) {
  const params = {}
  if (country) params.country = country
  const response = await apiClient.get('/suppliers/find-clients', { params })
  return response.data
}