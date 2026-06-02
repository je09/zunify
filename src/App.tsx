import { useState } from 'react'
import { usePlayback } from './hooks/usePlayback'
import { useTheme, ACCENTS, ThemeMode } from './hooks/useTheme'
import { Album, Playlist, ALBUMS, albumQueue } from './data'
import { Hub } from './screens/Hub'
import { Collection } from './screens/Collection'
import { ArtistCard } from './screens/ArtistCard'
import { AlbumDetail } from './screens/AlbumDetail'
import { GenreDetail } from './screens/GenreDetail'
import { PlaylistDetail } from './screens/PlaylistDetail'
import { Player } from './screens/Player'

// ── Navigation stack ──────────────────────────────────────────────────────────
// Each frame is a discriminated union — push to navigate, pop to go back.
// No prevScreen, no backTo, no fragile tracking.

type NavFrame =
  | { screen: 'home' }
  | { screen: 'collection'; tab: number }
  | { screen: 'artist';     name: string }
  | { screen: 'album';      album: Album }
  | { screen: 'genre';      genre: string }
  | { screen: 'playlist';   playlist: Playlist }
  | { screen: 'nowplaying' }

export function App() {
  const pb   = usePlayback()
  const theme = useTheme()

  const [navStack, setNavStack] = useState<NavFrame[]>([{ screen: 'home' }])
  const [navKey, setNavKey]     = useState(0)
  const [showSettings, setShowSettings] = useState(false)

  const current = navStack[navStack.length - 1]

  const push = (frame: NavFrame) => {
    setNavStack(s => [...s, frame])
    setNavKey(k => k + 1)
  }

  const back = () => {
    setNavStack(s => (s.length > 1 ? s.slice(0, -1) : s))
    setNavKey(k => k + 1)
  }

  const playAndGo = (queue: ReturnType<typeof albumQueue>, idx: number) => {
    pb.play(queue, idx)
    push({ screen: 'nowplaying' })
  }

  // ── Screen switch ───────────────────────────────────────────────────────────
  let body: JSX.Element

  switch (current.screen) {
    case 'home':
      body = (
        <Hub
          pb={pb}
          onOpenCollection={(tab) => push({ screen: 'collection', tab })}
          onOpenNowPlaying={() => push({ screen: 'nowplaying' })}
          onShuffle={() => playAndGo(ALBUMS.flatMap(albumQueue).sort(() => Math.random() - 0.5), 0)}
          onSettings={() => setShowSettings(true)}
        />
      )
      break

    case 'collection':
      body = (
        <Collection
          initialTab={current.tab}
          onOpenArtist={(name) => push({ screen: 'artist', name })}
          onOpenAlbum={(album) => push({ screen: 'album', album })}
          onOpenGenre={(genre) => push({ screen: 'genre', genre })}
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
          onOpenAlbum={(album) => push({ screen: 'album', album })}
          onPlay={playAndGo}
          onBack={back}
        />
      )
      break

    case 'album':
      body = (
        <AlbumDetail
          album={current.album}
          onPlay={playAndGo}
          onBack={back}
        />
      )
      break

    case 'genre':
      body = (
        <GenreDetail
          genre={current.genre}
          onOpenArtist={(name) => push({ screen: 'artist', name })}
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
        <Settings theme={theme} onClose={() => setShowSettings(false)} />
      )}
      <div className="screen-in" key={navKey}>
        {body}
      </div>
    </div>
  )
}

// ── Settings panel ────────────────────────────────────────────────────────────
interface SettingsProps {
  theme: ReturnType<typeof useTheme>
  onClose: () => void
}

function Settings({ theme, onClose }: SettingsProps) {
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
    </div>
  )
}
