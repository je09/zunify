import { Track } from '../../data'
import { spotifyGet, spotifyMutate, spotifyRequest, SpotifyParams } from './client'
import { mapTrack } from './mappers'
import { spotifyPage, SpotifyPage } from './shared'
import type { SpPlaybackState, SpPlayHistory, SpTrack } from './types'

async function fetchPlaybackState(): Promise<SpPlaybackState | null> {
  const state = await spotifyGet<SpPlaybackState | undefined>('/me/player')
  return state ?? null
}

export async function fetchCurrentPlayback(): Promise<{
  track: Track | null
  isPlaying: boolean
  progressMs: number
  shuffle: boolean
  repeat: 0 | 1 | 2
  volume: number | null
} | null> {
  const state = await fetchPlaybackState()
  if (!state) return null
  const repeat = state.repeat_state === 'track' ? 2 : state.repeat_state === 'context' ? 1 : 0
  return {
    track: mapTrack(state.item),
    isPlaying: state.is_playing,
    progressMs: state.progress_ms,
    shuffle: state.shuffle_state,
    repeat,
    volume: state.device.volume_percent == null ? null : state.device.volume_percent / 100,
  }
}

export async function transferPlayback(deviceId: string, play = false): Promise<void> {
  return spotifyMutate('PUT', '/me/player', { device_ids: [deviceId], play })
}

async function deviceRequest(path: string, deviceId: string, body?: unknown, params?: SpotifyParams): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await spotifyRequest('PUT', path, body, { ...params, device_id: deviceId })
      return
    } catch (e) {
      if (!(e instanceof Error) || e.message !== 'spotify_404' || attempt === 2) throw e
      await transferPlayback(deviceId)
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
    }
  }
}

export async function startPlayback(
  body: { context_uri?: string; uris?: string[]; offset?: { position: number } } = {},
  deviceId?: string,
): Promise<void> {
  if (deviceId) return deviceRequest('/me/player/play', deviceId, body)
  return spotifyMutate('PUT', '/me/player/play', body)
}

export async function pausePlayback(): Promise<void> {
  return spotifyMutate('PUT', '/me/player/pause')
}

export async function skipToNext(): Promise<void> {
  return spotifyMutate('POST', '/me/player/next')
}

export async function skipToPrevious(): Promise<void> {
  return spotifyMutate('POST', '/me/player/previous')
}

export async function seekToPosition(position_ms: number, deviceId?: string): Promise<void> {
  if (deviceId) return deviceRequest('/me/player/seek', deviceId, undefined, { position_ms })
  return spotifyMutate('PUT', '/me/player/seek', undefined, { position_ms })
}

export async function setRepeatMode(state: 'track' | 'context' | 'off'): Promise<void> {
  return spotifyMutate('PUT', '/me/player/repeat', undefined, { state })
}

export async function setShuffleState(state: boolean, deviceId?: string): Promise<void> {
  if (deviceId) return deviceRequest('/me/player/shuffle', deviceId, undefined, { state })
  return spotifyMutate('PUT', '/me/player/shuffle', undefined, { state })
}

export async function getRecentlyPlayed(params: { limit?: number; after?: number; before?: number } = {}): Promise<SpotifyPage<{ track: Track; playedAt: string }>> {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const path = `/me/player/recently-played${q.toString() ? '?' + q.toString() : ''}`
  const page = await spotifyPage<SpPlayHistory>(path)
  return {
    items: page.items
      .map(h => { const t = mapTrack(h.track); return t ? { track: t, playedAt: h.played_at } : null })
      .filter((h): h is { track: Track; playedAt: string } => h !== null),
    next: page.next,
    total: page.total,
  }
}

export async function fetchUserQueue(): Promise<{ currentTrack: Track | null; queue: Track[] }> {
  const data = await spotifyGet<{ currently_playing: SpTrack | null; queue: SpTrack[] }>('/me/player/queue')
  return {
    currentTrack: mapTrack(data.currently_playing),
    queue: data.queue.map(mapTrack).filter((t): t is Track => t !== null),
  }
}
