import { useState } from 'react'
import { PlaybackState } from '../hooks/usePlayback'
import { fmt } from '../data'
import { Icons } from './icons'
import { ProgressBar } from './Pivot'

interface Props {
  pb: PlaybackState
  onOpen: () => void
}

export function NowPlayingPane({ pb, onOpen }: Props) {
  const { track, playing, time, duration, shuffle, repeat, toggle, next, prev, seek, toggleShuffle, cycleRepeat } = pb
  const [previewTime, setPreviewTime] = useState<number | null>(null)
  const displayTime = previewTime ?? time
  const pct = duration > 0 ? Math.min(100, (displayTime / duration) * 100) : 0

  return (
    <div className="nowpane">
      <div className="pane-head">now playing</div>

      <div className="artrow">
        <div className="art" style={{ background: track.color }} onClick={onOpen} role="button" aria-label="Open now playing">
          {track.imageUrl && <img src={track.imageUrl} alt="" />}
        </div>
        <div className="sideicons">
          <button className={'iconbtn ' + (shuffle ? 'on' : '')} onClick={toggleShuffle} aria-label="Shuffle">
            {Icons.shuffle}
          </button>
          <button className={'iconbtn ' + (repeat === 0 ? '' : 'on')} onClick={cycleRepeat} aria-label="Repeat">
            {repeat === 2 ? Icons.repeat1 : Icons.repeat}
          </button>
          <button className="iconbtn" onClick={onOpen} aria-label="Queue">{Icons.queue}</button>
        </div>
      </div>

      <ProgressBar
        pct={pct}
        onSeek={f => { setPreviewTime(null); seek(f) }}
        onPreviewSeek={f => setPreviewTime(f * duration)}
        onPreviewEnd={() => setPreviewTime(null)}
      />
      <div className="times">
        <span className="elapsed">{fmt(displayTime)}</span>
        <span className="remain">-{fmt(duration - displayTime)}</span>
      </div>

      <div className="track" onClick={onOpen}>
        <div className="title">{track.title}</div>
        <div className="by">by {track.artist}</div>
      </div>

      <div className="transport sm">
        <button className="tbtn" onClick={prev} aria-label="Previous">{Icons.prev}</button>
        <button className="tbtn mid" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? Icons.pause : Icons.play}
        </button>
        <button className="tbtn" onClick={next} aria-label="Next">{Icons.next}</button>
      </div>
    </div>
  )
}
