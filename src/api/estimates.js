import { apiClient } from './client'

export async function calculatePublicEstimate(payload) {
  return (await apiClient.post('/estimates/calculate', payload)).data
}

export async function saveEstimate(payload) {
  return (await apiClient.post('/estimates', payload)).data
}
