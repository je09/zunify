import { useEffect, useRef, useState } from 'react'
import { Album, albumQueue } from '../data'
import { useLibrary } from '../LibraryContext'
import {
  fetchAlbum as fetchFullAlbum,
  checkSavedAlbums, checkSavedTracks,
  saveAlbums, saveTracks,
  removeAlbums, removeTracks,
  fetchArtistAlbums,
} from '../spotifyApi'

export function useAlbumDetail(album: Album) {
  const { albums, likedTrackUris, setSavedAlbum } = useLibrary()
  const albumsRef = useRef(albums)
  const likedTrackUrisRef = useRef(likedTrackUris)
  const [fullAlbum, setFullAlbum] = useState<Album>(album)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => savedTrackIdsFromCache(album, likedTrackUris))
  const [albumSaved, setAlbumSaved] = useState(() => isAlbumSaved(album, albums))
  const [otherAlbums, setOtherAlbums] = useState<Album[]>([])
  const [loadingEnrich, setLoadingEnrich] = useState(false)

  albumsRef.current = albums
  likedTrackUrisRef.current = likedTrackUris

  useEffect(() => {
    setFullAlbum(album)
    setSavedIds(savedTrackIdsFromCache(album, likedTrackUrisRef.current))
    setAlbumSaved(isAlbumSaved(album, albumsRef.current))
    setOtherAlbums([])
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
    ]).then(async ([fetched, albumsPage]) => {
      if (cancelled) return
      const resolved = fetched ?? album
      if (fetched) setFullAlbum(fetched)
      setSavedIds(savedTrackIdsFromCache(resolved, likedTrackUrisRef.current))
      setAlbumSaved(isAlbumSaved(resolved, albumsRef.current))
      setOtherAlbums(albumsPage.items.filter(a => a.id !== resolved.id).slice(0, 6))

      const trackIds = (resolved.spotifyTrackUris ?? []).map(u => u.split(':')[2]).filter(Boolean)
      if (trackIds.length) {
        const saved = await checkSavedTracks(trackIds).catch(() => [] as boolean[])
        if (!cancelled) setSavedIds(new Set(trackIds.filter((_, i) => saved[i])))
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoadingEnrich(false)
    })

    return () => { cancelled = true }
  }, [album])

  useEffect(() => {
    if (isAlbumSaved(fullAlbum, albums)) setAlbumSaved(true)
  }, [albums, fullAlbum])

  const queue = albumQueue(fullAlbum)
  const contextUri = fullAlbum.spotifyTrackUris?.length ? `spotify:album:${fullAlbum.id}` : undefined

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

function savedTrackIdsFromCache(album: Album, likedTrackUris: Set<string>): Set<string> {
  return new Set((album.spotifyTrackUris ?? [])
    .filter(uri => likedTrackUris.has(uri))
    .map(uri => uri.split(':')[2])
    .filter(Boolean))
}

function isAlbumSaved(album: Album, albums: Album[]): boolean {
  return Boolean(album.id && albums.some(saved => saved.id === album.id))
}
