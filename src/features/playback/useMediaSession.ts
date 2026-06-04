import { useEffect } from 'react'
import { Track } from '../../data'
import { pausePlayback, startPlayback as startPlaybackApi } from '../../spotifyApi'

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

export function useMediaSession({ track, time, duration, playing, inSdk, sdkTimestamp, onLocalPlay, onLocalPause, onNext, onPrev, onSeek }: MediaSessionOptions) {
  useEffect(() => {
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
    const timeouts = [100, 500, 1500].map(delay => window.setTimeout(applyMediaSession, delay))
    const onVisibilityChange = () => applyMediaSession()
    const onPageShow = () => applyMediaSession()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      timeouts.forEach(window.clearTimeout)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [duration, inSdk, onLocalPause, onLocalPlay, onNext, onPrev, onSeek, playing, sdkTimestamp, track.album, track.artist, track.imageUrl, track.title])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration) return
    try {
      navigator.mediaSession.setPositionState({
        duration, playbackRate: 1,
        position: Math.min(Math.max(0, time), duration),
      })
    } catch { /* old Safari */ }
  }, [duration, time])
}
