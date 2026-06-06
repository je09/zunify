import { useState, useEffect, useRef, useCallback } from 'react'
import { Track } from '../data'
import type { SpotifyEngine } from '../useSpotifyPlayer'
import type { PlaybackState, UpNextTrack } from '../features/playback/playbackTypes'
import {
  buildSpotifyPlayCommand,
  getSdkRepeatMode,
  getSdkTrack,
  getSdkUpNext,
} from '../features/playback/spotifyPlayback'
import { useMediaSession } from '../features/playback/useMediaSession'
import { claimAudioSession } from '../features/playback/silentAudio'
import { useLibrary } from '../LibraryContext'
import {
  setRepeatMode as setRepeatModeApi,
  fetchCurrentPlayback, fetchUserQueue,
  pausePlayback, skipToNext, skipToNextOnDevice, skipToPrevious, skipToPreviousOnDevice, seekToPosition, setShuffleState,
  startPlayback as startPlaybackApi,
} from '../spotifyApi'

export type { PlaybackState, UpNextTrack } from '../features/playback/playbackTypes'

const NULL_TRACK: Track = { title: '', dur: 0, artist: '', album: '', color: '#000' }

function updateMediaSessionPosition(positionMs: number, duration: number) {
  if (!('mediaSession' in navigator) || !duration) return
  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: 1,
      position: Math.min(Math.max(0, positionMs / 1000), duration),
    })
  } catch { /* old Safari */ }
}

function getQueuedUpNext(queue: Track[], idx: number): UpNextTrack[] {
  if (queue.length <= 1) return []
  return Array.from({ length: Math.min(5, queue.length - 1) }, (_, i) => {
    const t = queue[(idx + i + 1) % queue.length]
    return { title: t.title, artist: t.artist, imageUrl: t.imageUrl }
  })
}

