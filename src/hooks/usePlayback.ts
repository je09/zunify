// ---------------------------------------------------------------------------
// Playback hook — three engine modes:
//
//   'sdk'   — Spotify Web Playback SDK (Premium, full tracks).
//              Shuffle/repeat/liked state delegated to Spotify server.
//              Up Next sourced from GET /me/player/queue.
//              Play context URIs (albums, playlists) for server-managed order.
//
//   'audio' — <audio> element for any URL (preview_url, local MP3).
//              Shuffle/repeat managed locally. play() in gesture context.
//
//   'raf'   — requestAnimationFrame timer simulation (no real audio).
//              Fallback when neither of the above applies.
// ---------------------------------------------------------------------------

import { useState, useEffect, useRef, useCallback } from "react";
import { Track } from "../data";
import type { SpotifyEngine } from "../useSpotifyPlayer";
import {
  setRepeatMode as setRepeatModeApi,
  checkSavedTracks,
  saveTracks,
  removeTracks,
  fetchUserQueue,
} from "../spotifyApi";

export interface UpNextTrack {
  title: string;
  artist: string;
  imageUrl?: string;
}

export interface PlaybackState {
  queue: Track[];
  idx: number;
  track: Track;
  upNext: UpNextTrack[]; // 2 upcoming tracks
  playing: boolean;
  time: number;
  fav: boolean;
  shuffle: boolean;
  repeat: 0 | 1 | 2; // 0 off · 1 all · 2 one
  started: boolean;
  volume: number; // 0–1 fraction
  prevDisabled: boolean;
  nextDisabled: boolean;
  play: (q: Track[], i: number, contextUri?: string) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (fraction: number) => void;
  toggleFav: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (fraction: number) => void;
}

