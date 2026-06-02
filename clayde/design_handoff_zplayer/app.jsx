const { useState, useEffect, useRef, useCallback } = React;

/* ---------------- icons ---------------- */
const Ico = {
  prev:    <svg viewBox="0 0 24 24"><path d="M6 6h2.4v12H6zM20 6L9.6 12 20 18z"/></svg>,
  next:    <svg viewBox="0 0 24 24"><path d="M15.6 6H18v12h-2.4zM4 6l10.4 6L4 18z"/></svg>,
  play:    <svg viewBox="0 0 24 24"><path d="M7 5.5v13L19 12z"/></svg>,
  pause:   <svg viewBox="0 0 24 24"><path d="M6.5 5h3.6v14H6.5zM13.9 5h3.6v14h-3.6z"/></svg>,
  heart:   <svg viewBox="0 0 24 24"><path d="M12 20.3l-1.3-1.18C6.1 14.96 3.2 12.33 3.2 9.06 3.2 6.6 5.16 4.7 7.6 4.7c1.38 0 2.7.64 3.56 1.66l.84.99.84-.99A4.66 4.66 0 0 1 16.4 4.7c2.44 0 4.4 1.9 4.4 4.36 0 3.27-2.9 5.9-7.5 10.06z"/></svg>,
  shuffle: <svg viewBox="0 0 24 24"><path d="M14.83 13.41l1.42-1.41 3.13 3.13L21 13.5V19h-5.5l1.96-1.96-2.63-2.63zM14.5 5H21v6.5l-1.96-1.96L6.41 22.13 5 20.71 18.04 7.66 16.5 6.12zM4 6.34L5.41 4.93l4.84 4.83-1.41 1.41z"/></svg>,
  repeat:  <svg viewBox="0 0 24 24"><path d="M7 7h9v2.6L20.5 5.6 16 1.6V4H4.5v6.5H7zM17 17H8v-2.6L3.5 18.4 8 22.4V20h11.5v-6.5H17z"/></svg>,
  repeat1: <svg viewBox="0 0 24 24"><path d="M7 7h9v2.6L20.5 5.6 16 1.6V4H4.5v6.5H7zM17 17H8v-2.6L3.5 18.4 8 22.4V20h11.5v-6.5H17z"/><text x="12" y="14.5" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="currentColor">1</text></svg>,
  queue:   <svg viewBox="0 0 24 24"><path d="M3 6h13v2H3zM3 11h13v2H3zM3 16h9v2H3zM16 14.5l5.5 3.5-5.5 3.5z"/></svg>,
  back:    <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

const fmt = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s/60) + ":" + String(s%60).padStart(2,"0"); };

/* ---------------- shared playback state ---------------- */
function usePlayback() {
  const [queue, setQueue]   = useState(albumQueue(ALBUMS[0]));
  const [idx, setIdx]       = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime]     = useState(0);
  const [fav, setFav]       = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(0);   // 0 off · 1 all · 2 one
  const [started, setStarted] = useState(false);
  const raf = useRef(0), last = useRef(0);
  const track = queue[idx] || queue[0];

  const next = useCallback(() => {
    setIdx((i) => {
      if (shuffle) { let n; do { n = Math.floor(Math.random()*queue.length); } while (n===i && queue.length>1); return n; }
      return (i + 1) % queue.length;
    });
    setTime(0);
  }, [shuffle, queue.length]);

  const prev = () => { if (time > 3) { setTime(0); return; } setIdx((i) => (i - 1 + queue.length) % queue.length); setTime(0); };

  const play = (q, i) => { setQueue(q); setIdx(i); setTime(0); setPlaying(true); setStarted(true); };
  const toggle = () => setPlaying((p) => !p);
  const seek = (frac) => setTime(frac * track.dur);

  useEffect(() => {
    if (!playing) { cancelAnimationFrame(raf.current); last.current = 0; return; }
    const step = (ts) => {
      if (last.current) setTime((tm) => {
        const nt = tm + (ts - last.current) / 1000;
        if (nt >= track.dur) { if (repeat === 2) return 0; next(); return 0; }
        return nt;
      });
      last.current = ts; raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf.current); last.current = 0; };
  }, [playing, idx, repeat, track.dur, next]);

  return {
    queue, idx, track, playing, time, fav, shuffle, repeat, started,
    play, toggle, next, prev, seek,
    toggleFav: () => setFav((v) => !v),
    toggleShuffle: () => setShuffle((v) => !v),
    cycleRepeat: () => setRepeat((r) => (r + 1) % 3),
  };
}

