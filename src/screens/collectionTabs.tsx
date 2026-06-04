import { useEffect, useMemo, useRef } from 'react'
import { Track, Album, Playlist, SongEntry, albumQueue } from '../data'
import { Section, Thumb } from '../components/Pivot'
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

function LoadMoreSentinel({ active, loading, onLoadMore }: { active: boolean; loading: boolean; onLoadMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!active || !el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loading) onLoadMore()
    }, { rootMargin: '240px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [active, loading, onLoadMore])
  return <div ref={ref} style={{ height: 80, color: '#888', paddingTop: 16 }}>{loading ? 'loading more...' : ''}</div>
}

export function ArtistsTab({ artists, albumsByArtist, artistIdByName, hasMore, loadingMore, onLoadMore, onOpenArtist, onPlay }: {
  artists: string[]; albumsByArtist: Map<string, Album[]>; artistIdByName: Map<string, string>
  hasMore: boolean; loadingMore: boolean; onLoadMore: () => void
  onOpenArtist: (n: string, id?: string) => void
  onPlay: (q: Track[], i: number, ctx?: string) => void
}) {
  // Group by first letter so sticky tile resolves within its group — no overlap at transition
  const groups = useMemo(() => {
    const result: { letter: string; names: string[] }[] = []
    artists.forEach(name => {
      const letter = name.replace(/^the\s+/i, '')[0]?.toUpperCase() ?? '#'
      const last = result[result.length - 1]
      if (last?.letter === letter) last.names.push(name)
      else result.push({ letter, names: [name] })
    })
    return result
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
                  onClick={(e) => { e.stopPropagation(); if (queue.length) onPlay(queue, 0) }}
                >
                  {Icons.playCircle}
                </button>
                <div className="lrow-name" onClick={() => onOpenArtist(name, artistId)}>{name}</div>
              </div>
            )
          })}
        </div>
      ))}
      <LoadMoreSentinel active={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
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

export function GenresTab({ albums, onPlay }: {
  albums: Album[]
  onPlay: (q: Track[], i: number) => void
}) {
  // Derive genres from album color-buckets; use a fixed Metro-style genre list
  // supplemented with artist names when the library is populated.
  const GENRE_COLORS = [
    '#5ca800','#1ba1e2','#a4c400','#d80073','#fa6800','#6a00ff','#3a8f6b','#c43b6b',
  ]
  const genres = albums.length
    ? [...new Set(albums.map(a => a.artist))].slice(0, 8).map((artist, i) => ({
        label: artist,
        color: albums.find(a => a.artist === artist)?.color ?? GENRE_COLORS[i % GENRE_COLORS.length],
        queue: albums.filter(a => a.artist === artist).flatMap(a => albumQueue(a)),
      }))
    : ['alternative','ambient','electronic','indie','pop','rock','synth-pop','trip-hop'].map((g, i) => ({
        label: g,
        color: GENRE_COLORS[i % GENRE_COLORS.length],
        queue: [] as Track[],
      }))

  return (
    <div className="llist">
      <Section>all music</Section>
      {genres.map(g => (
        <div
          key={g.label}
          className="genre-item"
          onClick={() => g.queue.length && onPlay(g.queue, 0)}
          style={{ color: g.color }}
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
                ? <img src={pl.imageUrl} alt="" />
                : <div style={{ background: '#333', width: '100%', height: '100%' }} />
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
