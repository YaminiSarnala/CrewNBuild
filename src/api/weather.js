// Site weather API. Weather for a site: a project's id, or 'me' for the
// signed-in account's own place. The server holds the provider key and every
// threshold, and answers only for sites the account may read.
import { apiClient } from './client'

// The API path of a site's weather.
const siteBase = (site) => (String(site) === 'me' ? '/weather/me' : `/weather/projects/${site}`)

export const fetchWeatherProjects = async () => (await apiClient.get('/weather/projects')).data
export const fetchCurrentWeather = async (site) => (await apiClient.get(`${siteBase(site)}/current`)).data
export const fetchHourlyForecast = async (site) => (await apiClient.get(`${siteBase(site)}/forecast/hourly`)).data
export const fetchDailyForecast = async (site) => (await apiClient.get(`${siteBase(site)}/forecast/daily`)).data
export const fetchWeatherAlerts = async (site) => (await apiClient.get(`${siteBase(site)}/alerts`)).data
export const fetchWeatherAlertHistory = async (params) => (await apiClient.get('/weather/alerts/history', { params })).data
export const acknowledgeWeatherAlert = async (alertId) => (await apiClient.post(`/weather/alerts/${alertId}/acknowledge`)).data
export const fetchSiteLocation = async (site) => (await apiClient.get(`${siteBase(site)}/location`)).data
export const saveSiteLocation = async (site, payload) => (await apiClient.put(`${siteBase(site)}/location`, payload)).data
export const searchSiteLocation = async (site, q) => (await apiClient.get(`${siteBase(site)}/location/search`, { params: q ? { q } : {} })).data
export const fetchWeatherSummary = async (site = null) => (await apiClient.get('/weather/summary', { params: site ? { site } : {} })).data