import { describe, expect, it } from 'vitest'
import { Album, Playlist, Track } from '../../data'
import { libraryReducer } from './libraryReducer'
import { EMPTY_LIBRARY_STATE, LibraryState } from './libraryTypes'

const album = (id: string): Album => ({
  id,
  artist: 'Artist',
  title: id,
  year: 2024,
  color: '#555',
  tracks: [[id, 120]],
})

const track = (title: string): Track => ({
  title,
  dur: 120,
  artist: 'Artist',
  album: 'Album',
  color: '#555',
  spotifyUri: `spotify:track:${title}`,
})

const playlist = (id: string): Playlist => ({
  id,
  name: id,
  items: [],
  tracks: [],
  trackNextUrl: `/playlists/${id}/tracks?offset=50`,
})

function state(overrides: Partial<LibraryState> = {}): LibraryState {
  return { ...EMPTY_LIBRARY_STATE, ...overrides }
}

describe('libraryReducer', () => {
  it('preserves pagination loading flags when appending albums', () => {
    const loadingMore = { albums: true, playlists: false, tracks: false, playlistTracks: { p1: true } }
    const next = libraryReducer(state({ loading: true, error: 'previous', loadingMore }), {
      type: 'append-albums',
      items: [album('a1')],
      total: 1,
      userId: 'user',
      followedArtists: [],
    })

    expect(next.loading).toBe(true)
    expect(next.error).toBeNull()
    expect(next.loadingMore).toEqual(loadingMore)
    expect(next.albums.map(a => a.id)).toEqual(['a1'])
  })

  it('preserves playlist-track loading flags when appending tracks', () => {
    const loadingMore = { albums: false, playlists: false, tracks: false, playlistTracks: { p1: true } }
    const next = libraryReducer(state({ playlists: [playlist('p1')], loadingMore }), {
      type: 'append-playlist-tracks',
      playlistId: 'p1',
      items: [track('one')],
      total: 1,
      next: null,
      userId: 'user',
      followedArtists: [],
    })

    expect(next.loadingMore.playlistTracks.p1).toBe(true)
    expect(next.playlists[0].tracks?.map(t => t.title)).toEqual(['one'])
    expect(next.playlists[0].trackNextUrl).toBeNull()
  })

  it('does not restart completed liked-track pagination when playlists append', () => {
    const next = libraryReducer(state({
      playlists: [{ id: 'sp_liked', name: 'liked songs', items: [], tracks: [], trackNextUrl: null }],
    }), {
      type: 'append-playlists',
      items: [playlist('p1')],
      total: 1,
      likedTotal: undefined,
      userId: 'user',
      followedArtists: [],
    })

    expect(next.playlists[0].trackNextUrl).toBeNull()
  })
})
