import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import {
  Album, Playlist, SongEntry, Track,
  buildArtists, buildSongs,
  ALBUMS, ARTISTS, SONGS, PLAYLISTS,
} from './data'
import { fetchLikedTracksPage, fetchPlaylistTracksPage, fetchSavedAlbumsPage, fetchUserPlaylistsPage } from './spotifyApi'

export type LibraryPageKind = 'albums' | 'playlists' | 'tracks'

interface LibraryTotals {
  albums: number | null
  artists: number | null
  songs: number | null
  playlists: number | null
}

interface LibraryLoadingMore {
  albums: boolean
  playlists: boolean
  tracks: boolean
  playlistTracks: Record<string, boolean>
}

export interface Library {
  albums: Album[]
  artists: string[]
  songs: SongEntry[]
  playlists: Playlist[]
  likedTrackUris: Set<string>
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
  likedTrackUris: new Set(),
  loading: false,
  loadingMore: { albums: false, playlists: false, tracks: false, playlistTracks: {} },
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

// When Spotify auth exists but library hasn't loaded yet, show empty lists and let active screens request data.
const EMPTY: Library = {
  albums: [],
  artists: [],
  songs: [],
  playlists: [],
  likedTrackUris: new Set(),
  loading: false,
  loadingMore: { albums: false, playlists: false, tracks: false, playlistTracks: {} },
  error: null,
  source: 'spotify',
  totals: { albums: null, artists: null, songs: null, playlists: null },
  loadMore: noop,
  loadMorePlaylistTracks: noop,
}

const LibraryContext = createContext<Library>(DEFAULT)

// ── IndexedDB cache ───────────────────────────────────────────────────────────
// Async, no quota, no JSON serialization on main thread.
// One-time cleanup: remove old localStorage cache if it exists.
try { localStorage.removeItem('zplayer_spotify_library_v2') } catch {}

type SpotifyLibraryCache = Pick<Library, 'albums' | 'playlists' | 'totals'> & {
  nextAlbums: string | null
  nextPlaylists: string | null
  nextTracks?: string | null
}

let _idb: Promise<IDBDatabase> | null = null

function openIdb(): Promise<IDBDatabase> {
  if (_idb) return _idb
  _idb = new Promise((resolve, reject) => {
    const req = indexedDB.open('zplayer', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('library')
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
  return _idb
}

async function idbRead(): Promise<SpotifyLibraryCache | null> {
  try {
    const db = await openIdb()
    return new Promise((resolve, reject) => {
      const req = db.transaction('library', 'readonly').objectStore('library').get('cache')
      req.onsuccess = () => resolve((req.result as SpotifyLibraryCache) ?? null)
      req.onerror   = () => reject(req.error)
    })
  } catch { return null }
}

async function idbWrite(cache: SpotifyLibraryCache): Promise<void> {
  // Strip expiring CDN preview URLs and large playlist track arrays.
  const stripped: SpotifyLibraryCache = {
    ...cache,
    albums:    cache.albums.map(({ spotifyTrackPreviews: _, ...a }) => a),
    playlists: cache.playlists.map(({ tracks: _, ...pl }) => ({ ...pl, items: pl.items ?? [] })),
  }
  try {
    const db = await openIdb()
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction('library', 'readwrite').objectStore('library').put(stripped, 'cache')
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(req.error)
    })
  } catch { /* silently fail — live data works without cache */ }
}

async function idbClear(): Promise<void> {
  try {
    const db = await openIdb()
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction('library', 'readwrite').objectStore('library').delete('cache')
      req.onsuccess = () => resolve()
      req.onerror   = () => reject(req.error)
    })
  } catch {}
}

interface SpotifyLibraryData extends Pick<Library, 'albums' | 'playlists' | 'totals'> {}

function likedTracks(playlists: Playlist[]): Track[] {
  return playlists.find(pl => pl.id === 'sp_liked')?.tracks ?? []
}

function trackAlbum(track: Track): Album {
  return {
    id: track.spotifyUri ?? `${track.artist}:${track.album}:${track.title}`,
    artist: track.artist,
    title: track.album,
    year: 0,
    color: track.color,
    imageUrl: track.imageUrl,
    tracks: [[track.title, track.dur]],
    spotifyTrackUris: track.spotifyUri ? [track.spotifyUri] : undefined,
    spotifyTrackPreviews: [track.previewUrl],
  }
}


function albumsFromTracks(tracks: Track[]): Album[] {
  const albums = new Map<string, Album>()

  tracks.forEach(track => {
    const id = `${track.artist}:${track.album}`
    const album = albums.get(id) ?? { ...trackAlbum(track), id, tracks: [], spotifyTrackUris: [], spotifyTrackPreviews: [] }
    album.tracks.push([track.title, track.dur])
    album.spotifyTrackUris?.push(track.spotifyUri ?? '')
    album.spotifyTrackPreviews?.push(track.previewUrl)
    albums.set(id, album)
  })

  return [...albums.values()]
}

