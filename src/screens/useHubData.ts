import { useEffect, useState } from 'react'
import { Album, Track } from '../data'
import { fetchNewReleases, getRecentlyPlayed } from '../spotifyApi'

interface HubData {
  newReleases: Album[]
  recentTracks: Track[]
  loaded: boolean
}

export function useHubData(token: string | null): HubData {
  const [home, setHome] = useState<HubData>({ newReleases: [], recentTracks: [], loaded: false })

  useEffect(() => {
    if (!token) return
    let cancelled = false
    Promise.all([
      fetchNewReleases(8),
      getRecentlyPlayed({ limit: 20 }),
    ]).then(([newReleases, recentPage]) => {
      if (cancelled) return
      setHome({ newReleases, recentTracks: recentPage.items.map(h => h.track as Track), loaded: true })
    }).catch(() => {
      if (!cancelled) setHome(prev => ({ ...prev, loaded: true }))
    })
    return () => { cancelled = true }
  }, [token])

  return home
}
