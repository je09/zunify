import { Album, Track, Playlist } from './data'
import { getValidToken } from './spotifyAuth'

// ── Typed fetch wrappers ──────────────────────────────────────────────────────

const BASE = 'https://api.spotify.com/v1'

async function spGet<T>(path: string, attempt = 0): Promise<T> {
  const token = await getValidToken()
  if (!token) throw new Error('not_authenticated')
  const url = path.startsWith('http') ? path : `${BASE}${path}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

  if (res.status === 429) {
    if (attempt >= 4) throw new Error('spotify_rate_limited')
    const wait = parseInt(res.headers.get('Retry-After') ?? String(2 ** attempt), 10)
    await new Promise(r => setTimeout(r, wait * 1000))
    return spGet<T>(path, attempt + 1)
  }

  if (!res.ok) throw new Error(`spotify_${res.status}`)
  return res.json() as Promise<T>
}

async function spMutate(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  params?: Record<string, string | number | boolean>,
): Promise<void> {
  const token = await getValidToken()
  if (!token) throw new Error('not_authenticated')
  let url = path.startsWith('http') ? path : `${BASE}${path}`
  if (params) {
    const q = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    )
    url += '?' + q.toString()
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`spotify_${res.status}`)
}

async function spPost<T>(path: string, body?: unknown, params?: Record<string, string | number | boolean>): Promise<T> {
  const token = await getValidToken()
  if (!token) throw new Error('not_authenticated')
  let url = path.startsWith('http') ? path : `${BASE}${path}`
  if (params) {
    const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
    url += '?' + q.toString()
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) throw new Error(`spotify_${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const LIBRARY_BATCH_LIMIT = 20
export const TRACK_BATCH_LIMIT = 50

// ── Spotify response shapes ───────────────────────────────────────────────────

interface SpImage { url: string }
interface SpArtist { id: string; name: string }
interface SpTrack {
  uri: string
  name: string
  duration_ms: number
  preview_url: string | null
  artists: SpArtist[] | null
  album: SpSimpleAlbum
}
interface SpSimpleAlbum {
  id: string
  name: string
  images: SpImage[] | null
  artists: SpArtist[] | null
}
interface SpSimpleAlbum2 extends SpSimpleAlbum {
  release_date?: string
  album_type?: string
}
interface SpAlbum extends SpSimpleAlbum {
  release_date: string
  tracks: { items: Omit<SpTrack, 'album'>[] } | null
}
interface SpPaged<T> { items: T[]; next: string | null; total?: number }
interface SpSimplePlaylist {
  id: string
  name: string
  tracks: { total: number }
  images: SpImage[] | null
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapAlbum(a: SpAlbum): Album | null {
  if (!a.tracks) return null
  return {
    id: a.id,
    artist: a.artists?.[0]?.name ?? 'Unknown',
    artistId: a.artists?.[0]?.id,
    title: a.name,
    year: parseInt(a.release_date.slice(0, 4), 10),
    color: '#555',
    imageUrl: a.images?.[0]?.url,
    tracks: a.tracks.items.map(t => [t.name, Math.round(t.duration_ms / 1000)] as [string, number]),
    spotifyTrackUris: a.tracks.items.map(t => t.uri),
    spotifyTrackPreviews: a.tracks.items.map(t => t.preview_url ?? undefined),
  }
}

function mapSimpleAlbum(a: SpSimpleAlbum2): Album {
  return {
    id: a.id,
    artist: a.artists?.[0]?.name ?? 'Unknown',
    artistId: a.artists?.[0]?.id,
    title: a.name,
    year: a.release_date ? parseInt(a.release_date.slice(0, 4), 10) : 0,
    color: '#555',
    imageUrl: a.images?.[0]?.url,
    tracks: [],
  }
}

function mapTrack(t: SpTrack | null): Track | null {
  if (!t) return null
  return {
    title: t.name,
    dur: Math.round(t.duration_ms / 1000),
    artist: t.artists?.[0]?.name ?? 'Unknown',
    artistId: t.artists?.[0]?.id,
    album: t.album?.name ?? 'Unknown',
    color: '#555',
    imageUrl: t.album?.images?.[0]?.url,
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
  return { items: page.items, next: page.next, total: page.total ?? null }
}

export async function fetchSavedAlbumsPage(cursor = `/me/albums?limit=${LIBRARY_BATCH_LIMIT}`): Promise<SpotifyPage<Album>> {
  const page = await spPage<{ album: SpAlbum }>(cursor)
  return {
    items: page.items.map(({ album }) => mapAlbum(album)).filter((a): a is Album => a !== null),
    next: page.next,
    total: page.total,
  }
}

export async function fetchLikedTracksPage(cursor = `/me/tracks?limit=${TRACK_BATCH_LIMIT}`): Promise<SpotifyPage<Track>> {
  const page = await spPage<{ track: SpTrack | null }>(cursor)
  return {
    items: page.items.map(({ track }) => mapTrack(track)).filter((t): t is Track => t !== null),
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
    items: page.items.map(({ track }) => mapTrack(track)).filter((t): t is Track => t !== null),
    next: page.next,
    total: page.total,
  }
}

function mapPlaylistSummary(pl: SpSimplePlaylist): Playlist {
  return {
    id: pl.id,
    name: pl.name,
    items: [],
    imageUrl: pl.images?.[0]?.url,
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

export async function fetchAlbum(id: string): Promise<Album | null> {
  return mapAlbum(await spGet<SpAlbum>(`/albums/${id}`))
}

// ── Spotify response shapes (extended) ───────────────────────────────────────

interface SpDevice {
  id: string
  is_active: boolean
  is_private_session: boolean
  is_restricted: boolean
  name: string
  type: string
  volume_percent: number
}

interface SpPlaybackState {
  device: SpDevice
  shuffle_state: boolean
  repeat_state: 'off' | 'track' | 'context'
  is_playing: boolean
  item: SpTrack | null
  progress_ms: number
  timestamp: number
}

interface SpPlayHistory {
  track: SpTrack
  played_at: string
  context: { type: string; uri: string } | null
}

export interface SpotifyArtist {
  id: string
  name: string
  genres: string[]
  popularity: number
  images: SpImage[]
  followers: { total: number }
}
type SpFullArtist = SpotifyArtist

interface SpCategory {
  id: string
  name: string
  icons: SpImage[]
}

// ── Player controls ───────────────────────────────────────────────────────────

export async function fetchPlaybackState(): Promise<SpPlaybackState | null> {
  const token = await getValidToken()
  if (!token) throw new Error('not_authenticated')
  const res = await fetch(`${BASE}/me/player`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 204) return null
  if (!res.ok) throw new Error(`spotify_${res.status}`)
  return res.json() as Promise<SpPlaybackState>
}

export async function transferPlayback(deviceId: string, play = false): Promise<void> {
  return spMutate('PUT', '/me/player', { device_ids: [deviceId], play })
}

export async function getAvailableDevices(): Promise<SpDevice[]> {
  const data = await spGet<{ devices: SpDevice[] }>('/me/player/devices')
  return data.devices
}

export async function startPlayback(
  body: { context_uri?: string; uris?: string[]; offset?: { position: number } } = {}
): Promise<void> {
  return spMutate('PUT', '/me/player/play', body)
}

export async function pausePlayback(): Promise<void> {
  return spMutate('PUT', '/me/player/pause')
}

export async function skipToNext(): Promise<void> {
  return spMutate('POST', '/me/player/next')
}

export async function skipToPrevious(): Promise<void> {
  return spMutate('POST', '/me/player/previous')
}

export async function seekToPosition(position_ms: number): Promise<void> {
  return spMutate('PUT', '/me/player/seek', undefined, { position_ms })
}

export async function setRepeatMode(state: 'track' | 'context' | 'off'): Promise<void> {
  return spMutate('PUT', '/me/player/repeat', undefined, { state })
}

export async function setPlayerVolume(volume_percent: number): Promise<void> {
  return spMutate('PUT', '/me/player/volume', undefined, { volume_percent })
}

export async function setShuffleState(state: boolean): Promise<void> {
  return spMutate('PUT', '/me/player/shuffle', undefined, { state })
}

export async function addToQueue(uri: string): Promise<void> {
  return spMutate('POST', '/me/player/queue', undefined, { uri })
}

export async function getRecentlyPlayed(params: { limit?: number; after?: number; before?: number } = {}): Promise<SpotifyPage<{ track: Track; playedAt: string }>> {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const path = `/me/player/recently-played${q.toString() ? '?' + q.toString() : ''}`
  const page = await spPage<SpPlayHistory>(path)
  return {
    items: page.items
      .map(h => { const t = mapTrack(h.track); return t ? { track: t, playedAt: h.played_at } : null })
      .filter((h): h is { track: Track; playedAt: string } => h !== null),
    next: page.next,
    total: page.total,
  }
}

// ── User library ──────────────────────────────────────────────────────────────

export async function checkSavedTracks(ids: string[]): Promise<boolean[]> {
  return spGet<boolean[]>(`/me/tracks/contains?ids=${ids.join(',')}`)
}

export async function saveTracks(ids: string[]): Promise<void> {
  return spMutate('PUT', '/me/tracks', { ids })
}

export async function removeTracks(ids: string[]): Promise<void> {
  return spMutate('DELETE', '/me/tracks', { ids })
}

export async function saveAlbums(ids: string[]): Promise<void> {
  return spMutate('PUT', '/me/albums', { ids })
}

export async function removeAlbums(ids: string[]): Promise<void> {
  return spMutate('DELETE', '/me/albums', { ids })
}

export async function fetchUserQueue(): Promise<{ currentTrack: Track | null; queue: Track[] }> {
  const data = await spGet<{ currently_playing: SpTrack | null; queue: SpTrack[] }>('/me/player/queue')
  return {
    currentTrack: mapTrack(data.currently_playing),
    queue: data.queue.map(mapTrack).filter((t): t is Track => t !== null),
  }
}

// ── User top / following ──────────────────────────────────────────────────────

export async function fetchTopTracks(timeRange: 'long_term' | 'medium_term' | 'short_term' = 'medium_term', limit = 50): Promise<Track[]> {
  const page = await spGet<SpPaged<SpTrack>>(`/me/top/tracks?time_range=${timeRange}&limit=${limit}`)
  return page.items.map(mapTrack).filter((t): t is Track => t !== null)
}

export async function fetchTopArtists(timeRange: 'long_term' | 'medium_term' | 'short_term' = 'medium_term', limit = 50): Promise<SpFullArtist[]> {
  const page = await spGet<SpPaged<SpFullArtist>>(`/me/top/artists?time_range=${timeRange}&limit=${limit}`)
  return page.items
}

export async function fetchFollowedArtists(limit = 50): Promise<SpFullArtist[]> {
  const data = await spGet<{ artists: SpPaged<SpFullArtist> }>(`/me/following?type=artist&limit=${limit}`)
  return data.artists.items
}

export async function checkFollowingArtists(ids: string[]): Promise<boolean[]> {
  return spGet<boolean[]>(`/me/following/contains?type=artist&ids=${ids.join(',')}`)
}

export async function followArtists(ids: string[]): Promise<void> {
  return spMutate('PUT', '/me/following', { type: 'artist', ids })
}

export async function unfollowArtists(ids: string[]): Promise<void> {
  return spMutate('DELETE', `/me/following?type=artist&ids=${ids.join(',')}`)
}

export async function checkFollowedPlaylist(playlistId: string): Promise<boolean> {
  const result = await spGet<boolean[]>(`/playlists/${playlistId}/followers/contains`).catch(() => [false])
  return result[0] ?? false
}

export async function followPlaylist(playlistId: string): Promise<void> {
  return spMutate('PUT', `/playlists/${playlistId}/followers`)
}

export async function unfollowPlaylist(playlistId: string): Promise<void> {
  return spMutate('DELETE', `/playlists/${playlistId}/followers`)
}

// ── Artists ───────────────────────────────────────────────────────────────────

export async function fetchArtist(id: string): Promise<SpFullArtist> {
  return spGet<SpFullArtist>(`/artists/${id}`)
}

export async function fetchArtists(ids: string[]): Promise<SpFullArtist[]> {
  const data = await spGet<{ artists: SpFullArtist[] }>(`/artists?ids=${ids.join(',')}`)
  return data.artists
}

export async function fetchArtistAlbums(
  id: string,
  params: { limit?: number; offset?: number; include_groups?: string; market?: string } = {}
): Promise<SpotifyPage<Album>> {
  const q = new URLSearchParams(Object.entries({ limit: 50, ...params }).map(([k, v]) => [k, String(v)]))
  const page = await spGet<SpPaged<SpSimpleAlbum2>>(`/artists/${id}/albums?${q.toString()}`)
  return {
    items: page.items.map(mapSimpleAlbum),
    next: page.next,
    total: page.total ?? null,
  }
}

export async function fetchArtistTopTracks(id: string): Promise<Track[]> {
  const data = await spGet<{ tracks: SpTrack[] }>(`/artists/${id}/top-tracks`)
  return data.tracks.map(mapTrack).filter((t): t is Track => t !== null)
}

export async function fetchSimilarArtists(id: string): Promise<SpFullArtist[]> {
  const data = await spGet<{ artists: SpFullArtist[] }>(`/artists/${id}/related-artists`)
  return data.artists
}

// ── Search ────────────────────────────────────────────────────────────────────

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
  const data = await spGet<{
    tracks?: SpPaged<SpTrack>
    albums?: SpPaged<SpAlbum>
    artists?: SpPaged<SpFullArtist>
    playlists?: SpPaged<SpSimplePlaylist>
  }>(`/search?${params.toString()}`)
  return {
    tracks:   (data.tracks?.items   ?? []).map(mapTrack).filter((t): t is Track => t !== null),
    albums:   (data.albums?.items   ?? []).map(mapAlbum).filter((a): a is Album => a !== null),
    artists:  data.artists?.items   ?? [],
    playlists: (data.playlists?.items ?? []).map(mapPlaylistSummary),
  }
}

// ── Browse / categories ───────────────────────────────────────────────────────

export async function fetchCategories(limit = 50): Promise<SpCategory[]> {
  const data = await spGet<{ categories: SpPaged<SpCategory> }>(`/browse/categories?limit=${limit}`)
  return data.categories.items
}

export async function fetchCategory(id: string): Promise<SpCategory> {
  return spGet<SpCategory>(`/browse/categories/${id}`)
}

export async function fetchCategoryPlaylists(categoryId: string, limit = 20): Promise<Playlist[]> {
  const data = await spGet<{ playlists: SpPaged<SpSimplePlaylist> }>(`/browse/categories/${categoryId}/playlists?limit=${limit}`)
  return data.playlists.items.map(mapPlaylistSummary)
}

export async function fetchFeaturedPlaylists(limit = 20): Promise<Playlist[]> {
  const data = await spGet<{ playlists: SpPaged<SpSimplePlaylist> }>(`/browse/featured-playlists?limit=${limit}`)
  return data.playlists.items.map(mapPlaylistSummary)
}

export async function fetchNewReleases(limit = 20): Promise<Album[]> {
  const data = await spGet<{ albums: SpPaged<SpSimpleAlbum2> }>(`/browse/new-releases?limit=${limit}`)
  return data.albums.items.map(mapSimpleAlbum)
}

export async function fetchRecommendations(params: {
  seed_artists?: string
  seed_genres?: string
  seed_tracks?: string
  limit?: number
}): Promise<Track[]> {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const data = await spGet<{ tracks: SpTrack[] }>(`/recommendations?${q.toString()}`)
  return data.tracks.map(mapTrack).filter((t): t is Track => t !== null)
}

// ── Playlist mutations ────────────────────────────────────────────────────────

export async function createPlaylist(
  userId: string,
  data: { name: string; public?: boolean; collaborative?: boolean; description?: string }
): Promise<Playlist> {
  const pl = await spPost<SpSimplePlaylist>(`/users/${userId}/playlists`, data)
  return mapPlaylistSummary(pl)
}

export async function addPlaylistItems(playlistId: string, uris: string[], snapshot_id?: string): Promise<void> {
  return spMutate('POST', `/playlists/${playlistId}/tracks`, { uris, ...(snapshot_id ? { snapshot_id } : {}) })
}

export async function removePlaylistItems(playlistId: string, uris: string[], snapshot_id: string): Promise<void> {
  return spMutate('DELETE', `/playlists/${playlistId}/tracks`, {
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
  return spMutate('PUT', `/playlists/${playlistId}/tracks`, {
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
  return spMutate('PUT', `/playlists/${playlistId}`, data)
}

// ── Current user ──────────────────────────────────────────────────────────────

export interface SpUser {
  id: string
  display_name: string | null
  email: string
  images: SpImage[]
  followers: { total: number }
}

export async function fetchCurrentUser(): Promise<SpUser> {
  return spGet<SpUser>('/me')
}

export async function fetchUser(id: string): Promise<SpUser> {
  return spGet<SpUser>(`/users/${id}`)
}
