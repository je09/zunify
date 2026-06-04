import { useEffect } from 'react'
import { useSpotifyAuth } from './features/auth/useSpotifyAuth'
import { AppProviders } from './app/AppProviders'
import { AppShell } from './app/AppShell'

export function App() {
  const { token, logout } = useSpotifyAuth()

  useEffect(() => {
    const lockPortrait = () => {
      const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: 'portrait') => Promise<void> }
      void orientation.lock?.('portrait').catch(() => {})
    }

    lockPortrait()
    document.addEventListener('visibilitychange', lockPortrait)
    return () => document.removeEventListener('visibilitychange', lockPortrait)
  }, [])

  return (
    <AppProviders token={token}>
      <AppShell token={token} onLogout={logout} />
    </AppProviders>
  )
}
