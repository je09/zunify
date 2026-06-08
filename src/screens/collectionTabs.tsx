import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Track, Album, ArtistSummary, Playlist, SongEntry, albumQueue } from '../data'
import { Section, Thumb, WP8Spinner } from '../components/Pivot'
import { FadeImage } from '../components/FadeImage'
import { Icons } from '../components/icons'
import { useLibrary } from '../LibraryContext'
import { LIBRARY_BATCH_LIMIT } from '../features/spotify/shared'
import { fetchSavedAlbumsPageAt, fetchUserPlaylistsPageAt } from '../spotifyApi'

const VIRTUAL_PLAYLIST_ROW_HEIGHT = 106
const VIRTUAL_ALBUM_ROW_HEIGHT = 106
const VIRTUAL_ARTIST_ROW_HEIGHT = 64
const VIRTUAL_OVERSCAN = 6

export function hasMore(loaded: number, total: number | null): boolean {
  return total === null || loaded < total
}

export function groupAlbumsByArtist(albums: Album[]): Map<string, Album[]> {
  const grouped = new Map<string, Album[]>()
  albums.forEach(album => {
    const group = grouped.get(album.artist)
    if (group) group.push(album)
    else grouped.set(album.artist, [album])
  })
  return grouped
}

export function groupArtistNamesByLetter(artists: string[]): { letter: string; names: string[] }[] {
  const byLetter = new Map<string, string[]>()
  artists.forEach(name => {
    const letter = name.replace(/^the\s+/i, '')[0]?.toUpperCase() ?? '#'
    const names = byLetter.get(letter)
    if (names) names.push(name)
    else byLetter.set(letter, [name])
  })
  return [...byLetter.entries()].map(([letter, names]) => ({ letter, names }))
}

export function buildGenresFromArtists(artists: ArtistSummary[], albums: Album[]): { label: string; color: string; artistIds: string[]; artistNames: string[] }[] {
  const GENRE_COLORS = [
    '#5ca800','#1ba1e2','#a4c400','#d80073','#fa6800','#6a00ff','#3a8f6b','#c43b6b',
  ]
  const artistsByGenre = new Map<string, ArtistSummary[]>()

  artists.forEach(artist => {
    artist.genres?.forEach(genre => {
      const list = artistsByGenre.get(genre)
      if (list) list.push(artist)
      else artistsByGenre.set(genre, [artist])
    })
  })

  return [...artistsByGenre.entries()]
    .sort(([aGenre, aList], [bGenre, bList]) => bList.length - aList.length || aGenre.localeCompare(bGenre, 'en', { sensitivity: 'base' }))
    .map(([genre, list], index) => {
      const names = new Set(list.map(a => a.name))
      return {
        label: genre,
        color: albums.find(a => names.has(a.artist))?.color ?? GENRE_COLORS[index % GENRE_COLORS.length],
        artistIds: list.map(a => a.id),
        artistNames: list.map(a => a.name),
      }
    })
}

const PREFETCH_ROOT_MARGIN = '900px 0px'

function LoadMoreSentinel({ active, loading, onLoadMore, preserveAnchor = false, anchorKey, skeleton }: {
  active: boolean; loading: boolean; onLoadMore: () => void; preserveAnchor?: boolean; anchorKey?: number; skeleton?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const anchorTopRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!preserveAnchor || !el || anchorTopRef.current === null) return
    const top = el.getBoundingClientRect().top
    window.scrollBy(0, top - anchorTopRef.current)
    anchorTopRef.current = null
  }, [anchorKey, preserveAnchor])

  useEffect(() => {
    const el = ref.current
    if (!active || !el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loading) {
        if (preserveAnchor) anchorTopRef.current = el.getBoundingClientRect().top
        onLoadMore()
      }
    }, { rootMargin: PREFETCH_ROOT_MARGIN })
    observer.observe(el)
    return () => observer.disconnect()
  }, [active, loading, onLoadMore, preserveAnchor])
  return <div ref={ref} className="load-more-slot">{loading ? (skeleton ?? <WP8Spinner />) : null}</div>
}

