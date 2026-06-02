/* ============================================================
   zPlayer — library data, hub, collection, artist card, album
   ============================================================ */
const { useState: useStateC, useRef: useRefC, useLayoutEffect } = React;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const ALBUMS = [
  { id: "reflektor", artist: "Arcade Fire", title: "Reflektor", year: 2013, color: "#b0392f",
    tracks: [["Reflektor",454],["We Exist",345],["Flashbulb Eyes",139],["Here Comes the Night Time",391],["Normal Person",260],["Afterlife",238]] },
  { id: "harvest", artist: "Boards of Canada", title: "Tomorrow's Harvest", year: 2013, color: "#6d7b53",
    tracks: [["Reach for the Dead",287],["White Cyclosa",195],["Jacquard Causeway",394],["Cold Earth",230],["Palace Posy",243],["Nothing Is Real",217]] },
  { id: "bones", artist: "CHVRCHES", title: "The Bones of What You Believe", year: 2013, color: "#7a3fb0",
    tracks: [["The Mother We Share",191],["We Sink",213],["Gun",218],["Tether",302],["Lies",233],["Recover",217]] },
  { id: "blonde", artist: "C\u0153ur de pirate", title: "Blonde (Bonus Track Version)", year: 2011, color: "#c8771a",
    tracks: [["Adieu",147],["Golden Baby",182],["Danse et danse",169],["Saint-Laurent",201],["Place de la R\u00e9publique",178],["Cap Diamant",163]] },
  { id: "ram", artist: "Daft Punk", title: "Random Access Memories", year: 2013, color: "#2f6fb0",
    tracks: [["Give Life Back to Music",274],["The Game of Love",322],["Giorgio by Moroder",544],["Within",228],["Instant Crush",337],["Get Lucky",368]] },
  { id: "heroine", artist: "Lorde", title: "Pure Heroine", year: 2013, color: "#3a8f6b",
    tracks: [["Tennis Court",200],["400 Lux",234],["Royals",190],["Ribs",259],["Buzzcut Season",248],["Team",193]] },
  { id: "hurryup", artist: "M83", title: "Hurry Up, We're Dreaming", year: 2011, color: "#c43b6b",
    tracks: [["Intro",307],["Midnight City",244],["Reunion",281],["Wait",240],["Steve McQueen",238],["Splendor",294]] },
  { id: "lonerism", artist: "Tame Impala", title: "Lonerism", year: 2012, color: "#cf8a1e",
    tracks: [["Be Above It",234],["Endors Toi",193],["Apocalypse Dreams",350],["Mind Mischief",274],["Feels Like We Only Go Backwards",193],["Elephant",211]] },
  { id: "coexist", artist: "The xx", title: "Coexist", year: 2012, color: "#46506b",
    tracks: [["Angels",172],["Chained",223],["Fiction",257],["Try",233],["Reunion",240],["Sunset",247]] },
];

const GENRES = ["Alternative", "Ambient", "Electronic", "Indie", "Pop", "Rock", "Synth-pop", "Trip-hop"];

function albumQueue(a) { return a.tracks.map(([title, dur]) => ({ title, dur, artist: a.artist, album: a.title, color: a.color })); }
function artistAlbums(name) { return ALBUMS.filter((a) => a.artist === name); }
function artistQueue(name) { return artistAlbums(name).flatMap(albumQueue); }

const ARTISTS = [...new Set(ALBUMS.map((a) => a.artist))]
  .sort((x, y) => x.replace(/^the\s+/i, "").localeCompare(y.replace(/^the\s+/i, ""), "en", { sensitivity: "base" }));

const SONGS = [];
ALBUMS.forEach((a) => a.tracks.forEach(([title, dur], i) =>
  SONGS.push({ title, dur, artist: a.artist, album: a, idx: i })));
SONGS.sort((x, y) => x.title.localeCompare(y.title, "en", { sensitivity: "base" }));

/* ---------------- glyphs ---------------- */
const PlayCircle = (
  <svg viewBox="0 0 36 36" width="34" height="34">
    <circle cx="18" cy="18" r="16.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M14.5 12l9.5 6-9.5 6z" fill="currentColor" />
  </svg>
);
const DownloadCircle = (
  <svg viewBox="0 0 36 36" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="18" cy="18" r="16.5" /><path d="M18 10.5v11" strokeLinecap="round" />
    <path d="M13 16.5L18 21.5l5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const SearchGlyph = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
    <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L20 20" strokeLinecap="round" />
  </svg>
);
const ShuffleGlyph = (
  <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M14.83 13.41l1.42-1.41 3.13 3.13L21 13.5V19h-5.5l1.96-1.96-2.63-2.63zM14.5 5H21v6.5l-1.96-1.96L6.41 22.13 5 20.71 18.04 7.66 16.5 6.12zM4 6.34L5.41 4.93l4.84 4.83-1.41 1.41z" /></svg>
);

