import { useState, useEffect, useMemo } from 'react'
import { Track, Album, ArtistSummary, fmt } from '../data'
import { fetchArtist, fetchArtistTopTracks, fetchArtistAlbums } from '../spotifyApi'
import { Pivot, PivotArea, Overline, Thumb, useSwipe, BottomBack, WP8Spinner } from '../components/Pivot'
import { Icons } from '../components/icons'
import { useLibrary } from '../LibraryContext'

interface Props {
  name: string
  artistId: string | undefined
  tab: number
  onTabChange: (t: number) => void
  onOpenAlbum: (album: Album) => void
  onPlay: (queue: Track[], idx: number, contextUri?: string) => void
  onBack: () => void
}

interface ArtistState {
  artist: ArtistSummary | null
  topTracks: Track[]
  albums: Album[]
  singles: Album[]
  loading: boolean
}

export function ArtistCard({ name, artistId, tab, onTabChange, onOpenAlbum, onPlay, onBack }: Props) {
  const { savedTrackUris, checkSavedTrackUris } = useLibrary()
  const [state, setState] = useState<ArtistState>({
    artist: null, topTracks: [], albums: [], singles: [],
    loading: Boolean(artistId),
  })

  useEffect(() => {
    setState({
      artist: null, topTracks: [], albums: [], singles: [],
      loading: Boolean(artistId),
    })
    if (!artistId) return
    let cancelled = false

    // Wave 1: artist info + top tracks + albums + singles in parallel
    Promise.all([
      fetchArtist(artistId),
      fetchArtistTopTracks(artistId),
      fetchArtistAlbums(artistId, { limit: 10, include_groups: 'album' }),
      fetchArtistAlbums(artistId, { limit: 10, include_groups: 'single' }),
    ]).then(([artist, topTracks, albumsPage, singlesPage]) => {
      if (cancelled) return
      setState({
        artist, topTracks,
        albums: albumsPage.items, singles: singlesPage.items,
        loading: false,
      })
    }).catch(() => {
      if (!cancelled) setState(prev => ({ ...prev, loading: false }))
    })

    return () => { cancelled = true }
  }, [artistId])

  const { artist, topTracks, albums, singles, loading } = state
  const topTrackUris = useMemo(
    () => topTracks.map(t => t.spotifyUri).filter((uri): uri is string => Boolean(uri)),
    [topTracks]
  )
  const topTrackUriKey = topTrackUris.join('\u0000')

  useEffect(() => {
    checkSavedTrackUris(topTrackUris)
  }, [topTrackUriKey, topTrackUris, checkSavedTrackUris])

  const bgImage = artist?.imageUrl
  const displayName = artist?.name ?? name
  const contextUri = artistId ? `spotify:artist:${artistId}` : undefined

  const swipe = useSwipe(
    () => tab === 0 ? onBack() : onTabChange(0),
    () => onTabChange(1),
  )

return (
    <div className="page artist-card">
      <div
        className="card-bg"
        style={bgImage
          ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center top' }
          : {}
        }
      />
      <div className="card-scrim" />
      <div className="card-body">
        <Overline>{displayName}</Overline>
        {contextUri && topTracks.length > 0 && (
          <div className="artist-actions">
            <button
              className="al-playall"
              onClick={() => onPlay(topTracks, 0)}
              aria-label={`Play ${displayName}`}
            >
              {Icons.play}
              <span>play</span>
            </button>
          </div>
        )}

        <Pivot tabs={['albums', 'songs']} active={tab} onChange={onTabChange} />
        <PivotArea tab={tab} ref={swipe}>

          {/* albums */}
          <div style={{ padding: '0 26px' }}>
            {loading ? (
              <WP8Spinner />
            ) : (
              <>
                {albums.length > 0 && (
                  <>
                    <div className="section" style={{ paddingTop: 16 }}>in collection</div>
                    {albums.map(a => (
                      <div key={a.id} className="card-album" onClick={() => onOpenAlbum(a)}>
                        <Thumb color={a.color} size={104} imageUrl={a.imageUrl} />
                        <div className="card-album-meta">
                          <div className="ca-title">{a.title}</div>
                          <div className="ca-sub">{a.artist}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {singles.length > 0 && (
                  <>
                    <div className="section">singles</div>
                    {singles.map(a => (
                      <div key={a.id} className="card-album" onClick={() => onOpenAlbum(a)}>
                        <Thumb color={a.color} size={104} imageUrl={a.imageUrl} />
                        <div className="card-album-meta">
                          <div className="ca-title">{a.title}</div>
                          <div className="ca-sub">{a.artist}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
            <div style={{ height: 80 }} />
          </div>

          {/* top songs */}
          <div>
            {loading ? (
              <WP8Spinner />
            ) : topTracks.map((t, i) => (
              <div key={t.spotifyUri ?? i} className="lrow" style={{ padding: '8px 26px' }}>
                <button
                  className="play-circle"
                  aria-label={`Play ${t.title}`}
                  onClick={(e) => { e.stopPropagation(); onPlay(topTracks, i) }}
                >
                  {Icons.playCircle}
                </button>
                <div className="lrow-name song" onClick={() => onPlay(topTracks, i)}>
                  <div className="lrow-title">{t.title}</div>
                  <div className="lrow-sub">{fmt(t.dur)}</div>
                </div>
                {t.spotifyUri && savedTrackUris.has(t.spotifyUri) && (
                  <div className="liked-dot" title="liked">{Icons.heart}</div>
                )}
              </div>
            ))}
            <div style={{ height: 80 }} />
          </div>

        </PivotArea>
      </div>
      <BottomBack onBack={onBack} />
    </div>
  )
}
