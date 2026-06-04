import { describe, expect, it, vi } from 'vitest'
import { Track } from '../../data'
import { applyAppMediaSession } from './useMediaSession'

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
})
