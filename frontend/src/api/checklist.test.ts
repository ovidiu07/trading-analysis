import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchChecklistTemplate, fetchTodayChecklist, saveChecklistTemplate, updateTodayChecklist } from './checklist'

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

describe('checklist api', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it('returns [] when template payload is null', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, null))

    await expect(fetchChecklistTemplate()).resolves.toEqual([])
  })

  it('returns [] when save template payload is missing', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, null))

    await expect(saveChecklistTemplate([])).resolves.toEqual([])
  })

  it('returns today checklist for valid payload', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {
      date: '2026-02-13',
      items: [{ id: 'a', text: 'One', completed: true }]
    }))

    await expect(fetchTodayChecklist('Europe/Bucharest')).resolves.toEqual({
      date: '2026-02-13',
      items: [{ id: 'a', text: 'One', completed: true }]
    })
  })

  it('throws when today payload is invalid', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, { items: [] }))

    await expect(fetchTodayChecklist('Europe/Bucharest')).rejects.toThrow('Invalid today checklist response')
  })

  it('returns updated today checklist for valid update payload', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {
      date: '2026-02-13',
      items: [{ id: 'a', text: 'One', completed: false }]
    }))

    await expect(updateTodayChecklist('2026-02-13', [{ checklistItemId: 'a', completed: false }])).resolves.toEqual({
      date: '2026-02-13',
      items: [{ id: 'a', text: 'One', completed: false }]
    })
  })
})
