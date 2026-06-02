import { Album } from './data'
import { getValidToken } from './spotifyAuth'

// ── Typed fetch wrapper ───────────────────────────────────────────────────────

async function spGet<T>(path: string): Promise<T> {
  const token = await getValidToken()
  if (!token) throw new Error('not_authenticated')
  const url = path.startsWith('http') ? path : `https://api.spotify.com/v1${path}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`spotify_${res.status}`)
  return res.json() as Promise<T>
}

// ── Spotify response shapes ───────────────────────────────────────────────────

interface SpImage { url: string }
interface SpArtist { name: string }
interface SpTrack {
  uri: string
  name: string
  duration_ms: number
  preview_url: string | null
  artists: SpArtist[]
}
interface SpAlbum {
  id: string
  name: string
  release_date: string
  images: SpImage[]
  artists: SpArtist[]
  tracks: { items: SpTrack[] }
}
interface SpPaged<T> { items: T[]; next: string | null }

// ── Mapper: Spotify album → local Album ──────────────────────────────────────

function mapAlbum(a: SpAlbum): Album {
  return {
    id: a.id,
    artist: a.artists[0]?.name ?? 'Unknown',
    title: a.name,
    year: parseInt(a.release_date.slice(0, 4), 10),
    color: '#555',
    imageUrl: a.images[0]?.url,
    tracks: a.tracks.items.map(t => [t.name, Math.round(t.duration_ms / 1000)] as [string, number]),
    spotifyTrackUris: a.tracks.items.map(t => t.uri),
    spotifyTrackPreviews: a.tracks.items.map(t => t.preview_url ?? undefined),
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchSavedAlbums(): Promise<Album[]> {
  const albums: Album[] = []
  let cursor: string | null = '/me/albums?limit=50'
  while (cursor) {
    const page: SpPaged<{ album: SpAlbum }> = await spGet<SpPaged<{ album: SpAlbum }>>(cursor)
    for (const { album } of page.items) albums.push(mapAlbum(album))
    cursor = page.next
  }
  return albums
}

export async function fetchAlbum(id: string): Promise<Album> {
  return mapAlbum(await spGet<SpAlbum>(`/albums/${id}`))
}
