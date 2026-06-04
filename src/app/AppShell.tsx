import { useRef, useState } from 'react'
import { usePlayback } from '../hooks/usePlayback'
import { useTheme } from '../hooks/useTheme'
import { useNavigationStack } from './navigation/useNavigationStack'
import { useSpotifyPlayer } from '../useSpotifyPlayer'
import { useLibrary } from '../LibraryContext'
import { Album, Playlist, Track } from '../data'
import { fetchArtistTopTracks, fetchCurrentUser, setShuffleState } from '../spotifyApi'
import { Hub } from '../screens/Hub'
import { Search } from '../screens/Search'
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
  | { screen: 'search' }
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
            void (async () => {
              if (!token) {
                setSdkError('Spotify login required for shuffle.')
                return
              }
              const id = userId ?? (await fetchCurrentUser()).id
              const contextUri = `spotify:user:${id}:collection`
              void spotifyEngine?.player.activateElement()
              if (spotifyEngine) await spotifyEngine.setShuffle(true)
              else await setShuffleState(true)
              playAndGo([], 0, contextUri)
              window.setTimeout(() => {
                void (spotifyEngine ? spotifyEngine.setShuffle(true) : setShuffleState(true))
                  .catch(e => setSdkError(`Spotify shuffle failed: ${e instanceof Error ? e.message : String(e)}`))
              }, 500)
            })().catch(e => setSdkError(`Spotify shuffle failed: ${e instanceof Error ? e.message : String(e)}`))
          }}
          onSearch={() => nav.push({ screen: 'search' })}
          onChangeLooks={() => setOverlay('looks')}
          onConnectSpotify={() => setOverlay('spotify')}
          spotify={Boolean(token)}
        />
      )
      break

    case 'search':
      body = (
        <Search
          onBack={nav.back}
          onOpenAlbum={(album) => nav.push({ screen: 'album', album, tab: 0 })}
          onOpenArtist={(name, artistId) => nav.push({ screen: 'artist', name, artistId, tab: 0 })}
          onPlayTrack={(track) => playAndGo([track], 0)}
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

    case 'nowplaying': {
      const track = pb.track
      body = (
        <Player
          pb={pb}
          onBack={nav.back}
          controls={controls}
          onGoToAlbum={track.albumID && track.artist ? () => {
            const albumID = track.albumID as string
            const lightAlbum: Album = {
              id: albumID,
              artist: track.artist,
              title: track.album,
              year: 0,
              color: track.color,
              imageUrl: track.imageUrl,
              tracks: [],
            }
            nav.push({ screen: 'album', album: lightAlbum, tab: 0 })
          } : undefined}
          onGoToArtist={track.artist ? () => {
            setTimeout(() => {
              nav.push({ screen: 'artist', name: track.artist, artistId: track.artistId, tab: 0 })
            }, 70)
          } : undefined}
        />
      )
      break
    }
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
