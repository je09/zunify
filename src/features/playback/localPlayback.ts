import { Track } from '../../data'
import { UpNextTrack } from './playbackTypes'

export const NULL_TRACK: Track = { title: '', dur: 0, artist: '', album: '', color: '#000' }

export function getLocalEngine(track?: Track): 'audio' | 'raf' {
  return track?.previewUrl ? 'audio' : 'raf'
}

export function getLocalUpNext(queue: Track[], idx: number): UpNextTrack[] {
  return Array.from({ length: Math.min(5, queue.length - 1) }, (_, i) => {
    const t = queue[(idx + i + 1) % queue.length]
    return { title: t.title, artist: t.artist, imageUrl: t.imageUrl }
  })
}

export function shuffleQueueFrom(queue: Track[], idx: number): { queue: Track[]; idx: number } {
  const rest = queue.filter((_, ri) => ri !== idx)
  for (let j = rest.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1))
    ;[rest[j], rest[k]] = [rest[k], rest[j]]
  }
  return { queue: [queue[idx], ...rest], idx: 0 }
}
