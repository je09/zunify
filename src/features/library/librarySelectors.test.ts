import { describe, expect, it } from 'vitest'
import { Album, Playlist, Track } from '../../data'
import { buildLibrary, mergeAlbums } from './librarySelectors'

const album = (id: string, artist: string, title: string): Album => ({
  id,
  artist,
  title,
  year: 2024,
  color: '#555',
  tracks: [[`${title} song`, 120]],
})

describe('librarySelectors', () => {
  it('dedupes albums by id and normalized artist/title', () => {
    const saved = album('1', 'Artist', 'Same Album')
    const likedDerived = album('liked', ' artist ', 'same album')
    const other = album('2', 'Artist', 'Other Album')

    expect(mergeAlbums([saved], [likedDerived, other]).map(a => a.id)).toEqual(['1', '2'])
  })

  it('builds songs and combines library artists with followed artists', () => {
    const library = buildLibrary(
      [album('1', 'The Band', 'Zed')],
      [],
      { albums: null, songs: null, playlists: null },
      null,
      [{ id: 'artist-1', name: 'Followed Band' }],
    )

    expect(library.artists).toEqual(['The Band', 'Followed Band'])
    expect(library.songs).toHaveLength(1)
    expect(library.songs[0].title).toBe('Zed song')
  })

  it('builds the songs tab from saved albums only', () => {
    const likedTrack: Track = {
      title: 'Liked only song',
      artist: 'Liked Artist',
      album: 'Liked Album',
      dur: 180,
      color: '#333',
      spotifyUri: 'spotify:track:liked',
    }
    const likedPlaylist: Playlist = {
      id: 'sp_liked',
      name: 'liked songs',
      items: [],
      tracks: [likedTrack],
      totalTracks: 1,
    }

    const library = buildLibrary(
      [album('1', 'Album Artist', 'Saved Album')],
      [likedPlaylist],
      { albums: null, songs: 1, playlists: null },
      null,
    )

    expect(library.songs.map(song => song.title)).toEqual(['Saved Album song'])
    expect(library.playlists.find(playlist => playlist.id === 'sp_liked')?.tracks).toEqual([likedTrack])
  })
})
