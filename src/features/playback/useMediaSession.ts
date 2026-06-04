import { useEffect } from 'react'
import { Track } from '../../data'
import { pausePlayback, startPlayback as startPlaybackApi } from '../../spotifyApi'

interface MediaSessionOptions {
  track: Track
  time: number
  duration: number
  inSdk: boolean
  onLocalPlay: () => void
  onLocalPause: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (fraction: number) => void
}

export function useMediaSession({ track, time, duration, inSdk, onLocalPlay, onLocalPause, onNext, onPrev, onSeek }: MediaSessionOptions) {
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play', () => inSdk ? void startPlaybackApi() : onLocalPlay())
    navigator.mediaSession.setActionHandler('pause', () => inSdk ? void pausePlayback() : onLocalPause())
    navigator.mediaSession.setActionHandler('nexttrack', onNext)
    navigator.mediaSession.setActionHandler('previoustrack', onPrev)
    navigator.mediaSession.setActionHandler('seekto', e => {
      if (e.seekTime != null) onSeek(e.seekTime / (duration || 1))
    })
  }, [duration, inSdk, onLocalPause, onLocalPlay, onNext, onPrev, onSeek])

  useEffect(() => {
    if (!('mediaSession' in navigator) || !track.title) return
    const artwork: MediaImage[] = track.imageUrl
      ? [{ src: track.imageUrl, sizes: '640x640', type: 'image/jpeg' }]
      : []
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title, artist: track.artist, album: track.album, artwork,
    })
  }, [track.title, track.artist, track.album, track.imageUrl])

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
