import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Track, Album, ArtistSummary, fmt } from '../data'
import { fetchArtist, fetchArtistTopTracks, fetchArtistAlbums } from '../spotifyApi'
import { Pivot, PivotArea, Overline, Thumb, useSwipe, BottomBack, WP8Spinner } from '../components/Pivot'
import { Icons } from '../components/icons'
import { useLibrary } from '../LibraryContext'

interface Props {
  name: string
  artistId: string | undefined
  tab: number
  onTabChange: (t: number) => void
  onOpenAlbum: (album: Album) => void
  onPlay: (queue: Track[], idx: number, contextUri?: string) => void
  onBack: () => void
}

interface ArtistState {
  artist: ArtistSummary | null
  topTracks: Track[]
  albums: (Album | undefined)[]
  singles: (Album | undefined)[]
  albumsTotal: number | null
  singlesTotal: number | null
  loading: boolean
}

const ARTIST_RELEASE_LIMIT = 10
const ARTIST_RELEASE_ROW_HEIGHT = 122
const ARTIST_RELEASE_OVERSCAN = 6
type ReleaseGroup = 'album' | 'single'

export function ArtistCard({ name, artistId, tab, onTabChange, onOpenAlbum, onPlay, onBack }: Props) {
  const { savedTrackUris, checkSavedTrackUris } = useLibrary()
  const loadingReleasePagesRef = useRef<Record<ReleaseGroup, Set<number>>>({ album: new Set(), single: new Set() })
  const loadedReleasePagesRef = useRef<Record<ReleaseGroup, Set<number>>>({ album: new Set(), single: new Set() })
  const failedReleasePagesRef = useRef<Record<ReleaseGroup, Set<number>>>({ album: new Set(), single: new Set() })
  const [failedReleasePages, setFailedReleasePages] = useState<Record<ReleaseGroup, Set<number>>>({ album: new Set(), single: new Set() })
  const [state, setState] = useState<ArtistState>({
    artist: null, topTracks: [], albums: [], singles: [],
    albumsTotal: null, singlesTotal: null,
    loading: Boolean(artistId),
  })

  useEffect(() => {
    loadingReleasePagesRef.current = { album: new Set(), single: new Set() }
    loadedReleasePagesRef.current = { album: new Set(), single: new Set() }
    failedReleasePagesRef.current = { album: new Set(), single: new Set() }
    setFailedReleasePages({ album: new Set(), single: new Set() })
    setState({
      artist: null, topTracks: [], albums: [], singles: [],
      albumsTotal: null, singlesTotal: null,
      loading: Boolean(artistId),
    })
    if (!artistId) return
    let cancelled = false

    // Wave 1: artist info + top tracks + albums + singles in parallel
    Promise.all([
      fetchArtist(artistId),
      fetchArtistTopTracks(artistId),
      fetchArtistAlbums(artistId, { limit: ARTIST_RELEASE_LIMIT, include_groups: 'album' }),
      fetchArtistAlbums(artistId, { limit: ARTIST_RELEASE_LIMIT, include_groups: 'single' }),
    ]).then(([artist, topTracks, albumsPage, singlesPage]) => {
      if (cancelled) return
      loadedReleasePagesRef.current.album.add(0)
      loadedReleasePagesRef.current.single.add(0)
      const albumsTotal = albumsPage.total ?? albumsPage.items.length
      const singlesTotal = singlesPage.total ?? singlesPage.items.length
      const albums = Array<Album | undefined>(albumsTotal)
      albumsPage.items.forEach((album, index) => { albums[index] = album })
      const singles = Array<Album | undefined>(singlesTotal)
      singlesPage.items.forEach((single, index) => { singles[index] = single })
      setState({
        artist, topTracks,
        albums, singles,
        albumsTotal, singlesTotal,
        loading: false,
      })
    }).catch(() => {
      if (!cancelled) setState(prev => ({ ...prev, loading: false }))
    })

    return () => { cancelled = true }
  }, [artistId])

  const { artist, topTracks, albums, singles, albumsTotal, singlesTotal, loading } = state

  const loadReleasePage = useCallback((group: ReleaseGroup, pageIndex: number, force = false) => {
    if (!artistId) return
    const isAlbum = group === 'album'
    const total = isAlbum ? state.albumsTotal : state.singlesTotal
    const offset = pageIndex * ARTIST_RELEASE_LIMIT
    if (pageIndex < 0 || loadedReleasePagesRef.current[group].has(pageIndex) || loadingReleasePagesRef.current[group].has(pageIndex)) return
    if (!force && failedReleasePagesRef.current[group].has(pageIndex)) return
    if (total !== null && offset >= total) return

    loadingReleasePagesRef.current[group].add(pageIndex)
    setFailedReleasePages(prev => {
      if (!prev[group].has(pageIndex)) return prev
      const next = { ...prev, [group]: new Set(prev[group]) }
      next[group].delete(pageIndex)
      failedReleasePagesRef.current = next
      return next
    })

    fetchArtistAlbums(artistId, {
      limit: ARTIST_RELEASE_LIMIT,
      offset,
      include_groups: group,
    }).then(page => {
      loadedReleasePagesRef.current[group].add(pageIndex)
      setState(prev => ({
        ...prev,
        [isAlbum ? 'albums' : 'singles']: mergeReleasePage(isAlbum ? prev.albums : prev.singles, page.items, offset, page.total ?? offset + page.items.length),
        [isAlbum ? 'albumsTotal' : 'singlesTotal']: page.total ?? offset + page.items.length,
      }))
    }).catch(() => {
      setFailedReleasePages(prev => {
        const next = { ...prev, [group]: new Set(prev[group]).add(pageIndex) }
        failedReleasePagesRef.current = next
        return next
      })
    }).finally(() => {
      loadingReleasePagesRef.current[group].delete(pageIndex)
    })
  }, [artistId, state.albumsTotal, state.singlesTotal])
  const topTrackUris = useMemo(
    () => topTracks.map(t => t.spotifyUri).filter((uri): uri is string => Boolean(uri)),
    [topTracks]
  )
  const topTrackUriKey = topTrackUris.join('\u0000')

  useEffect(() => {
    checkSavedTrackUris(topTrackUris)
  }, [topTrackUriKey, topTrackUris, checkSavedTrackUris])

  const bgImage = artist?.imageUrl
  const displayName = artist?.name ?? name
  const swipe = useSwipe(
    () => tab === 0 ? onBack() : onTabChange(tab - 1),
    () => onTabChange(Math.min(2, tab + 1)),
  )

return (
    <div className="page artist-card">
      <div
        className="card-bg"
        style={bgImage
          ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center top' }
          : {}
        }
      />
      <div className="card-scrim" />
      <div className="card-body">
        <Overline>{displayName}</Overline>

        <Pivot tabs={['albums', 'singles', 'songs']} active={tab} onChange={onTabChange} />
        <PivotArea tab={tab} ref={swipe}>

          {/* albums */}
          <div style={{ padding: '0 26px' }}>
            {loading ? (
              <WP8Spinner />
            ) : (
              <ReleaseList
                group="album"
                releases={albums}
                total={albumsTotal}
                failedPages={failedReleasePages.album}
                emptyLabel="no albums"
                onOpenAlbum={onOpenAlbum}
                onLoadPage={loadReleasePage}
              />
            )}
            <div style={{ height: 80 }} />
          </div>

          {/* singles */}
          <div style={{ padding: '0 26px' }}>
            {loading ? (
              <WP8Spinner />
            ) : (
              <ReleaseList
                group="single"
                releases={singles}
                total={singlesTotal}
                failedPages={failedReleasePages.single}
                emptyLabel="no singles"
                onOpenAlbum={onOpenAlbum}
                onLoadPage={loadReleasePage}
              />
            )}
            <div style={{ height: 80 }} />
          </div>

          {/* top songs */}
          <div>
            {loading ? (
              <WP8Spinner />
            ) : topTracks.map((t, i) => (
              <div key={t.spotifyUri ?? i} className="lrow" style={{ padding: '8px 26px' }}>
                <button
                  className="play-circle"
                  aria-label={`Play ${t.title}`}
                  onClick={(e) => { e.stopPropagation(); onPlay(topTracks, i) }}
                >
                  {Icons.playCircle}
                </button>
                <div className="lrow-name song" onClick={() => onPlay(topTracks, i)}>
                  <div className="lrow-title">{t.title}</div>
                  <div className="lrow-sub">{fmt(t.dur)}</div>
                </div>
                {t.spotifyUri && savedTrackUris.has(t.spotifyUri) && (
                  <div className="liked-dot" title="liked">{Icons.heart}</div>
                )}
              </div>
            ))}
            <div style={{ height: 80 }} />
          </div>

        </PivotArea>
      </div>
      <BottomBack onBack={onBack} />
    </div>
  )
}

