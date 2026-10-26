/**
 * Live Camera (CCTV) API.
 *
 * Every call goes through apiClient, so the OctaBuild access token is attached
 * and refreshed exactly as for the rest of the app. None of these responses
 * contains a camera address, stream path or credential.
 *
 * A playback session's `playback_token` is returned once, by
 * startPlaybackSession. Callers keep it in memory only: never in React state,
 * Redux, localStorage, sessionStorage, a URL or a log line.
 */
import { apiClient } from './client'

// --- first-time camera setup -------------------------------------------------
//
// A project has one recorder, shared by everyone on it, but each person must
// verify it once before they can watch. These two calls drive that step.
//
// The password is sent in the POST body over the same authenticated channel as
// every other call, and is never placed in a URL, a query string, localStorage,
// sessionStorage or a log line. The caller holds it in component state only and
// drops it as soon as the request resolves.

export async function fetchProjectCameraSetup(projectId) {
  const response = await apiClient.get(`/cctv/projects/${projectId}/camera-setup`)
  return response.data
}

export async function connectProjectCamera(projectId, { deviceType, host, port, rtspPort, username, password }) {
  // `port` is the ONVIF port -- the one verification and channel discovery speak
  // to. `rtspPort` is where the recorder serves the video stream, and it is sent
  // ONLY when the installer typed one: the backend's schema already defaults it
  // to 554, so omitting the field leaves every existing recorder behaving
  // exactly as before rather than being re-declared as 554 by this client.
  const device = { device_type: deviceType, host, port: Number(port) }
  const rtsp = String(rtspPort ?? '').trim()
  if (rtsp) device.rtsp_port = Number(rtsp)
  const response = await apiClient.post(`/cctv/projects/${projectId}/camera-setup`, {
    device,
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

// Recorded playback: search the DVR's own recordings for a channel in a local-time
// window, and open a recorded-playback session. `start`/`end` are local-time ISO
// strings (YYYY-MM-DDTHH:MM:SS). Speed is applied DVR-side; only '1','1.5','2','3'.
export async function searchRecordings(channelId, { start, end }) {
  const response = await apiClient.post(`/cctv/channels/${channelId}/recordings/search`, { start, end })
  return response.data
}

export async function startRecordedPlayback(channelId, { start, end, speed = '1', streamVariant = 'MAIN' }) {
  const body = { start, end, speed, stream_variant: streamVariant, transport: 'LL_HLS' }
  const response = await apiClient.post(`/cctv/channels/${channelId}/recordings/playback`, body)
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
