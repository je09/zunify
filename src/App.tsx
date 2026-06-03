import { useState, useEffect } from 'react'
import { usePlayback } from './hooks/usePlayback'
import { useTheme, ACCENTS, ThemeMode } from './hooks/useTheme'
import { useSpotifyPlayer } from './useSpotifyPlayer'
import { LibraryProvider, useLibrary } from './LibraryContext'
import {
  startLogin, handleCallback, getValidToken,
  clearTokens, hasStoredTokens,
} from './spotifyAuth'
import { getClientId, setClientId, getRedirectUri } from './spotifyConfig'
import { Album, Playlist, albumQueue, Track } from './data'
import { Hub } from './screens/Hub'
import { Collection } from './screens/Collection'
import { ArtistCard } from './screens/ArtistCard'
import { AlbumDetail } from './screens/AlbumDetail'
import { PlaylistDetail } from './screens/PlaylistDetail'
import { Player } from './screens/Player'

// ── Navigation ────────────────────────────────────────────────────────────────

type NavFrame =
  | { screen: 'home' }
  | { screen: 'collection'; tab: number }
  | { screen: 'artist';     name: string; artistId?: string; tab: number }
  | { screen: 'album';      album: Album; tab: number }
  | { screen: 'playlist';   playlist: Playlist }
  | { screen: 'nowplaying' }

export function App() {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      if (new URLSearchParams(window.location.search).has('code')) {
        await handleCallback()
      }
      if (hasStoredTokens()) {
        const t = await getValidToken()
        setToken(t)
      }
    }
    void init()
  }, [])

  useEffect(() => {
    if (!token) return
    const id = setInterval(async () => {
      const t = await getValidToken()
      setToken(t)
    }, 4 * 60 * 1000)
    return () => clearInterval(id)
  }, [Boolean(token)])

  const handleLogout = () => {
    clearTokens()
    setToken(null)
  }

  return (
    <LibraryProvider token={token}>
      <AppContent token={token} onLogout={handleLogout} />
    </LibraryProvider>
  )
}

interface ContentProps {
  token: string | null
  onLogout: () => void
}

function AppContent({ token, onLogout }: ContentProps) {
  const [sdkError, setSdkError] = useState<string | null>(null)
  const spotifyEngine = useSpotifyPlayer(Boolean(token), onLogout, setSdkError)
  const pb            = usePlayback(spotifyEngine)
  const theme         = useTheme()
  const { albums }    = useLibrary()

  const [navStack, setNavStack] = useState<NavFrame[]>([{ screen: 'home' }])
  const [navKey, setNavKey]     = useState(0)
  const [navDir, setNavDir]     = useState<'fwd' | 'back'>('fwd')
  const [showSettings, setShowSettings] = useState(false)

  const current = navStack[navStack.length - 1]

  const push = (frame: NavFrame) => {
    setNavDir('fwd'); setNavStack(s => [...s, frame]); setNavKey(k => k + 1)
  }
  const back = () => {
    setNavDir('back'); setNavStack(s => s.length > 1 ? s.slice(0, -1) : s); setNavKey(k => k + 1)
  }
  const updateTab = (tab: number) =>
    setNavStack(s => s.map((f, i) => i === s.length - 1 ? { ...f, tab } as NavFrame : f))

  const playAndGo = (queue: Track[], idx: number, contextUri?: string) => {
    if (queue.length === 0) return
    pb.play(queue, idx, contextUri)
    push({ screen: 'nowplaying' })
  }

  let body: JSX.Element

  switch (current.screen) {
    case 'home':
      body = (
        <Hub
          pb={pb}
          onOpenCollection={(tab) => push({ screen: 'collection', tab })}
          onOpenNowPlaying={() => push({ screen: 'nowplaying' })}
          onOpenAlbum={(album) => push({ screen: 'album', album, tab: 0 })}
          onOpenPlaylist={(playlist) => push({ screen: 'playlist', playlist })}
          onShuffle={() => playAndGo(albums.flatMap(albumQueue).sort(() => Math.random() - 0.5), 0)}
          onSettings={() => setShowSettings(true)}
        />
      )
      break

    case 'collection':
      body = (
        <Collection
          tab={current.tab}
          onTabChange={updateTab}
          onOpenArtist={(name, artistId) => push({ screen: 'artist', name, artistId, tab: 0 })}
          onOpenAlbum={(album) => push({ screen: 'album', album, tab: 0 })}
          onOpenPlaylist={(playlist) => push({ screen: 'playlist', playlist })}
          onPlay={playAndGo}
          onBack={back}
        />
      )
      break

    case 'artist':
      body = (
        <ArtistCard
          name={current.name}
          artistId={current.artistId}
          tab={current.tab}
          onTabChange={updateTab}
          onOpenAlbum={(album) => push({ screen: 'album', album, tab: 0 })}
          onPlay={playAndGo}
          onBack={back}
        />
      )
      break

    case 'album':
      body = (
        <AlbumDetail
          album={current.album}
          tab={current.tab}
          onTabChange={updateTab}
          onOpenAlbum={(album) => push({ screen: 'album', album, tab: 0 })}
          onOpenArtist={(name, artistId) => push({ screen: 'artist', name, artistId, tab: 0 })}
          onPlay={playAndGo}
          onBack={back}
        />
      )
      break

    case 'playlist':
      body = (
        <PlaylistDetail
          playlist={current.playlist}
          onPlay={playAndGo}
          onBack={back}
        />
      )
      break

    case 'nowplaying':
      body = <Player pb={pb} onBack={back} />
      break
  }

  return (
    <div className={`app-shell theme-${theme.mode}`}>
      {showSettings && (
        <Settings
          theme={theme}
          token={token}
          sdkError={sdkError}
          onClearSdkError={() => setSdkError(null)}
          onLogout={onLogout}
          onClose={() => setShowSettings(false)}
        />
      )}
      <div className={`screen-in screen-${navDir}`} key={navKey}>
        {body}
      </div>
    </div>
  )
}