export function TrackSkeletonRows({ count = 10, detail = false }: { count?: number; detail?: boolean }) {
  return <>{Array.from({ length: count }, (_, i) => <TrackSkeletonRow key={i} detail={detail} />)}</>
}

function TrackSkeletonRow({ detail }: { detail: boolean }) {
  return (
    <div className="al-track skeleton-row" aria-hidden="true">
      <span className="al-tnum" />
      {detail ? (
        <span className="skeleton-track-meta">
          <span className="skeleton-block skeleton-title" />
          <span className="skeleton-block skeleton-sub" />
        </span>
      ) : <span className="al-ttitle skeleton-block skeleton-title" />}
      <span className="al-track-actions">
        <span className="al-tdur skeleton-block skeleton-time" />
      </span>
    </div>
  )
}

function TextSkeletonRows({ count = 12 }: { count?: number }) {
  return <>{Array.from({ length: count }, (_, i) => <div key={i} className="lrow skeleton-row" aria-hidden="true"><span className="skeleton-circle" /><span className="skeleton-block skeleton-line" /></div>)}</>
}

function AlbumSkeletonRows({ count = 8 }: { count?: number }) {
  return <>{Array.from({ length: count }, (_, i) => <div key={i} className="album-row skeleton-row" aria-hidden="true"><span className="skeleton-art" /><span className="album-meta"><span className="skeleton-block skeleton-title" /><span className="skeleton-block skeleton-sub" /></span></div>)}</>
}

function PlaylistSkeletonRows({ count = 8 }: { count?: number }) {
  return <>{Array.from({ length: count }, (_, i) => <div key={i} className="pl-row skeleton-row" aria-hidden="true"><span className="skeleton-art" /><span className="pl-meta"><span className="skeleton-block skeleton-title" /><span className="skeleton-block skeleton-sub" /></span></div>)}</>
}

function usePivotScrollRange(total: number, rowHeight: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })

  useEffect(() => {
    const el = ref.current?.closest('.pivot-pane')
    if (!(el instanceof HTMLElement)) return
    const update = () => setViewport({ top: el.scrollTop, height: el.clientHeight })
    update()
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [])

  return useMemo(() => {
    const start = Math.max(0, Math.floor(viewport.top / rowHeight) - VIRTUAL_OVERSCAN)
    const visible = Math.ceil((viewport.height || 1) / rowHeight) + VIRTUAL_OVERSCAN * 2
    return { ref, start, end: Math.min(total, start + visible) }
  }, [rowHeight, total, viewport])
}

export function ArtistsTab({ artists, albumsByArtist, artistIdByName, hasMore, loadingMore, onLoadMore, onOpenArtist, onPlay, onPlayArtist }: {
  artists: string[]; albumsByArtist: Map<string, Album[]>; artistIdByName: Map<string, string>
  hasMore: boolean; loadingMore: boolean; onLoadMore: () => void
  onOpenArtist: (n: string, id?: string) => void
  onPlay: (q: Track[], i: number, ctx?: string) => void
  onPlayArtist: (artistId: string, fallbackQueue: Track[]) => void
}) {
  const rows = useMemo(() => {
    return groupArtistNamesByLetter(artists).flatMap(({ letter, names }) => [
      { type: 'letter' as const, key: `letter-${letter}`, letter },
      ...names.map(name => ({ type: 'artist' as const, key: `artist-${name}`, name })),
    ])
  }, [artists])
  const range = usePivotScrollRange(rows.length, VIRTUAL_ARTIST_ROW_HEIGHT)

  return (
    <div className="llist">
      <Section>all music</Section>
      <div ref={range.ref} className="collection-virtual artist-virtual" style={{ height: rows.length * VIRTUAL_ARTIST_ROW_HEIGHT }}>
        {rows.slice(range.start, range.end).map((row, offset) => {
          const index = range.start + offset
          return (
            <div key={row.key} className="collection-virtual-row artist-virtual-row" style={{ transform: `translateY(${index * VIRTUAL_ARTIST_ROW_HEIGHT}px)` }}>
              {row.type === 'letter' ? (
                <div className="index-tile artist-index-tile">{row.letter}</div>
              ) : (
                <ArtistRow
                  name={row.name}
                  artistId={artistIdByName.get(row.name)}
                  queue={(albumsByArtist.get(row.name) ?? []).flatMap(albumQueue)}
                  onOpenArtist={onOpenArtist}
                  onPlay={onPlay}
                  onPlayArtist={onPlayArtist}
                />
              )}
            </div>
          )
        })}
      </div>
      <LoadMoreSentinel active={hasMore} loading={loadingMore} onLoadMore={onLoadMore} skeleton={<TextSkeletonRows />} />
    </div>
  )
}

