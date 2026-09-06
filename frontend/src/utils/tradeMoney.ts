import type { TradeResponse } from '../api/trades'
import { formatSignedCurrency } from './format'

/** Net P&L follows its source currency, never the instrument-price label. */
export function netResult(trade: TradeResponse) {
  const currency = !trade.source || trade.source === 'MANUAL'
    ? trade.tradeCurrency
    : trade.accountCurrency
  return { value: trade.pnlNet, currency }
}

export function formatNetResult(trade: TradeResponse) {
  const { value, currency } = netResult(trade)
  return value == null || !currency ? '—' : formatSignedCurrency(value, currency)
}

export function convertedNetResult(trade: TradeResponse) {
  const source = netResult(trade)
  return trade.pnlProfileCurrency != null && trade.profileCurrency && trade.profileCurrency !== source.currency
    && trade.fxRateTradeToProfile != null && trade.fxRateTradeToProfile > 0
    ? formatSignedCurrency(trade.pnlProfileCurrency, trade.profileCurrency) : null
}
