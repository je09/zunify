import { Track } from '../../data'
import type { SpotifyEngine } from '../../useSpotifyPlayer'
import { UpNextTrack } from './playbackTypes'

export function getSdkTrack(spotify: SpotifyEngine | null | undefined): Track | null {
  const state = spotify?.sdkState
  const current = state?.track_window.current_track
  if (!state || !current) return null
  return {
    title: current.name,
    dur: state.duration / 1000,
    artist: current.artists[0]?.name ?? '',
    album: current.album.name,
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
