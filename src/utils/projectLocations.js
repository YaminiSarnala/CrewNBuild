// Project location configuration for Phase 1 multi-country support.
//
// A project's construction location is chosen independently of the user's
// country of residence. India ships with a state -> city structure; Kuwait
// ships with the governorate -> area structure. The exact Kuwait geographic
// dataset can be expanded in Phase 2.

export const PROJECT_COUNTRIES = [
  { value: 'India', label: 'India', labelKey: 'country.india' },
  { value: 'Kuwait', label: 'Kuwait', labelKey: 'country.kuwait' },
]

// `t` is optional: passing it returns the translated country name for display.
export function countryLabel(value, t) {
  const country = PROJECT_COUNTRIES.find((entry) => entry.value === (value || 'India'))
  if (t && country) return t(country.labelKey)
  return PROJECT_COUNTRIES.find((entry) => entry.value === value)?.label || value || 'India'
}

// India: State -> Cities
export const INDIA_STATES = {
  'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Tirupati', 'Kakinada', 'Rajahmundry'],
  'Arunachal Pradesh': ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro'],
  'Assam': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Tezpur', 'Nagaon'],
  'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Darbhanga', 'Purnia', 'Hajipur'],
  'Chhattisgarh': ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon'],
  'Goa': ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar', 'Junagadh'],
  'Haryana': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal', 'Rohtak', 'Hisar'],
  'Himachal Pradesh': ['Shimla', 'Dharamshala', 'Mandi', 'Solan', 'Palampur', 'Kullu'],
  'Jharkhand': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh', 'Deoghar'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Davanagere', 'Tumakuru', 'Shivamogga'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Kannur', 'Palakkad'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Gwalior', 'Jabalpur', 'Ujjain', 'Sagar', 'Ratlam'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane', 'Solapur', 'Kolhapur', 'Amravati'],
  'Manipur': ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur'],
  'Meghalaya': ['Shillong', 'Tura', 'Jowai', 'Nongstoin'],
  'Mizoram': ['Aizawl', 'Lunglei', 'Champhai', 'Kolasib'],
  'Nagaland': ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri'],
  'Punjab': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Chandigarh'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer', 'Alwar', 'Jaisalmer'],
  'Sikkim': ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Vellore', 'Erode'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam', 'Nalgonda'],
  'Tripura': ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj', 'Meerut', 'Ghaziabad', 'Noida', 'Bareilly', 'Gorakhpur'],
  'Uttarakhand': ['Dehradun', 'Haridwar', 'Rishikesh', 'Nainital', 'Haldwani', 'Roorkee'],
  'West Bengal': ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur', 'Asansol', 'Kharagpur'],
  'Andaman and Nicobar Islands': ['Port Blair'],
  'Chandigarh': ['Chandigarh'],
  'Dadra and Nagar Haveli and Daman and Diu': ['Daman', 'Diu', 'Silvassa'],
  'Delhi': ['New Delhi', 'Delhi', 'Dwarka', 'Rohini', 'Saket'],
  'Jammu and Kashmir': ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla'],
  'Ladakh': ['Leh', 'Kargil'],
  'Lakshadweep': ['Kavaratti'],
  'Puducherry': ['Puducherry', 'Karaikal', 'Yanam', 'Mahe'],
}

// Kuwait: Governorate/Region -> Area/City
export const KUWAIT_GOVERNORATES = {
  'Al Asimah (Kuwait City)': ['Kuwait City', 'Sharq', 'Salmiya', 'Bneid Al-Gar', 'Dasman'],
  'Hawalli': ['Hawalli', 'Salwa', 'Rumaithiya', 'Mishref', 'Bayān'],
  'Farwaniya': ['Farwaniya', 'Jleeb Al-Shuyoukh', 'Khaitan', 'Sabah Al-Nasser', 'Andalus'],
  'Mubarak Al-Kabeer': ['Mubarak Al-Kabeer', 'Sabah Al-Salem', 'Qusour', 'Funaitees', 'Abu Al-Hasaniya'],
  'Al Ahmadi': ['Ahmadi', 'Fahaheel', 'Mangaf', 'Mahboula', 'Abu Halifa'],
  'Al Jahra': ['Jahra', 'Al-Sulaibiya', 'Amghara', 'Al-Naeem', 'Al-Oyoun'],
}

export function projectStateOptions(projectCountry) {
  if (projectCountry === 'Kuwait') return Object.keys(KUWAIT_GOVERNORATES)
  return Object.keys(INDIA_STATES)
}

export function projectCityOptions(projectCountry, projectState) {
  if (projectCountry === 'Kuwait') return KUWAIT_GOVERNORATES[projectState] || []
  return INDIA_STATES[projectState] || []
}

export function projectStateLabel(projectCountry, projectState) {
  if (projectCountry === 'Kuwait') return projectState || ''
  return projectState || ''
}

export function projectLocationSummary(project, t) {
  if (!project) return ''
  const country = project.project_country || 'India'
  const parts = [project.project_city, project.project_state, t ? countryLabel(country, t) : country].filter(Boolean)
  return parts.join(' • ')
}
