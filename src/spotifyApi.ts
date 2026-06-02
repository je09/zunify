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

export const LIBRARY_BATCH_LIMIT = 20
export const TRACK_BATCH_LIMIT = 50

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
interface SpPaged<T> { items: T[]; next: string | null; total?: number }
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

export interface SpotifyPage<T> {
  items: T[]
  next: string | null
  total: number | null
}

async function spPage<T>(path: string): Promise<SpotifyPage<T>> {
  const page = await spGet<SpPaged<T>>(path)

  return {
    items: page.items,
    next: page.next,
    total: page.total ?? null,
  }
}

export async function fetchSavedAlbumsPage(cursor = `/me/albums?limit=${LIBRARY_BATCH_LIMIT}`): Promise<SpotifyPage<Album>> {
  const page = await spPage<{ album: SpAlbum }>(cursor)

  return {
    items: page.items.map(({ album }) => mapAlbum(album)),
    next: page.next,
    total: page.total,
  }
}

export async function fetchLikedTracksPage(cursor = `/me/tracks?limit=${TRACK_BATCH_LIMIT}`): Promise<SpotifyPage<Track>> {
  const page = await spPage<{ track: SpTrack }>(cursor)

  return {
    items: page.items.map(({ track }) => mapTrack(track)),
    next: page.next,
    total: page.total,
  }
}

export async function fetchUserPlaylistsPage(cursor = `/me/playlists?limit=${LIBRARY_BATCH_LIMIT}`): Promise<SpotifyPage<Playlist>> {
  const page = await spPage<SpSimplePlaylist>(cursor)

  return {
    items: page.items.map(mapPlaylistSummary),
    next: page.next,
    total: page.total,
  }
}

export async function fetchPlaylistTracksPage(playlistId: string, cursor?: string | null): Promise<SpotifyPage<Track>> {
  const page = await spPage<{ track: SpTrack | null }>(
    cursor ?? `/playlists/${playlistId}/tracks?limit=${TRACK_BATCH_LIMIT}&fields=items(track(uri,name,duration_ms,preview_url,artists,album(name,images))),next,total`
  )

  return {
    items: page.items
      .filter(it => it.track !== null)
      .map(it => mapTrack(it.track!)),
    next: page.next,
    total: page.total,
  }
}

function mapPlaylistSummary(pl: SpSimplePlaylist): Playlist {
  return {
    id: pl.id,
    name: pl.name,
    items: [],
    tracks: [],
    totalTracks: pl.tracks.total,
    trackNextUrl: `/playlists/${pl.id}/tracks?limit=${TRACK_BATCH_LIMIT}&fields=items(track(uri,name,duration_ms,preview_url,artists,album(name,images))),next,total`,
  }
}

export async function fetchSavedAlbums(): Promise<Album[]> {
  return (await fetchSavedAlbumsPage()).items
}

export async function fetchLikedSongsPlaylist(): Promise<Playlist> {
  const page = await fetchLikedTracksPage()

  return {
    id: 'sp_liked',
    name: 'liked songs',
    items: [],
    tracks: page.items,
    totalTracks: page.total ?? page.items.length,
    trackNextUrl: page.next,
  }
}

export async function fetchUserPlaylists(): Promise<Playlist[]> {
  return (await fetchUserPlaylistsPage()).items
}

export async function fetchAlbum(id: string): Promise<Album> {
  return mapAlbum(await spGet<SpAlbum>(`/albums/${id}`))
}
