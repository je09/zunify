import { useEffect, useRef, useState } from 'react'
import { Album, Track, fmt } from '../data'
import { fetchSearch, SearchResults } from '../features/spotify/searchBrowseApi'
import { Pivot, PivotArea, Thumb, useSwipe, BottomBack } from '../components/Pivot'
import { Icons } from '../components/icons'

const TABS = ['songs', 'albums', 'artists']

interface Props {
  onBack: () => void
  onOpenAlbum: (album: Album) => void
  onOpenArtist: (name: string, artistId?: string) => void
  onPlayTrack: (track: Track) => void
}

export function Search({ onBack, onOpenAlbum, onOpenArtist, onPlayTrack }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [tab, setTab] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef(0)

  const swipe = useSwipe(
    () => tab === 0 ? onBack() : setTab(t => t - 1),
    () => setTab(t => Math.min(TABS.length - 1, t + 1)),
  )

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const q = query.trim()
    const request = ++requestRef.current
    if (!q) { setResults(null); return }
    timerRef.current = setTimeout(() => {
      fetchSearch(q, 20).then(nextResults => {
        if (request === requestRef.current) setResults(nextResults)
      }).catch(() => {})
    }, 350)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  return (
    <div className="page">
      <div className="page-toppad" />
      <div className="search-field-wrap">
        <input
          ref={inputRef}
          className="search-field"
          type="search"
          placeholder="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <Pivot tabs={TABS} active={tab} onChange={setTab} />
      <PivotArea tab={tab} ref={swipe}>

        {/* songs */}
        <div className="song-list">
          {results?.tracks.map((t, i) => (
            <div key={t.spotifyUri ?? i} className="lrow">
              <button
                className="play-circle"
                aria-label={`Play ${t.title}`}
                onClick={() => onPlayTrack(t)}
              >
                {Icons.playCircle}
              </button>
              <div className="lrow-name song" onClick={() => onPlayTrack(t)}>
                <div className="lrow-title">{t.title}</div>
                <div className="lrow-sub">{t.artist} · {fmt(t.dur)}</div>
              </div>
            </div>
          ))}
          <div style={{ height: 80 }} />
        </div>

        {/* albums */}
        <div style={{ padding: '6px 26px 80px' }}>
          <div className="card-albums-grid">
            {results?.albums.map(a => (
              <div key={a.id} className="card-album-cell" onClick={() => onOpenAlbum(a)}>
                <Thumb color={a.color} imageUrl={a.imageUrl} />
                <div className="ca-title">{a.title}</div>
                <div className="ca-sub">{a.artist}</div>
              </div>
            ))}
          </div>
        </div>

        {/* artists */}
        <div className="llist">
          {results?.artists.map(a => (
            <div key={a.id} className="lrow" onClick={() => onOpenArtist(a.name, a.id)}>
              <div className="lrow-name">{a.name}</div>
            </div>
          ))}
          <div style={{ height: 80 }} />
        </div>

      </PivotArea>
      <BottomBack onBack={onBack} />
    </div>
  )
}
