import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  Album, Playlist, SongEntry,
  buildArtists, buildSongs,
  ALBUMS, ARTISTS, SONGS, PLAYLISTS,
} from './data'
import { fetchSavedAlbums, fetchLikedSongsPlaylist, fetchUserPlaylists } from './spotifyApi'

export interface Library {
  albums: Album[]
  artists: string[]
  songs: SongEntry[]
  playlists: Playlist[]
  loading: boolean
  error: string | null
  source: 'static' | 'spotify'
}

const DEFAULT: Library = {
  albums: ALBUMS,
  artists: ARTISTS,
  songs: SONGS,
  playlists: PLAYLISTS,
  loading: false,
  error: null,
  source: 'static',
}

// When Spotify auth exists but library hasn't loaded yet — show empty, not mockup
const EMPTY: Library = {
  albums: [],
  artists: [],
  songs: [],
  playlists: [],
  loading: true,
  error: null,
  source: 'spotify',
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

    setLib(EMPTY)

    Promise.all([
      fetchSavedAlbums(),
      fetchLikedSongsPlaylist(),
      fetchUserPlaylists(),
    ])
      .then(([albums, likedPlaylist, userPlaylists]) => {
        setLib({
          albums,
          artists: buildArtists(albums),
          songs: buildSongs(albums),
          playlists: [likedPlaylist, ...userPlaylists],
          loading: false,
          error: null,
          source: 'spotify',
        })
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setLib(prev => ({ ...prev, loading: false, error: msg }))
      })
  }, [token])

  return <LibraryContext.Provider value={lib}>{children}</LibraryContext.Provider>
}
