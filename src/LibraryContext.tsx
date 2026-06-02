import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import {
  Album, Playlist, SongEntry, Track,
  buildArtists, buildSongs,
  ALBUMS, ARTISTS, SONGS, PLAYLISTS,
} from './data'
import { fetchLikedTracksPage, fetchPlaylistTracksPage, fetchSavedAlbumsPage, fetchUserPlaylistsPage } from './spotifyApi'

export type LibraryPageKind = 'albums' | 'playlists'

interface LibraryTotals {
  albums: number | null
  artists: number | null
  songs: number | null
  playlists: number | null
}

interface LibraryLoadingMore {
  albums: boolean
  playlists: boolean
  playlistTracks: Record<string, boolean>
}

export interface Library {
  albums: Album[]
  artists: string[]
  songs: SongEntry[]
  playlists: Playlist[]
  loading: boolean
  loadingMore: LibraryLoadingMore
  error: string | null
  source: 'static' | 'spotify'
  totals: LibraryTotals
  loadMore: (kind: LibraryPageKind) => void
  loadMorePlaylistTracks: (playlistId: string) => void
}

const noop = () => {}

const DEFAULT: Library = {
  albums: ALBUMS,
  artists: ARTISTS,
  songs: SONGS,
  playlists: PLAYLISTS,
  loading: false,
  loadingMore: { albums: false, playlists: false, playlistTracks: {} },
  error: null,
  source: 'static',
  totals: {
    albums: ALBUMS.length,
    artists: ARTISTS.length,
    songs: SONGS.length,
    playlists: PLAYLISTS.length,
  },
  loadMore: noop,
  loadMorePlaylistTracks: noop,
}

// When Spotify auth exists but library hasn't loaded yet — show empty, not mockup
const EMPTY: Library = {
  albums: [],
  artists: [],
  songs: [],
  playlists: [],
  loading: true,
  loadingMore: { albums: false, playlists: false, playlistTracks: {} },
  error: null,
  source: 'spotify',
  totals: { albums: null, artists: null, songs: null, playlists: null },
  loadMore: noop,
  loadMorePlaylistTracks: noop,
}

const LibraryContext = createContext<Library>(DEFAULT)

const SPOTIFY_LIBRARY_CACHE_KEY = 'zplayer_spotify_library_v2'

type SpotifyLibraryCache = Pick<Library, 'albums' | 'playlists' | 'totals'> & {
  nextAlbums: string | null
  nextPlaylists: string | null
}

interface SpotifyLibraryData extends Pick<Library, 'albums' | 'playlists' | 'totals'> {}

function buildSpotifyLibrary({ albums, playlists, totals }: SpotifyLibraryData): Library {
  return {
    albums,
    artists: buildArtists(albums),
    songs: buildSongs(albums),
    playlists,
    loading: false,
    loadingMore: { albums: false, playlists: false, playlistTracks: {} },
    error: null,
    source: 'spotify',
    totals,
    loadMore: noop,
    loadMorePlaylistTracks: noop,
  }
}