function buildSpotifyLibrary({ albums, playlists, totals }: SpotifyLibraryData): Library {
  const tracks = likedTracks(playlists)
  const likedTrackUris = new Set(tracks.map(track => track.spotifyUri).filter((uri): uri is string => !!uri))

  // Albums and artists tabs show ONLY saved albums — not synthetic albums
  // derived from liked tracks. Liked songs appear only in the songs tab and
  // the "liked songs" playlist, keeping the albums/artists tabs clean.
  const songsAlbums = mergeAlbums(albums, albumsFromTracks(tracks))

  return {
    albums,
    artists: buildArtists(albums),
    songs: buildSongs(songsAlbums),
    playlists,
    likedTrackUris,
    loading: false,
    loadingMore: { albums: false, playlists: false, tracks: false, playlistTracks: {} },
    error: null,
    source: 'spotify',
    totals,
    loadMore: noop,
    loadMorePlaylistTracks: noop,
  }
}


function likedSongsPlaylist(tracks: Track[], totalTracks = tracks.length): Playlist {
  return {
    id: 'sp_liked',
    name: 'liked songs',
    items: [],
    imageUrl: tracks[0]?.imageUrl,
    tracks,
    totalTracks,
    trackNextUrl: '/me/tracks?limit=50',
  }
}

function mergeAlbums(existing: Album[], incoming: Album[]): Album[] {
  const seen = new Set(existing.map(album => album.id))
  return [...existing, ...incoming.filter(album => {
    if (seen.has(album.id)) return false
    seen.add(album.id)
    return true
  })]
}

function mergePlaylists(existing: Playlist[], incoming: Playlist[]): Playlist[] {
  const seen = new Set(existing.map(playlist => playlist.id))
  return [...existing, ...incoming.filter(playlist => {
    if (seen.has(playlist.id)) return false
    seen.add(playlist.id)
    return true
  })]
}

