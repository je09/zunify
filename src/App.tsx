import { useSpotifyAuth } from './features/auth/useSpotifyAuth'
import { AppProviders } from './app/AppProviders'
import { AppShell } from './app/AppShell'

export function App() {
  const { token, logout } = useSpotifyAuth()

  return (
    <AppProviders token={token}>
      <AppShell token={token} onLogout={logout} />
    </AppProviders>
  )
}
