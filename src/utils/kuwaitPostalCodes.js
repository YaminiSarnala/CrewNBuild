// Kuwait postal codes -> area / governorate.
//
// Kuwait uses a 5-digit "postal number". The dataset below comes from public
// Kuwait postal directories (kwcurves.com postal list, worldpostalcode.com,
// kuwaitexpat.com guide). Entries are [from, to, area, governorate]; the
// Salmiya block range (20000-20013) is the only verified range, everything
// else is an exact code. Governorate names match KUWAIT_GOVERNORATES in
// projectLocations.js so auto-filled values line up with the dropdowns.

export const KUWAIT_POSTAL_AREAS = [
  // [from, to, area, governorate]
  // --- Al Ahmadi ---
  [51215, 51215, 'Al Dhahar', 'Al Ahmadi'],
  [53301, 53301, 'Al Ruqqa', 'Al Ahmadi'],
  [52700, 52700, 'Hadeya', 'Al Ahmadi'],
  [53700, 53700, 'Mangaf', 'Al Ahmadi'],
  [54600, 54600, 'Abu Halifa', 'Al Ahmadi'],
  [50000, 50000, 'Fintas', 'Al Ahmadi'],
  [54200, 54200, 'Uqaila', 'Al Ahmadi'],
  [55000, 55000, 'Sabahiya', 'Al Ahmadi'],
  [60000, 60000, 'Ahmadi', 'Al Ahmadi'],
  [63000, 63000, 'Fahaheel', 'Al Ahmadi'],
  [65000, 65000, 'Ali Sabah Al-Salem', 'Al Ahmadi'],
  [65200, 65200, 'Mena Abdullah', 'Al Ahmadi'],
  [65300, 65300, 'Shuaiba', 'Al Ahmadi'],
  [66391, 66391, 'Bnaider', 'Al Ahmadi'],
  [65900, 65900, 'Al-Zour', 'Al Ahmadi'],
  [66300, 66300, 'Al-Khiran', 'Al Ahmadi'],
  [54000, 54000, 'Mahboula', 'Al Ahmadi'],
  [65500, 65500, 'Al-Nuwaiseb', 'Al Ahmadi'],
  [65700, 65700, 'Al-Wafra', 'Al Ahmadi'],
  [51600, 51600, 'Jaber Al-Ali', 'Al Ahmadi'],
  // --- Mubarak Al-Kabeer ---
  [44000, 44000, 'Sabah Al-Salem', 'Mubarak Al-Kabeer'],
  [26600, 26600, 'Messila', 'Mubarak Al-Kabeer'],
  [26601, 26601, 'Al-Masayel', 'Mubarak Al-Kabeer'],
  [47000, 47000, 'Al-Adan', 'Mubarak Al-Kabeer'],
  [47020, 47020, 'Al-Qusour', 'Mubarak Al-Kabeer'],
  [47040, 47040, 'Al-Qurain', 'Mubarak Al-Kabeer'],
  [51400, 51400, 'Abu Al-Hasaniya', 'Mubarak Al-Kabeer'],
  [47080, 47080, 'Abu Ftaira', 'Mubarak Al-Kabeer'],
  [46000, 46000, 'Sabhan', 'Mubarak Al-Kabeer'],
  [52400, 52400, 'Al-Funaitees', 'Mubarak Al-Kabeer'],
  [47060, 47060, 'Mubarak Al-Kabeer', 'Mubarak Al-Kabeer'],
  // --- Farwaniya ---
  [83000, 83000, 'Abraq Khaitan', 'Farwaniya'],
  [85400, 85400, 'Ishbiliya', 'Farwaniya'],
  [92000, 92000, 'Andalus', 'Farwaniya'],
  [85600, 85600, 'Jleeb Al-Shuyoukh', 'Farwaniya'],
  [85201, 85201, 'Al-Rabiya', 'Farwaniya'],
  [86000, 86000, 'Al-Rehab', 'Farwaniya'],
  [70070, 70070, 'Al-Rai', 'Farwaniya'],
  [92400, 92400, 'Al-Ardiya', 'Farwaniya'],
  [85001, 85001, 'Al-Omariya', 'Farwaniya'],
  [92201, 92201, 'Al-Ferdous', 'Farwaniya'],
  [85000, 85000, 'Farwaniya', 'Farwaniya'],
  [83001, 83001, 'Khaitan', 'Farwaniya'],
  [92420, 92420, 'Sabah Al-Nasser', 'Farwaniya'],
  [85700, 85700, 'Abdullah Al-Mubarak', 'Farwaniya'],
  // --- Al Jahra ---
  [3600, 3600, 'Al-Sulaibiya', 'Al Jahra'],
  [4000, 4000, 'Al-Sabiya', 'Al Jahra'],
  [3400, 3400, 'Al-Mutlaa', 'Al Jahra'],
  [70031, 70031, 'Al-Naseem', 'Al Jahra'],
  [91100, 91100, 'Saad Al-Abdullah', 'Al Jahra'],
  // --- Al Asimah (Kuwait City) ---
  [36200, 36200, 'Bneid Al-Gar', 'Al Asimah (Kuwait City)'],
  [15400, 15400, 'Dasman', 'Al Asimah (Kuwait City)'],
  [15300, 15300, 'Sharq', 'Al Asimah (Kuwait City)'],
  [15000, 15000, 'Al-Murqab', 'Al Asimah (Kuwait City)'],
  [14000, 14000, 'Al-Qibla', 'Al Asimah (Kuwait City)'],
  [14250, 14250, 'Al-Watya', 'Al Asimah (Kuwait City)'],
  [35000, 35000, 'Dasma', 'Al Asimah (Kuwait City)'],
  [35300, 35300, "De'iya", 'Al Asimah (Kuwait City)'],
  [35500, 35500, 'Al-Mansuriya', 'Al Asimah (Kuwait City)'],
  [72101, 72101, 'Abdullah Al-Salem', 'Al Asimah (Kuwait City)'],
  [72901, 72901, 'Al-Nuzha', 'Al Asimah (Kuwait City)'],
  [72701, 72701, 'Al-Faiha', 'Al Asimah (Kuwait City)'],
  [71501, 71501, 'Al-Shamiya', 'Al Asimah (Kuwait City)'],
  [73300, 73300, 'Al-Rauda', 'Al Asimah (Kuwait City)'],
  [73100, 73100, 'Al-Odeiliya', 'Al Asimah (Kuwait City)'],
  [72301, 72301, 'Al-Khaldiya', 'Al Asimah (Kuwait City)'],
  [71801, 71801, 'Kaifan', 'Al Asimah (Kuwait City)'],
  [35700, 35700, 'Al-Qadsiya', 'Al Asimah (Kuwait City)'],
  [73500, 73500, 'Qurtuba', 'Al Asimah (Kuwait City)'],
  [72501, 72501, 'Al-Yarmouk', 'Al Asimah (Kuwait City)'],
  [70031, 70031, 'Shuwaikh', 'Al Asimah (Kuwait City)'],
  [35001, 35001, 'Al-Doha', 'Al Asimah (Kuwait City)'],
  // --- Hawalli ---
  [20000, 20013, 'Salmiya', 'Hawalli'],
  [25000, 25000, "Bida'a", 'Hawalli'],
  [46300, 46300, 'Jabriya', 'Hawalli'],
  [25400, 25400, 'Rumaithiya', 'Hawalli'],
  [25600, 25600, 'Salwa', 'Hawalli'],
  [40000, 40000, 'Mishref', 'Hawalli'],
  [40006, 40006, 'West Mishref', 'Hawalli'],
  [43600, 43600, 'Bayan', 'Hawalli'],
  [30000, 30000, 'Hawalli', 'Hawalli'],
  [20011, 20011, 'Al-Nuqra', 'Hawalli'],
]