/* ---------------- full-screen now playing ---------------- */
function Player({ pb, onBack }) {
  const { track, queue, idx, playing, time, fav, shuffle, repeat,
          toggle, next, prev, seek, toggleFav, toggleShuffle, cycleRepeat } = pb;
  const pct = Math.min(100, (time / track.dur) * 100);
  const onSeek = (e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); };
  const repeatState = repeat === 0 ? "outline" : "on";

  return (
    <div className="np">
      <div className="transport">
        <button className="tbtn" onClick={prev} aria-label="previous">{Ico.prev}</button>
        <button className="tbtn mid" onClick={toggle} aria-label="play/pause">{playing ? Ico.pause : Ico.play}</button>
        <button className="tbtn" onClick={next} aria-label="next">{Ico.next}</button>
      </div>

      <div className="meta swap" key={"m"+idx}>
        <div className="artist">{track.artist}</div>
        <div className="album">{track.album}</div>
      </div>

      <div className="artrow">
        <div className="art swap" key={"a"+idx} style={{ background: track.color }}></div>
        <div className="sideicons">
          <button className={"iconbtn " + (fav?"on":"outline")} onClick={toggleFav} aria-label="favorite">{Ico.heart}</button>
          <button className={"iconbtn " + (shuffle?"on":"")} onClick={toggleShuffle} aria-label="shuffle">{Ico.shuffle}</button>
          <button className={"iconbtn " + repeatState} onClick={cycleRepeat} aria-label="repeat">{repeat===2?Ico.repeat1:Ico.repeat}</button>
        </div>
      </div>

      <div className="progress">
        <div className="bar" onClick={onSeek}><div className="fill" style={{ width: pct+"%" }}></div></div>
        <div className="times"><span className="elapsed">{fmt(time)}</span><span className="remain">-{fmt(track.dur-time)}</span></div>
      </div>

      <div className="track swap" key={"t"+idx}>
        <div className="title">{track.title}</div>
        <div className="upnext">
          <div>{queue[(idx+1)%queue.length].title}</div>
          <div>{queue[(idx+2)%queue.length].title}</div>
        </div>
      </div>

      <div className="appbar">
        <button className="iconbtn appback" onClick={onBack} aria-label="back">{Ico.back}</button>
        <button className="ellipsis" aria-label="more"><i></i><i></i><i></i></button>
      </div>
    </div>
  );
}

/* ---------------- compact now-playing pane (hub) ---------------- */
function NowPlayingPane({ pb, onOpen }) {
  const { track, playing, time, shuffle, repeat, toggle, next, prev, seek, toggleShuffle, cycleRepeat } = pb;
  const pct = Math.min(100, (time / track.dur) * 100);
  const onSeek = (e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); };
  return (
    <div className="nowpane">
      <div className="pane-head">now playing</div>
      <div className="artrow">
        <div className="art" style={{ background: track.color }} onClick={onOpen}></div>
        <div className="sideicons">
          <button className={"iconbtn " + (shuffle?"on":"")} onClick={toggleShuffle} aria-label="shuffle">{Ico.shuffle}</button>
          <button className={"iconbtn " + (repeat===0?"outline":"on")} onClick={cycleRepeat} aria-label="repeat">{repeat===2?Ico.repeat1:Ico.repeat}</button>
          <button className="iconbtn" onClick={onOpen} aria-label="open queue">{Ico.queue}</button>
        </div>
      </div>
      <div className="progress">
        <div className="bar" onClick={onSeek}><div className="fill" style={{ width: pct+"%" }}></div></div>
        <div className="times"><span className="elapsed">{fmt(time)}</span><span className="remain">-{fmt(track.dur-time)}</span></div>
      </div>
      <div className="track" onClick={onOpen}>
        <div className="title">{track.title}</div>
        <div className="by">by {track.artist}</div>
      </div>
      <div className="transport sm">
        <button className="tbtn" onClick={prev} aria-label="previous">{Ico.prev}</button>
        <button className="tbtn mid" onClick={toggle} aria-label="play/pause">{playing ? Ico.pause : Ico.play}</button>
        <button className="tbtn" onClick={next} aria-label="next">{Ico.next}</button>
      </div>
    </div>
  );
}

