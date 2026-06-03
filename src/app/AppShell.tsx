import { useState } from 'react'
import { usePlayback } from '../hooks/usePlayback'
import { useTheme } from '../hooks/useTheme'
import { useNavigationStack } from './navigation/useNavigationStack'
import { useSpotifyPlayer } from '../useSpotifyPlayer'
import { useLibrary } from '../LibraryContext'
import { Album, Playlist, Track } from '../data'
import { setShuffleState } from '../spotifyApi'
import { Hub } from '../screens/Hub'
import { Collection } from '../screens/Collection'
import { ArtistCard } from '../screens/ArtistCard'
import { AlbumDetail } from '../screens/AlbumDetail'
import { PlaylistDetail } from '../screens/PlaylistDetail'
import { Player } from '../screens/Player'
import { Settings } from '../features/settings/Settings'

type NavFrame =
  | { screen: 'home' }
  | { screen: 'collection'; tab: number }
  | { screen: 'artist'; name: string; artistId?: string; tab: number }
  | { screen: 'album'; album: Album; tab: number }
  | { screen: 'playlist'; playlist: Playlist }
  | { screen: 'nowplaying' }

interface AppShellProps {
  token: string | null
  onLogout: () => void
}

export function AppShell({ token, onLogout }: AppShellProps) {
  const [sdkError, setSdkError] = useState<string | null>(null)
  const spotifyEngine = useSpotifyPlayer(Boolean(token), onLogout, setSdkError)
  const pb = usePlayback(spotifyEngine)
  const theme = useTheme()
  const { playlists, userId } = useLibrary()

  const nav = useNavigationStack<NavFrame>({ screen: 'home' })
  const [showSettings, setShowSettings] = useState(false)

  const updateTab = (tab: number) =>
    nav.updateCurrent(frame => 'tab' in frame ? { ...frame, tab } : frame)

  const playAndGo = (queue: Track[], idx: number, contextUri?: string) => {
    if (queue.length === 0 && !contextUri) return
    pb.play(queue, idx, contextUri)
    nav.push({ screen: 'nowplaying' })
  }

  let body: JSX.Element

  switch (nav.current.screen) {
    case 'home':
      body = (
        <Hub
          pb={pb}
          token={token}
          onOpenCollection={(tab) => nav.push({ screen: 'collection', tab })}
          onOpenNowPlaying={() => nav.push({ screen: 'nowplaying' })}
          onOpenAlbum={(album) => nav.push({ screen: 'album', album, tab: 0 })}
          onShuffle={() => {
            const liked = playlists.find(p => p.id === 'sp_liked')?.tracks ?? []
            void setShuffleState(true)
              .catch(() => {})
              .then(() => {
                if (liked.length) {
                  const shuffled = [...liked].sort(() => Math.random() - 0.5)
                  playAndGo(shuffled, 0)
                } else if (userId) {
                  playAndGo([], 0, `spotify:user:${userId}:collection`)
                }
              })
          }}
          onSettings={() => setShowSettings(true)}
        />
      )
      break

    case 'collection':
      body = (
        <Collection
          tab={nav.current.tab}
          onTabChange={updateTab}
          onOpenArtist={(name, artistId) => nav.push({ screen: 'artist', name, artistId, tab: 0 })}
          onOpenAlbum={(album) => nav.push({ screen: 'album', album, tab: 0 })}
          onOpenPlaylist={(playlist) => nav.push({ screen: 'playlist', playlist })}
          onPlay={playAndGo}
          onBack={nav.back}
        />
      )
      break

    case 'artist':
      body = (
        <ArtistCard
          name={nav.current.name}
          artistId={nav.current.artistId}
          tab={nav.current.tab}
          onTabChange={updateTab}
          onOpenAlbum={(album) => nav.push({ screen: 'album', album, tab: 0 })}
          onPlay={playAndGo}
          onBack={nav.back}
        />
      )
      break

    case 'album':
      body = (
        <AlbumDetail
          album={nav.current.album}
          tab={nav.current.tab}
          onTabChange={updateTab}
          onOpenAlbum={(album) => nav.push({ screen: 'album', album, tab: 0 })}
          onOpenArtist={(name, artistId) => nav.push({ screen: 'artist', name, artistId, tab: 0 })}
          onPlay={playAndGo}
          onBack={nav.back}
        />
      )
      break

    case 'playlist':
      body = (
        <PlaylistDetail
          playlist={nav.current.playlist}
          onPlay={playAndGo}
          onBack={nav.back}
        />
      )
      break

    case 'nowplaying':
      body = <Player pb={pb} onBack={nav.back} />
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
      <div className={`screen-in screen-${nav.direction}`} key={nav.key}>
        {body}
      </div>
    </div>
  )
}
