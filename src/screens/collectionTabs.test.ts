// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Album } from '../data'
import { AlbumsTab, buildGenresFromArtists, groupArtistNamesByLetter } from './collectionTabs'

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
    expect(genres[0].artistNames).toEqual(['Artist One', 'Artist Two'])
    expect(genres[1].artistIds).toEqual(['1'])
  })

  it('positions virtual album rows at distinct vertical offsets', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(createElement(AlbumsTab, {
        albums: [album('Artist', 'One'), album('Artist', 'Two'), album('Artist', 'Three')],
        total: 3,
        onOpenAlbum: vi.fn(),
      }))
    })

    const rows = [...host.querySelectorAll<HTMLElement>('.collection-virtual-row')]
    expect(rows).toHaveLength(3)
    expect(rows.map(row => row.style.transform)).toEqual([
      'translateY(0px)',
      'translateY(106px)',
      'translateY(212px)',
    ])

    root.unmount()
    host.remove()
  })
})
