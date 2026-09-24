import { Box, ButtonBase, Chip, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'

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
  onSelect
}: {
  selectedSymbol: string
  onSelect: (item: WatchlistInstrument) => void
}) {
  const { t } = useI18n()
  return (
    <Box component="section" aria-label={t('workstation.marketPreview')} sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {t('workstation.watchlist')}
        </Typography>
        <Chip size="small" label={t('workstation.unavailable')} color="default" variant="outlined" sx={{ height: 22, fontSize: 10.5 }} />
        <Typography variant="caption" color="text.secondary">{t('workstation.providerRequired')}</Typography>
        <Link to="/settings" style={{ fontSize: 12 }}>{t('workstation.connectProvider')}</Link>
      </Stack>
      <Box sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: { xs: 'minmax(142px, 45vw)', sm: 'minmax(150px, 1fr)' }, gap: 1, overflowX: 'auto', pb: 0.5, scrollbarWidth: 'thin' }}>
        {watchlist.map(([symbol, labelKey, tradingViewSymbol]) => {
          const item = { symbol, labelKey, tradingViewSymbol }
          const selected = selectedSymbol === tradingViewSymbol
          return <ButtonBase key={symbol} onClick={() => onSelect(item)} aria-pressed={selected} aria-label={`${symbol}. ${t('workstation.unavailable')}. ${t('workstation.providerRequired')}`} sx={{ display: 'block', minWidth: 0, textAlign: 'left', border: '1px solid', borderColor: selected ? 'primary.main' : 'divider', borderRadius: 1.25, bgcolor: selected ? 'action.selected' : 'background.paper', px: 1.5, py: 1.1, '&:hover': { bgcolor: 'action.hover', borderColor: selected ? 'primary.main' : 'text.disabled' } }}>
            <Typography variant="caption" sx={{ display: 'block', color: selected ? 'primary.main' : 'text.secondary', fontWeight: 700 }}>{symbol}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('workstation.unavailable')}</Typography>
            <Typography variant="caption" color="text.secondary">{t('workstation.noAuthorizedSource')}</Typography>
          </ButtonBase>
        })}
      </Box>
    </Box>
  )
}
