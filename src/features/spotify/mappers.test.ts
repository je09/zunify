import { describe, expect, it } from 'vitest'
import { mapAlbum, mapArtist, mapSimpleAlbum, mapTrack } from './mappers'
import { SpAlbum, SpSimpleAlbum2, SpTrack } from './types'

describe('spotify mappers', () => {
  it('maps simplified search albums without tracks', () => {
    const album: SpSimpleAlbum2 = {
      id: 'album-1',
      name: 'Search Album',
      release_date: '2024-01-01',
      images: [{ url: 'cover.jpg' }],
      artists: [{ id: 'artist-1', name: 'Artist' }],
    }

    expect(mapSimpleAlbum(album)).toMatchObject({
      id: 'album-1',
      title: 'Search Album',
      artist: 'Artist',
      year: 2024,
      tracks: [],
    })
  })

  it('returns null for full album payloads missing tracks', () => {
    expect(mapAlbum({ id: 'a', name: 'x', release_date: '2024', images: [], artists: [] } as unknown as SpAlbum)).toBeNull()
  })

  it('maps nullable tracks safely', () => {
    expect(mapTrack(null)).toBeNull()

    const track: SpTrack = {
      name: 'Song',
      duration_ms: 123456,
      uri: 'spotify:track:track-1',
      preview_url: null,
      artists: [{ id: 'artist-1', name: 'Artist' }],
      album: { id: 'album-1', name: 'Album', images: [{ url: 'cover.jpg' }], artists: [] },
    }

    expect(mapTrack(track)).toMatchObject({
      title: 'Song',
      dur: 123,
      artist: 'Artist',
      album: 'Album',
      albumID: 'album-1',
      spotifyUri: 'spotify:track:track-1',
    })
  })

  it('ignores non-track playback items', () => {
    expect(mapTrack({ type: 'episode' } as SpTrack)).toBeNull()
  })

  it('maps artist genres', () => {
    expect(mapArtist({
      id: 'artist-1',
      name: 'Artist',
      genres: ['indie rock'],
      popularity: 50,
      images: [],
      followers: { total: 10 },
    })).toMatchObject({ id: 'artist-1', name: 'Artist', genres: ['indie rock'] })
  })
})
