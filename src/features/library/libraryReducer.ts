import { Playlist } from '../../data'
import type { SpotifyArtist } from '../spotify/types'
import { buildLibrary, likedSongsPlaylist, mergeAlbums, mergePlaylists, mergeTracks } from './librarySelectors'
import { EMPTY_LIBRARY_STATE, LibraryPageKind, LibraryState, LibraryTotals } from './libraryTypes'

export type LibraryAction =
  | { type: 'reset' }
  | { type: 'replace'; state: LibraryState }
  | { type: 'set-loading'; loading: boolean }
  | { type: 'set-error'; error: string; loading?: boolean }
  | { type: 'set-loading-more'; kind: LibraryPageKind; loading: boolean }
  | { type: 'set-playlist-tracks-loading'; playlistId: string; loading: boolean }
  | { type: 'append-albums'; items: LibraryState['albums']; total: number | null; userId: string | null; followedArtists: SpotifyArtist[] }
  | { type: 'append-liked-tracks'; items: LibraryState['playlists'][number]['tracks']; total: number | null; next: string | null; userId: string | null; followedArtists: SpotifyArtist[] }
  | { type: 'append-playlists'; items: Playlist[]; total: number | null; likedTotal: number | null | undefined; userId: string | null; followedArtists: SpotifyArtist[] }
  | { type: 'append-playlist-tracks'; playlistId: string; items: LibraryState['playlists'][number]['tracks']; total: number | null; next: string | null; userId: string | null; followedArtists: SpotifyArtist[] }

export function libraryReducer(state: LibraryState, action: LibraryAction): LibraryState {
  switch (action.type) {
    case 'reset':
      return EMPTY_LIBRARY_STATE

    case 'replace':
      return action.state


    case 'set-loading':
      return { ...state, loading: action.loading }

    case 'set-error':
      return { ...state, error: action.error, ...(action.loading === undefined ? {} : { loading: action.loading }) }

    case 'set-loading-more':
      return { ...state, loadingMore: { ...state.loadingMore, [action.kind]: action.loading } }

    case 'set-playlist-tracks-loading':
      return {
        ...state,
        loadingMore: {
          ...state.loadingMore,
          playlistTracks: { ...state.loadingMore.playlistTracks, [action.playlistId]: action.loading },
        },
      }

    case 'append-albums': {
      const albums = mergeAlbums(state.albums, action.items)
      const totals: LibraryTotals = { ...state.totals, albums: action.total ?? state.totals.albums }
      return buildLibrary(albums, state.playlists, totals, action.userId, action.followedArtists)
    }

    case 'append-liked-tracks': {
      const userPlaylists = state.playlists.filter(p => p.id !== 'sp_liked')
      const liked = state.playlists.find(p => p.id === 'sp_liked') ?? likedSongsPlaylist([])
      const nextLiked = {
        ...liked,
        tracks: mergeTracks(liked.tracks ?? [], action.items ?? []),
        totalTracks: action.total ?? liked.totalTracks,
        trackNextUrl: action.next,
      }
      const playlists = [nextLiked, ...userPlaylists]
      const totals: LibraryTotals = { ...state.totals, songs: action.total ?? state.totals.songs }
      return buildLibrary(state.albums, playlists, totals, action.userId, action.followedArtists)
    }

    case 'append-playlists': {
      const userPlaylists = state.playlists.filter(p => p.id !== 'sp_liked')
      const liked = state.playlists.find(p => p.id === 'sp_liked') ?? likedSongsPlaylist([])
      const nextLiked = {
        ...liked,
        totalTracks: action.likedTotal ?? liked.totalTracks,
        trackNextUrl: liked.trackNextUrl ?? '/me/tracks?limit=50',
      }
      const playlists = [nextLiked, ...mergePlaylists(userPlaylists, action.items)]
      const totals: LibraryTotals = { ...state.totals, songs: action.likedTotal ?? state.totals.songs, playlists: action.total ?? state.totals.playlists }
      return buildLibrary(state.albums, playlists, totals, action.userId, action.followedArtists)
    }

    case 'append-playlist-tracks': {
      const playlists = state.playlists.map(pl => pl.id !== action.playlistId ? pl : {
        ...pl,
        tracks: mergeTracks(pl.tracks ?? [], action.items ?? []),
        totalTracks: action.total ?? pl.totalTracks,
        trackNextUrl: action.next,
      })
      return buildLibrary(state.albums, playlists, state.totals, action.userId, action.followedArtists)
    }
  }
}
