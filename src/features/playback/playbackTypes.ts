import { Track } from '../../data'

export interface UpNextTrack { title: string; artist: string; imageUrl?: string }

export interface PlaybackState {
  track: Track
  upNext: UpNextTrack[]
  playing: boolean
  time: number
  duration: number
  fav: boolean
  shuffle: boolean
  repeat: 0 | 1 | 2
  started: boolean
  prevDisabled: boolean
  nextDisabled: boolean
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
