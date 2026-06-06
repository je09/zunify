import { useState, useEffect, useRef } from 'react'
import { Track, Playlist, playlistQueue, fmt } from '../data'
import { checkSavedTracks, saveTracks, removeTracks } from '../spotifyApi'
import { useSwipe, BottomBack, WP8Spinner } from '../components/Pivot'
import { useLibrary } from '../LibraryContext'
import { Icons } from '../components/icons'

interface Props {
  playlist: Playlist
  onPlay: (queue: Track[], idx: number, contextUri?: string) => void
  onBack: () => void
}

export function PlaylistDetail({ playlist, onPlay, onBack }: Props) {
  const { playlists, loadingMore, likedTrackUris, loadMorePlaylistTracks } = useLibrary()
  const current = playlists.find(pl => pl.id === playlist.id) ?? playlist
  const queue = playlistQueue(current)
  const queueIds = queue.map(t => t.spotifyUri ?? `${t.artist}:${t.title}`).join('\u0000')
  const swipe = useSwipe(onBack, () => {})

  const isSpotifyPlaylist = current.id !== 'sp_liked' && queue.some(t => t.spotifyUri)
  const contextUri = isSpotifyPlaylist ? `spotify:playlist:${current.id}` : undefined
  const [savedIds, setSavedIds] = useState<Set<string>>(() => savedTrackIdsFromCache(queue, likedTrackUris))

  useEffect(() => {
    if (queue.length || !current.trackNextUrl || loadingMore.playlistTracks[current.id]) return
    loadMorePlaylistTracks(current.id)
  }, [current.id, current.trackNextUrl, queue.length, loadingMore.playlistTracks, loadMorePlaylistTracks])

  useEffect(() => {
    if (!queue.length) { setSavedIds(new Set()); return }
    setSavedIds(savedTrackIdsFromCache(queue, likedTrackUris))
    const ids = queue.map(t => t.spotifyUri?.split(':')[2]).filter(Boolean) as string[]
    if (!ids.length) { setSavedIds(new Set()); return }

    let cancelled = false
    checkSavedTracks(ids)
      .then(saved => { if (!cancelled) setSavedIds(new Set(ids.filter((_, i) => saved[i]))) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [queueIds, queue, likedTrackUris])

  return (
    <div className="page">
      <div className="scroll" ref={swipe}>
        <div style={{ padding: '10px 26px 0' }}>
          <div className="screen-heading">{current.name}</div>
          <button className="al-playall" style={{ marginBottom: 8 }} onClick={() => onPlay(queue, 0, contextUri)}>
            {Icons.play}
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

        <div style={{ height: 80 }} />
      </div>
      <BottomBack onBack={onBack} />
    </div>
  )
}

function savedTrackIdsFromCache(queue: Track[], likedTrackUris: Set<string>): Set<string> {
  return new Set(queue
    .map(t => t.spotifyUri)
    .filter((uri): uri is string => Boolean(uri && likedTrackUris.has(uri)))
    .map(uri => uri.split(':')[2])
    .filter(Boolean))
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
  return <div ref={ref} style={{ minHeight: 80 }}>{loading ? <WP8Spinner /> : null}</div>
}
