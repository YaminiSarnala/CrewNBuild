// Partner (technician booking) client. Separate backend (port 8200), separate
// short-lived session: we trade the Octabuild access token for a Partner
// requester token via POST /requester/session — the same exchange the web
// hand-over performs, minus the popup. The requester token lives in memory
// only, exactly like the web keeps it out of storage.
import axios from 'axios'

const PARTNER_BASE_URL = (process.env.EXPO_PUBLIC_PARTNER_API_BASE_URL || 'http://localhost:8200').replace(/\/+$/, '')

const partnerClient = axios.create({ baseURL: PARTNER_BASE_URL, timeout: 20000 })

let requesterToken = null

partnerClient.interceptors.request.use((config) => {
  if (requesterToken) config.headers.Authorization = `Bearer ${requesterToken}`
  return config
})

export const partnerConfigured = Boolean(PARTNER_BASE_URL)

export async function startRequesterSession(octabuildAccessToken) {
  const response = await partnerClient.post('/requester/session', {
    octabuild_access_token: octabuildAccessToken,
  })
  requesterToken = response.data.access_token
  return response.data
}

export function clearRequesterSession() {
  requesterToken = null
}

export async function createBooking({ technicianType, description, serviceLatitude, serviceLongitude, serviceAccuracy }) {
  const response = await partnerClient.post('/requester/bookings', {
    technician_type: technicianType,
    description: description || null,
    service_latitude: serviceLatitude,
    service_longitude: serviceLongitude,
    service_accuracy: serviceAccuracy ?? null,
  })
  return response.data
}

export async function fetchMyBookings() {
  const response = await partnerClient.get('/requester/bookings')
  return response.data
}

export async function cancelBooking(bookingId) {
  const response = await partnerClient.post(`/requester/bookings/${bookingId}/cancel`)
  return response.data
}