import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from '@mui/material'
import { useMemo } from 'react'
import { useI18n } from '../../i18n'

export type KPIFormatType = 'currency' | 'percent' | 'ratio' | 'number'

type KPIStatCardProps = {
  label: string
  value: number | string | null | undefined
  subValue?: string
  trend?: number | null
  tooltipText?: string
  formatType: KPIFormatType
  currency?: string
  loading?: boolean
}

const formatNumericValue = (
  value: number,
  formatType: KPIFormatType,
  locale: string,
  currency: string
) => {
  if (formatType === 'currency') {
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
    return value > 0 ? `+${formatted}` : formatted
  }

  if (formatType === 'percent') {
    return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}%`
  }

  if (formatType === 'ratio') {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
  }

  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
}

export default function KPIStatCard({
  label,
  value,
  subValue,
  trend,
  tooltipText,
  formatType,
  currency = 'USD',
  loading
}: KPIStatCardProps) {
  const { locale } = useI18n()

  const displayValue = useMemo(() => {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'number') return formatNumericValue(value, formatType, locale, currency)
    return value
  }, [currency, formatType, locale, value])

  const numericValue = typeof value === 'number' ? value : null
  const toneColor = numericValue === null
    ? 'text.primary'
    : numericValue > 0
      ? 'success.main'
      : numericValue < 0
        ? 'error.main'
        : 'text.primary'

  return (
    <Card>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{
                fontSize: { xs: 12, sm: 12.5 },
                minWidth: 0,
                display: '-webkit-box',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {label}
            </Typography>
            {tooltipText && (
              <Tooltip title={tooltipText} arrow>
                <IconButton size="small" aria-label={label} sx={{ width: 40, height: 40 }}>
                  <InfoOutlinedIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
          <Typography
            variant="h3"
            className="metric-value"
            sx={{
              color: loading ? 'text.secondary' : toneColor,
              fontWeight: 700,
              lineHeight: 1.2,
              fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2rem' },
              minWidth: 0,
              overflowWrap: 'anywhere'
            }}
          >
            {loading ? '—' : displayValue}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {typeof trend === 'number' && (
              <Chip
                size="small"
                icon={trend >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                label={`${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`}
                color={trend >= 0 ? 'success' : 'error'}
                variant="outlined"
              />
            )}
            {subValue && (
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {subValue}
                </Typography>
              </Box>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
