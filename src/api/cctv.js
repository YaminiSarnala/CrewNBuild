// Port of web services/cctv.js. The playback_token is returned once by
// startPlaybackSession — keep it in memory only, never in state/storage/URLs.
import { apiClient } from './client'

export async function fetchProjectCameraSetup(projectId) {
  const response = await apiClient.get(`/cctv/projects/${projectId}/camera-setup`)
  return response.data
}

export async function connectProjectCamera(projectId, { deviceType, host, port, username, password }) {
  const response = await apiClient.post(`/cctv/projects/${projectId}/camera-setup`, {
    device: { device_type: deviceType, host, port: Number(port) },
    credentials: { username, password },
  })
  return response.data
}

export async function fetchProjectCameraDevices(projectId) {
  const response = await apiClient.get(`/cctv/projects/${projectId}/devices`)
  return response.data
}

export async function startPlaybackSession(channelId, { transport = 'LL_HLS', streamVariant } = {}) {
  const body = { transport }
  if (streamVariant) body.stream_variant = streamVariant
  const response = await apiClient.post(`/cctv/channels/${channelId}/playback`, body)
  return response.data
}

export async function renewPlaybackSession(sessionId) {
  const response = await apiClient.post(`/cctv/playback/${sessionId}/renew`)
  return response.data
}

export async function endPlaybackSession(sessionId) {
  const response = await apiClient.delete(`/cctv/playback/${sessionId}`)
  return response.data
}

// Recorded playback (used by Phase 4b's recorded-playback screen)
export async function searchRecordings(channelId, { start, end }) {
  const response = await apiClient.post(`/cctv/channels/${channelId}/recordings/search`, { start, end })
  return response.data
}

export async function startRecordedPlayback(channelId, { start, end, speed = '1', streamVariant = 'MAIN' }) {
  const response = await apiClient.post(`/cctv/channels/${channelId}/recordings/playback`, {
    start, end, speed, stream_variant: streamVariant, transport: 'LL_HLS',
  })
  return response.data
}