import { Album, Track } from '../../data'
import { SpAlbum, SpSimpleAlbum2, SpTrack } from './types'

export function mapAlbum(a: SpAlbum): Album | null {
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

export function mapSimpleAlbum(a: SpSimpleAlbum2): Album {
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

export function mapTrack(t: SpTrack | null): Track | null {
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