function ArtistRow({ name, artistId, queue, onOpenArtist, onPlay, onPlayArtist }: {
  name: string
  artistId: string | undefined
  queue: Track[]
  onOpenArtist: (n: string, id?: string) => void
  onPlay: (q: Track[], i: number, ctx?: string) => void
  onPlayArtist: (artistId: string, fallbackQueue: Track[]) => void
}) {
  return (
    <div className="lrow">
      <button
        className="play-circle"
        aria-label={`Play ${name}`}
        onClick={(e) => {
          e.stopPropagation()
          if (artistId) onPlayArtist(artistId, queue)
          else if (queue.length) onPlay(queue, 0)
        }}
      >
        {Icons.playCircle}
      </button>
      <div className="lrow-name" onClick={() => onOpenArtist(name, artistId)}>{name}</div>
    </div>
  )
}

export function AlbumsTab({ albums, total, onOpenAlbum }: {
  albums: Album[]; total: number | null
  onOpenAlbum: (a: Album) => void
}) {
  const albumTotal = total ?? albums.length
  const loadingPagesRef = useRef<Set<number>>(new Set())
  const loadedPagesRef = useRef<Set<number>>(new Set())
  const failedPagesRef = useRef<Set<number>>(new Set())
  const [virtualAlbums, setVirtualAlbums] = useState<(Album | undefined)[]>([])
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set())
  const range = usePivotScrollRange(albumTotal, VIRTUAL_ALBUM_ROW_HEIGHT)

  useEffect(() => {
    loadingPagesRef.current = new Set()
    loadedPagesRef.current = new Set()
    failedPagesRef.current = new Set()
    setFailedPages(new Set())
    for (let index = 0; index < albums.length; index += LIBRARY_BATCH_LIMIT) {
      loadedPagesRef.current.add(index / LIBRARY_BATCH_LIMIT)
    }
    setVirtualAlbums(() => {
      const next = Array<Album | undefined>(albumTotal)
      albums.forEach((album, index) => { next[index] = album })
      return next
    })
  }, [albums, albumTotal])

  const loadPage = useCallback((pageIndex: number, force = false) => {
    if (pageIndex < 0 || loadedPagesRef.current.has(pageIndex) || loadingPagesRef.current.has(pageIndex)) return
    if (!force && failedPagesRef.current.has(pageIndex)) return
    const offset = pageIndex * LIBRARY_BATCH_LIMIT
    if (albumTotal > 0 && offset >= albumTotal) return

    loadingPagesRef.current.add(pageIndex)
    setFailedPages(prev => {
      if (!prev.has(pageIndex)) return prev
      const next = new Set(prev)
      next.delete(pageIndex)
      failedPagesRef.current = next
      return next
    })
    fetchSavedAlbumsPageAt(offset).then(page => {
      loadedPagesRef.current.add(pageIndex)
      setVirtualAlbums(prev => {
        const size = Math.max(page.total ?? prev.length, offset + page.items.length, prev.length)
        const next = prev.length === size ? [...prev] : Array<Album | undefined>(size)
        prev.forEach((album, index) => { next[index] = album })
        page.items.forEach((album, index) => { next[offset + index] = album })
        return next
      })
    }).catch(() => {
      setFailedPages(prev => {
        const next = new Set(prev).add(pageIndex)
        failedPagesRef.current = next
        return next
      })
    }).finally(() => {
      loadingPagesRef.current.delete(pageIndex)
    })
  }, [albumTotal])

  useEffect(() => {
    if (!albumTotal) return
    const firstPage = Math.floor(range.start / LIBRARY_BATCH_LIMIT)
    const lastPage = Math.floor(Math.max(range.end - 1, range.start) / LIBRARY_BATCH_LIMIT)
    for (let page = firstPage; page <= lastPage; page += 1) loadPage(page)
  }, [albumTotal, loadPage, range.end, range.start])

  const rows = []
  for (let index = range.start; index < range.end; index += 1) {
    const album = virtualAlbums[index]
    const failedPage = failedPages.has(Math.floor(index / LIBRARY_BATCH_LIMIT))
    rows.push(
      <div key={index} className="collection-virtual-row" style={{ transform: `translateY(${index * VIRTUAL_ALBUM_ROW_HEIGHT}px)` }}>
        {album ? <AlbumRow album={album} onOpenAlbum={onOpenAlbum} /> : failedPage ? <VirtualLoadError onRetry={() => loadPage(Math.floor(index / LIBRARY_BATCH_LIMIT), true)} /> : <AlbumSkeletonRows count={1} />}
      </div>,
    )
  }

  return (
    <div className="album-list" ref={range.ref}>
      <div className="collection-virtual" style={{ height: albumTotal * VIRTUAL_ALBUM_ROW_HEIGHT }}>
        {rows}
      </div>
    </div>
  )
}

