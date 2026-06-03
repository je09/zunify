import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { Album, Playlist, SongEntry, Track, buildArtists, buildSongs, artistIdByName as buildArtistIdMap } from './data'
import {
  fetchSavedAlbumsPage, fetchUserPlaylistsPage, fetchLikedTracksPage,
  fetchPlaylistTracksPage, fetchCurrentUser,
} from './spotifyApi'

export type LibraryPageKind = 'albums' | 'playlists' | 'tracks'

interface LibraryTotals {
  albums: number | null
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
  artistIdByName: Map<string, string>
  userId: string | null
  loading: boolean
  loadingMore: LibraryLoadingMore
  error: string | null
  totals: LibraryTotals
  loadMore: (kind: LibraryPageKind) => void
  loadMorePlaylistTracks: (playlistId: string) => void
}

const noop = () => {}

const EMPTY: Library = {
  albums: [], artists: [], songs: [], playlists: [],
  likedTrackUris: new Set(), artistIdByName: new Map(),
  userId: null, loading: false,
  loadingMore: { albums: false, playlists: false, tracks: false, playlistTracks: {} },
  error: null, totals: { albums: null, songs: null, playlists: null },
  loadMore: noop, loadMorePlaylistTracks: noop,
}

const LibraryContext = createContext<Library>(EMPTY)

// ── Builders ──────────────────────────────────────────────────────────────────

function likedSongsPlaylist(tracks: Track[], total?: number | null): Playlist {
  return {
    id: 'sp_liked', name: 'liked songs', items: [],
    imageUrl: tracks[0]?.imageUrl,
    tracks, totalTracks: total ?? tracks.length,
    trackNextUrl: '/me/tracks?limit=50',
  }
}

function buildLibrary(
  albums: Album[],
  playlists: Playlist[],
  totals: LibraryTotals,
  userId: string | null,
): Library {
  const likedPlaylist = playlists.find(pl => pl.id === 'sp_liked')
  const liked = likedPlaylist?.tracks ?? []
  const likedTrackUris = new Set(liked.map(t => t.spotifyUri).filter((u): u is string => !!u))

  const songsAlbums = mergeAlbums(albums, albumsFromLiked(liked))

  return {
    albums, artists: buildArtists(albums), songs: buildSongs(songsAlbums),
    playlists, likedTrackUris, artistIdByName: buildArtistIdMap(albums),
    userId, loading: false,
    loadingMore: { albums: false, playlists: false, tracks: false, playlistTracks: {} },
    error: null, totals,
    loadMore: noop, loadMorePlaylistTracks: noop,
  }
}

function albumsFromLiked(tracks: Track[]): Album[] {
  const map = new Map<string, Album>()
  tracks.forEach(t => {
    const key = `${t.artist}:${t.album}`
    const existing = map.get(key)
    if (existing) {
      existing.tracks.push([t.title, t.dur])
      existing.spotifyTrackUris?.push(t.spotifyUri ?? '')
      existing.spotifyTrackPreviews?.push(t.previewUrl)
    } else {
      map.set(key, {
        id: key, artist: t.artist, artistId: t.artistId, title: t.album,
        year: 0, color: t.color, imageUrl: t.imageUrl,
        tracks: [[t.title, t.dur]],
        spotifyTrackUris: [t.spotifyUri ?? ''],
        spotifyTrackPreviews: [t.previewUrl],
      })
    }
  })
  return [...map.values()]
}

function mergeAlbums(existing: Album[], incoming: Album[]): Album[] {
  const seen = new Set(existing.map(a => a.id))
  return [...existing, ...incoming.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true })]
}

function mergePlaylists(existing: Playlist[], incoming: Playlist[]): Playlist[] {
  const seen = new Set(existing.map(p => p.id))
  return [...existing, ...incoming.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true })]
}

