import { describe, expect, it } from 'vitest'
import { Album } from '../data'
import { buildGenresFromArtists, groupArtistNamesByLetter } from './collectionTabs'

const album = (artist: string, title: string): Album => ({
  id: `${artist}-${title}`,
  artist,
  title,
  year: 2024,
  color: '#555',
  tracks: [[title, 120]],
})

describe('collectionTabs', () => {
  it('keeps one group per artist letter', () => {
    expect(groupArtistNamesByLetter(['Olivia', 'The Beatles', 'Oasis']).map(group => group.letter)).toEqual(['O', 'B'])
    expect(groupArtistNamesByLetter(['Olivia', 'The Beatles', 'Oasis'])[0].names).toEqual(['Olivia', 'Oasis'])
  })

  it('builds genres from followed artist metadata', () => {
    const genres = buildGenresFromArtists(
      [
        { id: '1', name: 'Artist One', genres: ['indie rock', 'pop'] },
        { id: '2', name: 'Artist Two', genres: ['indie rock'] },
      ],
      [album('Artist One', 'First'), album('Artist Two', 'Second')],
    )

    expect(genres.map(genre => genre.label)).toEqual(['indie rock', 'pop'])
    expect(genres[0].artistIds).toEqual(['1', '2'])
    expect(genres[1].artistIds).toEqual(['1'])
  })
})
