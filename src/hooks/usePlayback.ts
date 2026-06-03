// ---------------------------------------------------------------------------
// Playback hook — two modes:
//
//   SDK    — Spotify Web Playback SDK active.
//            ALL state read directly from sdkState (no local caching).
//            ALL controls go through REST API (same as thirdparty).
//            Shuffle/repeat/track/time owned by Spotify server.
//
//   Local  — No SDK (no login or no Spotify Premium).
//            <audio> element for previewUrl, requestAnimationFrame otherwise.
//            Shuffle/repeat managed client-side.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from 'react'
import { Track } from '../data'
import type { SpotifyEngine } from '../useSpotifyPlayer'
import {
  setRepeatMode as setRepeatModeApi,
  checkSavedTracks, saveTracks, removeTracks,
  fetchCurrentPlayback, fetchUserQueue,
  pausePlayback, startPlayback as startPlaybackApi,
  skipToNext, skipToPrevious, seekToPosition, setShuffleState,
} from '../spotifyApi'

const NULL_TRACK: Track = { title: '', dur: 0, artist: '', album: '', color: '#000' }

export interface UpNextTrack { title: string; artist: string; imageUrl?: string }

export interface PlaybackState {
  track: Track
  upNext: UpNextTrack[]
  playing: boolean
  time: number
  fav: boolean
  shuffle: boolean
  repeat: 0 | 1 | 2
  started: boolean
  prevDisabled: boolean
  nextDisabled: boolean
  // Local queue exposed for display only (track list screens)
  queue: Track[]
  idx: number
  play: (q: Track[], i: number, contextUri?: string) => void
  toggle: () => void
  next: () => void
  prev: () => void
  seek: (fraction: number) => void
  toggleFav: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
}

