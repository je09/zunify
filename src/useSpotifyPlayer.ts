// Spotify Web Playback SDK wrapper.
// Loads the CDN script once, creates a Spotify.Player, and exposes a clean
// SpotifyEngine interface.  usePlayback() consumes this — the UI never
// touches the SDK directly.

import { useState, useEffect, useRef } from 'react'
import { getValidToken } from './features/auth/spotifyAuth'
import { setShuffleState, startPlayback, transferPlayback } from './features/spotify/playerApi'

// ── Engine abstraction ────────────────────────────────────────────────────────

export interface SpotifyEngine {
  player: Spotify.Player
  deviceId: string
  sdkState: Spotify.PlaybackState | null
  startPlayback: (uris: string[], offsetIndex: number) => Promise<void>
  startPlaybackContext: (contextUri: string, offsetPosition: number) => Promise<void>
  setShuffle: (state: boolean) => Promise<void>
}

// ── SDK loader (singleton) ────────────────────────────────────────────────────

let sdkPromise: Promise<void> | null = null

function loadSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise
  if (window.Spotify) return (sdkPromise = Promise.resolve())
  sdkPromise = new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = resolve
    const s = document.createElement('script')
    s.src = 'https://sdk.scdn.co/spotify-player.js'
    s.onerror = () => {
      sdkPromise = null
      reject(new Error('Spotify Web Playback SDK failed to load'))
    }
    document.head.appendChild(s)
  })
  return sdkPromise
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSpotifyPlayer(
  enabled: boolean,
  onAuthFailed?: () => void,
  onError?: (msg: string) => void,
): SpotifyEngine | null {
  const [engine, setEngine] = useState<SpotifyEngine | null>(null)
  const playerRef = useRef<Spotify.Player | null>(null)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      playerRef.current?.disconnect()
      playerRef.current = null
      if (pollRef.current !== null) window.clearInterval(pollRef.current)
      pollRef.current = null
      setEngine(null)
      return
    }

    let live = true

    const stopPolling = () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current)
      pollRef.current = null
    }

    const setSdkState = (state: Spotify.PlaybackState | null) => {
      if (!live) return
      setEngine(prev => (prev ? { ...prev, sdkState: state } : null))
    }

    loadSdk().then(() => {
      if (!live) return

      const player = new window.Spotify.Player({
        name: 'zPlayer',
        enableMediaSession: true,
        getOAuthToken: (cb) => {
          void getValidToken().then(t => {
            if (t) { cb(t); return }
            // Token fetch returned null — refresh failed or tokens cleared.
            // Signal the app so it can log the user out rather than leaving
            // the SDK hung waiting for a token that will never arrive.
            onAuthFailed?.()
          })
        },
        volume: 0.8,
      })
      playerRef.current = player

      player.addListener('ready', ({ device_id }) => {
        if (!live) return

        void transferPlayback(device_id).catch(e => onError?.(`Spotify transfer failed: ${e instanceof Error ? e.message : String(e)}`))

        const playUris = async (uris: string[], offsetIndex: number): Promise<void> => {
          const token = await getValidToken()
          if (!token || uris.length === 0) return
          await startPlayback({ uris, offset: { position: Math.max(0, offsetIndex) } }, device_id)
        }

        const playContext = async (contextUri: string, offsetPosition: number): Promise<void> => {
          const token = await getValidToken()
          if (!token || !contextUri) return
          await startPlayback({ context_uri: contextUri, offset: { position: Math.max(0, offsetPosition) } }, device_id)
        }

        const setShuffle = async (state: boolean): Promise<void> => {
          await setShuffleState(state, device_id)
        }

        setEngine(prev => ({
          player,
          deviceId: device_id,
          sdkState: prev?.sdkState ?? null,
          startPlayback: playUris,
          startPlaybackContext: playContext,
          setShuffle,
        }))

        stopPolling()
        pollRef.current = window.setInterval(() => {
          void player.getCurrentState().then(setSdkState).catch(() => {})
        }, 1000)
      })

      player.addListener('player_state_changed', (state) => {
        if (!live) return
        setSdkState(state)
        // Override the SDK iframe's ms-based setPositionState immediately with
        // correct seconds so the top-level session wins the race on iOS lockscreen.
        if (state && 'mediaSession' in navigator && state.duration > 0) {
          const dur = state.duration / 1000
          const pos = Math.min(Math.max(0, state.position / 1000), dur)
          try { navigator.mediaSession.setPositionState({ duration: dur, playbackRate: 1, position: pos }) } catch {}
        }
      })

      player.addListener('not_ready', () => {
        stopPolling()
        if (live) setEngine(null)
      })

      player.addListener('account_error', () => {
        // Non-premium account: SDK can't do full-track playback.
        onError?.('Spotify Premium required for full-track playback.')
      })

      player.addListener('initialization_error', ({ message }) => {
        onError?.(`Spotify player failed to initialise: ${message}`)
      })

      player.addListener('authentication_error', () => {
        // Auth rejected by Spotify — force logout so the user can reconnect.
        onAuthFailed?.()
      })

      void player.connect()
    }).catch(e => {
      if (live) onError?.(e instanceof Error ? e.message : String(e))
    })

    return () => {
      live = false
      stopPolling()
      playerRef.current?.disconnect()
      playerRef.current = null
      setEngine(null)
    }
  }, [enabled, onAuthFailed, onError])

  return engine
}
