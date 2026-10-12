import { apiClient } from './client'

export async function loginUser(credentials) {
  try {
    const response = await apiClient.post('/api/auth/login', {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    });

    console.log('LOGIN STATUS:', response.status);
    console.log('LOGIN RESPONSE:', response.data);

    return response.data;
  } catch (error) {
    console.log('LOGIN ERROR STATUS:', error.response?.status);
    console.log('LOGIN ERROR DATA:', error.response?.data);
    console.log('LOGIN ERROR MESSAGE:', error.message);

    throw error;
  }
}

export async function signupUser(profileDetails) {
  const response = await apiClient.post('/auth/signup', profileDetails)
  return response.data
}

export async function completeUserProfile(profileDetails) {
  const response = await apiClient.patch('/auth/complete-profile', profileDetails)
  return response.data
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