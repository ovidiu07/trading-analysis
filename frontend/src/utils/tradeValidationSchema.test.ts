import { describe, expect, it } from 'vitest'
import { tradeValidationSchema } from './tradeValidationSchema'

describe('tradeValidationSchema', () => {
  it('accepts a minimal open trade payload', () => {
    const result = tradeValidationSchema.safeParse({
      symbol: 'AAPL',
      market: 'STOCK',
      direction: 'LONG',
      status: 'OPEN',
      openedAt: '2026-02-10T10:00',
      quantity: '1,5',
      entryPrice: '123,45'
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.quantity).toBe(1.5)
    expect(result.data.entryPrice).toBe(123.45)
  })

  it('fails when closed trade has no exit price and no closedAt', () => {
    const result = tradeValidationSchema.safeParse({
      symbol: 'AAPL',
      market: 'STOCK',
      direction: 'LONG',
      status: 'CLOSED',
      openedAt: '2026-02-10T10:00',
      quantity: 1,
      entryPrice: 123.45
    })

    expect(result.success).toBe(false)
    if (result.success) return

    const paths = result.error.issues.map((issue) => issue.path.join('.'))
    expect(paths).toContain('exitPrice')
    expect(paths).toContain('closedAt')
  })

  it('fails when quantity is zero', () => {
    const result = tradeValidationSchema.safeParse({
      symbol: 'AAPL',
      market: 'STOCK',
      direction: 'LONG',
      status: 'OPEN',
      openedAt: '2026-02-10T10:00',
      quantity: 0,
      entryPrice: 123.45
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'quantity')).toBe(true)
  })
})
