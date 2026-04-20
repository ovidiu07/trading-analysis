import { describe, expect, it } from 'vitest'
import { resolveFuturesContractMetadata, resolveTradeContractMultiplier } from './futuresContractMetadata'

describe('futuresContractMetadata', () => {
  it('resolves MNQ metadata from an expiry symbol', () => {
    expect(resolveFuturesContractMetadata('MNQM6')).toEqual({
      root: 'MNQ',
      displayName: 'Micro E-mini Nasdaq-100',
      contractMultiplier: 2,
      tickSize: 0.25,
      tickValue: 0.5
    })
  })

  it('resolves contract multiplier only for futures markets', () => {
    expect(resolveTradeContractMultiplier('FUTURES', 'MNQM6')).toBe(2)
    expect(resolveTradeContractMultiplier('STOCK', 'MNQM6')).toBeUndefined()
  })

  it('returns undefined when futures metadata is unknown', () => {
    expect(resolveTradeContractMultiplier('FUTURES', 'UNKNOWNM6')).toBeUndefined()
  })
})
