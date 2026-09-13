import type { ReactNode } from 'react'
import { Box, Button, Checkbox, Chip, FormControlLabel, Stack, Typography } from '@mui/material'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded'
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import { Link } from 'react-router-dom'
import type { Preparation } from '../../api/sessionReviews'
import { demoCrossMarket, demoEconomicEvents, demoKeyLevels, demoSessionRange } from '../../features/trading-workspace/demoData'
import { DemoBadge, MetricRow, WorkstationCard } from './WorkspacePrimitives'
import { useI18n } from '../../i18n'

export default function MarketIntelligenceGrid({
  preparation,
  thesis,
  briefing,
  onAcknowledge,
  acknowledgeLabel
}: {
  preparation: Preparation
  thesis: string
  briefing: ReactNode
  onAcknowledge: (checked: boolean) => void
  acknowledgeLabel: string
}) {
  const { t } = useI18n()
  const biasTone = preparation.bias === 'bullish' ? 'success' : preparation.bias === 'bearish' ? 'error' : 'default'
  return (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      <WorkstationCard
        title={t('workstation.marketContext')}
        icon={ArticleOutlinedIcon}
        action={<Chip size="small" label={preparation.bias} color={biasTone} variant="outlined" sx={{ textTransform: 'capitalize', borderRadius: 1 }} />}
      >
        <Box sx={{ p: 1.25, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ color: thesis ? 'text.primary' : 'text.secondary', whiteSpace: 'pre-line' }}>
            {thesis || t('workstation.contextEmpty')}
          </Typography>
        </Box>
        <Box component="details">
          <Box component="summary" sx={{ cursor: 'pointer', color: 'primary.main', fontSize: 12, fontWeight: 700, py: 0.25 }}>
            {t('workstation.openScenarios')}
          </Box>
          <Box sx={{ pt: 1 }}>{briefing}</Box>
        </Box>
        <FormControlLabel
          control={<Checkbox checked={preparation.contextAcknowledged} onChange={(event) => onAcknowledge(event.target.checked)} />}
          label={acknowledgeLabel}
          sx={{ alignItems: 'flex-start', m: 0, '& .MuiFormControlLabel-label': { fontSize: 12.5, lineHeight: 1.45, pt: 0.65 } }}
        />
      </WorkstationCard>

      <WorkstationCard title={t('workstation.upcomingEvents')} icon={CalendarMonthOutlinedIcon} demo action={<Button component={Link} to="/calendar" size="small">{t('workstation.calendar')}</Button>}>
        <Stack spacing={0.25}>
          {demoEconomicEvents.map((event, index) => (
            <Stack key={`${event.time}-${event.titleKey}`} direction="row" alignItems="center" spacing={1} sx={{ py: 0.55, borderBottom: index === demoEconomicEvents.length - 1 ? 0 : '1px solid', borderColor: 'divider' }}>
              <Typography className="metric-value" variant="caption" color="text.secondary" sx={{ width: 56, flexShrink: 0 }}>{event.time.includes('.') ? t(event.time) : event.time}</Typography>
              <Typography variant="caption" sx={{ flex: 1 }}>{t(event.titleKey)}</Typography>
              <Chip size="small" label={t(`workstation.impact.${event.impact}`)} color={event.impact === 'high' ? 'error' : event.impact === 'medium' ? 'warning' : 'default'} variant="outlined" sx={{ height: 21, fontSize: 10, textTransform: 'uppercase', borderRadius: 1 }} />
            </Stack>
          ))}
        </Stack>
      </WorkstationCard>

      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ pt: 0.25 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{t('workstation.demoMetrics')}</Typography>
        <DemoBadge compact />
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
        <WorkstationCard title={t('workstation.keyLevels')} icon={GpsFixedRoundedIcon}>
          <Stack>{demoKeyLevels.map((item) => <MetricRow key={item.labelKey} {...item} label={t(item.labelKey)} />)}</Stack>
        </WorkstationCard>
        <WorkstationCard title={t('workstation.sessionRange')} icon={TimelineRoundedIcon}>
          <Stack>{demoSessionRange.map((item) => <MetricRow key={item.labelKey} {...item} label={t(item.labelKey)} value={item.value === 'London' ? t('workstation.london') : item.value} />)}</Stack>
        </WorkstationCard>
        <WorkstationCard title={t('workstation.crossMarket')} icon={QueryStatsRoundedIcon}>
          <Stack>{demoCrossMarket.map((item) => <MetricRow key={item.labelKey} {...item} label={t(item.labelKey)} />)}</Stack>
        </WorkstationCard>
      </Box>
    </Stack>
  )
}
