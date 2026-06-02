import { useEffect, useRef } from 'react'
import {
  Track, Album, Playlist, SongEntry,
  GENRES,
  albumQueue, artistQueue, resolvePlaylistTrack,
} from '../data'
import { useLibrary } from '../LibraryContext'
import { Pivot, PivotArea, Section, Thumb, useSwipe, BottomBack } from '../components/Pivot'
import { Icons } from '../components/icons'

const TABS = ['artists', 'albums', 'songs', 'genres', 'playlists', 'radio']

interface Props {
  tab: number
  onTabChange: (t: number) => void
  onOpenArtist: (name: string) => void
  onOpenAlbum: (album: Album) => void
  onOpenGenre: (genre: string) => void
  onOpenPlaylist: (pl: Playlist) => void
  onPlay: (queue: Track[], idx: number) => void
  onBack: () => void
}

export function Collection({ tab, onTabChange, onOpenArtist, onOpenAlbum, onOpenGenre, onOpenPlaylist, onPlay, onBack }: Props) {
  const { albums, artists, songs, playlists, loading, loadingMore, error, totals, loadMore } = useLibrary()
  const swipe = useSwipe(
    () => tab === 0 ? onBack() : onTabChange(tab - 1),
    () => onTabChange(Math.min(TABS.length - 1, tab + 1)),
  )

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
        loading library…
      </div>
    )
  }

  if (error) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e74c3c', padding: 32, textAlign: 'center' }}>
        failed to load library: {error}
      </div>
    )
  }

  return (
    <div className="page">
      <Pivot tabs={TABS} active={tab} onChange={onTabChange} />
      <PivotArea tab={tab} {...swipe}>
        <ArtistsTab artists={artists} albums={albums} hasMore={hasMore(albums.length, totals.albums)} loadingMore={loadingMore.albums} onLoadMore={() => loadMore('albums')} onOpenArtist={onOpenArtist} onPlay={onPlay} />
        <AlbumsTab albums={albums} total={totals.albums} loadingMore={loadingMore.albums} onLoadMore={() => loadMore('albums')} onOpenArtist={onOpenArtist} onOpenAlbum={onOpenAlbum} />
        <SongsTab songs={songs} hasMore={hasMore(albums.length, totals.albums)} loadingMore={loadingMore.albums} onLoadMore={() => loadMore('albums')} onPlay={onPlay} />
        <GenresTab onOpenGenre={onOpenGenre} />
        <PlaylistsTab playlists={playlists} total={totals.playlists} loadingMore={loadingMore.playlists} onLoadMore={() => loadMore('playlists')} onOpenPlaylist={onOpenPlaylist} />
        <RadioTab artists={artists} albums={albums} onPlay={onPlay} />
      </PivotArea>
      <BottomBack onBack={onBack} />
    </div>
  )
}

