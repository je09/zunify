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
  title: string;
  dur: number; // seconds
  artist: string;
  album: string;
  color: string;
  imageUrl?: string;
  previewUrl?: string;
  spotifyUri?: string; // spotify:track:xxx — enables Web Playback SDK engine
}

export interface Album {
  id: string;
  artist: string;
  title: string;
  year: number;
  color: string;
  imageUrl?: string;
  tracks: [string, number][];
  spotifyTrackUris?: string[];           // parallel to tracks[]
  spotifyTrackPreviews?: (string | undefined)[]; // parallel to tracks[]
}

export type SongEntry = { title: string; dur: number; artist: string; album: Album; idx: number }

export interface Playlist {
  id: string;
  name: string;
  items: { a: string; i: number }[];
  imageUrl?: string;
  tracks?: Track[]; // pre-resolved (Spotify playlists skip items[])
  totalTracks?: number;
  trackNextUrl?: string | null;
}

export const ALBUMS: Album[] = [
  {
    id: "reflektor",
    artist: "Arcade Fire",
    title: "Reflektor",
    year: 2013,
    color: "#b0392f",
    imageUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/6c/06/f1/6c06f1d9-68f5-d0ec-80ee-bdf8892d1711/886447460344.jpg/600x600bb.jpg",
    tracks: [
      ["Reflektor", 454],
      ["We Exist", 345],
      ["Flashbulb Eyes", 139],
      ["Here Comes the Night Time", 391],
      ["Normal Person", 260],
      ["Afterlife", 238],
    ],
  },
  {
    id: "harvest",
    artist: "Boards of Canada",
    title: "Tomorrow's Harvest",
    year: 2013,
    color: "#6d7b53",
    imageUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b3/1d/6a/b31d6afa-6344-719c-216b-972998d199c9/WARPLP257-Cover-1400px.jpg/600x600bb.jpg",
    tracks: [
      ["Reach for the Dead", 287],
      ["White Cyclosa", 195],
      ["Jacquard Causeway", 394],
      ["Cold Earth", 230],
      ["Palace Posy", 243],
      ["Nothing Is Real", 217],
    ],
  },
  {
    id: "bones",
    artist: "CHVRCHES",
    title: "The Bones of What You Believe",
    year: 2013,
    color: "#7a3fb0",
    imageUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/9d/54/1d/9d541d38-f94d-636c-4a54-8b8b0f075e87/The_Bones_Of_What_You_Believe_Deluxe_Edition.jpg/600x600bb.jpg",
    tracks: [
      ["The Mother We Share", 191],
      ["We Sink", 213],
      ["Gun", 218],
      ["Tether", 302],
      ["Lies", 233],
      ["Recover", 217],
    ],
  },
  {
    id: "blonde",
    artist: "Cœur de pirate",
    title: "Blonde (Bonus Track Version)",
    year: 2011,
    color: "#c8771a",
    imageUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/fa/4c/23/fa4c2389-7c08-932f-85f7-7e3b55900fdf/cover.jpg/600x600bb.jpg",
    tracks: [
      ["Adieu", 147],
      ["Golden Baby", 182],
      ["Danse et danse", 169],
      ["Saint-Laurent", 201],
      ["Place de la République", 178],
      ["Cap Diamant", 163],
    ],
  },
  {
    id: "ram",
    artist: "Daft Punk",
    title: "Random Access Memories",
    year: 2013,
    color: "#2f6fb0",
    imageUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
    tracks: [
      ["Give Life Back to Music", 274],
      ["The Game of Love", 322],
      ["Giorgio by Moroder", 544],
      ["Within", 228],
      ["Instant Crush", 337],
      ["Get Lucky", 368],
    ],
  },
  {
    id: "heroine",
    artist: "Lorde",
    title: "Pure Heroine",
    year: 2013,
    color: "#3a8f6b",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/f/fe/Lorde_Pure_Heroine.png",
    tracks: [
      ["Tennis Court", 200],
      ["400 Lux", 234],
      ["Royals", 190],
      ["Ribs", 259],
      ["Buzzcut Season", 248],
      ["Team", 193],
    ],
  },
  {
    id: "hurryup",
    artist: "M83",
    title: "Hurry Up, We're Dreaming",
    year: 2011,
    color: "#c43b6b",
    imageUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/cb/7b/a9/cb7ba903-b5f1-cc21-90db-7a81b7aa0997/724596951057.jpg/600x600bb.jpg",
    tracks: [
      ["Intro", 307],
      ["Midnight City", 244],
      ["Reunion", 281],
      ["Wait", 240],
      ["Steve McQueen", 238],
      ["Splendor", 294],
    ],
  },
  {
    id: "lonerism",
    artist: "Tame Impala",
    title: "Lonerism",
    year: 2012,
    color: "#cf8a1e",
    imageUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b7/40/9b/b7409bc6-24fa-b956-5613-4be8dc62be06/12UMGIM64219.rgb.jpg/600x600bb.jpg",
    tracks: [
      ["Be Above It", 234],
      ["Endors Toi", 193],
      ["Apocalypse Dreams", 350],
      ["Mind Mischief", 274],
      ["Feels Like We Only Go Backwards", 193],
      ["Elephant", 211],
    ],
  },
  {
    id: "coexist",
    artist: "The xx",
    title: "Coexist",
    year: 2012,
    color: "#46506b",
    imageUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/00/b1/93/00b1932f-067d-7946-ee6a-9f176268669e/889030031976.png/600x600bb.jpg",
    tracks: [
      ["Angels", 172],
      ["Chained", 223],
      ["Fiction", 257],
      ["Try", 233],
      ["Reunion", 240],
      ["Sunset", 247],
    ],
  },
  {
    id: "the-medicine",
    artist: "The Jazz June",
    title: "The Medicine",
    year: 2001,
    color: "#8f5a28",
    imageUrl: "https://f4.bcbits.com/img/a2221960564_10.jpg",
    tracks: [
      ["Viva la Speed Metal", 0],
      ["The Scars to Prove It", 0],
      ["Excerpt", 0],
      ["The Phone Works Both Ways", 0],
      ["The Medicine", 0],
      ["At the Artist's Leisure Pt. 2", 0],
      ["Motorhead's Roadie", 0],
      ["Death from Above", 0],
      ["Fight Like Sinatra", 0],
      ["Get on the Bus", 0],
      ["Balance", 0],
    ],
  },
  {
    id: "please-be-nice",
    artist: "Camping in Alaska",
    title: "please be nice",
    year: 2013,
    color: "#d9915f",
    imageUrl: "https://f4.bcbits.com/img/a2575982068_10.jpg",
    tracks: [
      ["insight", 121],
      ["why can't i be snowing?", 320],
      ['there\'s no "brian" in team', 236],
      ["justin farmer", 282],
      ["i just want to kickflip into the sunset and disappear", 224],
      ["c u in da ballpit", 303],
      ["dragon ball z budokai tenkaichi 4", 196],
    ],
  },
  {
    id: "clear-your-mind",
    artist: "Bop",
    title: "Clear Your Mind",
    year: 2009,
    color: "#446e8f",
    imageUrl: "https://f4.bcbits.com/img/a3377395067_10.jpg",
    tracks: [
      ["Tears Of A Lonely Metaphysician", 320],
      ["Enjoy The Moment", 329],
      ["Ataraxia", 295],
      ["Forms, Ideas and Chips", 295],
      ["Lost In This World", 362],
      ["Clear Your Mind", 308],
      ["Nothing Makes Any Sense", 331],
      ["Zokoulki Soznaniya", 390],
      ["Random Thoughts", 389],
      ["I Found You", 384],
      ["Rovor", 315],
      ["Chaosmos", 393],
      ["Song About My Dog", 336],
    ],
  },
  {
    id: "posledniy-albom",
    artist: "Noize MC",
    title: "Последний альбом",
    year: 2010,
    color: "#3e3e3e",
    imageUrl: "https://upload.wikimedia.org/wikipedia/ru/e/eb/NMC_PA_cover.jpg",
    tracks: [
      ["Тыщатыщ", 211],
      ["Устрой дестрой", 239],
      ["Испортить вам пати!", 235],
      ["Манки бизнес", 238],
      ["Бабки в шапку!", 216],
      ["Артист", 186],
      ["Певец и актриса", 263],
      ["Бэктон#1", 215],
      ["Ты не считаешь", 275],
      ["Красный октябрь", 231],
      ["Пустые места", 257],
      ["Ругань из-за стены", 224],
      ["Антенны", 233],
      ["Why the Dollar Falls", 214],
      ["Денежный дождь", 215],
      ["Гимн понаехавших провинциалов", 211],
      ["Мизантроп-рэп", 176],
      ["Жечь электричество!", 268],
      ["На Марсе классно", 254],
      ["Вот и всё. Ну и что?", 177],
      ["Мерседес S666", 130],
    ],
  },
];