/* ---------------- router ---------------- */
const ACCENTS = ["#5ca800", "#1ba1e2", "#a4c400", "#d80073", "#fa6800", "#6a00ff"];
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#5ca800",
  "theme": "dark"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const pb = usePlayback();
  const [screen, setScreen] = useState("home");
  const [colTab, setColTab] = useState(0);
  const [artist, setArtist] = useState(ARTISTS[0]);
  const [album, setAlbum] = useState(ALBUMS[0]);
  const [backTo, setBackTo] = useState("home");
  const [prevScreen, setPrevScreen] = useState("home");

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
    document.getElementById("screen").setAttribute("data-theme", t.theme);
  }, [t.accent, t.theme]);

  const openCollection = (tab) => { setColTab(tab); setScreen("collection"); };
  const openArtist = (name) => { setArtist(name); setPrevScreen(screen); setScreen("artist"); };
  const openAlbum  = (a) => { setAlbum(a); setPrevScreen(screen); setScreen("album"); };
  const playFrom = (q, i, from) => { pb.play(q, i); setBackTo(from); setScreen("nowplaying"); };
  const shuffleAll = () => { const all = ALBUMS.flatMap(albumQueue).sort(() => Math.random() - 0.5); playFrom(all, 0, "home"); };
  const openNowPlaying = () => { setBackTo("home"); setScreen("nowplaying"); };

  const back = () => {
    if (screen === "nowplaying") setScreen(backTo);
    else if (screen === "collection") setScreen("home");
    else if (screen === "artist") setScreen(prevScreen === "artist" ? "collection" : prevScreen);
    else if (screen === "album") setScreen(prevScreen);
  };

  let body, key = screen;
  if (screen === "home") {
    body = <Hub onOpen={openCollection} onShuffle={shuffleAll}
                nowPlaying={pb.started ? <NowPlayingPane pb={pb} onOpen={openNowPlaying} /> : null} />;
  } else if (screen === "collection") {
    key = "col-" + colTab;
    body = <Collection initialTab={colTab} onOpenArtist={openArtist} onOpenAlbum={openAlbum}
                       onPlay={(q, i) => playFrom(q, i, "collection")} />;
  } else if (screen === "artist") {
    key = "artist-" + artist;
    body = <ArtistCard name={artist} onOpenAlbum={openAlbum} onPlay={(q, i) => playFrom(q, i, "artist")} />;
  } else if (screen === "album") {
    key = "album-" + album.id;
    body = <AlbumDetail album={album} onPlay={(q, i) => playFrom(q, i, "album")} />;
  } else {
    body = <Player pb={pb} onBack={back} />;
  }

  const showBack = screen === "collection" || screen === "artist" || screen === "album";

  return (
    <React.Fragment>
      {showBack && <button className="page-back" onClick={back} aria-label="back">{Ico.back}</button>}
      <div className="screen-body screen-in" key={key}>{body}</div>

      {ReactDOM.createPortal(
        <TweaksPanel>
          <TweakSection label="Theme" />
          <TweakColor label="Accent" value={t.accent} options={ACCENTS} onChange={(v) => setTweak("accent", v)} />
          <TweakRadio label="Mode" value={t.theme} options={["dark", "light"]} onChange={(v) => setTweak("theme", v)} />
        </TweaksPanel>,
        document.getElementById("tweaks-root")
      )}
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
