import { useEffect, useRef } from 'react'
import { Track, Playlist, playlistQueue, fmt } from '../data'
import { useSwipe, BottomBack } from '../components/Pivot'
import { useLibrary } from '../LibraryContext'

interface Props {
  playlist: Playlist
  onPlay: (queue: Track[], idx: number) => void
  onBack: () => void
}

export function PlaylistDetail({ playlist, onPlay, onBack }: Props) {
  const { playlists, loadingMore, loadMorePlaylistTracks } = useLibrary()
  const current = playlists.find(pl => pl.id === playlist.id) ?? playlist
  const queue = playlistQueue(current)
  const swipe = useSwipe(onBack, () => {})

  return (
    <div className="page">
      <div className="scroll" ref={swipe}>
        <div style={{ padding: '10px 26px 0' }}>
          <div className="screen-heading">{current.name}</div>
          <button className="al-playall" style={{ marginBottom: 8 }} onClick={() => onPlay(queue, 0)}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M7 5.5v13L19 12z" fill="currentColor" />
            </svg>
            <span>play all</span>
          </button>
        </div>
        <div className="track-list">
          {queue.map((track, i) => (
            <div key={i} className="al-track" onClick={() => onPlay(queue, i)}>
              <span className="al-tnum">{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="al-ttitle">{track.title}</div>
                <div className="al-tdur" style={{ fontSize: 14, marginTop: 2 }}>{track.artist}</div>
              </div>
              <span className="al-tdur">{fmt(track.dur)}</span>
            </div>
          ))}
          <LoadMoreTracks
            active={Boolean(current.trackNextUrl)}
            loading={Boolean(loadingMore.playlistTracks[current.id])}
            onLoadMore={() => loadMorePlaylistTracks(current.id)}
          />
        </div>
      </div>
      <BottomBack onBack={onBack} />
    </div>
  )
}

function LoadMoreTracks({ active, loading, onLoadMore }: { active: boolean; loading: boolean; onLoadMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!active || !el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !loading) onLoadMore()
    }, { rootMargin: '240px 0px' })

    observer.observe(el)
    return () => observer.disconnect()
  }, [active, loading, onLoadMore])

  return <div ref={ref} style={{ height: 80, color: '#888', padding: '16px 26px 0' }}>{loading ? 'loading more...' : ''}</div>
}
