import { useEffect, useMemo, useRef, useState } from 'react'
import { Album, albumQueue } from '../data'
import { useLibrary } from '../LibraryContext'
import {
  fetchAlbum as fetchFullAlbum,
  checkSavedAlbums,
  saveAlbums,
  removeAlbums,
  fetchArtistAlbums,
} from '../spotifyApi'

export function useAlbumDetail(album: Album) {
  const { albums, savedTrackUris, checkSavedTrackUris, setSavedTrack, setSavedAlbum } = useLibrary()
  const albumsRef = useRef(albums)
  const [fullAlbum, setFullAlbum] = useState<Album>(album)
  const [albumSaved, setAlbumSaved] = useState(() => isAlbumSaved(album, albums))
  const [otherAlbums, setOtherAlbums] = useState<Album[]>([])
  const [loadingEnrich, setLoadingEnrich] = useState(false)

  albumsRef.current = albums

  const savedIds = useMemo(
    () => savedTrackIdsFromUris(fullAlbum.spotifyTrackUris ?? [], savedTrackUris),
    [fullAlbum.spotifyTrackUris, savedTrackUris]
  )

  useEffect(() => {
    setFullAlbum(album)
    setAlbumSaved(isAlbumSaved(album, albumsRef.current))
    setOtherAlbums([])
    checkSavedTrackUris(album.spotifyTrackUris ?? [])
    if (!album.id || album.id.length < 5) return

    let cancelled = false
    setLoadingEnrich(true)
    const needFullFetch = album.tracks.length === 0

    checkSavedAlbums([album.id])
      .then(([savedAlbum]) => { if (!cancelled) setAlbumSaved(Boolean(savedAlbum)) })
      .catch(() => {})

    Promise.all([
      needFullFetch ? fetchFullAlbum(album.id) : Promise.resolve(null),
      album.artistId
        ? fetchArtistAlbums(album.artistId, { limit: 10 })
        : Promise.resolve({ items: [] as Album[], next: null, total: null }),
    ]).then(([fetched, albumsPage]) => {
      if (cancelled) return
      const resolved = fetched ?? album
      if (fetched) setFullAlbum(fetched)
      setAlbumSaved(isAlbumSaved(resolved, albumsRef.current))
      setOtherAlbums(albumsPage.items.filter(a => a.id !== resolved.id).slice(0, 6))
      checkSavedTrackUris(resolved.spotifyTrackUris ?? [])
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoadingEnrich(false)
    })

    return () => { cancelled = true }
  }, [album, checkSavedTrackUris])

  useEffect(() => {
    if (isAlbumSaved(fullAlbum, albums)) setAlbumSaved(true)
  }, [albums, fullAlbum])

  const queue = albumQueue(fullAlbum)
  const contextUri = fullAlbum.spotifyTrackUris?.length ? `spotify:album:${fullAlbum.id}` : undefined

  const toggleSave = (trackIdx: number) => {
    const uri = fullAlbum.spotifyTrackUris?.[trackIdx]
    if (!uri) return
    void setSavedTrack(uri, !savedTrackUris.has(uri)).catch(() => {})
  }

  const toggleAlbumSave = () => {
    if (!fullAlbum.id) return
    const next = !albumSaved
    setAlbumSaved(next)
    setSavedAlbum(fullAlbum, next)
    ;(next ? saveAlbums([fullAlbum.id]) : removeAlbums([fullAlbum.id]))
      .catch(() => {
        setAlbumSaved(!next)
        setSavedAlbum(fullAlbum, !next)
      })
  }

  return { fullAlbum, savedIds, albumSaved, otherAlbums, loadingEnrich, queue, contextUri, toggleSave, toggleAlbumSave }
}

function savedTrackIdsFromUris(uris: string[], savedTrackUris: Set<string>): Set<string> {
  return new Set(uris
    .filter(uri => savedTrackUris.has(uri))
    .map(uri => uri.split(':')[2])
    .filter(Boolean))
}

function isAlbumSaved(album: Album, albums: Album[]): boolean {
  return Boolean(album.id && albums.some(saved => saved.id === album.id))
}
