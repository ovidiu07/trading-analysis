import type { TradeRequest } from '../api/trades'

export type FuturesContractMetadata = {
  root: string
  displayName: string
  contractMultiplier: number
  tickSize: number
  tickValue: number
}

const EXPIRY_SUFFIX_RE = /^([A-Z]+)([FGHJKMNQUVXZ])(\d{1,4})$/

const FUTURES_CONTRACTS: Record<string, FuturesContractMetadata> = {
  MNQ: { root: 'MNQ', displayName: 'Micro E-mini Nasdaq-100', contractMultiplier: 2, tickSize: 0.25, tickValue: 0.5 },
  NQ: { root: 'NQ', displayName: 'E-mini Nasdaq-100', contractMultiplier: 20, tickSize: 0.25, tickValue: 5 },
  MES: { root: 'MES', displayName: 'Micro E-mini S&P 500', contractMultiplier: 5, tickSize: 0.25, tickValue: 1.25 },
  ES: { root: 'ES', displayName: 'E-mini S&P 500', contractMultiplier: 50, tickSize: 0.25, tickValue: 12.5 },
  M2K: { root: 'M2K', displayName: 'Micro E-mini Russell 2000', contractMultiplier: 5, tickSize: 0.1, tickValue: 0.5 },
  RTY: { root: 'RTY', displayName: 'E-mini Russell 2000', contractMultiplier: 50, tickSize: 0.1, tickValue: 5 },
  MYM: { root: 'MYM', displayName: 'Micro E-mini Dow', contractMultiplier: 0.5, tickSize: 1, tickValue: 0.5 },
  YM: { root: 'YM', displayName: 'E-mini Dow', contractMultiplier: 5, tickSize: 1, tickValue: 5 },
  MCL: { root: 'MCL', displayName: 'Micro WTI Crude Oil', contractMultiplier: 100, tickSize: 0.01, tickValue: 1 },
  CL: { root: 'CL', displayName: 'WTI Crude Oil', contractMultiplier: 1000, tickSize: 0.01, tickValue: 10 },
  MGC: { root: 'MGC', displayName: 'Micro Gold', contractMultiplier: 10, tickSize: 0.1, tickValue: 1 },
  GC: { root: 'GC', displayName: 'Gold', contractMultiplier: 100, tickSize: 0.1, tickValue: 10 }
}

const normalizeSymbol = (symbol?: string | null): string => (
  (symbol || '').trim().toUpperCase().replaceAll(/[^A-Z0-9]/g, '')
)

export const resolveFuturesContractMetadata = (symbol?: string | null): FuturesContractMetadata | null => {
  const normalized = normalizeSymbol(symbol)
  if (!normalized) return null
  if (FUTURES_CONTRACTS[normalized]) return FUTURES_CONTRACTS[normalized]

  const match = normalized.match(EXPIRY_SUFFIX_RE)
  if (!match) return null

  return FUTURES_CONTRACTS[match[1]] || null
}

export const resolveTradeContractMultiplier = (
  market?: TradeRequest['market'] | null,
  symbol?: string | null
): number | undefined => {
  if (market !== 'FUTURES') return undefined
  return resolveFuturesContractMetadata(symbol)?.contractMultiplier
}
