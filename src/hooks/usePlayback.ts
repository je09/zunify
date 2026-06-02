// ---------------------------------------------------------------------------
// Playback hook — works in two modes:
//
//   PREVIEW MODE (current): simulated timer via requestAnimationFrame.
//     No real audio. Swapping in Spotify preview URLs:
//     → set track.previewUrl, hook auto-uses <audio> element instead.
//
//   AUDIO MODE (Spotify preview_url or any MP3 URL):
//     The <audio> element is managed internally. Time/duration come from
//     the element's timeupdate / durationchange events. seek() calls
//     audio.currentTime. No RAF needed.
//
//   SPOTIFY WEB PLAYBACK SDK (future — Premium):
//     Replace the audio element branch with SDK calls. The state shape
//     (queue, idx, playing, time, fav, shuffle, repeat) stays the same;
//     only the engine underneath changes.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react'
import { Track, albumQueue, ALBUMS } from '../data'

export interface PlaybackState {
  queue: Track[]
  idx: number
  track: Track
  playing: boolean
  time: number
  fav: boolean
  shuffle: boolean
  repeat: 0 | 1 | 2   // 0 off · 1 all · 2 one
  started: boolean
  play: (q: Track[], i: number) => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (fraction: number) => void
  toggleFav: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
}

export function usePlayback(): PlaybackState {
  const [queue, setQueue]     = useState<Track[]>(() => albumQueue(ALBUMS[0]))
  const [idx, setIdx]         = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime]       = useState(0)
  const [fav, setFav]         = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat]   = useState<0 | 1 | 2>(0)
  const [started, setStarted] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef   = useRef(0)
  const lastRef  = useRef(0)

  const track = queue[idx] ?? queue[0]
  const hasAudio = Boolean(track?.previewUrl)

  // ── Audio element lifecycle ──────────────────────────────────────────────
  useEffect(() => {
    if (!hasAudio) return

    const audio = new Audio(track.previewUrl!)
    audio.preload = 'auto'
    audioRef.current = audio

    const onTimeUpdate = () => setTime(audio.currentTime)
    const onEnded = () => {
      if (repeat === 2) { audio.currentTime = 0; void audio.play(); return }
      advanceQueue()
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    if (playing) void audio.play()

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audioRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.previewUrl, idx])

  useEffect(() => {
    if (!hasAudio || !audioRef.current) return
    if (playing) void audioRef.current.play()
    else audioRef.current.pause()
  }, [playing, hasAudio])

  // ── RAF simulation (no previewUrl) ───────────────────────────────────────
  useEffect(() => {
    if (hasAudio || !playing) {
      cancelAnimationFrame(rafRef.current)
      lastRef.current = 0
      return
    }

    const step = (ts: number) => {
      if (lastRef.current) {
        setTime((tm) => {
          const nt = tm + (ts - lastRef.current) / 1000
          if (nt >= track.dur) {
            if (repeat === 2) return 0
            advanceQueue()
            return 0
          }
          return nt
        })
      }
      lastRef.current = ts
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(rafRef.current); lastRef.current = 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, hasAudio, idx, repeat, track.dur])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const advanceQueue = useCallback(() => {
    setIdx((i) => {
      if (shuffle) {
        let n: number
        do { n = Math.floor(Math.random() * queue.length) } while (n === i && queue.length > 1)
        return n
      }
      return (i + 1) % queue.length
    })
    setTime(0)
  }, [shuffle, queue.length])

  const play = useCallback((q: Track[], i: number) => {
    setQueue(q)
    setIdx(i)
    setTime(0)
    setPlaying(true)
    setStarted(true)
  }, [])

  const toggle = useCallback(() => setPlaying((p) => !p), [])

  const next = useCallback(() => { advanceQueue() }, [advanceQueue])

  const prev = useCallback(() => {
    if (time > 3) { setTime(0); if (audioRef.current) audioRef.current.currentTime = 0; return }
    setIdx((i) => (i - 1 + queue.length) % queue.length)
    setTime(0)
  }, [time, queue.length])

  const seek = useCallback((fraction: number) => {
    const t = fraction * track.dur
    setTime(t)
    if (audioRef.current) audioRef.current.currentTime = t
  }, [track.dur])

  const toggleFav     = useCallback(() => setFav((v) => !v), [])
  const toggleShuffle = useCallback(() => setShuffle((v) => !v), [])
  const cycleRepeat   = useCallback(() => setRepeat((r) => ((r + 1) % 3) as 0 | 1 | 2), [])

  return {
    queue, idx, track, playing, time, fav, shuffle, repeat, started,
    play, toggle, next, prev, seek,
    toggleFav, toggleShuffle, cycleRepeat,
  }
}
