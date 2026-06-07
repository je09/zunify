// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PlaylistDetail } from './PlaylistDetail'
import type { Playlist, Track } from '../data'

const track = (index: number): Track => ({
  title: `Track ${index}`,
  artist: 'Artist',
  album: 'Album',
  dur: 180,
  color: '#333',
  spotifyUri: `spotify:track:${index}`,
})

const playlist: Playlist = {
  id: 'sp_liked',
  name: 'liked songs',
  items: [],
  tracks: [track(1), track(2), track(3)],
  totalTracks: 3,
}

describe('PlaylistDetail virtual rows', () => {
  it('positions playlist rows at distinct vertical offsets', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(<PlaylistDetail playlist={playlist} onPlay={vi.fn()} onBack={vi.fn()} />)
    })

    const rows = [...host.querySelectorAll<HTMLElement>('.playlist-virtual-row')]
    expect(rows).toHaveLength(3)
    expect(rows.map(row => row.style.transform)).toEqual([
      'translateY(0px)',
      'translateY(73px)',
      'translateY(146px)',
    ])

    root.unmount()
    host.remove()
  })

  it('keeps list entrance animation from overriding virtual row transforms', () => {
    const css = readFileSync(`${process.cwd()}/src/index.css`, 'utf8')

    expect(css).toContain('.playlist-virtual-row,\n.collection-virtual-row { animation: none !important; }')
  })
})
