// Credentials stored in localStorage — user enters them in Settings.
// No .env needed.

const CLIENT_ID_KEY  = 'sp_client_id'
const REDIRECT_KEY   = 'sp_redirect_uri'

export function getClientId(): string {
  return localStorage.getItem(CLIENT_ID_KEY) ?? ''
}

export function setClientId(id: string): void {
  if (id) localStorage.setItem(CLIENT_ID_KEY, id.trim())
  else localStorage.removeItem(CLIENT_ID_KEY)
}

export function hasClientId(): boolean {
  return Boolean(localStorage.getItem(CLIENT_ID_KEY))
}

export function getRedirectUri(): string {
  const stored = localStorage.getItem(REDIRECT_KEY)
  if (stored) return stored
  // Default: current origin (works on localhost; override if using IP/tunnel)
  const { origin, pathname } = window.location
  return origin + (pathname === '/' ? '' : pathname.replace(/\/$/, ''))
}

export function setRedirectUri(uri: string): void {
  if (uri) localStorage.setItem(REDIRECT_KEY, uri.trim())
  else localStorage.removeItem(REDIRECT_KEY)
}
