import { useEffect } from 'react'
import { Track } from '../../data'
import { pausePlayback, startPlayback as startPlaybackApi } from '../../spotifyApi'

function logMediaSessionDebug(event: string, data: Record<string, unknown>) {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env
  if (typeof window === 'undefined') return
  const host = window.location.hostname
  const isPrivateHost = host === 'localhost'
    || host === '127.0.0.1'
    || host.startsWith('192.168.')
    || host.startsWith('10.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  const forced = window.localStorage.getItem('zunify:media-session-debug') === '1'
  if (!env?.DEV && !isPrivateHost && !forced) return
  console.log(`[media-session] ${event}`, data)
}

interface MediaSessionOptions {
  track: Track
  time: number
  duration: number
  playing: boolean
  inSdk: boolean
  sdkTimestamp?: number
  onLocalPlay: () => void
  onLocalPause: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (fraction: number) => void
}

interface ApplyMediaSessionOptions extends MediaSessionOptions {
  mediaSession: MediaSession
  createMetadata: (init: MediaMetadataInit) => MediaMetadata
}

function setMediaSessionHandler(mediaSession: MediaSession, action: MediaSessionAction, handler: MediaSessionActionHandler | null) {
  try {
    mediaSession.setActionHandler(action, handler)
  } catch { /* unsupported action */ }
}

function normalizeSeekTime(seekTime: number, duration: number) {
  if (!Number.isFinite(seekTime) || !duration) return null
  if (seekTime > duration && seekTime / 1000 <= duration) return seekTime / 1000
  return Math.min(Math.max(0, seekTime), duration)
}

export function applyAppMediaSession({ mediaSession, createMetadata, track, duration, playing, inSdk, onLocalPlay, onLocalPause, onNext, onPrev, onSeek }: ApplyMediaSessionOptions) {
  setMediaSessionHandler(mediaSession, 'play', () => {
    if (inSdk) { void startPlaybackApi(); return }
    onLocalPlay()
    void startPlaybackApi().catch(onLocalPause)
  })
  setMediaSessionHandler(mediaSession, 'pause', () => {
    if (inSdk) { void pausePlayback(); return }
    onLocalPause()
    void pausePlayback().catch(onLocalPlay)
  })
  setMediaSessionHandler(mediaSession, 'nexttrack', onNext)
  setMediaSessionHandler(mediaSession, 'previoustrack', onPrev)
  setMediaSessionHandler(mediaSession, 'seekto', e => {
    if (e.seekTime == null) return
    const seekTime = normalizeSeekTime(e.seekTime, duration)
    logMediaSessionDebug('seekto', {
      rawSeekTime: e.seekTime,
      duration,
      normalizedSeekTime: seekTime,
      fraction: seekTime == null ? null : seekTime / duration,
      wasInflated: e.seekTime > duration && e.seekTime / 1000 <= duration,
    })
    if (seekTime != null) onSeek(seekTime / duration)
  })
  setMediaSessionHandler(mediaSession, 'seekbackward', null)
  setMediaSessionHandler(mediaSession, 'seekforward', null)

  if (!track.title) {
    mediaSession.metadata = null
    mediaSession.playbackState = 'none'
    return
  }
  const artwork: MediaImage[] = track.imageUrl
    ? [{ src: track.imageUrl, sizes: '640x640', type: 'image/jpeg' }]
    : []
  // iOS Safari caches Media Session metadata aggressively.
  // Force refresh by clearing then re-setting metadata.
  const metadata = createMetadata({
    title: track.title, artist: track.artist, album: track.album, artwork,
  })
  mediaSession.metadata = metadata
  mediaSession.playbackState = playing ? 'playing' : 'paused'
}

export function applyAppPositionState(mediaSession: MediaSession, time: number, duration: number) {
  if (!duration) return
  const position = Math.min(Math.max(0, time), duration)
  logMediaSessionDebug('position-state', { time, duration, position })
  try {
    mediaSession.setPositionState({
      duration, playbackRate: 1,
      position,
    })
  } catch { /* old Safari */ }
}

// Synchronous reclaim: called by useSpotifyPlayer immediately after player_state_changed
// so our handlers win before SDK's postMessage re-registration arrives.
export const mediaSessionReclaimRef: { current: (() => void) | null } = { current: null }

export function useMediaSession({ track, time, duration, playing, inSdk, sdkTimestamp, onLocalPlay, onLocalPause, onNext, onPrev, onSeek }: MediaSessionOptions) {
  useEffect(() => {
    logMediaSessionDebug('metadata-effect', {
      hasMediaSession: 'mediaSession' in navigator,
      title: track.title,
      duration,
      playing,
      inSdk,
      sdkTimestamp,
    })
    if (!('mediaSession' in navigator)) return
    const applyMediaSession = () => {
      if (!('mediaSession' in navigator)) return
      applyAppMediaSession({
        mediaSession: navigator.mediaSession,
        createMetadata: init => new MediaMetadata(init),
        track, time, duration, playing, inSdk, sdkTimestamp,
        onLocalPlay, onLocalPause, onNext, onPrev, onSeek,
      })
    }

    applyMediaSession()
    mediaSessionReclaimRef.current = applyMediaSession

    // Continuously reclaim metadata from Spotify SDK.
    // Spotify overwrites navigator.mediaSession.metadata on every state change
    // despite enableMediaSession: false. We apply faster than it does.
    const interval = window.setInterval(applyMediaSession, 2000)
    const timeouts = [100, 500, 1500].map(delay => window.setTimeout(applyMediaSession, delay))
    const onVisibilityChange = () => applyMediaSession()
    const onPageShow = () => applyMediaSession()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      mediaSessionReclaimRef.current = null
      timeouts.forEach(window.clearTimeout)
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [duration, inSdk, playing, sdkTimestamp, track.album, track.artist, track.imageUrl, track.title, onLocalPlay, onLocalPause, onNext, onPrev, onSeek])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!duration) return
    applyAppPositionState(navigator.mediaSession, time, duration)
  }, [duration, time])
}
