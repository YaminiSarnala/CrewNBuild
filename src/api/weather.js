// Site weather (web services/weather.js). Weather for a site: a project's id, or
// MY_SITE ('me') for the signed-in account's own place. The server holds the
// provider key and every threshold, and answers only for sites the account may read.
import { apiClient } from './client'
import { weatherSiteBase } from '../utils/weatherHelpers'

export const fetchWeatherProjects = async () => (await apiClient.get('/weather/projects')).data
export const fetchCurrentWeather = async (site) => (await apiClient.get(`${weatherSiteBase(site)}/current`)).data
export const fetchHourlyForecast = async (site) => (await apiClient.get(`${weatherSiteBase(site)}/forecast/hourly`)).data
export const fetchDailyForecast = async (site) => (await apiClient.get(`${weatherSiteBase(site)}/forecast/daily`)).data
export const fetchWeatherAlerts = async (site) => (await apiClient.get(`${weatherSiteBase(site)}/alerts`)).data
export const fetchWeatherAlertHistory = async (params) => (await apiClient.get('/weather/alerts/history', { params })).data
export const acknowledgeWeatherAlert = async (alertId) => (await apiClient.post(`/weather/alerts/${alertId}/acknowledge`)).data
export const saveSiteLocation = async (site, payload) => (await apiClient.put(`${weatherSiteBase(site)}/location`, payload)).data
export const searchSiteLocation = async (site, q) => (await apiClient.get(`${weatherSiteBase(site)}/location/search`, { params: q ? { q } : {} })).data

// The header pill: one place's weather ('me', a project id, or the server's
// default when none) and the most serious active alerts across the account's sites.
export const fetchWeatherSummary = async (site = null) => (await apiClient.get('/weather/summary', { params: site ? { site } : {} })).data