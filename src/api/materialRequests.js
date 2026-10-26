import { apiClient } from './client'

export const fetchMyMaterialRequests = async (projectId) => (await apiClient.get('/material-requests/mine', { params: projectId ? { project_id: projectId } : {} })).data
export const fetchSupplierMaterialRequests = async () => (await apiClient.get('/supplier/material-requests')).data
export const createMaterialRequest = async (payload) => (await apiClient.post('/material-requests', payload)).data
export const respondMaterialRequest = async (id, action) => (await apiClient.post(`/supplier/material-requests/${id}/respond`, { action })).data
// Accept or reject a whole purchase request (one Buy) at once.
export const respondPurchaseRequest = async (requestCode, action) => (await apiClient.post(`/supplier/purchase-requests/${requestCode}/respond`, { action })).data