export const GENRES = [
  "Alternative",
  "Ambient",
  "Electronic",
  "Indie",
  "Pop",
  "Rock",
  "Synth-pop",
  "Trip-hop",
];

export const GENRE_ARTISTS: Record<string, string[]> = {
  Alternative: [
    "Arcade Fire",
    "CHVRCHES",
    "Cœur de pirate",
    "Camping in Alaska",
    "Lorde",
    "Noize MC",
    "The Jazz June",
    "The xx",
  ],
  Ambient: ["Boards of Canada"],
  Electronic: [
    "Boards of Canada",
    "Bop",
    "CHVRCHES",
    "Daft Punk",
    "M83",
    "The xx",
  ],
  Indie: [
    "Arcade Fire",
    "Camping in Alaska",
    "CHVRCHES",
    "Lorde",
    "M83",
    "Tame Impala",
    "The Jazz June",
    "The xx",
  ],
  Pop: ["Cœur de pirate", "Daft Punk", "Lorde"],
  Rock: ["Camping in Alaska", "Noize MC", "Tame Impala", "The Jazz June"],
  "Synth-pop": ["CHVRCHES", "M83"],
  "Trip-hop": ["Boards of Canada", "Bop"],
};

export const PLAYLISTS: Playlist[] = [
  {
    id: "latenight",
    name: "late night",
    items: [
      { a: "blonde", i: 0 },
      { a: "heroine", i: 3 },
      { a: "bones", i: 3 },
      { a: "ram", i: 3 },
      { a: "coexist", i: 0 },
    ],
  },
  {
    id: "run",
    name: "run",
    items: [
      { a: "ram", i: 5 },
      { a: "reflektor", i: 0 },
      { a: "bones", i: 0 },
      { a: "hurryup", i: 1 },
      { a: "lonerism", i: 3 },
    ],
  },
  {
    id: "focus",
    name: "focus flow",
    items: [
      { a: "harvest", i: 0 },
      { a: "bones", i: 4 },
      { a: "blonde", i: 5 },
      { a: "coexist", i: 2 },
    ],
  },
  {
    id: "faves",
    name: "favourites",
    items: [
      { a: "heroine", i: 2 },
      { a: "ram", i: 5 },
      { a: "reflektor", i: 0 },
      { a: "hurryup", i: 1 },
      { a: "lonerism", i: 4 },
      { a: "heroine", i: 5 },
    ],
  },
];

