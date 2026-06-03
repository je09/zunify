import { useEffect, useState } from 'react'
import { Album, albumQueue } from '../data'
import { fetchAlbum as fetchFullAlbum, checkSavedTracks, saveTracks, removeTracks, fetchArtistAlbums } from '../spotifyApi'

export function useAlbumDetail(album: Album) {
  const [fullAlbum, setFullAlbum] = useState<Album>(album)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [otherAlbums, setOtherAlbums] = useState<Album[]>([])
  const [loadingEnrich, setLoadingEnrich] = useState(false)

  useEffect(() => {
    setFullAlbum(album)
    setSavedIds(new Set())
    setOtherAlbums([])
    if (!album.id || album.id.length < 5) return

    let cancelled = false
    setLoadingEnrich(true)
    const needFullFetch = album.tracks.length === 0

    Promise.all([
      needFullFetch ? fetchFullAlbum(album.id) : Promise.resolve(null),
      album.artistId
        ? fetchArtistAlbums(album.artistId, { limit: 10 })
        : Promise.resolve({ items: [] as Album[], next: null, total: null }),
    ]).then(async ([fetched, albumsPage]) => {
      if (cancelled) return
      const resolved = fetched ?? album
      if (fetched) setFullAlbum(fetched)
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

  return { fullAlbum, savedIds, otherAlbums, loadingEnrich, queue, contextUri, toggleSave }
}