export function usePlayback(spotify?: SpotifyEngine | null): PlaybackState {
  const [queue, setQueue] = useState<Track[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [fav, setFav] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<0 | 1 | 2>(0);
  const [started, setStarted] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [serverUpNext, setServerUpNext] = useState<UpNextTrack[]>([]);

  // Persistent audio element — never recreated, src is swapped on track change.
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const rafRef = useRef(0);
  const lastRef = useRef(0);

  // Refs for values used inside closures that must never be stale.
  const repeatRef = useRef<0 | 1 | 2>(0);
  const shuffleRef = useRef(false);
  const queueRef = useRef(queue);
  const idxRef = useRef(0);
  const originalQueueRef = useRef<Track[]>([]);
  const spotifyRef = useRef<SpotifyEngine | null | undefined>(undefined);
  const playingRef = useRef(false);
  const favRef = useRef(false);
  const nextCbRef = useRef<() => void>(() => {});
  const prevCbRef = useRef<() => void>(() => {});
  const seekCbRef = useRef<(f: number) => void>(() => {});
  const trackRef = useRef(queue[0]);
  const gestureDidPlayRef = useRef(false);

  repeatRef.current = repeat;
  shuffleRef.current = shuffle;
  queueRef.current = queue;
  idxRef.current = idx;
  spotifyRef.current = spotify;
  playingRef.current = playing;
  trackRef.current = queue[idx] ?? queue[0];
  favRef.current = fav;

  const track = queue[idx] ?? queue[0];

  const engine: "sdk" | "audio" | "raf" =
    spotify != null && Boolean(track?.spotifyUri)
      ? "sdk"
      : Boolean(track?.previewUrl)
        ? "audio"
        : "raf";

  // ── advanceQueue ──────────────────────────────────────────────────────────
  const advanceQueue = useCallback(() => {
    setIdx((i) => (i + 1) % queueRef.current.length);
    setTime(0);
  }, []);

  // ── Media Session: register handlers once ────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => setPlaying(true));
    navigator.mediaSession.setActionHandler("pause", () => setPlaying(false));
    navigator.mediaSession.setActionHandler("nexttrack", () =>
      nextCbRef.current(),
    );
    navigator.mediaSession.setActionHandler("previoustrack", () =>
      prevCbRef.current(),
    );
    navigator.mediaSession.setActionHandler("seekto", (e) => {
      if (e.seekTime != null)
        seekCbRef.current(e.seekTime / (trackRef.current?.dur || 1));
    });
  }, []);

  // ── Media Session: metadata (updates on track change) ─────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !track) return;
    const artwork: MediaImage[] = track.imageUrl
      ? [
          { src: track.imageUrl, sizes: "640x640", type: "image/jpeg" },
          { src: track.imageUrl, sizes: "300x300", type: "image/jpeg" },
        ]
      : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork,
    });
  }, [track?.title, track?.artist, track?.album, track?.imageUrl]);

  // ── Media Session: position state ─────────────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !track?.dur) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: track.dur,
        playbackRate: 1,
        position: Math.min(Math.max(0, time), track.dur),
      });
    } catch {
      /* old Safari */
    }
  }, [time, track?.dur]);

  // ── Prefetch next tracks ──────────────────────────────────────────────────
  useEffect(() => {
    const nextTracks = Array.from(
      { length: Math.min(5, queue.length - 1) },
      (_, i) => queue[(idx + i + 1) % queue.length],
    );
    const audios: HTMLAudioElement[] = [];

    nextTracks.forEach((t) => {
      if (t.imageUrl) {
        const img = new Image();
        img.src = t.imageUrl;
      }
      if (t.previewUrl) {
        const audio = new Audio();
        audio.preload = "metadata";
        audio.src = t.previewUrl;
        audio.load();
        audios.push(audio);
      }
    });

    return () => {
      audios.forEach((audio) => {
        audio.removeAttribute("src");
        audio.load();
      });
    };
  }, [idx, queue]);

  // ── Persistent audio element — attach listeners once ──────────────────────
  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate = () => setTime(audio.currentTime);
    const onEnded = () => {
      if (repeatRef.current === 2) {
        audio.currentTime = 0;
        void audio.play();
        return;
      }
      advanceQueue();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.src = "";
    };
  }, [advanceQueue]);

  // ── Audio: update src on track change ─────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (engine !== "audio") {
      audio.pause();
      return;
    }

    if (gestureDidPlayRef.current) {
      gestureDidPlayRef.current = false;
      return;
    }

    const newSrc = track?.previewUrl ?? "";
    audio.src = newSrc;
    if (newSrc) {
      audio.load();
      if (playingRef.current) void audio.play();
    }
  }, [track?.previewUrl, engine, idx]);

  // ── Audio: sync play/pause state ──────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (engine !== "audio") return;
    if (playing && audio.paused && audio.src) void audio.play();
    if (!playing && !audio.paused) audio.pause();
  }, [playing, engine]);

  // ── SDK state sync ────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (engine !== "sdk" || !spotify?.sdkState) return;
    const s = spotify.sdkState;
    setTime(s.position / 1000);
    setPlaying(!s.paused);
    setShuffle(s.shuffle);
    setRepeat(s.repeat_mode as 0 | 1 | 2);

    if ("mediaSession" in navigator) {
      const ct = s.track_window.current_track;
      const artwork: MediaImage[] = ct.album.images?.length
        ? ct.album.images.map((img) => ({
            src: img.url,
            sizes: "640x640",
            type: "image/jpeg" as const,
          }))
        : [];
      navigator.mediaSession.metadata = new MediaMetadata({
        title: ct.name,
        artist: ct.artists.map((a) => a.name).join(", "),
        album: ct.album.name,
        artwork,
      });
      try {
        navigator.mediaSession.setPositionState({
          duration: s.duration / 1000,
          playbackRate: 1,
          position: Math.min(s.position / 1000, s.duration / 1000),
        });
      } catch {
        /* old Safari */
      }
    }

    const uri = s.track_window.current_track.uri;
    const newIdx = queueRef.current.findIndex((t) => t.spotifyUri === uri);
    if (newIdx !== -1 && newIdx !== idx) setIdx(newIdx);
  }, [spotify?.sdkState]);

  // ── SDK: check liked state when track changes ─────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (engine !== "sdk" || !spotify?.sdkState) return;
    const uri = spotify.sdkState.track_window.current_track.uri;
    const id = uri?.split(":")[2];
    if (!id) return;
    checkSavedTracks([id])
      .then(([liked]) => setFav(!!liked))
      .catch(() => {});
  }, [spotify?.sdkState?.track_window.current_track.id, engine]);

  // ── SDK: fetch server queue when track changes ─────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (engine !== "sdk") {
      setServerUpNext([]);
      return;
    }
    fetchUserQueue()
      .then(({ queue }) =>
        setServerUpNext(
          queue
            .slice(0, 2)
            .map((t) => ({
              title: t.title,
              artist: t.artist,
              imageUrl: t.imageUrl,
            })),
        ),
      )
      .catch(() => {});
  }, [spotify?.sdkState?.track_window.current_track.id, engine]);

  // ── RAF simulation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (engine !== "raf" || !playing || !track) {
      cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
      return;
    }

    const step = (ts: number) => {
      if (lastRef.current) {
        setTime((tm) => {
          const nt = tm + (ts - lastRef.current) / 1000;
          if (nt >= (track?.dur ?? 0)) {
            if (repeatRef.current === 2) return 0;
            advanceQueue();
            return 0;
          }
          return nt;
        });
      }
      lastRef.current = ts;
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastRef.current = 0;
    };
  }, [playing, engine, idx, track?.dur, advanceQueue]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const play = useCallback(
    (q: Track[], i: number, contextUri?: string) => {
      if (q.length === 0) return;
      const t = q[i];

      // context_uri: Spotify manages order and shuffle server-side — skip local pre-shuffle.
      let activeQueue = q;
      let activeIdx = i;
      if (shuffleRef.current && !contextUri) {
        const rest = q.filter((_, ri) => ri !== i);
        for (let j = rest.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [rest[j], rest[k]] = [rest[k], rest[j]];
        }
        originalQueueRef.current = q;
        activeQueue = [t, ...rest];
        activeIdx = 0;
      } else {
        originalQueueRef.current = [];
      }

      setQueue(activeQueue);
      setIdx(activeIdx);
      setTime(0);
      setPlaying(true);
      setStarted(true);

      if (spotifyRef.current && t?.spotifyUri) {
        if (contextUri) {
          void spotifyRef.current.startPlaybackContext(contextUri, i);
        } else {
          const allUris = activeQueue.flatMap((t) =>
            t.spotifyUri ? [t.spotifyUri] : [],
          );
          const offsetInAll = activeQueue
            .slice(0, activeIdx)
            .filter((t) => t.spotifyUri).length;
          const MAX = 300;
          const windowUris = [
            ...allUris.slice(offsetInAll),
            ...allUris.slice(0, offsetInAll),
          ].slice(0, MAX);
          void spotifyRef.current.startPlayback(windowUris, 0);
        }
      } else if (t?.previewUrl) {
        const audio = audioRef.current;
        audio.src = t.previewUrl;
        audio.load();
        gestureDidPlayRef.current = true;
        void audio.play();
      }
    },
    [spotify],
  );

  const toggle = useCallback(() => {
    if (engine === "sdk" && spotify?.player) {
      void spotify.player.togglePlay();
      return;
    }
    if (engine === "audio") {
      if (playingRef.current) audioRef.current.pause();
      else void audioRef.current.play();
    }
    setPlaying((p) => !p);
  }, [engine, spotify]);

  const next = useCallback(() => {
    if (engine === "sdk" && spotify?.player) {
      void spotify.player.nextTrack();
      return;
    }
    advanceQueue();
  }, [engine, spotify, advanceQueue]);

  const prev = useCallback(() => {
    if (engine === "sdk" && spotify?.player) {
      void spotify.player.previousTrack();
      return;
    }
    if (time > 3) {
      setTime(0);
      audioRef.current.currentTime = 0;
      return;
    }
    setIdx((i) => (i - 1 + queueRef.current.length) % queueRef.current.length);
    setTime(0);
  }, [engine, spotify, time]);

  const seek = useCallback(
    (fraction: number) => {
      if (engine === "sdk" && spotify?.player) {
        const dur = spotify.sdkState?.duration ?? (track?.dur ?? 0) * 1000;
        void spotify.player.seek(Math.round(fraction * dur));
        return;
      }
      const t = fraction * (track?.dur ?? 0);
      setTime(t);
      audioRef.current.currentTime = t;
    },
    [engine, spotify, track?.dur],
  );

  const toggleFav = useCallback(() => {
    const t = trackRef.current;
    if (t?.spotifyUri) {
      const id = t.spotifyUri.split(":")[2];
      if (!id) {
        setFav((v) => !v);
        return;
      }
      const newFav = !favRef.current;
      setFav(newFav);
      const op = newFav ? saveTracks([id]) : removeTracks([id]);
      op.catch(() => setFav(!newFav));
      return;
    }
    setFav((v) => !v);
  }, []);

  const toggleShuffle = useCallback(() => {
    if (spotifyRef.current && trackRef.current?.spotifyUri) {
      // SDK mode: Spotify handles shuffle server-side
      void spotifyRef.current.setShuffle(!shuffleRef.current);
      return;
    }
    // Non-SDK: local queue shuffle
    setShuffle((prev) => {
      const next = !prev;
      if (next) {
        originalQueueRef.current = queueRef.current;
        const cur = queueRef.current[idxRef.current];
        const rest = queueRef.current.filter((_, i) => i !== idxRef.current);
        for (let i = rest.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        setQueue([cur, ...rest]);
        setIdx(0);
      } else {
        const orig = originalQueueRef.current;
        if (orig.length > 0) {
          const cur = queueRef.current[idxRef.current];
          const newIdx = orig.indexOf(cur);
          setQueue(orig);
          setIdx(newIdx >= 0 ? newIdx : 0);
          originalQueueRef.current = [];
        }
      }
      return next;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    if (spotifyRef.current && trackRef.current?.spotifyUri) {
      const next = ((repeatRef.current + 1) % 3) as 0 | 1 | 2;
      const modes = ["off", "context", "track"] as const;
      void setRepeatModeApi(modes[next]);
      return;
    }
    setRepeat((r) => ((r + 1) % 3) as 0 | 1 | 2);
  }, []);

  const setVolume = useCallback((fraction: number) => {
    const clamped = Math.max(0, Math.min(1, fraction));
    setVolumeState(clamped);
    if (spotifyRef.current) {
      void spotifyRef.current.player.setVolume(clamped);
    }
  }, []);

  // Keep Media Session handler refs pointing to the latest callbacks.
  nextCbRef.current = next;
  prevCbRef.current = prev;
  seekCbRef.current = seek;

  // Up Next: server queue (accurate after server-side shuffle/radio) > local
  const upNext: UpNextTrack[] =
    serverUpNext.length > 0 && engine === "sdk"
      ? serverUpNext
      : Array.from({ length: Math.min(2, queue.length - 1) }, (_, i) => {
          const t = queue[(idx + i + 1) % queue.length];
          return { title: t.title, artist: t.artist, imageUrl: t.imageUrl };
        });

  const disallows = engine === "sdk" ? spotify?.sdkState?.disallows : null;
  const prevDisabled = Boolean(disallows?.skipping_prev);
  const nextDisabled = Boolean(disallows?.skipping_next);

  return {
    queue,
    idx,
    track,
    upNext,
    playing,
    time,
    fav,
    shuffle,
    repeat,
    started,
    volume,
    prevDisabled,
    nextDisabled,
    play,
    toggle,
    next,
    prev,
    seek,
    toggleFav,
    toggleShuffle,
    cycleRepeat,
    setVolume,
  };
}
