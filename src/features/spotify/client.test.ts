import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getValidToken, refreshAccessToken } from '../auth/spotifyAuth'
import { spotifyRequest } from './client'

vi.mock('../auth/spotifyAuth', () => ({
  getValidToken: vi.fn(),
  refreshAccessToken: vi.fn(),
}))

const mockedGetValidToken = vi.mocked(getValidToken)
const mockedRefreshAccessToken = vi.mocked(refreshAccessToken)

describe('spotify client', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockedGetValidToken.mockReset()
    mockedRefreshAccessToken.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('refreshes once after a 401 and retries the request', async () => {
    mockedGetValidToken.mockResolvedValue('token')
    mockedRefreshAccessToken.mockResolvedValue('new-token')
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))

    await expect(spotifyRequest<{ ok: boolean }>('GET', '/me')).resolves.toEqual({ ok: true })

    expect(mockedRefreshAccessToken).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('honors Retry-After after a 429 and retries the request', async () => {
    vi.useFakeTimers()
    mockedGetValidToken.mockResolvedValue('token')
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '1' } }))
      .mockResolvedValueOnce(new Response('{"ok":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))

    const result = spotifyRequest<{ ok: boolean }>('GET', '/me')
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(1010)

    await expect(result).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
