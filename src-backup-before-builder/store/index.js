import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import cartReducer from './cartSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    // Server-owned shopping cart, shared with the web app.
    cart: cartReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // FormData and picker assets are not serialisable; they never live in
      // the store, but thunk args can carry them transiently.
      serializableCheck: false,
    }),
})