function mergeTracks(existing: Track[], incoming: Track[]): Track[] {
  const seen = new Set(existing.map(track => track.spotifyUri ?? `${track.artist}:${track.album}:${track.title}`))
  return [...existing, ...incoming.filter(track => {
    const key = track.spotifyUri ?? `${track.artist}:${track.album}:${track.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })]
}

function mergePlaylistTracks(playlists: Playlist[], playlistId: string, tracks: Track[], next: string | null, total: number | null): Playlist[] {
  return playlists.map(pl => pl.id === playlistId ? {
    ...pl,
    imageUrl: pl.imageUrl ?? tracks[0]?.imageUrl,
    tracks: mergeTracks(pl.tracks ?? [], tracks),
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
  const nextTracksRef = useRef<string | null | undefined>(undefined)
  const loadingAlbumsRef = useRef(false)
  const loadingPlaylistsRef = useRef(false)
  const loadingTracksRef = useRef(false)
  const likedLoadedRef = useRef(false)
  const loadingPlaylistTracksRef = useRef<Record<string, boolean>>({})
  // Ref mirror of lib.playlists so loadMorePlaylistTracks can read the latest
  // value without adding lib.playlists as a dep (which causes excess recreation).
  const playlistsRef = useRef(lib.playlists)

  const saveCache = useCallback((albums: Album[], playlists: Playlist[], totals: LibraryTotals) => {
    void idbWrite({
      albums,
      playlists,
      totals,
      nextAlbums: nextAlbumsRef.current ?? null,
      nextPlaylists: nextPlaylistsRef.current ?? null,
      nextTracks: nextTracksRef.current ?? null,
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
            const albums = mergeAlbums(prev.albums, page.items)
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

    if (kind === 'tracks') {
      if (loadingTracksRef.current || nextTracksRef.current === null) return
      loadingTracksRef.current = true
      setLib(prev => ({ ...prev, loadingMore: { ...prev.loadingMore, tracks: true } }))

      fetchLikedTracksPage(nextTracksRef.current)
        .then(page => {
          nextTracksRef.current = page.next
          likedLoadedRef.current = true
          setLib(prev => {
            const existingUserPlaylists = prev.playlists.filter(pl => pl.id !== 'sp_liked')
            const liked = prev.playlists.find(pl => pl.id === 'sp_liked') ?? likedSongsPlaylist([])
            const nextLiked = {
              ...liked,
              imageUrl: liked.imageUrl ?? page.items[0]?.imageUrl,
              tracks: mergeTracks(liked.tracks ?? [], page.items),
              totalTracks: page.total ?? liked.totalTracks,
              trackNextUrl: page.next,
            }
            const playlists = [nextLiked, ...existingUserPlaylists]
            const totals = { ...prev.totals, songs: page.total ?? prev.totals.songs }
            saveCache(prev.albums, playlists, totals)

            return buildSpotifyLibrary({ albums: prev.albums, playlists, totals })
          })
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          setLib(prev => ({ ...prev, error: msg }))
        })
        .finally(() => {
          loadingTracksRef.current = false
          setLib(prev => ({ ...prev, loading: false, loadingMore: { ...prev.loadingMore, tracks: false } }))
        })
      return
    }

    if (loadingPlaylistsRef.current || nextPlaylistsRef.current === null) return
    loadingPlaylistsRef.current = true
    setLib(prev => ({ ...prev, loadingMore: { ...prev.loadingMore, playlists: true } }))

    Promise.all([
      likedLoadedRef.current ? Promise.resolve(null) : fetchLikedTracksPage('/me/tracks?limit=1'),
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
            imageUrl: liked.imageUrl ?? likedPage?.items[0]?.imageUrl,
            tracks: liked.tracks ?? [],
            totalTracks: likedPage?.total ?? liked.totalTracks,
            trackNextUrl: liked.trackNextUrl ?? nextTracksRef.current ?? '/me/tracks?limit=50',
          }
          const playlists = [nextLiked, ...mergePlaylists(existingUserPlaylists, playlistPage.items)]
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

    // Read current playlists via ref to avoid adding lib.playlists as dep
    // (which would recreate this callback on every playlist update, causing
    // downstream effects in PlaylistDetail to re-fire unnecessarily).
    const playlist = playlistsRef.current.find(pl => pl.id === playlistId)
    if (!playlist?.trackNextUrl) return

    loadingPlaylistTracksRef.current = { ...loadingPlaylistTracksRef.current, [playlistId]: true }
    setLib(prev => ({ ...prev, loadingMore: { ...prev.loadingMore, playlistTracks: { ...prev.loadingMore.playlistTracks, [playlistId]: true } } }))

    const fetchPage = playlistId === 'sp_liked'
      ? fetchLikedTracksPage(playlist.trackNextUrl)
      : fetchPlaylistTracksPage(playlistId, playlist.trackNextUrl)

    fetchPage
      .then(page => {
        if (playlistId === 'sp_liked') nextTracksRef.current = page.next
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
  }, [saveCache])

  useEffect(() => {
    tokenRef.current = token

    if (!token) {
      nextAlbumsRef.current = undefined
      nextPlaylistsRef.current = undefined
      nextTracksRef.current = undefined
      likedLoadedRef.current = false
      setLib(DEFAULT)
      void idbClear()
      return
    }

    let cancelled = false

    const applyCache = (cached: SpotifyLibraryCache) => {
      nextAlbumsRef.current   = cached.nextAlbums   ?? (cached.totals.albums   === null || cached.albums.length < cached.totals.albums ? undefined : null)
      nextPlaylistsRef.current = cached.nextPlaylists ?? (cached.totals.playlists === null || cached.playlists.filter(pl => pl.id !== 'sp_liked').length < cached.totals.playlists ? undefined : null)
      nextTracksRef.current   = cached.nextTracks   ?? cached.playlists.find(pl => pl.id === 'sp_liked')?.trackNextUrl ?? (cached.totals.songs === null || likedTracks(cached.playlists).length < cached.totals.songs ? undefined : null)
      likedLoadedRef.current  = cached.playlists.some(pl => pl.id === 'sp_liked')
      setLib(buildSpotifyLibrary(cached))
    }

    const startFresh = () => {
      nextAlbumsRef.current = undefined
      nextPlaylistsRef.current = undefined
      nextTracksRef.current = undefined
      likedLoadedRef.current = false
      // Show loading spinner while first pages arrive, then kick them off
      // directly. Collection's useEffect has `if (loading) return` so it won't
      // call loadMore while the spinner is active — we must do it here instead.
      setLib({ ...EMPTY, loading: true })
      loadMore('albums')
      loadMore('playlists')
    }

    idbRead().then(cached => {
      if (cancelled) return
      if (cached) applyCache(cached)
      else startFresh()
    }).catch(() => {
      if (!cancelled) startFresh()
    })

    return () => { cancelled = true }
  }, [token, loadMore])

  // Keep ref in sync so loadMorePlaylistTracks always sees current playlists.
  playlistsRef.current = lib.playlists

  return <LibraryContext.Provider value={{ ...lib, loadMore, loadMorePlaylistTracks }}>{children}</LibraryContext.Provider>
}
