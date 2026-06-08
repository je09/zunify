import { fmt } from '../data'
import { Icons } from '../components/icons'

interface Props {
  title: string
  duration: number
  subtitle?: string
  spotifyUri?: string
  isSaved: boolean
  onPlay: () => void
  onToggleSaved: () => void
}

export function TrackListRow({ title, duration, subtitle, spotifyUri, isSaved, onPlay, onToggleSaved }: Props) {
  return (
    <div className="al-track" onClick={onPlay}>
      <span className="al-tnum" />
      <div className="al-track-main">
        <div className="al-ttitle">{title}</div>
        {subtitle && <div className="al-track-sub">{subtitle}</div>}
      </div>
      <div className="al-track-actions">
        {spotifyUri && (
          <button
            className={'iconbtn ' + (isSaved ? 'on' : 'outline')}
            style={{ width: 28, height: 28 }}
            onClick={(e) => { e.stopPropagation(); onToggleSaved() }}
            aria-label={isSaved ? 'Unlike' : 'Like'}
          >
            {Icons.heart}
          </button>
        )}
        <span className="al-tdur">{fmt(duration)}</span>
      </div>
    </div>
  )
}
