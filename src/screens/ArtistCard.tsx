import { useState, useEffect } from 'react'
import { Track, Album, fmt } from '../data'
import { SpotifyArtist, fetchArtist, checkFollowingArtists, followArtists, unfollowArtists, fetchArtistTopTracks, fetchArtistAlbums, checkSavedTracks } from '../spotifyApi'
import { Pivot, PivotArea, Thumb, useSwipe, BottomBack } from '../components/Pivot'
import { Icons } from '../components/icons'

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
  artist: SpotifyArtist | null
  topTracks: Track[]
  albums: Album[]
  singles: Album[]
  savedTrackIds: Set<string>
  following: boolean
  loading: boolean
}

export function ArtistCard({ name, artistId, tab, onTabChange, onOpenAlbum, onPlay, onBack }: Props) {
  const [state, setState] = useState<ArtistState>({
    artist: null, topTracks: [], albums: [], singles: [],
    savedTrackIds: new Set(), following: false, loading: Boolean(artistId),
  })

  useEffect(() => {
    if (!artistId) return
    let cancelled = false

    setState(prev => ({ ...prev, loading: true }))

    // Wave 1: artist info + following + top tracks + albums + singles in parallel
    Promise.all([
      fetchArtist(artistId),
      checkFollowingArtists([artistId]),
      fetchArtistTopTracks(artistId),
      fetchArtistAlbums(artistId, { limit: 10, include_groups: 'album' }),
      fetchArtistAlbums(artistId, { limit: 10, include_groups: 'single' }),
    ]).then(async ([artist, [following], topTracks, albumsPage, singlesPage]) => {
      if (cancelled) return

      // Wave 2: check saved state for top tracks
      const trackIds = topTracks.map(t => t.spotifyUri?.split(':')[2]).filter(Boolean) as string[]
      const saved = trackIds.length ? await checkSavedTracks(trackIds).catch(() => [] as boolean[]) : []
      const savedTrackIds = new Set(trackIds.filter((_, i) => saved[i]))

      if (cancelled) return
      setState({
        artist, following: !!following, topTracks,
        albums: albumsPage.items, singles: singlesPage.items,
        savedTrackIds, loading: false,
      })
    }).catch(() => {
      if (!cancelled) setState(prev => ({ ...prev, loading: false }))
    })

    return () => { cancelled = true }
  }, [artistId])

  const { artist, topTracks, albums, singles, savedTrackIds, following, loading } = state

  const bgImage = artist?.images?.[0]?.url
  const displayName = artist?.name ?? name
  const contextUri = artistId ? `spotify:artist:${artistId}` : undefined

  const swipe = useSwipe(
    () => tab === 0 ? onBack() : onTabChange(0),
    () => onTabChange(1),
  )

  const toggleFollow = () => {
    if (!artistId) return
    const next = !following
    setState(prev => ({ ...prev, following: next }))
    const op = next ? followArtists([artistId]) : unfollowArtists([artistId])
    op.catch(() => setState(prev => ({ ...prev, following: !next })))
  }

  return (
    <div className="page artist-card">
      <div
        className="card-bg"
        style={bgImage
          ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center top' }
          : { background: 'linear-gradient(160deg, #1a1a2e 0%, #0f3460 100%)' }
        }
      />
      <div className="card-scrim" />
      <div className="card-body">
        <div className="artist-heading">{displayName}</div>
        {artist && (
          <div className="artist-meta">
            {artist.followers.total > 0 && (
              <span className="artist-followers">{artist.followers.total.toLocaleString()} followers</span>
            )}
            {artist.genres.length > 0 && (
              <span className="artist-genres">{artist.genres.slice(0, 2).join(', ')}</span>
            )}
          </div>
        )}
        <div className="artist-actions">
          <button
            className={'artist-follow-btn' + (following ? ' following' : '')}
            onClick={toggleFollow}
            aria-label={following ? 'Unfollow' : 'Follow'}
          >
            {following ? 'following' : 'follow'}
          </button>
          {contextUri && (
            <button
              className="al-playall"
              onClick={() => onPlay(topTracks, 0, contextUri)}
              aria-label={`Play ${displayName}`}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M7 5.5v13L19 12z" fill="currentColor" />
              </svg>
              <span>play</span>
            </button>
          )}
        </div>

        <Pivot tabs={['albums', 'songs']} active={tab} onChange={onTabChange} />
        <PivotArea tab={tab} ref={swipe}>

          {/* albums */}
          <div style={{ padding: '0 26px' }}>
            {loading ? (
              <div style={{ color: 'var(--dim)', paddingTop: 20 }}>loading...</div>
            ) : (
              <>
                {albums.length > 0 && (
                  <>
                    <div className="section" style={{ paddingTop: 16 }}>albums</div>
                    <div className="card-albums-grid">
                      {albums.map(a => (
                        <div key={a.id} className="card-album-cell" onClick={() => onOpenAlbum(a)}>
                          <Thumb color={a.color} imageUrl={a.imageUrl} />
                          <div className="ca-title">{a.title}</div>
                          <div className="ca-sub">{a.year || ''}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {singles.length > 0 && (
                  <>
                    <div className="section">singles</div>
                    <div className="card-albums-grid">
                      {singles.map(a => (
                        <div key={a.id} className="card-album-cell" onClick={() => onOpenAlbum(a)}>
                          <Thumb color={a.color} imageUrl={a.imageUrl} />
                          <div className="ca-title">{a.title}</div>
                          <div className="ca-sub">{a.year || ''}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            <div style={{ height: 80 }} />
          </div>

          {/* top songs */}
          <div>
            {loading ? (
              <div style={{ color: 'var(--dim)', padding: '20px 26px' }}>loading...</div>
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
                {t.spotifyUri && savedTrackIds.has(t.spotifyUri.split(':')[2]) && (
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
