import { useEffect, useState } from 'react'
import { Track } from '../data'
import { getRecentlyPlayed } from '../spotifyApi'

interface HubData {
  recentTracks: Track[]
  loaded: boolean
}

export function useHubData(token: string | null): HubData {
  const [home, setHome] = useState<HubData>({ recentTracks: [], loaded: false })

  useEffect(() => {
    if (!token) {
      setHome({ recentTracks: [], loaded: false })
      return
    }
    let cancelled = false

    getRecentlyPlayed({ limit: 20 }).then(recentPage => {
      if (cancelled) return
      setHome({ recentTracks: recentPage.items.map(h => h.track as Track), loaded: true })
    }).catch(() => {
      if (!cancelled) setHome(prev => ({ ...prev, loaded: true }))
    })
    return () => { cancelled = true }
  }, [token])

  return home
}
