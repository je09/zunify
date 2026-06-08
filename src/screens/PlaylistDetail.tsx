import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Track, Playlist, playlistQueue, fmt } from '../data'
import { useSwipe, BottomBack } from '../components/Pivot'
import { useLibrary } from '../LibraryContext'
import { Icons } from '../components/icons'
import { TrackSkeletonRows } from './collectionTabs'
import { TRACK_BATCH_LIMIT } from '../features/spotify/shared'
import { fetchLikedTracksPageAt, fetchPlaylistTracksPageAt } from '../spotifyApi'

const PLAYLIST_ROW_HEIGHT = 73
const PLAYLIST_OVERSCAN = 8

interface Props {
  playlist: Playlist
  onPlay: (queue: Track[], idx: number, contextUri?: string) => void
  onBack: () => void
}

export function PlaylistDetail({ playlist, onPlay, onBack }: Props) {
  const { playlists, savedTrackUris, checkSavedTrackUris, setSavedTrack } = useLibrary()
  const current = playlists.find(pl => pl.id === playlist.id) ?? playlist
  const swipe = useSwipe(onBack, () => {})
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const loadingPagesRef = useRef<Set<number>>(new Set())
  const loadedPagesRef = useRef<Set<number>>(new Set())
  const failedPagesRef = useRef<Set<number>>(new Set())
  const [tracks, setTracks] = useState<(Track | undefined)[]>([])
  const [totalTracks, setTotalTracks] = useState(current.totalTracks ?? current.tracks?.length ?? 0)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })

  const loadedQueue = useMemo(() => tracks.filter((track): track is Track => Boolean(track)), [tracks])
  const loadedUrisKey = useMemo(() => loadedQueue.map(t => t.spotifyUri).filter(Boolean).join('\u0000'), [loadedQueue])
  const [failedPages, setFailedPages] = useState<Set<number>>(new Set())
  const isSpotifyPlaylist = current.id !== 'sp_liked'
  const contextUri = isSpotifyPlaylist ? `spotify:playlist:${current.id}` : undefined
  const setScrollEl = useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el
    swipe(el)
  }, [swipe])

  useEffect(() => {
    loadingPagesRef.current = new Set()
    loadedPagesRef.current = new Set()
    failedPagesRef.current = new Set()
    setFailedPages(new Set())
    const seeded = playlistQueue(current)
    for (let index = 0; index < seeded.length; index += TRACK_BATCH_LIMIT) {
      loadedPagesRef.current.add(index / TRACK_BATCH_LIMIT)
    }
    const total = current.totalTracks ?? seeded.length
    setTotalTracks(total)
    setTracks(() => {
      const next = Array<Track | undefined>(total)
      seeded.forEach((track, index) => { next[index] = track })
      return next
    })
    setViewport({ top: 0, height: scrollRef.current?.clientHeight ?? 0 })
    scrollRef.current?.scrollTo({ top: 0 })
  }, [current.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadPage = useCallback((pageIndex: number, force = false) => {
    if (pageIndex < 0 || loadedPagesRef.current.has(pageIndex) || loadingPagesRef.current.has(pageIndex)) return
    if (!force && failedPagesRef.current.has(pageIndex)) return
    const offset = pageIndex * TRACK_BATCH_LIMIT
    if (totalTracks > 0 && offset >= totalTracks) return

    loadingPagesRef.current.add(pageIndex)
    setFailedPages(prev => {
      if (!prev.has(pageIndex)) return prev
      const next = new Set(prev)
      next.delete(pageIndex)
      failedPagesRef.current = next
      return next
    })
    const request = current.id === 'sp_liked'
      ? fetchLikedTracksPageAt(offset)
      : fetchPlaylistTracksPageAt(current.id, offset)

    request.then(page => {
      loadedPagesRef.current.add(pageIndex)
      setTotalTracks(prev => page.total ?? prev)
      setTracks(prev => {
        const size = Math.max(page.total ?? prev.length, offset + page.items.length, prev.length)
        const next = prev.length === size ? [...prev] : Array<Track | undefined>(size)
        prev.forEach((track, index) => { next[index] = track })
        page.items.forEach((track, index) => { next[offset + index] = track })
        return next
      })
    }).catch(() => {
      setFailedPages(prev => {
        const next = new Set(prev).add(pageIndex)
        failedPagesRef.current = next
        return next
      })
    }).finally(() => {
      loadingPagesRef.current.delete(pageIndex)
    })
  }, [current.id, totalTracks])

  const range = useMemo(() => {
    const start = Math.max(0, Math.floor(viewport.top / PLAYLIST_ROW_HEIGHT) - PLAYLIST_OVERSCAN)
    const visible = Math.ceil((viewport.height || 1) / PLAYLIST_ROW_HEIGHT) + PLAYLIST_OVERSCAN * 2
    const end = Math.min(totalTracks, start + visible)
    return { start, end }
  }, [totalTracks, viewport])

  useEffect(() => {
    if (!totalTracks && current.trackNextUrl) {
      loadPage(0)
      return
    }
    if (!totalTracks) return
    const firstPage = Math.floor(range.start / TRACK_BATCH_LIMIT)
    const lastPage = Math.floor(Math.max(range.end - 1, range.start) / TRACK_BATCH_LIMIT)
    for (let page = firstPage; page <= lastPage; page += 1) loadPage(page)
  }, [current.trackNextUrl, loadPage, range.end, range.start, totalTracks])

  useEffect(() => {
    checkSavedTrackUris(loadedQueue.map(t => t.spotifyUri).filter((uri): uri is string => Boolean(uri)))
  }, [loadedUrisKey, loadedQueue, checkSavedTrackUris])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setViewport({ top: el.scrollTop, height: el.clientHeight })
  }, [])

  const playTrack = (track: Track) => {
    if (contextUri) onPlay([track], 0, contextUri)
    else onPlay(loadedQueue, Math.max(0, loadedQueue.findIndex(item => item.spotifyUri === track.spotifyUri || item === track)))
  }

  const visibleRows = []
  for (let index = range.start; index < range.end; index += 1) {
    const track = tracks[index]
    const failedPage = failedPages.has(Math.floor(index / TRACK_BATCH_LIMIT))
    visibleRows.push(
      <div key={index} className="playlist-virtual-row" style={{ transform: `translateY(${index * PLAYLIST_ROW_HEIGHT}px)` }}>
        {track ? (
          <PlaylistTrackRow
            track={track}
            isSaved={Boolean(track.spotifyUri && savedTrackUris.has(track.spotifyUri))}
            onPlay={() => playTrack(track)}
            onToggleSaved={() => { if (track.spotifyUri) void setSavedTrack(track.spotifyUri, !savedTrackUris.has(track.spotifyUri)).catch(() => {}) }}
          />
        ) : failedPage ? <VirtualLoadError onRetry={() => loadPage(Math.floor(index / TRACK_BATCH_LIMIT), true)} /> : <TrackSkeletonRows count={1} detail />}
      </div>,
    )
  }

  return (
    <div className="page">
      <div className="scroll" ref={setScrollEl} onScroll={handleScroll}>
        <div style={{ padding: '10px 26px 0' }}>
          <div className="screen-heading">{current.name}</div>
          <button className="al-playall" style={{ marginBottom: 8 }} onClick={() => loadedQueue[0] && playTrack(loadedQueue[0])}>
            {Icons.play}
            <span>play all</span>
          </button>
        </div>
        <div className="track-list playlist-virtual" style={{ height: totalTracks * PLAYLIST_ROW_HEIGHT }}>
          {visibleRows}
        </div>

        <div style={{ height: 80 }} />
      </div>
      <BottomBack onBack={onBack} />
    </div>
  )
}

function VirtualLoadError({ onRetry }: { onRetry: () => void }) {
  return <button className="virtual-load-error" onClick={onRetry}>couldn't load · tap to retry</button>
}

function PlaylistTrackRow({ track, isSaved, onPlay, onToggleSaved }: {
  track: Track; isSaved: boolean; onPlay: () => void; onToggleSaved: () => void
}) {
  return (
    <div className="al-track playlist-track-row" onClick={onPlay}>
      <div className="al-track-main">
        <div className="al-ttitle">{track.title}</div>
        <div className="al-track-sub">{track.artist}</div>
      </div>
      <div className="al-track-actions">
        {track.spotifyUri && (
          <button
            className={'iconbtn ' + (isSaved ? 'on' : 'outline')}
            style={{ width: 28, height: 28 }}
            onClick={(e) => { e.stopPropagation(); onToggleSaved() }}
            aria-label={isSaved ? 'Unlike' : 'Like'}
          >
            {Icons.heart}
          </button>
        )}
        <span className="al-tdur">{fmt(track.dur)}</span>
      </div>
    </div>
  )
}
