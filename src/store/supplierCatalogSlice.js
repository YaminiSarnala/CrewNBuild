// The signed-in supplier's OWN catalog (web redux/supplierCatalogSlice.js):
// their listings, the storefront filters over them, and the buyer-preview
// basket. Shared by the Products tab and the product / editor / Add Product
// screens pushed on the root stack.
//
// Only what GET /supplier-products returned for this supplier lives here --
// never a master-catalog product on its own.
import { useCallback } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import { createSlice } from '@reduxjs/toolkit'
import { logoutUser, sessionExpired } from './authSlice'

export const EMPTY_STORE_FILTERS = {
  // Catalog category / subcategory ids ('' = all).
  storeCategory: '',
  storeSubcategory: '',
  search: '',
  brand: '',
  // '' | 'in' | 'low' | 'out'
  availability: '',
  // '' | 'Published' | 'Unpublished'
  status: '',
  priceMin: '',
  priceMax: '',
  // '' = newest first (the server's order).
  sort: '',
}

const initialState = {
  products: [],
  // 'idle' until the first load; then 'ready' or 'error'.
  status: 'idle',
  filters: EMPTY_STORE_FILTERS,
  // { listingId: quantity } -- a preview only; suppliers cannot use the real cart.
  previewCart: {},
  // The last "added" / "updated" / "deleted" line, shown above the list.
  notice: null,
}

const supplierCatalogSlice = createSlice({
  name: 'supplierCatalog',
  initialState,
  reducers: {
    setSupplierProducts(state, action) {
      state.products = Array.isArray(action.payload) ? action.payload : []
      state.status = 'ready'
    },
    setSupplierProductsFailed(state) {
      state.status = 'error'
    },
    upsertSupplierProduct(state, action) {
      const listing = action.payload
      if (!listing?.id) return
      const index = state.products.findIndex((row) => row.id === listing.id)
      if (index >= 0) state.products[index] = listing
      else state.products.unshift(listing)
    },
    removeSupplierProduct(state, action) {
      state.products = state.products.filter((row) => row.id !== action.payload)
      delete state.previewCart[action.payload]
    },
    setStoreFilter(state, action) {
      const { key, value } = action.payload
      state.filters[key] = value
    },
    clearStoreFilters(state) {
      state.filters = { ...EMPTY_STORE_FILTERS, sort: state.filters.sort }
    },
    setPreviewCartQuantity(state, action) {
      const { id, quantity } = action.payload
      if (quantity > 0) state.previewCart[id] = quantity
      else delete state.previewCart[id]
    },
    clearPreviewCart(state) {
      state.previewCart = {}
    },
    // { tone: 'success' | 'error', text } or null.
    setStoreNotice(state, action) {
      state.notice = action.payload || null
    },
  },
  // A new session never starts with the previous account's listings.
  extraReducers: (builder) => {
    builder
      .addCase(logoutUser.fulfilled, () => initialState)
      .addCase(logoutUser.rejected, () => initialState)
      .addCase(sessionExpired, () => initialState)
  },
})

export const {
  setSupplierProducts,
  setSupplierProductsFailed,
  upsertSupplierProduct,
  removeSupplierProduct,
  setStoreFilter,
  clearStoreFilters,
  setPreviewCartQuantity,
  clearPreviewCart,
  setStoreNotice,
} = supplierCatalogSlice.actions

export const selectSupplierProducts = (state) => state.supplierCatalog.products
export const selectSupplierProductsStatus = (state) => state.supplierCatalog.status
export const selectStoreFilters = (state) => state.supplierCatalog.filters
export const selectPreviewCart = (state) => state.supplierCatalog.previewCart
export const selectStoreNotice = (state) => state.supplierCatalog.notice

/** [value, setValue] over one storefront filter, like useState. */
export function useStoreFilter(key) {
  const dispatch = useDispatch()
  const store = useStore()
  const value = useSelector((state) => state.supplierCatalog.filters[key])
  const setValue = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(store.getState().supplierCatalog.filters[key]) : next
      dispatch(setStoreFilter({ key, value: resolved }))
    },
    [dispatch, store, key],
  )
  return [value, setValue]
}

export default supplierCatalogSlice.reducer
