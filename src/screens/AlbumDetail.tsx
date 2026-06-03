import { useState, useEffect } from 'react'
import { Track, Album, albumQueue, fmt } from '../data'
import {
  fetchAlbum as fetchFullAlbum, checkSavedTracks, saveTracks, removeTracks,
  checkFollowingArtists, followArtists, unfollowArtists, fetchArtistAlbums,
} from '../spotifyApi'
import { Pivot, PivotArea, Thumb, useSwipe, BottomBack } from '../components/Pivot'
import { Icons } from '../components/icons'

interface Props {
  album: Album
  tab: number
  onTabChange: (t: number) => void
  onOpenAlbum: (album: Album) => void
  onOpenArtist: (name: string, artistId?: string) => void
  onPlay: (queue: Track[], idx: number, contextUri?: string) => void
  onBack: () => void
}

export function AlbumDetail({ album, tab, onTabChange, onOpenAlbum, onOpenArtist, onPlay, onBack }: Props) {
  const [fullAlbum, setFullAlbum] = useState<Album>(album)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [artistFollowing, setArtistFollowing] = useState(false)
  const [otherAlbums, setOtherAlbums] = useState<Album[]>([])
  const [loadingEnrich, setLoadingEnrich] = useState(false)

  const contextUri = fullAlbum.spotifyTrackUris?.length ? `spotify:album:${fullAlbum.id}` : undefined

  useEffect(() => {
    // Reset when album changes
    setFullAlbum(album)
    setSavedIds(new Set())
    setArtistFollowing(false)
    setOtherAlbums([])
    if (!album.id || album.id.length < 5) return

    let cancelled = false
    setLoadingEnrich(true)

    const needFullFetch = album.tracks.length === 0

    // Wave 1: full album (if needed) + following state + other albums
    Promise.all([
      needFullFetch ? fetchFullAlbum(album.id) : Promise.resolve(null),
      album.artistId ? checkFollowingArtists([album.artistId]) : Promise.resolve([false]),
      album.artistId
        ? fetchArtistAlbums(album.artistId, { limit: 10 })
        : Promise.resolve({ items: [] as Album[], next: null, total: null }),
    ]).then(async ([fetched, [following], albumsPage]) => {
      if (cancelled) return
      const resolved = fetched ?? album
      if (fetched) setFullAlbum(fetched)
      setArtistFollowing(!!following)
      setOtherAlbums(albumsPage.items.filter(a => a.id !== resolved.id).slice(0, 6))

      // Wave 2: check saved state for tracks
      const trackIds = (resolved.spotifyTrackUris ?? []).map(u => u.split(':')[2]).filter(Boolean)
      if (trackIds.length) {
        const saved = await checkSavedTracks(trackIds).catch(() => [] as boolean[])
        if (!cancelled) {
          setSavedIds(new Set(trackIds.filter((_, i) => saved[i])))
        }
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoadingEnrich(false)
    })

    return () => { cancelled = true }
  }, [album.id])

  const queue = albumQueue(fullAlbum)

  const toggleSave = (trackIdx: number) => {
    const uri = fullAlbum.spotifyTrackUris?.[trackIdx]
    if (!uri) return
    const id = uri.split(':')[2]
    const isSaved = savedIds.has(id)
    const next = new Set(savedIds)
    if (isSaved) { next.delete(id); removeTracks([id]).catch(() => setSavedIds(savedIds)) }
    else { next.add(id); saveTracks([id]).catch(() => setSavedIds(savedIds)) }
    setSavedIds(next)
  }

  const toggleFollowArtist = () => {
    if (!album.artistId) return
    const next = !artistFollowing
    setArtistFollowing(next)
    const op = next ? followArtists([album.artistId]) : unfollowArtists([album.artistId])
    op.catch(() => setArtistFollowing(!next))
  }

  const swipe = useSwipe(
    () => tab === 0 ? onBack() : onTabChange(0),
    () => onTabChange(1),
  )

  return (
    <div className="page">
      <Pivot tabs={['songs', 'about']} active={tab} onChange={onTabChange} />
      <PivotArea tab={tab} ref={swipe}>

        {/* songs */}
        <div>
          <div className="al-head">
            <Thumb color={fullAlbum.color} size={132} imageUrl={fullAlbum.imageUrl} />
            <div className="al-head-meta">
              <div className="al-head-title">{fullAlbum.title}</div>
              <div
                className="al-head-sub"
                style={{ cursor: fullAlbum.artistId ? 'pointer' : 'default' }}
                onClick={() => onOpenArtist(fullAlbum.artist, fullAlbum.artistId)}
              >
                {fullAlbum.artist}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
                <button className="al-playall" onClick={() => onPlay(queue, 0, contextUri)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path d="M7 5.5v13L19 12z" fill="currentColor" />
                  </svg>
                  <span>play</span>
                </button>
                {album.artistId && (
                  <button
                    className={'artist-follow-btn' + (artistFollowing ? ' following' : '')}
                    style={{ fontSize: 13, padding: '5px 12px' }}
                    onClick={toggleFollowArtist}
                  >
                    {artistFollowing ? 'following' : 'follow'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {fullAlbum.tracks.length === 0 && loadingEnrich ? (
            <div style={{ color: 'var(--dim)', padding: '20px 26px' }}>loading tracks...</div>
          ) : (
            <div className="track-list">
              {fullAlbum.tracks.map(([title, dur], i) => {
                const uri = fullAlbum.spotifyTrackUris?.[i]
                const id = uri?.split(':')[2] ?? ''
                const isSaved = savedIds.has(id)
                return (
                  <div key={title + i} className="al-track" onClick={() => onPlay(queue, i, contextUri)}>
                    <span className="al-tnum">{i + 1}</span>
                    <span className="al-ttitle">{title}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {uri && (
                        <button
                          className={'iconbtn ' + (isSaved ? 'on' : 'outline')}
                          style={{ width: 28, height: 28 }}
                          onClick={(e) => { e.stopPropagation(); toggleSave(i) }}
                          aria-label={isSaved ? 'Unlike' : 'Like'}
                        >
                          {Icons.heart}
                        </button>
                      )}
                      <span className="al-tdur">{fmt(dur)}</span>
                    </div>
                  </div>
                )
              })}
              <div style={{ height: 80 }} />
            </div>
          )}
        </div>

        {/* about */}
        <div style={{ padding: '16px 26px' }}>
          <Thumb color={fullAlbum.color} size={132} imageUrl={fullAlbum.imageUrl} />
          <p style={{ marginTop: 16, fontSize: 18, fontWeight: 300, color: 'var(--fg)', lineHeight: 1.5 }}>
            <span
              style={{ cursor: fullAlbum.artistId ? 'pointer' : 'default', color: 'var(--accent)' }}
              onClick={() => onOpenArtist(fullAlbum.artist, fullAlbum.artistId)}
            >
              {fullAlbum.artist}
            </span>
            {' — '}<em>{fullAlbum.title}</em>
            {fullAlbum.year > 0 && ` (${fullAlbum.year})`}.
            {' '}{fullAlbum.tracks.length} tracks.
          </p>

          {otherAlbums.length > 0 && (
            <>
              <div className="section">more by {fullAlbum.artist}</div>
              <div className="card-albums-grid">
                {otherAlbums.map(a => (
                  <div key={a.id} className="card-album-cell" onClick={() => onOpenAlbum(a)}>
                    <Thumb color={a.color} imageUrl={a.imageUrl} />
                    <div className="ca-title">{a.title}</div>
                    <div className="ca-sub">{a.year || ''}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ height: 80 }} />
        </div>

      </PivotArea>
      <BottomBack onBack={onBack} />
    </div>
  )
}
