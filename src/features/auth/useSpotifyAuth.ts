import { useCallback, useEffect, useState } from 'react'
import { clearTokens, getValidToken, handleCallback, hasStoredTokens } from './spotifyAuth'

const TOKEN_REFRESH_MS = 4 * 60 * 1000

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

    const id = window.setInterval(async () => {
      const nextToken = await getValidToken()
      if (active) setToken(hasStoredTokens() ? nextToken : null)
    }, TOKEN_REFRESH_MS)

    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [token])

  const logout = useCallback(() => {
    clearTokens()
    setToken(null)
  }, [])

  return { token, logout }
}