export function usePlayback(spotify?: SpotifyEngine | null): PlaybackState {
  const { savedTrackUris, checkSavedTrackUris, setSavedTrack } = useLibrary()
  const [queue, setQueue] = useState<Track[]>([])
  const [idx, setIdx] = useState(0)
  const [remotePlaying, setRemotePlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [remoteShuffle, setRemoteShuffle] = useState(false)
  const [remoteRepeat, setRemoteRepeat] = useState<0 | 1 | 2>(0)
  const [started, setStarted] = useState(false)
  const [skipPending, setSkipPending] = useState(false)

  const spotifyRef = useRef<SpotifyEngine | null | undefined>(undefined)
  const queueRef = useRef(queue)
  const idxRef = useRef(idx)
  const startupSyncRef = useRef(false)
  const skipPendingRef = useRef(false)
  const sdkBaseRef = useRef<{ position: number; timestamp: number }>({ position: 0, timestamp: 0 })

  spotifyRef.current = spotify
  queueRef.current = queue
  idxRef.current = idx

  const s = spotify?.sdkState
  const sdkLive = spotify != null && s != null
  const sdkPaused = s?.paused
  const sdkCurrent = sdkLive ? s!.track_window.current_track : null
  const track = getSdkTrack(spotify) ?? queue[idx] ?? NULL_TRACK
  const playing = sdkLive ? !s!.paused : remotePlaying
  const shuffle = sdkLive ? s!.shuffle : remoteShuffle
  const repeat = sdkLive ? getSdkRepeatMode(spotify) : remoteRepeat
  const upNext = sdkLive ? getSdkUpNext(spotify) : getQueuedUpNext(queue, idx)
  const disallows = sdkLive ? s!.disallows : null
  const prevDisabled = Boolean(disallows?.skipping_prev)
  const nextDisabled = Boolean(disallows?.skipping_next)
  const duration = track.dur
  const trackUri = sdkLive ? sdkCurrent?.uri : track.spotifyUri
  const fav = Boolean(trackUri && savedTrackUris.has(trackUri))

  useEffect(() => {
    if (startupSyncRef.current) return
    startupSyncRef.current = true
    let live = true

    Promise.all([
      fetchCurrentPlayback(),
      fetchUserQueue().catch(() => ({ currentTrack: null, queue: [] as Track[] })),
    ])
      .then(([current, userQueue]) => {
        if (!live || spotifyRef.current?.sdkState || !current?.track) return
        setQueue([
          current.track,
          ...userQueue.queue.filter(t => t.spotifyUri !== current.track?.spotifyUri),
        ])
        setIdx(0)
        setTime(current.progressMs / 1000)
        setRemotePlaying(current.isPlaying)
        setRemoteShuffle(current.shuffle)
        setRemoteRepeat(current.repeat)
        setStarted(current.isPlaying)
      })
      .catch(() => {})

    return () => { live = false }
  }, [])

  useEffect(() => {
    if (trackUri) checkSavedTrackUris([trackUri])
  }, [trackUri, checkSavedTrackUris])

  useEffect(() => {
    if (!sdkLive || !s) return
    sdkBaseRef.current = { position: s.position, timestamp: Date.now() }
    setTime(s.position / 1000)
  }, [sdkLive, s])

  useEffect(() => {
    if (!sdkLive || sdkPaused) return
    const id = setInterval(() => {
      const b = sdkBaseRef.current
      setTime((b.position + (Date.now() - b.timestamp)) / 1000)
    }, 500)
    return () => clearInterval(id)
  }, [sdkLive, sdkPaused])

  const play = useCallback((q: Track[], i: number, contextUri?: string) => {
    const command = buildSpotifyPlayCommand(q, i, contextUri)
    if (!command) return

    claimAudioSession()
    setStarted(true)
    setQueue(q)
    setIdx(i)
    setTime(0)
    setRemotePlaying(true)

    const engine = spotifyRef.current
    if (engine) void engine.player.activateElement()
    const request = command.type === 'context'
      ? engine
        ? engine.startPlaybackContext(command.contextUri, command.offset)
        : startPlaybackApi({ context_uri: command.contextUri, offset: command.offset })
      : engine
        ? engine.startPlayback(command.uris, command.offsetIndex)
        : startPlaybackApi({ uris: command.uris, offset: { position: command.offsetIndex } })

    void request.catch(() => setRemotePlaying(false))
  }, [])

  const toggle = useCallback(() => {
    claimAudioSession()
    if (spotifyRef.current?.player) {
      void spotifyRef.current.player.activateElement()
      void spotifyRef.current.player.togglePlay()
      return
    }
    if (remotePlaying) {
      setRemotePlaying(false)
      void pausePlayback().catch(() => setRemotePlaying(true))
      return
    }
    setRemotePlaying(true)
    void startPlaybackApi().catch(() => setRemotePlaying(false))
  }, [remotePlaying])

  const timeRef = useRef(time)
  timeRef.current = time

  const next = useCallback(() => {
    if (skipPendingRef.current) return
    skipPendingRef.current = true
    setSkipPending(true)
    const previousIdx = idxRef.current
    const previousTime = timeRef.current
    setTime(0)
    setIdx(i => queueRef.current.length ? (i + 1) % queueRef.current.length : 0)
    const engine = spotifyRef.current
    const request = engine
      ? engine.player.nextTrack().catch(() => skipToNextOnDevice(engine.deviceId))
      : skipToNext()
    void request
      .catch(() => {
        setIdx(previousIdx)
        setTime(previousTime)
      })
      .finally(() => {
        skipPendingRef.current = false
        setSkipPending(false)
      })
  }, [])

  const prev = useCallback(() => {
    if (skipPendingRef.current) return
    const previousIdx = idxRef.current
    const previousTime = timeRef.current
    if (timeRef.current > 3) {
      setTime(0)
      void seekToPosition(0).catch(() => setTime(previousTime))
      return
    }
    skipPendingRef.current = true
    setSkipPending(true)
    setTime(0)
    setIdx(i => queueRef.current.length ? (i - 1 + queueRef.current.length) % queueRef.current.length : 0)
    const engine = spotifyRef.current
    const request = engine
      ? engine.player.previousTrack().catch(() => skipToPreviousOnDevice(engine.deviceId))
      : skipToPrevious()
    void request
      .catch(() => {
        setIdx(previousIdx)
        setTime(previousTime)
      })
      .finally(() => {
        skipPendingRef.current = false
        setSkipPending(false)
      })
  }, [])

  const seek = useCallback((fraction: number) => {
    if (!Number.isFinite(fraction)) return
    const clamped = Math.max(0, Math.min(1, fraction))
    const position = Math.round(clamped * duration * 1000)
    sdkBaseRef.current = { position, timestamp: Date.now() }
    setTime(position / 1000)
    updateMediaSessionPosition(position, duration)

    const player = spotifyRef.current?.player
    if (player) {
      void player.seek(position).catch(() => seekToPosition(position, spotifyRef.current?.deviceId))
      return
    }
    void seekToPosition(position)
  }, [duration])

  const toggleFav = useCallback(() => {
    const uri = sdkLive ? s!.track_window.current_track.uri : queueRef.current[idxRef.current]?.spotifyUri
    if (uri) void setSavedTrack(uri, !savedTrackUris.has(uri)).catch(() => {})
  }, [sdkLive, s, savedTrackUris, setSavedTrack])

  const toggleShuffle = useCallback(() => {
    const nextShuffle = !shuffle
    setRemoteShuffle(nextShuffle)
    const engine = spotifyRef.current
    const request = engine ? engine.setShuffle(nextShuffle) : setShuffleState(nextShuffle)
    void request.catch(() => setRemoteShuffle(!nextShuffle))
  }, [shuffle])

  const cycleRepeat = useCallback(() => {
    const nextRepeat = ((repeat + 1) % 3) as 0 | 1 | 2
    const modes = ['off', 'context', 'track'] as const
    setRemoteRepeat(nextRepeat)
    void setRepeatModeApi(modes[nextRepeat]).catch(() => setRemoteRepeat(repeat))
  }, [repeat])

  const mediaPlay = useCallback(() => setRemotePlaying(true), [])
  const mediaPause = useCallback(() => setRemotePlaying(false), [])

  useMediaSession({
    track,
    time,
    duration,
    playing,
    inSdk: sdkLive,
    sdkTimestamp: s?.timestamp,
    onLocalPlay: mediaPlay,
    onLocalPause: mediaPause,
    onNext: next,
    onPrev: prev,
    onSeek: seek,
  })

  return {
    track, upNext, playing, time, duration, fav, shuffle, repeat, started,
    skipPending, prevDisabled, nextDisabled,
    queue, idx,
    play, toggle, next, prev, seek,
    toggleFav, toggleShuffle, cycleRepeat,
  }
}
