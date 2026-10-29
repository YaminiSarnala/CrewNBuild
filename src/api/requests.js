import { apiClient } from './client'

export async function fetchIncomingRequests() {
  const response = await apiClient.get('/project-requests/incoming')
  return response.data
}

export async function sendProjectRequest(requestDetails) {
  const response = await apiClient.post('/project-requests/send', requestDetails)
  return response.data
}

export async function acceptProjectRequest(requestId, quotationAmount = null) {
  const payload = { request_id: requestId }
  if (quotationAmount !== null && quotationAmount !== '') payload.quotation_amount = Number(quotationAmount)
  const response = await apiClient.post('/project-requests/accept', payload)
  return response.data
}

export async function rejectProjectRequest(requestId) {
  const response = await apiClient.post('/project-requests/reject', { request_id: requestId })
  return response.data
}

// The sender takes back their own pending request; it stays as history, as `withdrawn`.
export async function withdrawProjectRequest(requestId) {
  const response = await apiClient.post('/project-requests/withdraw', { request_id: requestId })
  return response.data
}

export async function assignProjectToContractor(requestId) {
  const response = await apiClient.post('/project-requests/assign', { request_id: requestId })
  return response.data
}

// "Negotiate" on a quotation: the assignment and the owner's opening
// counter-offer in one request, so neither is kept without the other.
export async function negotiateQuotation(requestId, amount, note) {
  const response = await apiClient.post('/project-requests/assign', { request_id: requestId, offer_amount: amount, offer_note: note || null })
  return response.data
}

export async function confirmProjectAssignment(requestId) {
  const response = await apiClient.post('/project-requests/confirm-assignment', { request_id: requestId })
  return response.data
}

// The builder assignment, its negotiation and the contract confirmation.
// `requestId` narrows the lookup to the award made on that quotation.
export async function fetchProjectAward(projectId, requestId = null) {
  const params = requestId ? { request_id: requestId } : {}
  const response = await apiClient.get(`/projects/${projectId}/award`, { params })
  return response.data
}

// `amount` is the amount the user saw; the server answers 409 if it changed.
export async function confirmAwardContract(awardId, amount) {
  const response = await apiClient.post(`/awards/${awardId}/confirm`, { amount })
  return response.data
}

export async function declineAward(awardId) {
  const response = await apiClient.post(`/awards/${awardId}/decline`)
  return response.data
}

export async function cancelAward(awardId) {
  const response = await apiClient.post(`/awards/${awardId}/cancel`)
  return response.data
}

export async function submitAwardOffer(awardId, amount, note) {
  const response = await apiClient.post(`/awards/${awardId}/offers`, { amount, note: note || null })
  return response.data
}

export async function acceptAwardOffer(offerId, amount) {
  const response = await apiClient.post(`/award-offers/${offerId}/accept`, { amount })
  return response.data
}

export async function rejectAwardOffer(offerId) {
  const response = await apiClient.post(`/award-offers/${offerId}/reject`)
  return response.data
}