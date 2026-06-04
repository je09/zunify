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

export function useMediaSession({ track, time, duration, playing, inSdk, sdkTimestamp, onLocalPlay, onLocalPause, onNext, onPrev, onSeek }: MediaSessionOptions) {
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play', () => {
      if (inSdk) { void startPlaybackApi(); return }
      onLocalPlay()
      void startPlaybackApi().catch(onLocalPause)
    })
    navigator.mediaSession.setActionHandler('pause', () => {
      if (inSdk) { void pausePlayback(); return }
      onLocalPause()
      void pausePlayback().catch(onLocalPlay)
    })
    navigator.mediaSession.setActionHandler('nexttrack', onNext)
    navigator.mediaSession.setActionHandler('previoustrack', onPrev)
    navigator.mediaSession.setActionHandler('seekto', e => {
      if (e.seekTime != null) onSeek(e.seekTime / (duration || 1))
    })
  }, [duration, inSdk, onLocalPause, onLocalPlay, onNext, onPrev, onSeek])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!track.title) {
      navigator.mediaSession.metadata = null
      navigator.mediaSession.playbackState = 'none'
      return
    }
    const artwork: MediaImage[] = track.imageUrl
      ? [{ src: track.imageUrl, sizes: '640x640', type: 'image/jpeg' }]
      : []
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title, artist: track.artist, album: track.album, artwork,
    })
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [track.title, track.artist, track.album, track.imageUrl, playing, sdkTimestamp])

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
