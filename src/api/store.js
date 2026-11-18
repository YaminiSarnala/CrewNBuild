// The Site Engineer's side of the Store (web services/storeManager.js).
import { apiClient } from './client'
import { apiErrorText } from '../utils/builderHelpers'

export const fetchSiteStores = async () => (await apiClient.get('/store/site-stores')).data
export const createSiteRequest = async (payload) => (await apiClient.post('/store/site-requests', payload)).data
export const cancelSiteRequest = async (id) => (await apiClient.post(`/store/site-requests/${id}/cancel`)).data
export const fetchMySiteRequests = async (projectId) =>
  (await apiClient.get('/store/site-requests/mine', { params: projectId ? { project_id: projectId } : {} })).data

// The server's refusal, in the reader's language (web storeUi refusalText).
export const refusalText = (error, td, fallback) => td(apiErrorText(error, fallback))


// Requests between a Builder and a Store Manager on their team, either way round.
// Both sides call the same endpoints; the server works out which side the caller is.
export const fetchStoreBuilderRequests = async () => (await apiClient.get('/store-builder-requests')).data
export const createStoreBuilderRequest = async (payload) => (await apiClient.post('/store-builder-requests', payload)).data
export const respondStoreBuilderRequest = async (id, decision, response) =>
  (await apiClient.post(`/store-builder-requests/${id}/respond`, { decision, response: response || null })).data
export const withdrawStoreBuilderRequest = async (id) => (await apiClient.post(`/store-builder-requests/${id}/withdraw`)).data