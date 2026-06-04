import { Album, ArtistSummary, Playlist, Track, buildSongs, artistIdByName as buildArtistIdMap } from '../../data'
import { LibraryState, LibraryTotals } from './libraryTypes'

export function likedSongsPlaylist(tracks: Track[], total?: number | null): Playlist {
  return {
    id: 'sp_liked', name: 'liked songs', items: [],
    imageUrl: tracks[0]?.imageUrl,
    tracks, totalTracks: total ?? tracks.length,
    trackNextUrl: '/me/tracks?limit=50',
  }
}

export function buildLibrary(
  albums: Album[],
  playlists: Playlist[],
  totals: LibraryTotals,
  userId: string | null,
  followedArtists: ArtistSummary[] = [],
): LibraryState {
  const likedPlaylist = playlists.find(pl => pl.id === 'sp_liked')
  const liked = likedPlaylist?.tracks ?? []
  const likedTrackUris = new Set(liked.map(t => t.spotifyUri).filter((u): u is string => !!u))

  const songsAlbums = mergeAlbums(albums, albumsFromLiked(liked))
  const idMap = buildArtistIdMap(albums)
  followedArtists.forEach(a => { if (!idMap.has(a.name)) idMap.set(a.name, a.id) })

  const allArtistNames = [...new Set(followedArtists.map(a => a.name))].sort((x, y) =>
    x.replace(/^the\s+/i, '').localeCompare(y.replace(/^the\s+/i, ''), 'en', { sensitivity: 'base' })
  )

  return {
    albums,
    followedArtists,
    artists: allArtistNames,
    songs: buildSongs(songsAlbums),
    playlists,
    likedTrackUris,
    artistIdByName: idMap,
    userId,
    loading: false,
    loadingMore: { albums: false, playlists: false, tracks: false, playlistTracks: {} },
    error: null,
    totals,
  }
}

function albumsFromLiked(tracks: Track[]): Album[] {
  const map = new Map<string, Album>()
  tracks.forEach(t => {
    const key = `${t.artist}:${t.album}`
    const existing = map.get(key)
    if (existing) {
      existing.tracks.push([t.title, t.dur])
      existing.spotifyTrackUris?.push(t.spotifyUri ?? '')
      existing.spotifyTrackPreviews?.push(t.previewUrl)
    } else {
      map.set(key, {
        id: key, artist: t.artist, artistId: t.artistId, title: t.album,
        year: 0, color: t.color, imageUrl: t.imageUrl,
        tracks: [[t.title, t.dur]],
        spotifyTrackUris: [t.spotifyUri ?? ''],
        spotifyTrackPreviews: [t.previewUrl],
      })
    }
  })
  return [...map.values()]
}

export function mergeAlbums(existing: Album[], incoming: Album[]): Album[] {
  const seen = new Set(existing.map(a => a.id))
  const seenNames = new Set(existing.map(albumIdentity))
  return [...existing, ...incoming.filter(a => {
    const identity = albumIdentity(a)
    if (seen.has(a.id) || seenNames.has(identity)) return false
    seen.add(a.id)
    seenNames.add(identity)
    return true
  })]
}

function albumIdentity(album: Album): string {
  return `${album.artist.trim().toLowerCase()}\u0000${album.title.trim().toLowerCase()}`
}

export function mergePlaylists(existing: Playlist[], incoming: Playlist[]): Playlist[] {
  const seen = new Set(existing.map(p => p.id))
  return [...existing, ...incoming.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true })]
}

export function mergeTracks(existing: Track[], incoming: Track[]): Track[] {
  const seen = new Set(existing.map(t => t.spotifyUri ?? `${t.artist}:${t.title}`))
  return [...existing, ...incoming.filter(t => {
    const k = t.spotifyUri ?? `${t.artist}:${t.title}`
    if (seen.has(k)) return false; seen.add(k); return true
  })]
}
