import { PlaybackState } from '../hooks/usePlayback'
import { fmt } from '../data'
import { Icons } from '../components/icons'
import { ProgressBar, useSwipe } from '../components/Pivot'
import { useLibrary } from '../LibraryContext'

interface Props {
  pb: PlaybackState
  onBack: () => void
}

export function Player({ pb, onBack }: Props) {
  const { track, upNext, playing, time, fav, shuffle, repeat,
          prevDisabled, nextDisabled,
          toggle, next, prev, seek, toggleFav, toggleShuffle, cycleRepeat } = pb
  const { likedTrackUris } = useLibrary()

  if (!track) return null

  const pct = track.dur > 0 ? Math.min(100, (time / track.dur) * 100) : 0
  const repeatState = repeat === 0 ? 'outline' : 'on'
  const isLiked = fav || Boolean(track.spotifyUri && likedTrackUris.has(track.spotifyUri))
  const swipe = useSwipe(onBack, () => {})

  return (
    <div className="np" ref={swipe}>

      <div className="np-body">
        <div className="meta swap" key={'m' + track.title}>
          <div className="np-artist">{track.artist}</div>
          <div className="np-album">{track.album}</div>
        </div>

        <div className="artrow">
          <div className="art swap" key={'a' + track.title} style={{ background: track.color }}>
            {track.imageUrl && <img src={track.imageUrl} alt="" decoding="async" />}
          </div>
          <div className="sideicons">
            <button className={'iconbtn ' + (isLiked ? 'on' : 'outline')} onClick={toggleFav} aria-label="Favourite">
              {Icons.heart}
            </button>
            <button className={'iconbtn ' + (shuffle ? 'on' : '')} onClick={toggleShuffle} aria-label="Shuffle">
              {Icons.shuffle}
            </button>
            <button className={'iconbtn ' + repeatState} onClick={cycleRepeat} aria-label="Repeat">
              {repeat === 2 ? Icons.repeat1 : Icons.repeat}
            </button>
          </div>
        </div>

        <ProgressBar pct={pct} onSeek={seek} />
        <div className="times">
          <span className="elapsed">{fmt(time)}</span>
          <span className="remain">{track.dur > 0 ? `-${fmt(track.dur - time)}` : ''}</span>
        </div>

        <div className="np-track swap" key={'t' + track.title}>
          <div className="title">{track.title}</div>
          {upNext.length > 0 && (
            <div className="upnext">
              {upNext.map((t, i) => <div key={i}>{t.title}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className="transport">
        <button
          className={'tbtn' + (prevDisabled ? ' tbtn-disabled' : '')}
          onClick={prevDisabled ? undefined : prev}
          aria-label="Previous"
          aria-disabled={prevDisabled}
        >
          {Icons.prev}
        </button>
        <button className="tbtn mid" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? Icons.pause : Icons.play}
        </button>
        <button
          className={'tbtn' + (nextDisabled ? ' tbtn-disabled' : '')}
          onClick={nextDisabled ? undefined : next}
          aria-label="Next"
          aria-disabled={nextDisabled}
        >
          {Icons.next}
        </button>
      </div>

      <div className="appbar">
        <button className="iconbtn appback" onClick={onBack} aria-label="Back">{Icons.back}</button>
        <button className="ellipsis" aria-label="More options">
          <i /><i /><i />
        </button>
      </div>
    </div>
  )
}