export function lookupKuwaitPostalArea(postalCode) {
  const code = String(postalCode || '').replace(/\D/g, '')
  if (code.length !== 5) return null
  const numericCode = Number(code)
  // Exact or range match first.
  const match = KUWAIT_POSTAL_AREAS.find(([from, to]) => numericCode >= from && numericCode <= to)
  if (match) {
    const [, , area, governorate] = match
    return {
      pincode: code,
      area,
      city: area,
      district: governorate,
      state: governorate,
      country: 'Kuwait',
      display: `${area}, ${governorate}, Kuwait`,
    }
  }
  // Fallback: prefix match (first 2 digits) to resolve the governorate.
  const prefix = code.slice(0, 2)
  const prefixFallback = {
    '15': { area: 'Al Asimah (Kuwait City)', governorate: 'Al Asimah (Kuwait City)' },
    '20': { area: 'Hawalli', governorate: 'Hawalli' },
    '25': { area: 'Hawalli', governorate: 'Hawalli' },
    '30': { area: 'Hawalli', governorate: 'Hawalli' },
    '35': { area: 'Al Asimah (Kuwait City)', governorate: 'Al Asimah (Kuwait City)' },
    '36': { area: 'Al Asimah (Kuwait City)', governorate: 'Al Asimah (Kuwait City)' },
    '40': { area: 'Hawalli', governorate: 'Hawalli' },
    '43': { area: 'Hawalli', governorate: 'Hawalli' },
    '44': { area: 'Mubarak Al-Kabeer', governorate: 'Mubarak Al-Kabeer' },
    '46': { area: 'Mubarak Al-Kabeer', governorate: 'Mubarak Al-Kabeer' },
    '47': { area: 'Mubarak Al-Kabeer', governorate: 'Mubarak Al-Kabeer' },
    '50': { area: 'Al Ahmadi', governorate: 'Al Ahmadi' },
    '51': { area: 'Al Ahmadi', governorate: 'Al Ahmadi' },
    '52': { area: 'Al Ahmadi', governorate: 'Al Ahmadi' },
    '53': { area: 'Al Ahmadi', governorate: 'Al Ahmadi' },
    '54': { area: 'Al Ahmadi', governorate: 'Al Ahmadi' },
    '55': { area: 'Al Ahmadi', governorate: 'Al Ahmadi' },
    '60': { area: 'Al Ahmadi', governorate: 'Al Ahmadi' },
    '63': { area: 'Al Ahmadi', governorate: 'Al Ahmadi' },
    '65': { area: 'Al Ahmadi', governorate: 'Al Ahmadi' },
    '66': { area: 'Al Ahmadi', governorate: 'Al Ahmadi' },
    '70': { area: 'Farwaniya', governorate: 'Farwaniya' },
    '71': { area: 'Al Asimah (Kuwait City)', governorate: 'Al Asimah (Kuwait City)' },
    '72': { area: 'Al Asimah (Kuwait City)', governorate: 'Al Asimah (Kuwait City)' },
    '73': { area: 'Al Asimah (Kuwait City)', governorate: 'Al Asimah (Kuwait City)' },
    '83': { area: 'Farwaniya', governorate: 'Farwaniya' },
    '85': { area: 'Farwaniya', governorate: 'Farwaniya' },
    '86': { area: 'Farwaniya', governorate: 'Farwaniya' },
    '91': { area: 'Al Jahra', governorate: 'Al Jahra' },
    '92': { area: 'Farwaniya', governorate: 'Farwaniya' },
  }
  const fallback = prefixFallback[prefix]
  if (fallback) {
    return {
      pincode: code,
      area: fallback.area,
      city: fallback.area,
      district: fallback.governorate,
      state: fallback.governorate,
      country: 'Kuwait',
      display: `${fallback.area}, ${fallback.governorate}, Kuwait`,
    }
  }
  // No match at all — still return a valid object so the form can proceed.
  return {
    pincode: code,
    area: 'Kuwait',
    city: 'Kuwait',
    district: 'Kuwait',
    state: 'Kuwait',
    country: 'Kuwait',
    display: `Kuwait`,
  }
}
