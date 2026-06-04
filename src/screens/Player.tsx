import { useState } from "react";
import { PlaybackState } from "../hooks/usePlayback";
import { fmt } from "../data";
import { Icons } from "../components/icons";
import { ProgressBar, useSwipe } from "../components/Pivot";
import { useLibrary } from "../LibraryContext";
import { openContextMenu } from "../components/ContextMenu";

interface Props {
  pb: PlaybackState;
  onBack: () => void;
  onGoToAlbum?: () => void;
  onGoToArtist?: () => void;
  controls?: "top" | "bottom";
}

export function Player({
  pb,
  onBack,
  onGoToAlbum,
  onGoToArtist,
  controls = "top",
}: Props) {
  const {
    track,
    upNext,
    playing,
    time,
    fav,
    shuffle,
    repeat,
    duration,
    prevDisabled,
    nextDisabled,
    toggle,
    next,
    prev,
    seek,
    toggleFav,
    toggleShuffle,
    cycleRepeat,
  } = pb;
  const { likedTrackUris } = useLibrary();
  const [previewTime, setPreviewTime] = useState<number | null>(null);

  if (!track) return null;

  const displayTime = previewTime ?? time;
  const pct = duration > 0 ? Math.min(100, (displayTime / duration) * 100) : 0;
  const repeatState = repeat === 0 ? "outline" : "on";
  const isLiked =
    fav || Boolean(track.spotifyUri && likedTrackUris.has(track.spotifyUri));
  const swipe = useSwipe(onBack, () => {});
  const tint = `radial-gradient(125% 95% at 28% 16%, ${track.color}66 0%, #0c0c0c 60%, #060606 100%)`;

  const transport = (
    <div className={"transport" + (controls === "bottom" ? " bottom" : "")}>
      <button
        className={"tbtn" + (prevDisabled ? " tbtn-disabled" : "")}
        onClick={prevDisabled ? undefined : prev}
        aria-label="Previous"
      >
        {Icons.prev}
      </button>
      <button
        className="tbtn mid"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? Icons.pause : Icons.play}
      </button>
      <button
        className={"tbtn" + (nextDisabled ? " tbtn-disabled" : "")}
        onClick={nextDisabled ? undefined : next}
        aria-label="Next"
      >
        {Icons.next}
      </button>
    </div>
  );

  return (
    <div className="np" ref={swipe}>
      <div className="np-tint" style={{ background: tint }} />
      {track.imageUrl && (
        <div className="np-bg-slot">
          <img src={track.imageUrl} alt="" />
        </div>
      )}
      <div className="np-scrim" />
      <div className={"np-content controls-" + controls}>
        {controls === "top" && transport}

        <div className="meta swap" key={"m" + track.title}>
          <div className="artist">{track.artist}</div>
          <div className="album">{track.album}</div>
        </div>

        <div className="artrow">
          <div className="art">
            <div
              className="art-color swap"
              key={"a" + track.title}
              style={{ background: track.color }}
            />
            {track.imageUrl && (
              <img
                className="art-img"
                src={track.imageUrl}
                alt=""
                decoding="async"
              />
            )}
          </div>
          <div className="sideicons">
            <button
              className={"iconbtn " + (isLiked ? "on" : "outline")}
              onClick={toggleFav}
              aria-label="Favourite"
            >
              {Icons.heart}
            </button>
            <button
              className={"iconbtn " + (shuffle ? "on" : "")}
              onClick={toggleShuffle}
              aria-label="Shuffle"
            >
              {Icons.shuffle}
            </button>
            <button
              className={"iconbtn " + repeatState}
              onClick={cycleRepeat}
              aria-label="Repeat"
            >
              {repeat === 2 ? Icons.repeat1 : Icons.repeat}
            </button>
          </div>
        </div>

        <ProgressBar
          pct={pct}
          onSeek={(f) => {
            setPreviewTime(null);
            seek(f);
          }}
          onPreviewSeek={(f) => setPreviewTime(f * duration)}
          onPreviewEnd={() => setPreviewTime(null)}
        />
        <div className="times">
          <span className="elapsed">{fmt(displayTime)}</span>
          <span className="remain">
            {duration > 0 ? `-${fmt(duration - displayTime)}` : ""}
          </span>
        </div>

        <div className="track swap" key={"t" + track.title}>
          <div className="title">{track.title}</div>
          {upNext.length > 0 && (
            <div className="upnext">
              {upNext.map((t, i) => (
                <div key={i}>{t.title}</div>
              ))}
            </div>
          )}
        </div>

        {controls === "bottom" && transport}

        <div className="appbar">
          <button
            className="iconbtn appback"
            onClick={onBack}
            aria-label="Back"
          >
            {Icons.back}
          </button>
          <button
            className="ellipsis"
            aria-label="More options"
            onClick={(e) =>
              openContextMenu({
                items: [
                  {
                    label: isLiked
                      ? "remove from favourites"
                      : "add to favourites",
                    onClick: toggleFav,
                  },
                  ...(onGoToArtist
                    ? [{ label: "go to artist", onClick: onGoToArtist }]
                    : []),
                  ...(onGoToAlbum
                    ? [{ label: "go to album", onClick: onGoToAlbum }]
                    : []),
                  { label: "share" },
                  { label: "pin to start" },
                  { label: "add to a playlist" },
                ],
                origin: { x: e.clientX, y: e.clientY },
              })
            }
          >
            <i />
            <i />
            <i />
          </button>
        </div>
      </div>
    </div>
  );
}
