import { useRef } from 'react'
import { Icons } from '../components/icons'
import { PlaybackState } from '../hooks/usePlayback'
import { NowPlayingPane } from '../components/NowPlayingPane'

const MENU: [string, number][] = [
  ['artists', 0], ['albums', 1], ['songs', 2], ['genres', 3], ['playlists', 4], ['radio', 5],
]

interface Props {
  pb: PlaybackState
  onOpenCollection: (tab: number) => void
  onOpenNowPlaying: () => void
  onShuffle: () => void
  onSettings: () => void
}

export function Hub({ pb, onOpenCollection, onOpenNowPlaying, onShuffle, onSettings }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)

  const onScroll = () => {
    if (titleRef.current && stripRef.current) {
      titleRef.current.style.transform = `translateX(${-stripRef.current.scrollLeft * 0.45}px)`
    }
  }

  return (
    <div className="hub theme-dark">
      {/* Background — swap src for real artist image from Spotify API */}
      <div className="hub-bg" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }} />
      <div className="hub-scrim" />
      <div className="pano-title" ref={titleRef}>music</div>

      <div className="hub-strip" ref={stripRef} onScroll={onScroll}>
        {pb.started && (
          <div className="pane">
            <NowPlayingPane pb={pb} onOpen={onOpenNowPlaying} />
          </div>
        )}
        <div className="pane">
          <div className="pane-head">collection</div>
          <div className="hub-menu">
            {MENU.map(([label, tab]) => (
              <button key={label} className="hub-item" onClick={() => onOpenCollection(tab)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="appbar">
        <div className="appbar-left">
          <button className="ic-btn" aria-label="Shuffle all" onClick={onShuffle}>
            {Icons.shuffle2}
          </button>
          <button className="ic-btn" aria-label="Search">
            {Icons.search}
          </button>
        </div>
        <button className="ellipsis" aria-label="Settings" onClick={onSettings}><i /><i /><i /></button>
      </div>
    </div>
  )
}
