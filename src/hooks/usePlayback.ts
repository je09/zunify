// ---------------------------------------------------------------------------
// Playback hook — three engine modes:
//
//   'sdk'   — Spotify Web Playback SDK (Premium, full tracks).
//              Activated when a SpotifyEngine is passed AND current track
//              has a spotifyUri.  Controls/state proxied to SDK.
//
//   'audio' — <audio> element for any URL (preview_url, local MP3).
//              Activated when track has previewUrl and SDK engine not active.
//              Audio element is persistent (created once) — src is swapped.
//              play() is called synchronously in user-gesture callbacks so
//              iOS doesn't block it.
//
//   'raf'   — requestAnimationFrame timer simulation (no real audio).
//              Fallback when neither of the above applies.
//
// The UI layer never selects an engine — it only calls play/toggle/etc.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react'
import { Track, albumQueue, ALBUMS } from '../data'
import type { SpotifyEngine } from '../useSpotifyPlayer'

export interface UpNextTrack { title: string; artist: string; imageUrl?: string }

export interface PlaybackState {
  queue: Track[]
  idx: number
  track: Track
  upNext: UpNextTrack[]   // 2 upcoming tracks — from SDK state or local queue
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

  // Persistent audio element — never recreated, src is swapped on track change.
  // This keeps play() calls in gesture context (iOS requires it).
  const audioRef   = useRef<HTMLAudioElement>(new Audio())
  const rafRef     = useRef(0)
  const lastRef    = useRef(0)

  // Refs for values used inside closures that must never be stale.
  const repeatRef        = useRef<0 | 1 | 2>(0)
  const shuffleRef       = useRef(false)
  const queueRef         = useRef(queue)
  const idxRef           = useRef(0)
  const originalQueueRef = useRef<Track[]>([])
  const spotifyRef       = useRef<SpotifyEngine | null | undefined>(undefined)
  const playingRef       = useRef(false)
  // Stable refs to latest callbacks — used by Media Session handlers so they
  // don't need to be re-registered on every dep change.
  const nextCbRef   = useRef<() => void>(() => {})
  const prevCbRef   = useRef<() => void>(() => {})
  const seekCbRef   = useRef<(f: number) => void>(() => {})
  const trackRef    = useRef(queue[0])
  // Set to true by the play() callback so the track-change effect knows
  // audio is already playing and should not reload (avoids iOS double-play).
  const gestureDidPlayRef = useRef(false)

  repeatRef.current  = repeat
  shuffleRef.current = shuffle
  queueRef.current   = queue
  idxRef.current     = idx
  spotifyRef.current = spotify
  playingRef.current = playing
  trackRef.current   = queue[idx] ?? queue[0]

  const track = queue[idx] ?? queue[0]

  const engine: 'sdk' | 'audio' | 'raf' =
    spotify != null && Boolean(track?.spotifyUri) ? 'sdk'
    : Boolean(track?.previewUrl) ? 'audio'
    : 'raf'

  // ── advanceQueue ──────────────────────────────────────────────────────────
  // Always linear — when shuffle is on, the queue is pre-shuffled so linear
  // traversal gives shuffle without repeats and with proper next/prev support.
  const advanceQueue = useCallback(() => {
    setIdx(i => (i + 1) % queueRef.current.length)
    setTime(0)
  }, [])

