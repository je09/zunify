import { useEffect, useRef } from 'react'
import { Track } from '../../data'
import { pausePlayback, startPlayback as startPlaybackApi } from '../../spotifyApi'

interface MediaSessionOptions {
  track: Track
  time: number
  duration: number
  playing: boolean
  inSdk: boolean
  sdkTimestamp?: number
  getTime?: () => number
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

function setMediaSessionHandler(mediaSession: MediaSession, action: MediaSessionAction, handler: MediaSessionActionHandler) {
  try {
    mediaSession.setActionHandler(action, handler)
  } catch { /* unsupported action */ }
}

export function applyAppMediaSession({ mediaSession, createMetadata, track, time, duration, playing, inSdk, getTime, onLocalPlay, onLocalPause, onNext, onPrev, onSeek }: ApplyMediaSessionOptions) {
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
    if (e.seekTime != null) onSeek(e.seekTime / (duration || 1))
  })
  setMediaSessionHandler(mediaSession, 'seekbackward', e => {
    onSeek(((getTime?.() ?? time) - (e.seekOffset || 10)) / (duration || 1))
  })
  setMediaSessionHandler(mediaSession, 'seekforward', e => {
    onSeek(((getTime?.() ?? time) + (e.seekOffset || 10)) / (duration || 1))
  })

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
  const timeRef = useRef(time)
  timeRef.current = time

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const applyMediaSession = () => {
      if (!('mediaSession' in navigator)) return
      applyAppMediaSession({
        mediaSession: navigator.mediaSession,
        createMetadata: init => new MediaMetadata(init),
        getTime: () => timeRef.current,
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
