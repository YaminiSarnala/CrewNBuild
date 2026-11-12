import { apiClient, sessionTokens } from './client'

export async function loginUser(credentials) {
  const response = await apiClient.post('/auth/login', {
    email: credentials.email.trim().toLowerCase(),
    password: credentials.password,
  })
  return { ...response.data, ...sessionTokens(response) }
}

export async function signupUser(profileDetails) {
  const response = await apiClient.post('/auth/signup', profileDetails)
  return { ...response.data, ...sessionTokens(response) }
}

export async function completeUserProfile(profileDetails) {
  const response = await apiClient.patch('/auth/complete-profile', profileDetails)
  return response.data
}

// The new supplier's Supplier Category, chosen once. The account comes from the session.
export async function saveSupplierCategory(category) {
  const response = await apiClient.patch('/auth/supplier-category', { supplier_category: category })
  return response.data
}

// The signed-in account as the server has it now.
export async function fetchSessionUser() {
  const response = await apiClient.get('/auth/session')
  return response.data?.user || response.data
}

export async function updateUserProfileImage(profileImageUrl) {
  const response = await apiClient.patch('/auth/profile-image', { profile_image_url: profileImageUrl })
  return response.data
}

export async function updateBusinessLogo(logoUrl) {
  const response = await apiClient.patch('/auth/business-logo', { logo_url: logoUrl })
  return response.data
}


// Port of web services/auth.js updateProfileImage — sets the account photo.
export async function updateProfileImage(profileImageUrl) {
  const response = await apiClient.patch('/auth/profile-image', { profile_image_url: profileImageUrl })
  return response.data
}
