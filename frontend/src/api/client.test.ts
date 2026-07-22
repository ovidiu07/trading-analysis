import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiPostMultipart } from './client'

const fetchMock = vi.fn()
global.fetch = fetchMock

const response = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 401 ? 'Unauthorized' : 'OK',
  text: async () => JSON.stringify(body)
}) as Response

describe('multipart API authentication', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it('retries a multipart request with the refreshed bearer token', async () => {
    localStorage.setItem('token', 'expired-token')
    fetchMock
      .mockResolvedValueOnce(response(401, { message: 'Expired token' }))
      .mockResolvedValueOnce(response(200, { token: 'fresh-token' }))
      .mockResolvedValueOnce(response(200, { importBatchId: 'batch-1' }))

    const result = await apiPostMultipart<{ importBatchId: string }>('/trade-imports/metatrader5/preview', new FormData())

    expect(result.importBatchId).toBe('batch-1')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer expired-token')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/auth/refresh')
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer fresh-token')
    expect(fetchMock.mock.calls[2][1].headers['Content-Type']).toBeUndefined()
  })
})
