import { Track, Album, artistAlbums, albumQueue } from '../data'
import { Pivot, PivotArea, Section, Thumb, useSwipe, BottomBack } from '../components/Pivot'
import { Icons } from '../components/icons'

interface Props {
  name: string
  tab: number
  onTabChange: (t: number) => void
  onOpenAlbum: (album: Album) => void
  onPlay: (queue: Track[], idx: number) => void
  onBack: () => void
}

export function ArtistCard({ name, tab, onTabChange, onOpenAlbum, onPlay, onBack }: Props) {
  const albums = artistAlbums(name)
  const swipe = useSwipe(
    () => tab === 0 ? onBack() : onTabChange(0),
    () => onTabChange(1),
  )

  return (
    <div className="page artist-card">
      {/* Background — swap for real artist image from Spotify API */}
      <div className="card-bg" style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0f3460 100%)' }} />
      <div className="card-scrim" />
      <div className="card-body">
        <div className="artist-heading">{name}</div>
        <Pivot tabs={['albums', 'songs']} active={tab} onChange={onTabChange} />
        <PivotArea tab={tab} {...swipe}>
          {/* albums */}
          <div style={{ padding: '0 26px' }}>
            <Section>in collection</Section>
            <div className="card-albums-grid">
              {albums.map((a) => (
                <div key={a.id} className="card-album-cell" onClick={() => onOpenAlbum(a)}>
                  <Thumb color={a.color} imageUrl={a.imageUrl} />
                  <div className="ca-title">{a.title}</div>
                  <div className="ca-sub">{a.year}</div>
                </div>
              ))}
            </div>
            <Section>store</Section>
            <div className="store-row">
              <button className="dl-circle" aria-label="Download more">{Icons.download}</button>
              <div className="store-text">more from {name}</div>
            </div>
            <div style={{ height: 80 }} />
          </div>
          {/* songs */}
          <div>
            {albums.flatMap((a) =>
              a.tracks.map(([title], i) => (
                <div key={a.id + i} className="lrow" style={{ padding: '8px 26px' }}>
                  <button
                    className="play-circle"
                    aria-label={`Play ${title}`}
                    onClick={(e) => { e.stopPropagation(); onPlay(albumQueue(a), i) }}
                  >
                    {Icons.playCircle}
                  </button>
                  <div className="lrow-name song" onClick={() => onPlay(albumQueue(a), i)}>
                    <div className="lrow-title">{title}</div>
                    <div className="lrow-sub">{a.title}</div>
                  </div>
                </div>
              ))
            )}
            <div style={{ height: 80 }} />
          </div>
        </PivotArea>
      </div>
      <BottomBack onBack={onBack} />
    </div>
  )
}
