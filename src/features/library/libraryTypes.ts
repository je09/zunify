import { Album, ArtistSummary, Playlist, SongEntry } from '../../data'

export type LibraryPageKind = 'albums' | 'playlists' | 'tracks'

export interface LibraryTotals {
  albums: number | null
  songs: number | null
  playlists: number | null
}

export interface LibraryLoadingMore {
  albums: boolean
  playlists: boolean
  tracks: boolean
  playlistTracks: Record<string, boolean>
}

export interface LibraryState {
  albums: Album[]
  followedArtists: ArtistSummary[]
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
}

export interface Library extends LibraryState {
  loadMore: (kind: LibraryPageKind) => void
  loadMorePlaylistTracks: (playlistId: string) => void
}

export const EMPTY_LIBRARY_STATE: LibraryState = {
  albums: [],
  followedArtists: [],
  artists: [],
  songs: [],
  playlists: [],
  likedTrackUris: new Set(),
  artistIdByName: new Map(),
  userId: null,
  loading: false,
  loadingMore: { albums: false, playlists: false, tracks: false, playlistTracks: {} },
  error: null,
  totals: { albums: null, songs: null, playlists: null },
}
