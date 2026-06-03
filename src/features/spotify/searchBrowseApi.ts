import { Album, ArtistSummary, Track } from '../../data'
import { spotifyGet } from './client'
import { mapArtist, mapSimpleAlbum, mapTrack } from './mappers'
import { SpotifyPage } from './shared'
import type { SpFullArtist, SpPaged, SpSimpleAlbum2, SpTrack, SpUser } from './types'

export async function fetchFollowedArtists(limit = 50): Promise<ArtistSummary[]> {
  const data = await spotifyGet<{ artists: SpPaged<SpFullArtist> }>(`/me/following?type=artist&limit=${limit}`)
  return data.artists.items.map(mapArtist)
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

export async function fetchCurrentUser(): Promise<SpUser> {
  return spotifyGet<SpUser>('/me')
}
