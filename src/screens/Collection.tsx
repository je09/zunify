import {
  Track, Album, Playlist,
  ALBUMS, ARTISTS, SONGS, GENRES, PLAYLISTS,
  albumQueue, artistQueue, resolvePlaylistTrack,
} from '../data'
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
  const swipe = useSwipe(
    () => tab === 0 ? onBack() : onTabChange(tab - 1),
    () => onTabChange(Math.min(TABS.length - 1, tab + 1)),
  )

  return (
    <div className="page">
      <Pivot tabs={TABS} active={tab} onChange={onTabChange} />
      <PivotArea tab={tab} {...swipe}>
        <ArtistsTab onOpenArtist={onOpenArtist} onPlay={onPlay} />
        <AlbumsTab onOpenArtist={onOpenArtist} onOpenAlbum={onOpenAlbum} />
        <SongsTab onPlay={onPlay} />
        <GenresTab onOpenGenre={onOpenGenre} />
        <PlaylistsTab onOpenPlaylist={onOpenPlaylist} />
        <RadioTab onPlay={onPlay} />
      </PivotArea>
      <BottomBack onBack={onBack} />
    </div>
  )
}

// ── Artists ──────────────────────────────────────────────────────────────────
function ArtistsTab({ onOpenArtist, onPlay }: { onOpenArtist: (n: string) => void; onPlay: (q: Track[], i: number) => void }) {
  let prevLetter = ''
  return (
    <div className="llist">
      <Section>all music</Section>
      {ARTISTS.map((name) => {
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
                onClick={(e) => { e.stopPropagation(); onPlay(artistQueue(name), 0) }}
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
function AlbumsTab({ onOpenArtist, onOpenAlbum }: { onOpenArtist: (n: string) => void; onOpenAlbum: (a: Album) => void }) {
  return (
    <div className="album-list">
      {ALBUMS.map((a) => (
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
function SongsTab({ onPlay }: { onPlay: (q: Track[], i: number) => void }) {
  return (
    <div className="song-list">
      {SONGS.map((s, i) => {
        const letter = s.title[0].toUpperCase()
        const prevLetter = i > 0 ? SONGS[i - 1].title[0].toUpperCase() : null
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
function RadioTab({ onPlay }: { onPlay: (q: Track[], i: number) => void }) {
  return (
    <div className="llist">
      <Section>smart dj</Section>
      {ARTISTS.map((name) => (
        <div key={name} className="lrow">
          <button
            className="play-circle"
            aria-label={`Start ${name} radio`}
            onClick={(e) => { e.stopPropagation(); onPlay(artistQueue(name), 0) }}
          >
            {Icons.playCircle}
          </button>
          <div className="lrow-name" onClick={() => onPlay(artistQueue(name), 0)}>
            {name} radio
          </div>
        </div>
      ))}
      <div style={{ height: 80 }} />
    </div>
  )
}
