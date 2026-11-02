// The profile rules the server applies on PATCH /auth/complete-profile
// (backend app/shared/account/services/profile_service.py profile_field_errors),
// checked on the phone first so each message lands under its own field. The
// server still decides; fieldErrorsFrom() reads its per-field answer.
//
// Messages are the server's own English sentences, which the screens pass
// through `td` like every other server message.

export const isIndia = (country) => String(country || 'India').trim().toLowerCase() === 'india'
export const digitsOf = (value) => String(value ?? '').replace(/\D/g, '')
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/
const WEBSITE_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#].*)?$/i

const listOf = (value) => (Array.isArray(value) ? value : String(value || '').split(','))
  .map((item) => String(item).trim()).filter(Boolean)

// The owner's saved project answers. The server resets any it is not sent (a
// budget to 0, floors to 1), so every owner save carries them back unchanged.
const OWNER_PROFILE_KEYS = [
  'building_type', 'construction_type', 'budget', 'land_area', 'floors', 'floor_type',
  'project_title', 'project_description', 'site_status', 'start_timeline', 'design_status', 'contact_preference',
]

export function ownerProfileFields(ownerProfile) {
  if (!ownerProfile) return {}
  return Object.fromEntries(OWNER_PROFILE_KEYS.filter((key) => ownerProfile[key] != null).map((key) => [key, ownerProfile[key]]))
}

// The fields every account has: name, phone, address and pincode.
export function baseFieldErrors(form, country) {
  const errors = {}
  const india = isIndia(country)
  const name = String(form.name ?? '').trim()
  if (name.length < 2) errors.name = 'Enter a name between 2 and 120 characters.'
  else if (name.length > 120) errors.name = 'Enter a name between 2 and 120 characters.'

  const phoneText = String(form.phone ?? '').trim()
  const phone = digitsOf(phoneText)
  if (!phoneText) errors.phone = 'Phone number is required.'
  else if (india && (/[a-z]/i.test(phoneText) || phone.length !== 10)) errors.phone = 'Enter a valid 10 digit phone number.'
  else if (!india && (phone.length < 8 || phone.length > 15)) errors.phone = 'Enter a valid phone number for your country.'

  const address = String(form.address ?? '').trim()
  if (!address) errors.address = 'Address is required.'
  else if (address.length < 5 || address.length > 500) errors.address = 'Enter a complete address (5 to 500 characters).'

  const pincodeText = String(form.pincode ?? '').trim()
  const pincode = digitsOf(pincodeText)
  if (!pincodeText) errors.pincode = 'Pincode is required.'
  else if (india && (pincode.length !== 6 || /\D/.test(pincodeText))) errors.pincode = 'Enter a valid 6 digit pincode.'
  else if (!india && (pincode.length < 3 || pincode.length > 10)) errors.pincode = 'Enter a valid postal code for your country.'
  return errors
}

// A Builder's settings: the server's required fields plus format checks on the
// optional business identifiers, which the server stores as typed.
export function builderFieldErrors(form, country) {
  const errors = baseFieldErrors(form, country)
  if (!String(form.company_name ?? '').trim()) errors.company_name = 'Company name is required.'
  if (!String(form.license_number ?? '').trim()) errors.license_number = 'License number is required.'
  const years = String(form.experience_years ?? '').trim()
  if (!years) errors.experience_years = 'Experience years must be at least 1.'
  else if (!/^\d+$/.test(years) || Number(years) < 1) errors.experience_years = 'Enter whole years of experience (at least 1).'
  else if (Number(years) > 80) errors.experience_years = 'Enter a realistic number of years.'
  if (!String(form.about ?? '').trim()) errors.about = 'About company is required.'
  if (!listOf(form.service_locations).length) errors.service_locations = 'Add at least one service location.'
  if (!listOf(form.services_offered).length) errors.services_offered = 'Select at least one service offered.'

  const gstin = String(form.gstin ?? '').trim().toUpperCase()
  if (gstin && !GSTIN_PATTERN.test(gstin)) errors.gstin = 'Enter a valid 15 character GSTIN.'
  const pan = String(form.pan ?? '').trim().toUpperCase()
  if (pan && !PAN_PATTERN.test(pan)) errors.pan = 'Enter a valid 10 character PAN (e.g. ABCDE1234F).'
  const website = String(form.website ?? '').trim()
  if (website && !WEBSITE_PATTERN.test(website)) errors.website = 'Enter a valid website address.'
  const year = String(form.registration_year ?? '').trim()
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > new Date().getFullYear())) {
    errors.registration_year = `Enter a year between 1900 and ${new Date().getFullYear()}.`
  }
  return errors
}

// The server's per-field answer: { detail: { message, fields: { phone: '…' } } }.
export function fieldErrorsFrom(error) {
  const fields = error?.response?.data?.detail?.fields
  return fields && typeof fields === 'object' ? fields : {}
}