function hasMore(loaded: number, total: number | null): boolean {
  return total === null || loaded < total
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

// ── Artists ──────────────────────────────────────────────────────────────────
interface ArtistsProps {
  artists: string[]
  albums: Album[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onOpenArtist: (n: string) => void
  onPlay: (q: Track[], i: number) => void
}

function ArtistsTab({ artists, albums, hasMore, loadingMore, onLoadMore, onOpenArtist, onPlay }: ArtistsProps) {
  let prevLetter = ''
  return (
    <div className="llist">
      <Section>all music</Section>
      {artists.map((name) => {
        const letter = name.replace(/^the\s+/i, '')[0].toUpperCase()
        const showTile = letter !== prevLetter
        prevLetter = letter
        return (
          <div key={name}>
            {showTile && <div className="index-tile">{letter}</div>}
            <div className="lrow">
              <button
                className="play-circle"
                aria-label={`Play ${name}`}
                onClick={(e) => { e.stopPropagation(); onPlay(artistQueue(name, albums), 0) }}
              >
                {Icons.playCircle}
              </button>
              <div className="lrow-name" onClick={() => onOpenArtist(name)}>{name}</div>
            </div>
          </div>
        )
      })}
      <LoadMoreSentinel active={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
    </div>
  )
}

// ── Albums ───────────────────────────────────────────────────────────────────
interface AlbumsProps {
  albums: Album[]
  total: number | null
  loadingMore: boolean
  onLoadMore: () => void
  onOpenArtist: (n: string) => void
  onOpenAlbum: (a: Album) => void
}

function AlbumsTab({ albums, total, loadingMore, onLoadMore, onOpenArtist, onOpenAlbum }: AlbumsProps) {
  return (
    <div className="album-list">
      {albums.map((a) => (
        <div key={a.id} className="album-group">
          <div className="group-head" onClick={() => onOpenArtist(a.artist)}>{a.artist}</div>
          <div className="album-row" onClick={() => onOpenAlbum(a)}>
            <Thumb color={a.color} size={88} imageUrl={a.imageUrl} />
            <div className="album-meta">
              <div className="al-title">{a.title}</div>
              <div className="al-year">{a.year}</div>
            </div>
          </div>
        </div>
      ))}
      <LoadMoreSentinel active={hasMore(albums.length, total)} loading={loadingMore} onLoadMore={onLoadMore} />
    </div>
  )
}

// ── Songs ────────────────────────────────────────────────────────────────────
function SongsTab({ songs, hasMore, loadingMore, onLoadMore, onPlay }: { songs: SongEntry[]; hasMore: boolean; loadingMore: boolean; onLoadMore: () => void; onPlay: (q: Track[], i: number) => void }) {
  return (
    <div className="song-list">
      {songs.map((s, i) => {
        const letter = s.title[0].toUpperCase()
        const prevLetter = i > 0 ? songs[i - 1].title[0].toUpperCase() : null
        return (
          <div key={s.album.id + s.title}>
            {letter !== prevLetter && <div className="index-tile">{letter}</div>}
            <div className="lrow">
              <button
                className="play-circle"
                aria-label={`Play ${s.title}`}
                onClick={(e) => { e.stopPropagation(); onPlay(albumQueue(s.album), s.idx) }}
              >
                {Icons.playCircle}
              </button>
              <div className="lrow-name song" onClick={() => onPlay(albumQueue(s.album), s.idx)}>
                <div className="lrow-title">{s.title}</div>
                <div className="lrow-sub">{s.artist}</div>
              </div>
            </div>
          </div>
        )
      })}
      <LoadMoreSentinel active={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
    </div>
  )
}

// ── Genres ───────────────────────────────────────────────────────────────────
function GenresTab({ onOpenGenre }: { onOpenGenre: (g: string) => void }) {
  return (
    <div className="llist">
      <Section>all music</Section>
      {GENRES.map((g) => (
        <div key={g} className="genre-item" onClick={() => onOpenGenre(g)}>{g}</div>
      ))}
      <div style={{ height: 80 }} />
    </div>
  )
}

// ── Playlists ────────────────────────────────────────────────────────────────
function PlaylistsTab({ playlists, total, loadingMore, onLoadMore, onOpenPlaylist }: { playlists: Playlist[]; total: number | null; loadingMore: boolean; onLoadMore: () => void; onOpenPlaylist: (pl: Playlist) => void }) {
  const loadedUserPlaylists = playlists.filter(pl => pl.id !== 'sp_liked').length

  return (
    <div className="pl-list">
      {playlists.map((pl) => {
        const tracks = pl.tracks ?? pl.items.map(it => resolvePlaylistTrack(it))
        const cols = tracks.slice(0, 4).map(t => t.color)
        const count = pl.totalTracks ?? (tracks.length || pl.items.length)
        while (cols.length < 4) cols.push(cols[cols.length - 1] ?? '#444')
        return (
          <div key={pl.id} className="pl-row" onClick={() => onOpenPlaylist(pl)}>
            <div className="pl-mosaic">
              {cols.map((c, i) => <span key={i} style={{ background: c }} />)}
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

// ── Radio ────────────────────────────────────────────────────────────────────
interface RadioProps { artists: string[]; albums: Album[]; onPlay: (q: Track[], i: number) => void }

function RadioTab({ artists, albums, onPlay }: RadioProps) {
  return (
    <div className="llist">
      <Section>smart dj</Section>
      {artists.map((name) => (
        <div key={name} className="lrow">
          <button
            className="play-circle"
            aria-label={`Start ${name} radio`}
            onClick={(e) => { e.stopPropagation(); onPlay(artistQueue(name, albums), 0) }}
          >
            {Icons.playCircle}
          </button>
          <div className="lrow-name" onClick={() => onPlay(artistQueue(name, albums), 0)}>
            {name} radio
          </div>
        </div>
      ))}
      <div style={{ height: 80 }} />
    </div>
  )
}