function AlbumRow({ album, onOpenAlbum }: { album: Album; onOpenAlbum: (a: Album) => void }) {
  return (
    <div className="album-row" onClick={() => onOpenAlbum(album)}>
      <Thumb color={album.color} size={88} imageUrl={album.imageUrl} />
      <div className="album-meta">
        <div className="al-title">{album.title}</div>
        <div className="al-artist">{album.artist}</div>
      </div>
    </div>
  )
}

export function SongsTab({ songs, hasMore, loadingMore, onLoadMore, onPlay }: {
  songs: SongEntry[]; hasMore: boolean; loadingMore: boolean
  onLoadMore: () => void; onPlay: (q: Track[], i: number) => void
}) {
  const { savedTrackUris, checkSavedTrackUris } = useLibrary()
  const validSongs = useMemo(() => songs.filter(s => s.title), [songs])
  const allTracks = useMemo<Track[]>(
    () => validSongs.map(s => albumQueue(s.album)[s.idx]).filter(Boolean) as Track[],
    [validSongs]
  )
  const trackUris = useMemo(
    () => validSongs.map(s => s.album.spotifyTrackUris?.[s.idx]).filter((uri): uri is string => Boolean(uri)),
    [validSongs]
  )
  const trackUriKey = trackUris.join('\u0000')

  useEffect(() => {
    checkSavedTrackUris(trackUris)
  }, [trackUriKey, trackUris, checkSavedTrackUris])

  // Group by first letter
  const groups = useMemo(() => {
    const result: { letter: string; entries: { s: SongEntry; i: number }[] }[] = []
    validSongs.forEach((s, i) => {
      const letter = (s.title[0] ?? '#').toUpperCase()
      const last = result[result.length - 1]
      if (last?.letter === letter) last.entries.push({ s, i })
      else result.push({ letter, entries: [{ s, i }] })
    })
    return result
  }, [validSongs])

  return (
    <div className="song-list">
      {groups.map(({ letter, entries }) => (
        <div key={letter} className="letter-group">
          <div className="index-tile">{letter}</div>
          {entries.map(({ s, i }) => (
            <div key={s.album.id + s.title + i} className="lrow">
              <button
                className="play-circle"
                aria-label={`Play ${s.title}`}
                onClick={(e) => { e.stopPropagation(); onPlay(allTracks, i) }}
              >
                {Icons.playCircle}
              </button>
              <div className="lrow-name song" onClick={() => onPlay(allTracks, i)}>
                <div className="lrow-title">{s.title}</div>
                <div className="lrow-sub">{s.artist}</div>
              </div>
              {s.album.spotifyTrackUris?.[s.idx] && savedTrackUris.has(s.album.spotifyTrackUris[s.idx]!) && (
                <div className="liked-dot" title="liked song">{Icons.heart}</div>
              )}
            </div>
          ))}
        </div>
      ))}
      <LoadMoreSentinel active={hasMore} loading={loadingMore} onLoadMore={onLoadMore} skeleton={<TrackSkeletonRows detail />} />
    </div>
  )
}

