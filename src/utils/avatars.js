// Port of the web components/common/avatars.js: which picture stands for a
// person. Their own uploaded image when there is one, otherwise the local
// avatar for their role (the same files the web serves from /avatars).
import { imageSource } from '../api/client'

const BY_ROLE = {
  OWNER: require('../../assets/octabuild/avatars/owner.webp'),
  CONTRACTOR: require('../../assets/octabuild/avatars/contractor.webp'),
  ENGINEER: require('../../assets/octabuild/avatars/engineer.webp'),
  SUPPLIER: require('../../assets/octabuild/avatars/supplier.webp'),
}

// Where an uploaded picture is found on the objects the API returns, most
// specific first.
const IMAGE_FIELDS = ['profile_image_url', 'profileImageUrl', 'avatar_url', 'avatarUrl', 'profile_logo_url']
// Where that person's role is found on those objects.
const ROLE_FIELDS = ['role', 'profile_role', 'sender_role', 'user_role', 'requester_role', 'type']

export function defaultAvatarFor(role) {
  return BY_ROLE[String(role || '').toUpperCase()] || BY_ROLE.OWNER
}

/** An expo-image source for a stored path, falling back to the role's avatar. */
export function avatarFromPath(path, role) {
  const own = String(path || '').trim()
  return own ? imageSource(own) : defaultAvatarFor(role)
}

/** An expo-image source for a user-like object (request row, profile, member). */
export function userAvatarSource(person, fallbackRole = null) {
  const path = IMAGE_FIELDS.map((field) => person?.[field]).find(Boolean)
  const role = fallbackRole || ROLE_FIELDS.map((field) => person?.[field]).find((value) => BY_ROLE[String(value || '').toUpperCase()])
  return avatarFromPath(path, role)
}
