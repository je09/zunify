import { Track } from '../../data'
import type { SpotifyEngine } from '../../useSpotifyPlayer'
import { UpNextTrack } from './playbackTypes'

export type SpotifyPlayCommand =
  | { type: 'context'; contextUri: string; offsetPosition: number }
  | { type: 'uris'; uris: string[]; offsetIndex: number }

export function buildSpotifyPlayCommand(queue: Track[], idx: number, contextUri?: string): SpotifyPlayCommand | null {
  if (contextUri) return { type: 'context', contextUri, offsetPosition: Math.max(0, idx) }

  const uris = queue.flatMap(t => t.spotifyUri ? [t.spotifyUri] : [])
  if (!uris.length) return null

  const offset = queue.slice(0, idx).filter(t => t.spotifyUri).length
  const max = 300
  return {
    type: 'uris',
    uris: [...uris.slice(offset), ...uris.slice(0, offset)].slice(0, max),
    offsetIndex: 0,
  }
}

export function getSdkTrack(spotify: SpotifyEngine | null | undefined): Track | null {
  const state = spotify?.sdkState
  const current = state?.track_window.current_track
  if (!state || !current) return null
  const albumUri = current.album.uri
  const albumID = albumUri ? albumUri.split(':').pop() : undefined
  const artistId = current.artists[0]?.uri?.split(':').pop()
  return {
    title: current.name,
    dur: state.duration / 1000,
    artist: current.artists[0]?.name ?? '',
    artistId,
    album: current.album.name,
    albumID,
    color: '#555',
    imageUrl: current.album.images[0]?.url,
    spotifyUri: current.uri,
  }
}

export function getSdkUpNext(spotify: SpotifyEngine | null | undefined): UpNextTrack[] {
  return (spotify?.sdkState?.track_window.next_tracks ?? []).map(t => ({
    title: t.name,
    artist: t.artists[0]?.name ?? '',
    imageUrl: t.album.images[0]?.url,
  }))
}

export function getSdkRepeatMode(spotify: SpotifyEngine | null | undefined): 0 | 1 | 2 {
  return (spotify?.sdkState?.repeat_mode ?? 0) as 0 | 1 | 2
}
