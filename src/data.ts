export interface Track {
  title: string
  dur: number
  artist: string
  artistId?: string
  album: string
  color: string
  imageUrl?: string
  previewUrl?: string
  spotifyUri?: string
}

export interface Album {
  id: string
  artist: string
  artistId?: string
  title: string
  year: number
  color: string
  imageUrl?: string
  tracks: [string, number][]
  spotifyTrackUris?: string[]
  spotifyTrackPreviews?: (string | undefined)[]
}

export interface ArtistSummary {
  id: string
  name: string
  imageUrl?: string
  genres?: string[]
}

export type SongEntry = { title: string; dur: number; artist: string; album: Album; idx: number }

export interface Playlist {
  id: string
  name: string
  items: { a: string; i: number }[]
  imageUrl?: string
  tracks?: Track[]
  totalTracks?: number
  trackNextUrl?: string | null
}

export function albumQueue(a: Album): Track[] {
  return a.tracks.map(([title, dur], i) => ({
    title, dur,
    artist: a.artist,
    artistId: a.artistId,
    album: a.title,
    color: a.color,
    imageUrl: a.imageUrl,
    previewUrl: a.spotifyTrackPreviews?.[i],
    spotifyUri: a.spotifyTrackUris?.[i],
  }))
}

export function playlistQueue(pl: Playlist): Track[] {
  return pl.tracks ?? []
}

export function buildArtists(albums: Album[]): string[] {
  return [...new Set(albums.map(a => a.artist))].sort(
    (x, y) => x.replace(/^the\s+/i, '').localeCompare(y.replace(/^the\s+/i, ''), 'en', { sensitivity: 'base' })
  )
}

export function buildSongs(albums: Album[]): SongEntry[] {
  const out: SongEntry[] = []
  albums.forEach(a =>
    a.tracks.forEach(([title, dur], i) =>
      out.push({ title, dur, artist: a.artist, album: a, idx: i })
    )
  )
  return out.sort((x, y) => x.title.localeCompare(y.title, 'en', { sensitivity: 'base' }))
}

export function artistIdByName(albums: Album[]): Map<string, string> {
  const map = new Map<string, string>()
  albums.forEach(a => { if (a.artistId && !map.has(a.artist)) map.set(a.artist, a.artistId) })
  return map
}

export function fmt(s: number): string {
  const n = Math.max(0, Math.floor(s))
  return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0')
}
