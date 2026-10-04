import { apiClient } from './client'

export async function fetchIncomingRequests() {
  return (await apiClient.get('/project-requests/incoming')).data
}

export async function sendProjectRequest(requestDetails) {
  return (await apiClient.post('/project-requests/send', requestDetails)).data
}

export async function acceptProjectRequest(requestId, quotationAmount = null) {
  const payload = { request_id: requestId }
  if (quotationAmount !== null && quotationAmount !== '') payload.quotation_amount = Number(quotationAmount)
  return (await apiClient.post('/project-requests/accept', payload)).data
}

export async function rejectProjectRequest(requestId) {
  return (await apiClient.post('/project-requests/reject', { request_id: requestId })).data
}

export async function assignProjectToContractor(requestId) {
  return (await apiClient.post('/project-requests/assign', { request_id: requestId })).data
}

export async function confirmProjectAssignment(requestId) {
  return (await apiClient.post('/project-requests/confirm-assignment', { request_id: requestId })).data
}