interface SettingsProps {
  theme: ReturnType<typeof useTheme>
  token: string | null
  sdkError: string | null
  onClearSdkError: () => void
  onLogout: () => void
  onClose: () => void
}

function Settings({ theme, token, sdkError, onClearSdkError, onLogout, onClose }: SettingsProps) {
  const [clientId, setClientIdState] = useState(getClientId)
  const [loginError, setLoginError]  = useState('')
  const loggedIn = Boolean(token)

  const handleLogin = async () => {
    setLoginError('')
    try { await startLogin() }
    catch (e) { setLoginError(e instanceof Error ? e.message : String(e)) }
  }

  const saveClientId = (v: string) => {
    setClientIdState(v)
    setClientId(v)
  }

  return (
    <div className="settings-overlay">
      <button className="settings-close" onClick={onClose} aria-label="Close">×</button>
      <div className="settings-title">settings</div>

      <div className="settings-label">accent color</div>
      <div className="accent-swatches">
        {ACCENTS.map((c) => (
          <div
            key={c}
            className={'swatch' + (c === theme.accent ? ' active' : '')}
            style={{ background: c }}
            onClick={() => theme.setAccent(c)}
            role="button"
            aria-label={`Accent ${c}`}
          />
        ))}
      </div>

      <div className="settings-label">theme</div>
      <div className="theme-btns">
        {(['dark', 'light'] as ThemeMode[]).map((m) => (
          <button
            key={m}
            className={'theme-btn' + (m === theme.mode ? ' active' : '')}
            onClick={() => theme.setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="settings-label" style={{ marginTop: 24 }}>spotify</div>

      {!loggedIn && (
        <>
          <div className="settings-hint">
            1. Go to <span style={{ color: 'var(--accent)' }}>developer.spotify.com</span> → Dashboard → Create app.<br />
            2. Add Redirect URI: <code>{getRedirectUri()}</code><br />
            3. Paste Client ID below. Premium = full tracks; free = 30 s previews.
          </div>
          <input
            className="settings-input"
            type="text"
            placeholder="Client ID"
            value={clientId}
            onChange={(e) => saveClientId(e.target.value)}
            spellCheck={false}
          />
          <button
            className="theme-btn"
            style={{ marginTop: 8 }}
            disabled={!clientId.trim()}
            onClick={handleLogin}
          >
            connect spotify
          </button>
          {loginError && (
            <div className="settings-hint" style={{ color: '#e74c3c', marginTop: 8, whiteSpace: 'pre-line' }}>
              {loginError}
            </div>
          )}
        </>
      )}

      {loggedIn && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <span style={{ color: '#1db954', fontSize: 13 }}>● connected</span>
            <button className="theme-btn" onClick={onLogout}>disconnect</button>
          </div>
          {sdkError && (
            <div className="settings-hint" style={{ color: '#e74c3c', marginTop: 8, whiteSpace: 'pre-line' }}>
              {sdkError}
              <button
                style={{ marginLeft: 8, background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 13 }}
                onClick={onClearSdkError}
                aria-label="Dismiss"
              >✕</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
