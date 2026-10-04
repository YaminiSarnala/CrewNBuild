import { apiClient } from './client'

export async function lookupPincodeArea(pincode) {
  return (await apiClient.get(`/locations/pincode/${pincode}`)).data
}
