import { useEffect, useState } from 'react'
import { Album, Track } from '../data'
import { fetchNewReleases, getRecentlyPlayed } from '../spotifyApi'

interface HubData {
  newReleases: Album[]
  recentTracks: Track[]
  loaded: boolean
}

const RELEASES_TTL = 2 * 60 * 60 * 1000
const CACHE_KEY = 'hub_releases_v1'

function readReleasesCache(): { data: Album[]; stale: boolean } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, at } = JSON.parse(raw) as { data: Album[]; at: number }
    return { data, stale: Date.now() - at > RELEASES_TTL }
  } catch { return null }
}

function writeReleasesCache(data: Album[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, at: Date.now() })) } catch {}
}

export function useHubData(token: string | null): HubData {
  const [home, setHome] = useState<HubData>({ newReleases: [], recentTracks: [], loaded: false })

  useEffect(() => {
    if (!token) {
      setHome({ newReleases: [], recentTracks: [], loaded: false })
      return
    }
    let cancelled = false
    const cached = readReleasesCache()

    if (cached) {
      setHome(prev => ({ ...prev, newReleases: cached.data, loaded: true }))
    }

    const needsFetch = !cached || cached.stale
    const releasesFetch = needsFetch
      ? fetchNewReleases(8).then(r => { writeReleasesCache(r); return r })
      : Promise.resolve(cached.data)

    Promise.all([releasesFetch, getRecentlyPlayed({ limit: 20 })]).then(([newReleases, recentPage]) => {
      if (cancelled) return
      setHome({ newReleases, recentTracks: recentPage.items.map(h => h.track as Track), loaded: true })
    }).catch(() => {
      if (!cancelled) setHome(prev => ({ ...prev, loaded: true }))
    })
    return () => { cancelled = true }
  }, [token])

  return home
}
