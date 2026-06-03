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
  let prevLetter = ''
  return (
    <div className="llist">
      <Section>all music</Section>
      {artists.map((name) => {
        const letter = name.replace(/^the\s+/i, '')[0]?.toUpperCase() ?? '#'
        const showTile = letter !== prevLetter
        prevLetter = letter
        const artistId = artistIdByName.get(name)
        const artistAlbums = albumsByArtist.get(name) ?? []
        const queue = artistAlbums.flatMap(albumQueue)
        return (
          <div key={name}>
            {showTile && <div className="index-tile">{letter}</div>}
            <div className="lrow">
              <button
                className="play-circle"
                aria-label={`Play ${name}`}
                onClick={(e) => { e.stopPropagation(); if (queue.length) onPlay(queue, 0) }}
              >
                {Icons.playCircle}
              </button>
              <div className="lrow-name" onClick={() => onOpenArtist(name, artistId)}>{name}</div>
            </div>
          </div>
        )
      })}
      <LoadMoreSentinel active={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
    </div>
  )
}

export function AlbumsTab({ albums, total, loadingMore, onLoadMore, onOpenArtist, onOpenAlbum, artistIdByName }: {
  albums: Album[]; total: number | null; loadingMore: boolean; onLoadMore: () => void
  onOpenArtist: (n: string, id?: string) => void; onOpenAlbum: (a: Album) => void
  artistIdByName: Map<string, string>
}) {
  const sorted = useMemo(
    () => [...albums].sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })),
    [albums]
  )
  return (
    <div className="album-list">
      {sorted.map((a) => (
        <div key={a.id} className="album-group">
          <div className="group-head" onClick={() => onOpenArtist(a.artist, artistIdByName.get(a.artist))}>{a.artist}</div>
          <div className="album-row" onClick={() => onOpenAlbum(a)}>
            <Thumb color={a.color} size={88} imageUrl={a.imageUrl} />
            <div className="album-meta">
              <div className="al-title">{a.title}</div>
              <div className="al-year">{a.year || ''}</div>
            </div>
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
  return (
    <div className="song-list">
      {validSongs.map((s, i) => {
        const letter = (s.title[0] ?? '#').toUpperCase()
        const prevLetter = i > 0 ? (validSongs[i - 1].title[0] ?? '#').toUpperCase() : null
        return (
          <div key={s.album.id + s.title + i}>
            {letter !== prevLetter && <div className="index-tile">{letter}</div>}
            <div className="lrow">
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
          </div>
        )
      })}
      <LoadMoreSentinel active={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
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
