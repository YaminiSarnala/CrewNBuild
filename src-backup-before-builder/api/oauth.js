// ---------------------------------------------------------------------------
// Port of the web src/services/oauth.js.
//
// The web version calls window.location.assign(...) and lets the backend
// redirect back to http://localhost:5173/oauth/callback. A mobile app has no
// page to redirect to, so instead we:
//   1. Open the backend's /auth/oauth/{provider}/start URL in a system browser
//      sheet (SFSafariViewController on iOS, Custom Tab on Android).
//   2. Ask the browser to hand control back when it hits our deep link
//      `octabuild://oauth` — the scheme declared in app.json.
//   3. Read the tokens off the returned URL's query string.
//
// >>> BACKEND CHANGE REQUIRED <<<
// The FastAPI callback currently redirects to FRONTEND_ORIGIN. It must also
// accept a `redirect_uri` parameter (or check for a `client=mobile` flag) and
// redirect to `octabuild://oauth?...` instead. See MOBILE-BACKEND-CHANGES.md.
// ---------------------------------------------------------------------------
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { API_BASE_URL } from './client'

WebBrowser.maybeCompleteAuthSession()

export const OAUTH_RETURN_URL = Linking.createURL('oauth')

export function googleOAuthUrl(role = 'OWNER') {
  const redirect = encodeURIComponent(OAUTH_RETURN_URL)
  return `${API_BASE_URL}/auth/oauth/google/start?role=${role}&client=mobile&redirect_uri=${redirect}`
}

export function microsoftOAuthUrl(role = 'OWNER') {
  const redirect = encodeURIComponent(OAUTH_RETURN_URL)
  return `${API_BASE_URL}/auth/oauth/microsoft/start?role=${role}&client=mobile&redirect_uri=${redirect}`
}

/**
 * Opens the provider's consent screen and resolves with the auth payload.
 * @returns {Promise<{user, accessToken, refreshToken} | null>} null if cancelled
 */
async function runOAuthFlow(startUrl) {
  const result = await WebBrowser.openAuthSessionAsync(startUrl, OAUTH_RETURN_URL)

  if (result.type !== 'success' || !result.url) return null

  const { queryParams } = Linking.parse(result.url)
  if (queryParams?.error) {
    throw new Error(String(queryParams.error))
  }

  const accessToken = queryParams?.access_token
  if (!accessToken) return null

  let user = null
  if (queryParams?.user) {
    try {
      user = JSON.parse(decodeURIComponent(String(queryParams.user)))
    } catch {
      user = null
    }
  }

  return {
    user,
    accessToken: String(accessToken),
    refreshToken: queryParams?.refresh_token ? String(queryParams.refresh_token) : null,
  }
}

export function startGoogleOAuth(role = 'OWNER') {
  return runOAuthFlow(googleOAuthUrl(role))
}

export function startMicrosoftOAuth(role = 'OWNER') {
  return runOAuthFlow(microsoftOAuthUrl(role))
}
