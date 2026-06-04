import { getValidToken } from '../auth/spotifyAuth'

export const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

export type SpotifyMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type SpotifyParams = Record<string, string | number | boolean>

function spotifyUrl(path: string, params?: SpotifyParams): string {
  const url = new URL(path.startsWith('http') ? path : `${SPOTIFY_API_BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  }
  return url.toString()
}

export async function spotifyRequest<T>(method: SpotifyMethod, path: string, body?: unknown, params?: SpotifyParams, attempt = 0): Promise<T> {
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
    if (attempt >= 4) throw new Error('spotify_rate_limited')
    const wait = parseInt(res.headers.get('Retry-After') ?? String(2 ** attempt), 10)
    await new Promise(r => setTimeout(r, wait * 1000))
    return spotifyRequest<T>(method, path, body, params, attempt + 1)
  }

  if (!res.ok) throw new Error(`spotify_${res.status}`)
  const text = await res.text()
  if (!text) return undefined as T
  return (res.headers.get('Content-Type')?.includes('application/json') ? JSON.parse(text) : text) as T
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
