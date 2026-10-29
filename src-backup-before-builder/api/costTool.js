import { apiClient } from './client'

export async function fetchCostToolSummary(projectId, workDate) {
  return (await apiClient.get(`/cost-tool/projects/${projectId}/summary`, {
    params: workDate ? { work_date: workDate } : {},
  })).data
}

export async function saveDailyCostRegister(registerDetails) {
  return (await apiClient.post('/cost-tool/registers', registerDetails)).data
}

export async function saveCostLabourEntry(registerId, labourDetails) {
  return (await apiClient.post(`/cost-tool/registers/${registerId}/labour`, labourDetails)).data
}

export async function saveCostMaterialUsage(registerId, materialDetails) {
  return (await apiClient.post(`/cost-tool/registers/${registerId}/material-usage`, materialDetails)).data
}

export async function saveCostMaterialPurchase(registerId, purchaseDetails) {
  return (await apiClient.post(`/cost-tool/registers/${registerId}/material-purchases`, purchaseDetails)).data
}

export async function saveCostExpense(registerId, expenseDetails) {
  return (await apiClient.post(`/cost-tool/registers/${registerId}/expenses`, expenseDetails)).data
}

export async function saveCostMachineryUsage(registerId, machineryDetails) {
  return (await apiClient.post(`/cost-tool/registers/${registerId}/machinery`, machineryDetails)).data
}

export async function saveCostPayment(registerId, paymentDetails) {
  return (await apiClient.post(`/cost-tool/registers/${registerId}/payments`, paymentDetails)).data
}

// Contractor material / labour day logs
export async function saveMaterialLog(payload) {
  return (await apiClient.post('/materials/create', payload)).data
}

export async function saveLabourLog(payload) {
  return (await apiClient.post('/labour/create', payload)).data
}
