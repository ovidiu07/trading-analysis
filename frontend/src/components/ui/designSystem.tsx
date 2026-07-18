import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import {
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
  type DialogProps,
  type SxProps,
  type Theme
} from '@mui/material'
import type { ReactNode } from 'react'
import { formatCurrency, formatNumber, formatPercent } from '../../utils/format'
import { layoutTokens } from '../../theme/tokens'

export type ContentWidth = 'reading' | 'standard' | 'wide'

export function PageContainer({
  width = 'standard',
  children,
  sx
}: {
  width?: ContentWidth
  children: ReactNode
  sx?: SxProps<Theme>
}) {
  return (
    <Box
      sx={[
        {
          width: '100%',
          maxWidth: layoutTokens.content[width],
          minWidth: 0,
          mx: 'auto'
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
    >
      {children}
    </Box>
  )
}

export function SectionHeader({
  title,
  description,
  action,
  icon,
  id
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  id?: string
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      spacing={1.25}
      sx={{ minWidth: 0 }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0 }}>
        {icon ? (
          <Box
            aria-hidden="true"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'action.hover',
              color: 'primary.main',
              flexShrink: 0
            }}
          >
            {icon}
          </Box>
        ) : null}
        <Box sx={{ minWidth: 0 }}>
          <Typography id={id} component="h2" variant="h4" sx={{ overflowWrap: 'anywhere' }}>
            {title}
          </Typography>
          {description ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, maxWidth: '72ch' }}>
              {description}
            </Typography>
          ) : null}
        </Box>
      </Stack>
      {action ? <Box sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}>{action}</Box> : null}
    </Stack>
  )
}

type MetricTone = 'neutral' | 'positive' | 'negative' | 'warning' | 'info'

const metricToneColor: Record<MetricTone, string> = {
  neutral: 'text.primary',
  positive: 'trading.profit',
  negative: 'trading.loss',
  warning: 'warning.main',
  info: 'info.main'
}

export function MetricCard({
  label,
  value,
  helper,
  tone = 'neutral',
  icon
}: {
  label: string
  value: ReactNode
  helper?: ReactNode
  tone?: MetricTone
  icon?: ReactNode
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 1.75, sm: 2 }, '&:last-child': { pb: { xs: 1.75, sm: 2 } } }}>
        <Stack spacing={0.75}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
              {label}
            </Typography>
            {icon ? <Box sx={{ display: 'inline-flex', color: metricToneColor[tone] }}>{icon}</Box> : null}
          </Stack>
          <Typography className="metric-value" variant="h3" sx={{ color: metricToneColor[tone], overflowWrap: 'anywhere' }}>
            {value}
          </Typography>
          {helper ? <Typography variant="caption" color="text.secondary">{helper}</Typography> : null}
        </Stack>
      </CardContent>
    </Card>
  )
}

export type StatusTone =
  | 'profit'
  | 'loss'
  | 'flat'
  | 'long'
  | 'short'
  | 'bullish'
  | 'bearish'
  | 'neutral'
  | 'open'
  | 'closed'
  | 'pending'
  | 'archived'

export function StatusPill({ label, tone = 'neutral', icon }: { label: string; tone?: StatusTone; icon?: ReactNode }) {
  return (
    <Chip
      size="small"
      icon={icon as React.ReactElement | undefined}
      label={label}
      variant="outlined"
      sx={{
        color: `trading.${tone}`,
        borderColor: `trading.${tone}`,
        bgcolor: 'transparent',
        '& .MuiChip-icon': { color: 'inherit' }
      }}
    />
  )
}

type FinancialValueProps = {
  value?: number | null
  kind?: 'currency' | 'percent' | 'number' | 'rMultiple'
  currency?: string
  signed?: boolean
  maximumFractionDigits?: number
  colorize?: boolean
  component?: 'span' | 'div'
}

export function FinancialValue({
  value,
  kind = 'number',
  currency,
  signed = false,
  maximumFractionDigits = 2,
  colorize = false,
  component = 'span'
}: FinancialValueProps) {
  const unavailable = value === undefined || value === null || Number.isNaN(value)
  let formatted = '—'
  if (!unavailable) {
    if (kind === 'currency') formatted = formatCurrency(value, currency)
    if (kind === 'percent') formatted = formatPercent(value)
    if (kind === 'number') formatted = formatNumber(value, maximumFractionDigits)
    if (kind === 'rMultiple') formatted = `${formatNumber(value, maximumFractionDigits)}R`
    if (signed && value > 0) formatted = `+${formatted}`
  }

  const color = colorize && !unavailable
    ? value > 0
      ? 'trading.profit'
      : value < 0
        ? 'trading.loss'
        : 'trading.flat'
    : 'inherit'

  return (
    <Box component={component} className="metric-value" sx={{ color, whiteSpace: 'nowrap' }}>
      {formatted}
    </Box>
  )
}

type ResponsiveDialogProps = Omit<DialogProps, 'title'> & {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  closeLabel: string
  onClose: NonNullable<DialogProps['onClose']>
}

export function ResponsiveDialog({
  title,
  description,
  actions,
  closeLabel,
  children,
  onClose,
  ...dialogProps
}: ResponsiveDialogProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <Dialog fullScreen={fullScreen} onClose={onClose} {...dialogProps}>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography component="span" variant="h5">{title}</Typography>
            {description ? (
              <Typography component="p" variant="body2" color="text.secondary" sx={{ mt: 0.35, mb: 0 }}>
                {description}
              </Typography>
            ) : null}
          </Box>
          <IconButton aria-label={closeLabel} onClick={(event) => onClose(event, 'backdropClick')} edge="end">
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>{children}</DialogContent>
      {actions ? <DialogActions>{actions}</DialogActions> : null}
    </Dialog>
  )
}
