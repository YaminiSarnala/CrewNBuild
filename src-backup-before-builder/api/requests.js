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

// ---- Builder parity with web services/requests.js --------------------------
// The sender takes back their own pending request; it stays as history, as `withdrawn`.
export async function withdrawProjectRequest(requestId) {
  return (await apiClient.post('/project-requests/withdraw', { request_id: requestId })).data
}

// The builder assignment, its negotiation and the contract confirmation.
// `requestId` narrows the lookup to the award made on that quotation.
export async function fetchProjectAward(projectId, requestId = null) {
  const params = requestId ? { request_id: requestId } : {}
  return (await apiClient.get(`/projects/${projectId}/award`, { params })).data
}

// `amount` is the amount the user saw; the server answers 409 if it changed.
export async function confirmAwardContract(awardId, amount) {
  return (await apiClient.post(`/awards/${awardId}/confirm`, { amount })).data
}

export async function declineAward(awardId) {
  return (await apiClient.post(`/awards/${awardId}/decline`)).data
}

export async function cancelAward(awardId) {
  return (await apiClient.post(`/awards/${awardId}/cancel`)).data
}

export async function submitAwardOffer(awardId, amount, note) {
  return (await apiClient.post(`/awards/${awardId}/offers`, { amount, note: note || null })).data
}

export async function acceptAwardOffer(offerId, amount) {
  return (await apiClient.post(`/award-offers/${offerId}/accept`, { amount })).data
}

export async function rejectAwardOffer(offerId) {
  return (await apiClient.post(`/award-offers/${offerId}/reject`)).data
}