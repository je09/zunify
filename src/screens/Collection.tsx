import { useEffect, useMemo } from 'react'
import { Track, Album, Playlist } from '../data'
import { useLibrary } from '../LibraryContext'
import { Pivot, PivotArea, useSwipe, BottomBack } from '../components/Pivot'
import { AlbumsTab, ArtistsTab, PlaylistsTab, SongsTab, GenresTab, RadioTab, groupAlbumsByArtist, hasMore } from './collectionTabs'

const TABS = ['artists', 'albums', 'songs', 'genres', 'playlists', 'radio']

interface Props {
  tab: number
  onTabChange: (t: number) => void
  onOpenArtist: (name: string, artistId?: string) => void
  onOpenAlbum: (album: Album) => void
  onOpenPlaylist: (pl: Playlist) => void
  onPlay: (queue: Track[], idx: number, contextUri?: string) => void
  onBack: () => void
}

export function Collection({ tab, onTabChange, onOpenArtist, onOpenAlbum, onOpenPlaylist, onPlay, onBack }: Props) {
  const { albums, artists, songs, playlists, likedTrackUris, loading, loadingMore, error, totals, loadMore, artistIdByName } = useLibrary()
  const swipe = useSwipe(
    () => tab === 0 ? onBack() : onTabChange(tab - 1),
    () => onTabChange(Math.min(TABS.length - 1, tab + 1)),
  )
  const userPlaylistCount = playlists.filter(pl => pl.id !== 'sp_liked').length
  const likedTrackCount = playlists.find(pl => pl.id === 'sp_liked')?.tracks?.length ?? 0
  const albumsByArtist = useMemo(() => groupAlbumsByArtist(albums), [albums])

  useEffect(() => {
    if (loading) return
    if (tab === 1 && hasMore(albums.length, totals.albums) && !loadingMore.albums) loadMore('albums')
    if (tab === 0 && likedTrackCount < 50 && hasMore(likedTrackCount, totals.songs) && !loadingMore.tracks) loadMore('tracks')
    if (tab === 2 && likedTrackCount < 50 && hasMore(likedTrackCount, totals.songs) && !loadingMore.tracks) loadMore('tracks')
    if (tab === 4 && userPlaylistCount < 20 && hasMore(userPlaylistCount, totals.playlists) && !loadingMore.playlists) loadMore('playlists')
  }, [tab, albums.length, totals.albums, likedTrackCount, totals.songs, userPlaylistCount, totals.playlists, loading, loadingMore.albums, loadingMore.tracks, loadingMore.playlists, loadMore])

  if (loading) return <WP8Loading />
  if (error) return <WP8Error message={error} />

  return (
    <div className="page">
      <div className="page-toppad" />
      <Pivot tabs={TABS} active={tab} onChange={onTabChange} />
      <PivotArea tab={tab} ref={swipe}>
        <ArtistsTab artists={artists} albumsByArtist={albumsByArtist} artistIdByName={artistIdByName} hasMore={hasMore(albums.length, totals.albums)} loadingMore={loadingMore.albums} onLoadMore={() => loadMore('albums')} onOpenArtist={onOpenArtist} onPlay={onPlay} />
        <AlbumsTab albums={albums} total={totals.albums} loadingMore={loadingMore.albums} onLoadMore={() => loadMore('albums')} onOpenAlbum={onOpenAlbum} />
        <SongsTab songs={songs} likedTrackUris={likedTrackUris} hasMore={hasMore(likedTrackCount, totals.songs)} loadingMore={loadingMore.tracks} onLoadMore={() => loadMore('tracks')} onPlay={onPlay} />
        <GenresTab albums={albums} onPlay={onPlay} />
        <PlaylistsTab playlists={playlists} total={totals.playlists} loadingMore={loadingMore.playlists} onLoadMore={() => loadMore('playlists')} onOpenPlaylist={onOpenPlaylist} />
        <RadioTab artists={artists} albumsByArtist={albumsByArtist} onPlay={onPlay} />
      </PivotArea>
      <BottomBack onBack={onBack} />
    </div>
  )
}

function WP8Error({ message }: { message: string }) {
  return (
    <div className="wp8-loading">
      <div className="wp8-error-icon">!</div>
      <div className="wp8-error-title">something went wrong</div>
      <div className="wp8-error-msg">{message}</div>
    </div>
  )
}

function WP8Loading() {
  return (
    <div className="wp8-loading">
      <div className="wp8-dots">
        {[0, 1, 2, 3, 4].map(i => (
          <span key={i} className="wp8-dot" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <div className="wp8-label">zplayer</div>
    </div>
  )
}
