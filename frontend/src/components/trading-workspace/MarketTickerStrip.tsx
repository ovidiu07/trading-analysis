import { Box, ButtonBase, Chip, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
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

export default function MarketTickerStrip({
  selectedSymbol,
  onSelect,
  quotes = [],
  loading = false,
  error = false,
  heartbeatAt,
  environment
}: {
  selectedSymbol: string
  onSelect: (item: WatchlistInstrument) => void
  quotes?: InstrumentQuote[]
  loading?: boolean
  error?: boolean
  heartbeatAt?: number
  environment?: string | null
}) {
  const { t, locale } = useI18n()
  const quoteBySymbol = new Map(quotes.map(quote => [quote.canonicalInstrument, quote]))
  const hasAvailable = quotes.some(quote => nativeQuoteDisplay(quote).value != null)
  const reason = error ? 'CONNECTION_LOST' : quotes.find(quote => quote.availabilityReason)?.availabilityReason
  return (
    <Box component="section" aria-label={t('workstation.marketPreview')} sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {t('workstation.nativeWatchlist')}
        </Typography>
        <Chip size="small" label={loading ? t('common.loading') : hasAvailable ? t('workstation.sourceAware') : t('workstation.unavailable')} color="default" variant="outlined" sx={{ height: 22, fontSize: 10.5 }} />
        {!hasAvailable && !loading ? <><Typography variant="caption" color="text.secondary">{reason === 'NO_CREDENTIALS' || !reason ? t('workstation.providerRequired') : reason === 'LICENSE_REQUIRED' ? t('workstation.displayAuthorizationRequired') : t(`workstation.availability.${reason}`)}</Typography></> : null}
        <Link to="/settings" style={{ fontSize: 12 }}>{t('workstation.connectProvider')}</Link>
      </Stack>
      <Typography variant="caption" display="block" color="text.secondary">{t('workstation.nativeDisplayBoundary')}{environment ? ` · OANDA ${environment}` : ''}</Typography>
      <Typography role="status" variant="caption" display="block" color="text.secondary" sx={{ mb: 0.75 }}>{error ? t('workstation.availability.CONNECTION_LOST') : heartbeatAt ? `${t('workstation.lastResponse')}: ${new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(heartbeatAt)}` : t('workstation.awaitingResponse')}</Typography>
      <Box sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: { xs: 'minmax(200px, 70vw)', sm: 'minmax(210px, 1fr)' }, gap: 1, overflowX: 'auto', pb: 0.5, scrollbarWidth: 'thin' }}>
        {watchlist.map(([symbol, labelKey, tradingViewSymbol]) => {
          const item = { symbol, labelKey, tradingViewSymbol }
          const selected = selectedSymbol === tradingViewSymbol
          const quote = quoteBySymbol.get(symbol)
          const display = nativeQuoteDisplay(quote)
          const value = display.value == null ? null : new Intl.NumberFormat(locale, { maximumFractionDigits: 5 }).format(display.value)
          const state = display.freshness
          const stateLabel = t(`workstation.freshness.${state}`)
          const reasonLabel = t(`workstation.availability.${display.reason && quote ? display.reason : (error ? 'CONNECTION_LOST' : ['DXY', 'ES'].includes(symbol) ? 'SYMBOL_NOT_SUPPORTED' : 'NO_PROVIDER')}`)
          const detail = display.value != null && quote ? `${quote.provider} · ${quote.providerSymbol} · ${quote.priceBasis} · ${quote.observedAt || ''} · ${quote.retrievedAt}` : reasonLabel
          const accessible = `${symbol}. ${value ?? stateLabel}. ${stateLabel}. ${quote?.provider || t('workstation.noAuthorizedSource')}. ${display.value == null ? reasonLabel : ''}`
          return <ButtonBase key={symbol} onClick={() => onSelect(item)} aria-pressed={selected} aria-label={accessible} title={`${stateLabel} · ${detail}`} sx={{ display: 'block', minWidth: 0, textAlign: 'left', border: '1px solid', borderColor: selected ? 'primary.main' : 'divider', borderRadius: 1.25, bgcolor: selected ? 'action.selected' : 'background.paper', px: 1.5, py: 1.1, overflowWrap: 'anywhere', '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 }, '&:hover': { bgcolor: 'action.hover', borderColor: selected ? 'primary.main' : 'text.disabled' } }}>
            <Typography variant="caption" sx={{ display: 'block', color: selected ? 'primary.main' : 'text.secondary', fontWeight: 700 }}>{symbol}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{loading && !quote ? '…' : value ?? t('workstation.unavailable')}</Typography>
            <Typography variant="caption" display="block" color="text.secondary">{stateLabel} · {quote?.provider || 'OANDA'} {quote?.providerSymbol || ''}</Typography>
            {quote?.instrumentType ? <Typography variant="caption" display="block" color="text.secondary">{quote.instrumentType} · {quote.priceBasis}{quote.unit ? ` · ${quote.unit}` : ''}</Typography> : null}
            {display.value == null ? <Typography variant="caption" display="block">{reasonLabel}</Typography> : null}
            {quote?.observedAt ? <Typography component="time" dateTime={quote.observedAt} variant="caption" display="block" color="text.secondary">{t('workstation.observedAt')}: {quote.observedAt}</Typography> : null}
          </ButtonBase>
        })}
      </Box>
    </Box>
  )
}
