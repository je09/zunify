// Spotify Web Playback SDK wrapper.
// Loads the CDN script once, creates a Spotify.Player, and exposes a clean
// SpotifyEngine interface.  usePlayback() consumes this — the UI never
// touches the SDK directly.

import { useState, useEffect, useRef } from 'react'
import { getValidToken } from './spotifyAuth'

// ── Engine abstraction ────────────────────────────────────────────────────────

export interface SpotifyEngine {
  player: Spotify.Player
  deviceId: string
  sdkState: Spotify.PlaybackState | null
  startPlayback: (uris: string[], offsetIndex: number) => Promise<void>
}

// ── SDK loader (singleton) ────────────────────────────────────────────────────

let sdkPromise: Promise<void> | null = null

function loadSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise
  if (window.Spotify) return (sdkPromise = Promise.resolve())
  sdkPromise = new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = resolve
    const s = document.createElement('script')
    s.src = 'https://sdk.scdn.co/spotify-player.js'
    document.head.appendChild(s)
  })
  return sdkPromise
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSpotifyPlayer(enabled: boolean): SpotifyEngine | null {
  const [engine, setEngine] = useState<SpotifyEngine | null>(null)
  const playerRef = useRef<Spotify.Player | null>(null)

  useEffect(() => {
    if (!enabled) {
      playerRef.current?.disconnect()
      playerRef.current = null
      setEngine(null)
      return
    }

    let live = true

    loadSdk().then(() => {
      if (!live) return

      const player = new window.Spotify.Player({
        name: 'zPlayer',
        getOAuthToken: (cb) => { void getValidToken().then(t => { if (t) cb(t) }) },
        volume: 0.8,
      })
      playerRef.current = player

      player.addListener('ready', ({ device_id }) => {
        if (!live) return

        const startPlayback = async (uris: string[], offsetIndex: number): Promise<void> => {
          const token = await getValidToken()
          if (!token || uris.length === 0) return
          await fetch(
            `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                uris,
                offset: { position: Math.max(0, offsetIndex) },
              }),
            }
          )
        }

        setEngine(prev => ({
          player,
          deviceId: device_id,
          sdkState: prev?.sdkState ?? null,
          startPlayback,
        }))
      })

      player.addListener('player_state_changed', (state) => {
        if (!live || !state) return
        setEngine(prev => (prev ? { ...prev, sdkState: state } : null))
      })

      player.addListener('not_ready', () => {
        if (live) setEngine(null)
      })

      player.addListener('account_error', ({ message }) => {
        console.warn('Spotify: Premium required for full-track playback.', message)
        // Non-premium: engine stays null, preview_url fallback used
      })

      player.addListener('initialization_error', ({ message }) =>
        console.error('Spotify SDK init error:', message)
      )
      player.addListener('authentication_error', ({ message }) =>
        console.error('Spotify SDK auth error:', message)
      )

      void player.connect()
    })

    return () => {
      live = false
      playerRef.current?.disconnect()
      playerRef.current = null
      setEngine(null)
    }
  }, [enabled])

  return engine
}
