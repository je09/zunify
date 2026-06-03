import { Album, Playlist, Track } from '../../data'
import { spotifyGet, spotifyMutate, spotifyPost } from './client'
import { mapSimpleAlbum, mapTrack } from './mappers'
import { mapPlaylistSummary, SpotifyPage } from './shared'
import type { SpCategory, SpFullArtist, SpPaged, SpSimpleAlbum2, SpSimplePlaylist, SpTrack, SpUser } from './types'

export async function fetchTopTracks(timeRange: 'long_term' | 'medium_term' | 'short_term' = 'medium_term', limit = 50): Promise<Track[]> {
  const page = await spotifyGet<SpPaged<SpTrack>>(`/me/top/tracks?time_range=${timeRange}&limit=${limit}`)
  return page.items.map(mapTrack).filter((t): t is Track => t !== null)
}

export async function fetchTopArtists(timeRange: 'long_term' | 'medium_term' | 'short_term' = 'medium_term', limit = 50): Promise<SpFullArtist[]> {
  const page = await spotifyGet<SpPaged<SpFullArtist>>(`/me/top/artists?time_range=${timeRange}&limit=${limit}`)
  return page.items
}

export async function fetchFollowedArtists(limit = 50): Promise<SpFullArtist[]> {
  const data = await spotifyGet<{ artists: SpPaged<SpFullArtist> }>(`/me/following?type=artist&limit=${limit}`)
  return data.artists.items
}

export async function checkFollowingArtists(ids: string[]): Promise<boolean[]> {
  return spotifyGet<boolean[]>(`/me/following/contains?type=artist&ids=${ids.join(',')}`)
}

export async function followArtists(ids: string[]): Promise<void> {
  return spotifyMutate('PUT', '/me/following', { type: 'artist', ids })
}

export async function unfollowArtists(ids: string[]): Promise<void> {
  return spotifyMutate('DELETE', `/me/following?type=artist&ids=${ids.join(',')}`)
}

export async function checkFollowedPlaylist(playlistId: string): Promise<boolean> {
  const result = await spotifyGet<boolean[]>(`/playlists/${playlistId}/followers/contains`).catch(() => [false])
  return result[0] ?? false
}

export async function followPlaylist(playlistId: string): Promise<void> {
  return spotifyMutate('PUT', `/playlists/${playlistId}/followers`)
}

export async function unfollowPlaylist(playlistId: string): Promise<void> {
  return spotifyMutate('DELETE', `/playlists/${playlistId}/followers`)
}

export async function fetchArtist(id: string): Promise<SpFullArtist> {
  return spotifyGet<SpFullArtist>(`/artists/${id}`)
}

export async function fetchArtists(ids: string[]): Promise<SpFullArtist[]> {
  const data = await spotifyGet<{ artists: SpFullArtist[] }>(`/artists?ids=${ids.join(',')}`)
  return data.artists
}

export async function fetchArtistAlbums(
  id: string,
  params: { limit?: number; offset?: number; include_groups?: string; market?: string } = {}
): Promise<SpotifyPage<Album>> {
  const q = new URLSearchParams(Object.entries({ limit: 50, ...params }).map(([k, v]) => [k, String(v)]))
  const page = await spotifyGet<SpPaged<SpSimpleAlbum2>>(`/artists/${id}/albums?${q.toString()}`)
  return {
    items: page.items.map(mapSimpleAlbum),
    next: page.next,
    total: page.total ?? null,
  }
}

export async function fetchArtistTopTracks(id: string): Promise<Track[]> {
  const data = await spotifyGet<{ tracks: SpTrack[] }>(`/artists/${id}/top-tracks`)
  return data.tracks.map(mapTrack).filter((t): t is Track => t !== null)
}

export async function fetchSimilarArtists(id: string): Promise<SpFullArtist[]> {
  const data = await spotifyGet<{ artists: SpFullArtist[] }>(`/artists/${id}/related-artists`)
  return data.artists
}

export interface SearchResults {
  tracks: Track[]
  albums: Album[]
  artists: SpFullArtist[]
  playlists: Playlist[]
}

