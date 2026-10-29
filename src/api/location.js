import { apiClient } from './client'

export async function lookupPincodeArea(pincode) {
  const response = await apiClient.get(
    `/locations/pincode/${pincode}`
  )
  return response.data
}

export async function updateUserLocation(pincode, branchName) {
  const response = await apiClient.patch('/auth/location', {
    pincode,
    branch_name: branchName,
  })
  return response.data
}