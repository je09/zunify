import { useEffect, useRef } from 'react'
import { Track } from '../../data'
import { pausePlayback, startPlayback as startPlaybackApi } from '../../spotifyApi'

let installedSpy = false

function logMediaSessionDebug(event: string, data: Record<string, unknown>) {
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env
  if (typeof window === 'undefined') return
  const host = window.location.hostname
  const isPrivateHost = host === 'localhost'
    || host === '127.0.0.1'
    || host.startsWith('192.168.')
    || host.startsWith('10.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  const forced = window.localStorage.getItem('zplayer:media-session-debug') === '1'
  if (!env?.DEV && !isPrivateHost && !forced) return
  console.log(`[media-session] ${event}`, data)
}

function installMediaSessionSpy(ref: { current: () => void }) {
  if (installedSpy) return
  installedSpy = true

  const proto = Object.getPrototypeOf(navigator.mediaSession)
  const desc = Object.getOwnPropertyDescriptor(proto, 'metadata')

  Object.defineProperty(navigator.mediaSession, 'metadata', {
    get() { return desc?.get?.call(navigator.mediaSession) },
    set(value) {
      desc?.set?.call(navigator.mediaSession, value)
      const title = (value as MediaMetadata & { title?: string })?.title ?? ''
      if (title.includes('Spotify')) {
        logMediaSessionDebug('spider-rewritten', { title })
        try { ref.current() } catch {}
      }
    },
    configurable: true,
  })

  const origSetPositionState = navigator.mediaSession.setPositionState
  let positionStateApply = false
  navigator.mediaSession.setPositionState = (...args: Parameters<typeof origSetPositionState>) => {
    origSetPositionState(...args)
    if (!positionStateApply) {
      positionStateApply = true
      positionStateApply = false
      try { ref.current() } catch {}
    }
  }
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
  mediaSession.metadata = createMetadata({
    title: track.title, artist: track.artist, album: track.album, artwork,
  })
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

export function useMediaSession({ track, time, duration, playing, inSdk, sdkTimestamp, onLocalPlay, onLocalPause, onNext, onPrev, onSeek }: MediaSessionOptions) {
  const ref = useRef<() => void>(() => {})
  ref.current = () => {
    if (!('mediaSession' in navigator)) return
    applyAppMediaSession({
      mediaSession: navigator.mediaSession,
      createMetadata: init => new MediaMetadata(init),
      track, time, duration, playing, inSdk, sdkTimestamp,
      onLocalPlay, onLocalPause, onNext, onPrev, onSeek,
    })
  }

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
    ref.current()
    installMediaSessionSpy(ref)

    const timeouts = [100, 500, 1500].map(delay => window.setTimeout(ref.current, delay))

    return () => {
      timeouts.forEach(window.clearTimeout)
    }
  }, [duration, inSdk, playing, sdkTimestamp, track.album, track.artist, track.imageUrl, track.title])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!duration) return
    applyAppPositionState(navigator.mediaSession, time, duration)
  }, [duration, time])
}