function readSpotifyLibraryCache(): SpotifyLibraryCache | null {
  try {
    const raw = localStorage.getItem(SPOTIFY_LIBRARY_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SpotifyLibraryCache
  } catch {
    localStorage.removeItem(SPOTIFY_LIBRARY_CACHE_KEY)
    return null
  }
}

function writeSpotifyLibraryCache(lib: SpotifyLibraryCache) {
  try {
    localStorage.setItem(SPOTIFY_LIBRARY_CACHE_KEY, JSON.stringify(lib))
  } catch {
    // Ignore quota/private-mode failures; live Spotify data still works.
  }
}

function likedSongsPlaylist(tracks: Track[]): Playlist {
  return {
    id: 'sp_liked',
    name: 'liked songs',
    items: [],
    tracks,
    totalTracks: tracks.length,
    trackNextUrl: null,
  }
}

function mergePlaylistTracks(playlists: Playlist[], playlistId: string, tracks: Track[], next: string | null, total: number | null): Playlist[] {
  return playlists.map(pl => pl.id === playlistId ? {
    ...pl,
    tracks: [...(pl.tracks ?? []), ...tracks],
    totalTracks: total ?? pl.totalTracks,
    trackNextUrl: next,
  } : pl)
}

export function useLibrary(): Library {
  return useContext(LibraryContext)
}

interface Props { token: string | null; children: ReactNode }

export function LibraryProvider({ token, children }: Props) {
  const [lib, setLib] = useState<Library>(DEFAULT)
  const tokenRef = useRef(token)
  const nextAlbumsRef = useRef<string | null | undefined>(undefined)
  const nextPlaylistsRef = useRef<string | null | undefined>(undefined)
  const loadingAlbumsRef = useRef(false)
  const loadingPlaylistsRef = useRef(false)
  const likedLoadedRef = useRef(false)
  const loadingPlaylistTracksRef = useRef<Record<string, boolean>>({})

  const saveCache = useCallback((albums: Album[], playlists: Playlist[], totals: LibraryTotals) => {
    writeSpotifyLibraryCache({
      albums,
      playlists,
      totals,
      nextAlbums: nextAlbumsRef.current ?? null,
      nextPlaylists: nextPlaylistsRef.current ?? null,
    })
  }, [])

  const loadMore = useCallback((kind: LibraryPageKind) => {
    if (!tokenRef.current) return

    if (kind === 'albums') {
      if (loadingAlbumsRef.current || nextAlbumsRef.current === null) return
      loadingAlbumsRef.current = true
      setLib(prev => ({ ...prev, loadingMore: { ...prev.loadingMore, albums: true } }))

      fetchSavedAlbumsPage(nextAlbumsRef.current)
        .then(page => {
          nextAlbumsRef.current = page.next
          setLib(prev => {
            const albums = [...prev.albums, ...page.items]
            const totals = { ...prev.totals, albums: page.total ?? prev.totals.albums }
            saveCache(albums, prev.playlists, totals)

          return buildSpotifyLibrary({ albums, playlists: prev.playlists, totals })
          })
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          setLib(prev => ({ ...prev, error: msg }))
        })
        .finally(() => {
          loadingAlbumsRef.current = false
          setLib(prev => ({ ...prev, loading: false, loadingMore: { ...prev.loadingMore, albums: false } }))
        })
      return
    }

    if (loadingPlaylistsRef.current || nextPlaylistsRef.current === null) return
    loadingPlaylistsRef.current = true
    setLib(prev => ({ ...prev, loadingMore: { ...prev.loadingMore, playlists: true } }))

    Promise.all([
      likedLoadedRef.current ? Promise.resolve(null) : fetchLikedTracksPage(),
      fetchUserPlaylistsPage(nextPlaylistsRef.current),
    ])
      .then(([likedPage, playlistPage]) => {
        if (likedPage) likedLoadedRef.current = true
        nextPlaylistsRef.current = playlistPage.next
        setLib(prev => {
          const existingUserPlaylists = prev.playlists.filter(pl => pl.id !== 'sp_liked')
          const liked = prev.playlists.find(pl => pl.id === 'sp_liked') ?? likedSongsPlaylist([])
          const nextLiked = {
            ...liked,
            tracks: liked.tracks?.length ? liked.tracks : likedPage?.items ?? [],
            totalTracks: likedPage?.total ?? liked.totalTracks,
            trackNextUrl: liked.trackNextUrl ?? likedPage?.next ?? null,
          }
          const playlists = [nextLiked, ...existingUserPlaylists, ...playlistPage.items]
          const totals = { ...prev.totals, songs: likedPage?.total ?? prev.totals.songs, playlists: playlistPage.total ?? prev.totals.playlists }
          saveCache(prev.albums, playlists, totals)

          return buildSpotifyLibrary({ albums: prev.albums, playlists, totals })
        })
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setLib(prev => ({ ...prev, error: msg }))
      })
      .finally(() => {
        loadingPlaylistsRef.current = false
        setLib(prev => ({ ...prev, loading: false, loadingMore: { ...prev.loadingMore, playlists: false } }))
      })
  }, [saveCache])

  const loadMorePlaylistTracks = useCallback((playlistId: string) => {
    if (!tokenRef.current || loadingPlaylistTracksRef.current[playlistId]) return

    const playlist = lib.playlists.find(pl => pl.id === playlistId)
    if (!playlist?.trackNextUrl) return

    loadingPlaylistTracksRef.current = { ...loadingPlaylistTracksRef.current, [playlistId]: true }
    setLib(prev => ({ ...prev, loadingMore: { ...prev.loadingMore, playlistTracks: { ...prev.loadingMore.playlistTracks, [playlistId]: true } } }))

    fetchPlaylistTracksPage(playlistId, playlist.trackNextUrl)
      .then(page => {
        setLib(prev => {
          const playlists = mergePlaylistTracks(prev.playlists, playlistId, page.items, page.next, page.total)
          saveCache(prev.albums, playlists, prev.totals)

          return buildSpotifyLibrary({ albums: prev.albums, playlists, totals: prev.totals })
        })
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setLib(prev => ({ ...prev, error: msg }))
      })
      .finally(() => {
        loadingPlaylistTracksRef.current = { ...loadingPlaylistTracksRef.current, [playlistId]: false }
        setLib(prev => ({ ...prev, loadingMore: { ...prev.loadingMore, playlistTracks: { ...prev.loadingMore.playlistTracks, [playlistId]: false } } }))
      })
  }, [lib.playlists, loadMore, saveCache])

  useEffect(() => {
    tokenRef.current = token

    if (!token) {
      nextAlbumsRef.current = undefined
      nextPlaylistsRef.current = undefined
      likedLoadedRef.current = false
      setLib(DEFAULT)
      return
    }

    const cached = readSpotifyLibraryCache()

    if (cached) {
      nextAlbumsRef.current = cached.nextAlbums
      nextPlaylistsRef.current = cached.nextPlaylists
      likedLoadedRef.current = cached.playlists.some(pl => pl.id === 'sp_liked')
      setLib(buildSpotifyLibrary(cached))
      return
    }

    nextAlbumsRef.current = undefined
    nextPlaylistsRef.current = undefined
    likedLoadedRef.current = false
    setLib(EMPTY)
    loadMore('albums')
    loadMore('playlists')
  }, [token, loadMore])

  return <LibraryContext.Provider value={{ ...lib, loadMore, loadMorePlaylistTracks }}>{children}</LibraryContext.Provider>
}
