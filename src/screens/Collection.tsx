import {
  Track, Album, Playlist, SongEntry,
  GENRES, PLAYLISTS,
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
  const { albums, artists, songs, loading } = useLibrary()
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

  return (
    <div className="page">
      <Pivot tabs={TABS} active={tab} onChange={onTabChange} />
      <PivotArea tab={tab} {...swipe}>
        <ArtistsTab artists={artists} albums={albums} onOpenArtist={onOpenArtist} onPlay={onPlay} />
        <AlbumsTab albums={albums} onOpenArtist={onOpenArtist} onOpenAlbum={onOpenAlbum} />
        <SongsTab songs={songs} onPlay={onPlay} />
        <GenresTab onOpenGenre={onOpenGenre} />
        <PlaylistsTab onOpenPlaylist={onOpenPlaylist} />
        <RadioTab artists={artists} albums={albums} onPlay={onPlay} />
      </PivotArea>
      <BottomBack onBack={onBack} />
    </div>
  )
}

// ── Artists ──────────────────────────────────────────────────────────────────
interface ArtistsProps {
  artists: string[]
  albums: Album[]
  onOpenArtist: (n: string) => void
  onPlay: (q: Track[], i: number) => void
}

function ArtistsTab({ artists, albums, onOpenArtist, onPlay }: ArtistsProps) {
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
      <div style={{ height: 80 }} />
    </div>
  )
}

// ── Albums ───────────────────────────────────────────────────────────────────
interface AlbumsProps {
  albums: Album[]
  onOpenArtist: (n: string) => void
  onOpenAlbum: (a: Album) => void
}

function AlbumsTab({ albums, onOpenArtist, onOpenAlbum }: AlbumsProps) {
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
      <div style={{ height: 80 }} />
    </div>
  )
}

// ── Songs ────────────────────────────────────────────────────────────────────
function SongsTab({ songs, onPlay }: { songs: SongEntry[]; onPlay: (q: Track[], i: number) => void }) {
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
      <div style={{ height: 80 }} />
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
function PlaylistsTab({ onOpenPlaylist }: { onOpenPlaylist: (pl: Playlist) => void }) {
  return (
    <div className="pl-list">
      {PLAYLISTS.map((pl) => {
        const cols = pl.items.slice(0, 4).map((it) => resolvePlaylistTrack(it).color)
        while (cols.length < 4) cols.push(cols[cols.length - 1] ?? '#444')
        return (
          <div key={pl.id} className="pl-row" onClick={() => onOpenPlaylist(pl)}>
            <div className="pl-mosaic">
              {cols.map((c, i) => <span key={i} style={{ background: c }} />)}
            </div>
            <div className="pl-meta">
              <div className="pl-name">{pl.name}</div>
              <div className="pl-count">{pl.items.length} songs</div>
            </div>
          </div>
        )
      })}
      <div style={{ height: 80 }} />
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