/* ---------------- shared bits ---------------- */
function Overline({ children }) { return <div className="overline">{children}</div>; }
function Section({ children }) { return <div className="section">{children}</div>; }
function Thumb({ color, size }) { return <div className="thumb" style={{ background: color, width: size, height: size }}></div>; }
function fmtC(s) { const m = Math.floor(s / 60); return m + ":" + String(Math.floor(s % 60)).padStart(2, "0"); }

function AppBar({ left, children }) {
  return (
    <div className="appbar">
      <div className="appbar-left">{left}</div>
      <button className="ellipsis" aria-label="more"><i></i><i></i><i></i></button>
      {children}
    </div>
  );
}

/* ---------------- pivot header ---------------- */
function Pivot({ tabs, active, onChange }) {
  const refs = useRefC([]);
  const contRef = useRefC(null);
  useLayoutEffect(() => {
    const el = refs.current[active];
    const cont = contRef.current;
    if (el && cont) cont.scrollTo({ left: Math.max(0, el.offsetLeft - 26), behavior: "auto" });
  }, [active]);
  return (
    <div className="pivot" ref={contRef}>
      <div className="pivot-track">
        {tabs.map((tab, i) => (
          <h2 key={tab} ref={(el) => (refs.current[i] = el)}
              className={"pivot-h" + (i === active ? " active" : "")}
              onClick={() => onChange(i)}>{tab}</h2>
        ))}
      </div>
    </div>
  );
}
function useSwipe(onPrev, onNext) {
  const st = useRefC(null);
  return {
    onPointerDown: (e) => { st.current = { x: e.clientX, y: e.clientY }; },
    onPointerUp: (e) => {
      if (!st.current) return;
      const dx = e.clientX - st.current.x, dy = e.clientY - st.current.y;
      st.current = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) (dx < 0 ? onNext() : onPrev());
    },
  };
}

/* ---------------- hub (home panorama) ---------------- */
function Hub({ onOpen, onShuffle, nowPlaying }) {
  const stripRef = useRefC(null);
  const titleRef = useRefC(null);
  const MENU = [["artists", 0], ["albums", 1], ["songs", 2], ["genres", 3], ["playlists", 4], ["radio", 5]];
  const onScroll = () => {
    if (titleRef.current && stripRef.current)
      titleRef.current.style.transform = "translateX(" + (-stripRef.current.scrollLeft * 0.45) + "px)";
  };
  return (
    <div className="hub">
      <image-slot id="zp-hero" shape="rect" placeholder="drop artist photo" class="hub-bg"></image-slot>
      <div className="hub-scrim"></div>
      <div className="pano-title" ref={titleRef}>music</div>
      <div className="hub-strip" ref={stripRef} onScroll={onScroll}>
        {nowPlaying && <div className="pane">{nowPlaying}</div>}
        <div className="pane">
          <div className="pane-head">collection</div>
          <div className="hub-menu">
            {MENU.map(([label, tab]) => (
              <button key={label} className="hub-item" onClick={() => onOpen(tab)}>{label}</button>
            ))}
          </div>
        </div>
      </div>
      <AppBar left={[
        <button key="s" className="ic-btn" aria-label="shuffle all" onClick={onShuffle}>{ShuffleGlyph}</button>,
        <button key="q" className="ic-btn" aria-label="search">{SearchGlyph}</button>,
      ]} />
    </div>
  );
}

/* ---------------- collection ---------------- */
function ArtistRow({ name, onOpenArtist, onPlay }) {
  return (
    <div className="lrow">
      <button className="play-circle" aria-label={"play " + name}
              onClick={(e) => { e.stopPropagation(); onPlay(artistQueue(name), 0); }}>{PlayCircle}</button>
      <div className="lrow-name" onClick={() => onOpenArtist(name)}>{name}</div>
    </div>
  );
}