function mergeReleasePage(current: (Album | undefined)[], items: Album[], offset: number, total: number) {
  const size = Math.max(total, current.length, offset + items.length)
  const next = current.length === size ? [...current] : Array<Album | undefined>(size)
  current.forEach((album, index) => { next[index] = album })
  items.forEach((album, index) => { next[offset + index] = album })
  return next
}

function ReleaseList({ group, releases, total, failedPages, emptyLabel, onOpenAlbum, onLoadPage }: {
  group: ReleaseGroup
  releases: (Album | undefined)[]
  total: number | null
  failedPages: Set<number>
  emptyLabel: string
  onOpenAlbum: (album: Album) => void
  onLoadPage: (group: ReleaseGroup, pageIndex: number, force?: boolean) => void
}) {
  const releaseTotal = total ?? releases.length
  const range = useArtistVirtualRange(releaseTotal, ARTIST_RELEASE_ROW_HEIGHT)

  useEffect(() => {
    if (!releaseTotal) return
    const firstPage = Math.floor(range.start / ARTIST_RELEASE_LIMIT)
    const lastPage = Math.floor(Math.max(range.end - 1, range.start) / ARTIST_RELEASE_LIMIT)
    for (let page = firstPage; page <= lastPage; page += 1) onLoadPage(group, page)
  }, [group, onLoadPage, range.end, range.start, releaseTotal])

  if (releaseTotal === 0) return <div className="section" style={{ paddingTop: 16 }}>{emptyLabel}</div>

  return (
    <div ref={range.ref} className="artist-release-virtual" style={{ height: releaseTotal * ARTIST_RELEASE_ROW_HEIGHT }}>
      {Array.from({ length: range.end - range.start }, (_, offset) => {
        const index = range.start + offset
        const album = releases[index]
        const pageIndex = Math.floor(index / ARTIST_RELEASE_LIMIT)
        return (
          <div key={album?.id ?? `${group}-${index}`} className="artist-release-virtual-row" style={{ transform: `translateY(${index * ARTIST_RELEASE_ROW_HEIGHT}px)` }}>
            {album ? (
              <ReleaseRow album={album} onOpenAlbum={onOpenAlbum} />
            ) : failedPages.has(pageIndex) ? (
              <button className="virtual-load-error" onClick={() => onLoadPage(group, pageIndex, true)}>couldn't load · tap to retry</button>
            ) : (
              <ReleaseSkeletonRow />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ReleaseRow({ album, onOpenAlbum }: { album: Album; onOpenAlbum: (album: Album) => void }) {
  return (
    <div className="card-album" onClick={() => onOpenAlbum(album)}>
      <Thumb color={album.color} size={104} imageUrl={album.imageUrl} />
      <div className="card-album-meta">
        <div className="ca-title">{album.title}</div>
        <div className="ca-sub">{album.artist}</div>
      </div>
    </div>
  )
}

function ReleaseSkeletonRow() {
  return (
    <div className="card-album skeleton-row">
      <div className="skeleton-block skeleton-art" />
      <div className="card-album-meta skeleton-track-meta">
        <div className="skeleton-block skeleton-title" />
        <div className="skeleton-block skeleton-sub" />
      </div>
    </div>
  )
}

function useArtistVirtualRange(total: number, rowHeight: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })

  useEffect(() => {
    const pane = ref.current?.closest('.pivot-pane')
    if (!(pane instanceof HTMLElement)) return
    const update = () => setViewport({ top: pane.scrollTop, height: pane.clientHeight })
    update()
    pane.addEventListener('scroll', update, { passive: true })
    return () => pane.removeEventListener('scroll', update)
  }, [])

  return useMemo(() => {
    const start = Math.max(0, Math.floor(viewport.top / rowHeight) - ARTIST_RELEASE_OVERSCAN)
    const visible = Math.ceil((viewport.height || 1) / rowHeight) + ARTIST_RELEASE_OVERSCAN * 2
    return { ref, start, end: Math.min(total, start + visible) }
  }, [rowHeight, total, viewport])
}
