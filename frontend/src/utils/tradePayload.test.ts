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
    })

    expect(payload.symbol).toBe('AAPL')
    expect(payload.market).toBe('STOCK')
    expect(payload.direction).toBe('LONG')
    expect(payload.status).toBe('OPEN')
    expect(payload.closedAt).toBeNull()
    expect(payload.exitPrice).toBeNull()
    expect(payload.openedAt).toBe('2024-05-05T10:00:00.000Z')
  })
})
