// ---------------------------------------------------------------------------
// Data types designed to map cleanly to Spotify API fields.
// When integrating Spotify:
//   Track.previewUrl  → SpotifyTrack.preview_url
//   Track.dur         ← SpotifyTrack.duration_ms / 1000
//   Album.imageUrl    → SpotifyAlbum.images[0].url  (replaces color swatch)
//   Album.color       → dominant color extracted from imageUrl (or keep swatch)
//   Artist.imageUrl   → SpotifyArtist.images[0].url (hub/artist-card backgrounds)
// ---------------------------------------------------------------------------

export interface Track {
  title: string
  dur: number          // seconds
  artist: string
  album: string
  color: string        // placeholder until real artwork available
  previewUrl?: string  // Spotify preview_url (30-second MP3)
}

export interface Album {
  id: string
  artist: string
  title: string
  year: number
  color: string        // placeholder swatch
  imageUrl?: string    // real artwork URL (Spotify)
  tracks: [string, number][]
}

export interface Playlist {
  id: string
  name: string
  items: { a: string; i: number }[]
}

export const ALBUMS: Album[] = [
  {
    id: 'reflektor', artist: 'Arcade Fire', title: 'Reflektor', year: 2013, color: '#b0392f',
    tracks: [['Reflektor',454],['We Exist',345],['Flashbulb Eyes',139],['Here Comes the Night Time',391],['Normal Person',260],['Afterlife',238]],
  },
  {
    id: 'harvest', artist: 'Boards of Canada', title: "Tomorrow's Harvest", year: 2013, color: '#6d7b53',
    tracks: [['Reach for the Dead',287],['White Cyclosa',195],['Jacquard Causeway',394],['Cold Earth',230],['Palace Posy',243],['Nothing Is Real',217]],
  },
  {
    id: 'bones', artist: 'CHVRCHES', title: 'The Bones of What You Believe', year: 2013, color: '#7a3fb0',
    tracks: [['The Mother We Share',191],['We Sink',213],['Gun',218],['Tether',302],['Lies',233],['Recover',217]],
  },
  {
    id: 'blonde', artist: 'Cœur de pirate', title: 'Blonde (Bonus Track Version)', year: 2011, color: '#c8771a',
    tracks: [['Adieu',147],['Golden Baby',182],['Danse et danse',169],['Saint-Laurent',201],['Place de la République',178],['Cap Diamant',163]],
  },
  {
    id: 'ram', artist: 'Daft Punk', title: 'Random Access Memories', year: 2013, color: '#2f6fb0',
    tracks: [['Give Life Back to Music',274],['The Game of Love',322],['Giorgio by Moroder',544],['Within',228],['Instant Crush',337],['Get Lucky',368]],
  },
  {
    id: 'heroine', artist: 'Lorde', title: 'Pure Heroine', year: 2013, color: '#3a8f6b',
    tracks: [['Tennis Court',200],['400 Lux',234],['Royals',190],['Ribs',259],['Buzzcut Season',248],['Team',193]],
  },
  {
    id: 'hurryup', artist: 'M83', title: "Hurry Up, We're Dreaming", year: 2011, color: '#c43b6b',
    tracks: [['Intro',307],['Midnight City',244],['Reunion',281],['Wait',240],['Steve McQueen',238],['Splendor',294]],
  },
  {
    id: 'lonerism', artist: 'Tame Impala', title: 'Lonerism', year: 2012, color: '#cf8a1e',
    tracks: [['Be Above It',234],['Endors Toi',193],['Apocalypse Dreams',350],['Mind Mischief',274],['Feels Like We Only Go Backwards',193],['Elephant',211]],
  },
  {
    id: 'coexist', artist: 'The xx', title: 'Coexist', year: 2012, color: '#46506b',
    tracks: [['Angels',172],['Chained',223],['Fiction',257],['Try',233],['Reunion',240],['Sunset',247]],
  },
]

export const GENRES = ['Alternative', 'Ambient', 'Electronic', 'Indie', 'Pop', 'Rock', 'Synth-pop', 'Trip-hop']

export const GENRE_ARTISTS: Record<string, string[]> = {
  'Alternative': ['Arcade Fire', 'CHVRCHES', 'Cœur de pirate', 'Lorde', 'The xx'],
  'Ambient':     ['Boards of Canada'],
  'Electronic':  ['Boards of Canada', 'CHVRCHES', 'Daft Punk', 'M83', 'The xx'],
  'Indie':       ['Arcade Fire', 'CHVRCHES', 'Lorde', 'M83', 'Tame Impala', 'The xx'],
  'Pop':         ['Cœur de pirate', 'Daft Punk', 'Lorde'],
  'Rock':        ['Tame Impala'],
  'Synth-pop':   ['CHVRCHES', 'M83'],
  'Trip-hop':    ['Boards of Canada'],
}

export const PLAYLISTS: Playlist[] = [
  { id: 'latenight', name: 'late night',  items: [{a:'blonde',i:0},{a:'heroine',i:3},{a:'bones',i:3},{a:'ram',i:3},{a:'coexist',i:0}] },
  { id: 'run',       name: 'run',         items: [{a:'ram',i:5},{a:'reflektor',i:0},{a:'bones',i:0},{a:'hurryup',i:1},{a:'lonerism',i:3}] },
  { id: 'focus',     name: 'focus flow',  items: [{a:'harvest',i:0},{a:'bones',i:4},{a:'blonde',i:5},{a:'coexist',i:2}] },
  { id: 'faves',     name: 'favourites',  items: [{a:'heroine',i:2},{a:'ram',i:5},{a:'reflektor',i:0},{a:'hurryup',i:1},{a:'lonerism',i:4},{a:'heroine',i:5}] },
]

export const ARTISTS: string[] = [...new Set(ALBUMS.map((a) => a.artist))].sort(
  (x, y) => x.replace(/^the\s+/i, '').localeCompare(y.replace(/^the\s+/i, ''), 'en', { sensitivity: 'base' })
)

export const SONGS: { title: string; dur: number; artist: string; album: Album; idx: number }[] = []
ALBUMS.forEach((a) =>
  a.tracks.forEach(([title, dur], i) => SONGS.push({ title, dur, artist: a.artist, album: a, idx: i }))
)
SONGS.sort((x, y) => x.title.localeCompare(y.title, 'en', { sensitivity: 'base' }))

export function albumQueue(a: Album): Track[] {
  return a.tracks.map(([title, dur]) => ({ title, dur, artist: a.artist, album: a.title, color: a.color }))
}

export function artistAlbums(name: string): Album[] {
  return ALBUMS.filter((a) => a.artist === name)
}

export function artistQueue(name: string): Track[] {
  return artistAlbums(name).flatMap(albumQueue)
}

export function resolvePlaylistTrack(it: { a: string; i: number }): Track {
  const a = ALBUMS.find((x) => x.id === it.a)!
  const [title, dur] = a.tracks[it.i]
  return { title, dur, artist: a.artist, album: a.title, color: a.color }
}

export function playlistQueue(pl: Playlist): Track[] {
  return pl.items.map(resolvePlaylistTrack)
}

export function fmt(s: number): string {
  const n = Math.max(0, Math.floor(s))
  return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0')
}
