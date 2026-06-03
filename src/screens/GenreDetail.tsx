import { Track, GENRE_ARTISTS, artistQueue } from '../data'
import { useLibrary } from '../LibraryContext'
import { Section, useSwipe, BottomBack } from '../components/Pivot'
import { Icons } from '../components/icons'

interface Props {
  genre: string
  onOpenArtist: (name: string) => void
  onPlay: (queue: Track[], idx: number) => void
  onBack: () => void
}

export function GenreDetail({ genre, onOpenArtist, onPlay, onBack }: Props) {
  const { albums } = useLibrary()
  const artists = GENRE_ARTISTS[genre] ?? []
  const swipe = useSwipe(onBack, () => {})

  return (
    <div className="page">
      <div className="scroll" ref={swipe}>
        <div className="llist">
          <div className="screen-heading">{genre}</div>
          <Section>artists</Section>
          {artists.map((name) => (
            <div key={name} className="lrow">
              <button
                className="play-circle"
                aria-label={`Play ${name}`}
                onClick={(e) => { e.stopPropagation(); onPlay(artistQueue(name, albums), 0) }}
              >
                {Icons.playCircle}
              </button>
              <div className="lrow-name" onClick={() => onOpenArtist(name)}>{name}</div>
            </div>
          ))}
          <div style={{ height: 80 }} />
        </div>
      </div>
      <BottomBack onBack={onBack} />
    </div>
  )
}
