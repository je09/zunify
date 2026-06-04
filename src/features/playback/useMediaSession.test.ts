import { describe, expect, it, vi } from 'vitest'
import { Track } from '../../data'
import { applyAppMediaSession, applyAppPositionState } from './useMediaSession'

const track: Track = {
  title: 'Correct Track',
  dur: 180,
  artist: 'Correct Artist',
  album: 'Correct Album',
  color: '#333',
  imageUrl: 'https://img.example/cover.jpg',
}

describe('applyAppMediaSession', () => {
  it('restores app metadata and next handler after Spotify overwrites the session', () => {
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler | null>> = {}
    const spotifyNext = vi.fn()
    const appNext = vi.fn()
    const mediaSession = {
      metadata: null as MediaMetadata | null,
      playbackState: 'none' as MediaSessionPlaybackState,
      setActionHandler: vi.fn((action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
        handlers[action] = handler
      }),
    } as unknown as MediaSession
    const apply = () => applyAppMediaSession({
      mediaSession,
      createMetadata: init => init as MediaMetadata,
      track,
      time: 0,
      duration: track.dur,
      playing: true,
      inSdk: true,
      onLocalPlay: vi.fn(),
      onLocalPause: vi.fn(),
      onNext: appNext,
      onPrev: vi.fn(),
      onSeek: vi.fn(),
    })

    apply()
    mediaSession.metadata = { title: 'Spotify Embeded Player', artwork: [] } as unknown as MediaMetadata
    handlers.nexttrack = spotifyNext
    apply()

    expect(mediaSession.metadata).toMatchObject({
      title: 'Correct Track',
      artist: 'Correct Artist',
      album: 'Correct Album',
      artwork: [{ src: 'https://img.example/cover.jpg', sizes: '640x640', type: 'image/jpeg' }],
    })
    expect(mediaSession.playbackState).toBe('playing')

    handlers.nexttrack?.({ action: 'nexttrack' })
    expect(appNext).toHaveBeenCalledOnce()
    expect(spotifyNext).not.toHaveBeenCalled()
  })

  it('normalizes lockscreen seek times inflated by Spotify position state', () => {
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler | null>> = {}
    const onSeek = vi.fn()
    const mediaSession = {
      metadata: null as MediaMetadata | null,
      playbackState: 'none' as MediaSessionPlaybackState,
      setActionHandler: vi.fn((action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
        handlers[action] = handler
      }),
    } as unknown as MediaSession

    applyAppMediaSession({
      mediaSession,
      createMetadata: init => init as MediaMetadata,
      track,
      time: 0,
      duration: track.dur,
      playing: true,
      inSdk: true,
      onLocalPlay: vi.fn(),
      onLocalPause: vi.fn(),
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onSeek,
    })

    handlers.seekto?.({ action: 'seekto', seekTime: 90_000 })

    expect(onSeek).toHaveBeenCalledWith(0.5)
    expect(handlers.seekbackward).toBeNull()
    expect(handlers.seekforward).toBeNull()
  })

  it('uses normal lockscreen seek times when already in seconds', () => {
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler | null>> = {}
    const onSeek = vi.fn()
    const mediaSession = {
      metadata: null as MediaMetadata | null,
      playbackState: 'none' as MediaSessionPlaybackState,
      setActionHandler: vi.fn((action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
        handlers[action] = handler
      }),
    } as unknown as MediaSession

    applyAppMediaSession({
      mediaSession,
      createMetadata: init => init as MediaMetadata,
      track,
      time: 0,
      duration: track.dur,
      playing: true,
      inSdk: true,
      onLocalPlay: vi.fn(),
      onLocalPause: vi.fn(),
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onSeek,
    })

    handlers.seekto?.({ action: 'seekto', seekTime: 90 })

    expect(onSeek).toHaveBeenCalledWith(0.5)
  })

  it('clamps impossible lockscreen seek times to track duration', () => {
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler | null>> = {}
    const onSeek = vi.fn()
    const mediaSession = {
      metadata: null as MediaMetadata | null,
      playbackState: 'none' as MediaSessionPlaybackState,
      setActionHandler: vi.fn((action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
        handlers[action] = handler
      }),
    } as unknown as MediaSession

    applyAppMediaSession({
      mediaSession,
      createMetadata: init => init as MediaMetadata,
      track,
      time: 0,
      duration: track.dur,
      playing: true,
      inSdk: true,
      onLocalPlay: vi.fn(),
      onLocalPause: vi.fn(),
      onNext: vi.fn(),
      onPrev: vi.fn(),
      onSeek,
    })

    handlers.seekto?.({ action: 'seekto', seekTime: 999_999_999 })

    expect(onSeek).toHaveBeenCalledWith(1)
  })
})

describe('applyAppPositionState', () => {
  it('publishes Media Session position in seconds, not milliseconds', () => {
    const mediaSession = {
      setPositionState: vi.fn(),
    } as unknown as MediaSession

    applyAppPositionState(mediaSession, 17.85, 180)

    expect(mediaSession.setPositionState).toHaveBeenCalledWith({
      duration: 180,
      playbackRate: 1,
      position: 17.85,
    })
  })

  it('clamps Media Session position into valid range', () => {
    const mediaSession = {
      setPositionState: vi.fn(),
    } as unknown as MediaSession

    applyAppPositionState(mediaSession, 300, 180)

    expect(mediaSession.setPositionState).toHaveBeenCalledWith({
      duration: 180,
      playbackRate: 1,
      position: 180,
    })
  })

  it('does not publish invalid zero-duration position state', () => {
    const mediaSession = {
      setPositionState: vi.fn(),
    } as unknown as MediaSession

    applyAppPositionState(mediaSession, 10, 0)

    expect(mediaSession.setPositionState).not.toHaveBeenCalled()
  })
})