  // ── Media Session: register handlers once ────────────────────────────────
  // Handlers read latest callbacks through refs so they never go stale and
  // don't need to be re-registered on each dep change.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play',  () => setPlaying(true))
    navigator.mediaSession.setActionHandler('pause', () => setPlaying(false))
    navigator.mediaSession.setActionHandler('nexttrack',     () => nextCbRef.current())
    navigator.mediaSession.setActionHandler('previoustrack', () => prevCbRef.current())
    navigator.mediaSession.setActionHandler('seekto', e => {
      if (e.seekTime != null) seekCbRef.current(e.seekTime / (trackRef.current?.dur || 1))
    })
  }, [])

  // ── Media Session: metadata (updates on track change) ─────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return
    // Provide two sizes so iOS can pick the best fit for lock screen / CarPlay.
    const artwork: MediaImage[] = track.imageUrl
      ? [
          { src: track.imageUrl, sizes: '640x640', type: 'image/jpeg' },
          { src: track.imageUrl, sizes: '300x300', type: 'image/jpeg' },
        ]
      : []
    navigator.mediaSession.metadata = new MediaMetadata({
      title:  track.title,
      artist: track.artist,
      album:  track.album,
      artwork,
    })
  }, [track?.title, track?.artist, track?.album, track?.imageUrl])

  // ── Media Session: position state (keeps lock-screen scrubber accurate) ───
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track?.dur) return
    try {
      navigator.mediaSession.setPositionState({
        duration:     track.dur,
        playbackRate: 1,
        position:     Math.min(Math.max(0, time), track.dur),
      })
    } catch {
      // setPositionState is not available in all contexts (e.g. old Safari).
    }
  }, [time, track?.dur])

  // ── Prefetch next tracks ──────────────────────────────────────────────────
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

  // ── Persistent audio element — attach listeners once ──────────────────────
  useEffect(() => {
    const audio = audioRef.current

    const onTimeUpdate = () => setTime(audio.currentTime)
    const onEnded = () => {
      // Use ref so this closure never sees stale repeat value.
      if (repeatRef.current === 2) { audio.currentTime = 0; void audio.play(); return }
      advanceQueue()
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.src = ''
    }
  }, [advanceQueue])

  // ── Audio: update src on track change (next/prev/auto-advance) ────────────
  // play() sets gestureDidPlayRef before triggering a re-render so this effect
  // can skip the reload — audio is already playing in the right gesture context.
  // For all other idx changes (next, prev, auto-advance, shuffle) we always
  // reload so the new track actually starts.
  useEffect(() => {
    const audio = audioRef.current
    if (engine !== 'audio') { audio.pause(); return }

    if (gestureDidPlayRef.current) {
      gestureDidPlayRef.current = false
      return
    }

    const newSrc = track.previewUrl ?? ''
    audio.src = newSrc
    if (newSrc) {
      audio.load()
      if (playingRef.current) void audio.play()
    }
  }, [track.previewUrl, engine, idx])

  // ── Audio: sync play/pause state ──────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (engine !== 'audio') return
    if (playing && audio.paused && audio.src) void audio.play()
    if (!playing && !audio.paused) audio.pause()
  }, [playing, engine])

  // ── SDK state sync (engine === 'sdk') ─────────────────────────────────────
  useEffect(() => {
    if (engine !== 'sdk' || !spotify?.sdkState) return
    const s = spotify.sdkState
    setTime(s.position / 1000)
    setPlaying(!s.paused)

    if ('mediaSession' in navigator) {
      const ct = s.track_window.current_track
      // SDK overwrites Media Session with "Spotify Embedded Player" — restore
      // our metadata with all available artwork sizes for best lock-screen quality.
      const artwork: MediaImage[] = ct.album.images?.length
        ? ct.album.images.map(img => ({
            src: img.url,
            sizes: '640x640',   // Spotify images are square; exact size unknown
            type: 'image/jpeg' as const,
          }))
        : []
      navigator.mediaSession.metadata = new MediaMetadata({
        title:  ct.name,
        artist: ct.artists.map(a => a.name).join(', '),
        album:  ct.album.name,
        artwork,
      })
      try {
        navigator.mediaSession.setPositionState({
          duration:     s.duration / 1000,
          playbackRate: 1,
          position:     Math.min(s.position / 1000, s.duration / 1000),
        })
      } catch { /* old Safari */ }
    }

    const uri = s.track_window.current_track.uri
    const newIdx = queueRef.current.findIndex(t => t.spotifyUri === uri)
    if (newIdx !== -1 && newIdx !== idx) setIdx(newIdx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotify?.sdkState])

  // ── RAF simulation (engine === 'raf') ─────────────────────────────────────
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
            if (repeatRef.current === 2) return 0
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
  }, [playing, engine, idx, track.dur, advanceQueue])

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const play = useCallback((q: Track[], i: number) => {
    if (q.length === 0) return
    const t = q[i]

    // Pre-shuffle for both SDK and non-SDK: Spotify's uris[] endpoint plays tracks
    // in exact order provided (shuffle state only affects context_uri playback).
    // So sending shuffled URIs gives us accurate "Up Next" and no repeats.
    let activeQueue = q
    let activeIdx   = i
    if (shuffleRef.current) {
      const rest = q.filter((_, ri) => ri !== i)
      for (let j = rest.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1))
        ;[rest[j], rest[k]] = [rest[k], rest[j]]
      }
      originalQueueRef.current = q
      activeQueue = [t, ...rest]
      activeIdx   = 0
    } else {
      originalQueueRef.current = []
    }

    setQueue(activeQueue)
    setIdx(activeIdx)
    setTime(0)
    setPlaying(true)
    setStarted(true)

    if (spotifyRef.current && t?.spotifyUri) {
      const allUris     = activeQueue.flatMap(t => t.spotifyUri ? [t.spotifyUri] : [])
      const offsetInAll = activeQueue.slice(0, activeIdx).filter(t => t.spotifyUri).length
      // Spotify rejects bodies over ~1 MB (413). Cap at 300 URIs, starting
      // from the selected track and wrapping, so the full queue is reachable
      // via next/prev within Spotify's context.
      const MAX = 300
      const windowUris = [
        ...allUris.slice(offsetInAll),
        ...allUris.slice(0, offsetInAll),
      ].slice(0, MAX)
      void spotifyRef.current.startPlayback(windowUris, 0)
    } else if (t?.previewUrl) {
      // Call play() synchronously in the user-gesture call stack.
      // iOS blocks audio.play() once we cross an async boundary (useEffect
      // runs after render). gestureDidPlayRef tells the track-change effect
      // that audio is already running so it skips the reload.
      const audio = audioRef.current
      audio.src = t.previewUrl
      audio.load()
      gestureDidPlayRef.current = true
      void audio.play()
    }
  }, [spotify])

  const toggle = useCallback(() => {
    if (engine === 'sdk' && spotify?.player) {
      void spotify.player.togglePlay()
      return
    }
    if (engine === 'audio') {
      // Call play/pause synchronously in gesture context (iOS-safe).
      if (playingRef.current) audioRef.current.pause()
      else void audioRef.current.play()
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
      audioRef.current.currentTime = 0
      return
    }
    setIdx(i => (i - 1 + queueRef.current.length) % queueRef.current.length)
    setTime(0)
  }, [engine, spotify, time])

  const seek = useCallback((fraction: number) => {
    if (engine === 'sdk' && spotify?.player) {
      const dur = spotify.sdkState?.duration ?? track.dur * 1000
      void spotify.player.seek(Math.round(fraction * dur))
      return
    }
    const t = fraction * track.dur
    setTime(t)
    audioRef.current.currentTime = t
  }, [engine, spotify, track.dur])

  const toggleFav   = useCallback(() => setFav(v => !v), [])
  const cycleRepeat = useCallback(() => setRepeat(r => ((r + 1) % 3) as 0 | 1 | 2), [])

  const toggleShuffle = useCallback(() => {
    setShuffle(prev => {
      const next = !prev
      if (next) {
        // Save original order, build shuffled queue with current track pinned first.
        // Traversal stays linear so every track plays exactly once before repeating.
        originalQueueRef.current = queueRef.current
        const cur  = queueRef.current[idxRef.current]
        const rest = queueRef.current.filter((_, i) => i !== idxRef.current)
        for (let i = rest.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[rest[i], rest[j]] = [rest[j], rest[i]]
        }
        setQueue([cur, ...rest])
        setIdx(0)
      } else {
        // Restore original queue; keep playback position on the current track.
        const orig = originalQueueRef.current
        if (orig.length > 0) {
          const cur    = queueRef.current[idxRef.current]
          const newIdx = orig.indexOf(cur)
          setQueue(orig)
          setIdx(newIdx >= 0 ? newIdx : 0)
          originalQueueRef.current = []
        }
      }
      return next
    })
  }, [])

  // Keep Media Session handler refs pointing to the latest callbacks.
  nextCbRef.current = next
  prevCbRef.current = prev
  seekCbRef.current = seek

  // Up Next: prefer Spotify's own queue (accurate even when Spotify shuffles
  // server-side) over our local queue which may be stale after toggle.
  const sdkNextTracks = spotify?.sdkState?.track_window?.next_tracks
  const upNext: UpNextTrack[] = sdkNextTracks && engine === 'sdk'
    ? sdkNextTracks.slice(0, 2).map(t => ({
        title:    t.name,
        artist:   t.artists[0]?.name ?? '',
        imageUrl: t.album.images[0]?.url,
      }))
    : Array.from({ length: Math.min(2, queue.length - 1) }, (_, i) => {
        const t = queue[(idx + i + 1) % queue.length]
        return { title: t.title, artist: t.artist, imageUrl: t.imageUrl }
      })

  return {
    queue, idx, track, upNext, playing, time, fav, shuffle, repeat, started,
    play, toggle, next, prev, seek,
    toggleFav, toggleShuffle, cycleRepeat,
  }
}
