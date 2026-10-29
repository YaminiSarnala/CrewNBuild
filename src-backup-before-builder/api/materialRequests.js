import { apiClient } from './client'

export const fetchMyMaterialRequests = async () => (await apiClient.get('/material-requests/mine')).data
export const fetchSupplierMaterialRequests = async () => (await apiClient.get('/supplier/material-requests')).data
export const createMaterialRequest = async (payload) => (await apiClient.post('/material-requests', payload)).data
export const respondMaterialRequest = async (id, action) =>
  (await apiClient.post(`/supplier/material-requests/${id}/respond`, { action })).data
