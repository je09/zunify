// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ArtistCard } from './ArtistCard'
import type { Album, ArtistSummary, Track } from '../data'

const fetchArtist = vi.fn()
const fetchArtistTopTracks = vi.fn()
const fetchArtistAlbums = vi.fn()
const checkSavedTrackUris = vi.fn()

vi.mock('../spotifyApi', () => ({
  fetchArtist: (...args: unknown[]) => fetchArtist(...args),
  fetchArtistTopTracks: (...args: unknown[]) => fetchArtistTopTracks(...args),
  fetchArtistAlbums: (...args: unknown[]) => fetchArtistAlbums(...args),
}))

vi.mock('../LibraryContext', () => ({
  useLibrary: () => ({
    savedTrackUris: new Set<string>(),
    checkSavedTrackUris,
  }),
}))

const artist: ArtistSummary = { id: 'artist-1', name: 'Artist', imageUrl: undefined, genres: [] }
const topTrack: Track = { title: 'Top', artist: 'Artist', album: 'Top', dur: 180, color: '#333', spotifyUri: 'spotify:track:top' }

const album = (id: string): Album => ({
  id,
  title: `Album ${id}`,
  artist: 'Artist',
  year: 2024,
  color: '#333',
  tracks: [],
})

describe('ArtistCard releases', () => {
  beforeEach(() => {
    fetchArtist.mockResolvedValue(artist)
    fetchArtistTopTracks.mockResolvedValue([topTrack])
    fetchArtistAlbums.mockImplementation((_id: string, params: { include_groups?: string; offset?: number }) => {
      const prefix = params.include_groups === 'single' ? 'single' : 'album'
      const offset = params.offset ?? 0
      return Promise.resolve({
        items: offset === 0
          ? Array.from({ length: 10 }, (_, index) => album(`${prefix}-${index}`))
          : [album(`${prefix}-${offset}`), album(`${prefix}-${offset + 1}`)],
        next: offset === 0 ? 'next' : null,
        total: 12,
      })
    })

    vi.stubGlobal('IntersectionObserver', class {
      private callback: IntersectionObserverCallback

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }

      observe(target: Element) {
        this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
      }

      disconnect() {}
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('loads more album and single pages beyond the first artist release page', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<ArtistCard name="Artist" artistId="artist-1" tab={0} onTabChange={vi.fn()} onOpenAlbum={vi.fn()} onPlay={vi.fn()} onBack={vi.fn()} />)
    })
    await act(async () => {})

    expect(fetchArtistAlbums).toHaveBeenCalledWith('artist-1', { limit: 10, include_groups: 'album' })
    expect(fetchArtistAlbums).toHaveBeenCalledWith('artist-1', { limit: 10, include_groups: 'single' })
    expect(fetchArtistAlbums).toHaveBeenCalledWith('artist-1', { limit: 10, offset: 10, include_groups: 'album' })
    expect(fetchArtistAlbums).toHaveBeenCalledWith('artist-1', { limit: 10, offset: 10, include_groups: 'single' })

    root.unmount()
    host.remove()
  })
})