function Collection({ initialTab, onOpenArtist, onOpenAlbum, onPlay }) {
  const TABS = ["artists", "albums", "songs", "genres", "playlists", "radio"];
  const [tab, setTab] = useStateC(initialTab || 0);
  const swipe = useSwipe(() => setTab((t) => Math.max(0, t - 1)),
                         () => setTab((t) => Math.min(TABS.length - 1, t + 1)));
  let firstLetter = null;
  return (
    <div className="page">
      <Overline>music</Overline>
      <Pivot tabs={TABS} active={tab} onChange={setTab} />

      <div className="scroll" key={tab} {...swipe}>
        {tab === 0 && (
          <div className="llist">
            <Section>all music</Section>
            {ARTISTS.map((name) => {
              const L = name.replace(/^the\s+/i, "")[0].toUpperCase();
              const tile = L !== firstLetter ? (firstLetter = L) : null;
              return (
                <React.Fragment key={name}>
                  {tile && <div className="index-tile">{L}</div>}
                  <ArtistRow name={name} onOpenArtist={onOpenArtist} onPlay={onPlay} />
                </React.Fragment>
              );
            })}
            <div style={{ height: 40 }}></div>
          </div>
        )}

        {tab === 1 && (
          <div className="album-list">
            {ALBUMS.map((a) => (
              <div key={a.id} className="album-group">
                <div className="group-head" onClick={() => onOpenArtist(a.artist)}>{a.artist}</div>
                <div className="album-row" onClick={() => onOpenAlbum(a)}>
                  <Thumb color={a.color} size={88} />
                  <div className="album-meta">
                    <div className="al-title">{a.title}</div>
                    <div className="al-year">{a.year}</div>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ height: 40 }}></div>
          </div>
        )}

        {tab === 2 && (
          <div className="song-list">
            {SONGS.map((s, i) => {
              const L = s.title[0].toUpperCase();
              const prev = i > 0 ? SONGS[i - 1].title[0].toUpperCase() : null;
              return (
                <React.Fragment key={s.album.id + s.title}>
                  {L !== prev && <div className="index-tile">{L}</div>}
                  <div className="lrow">
                    <button className="play-circle" aria-label="play"
                            onClick={(e) => { e.stopPropagation(); onPlay(albumQueue(s.album), s.idx); }}>{PlayCircle}</button>
                    <div className="lrow-name song" onClick={() => onPlay(albumQueue(s.album), s.idx)}>
                      <div className="lrow-title">{s.title}</div>
                      <div className="lrow-sub">{s.artist}</div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div style={{ height: 40 }}></div>
          </div>
        )}

        {tab === 3 && (
          <div className="llist">
            <Section>all music</Section>
            {GENRES.map((g, i) => (
              <div key={g} className="genre-item" onClick={() => onPlay(albumQueue(ALBUMS[i % ALBUMS.length]), 0)}>{g}</div>
            ))}
            <div style={{ height: 40 }}></div>
          </div>
        )}

        {tab === 4 && (
          <div className="pl-list">
            {PLAYLISTS.map((pl) => <PlaylistRow key={pl.id} pl={pl} onPlay={onPlay} />)}
            <div style={{ height: 40 }}></div>
          </div>
        )}

        {tab === 5 && (
          <div className="llist">
            <Section>smart dj</Section>
            {ARTISTS.map((name) => (
              <div key={name} className="lrow">
                <button className="play-circle" aria-label={"start " + name + " radio"}
                        onClick={(e) => { e.stopPropagation(); onPlay(artistQueue(name), 0); }}>{PlayCircle}</button>
                <div className="lrow-name" onClick={() => onPlay(artistQueue(name), 0)}>{name} radio</div>
              </div>
            ))}
            <div style={{ height: 40 }}></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- playlists ---------------- */
const PLAYLISTS = [
  { id: "latenight", name: "late night",  items: [{a:"blonde",i:0},{a:"heroine",i:3},{a:"bones",i:3},{a:"ram",i:3},{a:"coexist",i:0}] },
  { id: "run",       name: "run",         items: [{a:"ram",i:5},{a:"reflektor",i:0},{a:"bones",i:0},{a:"hurryup",i:1},{a:"lonerism",i:3}] },
  { id: "focus",     name: "focus flow",  items: [{a:"harvest",i:0},{a:"bones",i:4},{a:"blonde",i:5},{a:"coexist",i:2}] },
  { id: "faves",     name: "favourites",  items: [{a:"heroine",i:2},{a:"ram",i:5},{a:"reflektor",i:0},{a:"hurryup",i:1},{a:"lonerism",i:4},{a:"heroine",i:5}] },
];
function resolve(it) { const a = ALBUMS.find((x) => x.id === it.a); const tr = a.tracks[it.i]; return { title: tr[0], dur: tr[1], artist: a.artist, album: a.title, color: a.color }; }
function playlistQueue(pl) { return pl.items.map(resolve); }
function PlaylistRow({ pl, onPlay }) {
  const cols = pl.items.slice(0, 4).map((it) => resolve(it).color);
  while (cols.length < 4) cols.push(cols[cols.length - 1] || "#444");
  return (
    <div className="pl-row" onClick={() => onPlay(playlistQueue(pl), 0)}>
      <div className="pl-mosaic">{cols.map((c, i) => <span key={i} style={{ background: c }}></span>)}</div>
      <div className="pl-meta"><div className="pl-name">{pl.name}</div><div className="pl-count">{pl.items.length} songs</div></div>
    </div>
  );
}

/* ---------------- artist card ---------------- */
function ArtistCard({ name, onOpenAlbum, onPlay }) {
  const [tab, setTab] = useStateC(0);
  const albums = artistAlbums(name);
  const swipe = useSwipe(() => setTab(0), () => setTab(1));
  return (
    <div className="page artist-card">
      <image-slot id={"zp-bg-" + slug(name)} shape="rect" placeholder="drop artist photo" class="card-bg"></image-slot>
      <div className="card-scrim"></div>
      <div className="card-body">
        <Overline>{name}</Overline>
        <Pivot tabs={["albums", "songs"]} active={tab} onChange={setTab} />

        {tab === 0 ? (
          <div className="scroll" {...swipe}>
            <Section>in collection</Section>
            {albums.map((a) => (
              <div key={a.id} className="card-album" onClick={() => onOpenAlbum(a)}>
                <Thumb color={a.color} size={104} />
                <div className="card-album-meta">
                  <div className="ca-title">{a.title}</div>
                  <div className="ca-sub">{a.artist}</div>
                </div>
              </div>
            ))}
            <Section>store</Section>
            <div className="store-row">
              <button className="dl-circle" aria-label="download more">{DownloadCircle}</button>
              <div className="store-text">more from {name}</div>
            </div>
            <div style={{ height: 40 }}></div>
          </div>
        ) : (
          <div className="scroll" {...swipe}>
            {albums.flatMap((a) => a.tracks.map(([title, dur], i) => (
              <div key={a.id + i} className="lrow">
                <button className="play-circle" aria-label="play"
                        onClick={(e) => { e.stopPropagation(); onPlay(albumQueue(a), i); }}>{PlayCircle}</button>
                <div className="lrow-name song" onClick={() => onPlay(albumQueue(a), i)}>
                  <div className="lrow-title">{title}</div>
                  <div className="lrow-sub">{a.title}</div>
                </div>
              </div>
            )))}
            <div style={{ height: 40 }}></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- album detail ---------------- */
function AlbumDetail({ album, onPlay }) {
  const [tab, setTab] = useStateC(0);
  const swipe = useSwipe(() => setTab(0), () => setTab(1));
  return (
    <div className="page">
      <Overline>{album.artist}</Overline>
      <Pivot tabs={["songs", "review"]} active={tab} onChange={setTab} />
      {tab === 0 ? (
        <div className="scroll" {...swipe}>
          <div className="al-head">
            <Thumb color={album.color} size={132} />
            <div className="al-head-meta">
              <div className="al-head-title">{album.title}</div>
              <div className="al-head-sub">{album.artist}</div>
              <button className="al-playall" onClick={() => onPlay(albumQueue(album), 0)}>
                <svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 5.5v13L19 12z" fill="currentColor" /></svg><span>play</span>
              </button>
            </div>
          </div>
          <div className="track-list">
            {album.tracks.map(([title, dur], i) => (
              <div key={title} className="al-track" onClick={() => onPlay(albumQueue(album), i)}>
                <span className="al-tnum">{i + 1}</span><span className="al-ttitle">{title}</span><span className="al-tdur">{fmtC(dur)}</span>
              </div>
            ))}
            <div style={{ height: 40 }}></div>
          </div>
        </div>
      ) : (
        <div className="scroll" {...swipe}>
          <div className="review">
            <Thumb color={album.color} size={132} />
            <p className="review-body">{album.artist} &mdash; <em>{album.title}</em> ({album.year}). {album.tracks.length} tracks, indexed locally and ready to play offline.</p>
            <div className="stars">{"\u2605\u2605\u2605\u2605".split("").map((s, i) => <span key={i}>{s}</span>)}<span className="dim">{"\u2606"}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ALBUMS, ARTISTS, albumQueue, artistQueue, Hub, Collection, ArtistCard, AlbumDetail });
