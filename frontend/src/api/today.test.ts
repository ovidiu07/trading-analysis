import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchFeaturedDailyPlan, fetchFeaturedWeeklyPlan, type FeaturedPlan } from './today'

const fetchMock = vi.fn()

global.fetch = fetchMock

const makeResponse = (status: number, body?: unknown, statusText?: string) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: statusText || (status === 200 ? 'OK' : ''),
  text: async () => {
    if (body === undefined || body === null) return ''
    return typeof body === 'string' ? body : JSON.stringify(body)
  }
}) as unknown as Response

type FeaturedFetcher = (timezone?: string) => Promise<FeaturedPlan | null>

describe.each([
  {
    label: 'daily',
    fetcher: fetchFeaturedDailyPlan,
    queryType: 'daily',
    queryName: 'featuredDailyPlan'
  },
  {
    label: 'weekly',
    fetcher: fetchFeaturedWeeklyPlan,
    queryType: 'weekly',
    queryName: 'featuredWeeklyPlan'
  }
] as const)('$label featured plan query', ({ fetcher, queryType, queryName }: { fetcher: FeaturedFetcher; queryType: string; queryName: string }) => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it('returns null for 404 and 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(404, '', 'Not Found'))
    await expect(fetcher('Europe/Bucharest')).resolves.toBeNull()

    fetchMock.mockResolvedValueOnce(makeResponse(204, '', 'No Content'))
    await expect(fetcher('Europe/Bucharest')).resolves.toBeNull()

    const [calledUrl, calledOptions] = fetchMock.mock.calls[0]
    expect(String(calledUrl)).toContain(`/api/insights/featured?type=${queryType}&tz=Europe%2FBucharest`)
    expect(calledOptions).toEqual(expect.objectContaining({
      method: 'GET',
      credentials: 'include',
      headers: expect.objectContaining({
        'Accept-Language': expect.any(String)
      })
    }))
  })

  it('returns the plan payload for 200 responses', async () => {
    const plan: FeaturedPlan = {
      id: `${queryType}-plan-1`,
      slug: `${queryType}-slug`,
      title: `${queryType} plan`,
      type: queryType.toUpperCase(),
      biasSummary: 'Bias summary',
      primaryModel: 'Breakout',
      keyLevels: ['1.1000'],
      tags: ['trend'],
      symbols: ['EURUSD'],
      weekStart: null,
      weekEnd: null,
      publishedAt: '2026-02-13T00:00:00.000Z',
      updatedAt: '2026-02-13T01:00:00.000Z'
    }
    fetchMock.mockResolvedValueOnce(makeResponse(200, plan, 'OK'))

    await expect(fetcher('Europe/Bucharest')).resolves.toEqual(plan)
  })

  it('throws for 500 responses', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(500, { message: 'boom' }, 'Internal Server Error'))

    await expect(fetcher('Europe/Bucharest')).rejects.toThrow(`${queryName} failed: 500`)
  })
})
