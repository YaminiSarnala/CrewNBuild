import { apiClient } from './client'

export async function fetchProjectCameraSetup(projectId) {
  const { data } = await apiClient.get(`/cctv/projects/${projectId}/camera-setup`)
  return data
}

export async function connectProjectCamera(
  projectId,
  { deviceType, host, port, rtspPort, username, password },
) {
  const device = {
    device_type: deviceType,
    host,
    port: Number(port),
  }

  if (String(rtspPort ?? '').trim()) {
    device.rtsp_port = Number(rtspPort)
  }

  const { data } = await apiClient.post(
    `/cctv/projects/${projectId}/camera-setup`,
    {
      device,
      credentials: { username, password },
    },
  )

  return data
}

export async function fetchProjectCameraDevices(projectId) {
  const { data } = await apiClient.get(`/cctv/projects/${projectId}/devices`)
  return data
}

export async function startPlaybackSession(channelId, { transport = 'LL_HLS', streamVariant } = {}) {
  const body = { transport }
  if (streamVariant) body.stream_variant = streamVariant

  const { data } = await apiClient.post(`/cctv/channels/${channelId}/playback`, body)
  return data
}

export async function searchRecordings(channelId, { start, end }) {
  const { data } = await apiClient.post(
    `/cctv/channels/${channelId}/recordings/search`,
    { start, end },
  )
  return data
}

export async function startRecordedPlayback(
  channelId,
  { start, end, speed = '1', streamVariant = 'MAIN' },
) {
  const { data } = await apiClient.post(
    `/cctv/channels/${channelId}/recordings/playback`,
    { start, end, speed, stream_variant: streamVariant, transport: 'LL_HLS' },
  )
  return data
}

export async function renewPlaybackSession(sessionId) {
  const { data } = await apiClient.post(`/cctv/playback/${sessionId}/renew`)
  return data
}

export async function endPlaybackSession(sessionId) {
  const { data } = await apiClient.delete(`/cctv/playback/${sessionId}`)
  return data
}