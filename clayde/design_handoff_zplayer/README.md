# Handoff: zPlayer — Windows Phone 8 "Music + Videos" / Xbox Music recreation

## Overview
zPlayer is a faithful recreation of the Windows Phone 8 music experience (the "Music + Videos" hub / Xbox Music app) in its **Metro / Modern** design language. It is a single, fully-interactive phone-screen prototype (480 × 800 logical px) covering the complete browse-and-play flow:

**Hub (home panorama)** → **Collection pivot** → **Artist card** → **Album detail** → **Now Playing**, with a live playback engine shared across every screen.

It is branded generically as "zPlayer / music" — it intentionally does **not** use Microsoft trademarks (no Xbox/Windows logos or "Xbox Music" wordmark). Keep it that way in any reproduction.

## About the Design Files
The files in this bundle are **design references created in HTML/CSS + React (via in-browser Babel)** — a prototype showing the intended look and behavior. They are **not** production code to drop in.

The task is to **recreate these designs in your target codebase using its established environment and patterns** (React Native, native iOS/Android, Vue, Flutter, etc.). If no environment exists yet, pick the framework best suited to the project. Reproduce the visuals pixel-for-pixel; re-implement the interactions idiomatically.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, motion, and interactions are all specified below and visible in the prototype. Recreate the UI pixel-perfectly.

---

## Global System

### Canvas & scaling
- Design canvas is a fixed **480 × 800** "screen" (WP WVGA logical size). In the prototype it is centered on a dark studio backdrop and uniformly `transform: scale()`-d to fit the viewport. In a real app this maps to the device screen.
- No OS status bar is drawn (intentionally removed). Content uses the full 800px height.

### Typography
- Font stack: `"Segoe UI", "Segoe WP", "Helvetica Neue", Arial, sans-serif`. The Metro look depends on **light weights** — use 200–300 wherever possible.
- Key sizes (px) / weights:
  - Panorama title ("music"): **92 / 200**, letter-spacing −2px
  - Pivot headers ("artists", "albums"…): **42 / 250**, letter-spacing −0.5px; active = full opacity, inactive = opacity 0.32
  - Pane/section heads ("now playing", "collection"): **40 / 250**
  - Now-playing artist: **46 / 250**, line-height .98, letter-spacing −0.5
  - Now-playing album / track titles: **27–30 / 300**
  - List item primary (artist name, song title, hub menu): **24–31 / 300**
  - List item secondary (sub/artist/year): **16–18 / 300**, color = `--dim`
  - Section labels ("all music", "in collection", "store"): **18 / 600**, color = `--accent`, lowercase
  - Overline ("MUSIC", artist name): **14 / 600**, UPPERCASE, letter-spacing 1.5px

### Color tokens
Theme is switchable (dark default / light). CSS custom properties:

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#000000` | `#fafafa` |
| `--fg` | `#ffffff` | `#0a0a0a` |
| `--dim` | `rgba(255,255,255,.55)` | `rgba(0,0,0,.5)` |
| `--line` (rules, progress track) | `rgba(255,255,255,.22)` | `rgba(0,0,0,.18)` |

**Accent** (`--accent`) — default **`#5ca800`** (Xbox/WP green). The accent drives: progress fill, section labels, letter/index tiles, album group-header bars, artist/genre/radio list text, active toggle icons. User-selectable options (WP theme palette): `#5ca800` (green), `#1ba1e2` (cyan), `#a4c400` (lime), `#d80073` (magenta), `#fa6800` (orange), `#6a00ff` (violet).

**Album cover colors** — each album has a solid placeholder color used everywhere its art appears (collection thumb, artist card, album head, now-playing art). These stand in for real cover art; a real app would use the actual artwork.
`Reflektor #b0392f` · `Tomorrow's Harvest #6d7b53` · `The Bones of What You Believe #7a3fb0` · `Blonde #c8771a` · `Random Access Memories #2f6fb0` · `Pure Heroine #3a8f6b` · `Hurry Up, We're Dreaming #c43b6b` · `Lonerism #cf8a1e` · `Coexist #46506b`.