export const PLACEHOLDER_PREVIEW_URL = "/audio/1 - In Between.mp3";

export const ARTISTS: string[] = buildArtists(ALBUMS)

export function buildArtists(albums: Album[]): string[] {
  return [...new Set(albums.map(a => a.artist))].sort(
    (x, y) => x.replace(/^the\s+/i, '').localeCompare(y.replace(/^the\s+/i, ''), 'en', { sensitivity: 'base' })
  )
}

export function buildSongs(albums: Album[]): SongEntry[] {
  const out: SongEntry[] = []
  albums.forEach(a =>
    a.tracks.forEach(([title, dur], i) =>
      out.push({ title, dur, artist: a.artist, album: a, idx: i })
    )
  )
  return out.sort((x, y) => x.title.localeCompare(y.title, 'en', { sensitivity: 'base' }))
}

export const SONGS: SongEntry[] = buildSongs(ALBUMS)

export function albumQueue(a: Album): Track[] {
  return a.tracks.map(([title, dur], i) => ({
    title,
    dur,
    artist: a.artist,
    album: a.title,
    color: a.color,
    imageUrl: a.imageUrl,
    // Spotify albums: use preview from API (may be null → undefined), no local placeholder
    // Static albums: use local placeholder MP3
    previewUrl: a.spotifyTrackPreviews
      ? a.spotifyTrackPreviews[i]
      : PLACEHOLDER_PREVIEW_URL,
    spotifyUri: a.spotifyTrackUris?.[i],
  }))
}

export function artistAlbums(name: string, albums: Album[] = ALBUMS): Album[] {
  return albums.filter((a) => a.artist === name)
}

export function artistQueue(name: string, albums: Album[] = ALBUMS): Track[] {
  return artistAlbums(name, albums).flatMap(albumQueue)
}

export function resolvePlaylistTrack(it: { a: string; i: number }): Track {
  const a = ALBUMS.find((x) => x.id === it.a)!;
  const [title, dur] = a.tracks[it.i];
  return {
    title,
    dur,
    artist: a.artist,
    album: a.title,
    color: a.color,
    imageUrl: a.imageUrl,
    previewUrl: PLACEHOLDER_PREVIEW_URL,
  };
}

export function playlistQueue(pl: Playlist): Track[] {
  if (pl.tracks) return pl.tracks
  return pl.items.map(resolvePlaylistTrack)
}

export function fmt(s: number): string {
  const n = Math.max(0, Math.floor(s));
  return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
}
