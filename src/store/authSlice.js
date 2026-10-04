// ---------------------------------------------------------------------------
// Port of the web src/redux/authSlice.js.
//
// The one structural change: the web slice reads localStorage SYNCHRONOUSLY at
// module load to seed initialState. SecureStore is async, so instead the slice
// starts empty with `hydrated: false`, and `restoreSession` fills it in on app
// launch. RootNavigator shows the splash until `hydrated` flips true — without
// this the app would flash the landing page before jumping to the dashboard.
// ---------------------------------------------------------------------------
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { loginUser, signupUser, completeUserProfile } from '../api/auth'
import { apiErrorMessage, clearStoredAuth, readStoredAuth, writeStoredAuth } from '../api/client'

export const restoreSession = createAsyncThunk('auth/restoreSession', async () => {
  const stored = await readStoredAuth()
  return stored // may be null
})

export const loginWithCredentials = createAsyncThunk(
  'auth/loginWithCredentials',
  async (credentials, { rejectWithValue }) => {
    try {
      return await loginUser(credentials)
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error, 'Unable to login. Please check your credentials.'))
    }
  },
)

export const signupWithProfile = createAsyncThunk(
  'auth/signupWithProfile',
  async (profileDetails, { rejectWithValue }) => {
    try {
      return await signupUser(profileDetails)
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error, 'Unable to create account. Please check the form.'))
    }
  },
)

export const submitProfileCompletion = createAsyncThunk(
  'auth/submitProfileCompletion',
  async (profileDetails, { rejectWithValue }) => {
    try {
      return await completeUserProfile(profileDetails)
    } catch (error) {
      return rejectWithValue(apiErrorMessage(error, 'Unable to save your profile. Please check the form.'))
    }
  },
)

export const logoutUser = createAsyncThunk('auth/logoutUser', async () => {
  await clearStoredAuth()
})

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  status: 'idle',
  errorMessage: '',
  hydrated: false, // false until SecureStore has been read once
}

// Shared handler for login/signup success — both return the same AuthResponse.
function applyAuthResponse(state, payload) {
  state.status = 'succeeded'
  state.user = payload.user
  state.accessToken = payload.access_token
  state.refreshToken = payload.refresh_token
  state.errorMessage = ''
  // Fire-and-forget persist; the in-memory cache is updated synchronously
  // inside writeStoredAuth so the axios interceptor sees the token immediately.
  writeStoredAuth({
    user: payload.user,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
  })
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthenticatedUser(state, action) {
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
      state.errorMessage = ''
      writeStoredAuth(action.payload)
    },
    // Called by the 401 interceptor listener in App.js
    sessionExpired(state) {
      state.user = null
      state.accessToken = null
      state.refreshToken = null
      state.errorMessage = 'Your session expired. Please sign in again.'
    },
    clearAuthError(state) {
      state.errorMessage = ''
    },
    // Used after PATCH /auth/complete-profile so profile_complete flips locally
    mergeUser(state, action) {
      if (!state.user) return
      state.user = { ...state.user, ...action.payload }
      writeStoredAuth({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      })
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.hydrated = true
        if (action.payload) {
          state.user = action.payload.user
          state.accessToken = action.payload.accessToken
          state.refreshToken = action.payload.refreshToken
        }
      })
      .addCase(restoreSession.rejected, (state) => {
        state.hydrated = true
      })
      .addCase(loginWithCredentials.pending, (state) => {
        state.status = 'loading'
        state.errorMessage = ''
      })
      .addCase(loginWithCredentials.fulfilled, (state, action) => {
        applyAuthResponse(state, action.payload)
      })
      .addCase(loginWithCredentials.rejected, (state, action) => {
        state.status = 'failed'
        state.errorMessage = action.payload || action.error.message
      })
      .addCase(signupWithProfile.pending, (state) => {
        state.status = 'loading'
        state.errorMessage = ''
      })
      .addCase(signupWithProfile.fulfilled, (state, action) => {
        applyAuthResponse(state, action.payload)
      })
      .addCase(signupWithProfile.rejected, (state, action) => {
        state.status = 'failed'
        state.errorMessage = action.payload || action.error.message
      })
      .addCase(submitProfileCompletion.pending, (state) => {
        state.status = 'loading'
        state.errorMessage = ''
      })
      .addCase(submitProfileCompletion.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.user = { ...state.user, ...action.payload }
        writeStoredAuth({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
        })
      })
      .addCase(submitProfileCompletion.rejected, (state, action) => {
        state.status = 'failed'
        state.errorMessage = action.payload || action.error.message
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.accessToken = null
        state.refreshToken = null
        state.status = 'idle'
        state.errorMessage = ''
      })
  },
})

export const { setAuthenticatedUser, sessionExpired, clearAuthError, mergeUser } = authSlice.actions
export default authSlice.reducer
