import { useRef, useState } from 'react'
import { usePlayback } from '../hooks/usePlayback'
import { useTheme } from '../hooks/useTheme'
import { useNavigationStack } from './navigation/useNavigationStack'
import { useSpotifyPlayer } from '../useSpotifyPlayer'
import { useLibrary } from '../LibraryContext'
import { Album, Playlist, Track } from '../data'
import { fetchArtistTopTracks, setShuffleState, startPlayback } from '../spotifyApi'
import { Hub } from '../screens/Hub'
import { Collection } from '../screens/Collection'
import { ArtistCard } from '../screens/ArtistCard'
import { AlbumDetail } from '../screens/AlbumDetail'
import { PlaylistDetail } from '../screens/PlaylistDetail'
import { Player } from '../screens/Player'
import { Settings } from '../features/settings/Settings'
import { LooksScreen } from '../features/settings/LooksScreen'
import { ContextMenuHost } from '../components/ContextMenu'

type NavFrame =
  | { screen: 'home' }
  | { screen: 'collection'; tab: number }
  | { screen: 'artist'; name: string; artistId?: string; tab: number }
  | { screen: 'album'; album: Album; tab: number }
  | { screen: 'playlist'; playlist: Playlist }
  | { screen: 'nowplaying' }

type Overlay = 'looks' | 'spotify' | null

interface AppShellProps {
  token: string | null
  onLogout: () => void
}

export function AppShell({ token, onLogout }: AppShellProps) {
  const [sdkError, setSdkError] = useState<string | null>(null)
  const spotifyEngine = useSpotifyPlayer(Boolean(token), onLogout, setSdkError)
  const pb = usePlayback(spotifyEngine)
  const theme = useTheme()
  const { userId } = useLibrary()

  const nav = useNavigationStack<NavFrame>({ screen: 'home' })
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [controls] = useState<'top' | 'bottom'>('top')
  const artistPlayRequestRef = useRef(0)

  const updateTab = (tab: number) =>
    nav.updateCurrent(frame => 'tab' in frame ? { ...frame, tab } : frame)

  const playAndGo = (queue: Track[], idx: number, contextUri?: string) => {
    if (queue.length === 0 && !contextUri) return
    artistPlayRequestRef.current += 1
    pb.play(queue, idx, contextUri)
    nav.push({ screen: 'nowplaying' })
  }

  const playArtistTopTracks = (artistId: string, fallbackQueue: Track[]) => {
    const request = ++artistPlayRequestRef.current
    void fetchArtistTopTracks(artistId)
      .then(tracks => {
        if (request !== artistPlayRequestRef.current) return
        if (tracks.length) playAndGo(tracks, 0)
        else playAndGo(fallbackQueue, 0)
      })
      .catch(e => {
        if (request !== artistPlayRequestRef.current) return
        if (fallbackQueue.length) playAndGo(fallbackQueue, 0)
        else setSdkError(`Spotify artist tracks failed: ${e instanceof Error ? e.message : String(e)}`)
      })
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
            const contextUri = userId ? `spotify:user:${userId}:collection` : undefined
            void spotifyEngine?.player.activateElement()
            const playTarget = () => {
              if (!contextUri) return Promise.resolve()
              artistPlayRequestRef.current += 1
              nav.push({ screen: 'nowplaying' })
              return startPlayback({ context_uri: contextUri }, spotifyEngine?.deviceId)
            }
            void setShuffleState(true, spotifyEngine?.deviceId)
              .catch(() => {})
              .then(() => {
                void playTarget()
                  .then(() => {
                    setTimeout(() => {
                      void setShuffleState(true, spotifyEngine?.deviceId)
                        .catch(e => setSdkError(`Spotify shuffle failed: ${e instanceof Error ? e.message : String(e)}`))
                    }, 500)
                  })
                  .catch(e => setSdkError(`Spotify playback failed: ${e instanceof Error ? e.message : String(e)}`))
              })
          }}
          onChangeLooks={() => setOverlay('looks')}
          onConnectSpotify={() => setOverlay('spotify')}
          spotify={Boolean(token)}
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
          onPlayArtist={playArtistTopTracks}
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
      body = <Player pb={pb} onBack={nav.back} controls={controls} />
      break
  }

  return (
    <div className={`app-shell theme-${theme.mode}`} id="app-shell">
      <div className="screen-content">
        <div className={`screen-in screen-${nav.direction}`} key={nav.key}>
          {body}
        </div>
      </div>
      <ContextMenuHost />
      {overlay === 'looks' && (
        <LooksScreen
          theme={theme.mode}
          accent={theme.accent}
          onTheme={theme.setMode}
          onAccent={theme.setAccent}
          onBack={() => setOverlay(null)}
        />
      )}
      {overlay === 'spotify' && (
        <Settings
          token={token}
          sdkError={sdkError}
          onClearSdkError={() => setSdkError(null)}
          onLogout={onLogout}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  )
}
