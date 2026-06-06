import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Track, Album, ArtistSummary, Playlist, SongEntry, albumQueue } from '../data'
import { Section, Thumb, WP8Spinner } from '../components/Pivot'
import { FadeImage } from '../components/FadeImage'
import { Icons } from '../components/icons'

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

function LoadMoreSentinel({ active, loading, onLoadMore, preserveAnchor = false, anchorKey }: {
  active: boolean; loading: boolean; onLoadMore: () => void; preserveAnchor?: boolean; anchorKey?: number
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
    }, { rootMargin: '240px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [active, loading, onLoadMore, preserveAnchor])
  return <div ref={ref} style={{ minHeight: 80 }}>{loading ? <WP8Spinner /> : null}</div>
}

export function ArtistsTab({ artists, albumsByArtist, artistIdByName, hasMore, loadingMore, onLoadMore, onOpenArtist, onPlay, onPlayArtist }: {
  artists: string[]; albumsByArtist: Map<string, Album[]>; artistIdByName: Map<string, string>
  hasMore: boolean; loadingMore: boolean; onLoadMore: () => void
  onOpenArtist: (n: string, id?: string) => void
  onPlay: (q: Track[], i: number, ctx?: string) => void
  onPlayArtist: (artistId: string, fallbackQueue: Track[]) => void
}) {
  // Group by first letter so sticky tile resolves within its group — no overlap at transition
  const groups = useMemo(() => {
    return groupArtistNamesByLetter(artists)
  }, [artists])

  return (
    <div className="llist">
      <Section>all music</Section>
      {groups.map(({ letter, names }) => (
        <div key={letter} className="letter-group">
          <div className="index-tile">{letter}</div>
          {names.map(name => {
            const artistId = artistIdByName.get(name)
            const queue = (albumsByArtist.get(name) ?? []).flatMap(albumQueue)
            return (
              <div key={name} className="lrow">
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
          })}
        </div>
      ))}
      <LoadMoreSentinel active={hasMore} loading={loadingMore} onLoadMore={onLoadMore} preserveAnchor anchorKey={artists.length} />
    </div>
  )
}

export function AlbumsTab({ albums, total, loadingMore, onLoadMore, onOpenAlbum }: {
  albums: Album[]; total: number | null; loadingMore: boolean; onLoadMore: () => void
  onOpenAlbum: (a: Album) => void
}) {
  const sorted = useMemo(
    () => [...albums].sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })),
    [albums]
  )
  return (
    <div className="album-list">
      {sorted.map((a) => (
        <div key={a.id} className="album-row" onClick={() => onOpenAlbum(a)}>
          <Thumb color={a.color} size={88} imageUrl={a.imageUrl} />
          <div className="album-meta">
            <div className="al-title">{a.title}</div>
            <div className="al-artist">{a.artist}</div>
          </div>
        </div>
      ))}
      <LoadMoreSentinel active={hasMore(albums.length, total)} loading={loadingMore} onLoadMore={onLoadMore} />
    </div>
  )
}

export function SongsTab({ songs, likedTrackUris, hasMore, loadingMore, onLoadMore, onPlay }: {
  songs: SongEntry[]; likedTrackUris: Set<string>; hasMore: boolean; loadingMore: boolean
  onLoadMore: () => void; onPlay: (q: Track[], i: number) => void
}) {
  const validSongs = useMemo(() => songs.filter(s => s.title), [songs])
  const allTracks = useMemo<Track[]>(
    () => validSongs.map(s => albumQueue(s.album)[s.idx]).filter(Boolean) as Track[],
    [validSongs]
  )

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
              {s.album.spotifyTrackUris?.[s.idx] && likedTrackUris.has(s.album.spotifyTrackUris[s.idx]!) && (
                <div className="liked-dot" title="liked song">{Icons.heart}</div>
              )}
            </div>
          ))}
        </div>
      ))}
      <LoadMoreSentinel active={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
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

export function PlaylistsTab({ playlists, total, loadingMore, onLoadMore, onOpenPlaylist }: {
  playlists: Playlist[]; total: number | null; loadingMore: boolean
  onLoadMore: () => void; onOpenPlaylist: (pl: Playlist) => void
}) {
  const loadedUserPlaylists = playlists.filter(pl => pl.id !== 'sp_liked').length
  return (
    <div className="pl-list">
      {playlists.map((pl) => {
        const count = pl.totalTracks ?? pl.tracks?.length ?? 0
        return (
          <div key={pl.id} className="pl-row" onClick={() => onOpenPlaylist(pl)}>
            <div className="pl-mosaic">
              {pl.imageUrl
                ? <FadeImage src={pl.imageUrl} alt="" />
                : <div className="art-placeholder" style={{ width: '100%', height: '100%' }} />
              }
            </div>
            <div className="pl-meta">
              <div className="pl-name">{pl.name}</div>
              <div className="pl-count">{count} songs</div>
            </div>
          </div>
        )
      })}
      <LoadMoreSentinel active={hasMore(loadedUserPlaylists, total)} loading={loadingMore} onLoadMore={onLoadMore} />
    </div>
  )
}
