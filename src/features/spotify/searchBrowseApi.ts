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


export async function fetchNewReleases(limit = 20): Promise<Album[]> {
  const artists = await fetchFollowedArtists()
  if (artists.length === 0) return []

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 6)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const BATCH = 5
  const raw: SpSimpleAlbum2[] = []

  for (let i = 0; i < artists.length; i += BATCH) {
    const batch = artists.slice(i, i + BATCH)
    const pages = await Promise.allSettled(
      batch.map(a =>
        spotifyGet<SpPaged<SpSimpleAlbum2>>(
          `/artists/${a.id}/albums?include_groups=album,single&limit=10`
        )
      )
    )
    for (const result of pages) {
      if (result.status === 'fulfilled') raw.push(...result.value.items)
    }
  }

  const seen = new Set<string>()
  return raw
    .filter(a => (a.release_date ?? '') >= cutoffStr)
    .sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''))
    .filter(a => {
      if (seen.has(a.id)) return false
      seen.add(a.id)
      return true
    })
    .slice(0, limit)
    .map(mapSimpleAlbum)
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
