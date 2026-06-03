import { describe, expect, it, vi } from 'vitest'
import { Track } from '../../data'
import { getLocalEngine, getLocalUpNext, shuffleQueueFrom } from './localPlayback'

const track = (title: string, previewUrl?: string): Track => ({
  title,
  dur: 60,
  artist: 'Artist',
  album: 'Album',
  color: '#555',
  previewUrl,
})

describe('localPlayback', () => {
  it('selects audio engine only when preview exists', () => {
    expect(getLocalEngine(track('a', 'preview.mp3'))).toBe('audio')
    expect(getLocalEngine(track('b'))).toBe('raf')
  })

  it('wraps up-next tracks from current index', () => {
    const queue = [track('a'), track('b'), track('c')]

    expect(getLocalUpNext(queue, 1).map(t => t.title)).toEqual(['c', 'a'])
  })

  it('keeps current track first when shuffling', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const queue = [track('a'), track('b'), track('c')]

    const shuffled = shuffleQueueFrom(queue, 1)

    expect(shuffled.idx).toBe(0)
    expect(shuffled.queue[0].title).toBe('b')
    expect(shuffled.queue).toHaveLength(3)
    vi.restoreAllMocks()
  })
})
