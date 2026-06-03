import { createContext, useContext, useReducer, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react'
import type { ArtistSummary } from './data'
import {
  fetchSavedAlbumsPage, fetchUserPlaylistsPage, fetchLikedTracksPage,
  fetchPlaylistTracksPage, fetchCurrentUser, fetchFollowedArtists,
} from './spotifyApi'
import { libraryReducer } from './features/library/libraryReducer'
import { buildLibrary, likedSongsPlaylist } from './features/library/librarySelectors'
import { EMPTY_LIBRARY_STATE, Library, LibraryPageKind, LibraryTotals } from './features/library/libraryTypes'

export type { Library, LibraryPageKind } from './features/library/libraryTypes'

const noop = () => {}

const EMPTY: Library = {
  ...EMPTY_LIBRARY_STATE,
  loadMore: noop, loadMorePlaylistTracks: noop,
}

const LibraryContext = createContext<Library>(EMPTY)

// ── Provider ──────────────────────────────────────────────────────────────────

export function useLibrary(): Library { return useContext(LibraryContext) }

interface Props { token: string | null; children: ReactNode }

export function LibraryProvider({ token, children }: Props) {
  const [lib, dispatch] = useReducer(libraryReducer, EMPTY_LIBRARY_STATE)
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
  const followedArtistsRef = useRef<ArtistSummary[]>([])
  const requestGenRef = useRef(0)

  const loadMore = useCallback((kind: LibraryPageKind) => {
    if (!tokenRef.current) return

    if (kind === 'albums') {
      if (loadingAlbumsRef.current || nextAlbumsRef.current === null) return
      const requestGen = requestGenRef.current
      loadingAlbumsRef.current = true
      dispatch({ type: 'set-loading-more', kind: 'albums', loading: true })

      fetchSavedAlbumsPage(nextAlbumsRef.current)
        .then(page => {
          if (requestGen !== requestGenRef.current) return
          nextAlbumsRef.current = page.next
          dispatch({ type: 'append-albums', items: page.items, total: page.total, userId: userIdRef.current, followedArtists: followedArtistsRef.current })
        })
        .catch((err: unknown) => {
          if (requestGen === requestGenRef.current) dispatch({ type: 'set-error', error: String(err) })
        })
        .finally(() => {
          if (requestGen === requestGenRef.current) {
            loadingAlbumsRef.current = false
            dispatch({ type: 'set-loading-more', kind: 'albums', loading: false })
          }
        })
      return
    }

    if (kind === 'tracks') {
      if (loadingTracksRef.current || nextTracksRef.current === null) return
      const requestGen = requestGenRef.current
      loadingTracksRef.current = true
      dispatch({ type: 'set-loading-more', kind: 'tracks', loading: true })

      fetchLikedTracksPage(nextTracksRef.current)
        .then(page => {
          if (requestGen !== requestGenRef.current) return
          nextTracksRef.current = page.next
          likedLoadedRef.current = true
          dispatch({ type: 'append-liked-tracks', items: page.items, total: page.total, next: page.next, userId: userIdRef.current, followedArtists: followedArtistsRef.current })
        })
        .catch((err: unknown) => {
          if (requestGen === requestGenRef.current) dispatch({ type: 'set-error', error: String(err) })
        })
        .finally(() => {
          if (requestGen === requestGenRef.current) {
            loadingTracksRef.current = false
            dispatch({ type: 'set-loading-more', kind: 'tracks', loading: false })
          }
        })
      return
    }

    // playlists
    if (loadingPlaylistsRef.current || nextPlaylistsRef.current === null) return
    const requestGen = requestGenRef.current
    loadingPlaylistsRef.current = true
    dispatch({ type: 'set-loading-more', kind: 'playlists', loading: true })

    Promise.all([
      likedLoadedRef.current ? Promise.resolve(null) : fetchLikedTracksPage('/me/tracks?limit=1'),
      fetchUserPlaylistsPage(nextPlaylistsRef.current),
    ])
      .then(([likedPage, playlistPage]) => {
        if (requestGen !== requestGenRef.current) return
        if (likedPage) likedLoadedRef.current = true
        nextPlaylistsRef.current = playlistPage.next
        dispatch({ type: 'append-playlists', items: playlistPage.items, total: playlistPage.total, likedTotal: likedPage?.total, userId: userIdRef.current, followedArtists: followedArtistsRef.current })
      })
      .catch((err: unknown) => {
        if (requestGen === requestGenRef.current) dispatch({ type: 'set-error', error: String(err) })
      })
      .finally(() => {
        if (requestGen === requestGenRef.current) {
          loadingPlaylistsRef.current = false
          dispatch({ type: 'set-loading-more', kind: 'playlists', loading: false })
        }
      })
  }, [])

  const loadMorePlaylistTracks = useCallback((playlistId: string) => {
    if (!tokenRef.current || loadingPlaylistTracksRef.current[playlistId]) return
    const playlist = playlistsRef.current.find(p => p.id === playlistId)
    if (!playlist?.trackNextUrl) return
    const requestGen = requestGenRef.current

    loadingPlaylistTracksRef.current = { ...loadingPlaylistTracksRef.current, [playlistId]: true }
    dispatch({ type: 'set-playlist-tracks-loading', playlistId, loading: true })

    const fetchPage = playlistId === 'sp_liked'
      ? fetchLikedTracksPage(playlist.trackNextUrl)
      : fetchPlaylistTracksPage(playlistId, playlist.trackNextUrl)

    fetchPage
      .then(page => {
        if (requestGen !== requestGenRef.current) return
        if (playlistId === 'sp_liked') nextTracksRef.current = page.next
        dispatch({ type: 'append-playlist-tracks', playlistId, items: page.items, total: page.total, next: page.next, userId: userIdRef.current, followedArtists: followedArtistsRef.current })
      })
      .catch((err: unknown) => {
        if (requestGen === requestGenRef.current) dispatch({ type: 'set-error', error: String(err) })
      })
      .finally(() => {
        if (requestGen === requestGenRef.current) {
          loadingPlaylistTracksRef.current = { ...loadingPlaylistTracksRef.current, [playlistId]: false }
          dispatch({ type: 'set-playlist-tracks-loading', playlistId, loading: false })
        }
      })
  }, [])

  useEffect(() => {
    tokenRef.current = token
    requestGenRef.current += 1

    loadingAlbumsRef.current = false
    loadingPlaylistsRef.current = false
    loadingTracksRef.current = false
    loadingPlaylistTracksRef.current = {}

    if (!token) {
      nextAlbumsRef.current = undefined
      nextPlaylistsRef.current = undefined
      nextTracksRef.current = undefined
      likedLoadedRef.current = false
      userIdRef.current = null
      followedArtistsRef.current = []
      dispatch({ type: 'reset' })
      return
    }

    let cancelled = false

    dispatch({ type: 'set-loading', loading: true })

    // Parallel initial fetch: user + albums + playlists + liked count + followed artists
    Promise.all([
      fetchCurrentUser(),
      fetchSavedAlbumsPage(),
      fetchUserPlaylistsPage(),
      fetchLikedTracksPage('/me/tracks?limit=1'),
      fetchFollowedArtists(50).catch(() => [] as ArtistSummary[]),
    ]).then(([user, albumPage, playlistPage, likedPage, followed]) => {
      if (cancelled) return
      userIdRef.current = user.id
      followedArtistsRef.current = followed
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
      dispatch({ type: 'replace', state: buildLibrary(albumPage.items, playlists, totals, user.id, followed) })
    }).catch((err: unknown) => {
      if (!cancelled) dispatch({ type: 'set-error', error: String(err), loading: false })
    })

    return () => { cancelled = true }
  }, [token, loadMore])

  playlistsRef.current = lib.playlists

  const value = useMemo<Library>(() => ({
    ...lib,
    loadMore,
    loadMorePlaylistTracks,
  }), [lib, loadMore, loadMorePlaylistTracks])

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  )
}
