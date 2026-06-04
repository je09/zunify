import { getValidToken, refreshAccessToken } from '../auth/spotifyAuth'

export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

export type SpotifyMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type SpotifyParams = Record<string, string | number | boolean>

// Global queue — max 3 in-flight + global backoff on 429.
// One 429 pauses the entire queue until Retry-After expires.
const MAX_CONCURRENT = 3
let inflight = 0
let backoffUntil = 0
const waitQueue: Array<() => void> = []

function drainQueue() {
  while (inflight < MAX_CONCURRENT && waitQueue.length > 0) {
    inflight++
    waitQueue.shift()!()
  }
}

function acquire(): Promise<void> {
  const remaining = backoffUntil - Date.now()
  if (remaining > 0) {
    return new Promise(resolve =>
      setTimeout(() => acquire().then(resolve), remaining + 10)
    )
  }
  if (inflight < MAX_CONCURRENT) { inflight++; return Promise.resolve() }
  return new Promise(resolve => waitQueue.push(resolve))
}

function release() {
  inflight--
  drainQueue()
}

function setBackoff(ms: number) {
  backoffUntil = Math.max(backoffUntil, Date.now() + ms)
  setTimeout(drainQueue, ms + 10)
}

function spotifyUrl(path: string, params?: SpotifyParams): string {
  const url = new URL(path.startsWith('http') ? path : `${SPOTIFY_API_BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  }
  return url.toString()
}

export async function spotifyRequest<T>(method: SpotifyMethod, path: string, body?: unknown, params?: SpotifyParams, attempt = 0): Promise<T> {
  await acquire()
  let released = false
  const rel = () => { if (!released) { released = true; release() } }

  try {
    const token = await getValidToken()
    if (!token) throw new Error('not_authenticated')
    const res = await fetch(spotifyUrl(path, params), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    if (res.status === 429) {
      const wait = Math.max(1, parseInt(res.headers.get('Retry-After') ?? String(2 ** attempt), 10))
      setBackoff(wait * 1000)
      rel()
      if (attempt >= 4) throw new Error('spotify_rate_limited')
      return spotifyRequest<T>(method, path, body, params, attempt + 1)
    }

    if (res.status === 401 && attempt < 1) {
      rel()
      const refreshed = await refreshAccessToken()
      if (refreshed) return spotifyRequest<T>(method, path, body, params, attempt + 1)
    }

    if (!res.ok) throw new Error(`spotify_${res.status}`)
    const text = await res.text()
    if (!text) return undefined as T
    return (res.headers.get('Content-Type')?.includes('application/json') ? JSON.parse(text) : text) as T
  } finally {
    rel()
  }
}

export async function spotifyGet<T>(path: string): Promise<T> {
  return spotifyRequest<T>('GET', path)
}

export async function spotifyMutate(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  params?: SpotifyParams,
): Promise<void> {
  await spotifyRequest(method, path, body, params)
}

export async function spotifyPost<T>(path: string, body?: unknown, params?: SpotifyParams): Promise<T> {
  return spotifyRequest<T>('POST', path, body, params)
}
