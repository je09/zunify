import { Track, Album, albumQueue, fmt } from '../data'
import { Pivot, PivotArea, Thumb, useSwipe, BottomBack } from '../components/Pivot'

interface Props {
  album: Album
  tab: number
  onTabChange: (t: number) => void
  onPlay: (queue: Track[], idx: number) => void
  onBack: () => void
}

export function AlbumDetail({ album, tab, onTabChange, onPlay, onBack }: Props) {
  const swipe = useSwipe(
    () => tab === 0 ? onBack() : onTabChange(0),
    () => onTabChange(1),
  )

  return (
    <div className="page">
      <Pivot tabs={['songs', 'review']} active={tab} onChange={onTabChange} />
      <PivotArea tab={tab} {...swipe}>
        {/* songs */}
        <div>
          <div className="al-head">
            <Thumb color={album.color} size={132} imageUrl={album.imageUrl} />
            <div className="al-head-meta">
              <div className="al-head-title">{album.title}</div>
              <div className="al-head-sub">{album.artist}</div>
              <button className="al-playall" onClick={() => onPlay(albumQueue(album), 0)}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M7 5.5v13L19 12z" fill="currentColor" />
                </svg>
                <span>play</span>
              </button>
            </div>
          </div>
          <div className="track-list">
            {album.tracks.map(([title, dur], i) => (
              <div key={title} className="al-track" onClick={() => onPlay(albumQueue(album), i)}>
                <span className="al-tnum">{i + 1}</span>
                <span className="al-ttitle">{title}</span>
                <span className="al-tdur">{fmt(dur)}</span>
              </div>
            ))}
            <div style={{ height: 80 }} />
          </div>
        </div>
        {/* review */}
        <div className="review">
          <Thumb color={album.color} size={132} imageUrl={album.imageUrl} />
          <p className="review-body">
            {album.artist} &mdash; <em>{album.title}</em> ({album.year}).{' '}
            {album.tracks.length} tracks, indexed locally and ready to play offline.
          </p>
          <div className="stars">
            {'★★★★'.split('').map((s, i) => <span key={i}>{s}</span>)}
            <span className="dim">☆</span>
          </div>
        </div>
      </PivotArea>
      <BottomBack onBack={onBack} />
    </div>
  )
}
