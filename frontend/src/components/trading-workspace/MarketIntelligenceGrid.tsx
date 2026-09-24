import type { ReactNode } from 'react'
import { Alert, Box, Button, Chip, Link as MuiLink, Stack, Typography } from '@mui/material'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded'
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import type { Preparation } from '../../api/sessionReviews'
import type { Selection, Translation } from '../../features/briefings/model'
import { WorkstationCard } from './WorkspacePrimitives'
import { useI18n } from '../../i18n'

export default function MarketIntelligenceGrid({ preparation, thesis, briefing, onAcknowledge, acknowledgeLabel, date, selectedInstrument }: {
  preparation: Preparation
  thesis: string
  briefing: ReactNode
  onAcknowledge: (checked: boolean) => void
  acknowledgeLabel: string
  date: string
  selectedInstrument: string
}) {
  const { t, locale, language } = useI18n()
  const eventsQuery = useQuery({
    queryKey: ['published-market-events', date],
    queryFn: () => apiGet<Selection>(`/session-briefings?date=${encodeURIComponent(date)}`),
    staleTime: 60_000
  })
  const publication = eventsQuery.data?.selected
  const translation = publication?.document.translations[language]
    || publication?.document.translations.en
    || publication?.document.translations.ro
  const events = (translation as Translation | undefined)?.events ?? []
  const biasTone = preparation.bias === 'bullish' ? 'success' : preparation.bias === 'bearish' ? 'error' : 'default'
  const unavailable = (label: string) => <Stack key={label} direction="row" justifyContent="space-between" spacing={1} sx={{ py: 0.65, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="caption" sx={{ fontWeight: 700 }}>{t('workstation.unavailable')}</Typography>
  </Stack>
  return <Stack spacing={1} sx={{ minWidth: 0 }}>
    <WorkstationCard title={t('workstation.marketContext')} icon={ArticleOutlinedIcon} action={<Chip size="small" label={preparation.bias} color={biasTone} variant="outlined" sx={{ textTransform: 'capitalize', borderRadius: 1 }} />}>
      <Box id="market-context" sx={{ p: 1.25, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="body2" sx={{ color: thesis ? 'text.primary' : 'text.secondary', whiteSpace: 'pre-line' }}>{thesis || t('workstation.contextEmpty')}</Typography>
      </Box>
      <Box component="details"><Box component="summary" sx={{ cursor: 'pointer', color: 'primary.main', fontSize: 12, fontWeight: 700, py: 0.25 }}>{t('workstation.openScenarios')}</Box><Box sx={{ pt: 1 }}>{briefing}</Box></Box>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5 }}><input type="checkbox" checked={preparation.contextAcknowledged} onChange={event => onAcknowledge(event.target.checked)} />{acknowledgeLabel}</label>
    </WorkstationCard>
    <WorkstationCard title={t('workstation.upcomingEvents')} icon={CalendarMonthOutlinedIcon} action={<Button size="small" href="#market-context">{t('workstation.marketContext')}</Button>}>
      {eventsQuery.isLoading ? <Typography variant="body2" role="status">{t('common.loading')}</Typography> : events.length ? <Stack spacing={0.25}>
        {events.map(event => {
          const scheduled = new Date(event.scheduledAt)
          const displayTime = new Intl.DateTimeFormat(locale === 'ro' ? 'ro-RO' : 'en-GB', { timeZone: 'Europe/Bucharest', dateStyle: 'short', timeStyle: 'short' }).format(scheduled)
          const released = event.status === 'RELEASED' && scheduled.getTime() <= Date.now()
          return <Stack key={event.id} direction="row" alignItems="flex-start" spacing={1} sx={{ py: 0.65, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ width: 104, flexShrink: 0 }}>{displayTime}</Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="caption" sx={{ fontWeight: 700 }}>{event.name}</Typography><Typography display="block" variant="caption" color="text.secondary">{event.region} · {event.status.toLowerCase()} · {event.timezone}</Typography>{event.sourceUrl ? <MuiLink href={event.sourceUrl} target="_blank" rel="noreferrer" variant="caption">{event.source}</MuiLink> : <Typography variant="caption" color="text.secondary">{event.source}</Typography>}{event.impact ? <Chip size="small" label={t(`workstation.impact.${event.impact.toLowerCase()}`)} variant="outlined" sx={{ ml: 0.75, height: 18 }} /> : null}{released && (event.actual || event.forecast || event.previous) ? <Typography display="block" variant="caption">{[event.actual && `${t('workstation.eventActual')}: ${event.actual}`, event.forecast && `${t('workstation.eventForecast')}: ${event.forecast}`, event.previous && `${t('workstation.eventPrevious')}: ${event.previous}`].filter(Boolean).join(' · ')}</Typography> : null}</Box>
          </Stack>
        })}
        <Typography variant="caption" color="text.secondary">{t('workstation.publishedBriefingSource')} · {publication?.publishedAt}</Typography>
      </Stack> : <Alert severity="info">{t('workstation.noPublishedEvents')}</Alert>}
      {eventsQuery.isError ? <Alert severity="warning">{t('workstation.noPublishedEvents')}</Alert> : null}
    </WorkstationCard>
    <Alert severity="info" action={<Button size="small" href="/settings">{t('workstation.connectProvider')}</Button>}>{t('workstation.providerRequired')}</Alert>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
      <WorkstationCard title={t('workstation.keyLevels')} icon={GpsFixedRoundedIcon}><Typography variant="caption" color="text.secondary">{selectedInstrument} · {t('workstation.exactInstrumentScope')}</Typography>{[t('workstation.mechanicalLevels'), t('workstation.publishedLevels'), t('workstation.manualLevels')].map(unavailable)}</WorkstationCard>
      <WorkstationCard title={t('workstation.sessionRange')} icon={TimelineRoundedIcon}><Typography variant="caption" color="text.secondary">{selectedInstrument} · {t('workstation.completedBarsOnly')}</Typography>{[t('workstation.metrics.dailyOpen'), t('workstation.metrics.asiaHigh'), t('workstation.metrics.asiaLow'), t('workstation.metrics.londonHigh'), t('workstation.metrics.londonLow')].map(unavailable)}</WorkstationCard>
      <WorkstationCard title={t('workstation.crossMarket')} icon={QueryStatsRoundedIcon}>{[t('workstation.metrics.dxy'), t('workstation.metrics.us2y'), t('workstation.metrics.us10y')].map(unavailable)}</WorkstationCard>
    </Box>
  </Stack>
}
