import { Album, ArtistSummary, Track } from '../../data'
import { spotifyGet } from './client'
import { mapArtist, mapSimpleAlbum, mapTrack } from './mappers'
import { SpotifyPage } from './shared'
import type { SpFullArtist, SpPaged, SpSimpleAlbum2, SpTrack, SpUser } from './types'

export async function fetchFollowedArtists(limit = 50): Promise<ArtistSummary[]> {
  const artists: ArtistSummary[] = []
  let next: string | null = `/me/following?type=artist&limit=${limit}`

  while (next) {
    const data: { artists: SpPaged<SpFullArtist> } = await spotifyGet(next)
    artists.push(...data.artists.items.map(mapArtist))
    next = data.artists.next
  }

  return artists
}

export async function fetchArtist(id: string): Promise<ArtistSummary> {
  return mapArtist(await spotifyGet<SpFullArtist>(`/artists/${id}`))
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

export async function fetchCurrentUser(): Promise<SpUser> {
  return spotifyGet<SpUser>('/me')
}

export interface SearchResults {
  tracks: Track[]
  albums: Album[]
  artists: ArtistSummary[]
}

export async function fetchSearch(q: string, limit = 20): Promise<SearchResults> {
  const params = new URLSearchParams({ q, type: 'track,album,artist', limit: String(limit) })
  const data = await spotifyGet<{
    tracks: SpPaged<SpTrack>
    albums: SpPaged<SpSimpleAlbum2>
    artists: SpPaged<SpFullArtist>
  }>(`/search?${params}`)
  return {
    tracks: data.tracks.items.map(mapTrack).filter((t): t is Track => t !== null),
    albums: data.albums.items.map(mapSimpleAlbum),
    artists: data.artists.items.map(mapArtist),
  }
}