export async function search(
  q: string,
  types: Array<'track' | 'album' | 'artist' | 'playlist'> = ['track', 'album', 'artist', 'playlist'],
  limit = 20,
): Promise<SearchResults> {
  const params = new URLSearchParams({ q, type: types.join(','), limit: String(limit) })
  const data = await spotifyGet<{
    tracks?: SpPaged<SpTrack>
    albums?: SpPaged<SpSimpleAlbum2>
    artists?: SpPaged<SpFullArtist>
    playlists?: SpPaged<SpSimplePlaylist | null>
  }>(`/search?${params.toString()}`)
  return {
    tracks: (data.tracks?.items ?? []).map(mapTrack).filter((t): t is Track => t !== null),
    albums: (data.albums?.items ?? []).map(mapSimpleAlbum),
    artists: data.artists?.items ?? [],
    playlists: (data.playlists?.items ?? []).filter((pl): pl is SpSimplePlaylist => pl !== null).map(mapPlaylistSummary),
  }
}

export async function fetchCategories(limit = 50): Promise<SpCategory[]> {
  const data = await spotifyGet<{ categories: SpPaged<SpCategory> }>(`/browse/categories?limit=${limit}`)
  return data.categories.items
}

export async function fetchCategory(id: string): Promise<SpCategory> {
  return spotifyGet<SpCategory>(`/browse/categories/${id}`)
}

export async function fetchCategoryPlaylists(categoryId: string, limit = 20): Promise<Playlist[]> {
  const data = await spotifyGet<{ playlists: SpPaged<SpSimplePlaylist> }>(`/browse/categories/${categoryId}/playlists?limit=${limit}`)
  return data.playlists.items.map(mapPlaylistSummary)
}

export async function fetchFeaturedPlaylists(limit = 20): Promise<Playlist[]> {
  const data = await spotifyGet<{ playlists: SpPaged<SpSimplePlaylist> }>(`/browse/featured-playlists?limit=${limit}`)
  return data.playlists.items.map(mapPlaylistSummary)
}

export async function fetchNewReleases(limit = 20): Promise<Album[]> {
  const data = await spotifyGet<{ albums: SpPaged<SpSimpleAlbum2> }>(`/browse/new-releases?limit=${limit}`)
  return data.albums.items.map(mapSimpleAlbum)
}

export async function fetchRecommendations(params: {
  seed_artists?: string
  seed_genres?: string
  seed_tracks?: string
  limit?: number
}): Promise<Track[]> {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const data = await spotifyGet<{ tracks: SpTrack[] }>(`/recommendations?${q.toString()}`)
  return data.tracks.map(mapTrack).filter((t): t is Track => t !== null)
}

export async function createPlaylist(
  userId: string,
  data: { name: string; public?: boolean; collaborative?: boolean; description?: string }
): Promise<Playlist> {
  const pl = await spotifyPost<SpSimplePlaylist>(`/users/${userId}/playlists`, data)
  return mapPlaylistSummary(pl)
}

export async function addPlaylistItems(playlistId: string, uris: string[], snapshot_id?: string): Promise<void> {
  return spotifyMutate('POST', `/playlists/${playlistId}/tracks`, { uris, ...(snapshot_id ? { snapshot_id } : {}) })
}

export async function removePlaylistItems(playlistId: string, uris: string[], snapshot_id: string): Promise<void> {
  return spotifyMutate('DELETE', `/playlists/${playlistId}/tracks`, {
    tracks: uris.map(uri => ({ uri })),
    snapshot_id,
  })
}

export async function reorderPlaylistItems(
  playlistId: string,
  rangeStart: number,
  insertBefore: number,
  rangeLength: number,
  snapshotId: string,
): Promise<void> {
  return spotifyMutate('PUT', `/playlists/${playlistId}/tracks`, {
    range_start: rangeStart,
    insert_before: insertBefore,
    range_length: rangeLength,
    snapshot_id: snapshotId,
  })
}

export async function changePlaylistDetails(
  playlistId: string,
  data: { name?: string; public?: boolean; collaborative?: boolean; description?: string }
): Promise<void> {
  return spotifyMutate('PUT', `/playlists/${playlistId}`, data)
}

export async function fetchCurrentUser(): Promise<SpUser> {
  return spotifyGet<SpUser>('/me')
}

export async function fetchUser(id: string): Promise<SpUser> {
  return spotifyGet<SpUser>(`/users/${id}`)
}
