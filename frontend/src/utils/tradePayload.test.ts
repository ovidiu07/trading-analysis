import { describe, expect, it } from 'vitest'
import { buildTradePayload } from './tradePayload'

describe('buildTradePayload', () => {
  it('maps minimal open trade payload correctly', () => {
    const payload = buildTradePayload({
      symbol: 'AAPL',
      market: 'STOCK',
      direction: 'LONG',
      status: 'OPEN',
      openedAt: '2024-05-05T10:00',
      quantity: 10,
      entryPrice: 120.5
    }, 'Europe/Bucharest')

    expect(payload.symbol).toBe('AAPL')
    expect(payload.market).toBe('STOCK')
    expect(payload.direction).toBe('LONG')
    expect(payload.status).toBe('OPEN')
    expect(payload.closedAt).toBeNull()
    expect(payload.exitPrice).toBeNull()
    expect(payload.openedAt).toBe('2024-05-05T07:00:00.000Z')
  })

  it('uses the same timezone conversion for create and update payloads', () => {
    const formValues = {
      symbol: 'EURUSD',
      market: 'FOREX' as const,
      direction: 'LONG' as const,
      status: 'CLOSED' as const,
      openedAt: '2026-07-16T14:35',
      closedAt: '2026-07-16T15:17',
      quantity: 1,
      entryPrice: 1.16,
      exitPrice: 1.17
    }

    const createPayload = buildTradePayload(formValues, 'Europe/Bucharest')
    const updatePayload = buildTradePayload({ ...formValues }, 'Europe/Bucharest')

    expect(createPayload.openedAt).toBe('2026-07-16T11:35:00.000Z')
    expect(createPayload.closedAt).toBe('2026-07-16T12:17:00.000Z')
    expect(updatePayload.openedAt).toBe(createPayload.openedAt)
    expect(updatePayload.closedAt).toBe(createPayload.closedAt)
  })

  it('keeps closedAt null for an open trade', () => {
    const payload = buildTradePayload({
      symbol: 'AAPL',
      market: 'STOCK',
      direction: 'LONG',
      status: 'OPEN',
      openedAt: '2026-01-16T14:35',
      quantity: 1,
      entryPrice: 100
    }, 'Europe/Bucharest')

    expect(payload.openedAt).toBe('2026-01-16T12:35:00.000Z')
    expect(payload.closedAt).toBeNull()
  })
})