export function GenresTab({ artists, albums, onPlay }: {
  artists: ArtistSummary[]
  albums: Album[]
  onPlay: (q: Track[], i: number) => void
}) {
  const genres = useMemo(() => buildGenresFromArtists(artists, albums), [artists, albums])
  const [loading, setLoading] = useState<string | null>(null)

  const play = (g: { label: string; artistNames: string[] }) => {
    if (loading) return
    setLoading(g.label)
    const names = new Set(g.artistNames)
    const queue = albums.filter(album => names.has(album.artist)).flatMap(albumQueue)
    if (queue.length) onPlay(queue, 0)
    setLoading(null)
  }

  return (
    <div className="llist">
      <Section>all music</Section>
      {genres.map(g => (
        <div
          key={g.label}
          className="genre-item"
          onClick={() => play(g)}
          style={{ color: loading === g.label ? 'var(--dim)' : g.color }}
        >
          {g.label}
        </div>
      ))}
      <div style={{ height: 40 }} />
    </div>
  )
}

export function RadioTab({ artists, albumsByArtist, onPlay }: {
  artists: string[]
  albumsByArtist: Map<string, Album[]>
  onPlay: (q: Track[], i: number) => void
}) {
  return (
    <div className="llist">
      <Section>smart dj</Section>
      {artists.map(name => {
        const queue = (albumsByArtist.get(name) ?? []).flatMap(albumQueue)
        return (
          <div key={name} className="lrow">
            <button
              className="play-circle"
              aria-label={`Start ${name} radio`}
              onClick={(e) => { e.stopPropagation(); if (queue.length) onPlay(queue, 0) }}
            >
              {Icons.playCircle}
            </button>
            <div className="lrow-name" onClick={() => queue.length && onPlay(queue, 0)}>
              {name} radio
            </div>
          </div>
        )
      })}
      <div style={{ height: 40 }} />
    </div>
  )
}

