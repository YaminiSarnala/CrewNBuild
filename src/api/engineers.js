import { apiClient } from './client'

// ---- Contractor side ----
export async function inviteEngineer(payload) {
  const response = await apiClient.post('/engineers/invite', payload)
  return response.data
}

export async function fetchEngineerTeam() {
  const response = await apiClient.get('/engineers/my-team')
  return response.data
}

export async function fetchNearbyEngineers(pincode, country) {
  const params = {}
  if (pincode) params.pincode = pincode
  if (country) params.country = country
  const response = await apiClient.get('/engineers/find', { params })
  return response.data
}

export async function respondEngineerJoinRequest(relationshipId, action) {
  const response = await apiClient.post('/engineers/join-request/respond', { relationship_id: relationshipId, action })
  return response.data
}

export async function assignEngineerToProject(projectId, engineerId) {
  const response = await apiClient.post(`/projects/${projectId}/assign-engineer`, { engineer_id: engineerId })
  return response.data
}

export async function fetchProjectEngineer(projectId) {
  const response = await apiClient.get(`/projects/${projectId}/engineer`)
  return response.data
}

export async function unassignEngineerFromProject(projectId, engineerId) {
  const response = await apiClient.post(`/projects/${projectId}/unassign-engineer`, { engineer_id: engineerId })
  return response.data
}

// ---- Engineer side ----
export async function joinEngineerTeam(inviteCode) {
  const response = await apiClient.post('/engineers/join-team', { invite_code: inviteCode })
  return response.data
}

export async function requestEngineerJoin(contractorId) {
  const response = await apiClient.post('/engineers/request-join', { contractor_id: contractorId })
  return response.data
}

export async function fetchEngineerOpportunities(country) {
  const params = {}
  if (country) params.country = country
  const response = await apiClient.get('/engineers/opportunities', { params })
  return response.data
}

export async function applyEngineerOpportunity(projectId) {
  const response = await apiClient.post(`/engineers/opportunities/${projectId}/apply`)
  return response.data
}
export async function fetchEngineerProjects() {
  const response = await apiClient.get('/engineers/my-projects')
  return response.data
}

// ---- Added in Phase 2: parity with web services/engineers.js ----
export async function revokeEngineerInvitation(invitationId) {
  const response = await apiClient.post('/engineers/invite/revoke', { invitation_id: invitationId })
  return response.data
}

export async function sendContractorEngineerRequest(engineerId, projectId) {
  const payload = { engineer_id: engineerId }
  if (projectId) payload.project_id = projectId
  const response = await apiClient.post('/engineers/send-request', payload)
  return response.data
}

export async function fetchContractorSuppliers() {
  const response = await apiClient.get('/contractors/my-suppliers')
  return response.data
}

export async function fetchProjectSuppliers(projectId) {
  const response = await apiClient.get(`/projects/${projectId}/suppliers`)
  return response.data
}
// --- Contractor v2: supplier↔engineer assignment on a project (web AssignSupplierDrawer) ---
export async function assignSupplierToProject(projectId, supplierId, engineerId) {
  const response = await apiClient.post(`/projects/${projectId}/assign-supplier`, {
    supplier_id: supplierId,
    engineer_id: engineerId,
  })
  return response.data
}

export async function unassignSupplierFromProject(projectId, supplierId, engineerId) {
  const response = await apiClient.post(`/projects/${projectId}/unassign-supplier`, {
    supplier_id: supplierId,
    engineer_id: engineerId,
  })
  return response.data
}