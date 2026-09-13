import { Box, ButtonBase, Stack, Typography } from '@mui/material'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import type { MarketTickerItem } from '../../features/trading-workspace/demoData'
import { DemoBadge } from './WorkspacePrimitives'
import { useI18n } from '../../i18n'

export default function MarketTickerStrip({
  items,
  selectedSymbol,
  onSelect
}: {
  items: MarketTickerItem[]
  selectedSymbol: string
  onSelect: (item: MarketTickerItem) => void
}) {
  const { t } = useI18n()
  return (
    <Box component="section" aria-label={t('workstation.marketPreview')} sx={{ minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {t('workstation.watchlist')}
        </Typography>
        <DemoBadge />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: { xs: 'minmax(142px, 45vw)', sm: 'minmax(150px, 1fr)' },
          gap: 1,
          overflowX: 'auto',
          pb: 0.5,
          scrollbarWidth: 'thin'
        }}
      >
        {items.map((item) => {
          const selected = selectedSymbol === item.tradingViewSymbol
          const positive = item.direction === 'positive'
          return (
            <ButtonBase
              key={item.symbol}
              onClick={() => onSelect(item)}
              aria-pressed={selected}
              aria-label={t('workstation.demoPrice', { instrument: t(item.labelKey), price: item.price, change: item.change })}
              sx={{
                display: 'block',
                minWidth: 0,
                textAlign: 'left',
                border: '1px solid',
                borderColor: selected ? 'primary.main' : 'divider',
                borderRadius: 1.25,
                bgcolor: selected ? 'action.selected' : 'background.paper',
                px: 1.5,
                py: 1.1,
                transition: 'border-color 150ms ease, background-color 150ms ease',
                '&:hover': { bgcolor: 'action.hover', borderColor: selected ? 'primary.main' : 'text.disabled' }
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', color: selected ? 'primary.main' : 'text.secondary', fontWeight: 700 }}>
                {item.symbol}
              </Typography>
              <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={1}>
                <Typography className="metric-value" sx={{ fontSize: 15, fontWeight: 700 }}>{item.price}</Typography>
                <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color: positive ? 'trading.profit' : 'trading.loss' }}>
                  {positive ? <TrendingUpRoundedIcon sx={{ fontSize: 16 }} /> : <TrendingDownRoundedIcon sx={{ fontSize: 16 }} />}
                  <Typography className="metric-value" variant="caption" sx={{ color: 'inherit', fontWeight: 700 }}>{item.change}</Typography>
                </Stack>
              </Stack>
            </ButtonBase>
          )
        })}
      </Box>
    </Box>
  )
}
