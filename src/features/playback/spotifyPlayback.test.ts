import { describe, expect, it } from 'vitest'
import { Track } from '../../data'
import { buildSpotifyPlayCommand } from './spotifyPlayback'

const track = (title: string, spotifyUri?: string): Track => ({
  title,
  dur: 60,
  artist: 'Artist',
  album: 'Album',
  color: '#555',
  spotifyUri,
})

describe('spotifyPlayback', () => {
  it('starts album-detail playback by Spotify album context and selected offset', () => {
    const queue = [
      track('album one', 'spotify:track:a1'),
      track('album two', 'spotify:track:a2'),
    ]

    expect(buildSpotifyPlayCommand(queue, 1, 'spotify:album:album-a')).toEqual({
      type: 'context',
      contextUri: 'spotify:album:album-a',
      offset: { uri: 'spotify:track:a2' },
    })
  })

  it('falls back to context position when the selected track has no Spotify URI', () => {
    const queue = [
      track('album one', 'spotify:track:a1'),
      track('album two'),
    ]

    expect(buildSpotifyPlayCommand(queue, 1, 'spotify:album:album-a')).toEqual({
      type: 'context',
      contextUri: 'spotify:album:album-a',
      offset: { position: 1 },
    })
  })

  it('builds a fresh playlist URI window after album-context playback', () => {
    const albumQueue = [track('album one', 'spotify:track:a1')]
    const playlistQueue = [
      track('playlist one', 'spotify:track:p1'),
      track('playlist two', 'spotify:track:p2'),
      track('playlist three', 'spotify:track:p3'),
    ]

    expect(buildSpotifyPlayCommand(albumQueue, 0, 'spotify:album:album-a')?.type).toBe('context')
    expect(buildSpotifyPlayCommand(playlistQueue, 1)).toEqual({
      type: 'uris',
      uris: ['spotify:track:p2', 'spotify:track:p3', 'spotify:track:p1'],
      offsetIndex: 0,
    })
  })

  it('does not create local fallback playback for tracks without Spotify URIs', () => {
    expect(buildSpotifyPlayCommand([track('preview only')], 0)).toBeNull()
  })
})
