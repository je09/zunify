// ---------------------------------------------------------------------------
// Playback hook — three engine modes:
//
//   'sdk'   — Spotify Web Playback SDK (Premium, full tracks).
//              Activated when a SpotifyEngine is passed AND current track
//              has a spotifyUri.  Controls/state proxied to SDK.
//
//   'audio' — <audio> element for any URL (preview_url, local MP3).
//              Activated when track has previewUrl and SDK engine not active.
//
//   'raf'   — requestAnimationFrame timer simulation (no real audio).
//              Fallback when neither of the above applies.
//
// The UI layer never selects an engine — it only calls play/toggle/etc.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react'
import { Track, albumQueue, ALBUMS } from '../data'
import type { SpotifyEngine } from '../useSpotifyPlayer'

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

export function usePlayback(spotify?: SpotifyEngine | null): PlaybackState {
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

  // Active engine for the current track
  const engine: 'sdk' | 'audio' | 'raf' =
    spotify != null && Boolean(track?.spotifyUri) ? 'sdk'
    : Boolean(track?.previewUrl) ? 'audio'
    : 'raf'

  // ── Media Session ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.imageUrl
        ? [{ src: track.imageUrl, sizes: '600x600', type: 'image/jpeg' }]
        : [],
    })
    navigator.mediaSession.setActionHandler('play', () => setPlaying(true))
    navigator.mediaSession.setActionHandler('pause', () => setPlaying(false))
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      setIdx(i => (i + 1) % queue.length); setTime(0)
    })
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      setIdx(i => (i - 1 + queue.length) % queue.length); setTime(0)
    })
  }, [track.title, track.artist, track.album, track.imageUrl, queue.length])

  useEffect(() => {
    const nextTracks = Array.from({ length: Math.min(5, queue.length - 1) }, (_, i) => queue[(idx + i + 1) % queue.length])
    const images: HTMLImageElement[] = []
    const audios: HTMLAudioElement[] = []

    nextTracks.forEach((t) => {
      if (t.imageUrl) {
        const image = new Image()
        image.src = t.imageUrl
        images.push(image)
      }
      if (t.previewUrl) {
        const audio = new Audio()
        audio.preload = 'metadata'
        audio.src = t.previewUrl
        audio.load()
        audios.push(audio)
      }
    })

    return () => {
      audios.forEach(audio => {
        audio.removeAttribute('src')
        audio.load()
      })
    }
  }, [idx, queue])

  // ── SDK state sync (engine === 'sdk') ────────────────────────────────────
  useEffect(() => {
    if (engine !== 'sdk' || !spotify?.sdkState) return
    const s = spotify.sdkState
    setTime(s.position / 1000)
    setPlaying(!s.paused)

    // SDK overwrites media session with "Spotify Embedded Player" — override it
    if ('mediaSession' in navigator) {
      const ct = s.track_window.current_track
      navigator.mediaSession.metadata = new MediaMetadata({
        title: ct.name,
        artist: ct.artists.map(a => a.name).join(', '),
        album: ct.album.name,
        artwork: ct.album.images[0]
          ? [{ src: ct.album.images[0].url, sizes: '300x300', type: 'image/jpeg' }]
          : [],
      })
    }

    const uri = s.track_window.current_track.uri
    const newIdx = queue.findIndex(t => t.spotifyUri === uri)
    if (newIdx !== -1 && newIdx !== idx) setIdx(newIdx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotify?.sdkState])

  // ── Audio element lifecycle (engine === 'audio') ─────────────────────────
  useEffect(() => {
    if (engine !== 'audio') return

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
  }, [track.previewUrl, idx, engine])

  useEffect(() => {
    if (engine !== 'audio' || !audioRef.current) return
    if (playing) void audioRef.current.play()
    else audioRef.current.pause()
  }, [playing, engine])

  // ── RAF simulation (engine === 'raf') ────────────────────────────────────
  useEffect(() => {
    if (engine !== 'raf' || !playing) {
      cancelAnimationFrame(rafRef.current)
      lastRef.current = 0
      return
    }

    const step = (ts: number) => {
      if (lastRef.current) {
        setTime(tm => {
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
  }, [playing, engine, idx, repeat, track.dur])

  // ── Helpers ──────────────────────────────────────────────────────────────
  const advanceQueue = useCallback(() => {
    setIdx(i => {
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

    if (spotify && q[i]?.spotifyUri) {
      const uris = q.flatMap(t => t.spotifyUri ? [t.spotifyUri] : [])
      const offset = q.slice(0, i).filter(t => t.spotifyUri).length
      void spotify.startPlayback(uris, offset)
    }
  }, [spotify])

  const toggle = useCallback(() => {
    if (engine === 'sdk' && spotify?.player) {
      void spotify.player.togglePlay()
      return
    }
    setPlaying(p => !p)
  }, [engine, spotify])

  const next = useCallback(() => {
    if (engine === 'sdk' && spotify?.player) {
      void spotify.player.nextTrack()
      return
    }
    advanceQueue()
  }, [engine, spotify, advanceQueue])

  const prev = useCallback(() => {
    if (engine === 'sdk' && spotify?.player) {
      void spotify.player.previousTrack()
      return
    }
    if (time > 3) {
      setTime(0)
      if (audioRef.current) audioRef.current.currentTime = 0
      return
    }
    setIdx(i => (i - 1 + queue.length) % queue.length)
    setTime(0)
  }, [engine, spotify, time, queue.length])

  const seek = useCallback((fraction: number) => {
    if (engine === 'sdk' && spotify?.player) {
      const dur = spotify.sdkState?.duration ?? track.dur * 1000
      void spotify.player.seek(Math.round(fraction * dur))
      return
    }
    const t = fraction * track.dur
    setTime(t)
    if (audioRef.current) audioRef.current.currentTime = t
  }, [engine, spotify, track.dur])

  const toggleFav     = useCallback(() => setFav(v => !v), [])
  const toggleShuffle = useCallback(() => setShuffle(v => !v), [])
  const cycleRepeat   = useCallback(() => setRepeat(r => ((r + 1) % 3) as 0 | 1 | 2), [])

  return {
    queue, idx, track, playing, time, fav, shuffle, repeat, started,
    play, toggle, next, prev, seek,
    toggleFav, toggleShuffle, cycleRepeat,
  }
}