### Spacing & layout
- Standard screen side padding: **26px**.
- Circular transport buttons: 66px (fullscreen) / 58px (hub pane), 2px outline in `--fg`, glyph filled `--fg`.
- App-bar circle buttons (`ic-btn`): 48px, 2px outline.
- Letter/index tiles: 46px solid `--accent` square, white letter bottom-left.
- Album group-header bar: solid `--accent`, white text, 7×14 padding.
- No rounded corners anywhere except the circular buttons — Metro is hard-edged.

### Motion
- Screen entrance: `translateX(24px) → 0`, 340ms `cubic-bezier(.2,.7,.3,1)`. **Important:** animate transform only — the visible end-state must be the base style (no opacity:0 with fill-mode, or the screen can get stuck blank when the tab is backgrounded).
- Now-playing text/art swap on track change: `translateY(12px) → 0`, 320ms.
- All gated behind `@media (prefers-reduced-motion: no-preference)`.
- Button press: `scale(.88–.92)`.

---

## Screens / Views

### 1. Hub (home panorama) — default screen
Horizontal **panorama**: a big parallax title ("music") fixed at top-left that translates at **0.45×** the horizontal scroll offset, over a full-bleed background image (user-droppable artist photo) with a top/bottom dark scrim gradient. Below it, a horizontally-scrollable strip of **panes** (each 446px wide → the next pane "peeks" ~34px at the right edge; **free pan, no scroll-snap**). App bar pinned at bottom: shuffle-all circle + search circle on the left, "…" ellipsis on the right.

- **"now playing" pane** — only present when something has started playing; it is the **first** pane. Contains: "now playing" head, album-color art (tap → fullscreen Now Playing), a vertical icon column (shuffle / repeat / queue), a green progress bar with elapsed + remaining (−) times, track title + "by {artist}", and a compact prev / play-pause / next transport row.
- **"collection" pane** — "collection" head + a vertical text menu: **artists · albums · songs · genres · playlists · radio**. Each opens the Collection pivot at that tab.

### 2. Collection (pivot)
Overline "MUSIC" + a horizontally-scrollable **pivot** header (`artists · albums · songs · genres · playlists · radio`). Active header full-opacity at left, others dimmed; the header strip auto-scrolls the active tab to the left and is also free-scrollable. Content area swipes left/right to change tabs (drag threshold 55px, horizontal-dominant). Top-left back chevron → Hub.

