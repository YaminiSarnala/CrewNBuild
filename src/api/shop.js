import { apiClient } from './client'

// Products the signed-in buyer may order. A Site Engineer is limited to
// suppliers their builder approved; that rule is applied by the API.
export const fetchShopProducts = async (params = {}) =>
  (await apiClient.get('/shop/products', { params })).data
