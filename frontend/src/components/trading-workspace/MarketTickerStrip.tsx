import { Box, ButtonBase, Typography } from '@mui/material'
import { useI18n } from '../../i18n'
import type { InstrumentQuote } from '../../api/marketData'
import { nativeQuoteDisplay } from '../../features/trading-workspace/nativeMarketDisplay'

const watchlist = [
  ['GBPUSD', 'workstation.instruments.gbpusd', 'OANDA:GBPUSD'],
  ['EURUSD', 'workstation.instruments.eurusd', 'OANDA:EURUSD'],
  ['GER40', 'workstation.instruments.ger40', 'OANDA:DE30EUR'],
  ['NAS100', 'workstation.instruments.nas100', 'OANDA:NAS100USD'],
  ['XAUUSD', 'workstation.instruments.xauusd', 'OANDA:XAUUSD'],
  ['USOIL', 'workstation.instruments.usoil', 'TVC:USOIL'],
  ['DXY', 'workstation.instruments.dxy', 'TVC:DXY'],
  ['ES', 'workstation.instruments.es', 'CME_MINI:ES1!']
] as const

export type WatchlistInstrument = { symbol: string; labelKey: string; tradingViewSymbol: string }

export default function MarketTickerStrip({ selectedSymbol, onSelect, quotes = [] }: {
  selectedSymbol: string
  onSelect: (item: WatchlistInstrument) => void
  quotes?: InstrumentQuote[]
  loading?: boolean
  error?: boolean
  heartbeatAt?: number
  environment?: string | null
}) {
  const { t, locale } = useI18n()
  return <Box component="section" aria-label={t('workstation.marketPreview')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, minWidth: 0 }}>
    {watchlist.map(([symbol, labelKey, tradingViewSymbol]) => {
      const quote = quotes.find(row => row.canonicalInstrument === symbol)
      const display = nativeQuoteDisplay(quote)
      const selected = selectedSymbol === tradingViewSymbol
      const value = display.value != null && quote?.observedAt ? new Intl.NumberFormat(locale, { maximumFractionDigits: 5 }).format(display.value) : null
      return <ButtonBase key={symbol} aria-label={symbol} aria-pressed={selected} onClick={() => onSelect({ symbol, labelKey, tradingViewSymbol })} sx={{ border: '1px solid', borderColor: selected ? 'primary.main' : 'divider', bgcolor: selected ? 'action.selected' : 'background.paper', borderRadius: 1, px: 1.5, py: 1, textAlign: 'left', '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } }}>
        <Box><Typography variant="caption" fontWeight={700} color={selected ? 'primary.main' : 'text.primary'}>{symbol}</Typography>
          {value && <><Typography variant="body2">{value} {quote?.unit}</Typography><Typography variant="caption" display="block" color="text.secondary">{t(`workstation.freshness.${display.freshness}`)} · {new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(quote!.observedAt!))}</Typography></>}
        </Box>
      </ButtonBase>
    })}
  </Box>
}
