// @vitest-environment happy-dom

import { act } from 'react-dom/test-utils'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Track } from '../data'
import type { PlaybackState } from '../features/playback/playbackTypes'
import type { SpotifyEngine } from '../useSpotifyPlayer'
import { usePlayback } from './usePlayback'
import { skipToNext, skipToNextOnDevice, skipToPrevious, skipToPreviousOnDevice, startPlayback } from '../spotifyApi'

vi.mock('../features/playback/useMediaSession', () => ({ useMediaSession: vi.fn() }))
vi.mock('../features/playback/silentAudio', () => ({ claimAudioSession: vi.fn() }))
vi.mock('../spotifyApi', () => ({
  checkSavedTracks: vi.fn().mockResolvedValue([false]),
  fetchCurrentPlayback: vi.fn().mockResolvedValue(null),
  fetchUserQueue: vi.fn().mockResolvedValue({ currentTrack: null, queue: [] }),
  pausePlayback: vi.fn().mockResolvedValue(undefined),
  removeTracks: vi.fn().mockResolvedValue(undefined),
  saveTracks: vi.fn().mockResolvedValue(undefined),
  seekToPosition: vi.fn().mockResolvedValue(undefined),
  setRepeatMode: vi.fn().mockResolvedValue(undefined),
  setShuffleState: vi.fn().mockResolvedValue(undefined),
  skipToNext: vi.fn().mockResolvedValue(undefined),
  skipToNextOnDevice: vi.fn().mockResolvedValue(undefined),
  skipToPrevious: vi.fn().mockResolvedValue(undefined),
  skipToPreviousOnDevice: vi.fn().mockResolvedValue(undefined),
  startPlayback: vi.fn().mockResolvedValue(undefined),
}))

const mockedSkipToNext = vi.mocked(skipToNext)
const mockedSkipToNextOnDevice = vi.mocked(skipToNextOnDevice)
const mockedSkipToPrevious = vi.mocked(skipToPrevious)
const mockedSkipToPreviousOnDevice = vi.mocked(skipToPreviousOnDevice)
const mockedStartPlayback = vi.mocked(startPlayback)

const tracks: Track[] = [
  { title: 'one', dur: 120, artist: 'Artist', album: 'Album', color: '#555', spotifyUri: 'spotify:track:one' },
  { title: 'two', dur: 120, artist: 'Artist', album: 'Album', color: '#555', spotifyUri: 'spotify:track:two' },
]

function Harness({ onState, spotify = null }: { onState: (state: PlaybackState) => void; spotify?: SpotifyEngine | null }) {
  const state = usePlayback(spotify)
  onState(state)
  return null
}

describe('usePlayback', () => {
  let root: Root
  let host: HTMLDivElement
  let latest: PlaybackState

  beforeEach(async () => {
    mockedSkipToNext.mockReset().mockResolvedValue(undefined)
    mockedSkipToNextOnDevice.mockReset().mockResolvedValue(undefined)
    mockedSkipToPrevious.mockReset().mockResolvedValue(undefined)
    mockedSkipToPreviousOnDevice.mockReset().mockResolvedValue(undefined)
    mockedStartPlayback.mockReset().mockResolvedValue(undefined)
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)

    await act(async () => {
      root.render(<Harness onState={state => { latest = state }} />)
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it('rolls back local next state when the remote skip fails', async () => {
    mockedSkipToNext.mockRejectedValueOnce(new Error('skip failed'))

    await act(async () => {
      latest.play(tracks, 0)
      await Promise.resolve()
    })
    expect(latest.idx).toBe(0)

    await act(async () => {
      latest.next()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(latest.idx).toBe(0)
    expect(mockedSkipToNext).toHaveBeenCalledTimes(1)
  })

  it('rolls back local previous state when the remote skip fails', async () => {
    mockedSkipToPrevious.mockRejectedValueOnce(new Error('skip failed'))

    await act(async () => {
      latest.play(tracks, 1)
      await Promise.resolve()
    })
    expect(latest.idx).toBe(1)

    await act(async () => {
      latest.prev()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(latest.idx).toBe(1)
    expect(mockedSkipToPrevious).toHaveBeenCalledTimes(1)
  })

  it('does not call API skip when SDK next succeeds', async () => {
    const nextTrack = vi.fn().mockResolvedValue(undefined)
    const spotify = {
      player: { nextTrack },
      deviceId: 'device-1',
      sdkState: {
        paused: false,
        position: 0,
        duration: 120000,
        shuffle: false,
        repeat_mode: 0,
        disallows: {},
        track_window: {
          current_track: {
            name: 'one',
            uri: 'spotify:track:one',
            album: { name: 'Album', uri: 'spotify:album:album', images: [] },
            artists: [{ name: 'Artist', uri: 'spotify:artist:artist' }],
          },
          next_tracks: [],
        },
      },
    } as unknown as SpotifyEngine

    await act(async () => {
      root.render(<Harness spotify={spotify} onState={state => { latest = state }} />)
    })

    await act(async () => {
      latest.next()
      await Promise.resolve()
    })

    expect(nextTrack).toHaveBeenCalledTimes(1)
    expect(mockedSkipToNext).not.toHaveBeenCalled()
    expect(mockedSkipToNextOnDevice).not.toHaveBeenCalled()
  })

  it('ignores repeated next while a skip command is pending', async () => {
    let resolveSkip!: () => void
    mockedSkipToNext.mockReturnValueOnce(new Promise(resolve => { resolveSkip = resolve }))

    await act(async () => {
      latest.play(tracks, 0)
      await Promise.resolve()
    })

    await act(async () => {
      latest.next()
      latest.next()
      await Promise.resolve()
    })

    expect(mockedSkipToNext).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveSkip()
      await Promise.resolve()
    })
  })

  it('falls back once to device API when SDK next fails', async () => {
    const nextTrack = vi.fn().mockRejectedValue(new Error('sdk failed'))
    const spotify = {
      player: { nextTrack },
      deviceId: 'device-1',
      sdkState: {
        paused: false,
        position: 0,
        duration: 120000,
        shuffle: false,
        repeat_mode: 0,
        disallows: {},
        track_window: {
          current_track: {
            name: 'one',
            uri: 'spotify:track:one',
            album: { name: 'Album', uri: 'spotify:album:album', images: [] },
            artists: [{ name: 'Artist', uri: 'spotify:artist:artist' }],
          },
          next_tracks: [],
        },
      },
    } as unknown as SpotifyEngine

    await act(async () => {
      root.render(<Harness spotify={spotify} onState={state => { latest = state }} />)
    })

    await act(async () => {
      latest.next()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(nextTrack).toHaveBeenCalledTimes(1)
    expect(mockedSkipToNext).not.toHaveBeenCalled()
    expect(mockedSkipToNextOnDevice).toHaveBeenCalledTimes(1)
    expect(mockedSkipToNextOnDevice).toHaveBeenCalledWith('device-1')
  })
})
