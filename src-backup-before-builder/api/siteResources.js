// Read-only labour and equipment for a project's site day — the same calls the
// web Site Activity makes for a builder (web services/labor.js and
// services/equipment.js). A builder reads these; only the request's own site
// engineer records attendance or rental hours, so nothing here writes.
import { apiClient } from './client'

export const fetchProjectLaborRequests = async (projectId) =>
  (await apiClient.get(`/projects/${projectId}/labor-requests`)).data

export const fetchLaborDailyRecords = async (requestId) =>
  (await apiClient.get(`/labor-requests/${requestId}/daily-records`)).data

export const fetchProjectEquipmentRequests = async (projectId) =>
  (await apiClient.get(`/projects/${projectId}/equipment-requests`)).data

export const fetchEquipmentUsage = async (requestId) =>
  (await apiClient.get(`/equipment-requests/${requestId}/usage`)).data