function mergeTracks(existing: Track[], incoming: Track[]): Track[] {
  const seen = new Set(existing.map(t => t.spotifyUri ?? `${t.artist}:${t.title}`))
  return [...existing, ...incoming.filter(t => {
    const k = t.spotifyUri ?? `${t.artist}:${t.title}`
    if (seen.has(k)) return false; seen.add(k); return true
  })]
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function useLibrary(): Library { return useContext(LibraryContext) }

interface Props { token: string | null; children: ReactNode }

export function LibraryProvider({ token, children }: Props) {
  const [lib, setLib] = useState<Library>(EMPTY)
  const tokenRef = useRef(token)

  // Pagination cursors
  const nextAlbumsRef = useRef<string | null | undefined>(undefined)
  const nextPlaylistsRef = useRef<string | null | undefined>(undefined)
  const nextTracksRef = useRef<string | null | undefined>(undefined)

  // Loading guards
  const loadingAlbumsRef = useRef(false)
  const loadingPlaylistsRef = useRef(false)
  const loadingTracksRef = useRef(false)
  const likedLoadedRef = useRef(false)
  const loadingPlaylistTracksRef = useRef<Record<string, boolean>>({})
  const playlistsRef = useRef(lib.playlists)
  const userIdRef = useRef<string | null>(null)

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
            return buildLibrary(albums, prev.playlists, totals, userIdRef.current)
          })
        })
        .catch((err: unknown) => setLib(prev => ({ ...prev, error: String(err) })))
        .finally(() => {
          loadingAlbumsRef.current = false
          setLib(prev => ({ ...prev, loadingMore: { ...prev.loadingMore, albums: false } }))
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
            const userPlaylists = prev.playlists.filter(p => p.id !== 'sp_liked')
            const liked = prev.playlists.find(p => p.id === 'sp_liked') ?? likedSongsPlaylist([])
            const nextLiked = {
              ...liked,
              tracks: mergeTracks(liked.tracks ?? [], page.items),
              totalTracks: page.total ?? liked.totalTracks,
              trackNextUrl: page.next,
            }
            const playlists = [nextLiked, ...userPlaylists]
            const totals = { ...prev.totals, songs: page.total ?? prev.totals.songs }
            return buildLibrary(prev.albums, playlists, totals, userIdRef.current)
          })
        })
        .catch((err: unknown) => setLib(prev => ({ ...prev, error: String(err) })))
        .finally(() => {
          loadingTracksRef.current = false
          setLib(prev => ({ ...prev, loadingMore: { ...prev.loadingMore, tracks: false } }))
        })
      return
    }

    // playlists
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
          const userPlaylists = prev.playlists.filter(p => p.id !== 'sp_liked')
          const liked = prev.playlists.find(p => p.id === 'sp_liked') ?? likedSongsPlaylist([])
          const nextLiked = {
            ...liked,
            totalTracks: likedPage?.total ?? liked.totalTracks,
            trackNextUrl: liked.trackNextUrl ?? '/me/tracks?limit=50',
          }
          const playlists = [nextLiked, ...mergePlaylists(userPlaylists, playlistPage.items)]
          const totals = { ...prev.totals, songs: likedPage?.total ?? prev.totals.songs, playlists: playlistPage.total ?? prev.totals.playlists }
          return buildLibrary(prev.albums, playlists, totals, userIdRef.current)
        })
      })
      .catch((err: unknown) => setLib(prev => ({ ...prev, error: String(err) })))
      .finally(() => {
        loadingPlaylistsRef.current = false
        setLib(prev => ({ ...prev, loadingMore: { ...prev.loadingMore, playlists: false } }))
      })
  }, [])

  const loadMorePlaylistTracks = useCallback((playlistId: string) => {
    if (!tokenRef.current || loadingPlaylistTracksRef.current[playlistId]) return
    const playlist = playlistsRef.current.find(p => p.id === playlistId)
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
          const playlists = prev.playlists.map(pl => pl.id !== playlistId ? pl : {
            ...pl,
            tracks: mergeTracks(pl.tracks ?? [], page.items),
            totalTracks: page.total ?? pl.totalTracks,
            trackNextUrl: page.next,
          })
          return buildLibrary(prev.albums, playlists, prev.totals, userIdRef.current)
        })
      })
      .catch((err: unknown) => setLib(prev => ({ ...prev, error: String(err) })))
      .finally(() => {
        loadingPlaylistTracksRef.current = { ...loadingPlaylistTracksRef.current, [playlistId]: false }
        setLib(prev => ({ ...prev, loadingMore: { ...prev.loadingMore, playlistTracks: { ...prev.loadingMore.playlistTracks, [playlistId]: false } } }))
      })
  }, [])

  useEffect(() => {
    tokenRef.current = token

    if (!token) {
      nextAlbumsRef.current = undefined
      nextPlaylistsRef.current = undefined
      nextTracksRef.current = undefined
      likedLoadedRef.current = false
      userIdRef.current = null
      setLib(EMPTY)
      return
    }

    let cancelled = false

    setLib(prev => ({ ...prev, loading: true }))

    // Parallel initial fetch: user + albums (page 1) + playlists (page 1) + liked count
    Promise.all([
      fetchCurrentUser(),
      fetchSavedAlbumsPage(),
      fetchUserPlaylistsPage(),
      fetchLikedTracksPage('/me/tracks?limit=1'),
    ]).then(([user, albumPage, playlistPage, likedPage]) => {
      if (cancelled) return
      userIdRef.current = user.id
      nextAlbumsRef.current = albumPage.next
      nextPlaylistsRef.current = playlistPage.next
      nextTracksRef.current = '/me/tracks?limit=50'
      likedLoadedRef.current = true

      const liked = likedSongsPlaylist([], likedPage.total ?? 0)
      const playlists = [liked, ...playlistPage.items]
      const totals: LibraryTotals = {
        albums: albumPage.total,
        songs: likedPage.total,
        playlists: playlistPage.total,
      }
      setLib(buildLibrary(albumPage.items, playlists, totals, user.id))
    }).catch((err: unknown) => {
      if (!cancelled) setLib(prev => ({ ...prev, loading: false, error: String(err) }))
    })

    return () => { cancelled = true }
  }, [token, loadMore])

  playlistsRef.current = lib.playlists

  return (
    <LibraryContext.Provider value={{ ...lib, loadMore, loadMorePlaylistTracks }}>
      {children}
    </LibraryContext.Provider>
  )
}
