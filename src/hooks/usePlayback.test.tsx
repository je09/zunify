// @vitest-environment happy-dom

import { act } from 'react-dom/test-utils'
import { createRoot, Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Track } from '../data'
import type { PlaybackState } from '../features/playback/playbackTypes'
import { usePlayback } from './usePlayback'
import { skipToNext, skipToPrevious, startPlayback } from '../spotifyApi'

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
  skipToPrevious: vi.fn().mockResolvedValue(undefined),
  startPlayback: vi.fn().mockResolvedValue(undefined),
}))

const mockedSkipToNext = vi.mocked(skipToNext)
const mockedSkipToPrevious = vi.mocked(skipToPrevious)
const mockedStartPlayback = vi.mocked(startPlayback)

const tracks: Track[] = [
  { title: 'one', dur: 120, artist: 'Artist', album: 'Album', color: '#555', spotifyUri: 'spotify:track:one' },
  { title: 'two', dur: 120, artist: 'Artist', album: 'Album', color: '#555', spotifyUri: 'spotify:track:two' },
]

function Harness({ onState }: { onState: (state: PlaybackState) => void }) {
  const state = usePlayback(null)
  onState(state)
  return null
}

describe('usePlayback', () => {
  let root: Root
  let host: HTMLDivElement
  let latest: PlaybackState

  beforeEach(async () => {
    mockedSkipToNext.mockReset().mockResolvedValue(undefined)
    mockedSkipToPrevious.mockReset().mockResolvedValue(undefined)
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
})
