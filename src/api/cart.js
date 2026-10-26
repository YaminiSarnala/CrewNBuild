import { apiClient } from './client'

// The cart lives on the server so the web app and the mobile app read the same
// basket. Every call returns the whole cart, already grouped by supplier.

export const fetchCart = async (projectId) =>
  (await apiClient.get('/cart', { params: projectId ? { project_id: projectId } : {} })).data
export const addCartItem = async (projectId, productId, quantity) =>
  (await apiClient.post('/cart/items', { project_id: projectId, product_id: productId, quantity })).data
export const updateCartItem = async (itemId, quantity) => (await apiClient.patch(`/cart/items/${itemId}`, { quantity })).data
export const removeCartItem = async (itemId) => (await apiClient.delete(`/cart/items/${itemId}`)).data
export const clearCart = async (projectId) =>
  (await apiClient.delete('/cart', { params: projectId ? { project_id: projectId } : {} })).data
export const checkoutCart = async (projectId, supplierId) =>
  (await apiClient.post('/cart/checkout', { project_id: projectId, supplier_id: supplierId })).data
