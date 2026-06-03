import { useState, useEffect, useRef } from 'react'
import { Track, Playlist, playlistQueue, fmt } from '../data'
import { checkSavedTracks, fetchRecommendations, saveTracks, removeTracks } from '../spotifyApi'
import { useSwipe, BottomBack } from '../components/Pivot'
import { useLibrary } from '../LibraryContext'
import { Icons } from '../components/icons'

interface Props {
  playlist: Playlist
  onPlay: (queue: Track[], idx: number, contextUri?: string) => void
  onBack: () => void
}

export function PlaylistDetail({ playlist, onPlay, onBack }: Props) {
  const { playlists, loadingMore, loadMorePlaylistTracks, userId } = useLibrary()
  const current = playlists.find(pl => pl.id === playlist.id) ?? playlist
  const queue = playlistQueue(current)
  const swipe = useSwipe(onBack, () => {})

  const isSpotifyPlaylist = current.id !== 'sp_liked' && queue.some(t => t.spotifyUri)
  const contextUri = isSpotifyPlaylist ? `spotify:playlist:${current.id}` : undefined
  const isOwnPlaylist = userId != null && current.id !== 'sp_liked'

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [recommendations, setRecommendations] = useState<Track[]>([])

  useEffect(() => {
    if (!queue.length) return
    const ids = queue.map(t => t.spotifyUri?.split(':')[2]).filter(Boolean) as string[]
    if (!ids.length) return

    checkSavedTracks(ids)
      .then(saved => setSavedIds(new Set(ids.filter((_, i) => saved[i]))))
      .catch(() => {})

    if (isOwnPlaylist) {
      const seedTracks = ids.slice(0, 5).join(',')
      const seedArtists = [...new Set(queue.slice(0, 5).map(t => t.artistId).filter(Boolean))].slice(0, 2).join(',')
      fetchRecommendations({ seed_tracks: seedTracks || undefined, seed_artists: seedArtists || undefined, limit: 10 })
        .then(setRecommendations)
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist.id, queue.length])

  return (
    <div className="page">
      <div className="scroll" ref={swipe}>
        <div style={{ padding: '10px 26px 0' }}>
          <div className="screen-heading">{current.name}</div>
          <button className="al-playall" style={{ marginBottom: 8 }} onClick={() => onPlay(queue, 0, contextUri)}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M7 5.5v13L19 12z" fill="currentColor" />
            </svg>
            <span>play all</span>
          </button>
        </div>
        <div className="track-list">
          {queue.map((track, i) => {
            const id = track.spotifyUri?.split(':')[2] ?? ''
            const isSaved = savedIds.has(id)
            return (
              <div key={i} className="al-track" onClick={() => onPlay(queue, i, contextUri)}>
                <span className="al-tnum">{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="al-ttitle">{track.title}</div>
                  <div className="al-tdur" style={{ fontSize: 14, marginTop: 2 }}>{track.artist}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {track.spotifyUri && (
                    <button
                      className={'iconbtn ' + (isSaved ? 'on' : 'outline')}
                      style={{ width: 28, height: 28 }}
                      onClick={(e) => { e.stopPropagation(); toggleSave(isSaved, id, savedIds, setSavedIds) }}
                      aria-label={isSaved ? 'Unlike' : 'Like'}
                    >
                      {Icons.heart}
                    </button>
                  )}
                  <span className="al-tdur">{fmt(track.dur)}</span>
                </div>
              </div>
            )
          })}
          <LoadMoreTracks
            active={Boolean(current.trackNextUrl)}
            loading={Boolean(loadingMore.playlistTracks[current.id])}
            onLoadMore={() => loadMorePlaylistTracks(current.id)}
          />
        </div>

        {recommendations.length > 0 && (
          <div style={{ padding: '0 26px' }}>
            <div className="section">recommended</div>
            {recommendations.map((track, i) => (
              <div key={track.spotifyUri ?? i} className="lrow">
                <button
                  className="play-circle"
                  aria-label={`Play ${track.title}`}
                  onClick={(e) => { e.stopPropagation(); onPlay([track], 0) }}
                >
                  {Icons.playCircle}
                </button>
                <div className="lrow-name song">
                  <div className="lrow-title">{track.title}</div>
                  <div className="lrow-sub">{track.artist}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ height: 80 }} />
      </div>
      <BottomBack onBack={onBack} />
    </div>
  )
}

function toggleSave(
  isSaved: boolean,
  id: string,
  savedIds: Set<string>,
  setSavedIds: (s: Set<string>) => void,
) {
  if (!id) return
  const next = new Set(savedIds)
  if (isSaved) { next.delete(id); removeTracks([id]).catch(() => setSavedIds(savedIds)) }
  else { next.add(id); saveTracks([id]).catch(() => setSavedIds(savedIds)) }
  setSavedIds(next)
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
