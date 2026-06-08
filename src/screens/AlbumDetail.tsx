import { Track, Album, fmt } from '../data'
import { Pivot, PivotArea, Overline, Thumb, useSwipe, BottomBack } from '../components/Pivot'
import { Icons } from '../components/icons'
import { useAlbumDetail } from './useAlbumDetail'
import { TrackSkeletonRows } from './collectionTabs'

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
  const { fullAlbum, savedIds, albumSaved, otherAlbums, loadingEnrich, queue, contextUri, toggleSave, toggleAlbumSave } = useAlbumDetail(album)

  const swipe = useSwipe(
    () => tab === 0 ? onBack() : onTabChange(0),
    () => onTabChange(1),
  )

  return (
    <div className="page">
      <Overline>{fullAlbum.artist}</Overline>
      <Pivot tabs={['songs', 'review']} active={tab} onChange={onTabChange} />
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
              <div className="al-actions">
                <button className="al-playall" onClick={() => onPlay(queue, 0, contextUri)}>
                  {Icons.play}
                  <span>play</span>
                </button>
                <button
                  className={'al-playall ' + (albumSaved ? 'saved' : '')}
                  onClick={toggleAlbumSave}
                  aria-label={albumSaved ? 'Unsave album' : 'Save album'}
                >
                  {Icons.heart}
                  <span>{albumSaved ? 'saved' : 'save'}</span>
                </button>
              </div>
            </div>
          </div>

          {fullAlbum.tracks.length === 0 && loadingEnrich ? (
            <div className="track-list"><TrackSkeletonRows count={12} /></div>
          ) : (
            <div className="track-list">
              {fullAlbum.tracks.map(([title, dur], i) => {
                const uri = fullAlbum.spotifyTrackUris?.[i]
                const id = uri?.split(':')[2] ?? ''
                const isSaved = savedIds.has(id)
                return (
                  <div key={title + i} className="al-track" onClick={() => onPlay(queue, i, contextUri)}>
                    <span className="al-tnum"></span>
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
              {otherAlbums.map(a => (
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
          <div style={{ height: 80 }} />
        </div>

      </PivotArea>
      <BottomBack onBack={onBack} />
    </div>
  )
}
