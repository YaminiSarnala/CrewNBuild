import { apiClient } from './client'

export async function fetchOwnerProjects() {
  const response = await apiClient.get('/owners/projects')
  return response.data
}

export async function createProjectRequest(projectDetails) {
  if (projectDetails instanceof FormData) {
    const response = await apiClient.post('/projects/create-with-image', projectDetails)
    return response.data
  }
  const response = await apiClient.post('/projects/create', projectDetails)
  return response.data
}

export async function fetchNearbyContractors(pincode, country, projectId) {
  const params = {}
  if (pincode) params.pincode = pincode
  if (country) params.country = country
  if (projectId) params.project_id = projectId
  const response = await apiClient.get('/contractors/nearby', { params })
  return response.data
}

export async function fetchNearbySuppliers(pincode, country, projectId) {
  const params = {}
  if (pincode) params.pincode = pincode
  if (country) params.country = country
  if (projectId) params.project_id = projectId
  const response = await apiClient.get('/suppliers/nearby', { params })
  return response.data
}

export async function fetchNearbyProjects(country) {
  const params = {}
  if (country) params.country = country
  const response = await apiClient.get('/contractors/find-clients', { params })
  return response.data
}

export async function saveTimelineUpdate(projectId, formData) {
  const response = await apiClient.post(`/timelines/create?project_id=${projectId}`, formData)
  return response.data
}

export async function fetchProjectTimelineEntries(projectId) {
  const response = await apiClient.get(`/timelines/project/${projectId}`)
  return response.data
}

export async function fetchProjectDetails(projectId) {
  const response = await apiClient.get(`/projects/${projectId}`)
  return response.data
}

export async function updateProjectProgress(projectId, completionPercentage) {
  const response = await apiClient.patch(`/projects/${projectId}/progress`, { completion_percentage: completionPercentage })
  return response.data
}

export async function updateProjectProgressForDate(projectId, completionPercentage, workDate) {
  const response = await apiClient.patch(`/projects/${projectId}/progress`, { completion_percentage: completionPercentage, work_date: workDate })
  return response.data
}

export async function fetchProjectPhotos(projectId) {
  const response = await apiClient.get(`/projects/${projectId}/photos`)
  return response.data
}

export async function saveDailyWorkflow(projectId, formData) {
  const response = await apiClient.post(`/projects/${projectId}/daily-workflow`, formData)
  return response.data
}

export async function deleteProjectPhoto(photoId) {
  const response = await apiClient.delete(`/project-photos/${photoId}`)
  return response.data
}

export async function deleteOwnerProject(projectId) {
  const response = await apiClient.delete(`/projects/${projectId}`)
  return response.data
}

export async function updateProjectRequirement(projectId, requirementData) {
  const response = await apiClient.patch(`/projects/${projectId}/requirement`, requirementData)
  return response.data
}

export async function fetchSupplierMyProjects() {
  const response = await apiClient.get('/suppliers/my-projects')
  return response.data
}