- **artists** — green section "all music", then alphabetical **letter tiles** (ignoring leading "The") and rows: a **circular play button** (plays the artist's tracks) + the artist name (tap → Artist card).
- **albums** — grouped by artist: `--accent` header bar (tap → Artist card) + a row of [color thumb 88px] [album title / year] (tap → Album detail).
- **songs** — alphabetical letter tiles + rows: circular play button + [title / artist].
- **genres** — green section + a list of genre names in `--accent`.
- **playlists** — rows: a **2×2 color mosaic** thumb (88px, four album colors) + [playlist name / "N songs"]; tap plays the playlist.
- **radio** — green "smart dj" section + rows: circular play button + "{artist} radio".

### 3. Artist card
Overline = ARTIST NAME, faded full-bleed artist photo (droppable) + scrim, pivot `albums · songs`, back chevron.
- **albums** tab: green "in collection" section, album entries [color thumb 104px][title/artist] (tap → Album detail); green "store" section with a circular download button + "more from {artist}".
- **songs** tab: every track by the artist as a row (circular play button + [title / album]).

### 4. Album detail
Overline = artist, pivot `songs · review`, back chevron.
- **songs**: header [color thumb 132px] + album title + artist + outlined "play" pill; then a numbered track list ([index][title][duration]) with hairline `--line` dividers. Any row or "play" → Now Playing.
- **review**: thumb + a short blurb paragraph + a 4/5 star row (filled = `--accent`).

### 5. Now Playing (fullscreen)
Top: prev / play-pause / next circular transport. Then large artist + album. Then [album-color art 156px] beside a vertical icon column (favorite heart / shuffle / repeat). Then a `--accent` progress bar (click-to-seek) with elapsed + remaining(−). Then current track title + the next two queued titles (dimmed "up next"). Bottom app bar: back chevron + "…". Reached from any play action; back returns to the originating screen.

---

## Interactions & Behavior
- **Playback engine** (shared across all screens): a single source of truth holds `queue`, `idx`, `playing`, `time`, `fav`, `shuffle`, `repeat (0 off / 1 all / 2 one)`, `started`. A `requestAnimationFrame` loop advances `time` while playing; on track end it repeats-one, or advances (random next when shuffle on), else stops at queue end. `prev` restarts the track if `time > 3s`, otherwise goes to the previous track. Progress bar is click-to-seek. The hub now-playing pane and the fullscreen player are two views of this same state — they stay in sync.
- **Navigation**: Hub menu → Collection(tab); Collection → Artist card / Album detail / Now Playing; Artist card → Album detail / Now Playing; Album detail → Now Playing. A back chevron (top-left on sub-screens, bottom app-bar on Now Playing) unwinds the stack; Collection → Hub. Playing anything sets `started`, which makes the hub now-playing pane appear.
- **Pivot**: click a header or swipe content horizontally to change tabs; active tab auto-scrolls into view.
- **Panorama**: free horizontal pan; title parallaxes at 0.45×.
- **Toggles**: favorite (heart fill), shuffle, repeat (off→all→one, "1" badge on the glyph) — active state colors the glyph `--accent`.
- **Theme/Accent**: live-switchable via the Tweaks panel (see below).

## State Management
- Global playback state (the hook described above) — lifted so the hub pane and fullscreen player share it.
- Router state: `screen` (`home | collection | artist | album | nowplaying`), plus `colTab`, selected `artist`, selected `album`, and a small back-stack (`backTo`, `prevScreen`).
- Per-component UI state: active pivot tab; per-row "downloaded" toggle on store/top rows.
- Data is static in-memory (`ALBUMS` with nested tracks; `ARTISTS`, `SONGS`, `GENRES`, `PLAYLISTS` derived from it). In a real app, replace with the library/streaming data layer.

## Design Tokens
See **Color tokens**, **Typography**, **Spacing & layout**, **Motion** above. Summary of the non-color numbers a developer needs: side padding 26px; transport circles 66/58px; app-bar circles 48px; letter tiles 46px; thumbs 88/104/132/156px; pane width 446px; parallax factor 0.45; entrance 340ms / swap 320ms `cubic-bezier(.2,.7,.3,1)`; swipe threshold 55px.

## Assets
- **No raster assets shipped.** Album/playlist art are solid color placeholders (colors listed above) — substitute real cover artwork.
- **Icons** are inline SVG glyphs drawn in code: prev, next, play, pause, heart, shuffle, repeat (+ "1" variant), queue, back, search, download, play-circle. Replace with your icon system's equivalents (Segoe MDL2 / your set).
- **Background photos** (hub + artist card) are user-droppable image slots; in a real app these are the artist images from your catalog.
- **Fonts**: Segoe UI/WP. If unavailable on your platform, substitute a clean neutral grotesque and keep the light weights.

## Files
All under this handoff folder (copied from the prototype project):
- `zPlayer — Now Playing.html` — the shell: all CSS (design tokens, every screen's styles), the scaling script, and script includes. **The CSS here is the source of truth for visual specs.**
- `app.jsx` — playback hook (`usePlayback`), fullscreen `Player`, hub `NowPlayingPane`, the `App` router, icon set, accent/theme tokens.
- `collection.jsx` — library data (`ALBUMS` etc.), the `Pivot` + swipe helpers, `Hub`, `Collection`, `ArtistCard`, `AlbumDetail`, `PlaylistRow`.
- `tweaks-panel.jsx` — the in-prototype "Tweaks" panel (accent + dark/light). This is a prototyping affordance, **not** part of the product UI — ignore for production.
- `image-slot.js` — droppable image placeholder web component used for the hub/artist backgrounds (prototyping affordance).

To run the prototype: open the HTML file in a browser. To read the exact styles, open the `<style>` block in the HTML.
