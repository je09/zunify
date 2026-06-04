import { useRef } from 'react'
import { Icons } from '../components/icons'
import { PlaybackState } from '../hooks/usePlayback'
import { NowPlayingPane } from '../components/NowPlayingPane'
import { useHubData } from './useHubData'
import { openContextMenu } from '../components/ContextMenu'

const MENU: [string, number][] = [
  ['artists', 0], ['albums', 1], ['songs', 2], ['genres', 3], ['playlists', 4], ['radio', 5],
]

interface Props {
  pb: PlaybackState
  token: string | null
  onOpenCollection: (tab: number) => void
  onOpenNowPlaying: () => void
  onSearch: () => void
  onShuffle: () => void
  onChangeLooks: () => void
  onConnectSpotify: () => void
  spotify: boolean
}

export function Hub({ pb, token, onOpenCollection, onOpenNowPlaying, onSearch, onShuffle, onChangeLooks, onConnectSpotify, spotify }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const home = useHubData(token)

  const onScroll = () => {
    if (titleRef.current && stripRef.current) {
      titleRef.current.style.transform = `translateX(${-stripRef.current.scrollLeft * 0.45}px)`
    }
  }

  const openMore = (e: React.MouseEvent) => {
    openContextMenu({
      items: [
        { label: 'change looks', onClick: onChangeLooks },
        { label: spotify ? 'spotify connected' : 'connect to spotify', onClick: onConnectSpotify },
      ],
      origin: { x: e.clientX, y: e.clientY },
    })
  }

  return (
    <div className="hub">
      <div className="hub-bg" />
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
          <button className="ic-btn" aria-label="Search" onClick={onSearch}>
            {Icons.search}
          </button>
        </div>
        <button className="ellipsis" aria-label="More" onClick={openMore}><i /><i /><i /></button>
      </div>
    </div>
  )
}
