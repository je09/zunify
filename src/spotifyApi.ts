import { Album, Track, Playlist } from './data'
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

async function spGetAll<T>(first: string): Promise<T[]> {
  const items: T[] = []
  let cursor: string | null = first
  while (cursor) {
    const page: SpPaged<T> = await spGet<SpPaged<T>>(cursor)
    items.push(...page.items)
    cursor = page.next
  }
  return items
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
  album: SpSimpleAlbum
}
interface SpSimpleAlbum {
  id: string
  name: string
  images: SpImage[]
  artists: SpArtist[]
}
interface SpAlbum extends SpSimpleAlbum {
  release_date: string
  tracks: { items: Omit<SpTrack, 'album'>[] }
}
interface SpPaged<T> { items: T[]; next: string | null }
interface SpSimplePlaylist {
  id: string
  name: string
  tracks: { total: number }
  images: SpImage[]
}

// ── Mappers ───────────────────────────────────────────────────────────────────

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

function mapTrack(t: SpTrack): Track {
  return {
    title: t.name,
    dur: Math.round(t.duration_ms / 1000),
    artist: t.artists[0]?.name ?? 'Unknown',
    album: t.album.name,
    color: '#555',
    imageUrl: t.album.images[0]?.url,
    previewUrl: t.preview_url ?? undefined,
    spotifyUri: t.uri,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchSavedAlbums(): Promise<Album[]> {
  const items = await spGetAll<{ album: SpAlbum }>('/me/albums?limit=50')
  return items.map(({ album }) => mapAlbum(album))
}

export async function fetchLikedSongsPlaylist(): Promise<Playlist> {
  const items = await spGetAll<{ track: SpTrack }>('/me/tracks?limit=50')
  return {
    id: 'sp_liked',
    name: 'liked songs',
    items: [],
    tracks: items.map(({ track }) => mapTrack(track)),
  }
}

export async function fetchUserPlaylists(): Promise<Playlist[]> {
  const playlists = await spGetAll<SpSimplePlaylist>('/me/playlists?limit=50')
  return Promise.all(
    playlists.map(async (pl): Promise<Playlist> => {
      const trackItems = await spGetAll<{ track: SpTrack | null }>(
        `/playlists/${pl.id}/tracks?limit=100&fields=items(track(uri,name,duration_ms,preview_url,artists,album(name,images))),next`
      )
      return {
        id: pl.id,
        name: pl.name,
        items: [],
        tracks: trackItems
          .filter(it => it.track !== null)
          .map(it => mapTrack(it.track!)),
      }
    })
  )
}

export async function fetchAlbum(id: string): Promise<Album> {
  return mapAlbum(await spGet<SpAlbum>(`/albums/${id}`))
}