export function PlaylistsTab({ playlists, total, onOpenPlaylist }: {
  playlists: Playlist[]; total: number | null; onOpenPlaylist: (pl: Playlist) => void
}) {
  const liked = playlists.find(pl => pl.id === 'sp_liked')
  const seedUserPlaylists = useMemo(() => playlists.filter(pl => pl.id !== 'sp_liked'), [playlists])
  const userTotal = total ?? seedUserPlaylists.length
  const loadingPagesRef = useRef<Set<number>>(new Set())
  const loadedPagesRef = useRef<Set<number>>(new Set())
  const failedPagesRef = useRef<Set<number>>(new Set())
  const [virtualPlaylists, setVirtualPlaylists] = useState<(Playlist | undefined)[]>([])
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set())
  const range = usePivotScrollRange(userTotal, VIRTUAL_PLAYLIST_ROW_HEIGHT)

  useEffect(() => {
    loadingPagesRef.current = new Set()
    loadedPagesRef.current = new Set()
    failedPagesRef.current = new Set()
    setFailedPages(new Set())
    for (let index = 0; index < seedUserPlaylists.length; index += LIBRARY_BATCH_LIMIT) {
      loadedPagesRef.current.add(index / LIBRARY_BATCH_LIMIT)
    }
    setVirtualPlaylists(() => {
      const next = Array<Playlist | undefined>(userTotal)
      seedUserPlaylists.forEach((playlist, index) => { next[index] = playlist })
      return next
    })
  }, [seedUserPlaylists, userTotal])

  const loadPage = useCallback((pageIndex: number, force = false) => {
    if (pageIndex < 0 || loadedPagesRef.current.has(pageIndex) || loadingPagesRef.current.has(pageIndex)) return
    if (!force && failedPagesRef.current.has(pageIndex)) return
    const offset = pageIndex * LIBRARY_BATCH_LIMIT
    if (userTotal > 0 && offset >= userTotal) return

    loadingPagesRef.current.add(pageIndex)
    setFailedPages(prev => {
      if (!prev.has(pageIndex)) return prev
      const next = new Set(prev)
      next.delete(pageIndex)
      failedPagesRef.current = next
      return next
    })
    fetchUserPlaylistsPageAt(offset).then(page => {
      loadedPagesRef.current.add(pageIndex)
      setVirtualPlaylists(prev => {
        const size = Math.max(page.total ?? prev.length, offset + page.items.length, prev.length)
        const next = prev.length === size ? [...prev] : Array<Playlist | undefined>(size)
        prev.forEach((playlist, index) => { next[index] = playlist })
        page.items.forEach((playlist, index) => { next[offset + index] = playlist })
        return next
      })
    }).catch(() => {
      setFailedPages(prev => {
        const next = new Set(prev).add(pageIndex)
        failedPagesRef.current = next
        return next
      })
    }).finally(() => {
      loadingPagesRef.current.delete(pageIndex)
    })
  }, [userTotal])

  useEffect(() => {
    if (!userTotal) return
    const firstPage = Math.floor(range.start / LIBRARY_BATCH_LIMIT)
    const lastPage = Math.floor(Math.max(range.end - 1, range.start) / LIBRARY_BATCH_LIMIT)
    for (let page = firstPage; page <= lastPage; page += 1) loadPage(page)
  }, [loadPage, range.end, range.start, userTotal])

  const rows = []
  for (let index = range.start; index < range.end; index += 1) {
    const playlist = virtualPlaylists[index]
    const failedPage = failedPages.has(Math.floor(index / LIBRARY_BATCH_LIMIT))
    rows.push(
      <div key={index} className="collection-virtual-row" style={{ transform: `translateY(${index * VIRTUAL_PLAYLIST_ROW_HEIGHT}px)` }}>
        {playlist ? <PlaylistRow playlist={playlist} onOpenPlaylist={onOpenPlaylist} /> : failedPage ? <VirtualLoadError onRetry={() => loadPage(Math.floor(index / LIBRARY_BATCH_LIMIT), true)} /> : <PlaylistSkeletonRows count={1} />}
      </div>,
    )
  }

  return (
    <div className="pl-list" ref={range.ref}>
      {liked && <PlaylistRow playlist={liked} onOpenPlaylist={onOpenPlaylist} />}
      <div className="collection-virtual" style={{ height: userTotal * VIRTUAL_PLAYLIST_ROW_HEIGHT }}>
        {rows}
      </div>
    </div>
  )
}

function VirtualLoadError({ onRetry }: { onRetry: () => void }) {
  return <button className="virtual-load-error" onClick={onRetry}>couldn't load · tap to retry</button>
}

function PlaylistRow({ playlist, onOpenPlaylist }: { playlist: Playlist; onOpenPlaylist: (pl: Playlist) => void }) {
  const count = playlist.totalTracks ?? playlist.tracks?.length ?? 0
  return (
    <div className="pl-row" onClick={() => onOpenPlaylist(playlist)}>
      <div className="pl-mosaic">
        {playlist.imageUrl
          ? <FadeImage src={playlist.imageUrl} alt="" />
          : <div className="art-placeholder" style={{ width: '100%', height: '100%' }} />
        }
      </div>
      <div className="pl-meta">
        <div className="pl-name">{playlist.name}</div>
        <div className="pl-count">{count} songs</div>
      </div>
    </div>
  )
}
