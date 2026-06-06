import { Album, Playlist, Track } from '../../data'
import { spotifyGet, spotifyMutate } from './client'
import { mapAlbum, mapTrack } from './mappers'
import { LIBRARY_BATCH_LIMIT, mapPlaylistSummary, spotifyPage, SpotifyPage, TRACK_BATCH_LIMIT } from './shared'
import type { SpAlbum, SpSimplePlaylist, SpTrack } from './types'

export async function fetchSavedAlbumsPage(cursor = `/me/albums?limit=${LIBRARY_BATCH_LIMIT}`): Promise<SpotifyPage<Album>> {
  const page = await spotifyPage<{ album: SpAlbum }>(cursor)
  return {
    items: page.items.map(({ album }) => mapAlbum(album)).filter((a): a is Album => a !== null),
    next: page.next,
    total: page.total,
  }
}

export async function fetchLikedTracksPage(cursor = `/me/tracks?limit=${TRACK_BATCH_LIMIT}`): Promise<SpotifyPage<Track>> {
  const page = await spotifyPage<{ track: SpTrack | null }>(cursor)
  return {
    items: page.items.map(({ track }) => mapTrack(track)).filter((t): t is Track => t !== null),
    next: page.next,
    total: page.total,
  }
}

export async function fetchUserPlaylistsPage(cursor = `/me/playlists?limit=${LIBRARY_BATCH_LIMIT}`): Promise<SpotifyPage<Playlist>> {
  const page = await spotifyPage<SpSimplePlaylist>(cursor)
  return {
    items: page.items.map(mapPlaylistSummary),
    next: page.next,
    total: page.total,
  }
}

export async function fetchPlaylistTracksPage(playlistId: string, cursor?: string | null): Promise<SpotifyPage<Track>> {
  const page = await spotifyPage<{ track: SpTrack | null }>(
    cursor ?? `/playlists/${playlistId}/tracks?limit=${TRACK_BATCH_LIMIT}&fields=items(track(type,uri,name,duration_ms,preview_url,artists,album(id,name,images,artists))),next,total`
  )
  return {
    items: page.items.map(({ track }) => mapTrack(track)).filter((t): t is Track => t !== null),
    next: page.next,
    total: page.total,
  }
}

export async function fetchAlbum(id: string): Promise<Album | null> {
  return mapAlbum(await spotifyGet<SpAlbum>(`/albums/${id}`))
}

export async function checkSavedTracks(ids: string[]): Promise<boolean[]> {
  const chunks = Array.from({ length: Math.ceil(ids.length / TRACK_BATCH_LIMIT) }, (_, index) =>
    ids.slice(index * TRACK_BATCH_LIMIT, (index + 1) * TRACK_BATCH_LIMIT)
  )
  const results = await Promise.all(chunks.map(chunk => spotifyGet<boolean[]>(`/me/tracks/contains?ids=${chunk.join(',')}`)))
  return results.flat()
}

export async function checkSavedAlbums(ids: string[]): Promise<boolean[]> {
  if (!ids.length) return []
  return spotifyGet<boolean[]>(`/me/albums/contains?ids=${ids.join(',')}`)
}

export async function saveAlbums(ids: string[]): Promise<void> {
  if (!ids.length) return
  return spotifyMutate('PUT', '/me/albums', { ids })
}

export async function removeAlbums(ids: string[]): Promise<void> {
  if (!ids.length) return
  return spotifyMutate('DELETE', '/me/albums', { ids })
}

export async function saveTracks(ids: string[]): Promise<void> {
  return spotifyMutate('PUT', '/me/tracks', { ids })
}

export async function removeTracks(ids: string[]): Promise<void> {
  return spotifyMutate('DELETE', '/me/tracks', { ids })
}

export async function addTracksToPlaylist(playlistId: string, uris: string[]): Promise<void> {
  if (!uris.length) return
  await spotifyMutate('POST', `/playlists/${playlistId}/tracks`, { uris })
}
