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

  it('loads more release pages for the active release tab', async () => {
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
    expect(fetchArtistAlbums).not.toHaveBeenCalledWith('artist-1', { limit: 10, offset: 10, include_groups: 'single' })

    root.unmount()
    host.remove()

    const singlesHost = document.createElement('div')
    document.body.appendChild(singlesHost)
    const singlesRoot = createRoot(singlesHost)

    await act(async () => {
      singlesRoot.render(<ArtistCard name="Artist" artistId="artist-1" tab={1} onTabChange={vi.fn()} onOpenAlbum={vi.fn()} onPlay={vi.fn()} onBack={vi.fn()} />)
    })
    await act(async () => {})

    expect(fetchArtistAlbums).toHaveBeenCalledWith('artist-1', { limit: 10, offset: 10, include_groups: 'single' })

    singlesRoot.unmount()
    singlesHost.remove()
  })

  it('renders albums and singles in separate tabs', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<ArtistCard name="Artist" artistId="artist-1" tab={0} onTabChange={vi.fn()} onOpenAlbum={vi.fn()} onPlay={vi.fn()} onBack={vi.fn()} />)
    })
    await act(async () => {})

    expect(host.textContent).toContain('Album album-0')
    expect(host.textContent).not.toContain('Album single-0')
    expect(host.querySelector('.al-playall')).toBeNull()

    const albumRows = [...host.querySelectorAll<HTMLElement>('.artist-release-virtual-row')]
    expect(albumRows.slice(0, 3).map(row => row.style.transform)).toEqual([
      'translateY(0px)',
      'translateY(122px)',
      'translateY(244px)',
    ])

    root.unmount()
    host.remove()

    const singlesHost = document.createElement('div')
    document.body.appendChild(singlesHost)
    const singlesRoot = createRoot(singlesHost)

    await act(async () => {
      singlesRoot.render(<ArtistCard name="Artist" artistId="artist-1" tab={1} onTabChange={vi.fn()} onOpenAlbum={vi.fn()} onPlay={vi.fn()} onBack={vi.fn()} />)
    })
    await act(async () => {})

    expect(singlesHost.textContent).toContain('Album single-0')
    expect(singlesHost.textContent).not.toContain('Album album-0')

    singlesRoot.unmount()
    singlesHost.remove()
  })
})
