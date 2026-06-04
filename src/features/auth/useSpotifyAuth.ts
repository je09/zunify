import { useCallback, useEffect, useState } from 'react'
import { clearTokens, getTokenExpiresAt, getValidToken, handleCallback, hasStoredTokens } from './spotifyAuth'

export function useSpotifyAuth() {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (new URLSearchParams(window.location.search).has('code')) {
        try {
          const ok = await handleCallback()
          if (!ok) {
            clearTokens()
            if (!cancelled) setToken(null)
            return
          }
        } catch {
          clearTokens()
          if (!cancelled) setToken(null)
          return
        }
      }

      if (!hasStoredTokens()) return

      const nextToken = await getValidToken()
      if (!cancelled) setToken(nextToken)
    }

    void init()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!token) return
    let active = true

    const refreshAt = getTokenExpiresAt()
    const delay = Math.max(0, (refreshAt ?? Date.now()) - Date.now())
    const id = window.setTimeout(async () => {
      const nextToken = await getValidToken()
      if (active) setToken(hasStoredTokens() ? nextToken : null)
    }, delay)

    return () => {
      active = false
      window.clearTimeout(id)
    }
  }, [token])

  const logout = useCallback(() => {
    clearTokens()
    setToken(null)
  }, [])

  return { token, logout }
}
