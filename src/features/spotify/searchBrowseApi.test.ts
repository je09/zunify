import { beforeEach, describe, expect, it, vi } from 'vitest'
import { spotifyGet } from './client'
import { fetchFollowedArtists } from './searchBrowseApi'

vi.mock('./client', () => ({ spotifyGet: vi.fn() }))

const mockedSpotifyGet = vi.mocked(spotifyGet)

describe('searchBrowseApi', () => {
  beforeEach(() => {
    mockedSpotifyGet.mockReset()
  })

  it('fetches every followed artist page', async () => {
    mockedSpotifyGet
      .mockResolvedValueOnce({
        artists: {
          items: [{ id: '1', name: 'One', genres: ['rock'], popularity: 1, images: [], followers: { total: 1 } }],
          next: 'https://api.spotify.com/v1/me/following?type=artist&after=1&limit=50',
        },
      })
      .mockResolvedValueOnce({
        artists: {
          items: [{ id: '2', name: 'Two', genres: ['pop'], popularity: 1, images: [], followers: { total: 1 } }],
          next: null,
        },
      })

    await expect(fetchFollowedArtists()).resolves.toMatchObject([
      { id: '1', name: 'One', genres: ['rock'] },
      { id: '2', name: 'Two', genres: ['pop'] },
    ])
    expect(mockedSpotifyGet).toHaveBeenNthCalledWith(1, '/me/following?type=artist&limit=50')
    expect(mockedSpotifyGet).toHaveBeenNthCalledWith(2, 'https://api.spotify.com/v1/me/following?type=artist&after=1&limit=50')
  })
})