export function usePlayback(spotify?: SpotifyEngine | null): PlaybackState {
  // ── Local state — non-SDK mode only ──────────────────────────────────────
  const [localQueue, setLocalQueue]     = useState<Track[]>([])
  const [localIdx, setLocalIdx]         = useState(0)
  const [localPlaying, setLocalPlaying] = useState(false)
  const [localTime, setLocalTime]       = useState(0)
  const [localShuffle, setLocalShuffle] = useState(false)
  const [localRepeat, setLocalRepeat]   = useState<0 | 1 | 2>(0)
  const [started, setStarted]           = useState(false)
  const [fav, setFav]                   = useState(false)

  const audioRef   = useRef<HTMLAudioElement>(new Audio())
  const rafRef     = useRef(0)
  const lastRef    = useRef(0)

  const localRepeatRef  = useRef<0 | 1 | 2>(0)
  const localShuffleRef = useRef(false)
  const localQueueRef   = useRef(localQueue)
  const localIdxRef     = useRef(0)
  const origQueueRef    = useRef<Track[]>([])
  const spotifyRef      = useRef<SpotifyEngine | null | undefined>(undefined)
  const localPlayingRef = useRef(false)
  const favRef          = useRef(false)
  const nextCbRef       = useRef<() => void>(() => {})
  const prevCbRef       = useRef<() => void>(() => {})
  const seekCbRef       = useRef<(f: number) => void>(() => {})
  const gestureDidPlayRef = useRef(false)
  const startupSyncRef = useRef(false)

  localRepeatRef.current  = localRepeat
  localShuffleRef.current = localShuffle
  localQueueRef.current   = localQueue
  localIdxRef.current     = localIdx
  spotifyRef.current      = spotify
  localPlayingRef.current = localPlaying
  favRef.current          = fav

  // ── SDK state derivation ──────────────────────────────────────────────────
  const s = spotify?.sdkState
  const inSdk = spotify != null
  const sdkLive = inSdk && s != null

  const sdkCurrent = sdkLive ? s!.track_window.current_track : null

  const track: Track = sdkCurrent
    ? {
        title:      sdkCurrent.name,
        dur:        s!.duration / 1000,
        artist:     sdkCurrent.artists[0]?.name ?? '',
        album:      sdkCurrent.album.name,
        color:      '#555',
        imageUrl:   sdkCurrent.album.images[0]?.url,
        spotifyUri: sdkCurrent.uri,
      }
    : (localQueue[localIdx] ?? NULL_TRACK)

  const playing = sdkLive ? !s!.paused : localPlaying
  const time    = sdkLive ? s!.position / 1000 : localTime
  const shuffle = sdkLive ? s!.shuffle : localShuffle
  const repeat  = sdkLive ? (s!.repeat_mode as 0 | 1 | 2) : localRepeat

  const upNext: UpNextTrack[] = sdkLive
    ? (s!.track_window.next_tracks ?? []).map(t => ({
        title:    t.name,
        artist:   t.artists[0]?.name ?? '',
        imageUrl: t.album.images[0]?.url,
      }))
    : Array.from({ length: Math.min(5, localQueue.length - 1) }, (_, i) => {
        const t = localQueue[(localIdx + i + 1) % localQueue.length]
        return { title: t.title, artist: t.artist, imageUrl: t.imageUrl }
      })

  const disallows   = sdkLive ? s!.disallows : null
  const prevDisabled = Boolean(disallows?.skipping_prev)
  const nextDisabled = Boolean(disallows?.skipping_next)

  const localEngine: 'audio' | 'raf' =
    Boolean(localQueue[localIdx]?.previewUrl) ? 'audio' : 'raf'

  // ── Startup: mirror active Spotify Connect playback without transfer ──────
  useEffect(() => {
    if (!spotify || startupSyncRef.current) return
    startupSyncRef.current = true
    let live = true

    Promise.all([
      fetchCurrentPlayback(),
      fetchUserQueue().catch(() => ({ currentTrack: null, queue: [] as Track[] })),
    ])
      .then(([current, userQueue]) => {
        if (!live || spotifyRef.current?.sdkState || !current?.track) return
        setLocalQueue([
          current.track,
          ...userQueue.queue.filter(t => t.spotifyUri !== current.track?.spotifyUri),
        ])
        setLocalIdx(0)
        setLocalTime(current.progressMs / 1000)
        setLocalPlaying(current.isPlaying)
        setLocalShuffle(current.shuffle)
        setLocalRepeat(current.repeat)
        setStarted(current.isPlaying)
      })
      .catch(() => {})

    return () => { live = false }
  }, [spotify])

  // ── Media Session: register once ─────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play',  () => inSdk ? void startPlaybackApi() : setLocalPlaying(true))
    navigator.mediaSession.setActionHandler('pause', () => inSdk ? void pausePlayback()    : setLocalPlaying(false))
    navigator.mediaSession.setActionHandler('nexttrack',     () => nextCbRef.current())
    navigator.mediaSession.setActionHandler('previoustrack', () => prevCbRef.current())
    navigator.mediaSession.setActionHandler('seekto', e => {
      if (e.seekTime != null) seekCbRef.current(e.seekTime / (track.dur || 1))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Media Session: metadata ───────────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track.title) return
    const artwork: MediaImage[] = track.imageUrl
      ? [{ src: track.imageUrl, sizes: '640x640', type: 'image/jpeg' }]
      : []
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title, artist: track.artist, album: track.album, artwork,
    })
  }, [track.title, track.artist, track.album, track.imageUrl])

  // ── Media Session: position state ────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track.dur) return
    try {
      navigator.mediaSession.setPositionState({
        duration: track.dur, playbackRate: 1,
        position: Math.min(Math.max(0, time), track.dur),
      })
    } catch { /* old Safari */ }
  }, [time, track.dur])

  // ── SDK: check liked state when current track changes ─────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sdkLive) return
    const id = sdkCurrent?.uri?.split(':')[2]
    if (!id) return
    checkSavedTracks([id]).then(([liked]) => setFav(!!liked)).catch(() => {})
  }, [sdkCurrent?.id])

  // ── Local audio: attach listeners once ────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    const onTimeUpdate = () => setLocalTime(audio.currentTime)
    const onEnded = () => {
      if (localRepeatRef.current === 2) { audio.currentTime = 0; void audio.play(); return }
      setLocalIdx(i => (i + 1) % localQueueRef.current.length)
      setLocalTime(0)
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.src = ''
    }
  }, [])

  // ── Local audio: update src on track change ───────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (inSdk || localEngine !== 'audio') { audio.pause(); return }
    if (gestureDidPlayRef.current) { gestureDidPlayRef.current = false; return }
    const src = localQueue[localIdx]?.previewUrl ?? ''
    audio.src = src
    if (src) { audio.load(); if (localPlayingRef.current) void audio.play() }
  }, [localQueue[localIdx]?.previewUrl, localEngine, localIdx, inSdk])

  // ── Local audio: play/pause sync ─────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (inSdk || localEngine !== 'audio') return
    if (localPlaying && audio.paused && audio.src) void audio.play()
    if (!localPlaying && !audio.paused) audio.pause()
  }, [localPlaying, localEngine, inSdk])

  // ── Local RAF simulation ──────────────────────────────────────────────────
  useEffect(() => {
    const dur = localQueue[localIdx]?.dur ?? 0
    if (inSdk || localEngine !== 'raf' || !localPlaying || dur <= 0) {
      cancelAnimationFrame(rafRef.current); lastRef.current = 0; return
    }
    const step = (ts: number) => {
      if (lastRef.current) {
        setLocalTime(tm => {
          const nt = tm + (ts - lastRef.current) / 1000
          if (nt >= dur) {
            if (localRepeatRef.current === 2) return 0
            setLocalIdx(i => (i + 1) % localQueueRef.current.length)
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
  }, [localPlaying, localEngine, localIdx, localQueue, inSdk])

  // ── Local: prefetch next tracks ───────────────────────────────────────────
  useEffect(() => {
    if (inSdk) return
    const nexts = Array.from({ length: Math.min(5, localQueue.length - 1) },
      (_, i) => localQueue[(localIdx + i + 1) % localQueue.length])
    const audios: HTMLAudioElement[] = []
    nexts.forEach(t => {
      if (t?.imageUrl) { const img = new Image(); img.src = t.imageUrl }
      if (t?.previewUrl) {
        const a = new Audio(); a.preload = 'metadata'; a.src = t.previewUrl; a.load(); audios.push(a)
      }
    })
    return () => audios.forEach(a => { a.removeAttribute('src'); a.load() })
  }, [localIdx, localQueue, inSdk])

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const play = useCallback((q: Track[], i: number, contextUri?: string) => {
    if (!q.length && !contextUri) return
    setStarted(true)

    if (inSdk) {
      if (contextUri) {
        void spotifyRef.current!.startPlaybackContext(contextUri, i)
      } else {
        const uris = q.flatMap(t => t.spotifyUri ? [t.spotifyUri] : [])
        if (uris.length) {
          const offset = q.slice(0, i).filter(t => t.spotifyUri).length
          const MAX = 300
          const window = [...uris.slice(offset), ...uris.slice(0, offset)].slice(0, MAX)
          void spotifyRef.current!.startPlayback(window, 0)
        }
      }
      // Keep local queue for reference (display/fallback)
      setLocalQueue(q)
      setLocalIdx(i)
      return
    }

    // Local mode: pre-shuffle if needed
    let aq = q, ai = i
    if (localShuffleRef.current) {
      const rest = q.filter((_, ri) => ri !== i)
      for (let j = rest.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1))
        ;[rest[j], rest[k]] = [rest[k], rest[j]]
      }
      origQueueRef.current = q
      aq = [q[i], ...rest]; ai = 0
    } else {
      origQueueRef.current = []
    }

    setLocalQueue(aq); setLocalIdx(ai); setLocalTime(0)
    setLocalPlaying(true)

    const t = aq[ai]
    if (t?.previewUrl) {
      const audio = audioRef.current
      audio.src = t.previewUrl; audio.load()
      gestureDidPlayRef.current = true
      void audio.play()
    }
  }, [inSdk])

  const toggle = useCallback(() => {
    if (inSdk && spotifyRef.current?.player) {
      // Use SDK togglePlay — acts on local device directly, no active-device requirement
      void spotifyRef.current.player.togglePlay()
      return
    }
    if (localEngine === 'audio') {
      localPlayingRef.current ? audioRef.current.pause() : void audioRef.current.play()
    }
    setLocalPlaying(p => !p)
  }, [inSdk, s, localEngine])

  const next = useCallback(() => {
    if (inSdk) { void skipToNext(); return }
    setLocalIdx(i => (i + 1) % localQueueRef.current.length); setLocalTime(0)
  }, [inSdk])

  const prev = useCallback(() => {
    if (inSdk) { void skipToPrevious(); return }
    if (localTime > 3) { setLocalTime(0); audioRef.current.currentTime = 0; return }
    setLocalIdx(i => (i - 1 + localQueueRef.current.length) % localQueueRef.current.length)
    setLocalTime(0)
  }, [inSdk, localTime])

  const seek = useCallback((fraction: number) => {
    if (inSdk) {
      // REST API — same as thirdparty's SongProgressBar
      const dur = s?.duration ?? 0
      void seekToPosition(Math.round(fraction * dur))
      return
    }
    const t = fraction * (localQueue[localIdx]?.dur ?? 0)
    setLocalTime(t); audioRef.current.currentTime = t
  }, [inSdk, s, localQueue, localIdx])

  const toggleFav = useCallback(() => {
    const uri = sdkLive ? s!.track_window.current_track.uri : localQueue[localIdxRef.current]?.spotifyUri
    if (uri) {
      const id = uri.split(':')[2]
      if (!id) { setFav(v => !v); return }
      const newFav = !favRef.current
      setFav(newFav)
      ;(newFav ? saveTracks([id]) : removeTracks([id])).catch(() => setFav(!newFav))
      return
    }
    setFav(v => !v)
  }, [sdkLive, s])

  const toggleShuffle = useCallback(() => {
    if (inSdk) {
      void setShuffleState(!s?.shuffle)
      return
    }
    setLocalShuffle(prev => {
      const next = !prev
      if (next) {
        origQueueRef.current = localQueueRef.current
        const cur = localQueueRef.current[localIdxRef.current]
        const rest = localQueueRef.current.filter((_, i) => i !== localIdxRef.current)
        for (let i = rest.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[rest[i], rest[j]] = [rest[j], rest[i]]
        }
        setLocalQueue([cur, ...rest]); setLocalIdx(0)
      } else {
        const orig = origQueueRef.current
        if (orig.length > 0) {
          const cur = localQueueRef.current[localIdxRef.current]
          const ni = orig.indexOf(cur)
          setLocalQueue(orig); setLocalIdx(ni >= 0 ? ni : 0)
          origQueueRef.current = []
        }
      }
      return next
    })
  }, [inSdk, s])

  const cycleRepeat = useCallback(() => {
    if (inSdk) {
      const cur = s?.repeat_mode ?? 0
      const modes = ['off', 'context', 'track'] as const
      void setRepeatModeApi(modes[((cur + 1) % 3) as 0 | 1 | 2])
      return
    }
    setLocalRepeat(r => ((r + 1) % 3) as 0 | 1 | 2)
  }, [inSdk, s])

  nextCbRef.current = next
  prevCbRef.current = prev
  seekCbRef.current = seek

  return {
    track, upNext, playing, time, fav, shuffle, repeat, started,
    prevDisabled, nextDisabled,
    queue: localQueue, idx: localIdx,
    play, toggle, next, prev, seek,
    toggleFav, toggleShuffle, cycleRepeat,
  }
}
