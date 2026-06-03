import { useRef } from 'react'
import { Album } from '../data'
import { Icons } from '../components/icons'
import { PlaybackState } from '../hooks/usePlayback'
import { NowPlayingPane } from '../components/NowPlayingPane'
import { useHubData } from './useHubData'

const MENU: [string, number][] = [
  ['artists', 0], ['albums', 1], ['songs', 2], ['playlists', 3],
]

interface Props {
  pb: PlaybackState
  token: string | null
  onOpenCollection: (tab: number) => void
  onOpenNowPlaying: () => void
  onOpenAlbum: (album: Album) => void
  onShuffle: () => void
  onSettings: () => void
}

export function Hub({ pb, token, onOpenCollection, onOpenNowPlaying, onOpenAlbum, onShuffle, onSettings }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const home = useHubData(token)

  const onScroll = () => {
    if (titleRef.current && stripRef.current) {
      titleRef.current.style.transform = `translateX(${-stripRef.current.scrollLeft * 0.45}px)`
    }
  }

  return (
    <div className="hub theme-dark">
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

        {home.newReleases.length > 0 && (
          <div className="pane">
            <div className="pane-head">new releases</div>
            <div className="hub-grid">
              {home.newReleases.map(a => (
                <div key={a.id} className="hub-card" onClick={() => onOpenAlbum(a)}>
                  <div className="hub-card-art">
                    {a.imageUrl ? <img src={a.imageUrl} alt="" /> : <div style={{ background: a.color, width: '100%', height: '100%' }} />}
                  </div>
                  <div className="hub-card-name">{a.title}</div>
                  <div className="hub-card-sub">{a.artist}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {home.recentTracks.length > 0 && (
          <div className="pane">
            <div className="pane-head">recently played</div>
            <div className="hub-menu">
              {home.recentTracks.slice(0, 8).map((t, i) => (
                <button
                  key={i}
                  className="hub-item"
                  style={{ fontSize: 22 }}
                  onClick={() => pb.play([t], 0)}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}

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
