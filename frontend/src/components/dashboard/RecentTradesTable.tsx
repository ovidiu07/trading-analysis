import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import type { TradeResponse } from '../../api/trades'
import { formatDateTime, formatSignedCurrency } from '../../utils/format'
import { useI18n } from '../../i18n'
import EmptyState from '../ui/EmptyState'

type RecentTradesTableProps = {
  title: string
  subtitle?: string
  trades: TradeResponse[]
  loading?: boolean
  currency: string
  onRowClick?: (trade: TradeResponse) => void
  onViewAll?: () => void
}

const buildStatusColor = (status: TradeResponse['status']) => {
  if (status === 'CLOSED') return 'primary'
  return 'warning'
}

export default function RecentTradesTable({
  title,
  subtitle,
  trades,
  loading,
  currency,
  onRowClick,
  onViewAll
}: RecentTradesTableProps) {
  const { t } = useI18n()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const renderCards = () => {
    if (loading) {
      return (
        <Stack spacing={1.25}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} variant="rectangular" height={88} />
          ))}
        </Stack>
      )
    }

    if (trades.length === 0) {
      return (
        <EmptyState
          title={t('dashboard.recentTrades.empty')}
        />
      )
    }

    return (
      <Stack spacing={1.25}>
        {trades.map((trade) => (
          <Box
            key={trade.id}
            role="button"
            tabIndex={0}
            onClick={() => onRowClick?.(trade)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onRowClick?.(trade)
              }
            }}
            sx={{
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              cursor: onRowClick ? 'pointer' : 'default',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover'
              }
            }}
            aria-label={`${trade.symbol} ${t(`trades.status.${trade.status}`)}`}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{trade.symbol}</Typography>
                <Typography variant="caption" color="text.secondary">{formatDateTime(trade.openedAt)}</Typography>
              </Box>
              <Typography
                variant="subtitle2"
                sx={{
                  color: (trade.pnlNet || 0) >= 0 ? 'success.main' : 'error.main',
                  fontVariantNumeric: 'tabular-nums',
                  fontFeatureSettings: '"tnum"',
                  whiteSpace: 'nowrap'
                }}
              >
                {formatSignedCurrency(trade.pnlNet ?? 0, currency)}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip size="small" label={t(`trades.direction.${trade.direction}`)} color={trade.direction === 'LONG' ? 'success' : 'error'} variant="outlined" />
              <Chip size="small" label={t(`trades.status.${trade.status}`)} color={buildStatusColor(trade.status)} variant="outlined" />
            </Stack>
          </Box>
        ))}
      </Stack>
    )
  }

  return (
    <Card>
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Button
            size="small"
            variant="text"
            endIcon={<ArrowForwardIcon fontSize="small" />}
            onClick={onViewAll}
            aria-label={t('dashboard.recentTrades.viewAll')}
            sx={{ minHeight: 40 }}
          >
            {t('dashboard.recentTrades.viewAll')}
          </Button>
        </Stack>

        {isMobile ? renderCards() : (
          <>
            {loading ? (
              <Skeleton variant="rectangular" height={220} />
            ) : trades.length === 0 ? (
              <EmptyState title={t('dashboard.recentTrades.empty')} />
            ) : (
              <TableContainer>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('dashboard.table.symbol')}</TableCell>
                      <TableCell>{t('dashboard.table.direction')}</TableCell>
                      <TableCell>{t('dashboard.table.status')}</TableCell>
                      <TableCell>{t('dashboard.table.opened')}</TableCell>
                      <TableCell align="right">{t('dashboard.table.pnlNet')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {trades.map((trade) => (
                      <TableRow
                        key={trade.id}
                        hover
                        onClick={() => onRowClick?.(trade)}
                        sx={{
                          cursor: onRowClick ? 'pointer' : 'default',
                          '&:hover': {
                            bgcolor: 'action.hover'
                          }
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700 }}>{trade.symbol}</TableCell>
                        <TableCell>
                          <Chip size="small" label={t(`trades.direction.${trade.direction}`)} color={trade.direction === 'LONG' ? 'success' : 'error'} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={t(`trades.status.${trade.status}`)} color={buildStatusColor(trade.status)} variant="outlined" />
                        </TableCell>
                        <TableCell>{formatDateTime(trade.openedAt)}</TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            color: (trade.pnlNet || 0) >= 0 ? 'success.main' : 'error.main',
                            fontVariantNumeric: 'tabular-nums',
                            fontFeatureSettings: '"tnum"'
                          }}
                        >
                          {formatSignedCurrency(trade.pnlNet ?? 0, currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
