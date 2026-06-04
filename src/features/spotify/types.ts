export interface SpImage { url: string }
export interface SpArtist { id: string; name: string }
export interface SpTrack {
  type?: string
  uri: string
  name: string
  duration_ms: number
  preview_url: string | null
  artists: SpArtist[] | null
  album: SpSimpleAlbum
}
export interface SpSimpleAlbum {
  id: string
  name: string
  images: SpImage[] | null
  artists: SpArtist[] | null
}
export interface SpSimpleAlbum2 extends SpSimpleAlbum {
  release_date?: string
  album_type?: string
}
export interface SpAlbum extends SpSimpleAlbum {
  release_date: string
  tracks: { items: Omit<SpTrack, 'album'>[] } | null
}
export interface SpPaged<T> { items: T[]; next: string | null; total?: number }
export interface SpSimplePlaylist {
  id: string
  name: string
  tracks: { total: number }
  images: SpImage[] | null
}
export interface SpDevice {
  id: string
  is_active: boolean
  is_private_session: boolean
  is_restricted: boolean
  name: string
  type: string
  volume_percent: number
}
export interface SpPlaybackState {
  device: SpDevice
  shuffle_state: boolean
  repeat_state: 'off' | 'track' | 'context'
  is_playing: boolean
  item: SpTrack | null
  progress_ms: number
  timestamp: number
}
export interface SpPlayHistory {
  track: SpTrack
  played_at: string
  context: { type: string; uri: string } | null
}
export interface SpFullArtist {
  id: string
  name: string
  genres: string[]
  popularity: number
  images: SpImage[]
  followers: { total: number }
}
export interface SpUser {
  id: string
  display_name: string | null
  email: string
  images: SpImage[]
  followers: { total: number }
}
