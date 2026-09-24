import { Box, ButtonBase, Chip, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { InstrumentQuote } from '../../api/marketData'

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
  loading = false
}: {
  selectedSymbol: string
  onSelect: (item: WatchlistInstrument) => void
  quotes?: InstrumentQuote[]
  loading?: boolean
}) {
  const { t } = useI18n()
  const quoteBySymbol = new Map(quotes.map(quote => [quote.canonicalInstrument, quote]))
  const hasAvailable = quotes.some(quote => quote.mid != null && quote.freshness !== 'UNAVAILABLE')
  const reason = quotes.find(quote => quote.availabilityReason)?.availabilityReason
  return (
    <Box component="section" aria-label={t('workstation.marketPreview')} sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {t('workstation.watchlist')}
        </Typography>
        <Chip size="small" label={loading ? t('common.loading') : hasAvailable ? t('workstation.sourceAware') : t('workstation.unavailable')} color="default" variant="outlined" sx={{ height: 22, fontSize: 10.5 }} />
        {!hasAvailable && !loading ? <><Typography variant="caption" color="text.secondary">{reason === 'NO_CREDENTIALS' || !reason ? t('workstation.providerRequired') : reason === 'LICENSE_REQUIRED' ? t('workstation.displayAuthorizationRequired') : t(`workstation.availability.${reason}`)}</Typography>{reason === 'NO_CREDENTIALS' || !reason ? <Link to="/settings" style={{ fontSize: 12 }}>{t('workstation.connectProvider')}</Link> : null}</> : null}
      </Stack>
      <Box sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: { xs: 'minmax(142px, 45vw)', sm: 'minmax(150px, 1fr)' }, gap: 1, overflowX: 'auto', pb: 0.5, scrollbarWidth: 'thin' }}>
        {watchlist.map(([symbol, labelKey, tradingViewSymbol]) => {
          const item = { symbol, labelKey, tradingViewSymbol }
          const selected = selectedSymbol === tradingViewSymbol
          const quote = quoteBySymbol.get(symbol)
          const value = quote?.mid == null ? null : new Intl.NumberFormat(undefined, { maximumFractionDigits: 5 }).format(quote.mid)
          const tooOld = quote?.observedAt ? Date.now() - new Date(quote.observedAt).getTime() > 15_000 : false
          const state = tooOld && quote?.mid != null ? 'STALE' : quote?.freshness || 'UNAVAILABLE'
          const stateLabel = t(`workstation.freshness.${state}`)
          const detail = quote?.mid != null ? `${quote.provider} · ${quote.providerSymbol} · ${quote.priceBasis} · ${quote.observedAt || ''} · ${quote.retrievedAt}` : t(`workstation.availability.${quote?.availabilityReason || 'NO_PROVIDER'}`)
          const accessible = `${symbol}. ${value ?? stateLabel}. ${stateLabel}. ${quote?.provider || t('workstation.noAuthorizedSource')}`
          return <ButtonBase key={symbol} onClick={() => onSelect(item)} aria-pressed={selected} aria-label={accessible} title={`${stateLabel} · ${detail}`} sx={{ display: 'block', minWidth: 0, textAlign: 'left', border: '1px solid', borderColor: selected ? 'primary.main' : 'divider', borderRadius: 1.25, bgcolor: selected ? 'action.selected' : 'background.paper', px: 1.5, py: 1.1, '&:hover': { bgcolor: 'action.hover', borderColor: selected ? 'primary.main' : 'text.disabled' } }}>
            <Typography variant="caption" sx={{ display: 'block', color: selected ? 'primary.main' : 'text.secondary', fontWeight: 700 }}>{symbol}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{loading && !quote ? '…' : value ?? t('workstation.unavailable')}</Typography>
            <Typography variant="caption" color="text.secondary">{stateLabel}{quote?.providerSymbol ? ` · ${quote.providerSymbol}` : ''}</Typography>
          </ButtonBase>
        })}
      </Box>
    </Box>
  )
}
