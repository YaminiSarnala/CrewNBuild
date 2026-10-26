import { apiClient } from './client'

// The master catalog, read.
//
// Every option in the supplier's cascade comes from one of these calls, which
// is what makes the catalog data-driven: a new seed script run against the
// database shows up in the dropdowns with nothing in this file changing.

export const fetchCatalogCategories = async () => (await apiClient.get('/catalog/categories')).data

export const fetchCatalogSubcategories = async (categoryId) =>
  (await apiClient.get('/catalog/subcategories', { params: { category_id: categoryId } })).data

export const fetchCatalogBrands = async ({ categoryId, subcategoryId } = {}) =>
  (
    await apiClient.get('/catalog/brands', {
      params: { category_id: categoryId, subcategory_id: subcategoryId },
    })
  ).data

export const fetchCatalogProducts = async ({ categoryId, subcategoryId, brandId, search } = {}) =>
  (
    await apiClient.get('/catalog/products', {
      params: {
        category_id: categoryId,
        subcategory_id: subcategoryId,
        brand_id: brandId,
        search: search || undefined,
      },
    })
  ).data

export const fetchCatalogProduct = async (productId) =>
  (await apiClient.get(`/catalog/products/${productId}`)).data

export const fetchCatalogVariants = async (productId) =>
  (await apiClient.get(`/catalog/products/${productId}/variants`)).data

// Plain-words search over the signed-in account's own country's catalog:
// "10kg ultratech cement bag". Best match first; each result carries the
// variant that matched (`matched_variant`) and whether every word matched (`exact`).
export const searchCatalog = async (query, limit = 12) =>
  (await apiClient.get('/catalog/search', { params: { q: query, limit } })).data

// One canonical product with every supplier's price against it.
export const fetchCatalogOffers = async (productId) =>
  (await apiClient.get(`/catalog/products/${productId}/offers`)).data
