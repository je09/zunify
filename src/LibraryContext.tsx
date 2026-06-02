import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  Album, ALBUMS, ARTISTS, SONGS, SongEntry,
  buildArtists, buildSongs,
} from './data'
import { fetchSavedAlbums } from './spotifyApi'

export interface Library {
  albums: Album[]
  artists: string[]
  songs: SongEntry[]
  loading: boolean
  source: 'static' | 'spotify'
}

const DEFAULT: Library = {
  albums: ALBUMS,
  artists: ARTISTS,
  songs: SONGS,
  loading: false,
  source: 'static',
}

const LibraryContext = createContext<Library>(DEFAULT)

export function useLibrary(): Library {
  return useContext(LibraryContext)
}

interface Props { token: string | null; children: ReactNode }

export function LibraryProvider({ token, children }: Props) {
  const [lib, setLib] = useState<Library>(DEFAULT)

  useEffect(() => {
    if (!token) {
      setLib(DEFAULT)
      return
    }
    setLib(prev => ({ ...prev, loading: true }))
    fetchSavedAlbums()
      .then(albums => {
        setLib({
          albums,
          artists: buildArtists(albums),
          songs: buildSongs(albums),
          loading: false,
          source: 'spotify',
        })
      })
      .catch(() => {
        setLib({ ...DEFAULT, loading: false })
      })
  }, [token])

  return <LibraryContext.Provider value={lib}>{children}</LibraryContext.Provider>
}
