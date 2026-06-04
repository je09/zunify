import { Playlist } from '../../data'
import { spotifyGet } from './client'
import type { SpPaged, SpSimplePlaylist } from './types'

export const LIBRARY_BATCH_LIMIT = 20
export const TRACK_BATCH_LIMIT = 50

export interface SpotifyPage<T> {
  items: T[]
  next: string | null
  total: number | null
}

export async function spotifyPage<T>(path: string): Promise<SpotifyPage<T>> {
  const page = await spotifyGet<SpPaged<T>>(path)
  return { items: page.items, next: page.next, total: page.total ?? null }
}

export function mapPlaylistSummary(pl: SpSimplePlaylist): Playlist {
  return {
    id: pl.id,
    name: pl.name,
    items: [],
    imageUrl: pl.images?.[0]?.url,
    tracks: [],
    totalTracks: pl.tracks.total,
    trackNextUrl: `/playlists/${pl.id}/tracks?limit=${TRACK_BATCH_LIMIT}&fields=items(track(type,uri,name,duration_ms,preview_url,artists,album(id,name,images,artists))),next,total`,
  }
}
