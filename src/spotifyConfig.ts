// Credentials stored in localStorage — user enters them in Settings.
// No .env needed.

const CLIENT_ID_KEY = 'sp_client_id'

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

// Always computed — never stored. Must match exactly what's in the Spotify dashboard.
export function getRedirectUri(): string {
  return window.location.origin + '/'
}
