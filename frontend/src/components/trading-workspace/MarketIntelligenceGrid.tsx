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
import type { AnalysisMetrics, InstrumentQuote, MacroObservation } from '../../api/marketData'
import { WorkstationCard } from './WorkspacePrimitives'
import { useI18n } from '../../i18n'

export default function MarketIntelligenceGrid({ preparation, thesis, briefing, onAcknowledge, acknowledgeLabel, date, selectedInstrument, quotes = [], macroObservations = [], analysis }: {
  preparation: Preparation
  thesis: string
  briefing: ReactNode
  onAcknowledge: (checked: boolean) => void
  acknowledgeLabel: string
  date: string
  selectedInstrument: string
  quotes?: InstrumentQuote[]
  macroObservations?: MacroObservation[]
  analysis?: AnalysisMetrics | null
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
  const editorialLevels = ((translation as Translation | undefined)?.levels ?? []).filter(level => level.instrument === selectedInstrument)
  const selectedQuote = quotes.find(quote => quote.canonicalInstrument === selectedInstrument)
  const selectedAnalysis = analysis?.canonicalInstrument === selectedInstrument ? analysis : null
  const selectedQuoteFreshness = selectedQuote?.observedAt && Date.now() - new Date(selectedQuote.observedAt).getTime() > 15_000 && selectedQuote.mid != null ? 'STALE' : selectedQuote?.freshness
  const windowState = (state?: string | null) => state ? t(`workstation.analysisWindows.${state}`) : t('workstation.unavailable')
  const rangeState = (state?: string | null) => state ? t(`workstation.rangeStates.${state}`) : t('workstation.unavailable')
  const biasTone = preparation.bias === 'bullish' ? 'success' : preparation.bias === 'bearish' ? 'error' : 'default'
  const unavailable = (label: string) => <Stack key={label} direction="row" justifyContent="space-between" spacing={1} sx={{ py: 0.65, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="caption" sx={{ fontWeight: 700 }}>{t('workstation.unavailable')}</Typography>
  </Stack>
  const metric = (label: string, value?: number | null, suffix = selectedQuote?.unit ? ` ${selectedQuote.unit}` : '') => <Stack key={label} direction="row" justifyContent="space-between" spacing={1} sx={{ py: 0.65, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="caption" sx={{ fontWeight: 700 }}>{value == null ? t('workstation.unavailable') : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 5 }).format(value)}${suffix}`}</Typography>
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
            <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="caption" sx={{ fontWeight: 700 }}>{event.name}</Typography><Typography display="block" variant="caption" color="text.secondary">{event.region} · {t(`workstation.eventStatus.${event.status}`)} · {event.timezone}</Typography>{event.sourceUrl ? <MuiLink href={event.sourceUrl} target="_blank" rel="noreferrer" variant="caption">{event.source}</MuiLink> : <Typography variant="caption" color="text.secondary">{event.source}</Typography>}{event.impact ? <Chip size="small" label={t(`workstation.impact.${event.impact.toLowerCase()}`)} variant="outlined" sx={{ ml: 0.75, height: 18 }} /> : null}{released && (event.actual || event.forecast || event.previous) ? <Typography display="block" variant="caption">{[event.actual && `${t('workstation.eventActual')}: ${event.actual}`, event.forecast && `${t('workstation.eventForecast')}: ${event.forecast}`, event.previous && `${t('workstation.eventPrevious')}: ${event.previous}`].filter(Boolean).join(' · ')}</Typography> : null}</Box>
          </Stack>
        })}
        <Typography variant="caption" color="text.secondary">{t('workstation.publishedBriefingSource')} · {publication?.publishedAt}</Typography>
      </Stack> : <Alert severity="info">{t('workstation.noPublishedEvents')}</Alert>}
      {eventsQuery.isError ? <Alert severity="warning">{t('workstation.noPublishedEvents')}</Alert> : null}
    </WorkstationCard>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
      <WorkstationCard title={t('workstation.keyLevels')} icon={GpsFixedRoundedIcon}><Typography variant="caption" color="text.secondary">{selectedInstrument} · {t('workstation.exactInstrumentScope')}</Typography>{metric(`${t('workstation.mechanicalLevels')} · ${t('workstation.metrics.previousDayHigh')}`, selectedAnalysis?.previousDayHigh)}{metric(`${t('workstation.mechanicalLevels')} · ${t('workstation.metrics.previousDayLow')}`, selectedAnalysis?.previousDayLow)}{selectedAnalysis?.previousDayDate ? <Typography variant="caption" display="block" color="text.secondary">{selectedAnalysis.previousDayDate} · {selectedAnalysis.provider} · {selectedAnalysis.providerSymbol} · {selectedAnalysis.dailyAlignment}</Typography> : null}{editorialLevels.length ? editorialLevels.map(level=><Stack key={level.id} direction="row" justifyContent="space-between" spacing={1} sx={{py:.65,borderBottom:'1px solid',borderColor:'divider'}}><Box sx={{minWidth:0}}><Typography variant="caption" sx={{fontWeight:700}}>{t(`workstation.levelLabels.${level.label}`)}</Typography><Typography display="block" variant="caption" color="text.secondary">{level.rationale} · {level.source}</Typography>{level.sourceUrl ? <MuiLink href={level.sourceUrl} target="_blank" rel="noreferrer" variant="caption">{t('workstation.source')}</MuiLink> : null}</Box><Typography variant="caption" sx={{fontWeight:700,whiteSpace:'nowrap'}}>{new Intl.NumberFormat(locale,{maximumFractionDigits:6}).format(level.value)} {level.unit}</Typography></Stack>):unavailable(t('workstation.publishedLevels'))}{unavailable(t('workstation.manualLevels'))}</WorkstationCard>
      <WorkstationCard title={t('workstation.sessionRange')} icon={TimelineRoundedIcon}>
        <Box sx={{ pb: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">{selectedInstrument} · {t('workstation.currentQuote')}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedQuote?.mid == null ? t('workstation.unavailable') : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 5 }).format(selectedQuote.mid)} ${selectedQuote.unit}`}</Typography>
          <Typography variant="caption" display="block" color="text.secondary">{selectedQuote?.providerSymbol ? `${selectedQuote.provider} · ${selectedQuote.providerSymbol} · ${selectedQuote.priceBasis} · ${t(`workstation.freshness.${selectedQuoteFreshness}`)}` : selectedQuote?.availabilityReason ? t(`workstation.availability.${selectedQuote.availabilityReason}`) : t('workstation.noAuthorizedSource')}</Typography>
          {selectedQuote?.observedAt ? <Typography variant="caption" display="block" color="text.secondary">{t('workstation.observedAt')}: {selectedQuote.observedAt} · {t('workstation.retrievedAt')}: {selectedQuote.retrievedAt}</Typography> : null}
        </Box>
        <Typography variant="caption" color="text.secondary">{selectedInstrument} · {t('workstation.completedBarsOnly')}</Typography>
        {metric(t('workstation.metrics.dailyOpen'), selectedAnalysis?.dailyOpen)}
        {metric(t('workstation.metrics.changePercent'), selectedAnalysis?.changePercent, '%')}
        {metric(t('workstation.metrics.asiaHigh'), selectedAnalysis?.asia?.high)}
        {metric(t('workstation.metrics.asiaLow'), selectedAnalysis?.asia?.low)}
        <Typography variant="caption" color="text.secondary">{windowState('ASIA')} · {selectedAnalysis?.asia?.observationDate ?? '—'} · {rangeState(selectedAnalysis?.asia?.completionState)} · {selectedAnalysis?.asia?.completedBarCount ?? 0}</Typography>
        {metric(t('workstation.metrics.londonHigh'), selectedAnalysis?.london?.high)}
        {metric(t('workstation.metrics.londonLow'), selectedAnalysis?.london?.low)}
        <Typography variant="caption" color="text.secondary">{windowState('LONDON')} · {selectedAnalysis?.london?.observationDate ?? '—'} · {rangeState(selectedAnalysis?.london?.completionState)} · {selectedAnalysis?.london?.completedBarCount ?? 0}</Typography>
        <Typography variant="caption" display="block" color="text.secondary">{t('workstation.metrics.currentSession')}: {windowState(selectedAnalysis?.currentWindow)} · {selectedAnalysis?.dailyAlignment ?? (selectedAnalysis?.availabilityReason ? t(`workstation.availability.${selectedAnalysis.availabilityReason}`) : t('workstation.noAuthorizedSource'))}</Typography>
        {selectedAnalysis ? <Typography variant="caption" display="block" color="text.secondary">{selectedAnalysis.provider} · {selectedAnalysis.providerSymbol ?? '—'} · {selectedAnalysis.priceBasis ?? '—'} · {t(`workstation.freshness.${selectedAnalysis.freshness}`)} · {t('workstation.retrievedAt')}: {selectedAnalysis.retrievedAt}{selectedAnalysis.dailyOpenObservedAt ? ` · ${t('workstation.observedAt')}: ${selectedAnalysis.dailyOpenObservedAt}` : ''}</Typography> : null}
        {selectedAnalysis?.sourceUrl ? <MuiLink href={selectedAnalysis.sourceUrl} target="_blank" rel="noreferrer" variant="caption">{t('workstation.source')}</MuiLink> : null}
      </WorkstationCard>
      <WorkstationCard title={t('workstation.crossMarket')} icon={QueryStatsRoundedIcon}>
        {unavailable(t('workstation.metrics.dxy'))}
        {['US2Y', 'US10Y'].map(symbol => {
          const item = macroObservations.find(observation => observation.canonicalInstrument === symbol)
          const value = item?.value == null ? t('workstation.unavailable') : `${item.value.toFixed(3)}%`
          const detail = item?.value == null
            ? t(`workstation.availability.${item?.availabilityReason ?? 'NO_COMPLETED_REFERENCE'}`)
            : `${t('workstation.officialDailyReference')} · ${item.observationDate} · ${t(`workstation.freshness.${item.freshness}`)}${item.changeBasisPoints == null ? '' : ` · ${item.changeBasisPoints > 0 ? '+' : ''}${item.changeBasisPoints.toFixed(1)} bp`}`
          return <Stack key={symbol} sx={{ py: 0.65, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="caption" color="text.secondary">{t(`workstation.metrics.${symbol.toLowerCase()}`)}</Typography><Typography variant="caption" sx={{ fontWeight: 700 }}>{value}</Typography></Stack>
            <Typography variant="caption" color="text.secondary">{detail}</Typography>
            {item?.sourceUrl ? <MuiLink href={item.sourceUrl} target="_blank" rel="noreferrer" variant="caption">{t('workstation.source')}</MuiLink> : null}
          </Stack>
        })}
      </WorkstationCard>
    </Box>
  </Stack>
}
