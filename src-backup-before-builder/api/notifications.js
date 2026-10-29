import { apiClient } from './client'

export async function fetchNotifications() {
  return (await apiClient.get('/notifications')).data
}

export async function markNotificationsRead() {
  return (await apiClient.post('/notifications/read-all')).data
}

export async function markModuleNotificationsRead(moduleName) {
  return (await apiClient.post('/notifications/read-module', null, { params: { module: moduleName } })).data
}
