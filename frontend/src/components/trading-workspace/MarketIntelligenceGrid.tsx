import OfficialReferenceCard from './OfficialReferenceCard'
import { useRef, useState, type ReactNode } from 'react'
import { Alert, Box, Button, Chip, Link as MuiLink, Stack, Typography } from '@mui/material'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded'
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import type { Preparation } from '../../api/sessionReviews'
import EventDetails from '../../features/briefings/EventDetails'
import { editorialDate, type Composition, type Selection, type Translation } from '../../features/briefings/model'
import type { AnalysisMetrics, InstrumentQuote, MacroObservation } from '../../api/marketData'
import { nativeQuoteDisplay, scopedNativeAnalysis } from '../../features/trading-workspace/nativeMarketDisplay'
import { WorkstationCard } from './WorkspacePrimitives'
import ManualLevels from '../../features/preparation/ManualLevels'
import type { ManualLevel } from '../../api/sessionReviews'
import { useI18n } from '../../i18n'

export default function MarketIntelligenceGrid({ preparation, thesis, briefing, onAcknowledge, acknowledgeLabel, date, selectedInstrument, quotes = [], macroObservations = [], analysis, onManualLevelsChange, isCurrentDate = false, displayTimezone = 'Europe/Bucharest' }: {
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
  onManualLevelsChange?: (levels: ManualLevel[]) => void
  isCurrentDate?: boolean
  displayTimezone?: string
}) {
  const { t, locale, language } = useI18n()
  const [contextOpen, setContextOpen] = useState(false)
  const contextRef = useRef<HTMLDivElement>(null)
  const selectedDate = preparation.briefingDate || date
  const captured = useQuery<Composition>({
    queryKey: ['preparationBriefingVersion', preparation.briefingId],
    queryFn: ({ signal }) => apiGet<Composition>(`/today/briefing/version/${preparation.briefingId}`, signal),
    enabled: Boolean(preparation.briefingId), staleTime: Infinity, retry: false
  })
  // Share the published selection with BriefingPanel. Live event updates never
  // change the user's acknowledged capture, editorial levels, or Ready snapshot.
  const latest = useQuery<Selection>({
    queryKey: ['editorialSelection', preparation.manualSession || !isCurrentDate ? selectedDate : 'current-editorial-date', preparation.manualSession ? preparation.briefingSession : 'auto'],
    queryFn: ({ signal }) => apiGet<Selection>(`/session-briefings?date=${encodeURIComponent(preparation.manualSession || !isCurrentDate ? selectedDate : editorialDate())}${preparation.manualSession ? `&slot=${preparation.briefingSession}` : ''}`, signal),
    enabled: !preparation.briefingId || isCurrentDate,
    refetchInterval: isCurrentDate ? 30_000 : false, refetchIntervalInBackground: false, retry: false
  })
  const publication = preparation.briefingId ? captured.data?.selected : latest.data?.selected
  const eventsQuery = isCurrentDate || !preparation.briefingId ? latest : captured
  const eventPublication = isCurrentDate ? latest.data?.selected : publication
  const translationFor = (item: typeof publication) => item?.document.translations[language]
    || item?.document.translations[item.document.contentLanguage] || item?.document.translations.en || item?.document.translations.ro
  const events = (translationFor(eventPublication) as Translation | undefined)?.events ?? []
  const editorialLevels = ((translationFor(publication) as Translation | undefined)?.levels ?? []).filter(level => level.instrument === selectedInstrument)
  const selectedQuote = quotes.find(quote => quote.canonicalInstrument === selectedInstrument)
  const quoteDisplay = nativeQuoteDisplay(selectedQuote)
  const selectedAnalysis = scopedNativeAnalysis(analysis, selectedInstrument)
  const localTime = (value: string | number) => new Intl.DateTimeFormat(locale, { timeZone: displayTimezone, dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
  const openContext = () => { setContextOpen(true); contextRef.current?.focus(); contextRef.current?.scrollIntoView?.({ block: 'start' }) }
  const windowState = (state?: string | null) => state ? t(`workstation.analysisWindows.${state}`) : t('workstation.unavailable')
  const rangeState = (state?: string | null) => state ? t(`workstation.rangeStates.${state}`) : t('workstation.unavailable')
  const biasTone = preparation.bias === 'bullish' ? 'success' : preparation.bias === 'bearish' ? 'error' : 'default'
  const unavailable = (label: string) => <Stack key={label} direction="row" justifyContent="space-between" spacing={1} sx={{ py: 0.65, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="caption" sx={{ fontWeight: 700 }}>{t('workstation.unavailable')}</Typography>
  </Stack>
  const metric = (label: string, value?: number | null, suffix = selectedQuote?.unit ? ` ${selectedQuote.unit}` : '') => <Stack key={label} direction="row" justifyContent="space-between" spacing={1} sx={{ py: 0.65, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="caption" sx={{ fontWeight: 700 }}>{value == null || !Number.isFinite(value) ? t('workstation.unavailable') : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 5 }).format(value)}${suffix}`}</Typography>
  </Stack>
  return <Stack spacing={1} sx={{ minWidth: 0 }}>
    <WorkstationCard title={t('workstation.marketContext')} icon={ArticleOutlinedIcon} action={<Chip size="small" label={t(`prepare.${preparation.bias}`)} color={biasTone} variant="outlined" sx={{ textTransform: 'capitalize', borderRadius: 1 }} />}>
      <Box id="market-context" ref={contextRef} tabIndex={-1} sx={{ p: 1.25, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="body2" sx={{ color: thesis ? 'text.primary' : 'text.secondary', whiteSpace: 'pre-line' }}>{thesis || t('workstation.contextEmpty')}</Typography>
      </Box>
      <Box component="details" id="market-context-details" open={contextOpen} onToggle={event => setContextOpen((event.target as HTMLDetailsElement).open)}><Box component="summary" sx={{ cursor: 'pointer', color: 'primary.main', fontSize: 12, fontWeight: 700, py: 0.25 }}>{t('workstation.openScenarios')}</Box><Box sx={{ pt: 1 }}>{briefing}</Box></Box>
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5 }}><input type="checkbox" checked={preparation.contextAcknowledged} onChange={event => onAcknowledge(event.target.checked)} />{acknowledgeLabel}</label>
    </WorkstationCard>
    <WorkstationCard title={t('workstation.upcomingEvents')} sx={{ '& h2': { whiteSpace: 'normal' } }} icon={CalendarMonthOutlinedIcon} action={<Button size="small" href="#market-context" onClick={openContext} aria-controls="market-context-details" aria-expanded={contextOpen}>{t('workstation.marketContext')}</Button>}>
      {isCurrentDate ? <Typography variant="caption">{t('workstation.eventUpdatesBoundary')}</Typography> : null}
      {eventsQuery.dataUpdatedAt ? <Typography variant="caption">{t('workstation.eventsCheckedAt')}: {localTime(eventsQuery.dataUpdatedAt)} · {displayTimezone}</Typography> : null}
      {eventsQuery.isLoading ? <Typography variant="body2" role="status">{t('common.loading')}</Typography> : events.length ? <Stack spacing={0.25}>
        {events.map(event => <EventDetails key={event.id} event={event} referenceTime={eventPublication?.document.referenceTime} displayTimezone={displayTimezone}/>)}
        <Typography variant="caption" color="text.secondary">{t('workstation.publishedBriefingSource')} · {eventPublication?.publishedAt ? localTime(eventPublication.publishedAt) : '—'} · {displayTimezone}</Typography>
      </Stack> : <Alert severity="info">{t('workstation.noPublishedEvents')}</Alert>}
      {eventsQuery.isError ? <Alert severity="warning">{t('workstation.eventRefreshFailed')}</Alert> : null}
    </WorkstationCard>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
      <WorkstationCard title={t('workstation.keyLevels')} icon={GpsFixedRoundedIcon}><Typography variant="caption" color="text.secondary">{selectedInstrument} · {t('workstation.exactInstrumentScope')}</Typography>{metric(`${t('workstation.mechanicalLevels')} · ${t('workstation.metrics.previousDayHigh')}`, selectedAnalysis?.previousDayHigh)}{metric(`${t('workstation.mechanicalLevels')} · ${t('workstation.metrics.previousDayLow')}`, selectedAnalysis?.previousDayLow)}{selectedAnalysis?.previousDayDate ? <Typography variant="caption" display="block" color="text.secondary">{selectedAnalysis.previousDayDate} · {selectedAnalysis.provider} · {selectedAnalysis.providerSymbol} · {selectedAnalysis.dailyAlignment}</Typography> : null}{editorialLevels.length ? editorialLevels.map(level=><Stack key={level.id} direction="row" justifyContent="space-between" spacing={1} sx={{py:.65,borderBottom:'1px solid',borderColor:'divider'}}><Box sx={{minWidth:0}}><Typography variant="caption" sx={{fontWeight:700}}>{t(`workstation.levelLabels.${level.label}`)}</Typography><Typography display="block" variant="caption" color="text.secondary">{level.rationale} · {level.source}</Typography>{level.sourceUrl ? <MuiLink href={level.sourceUrl} target="_blank" rel="noreferrer" variant="caption">{t('workstation.source')}</MuiLink> : null}</Box><Typography variant="caption" sx={{fontWeight:700,whiteSpace:'nowrap'}}>{new Intl.NumberFormat(locale,{maximumFractionDigits:6}).format(level.value)} {level.unit}</Typography></Stack>):unavailable(t('workstation.publishedLevels'))}{onManualLevelsChange ? <ManualLevels key={preparation.chartSymbol} instrument={preparation.chartSymbol} levels={preparation.manualLevels ?? []} onChange={onManualLevelsChange} timezone={displayTimezone} /> : unavailable(t('workstation.manualLevels'))}</WorkstationCard>
      <WorkstationCard title={t('workstation.sessionRange')} icon={TimelineRoundedIcon}>
        <Box sx={{ pb: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">{selectedInstrument} · {t('workstation.currentQuote')}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{quoteDisplay.value == null ? t('workstation.unavailable') : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 5 }).format(quoteDisplay.value)} ${selectedQuote?.unit}`}</Typography>
          <Typography variant="caption" display="block" color="text.secondary">{selectedQuote?.providerSymbol ? `${selectedQuote.provider} · ${selectedQuote.providerSymbol} · ${selectedQuote.instrumentType} · ${selectedQuote.priceBasis} · ${t(`workstation.freshness.${quoteDisplay.freshness}`)}` : selectedQuote?.availabilityReason ? t(`workstation.availability.${selectedQuote.availabilityReason}`) : t('workstation.noAuthorizedSource')}</Typography>
          {quoteDisplay.value == null ? <Typography variant="caption">{t(`workstation.availability.${quoteDisplay.reason}`)}</Typography> : null}
          {selectedQuote?.sourceUrl ? <MuiLink href={selectedQuote.sourceUrl} target="_blank" rel="noreferrer" variant="caption">{t('workstation.source')}</MuiLink> : null}
          {selectedQuote?.observedAt ? <Typography variant="caption" display="block" color="text.secondary">{t('workstation.observedAt')}: {localTime(selectedQuote.observedAt)} · {t('workstation.retrievedAt')}: {localTime(selectedQuote.retrievedAt)} · {displayTimezone}</Typography> : null}
          {metric(t('workstation.metrics.changePercent'), quoteDisplay.value != null ? selectedAnalysis?.changePercent : null, '%')}
          <Typography variant="caption">{t('workstation.quoteChangeBasis')}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">{selectedInstrument} · {t('workstation.completedBarsOnly')}</Typography>
        {!selectedAnalysis && analysis?.canonicalInstrument === selectedInstrument && analysis.availabilityReason ? <Typography variant="caption">{t(`workstation.availability.${analysis.availabilityReason}`)}</Typography> : null}
        {metric(t('workstation.metrics.dailyOpen'), selectedAnalysis?.dailyOpen)}

        {metric(t('workstation.metrics.asiaHigh'), selectedAnalysis?.asia?.high)}
        {metric(t('workstation.metrics.asiaLow'), selectedAnalysis?.asia?.low)}
        <Typography variant="caption" color="text.secondary">{windowState('ASIA')} · {selectedAnalysis?.asia?.observationDate ?? '—'} · {rangeState(selectedAnalysis?.asia?.completionState)} · {selectedAnalysis?.asia?.completedBarCount ?? '—'}</Typography>
        {metric(t('workstation.metrics.londonHigh'), selectedAnalysis?.london?.high)}
        {metric(t('workstation.metrics.londonLow'), selectedAnalysis?.london?.low)}
        <Typography variant="caption" color="text.secondary">{windowState('LONDON')} · {selectedAnalysis?.london?.observationDate ?? '—'} · {rangeState(selectedAnalysis?.london?.completionState)} · {selectedAnalysis?.london?.completedBarCount ?? '—'}</Typography>
        <Typography variant="caption" display="block" color="text.secondary">{t('workstation.metrics.currentSession')}: {windowState(selectedAnalysis?.currentWindow)} · {selectedAnalysis?.dailyAlignment ?? (selectedAnalysis?.availabilityReason ? t(`workstation.availability.${selectedAnalysis.availabilityReason}`) : t('workstation.noAuthorizedSource'))}</Typography>
        {selectedAnalysis ? <Typography variant="caption" display="block" color="text.secondary">{selectedAnalysis.provider} · {selectedAnalysis.providerSymbol ?? '—'} · {selectedAnalysis.priceBasis ?? '—'} · {t(`workstation.freshness.${selectedAnalysis.freshness}`)} · {t('workstation.retrievedAt')}: {selectedAnalysis.retrievedAt}{selectedAnalysis.dailyOpenObservedAt ? ` · ${t('workstation.observedAt')}: ${selectedAnalysis.dailyOpenObservedAt}` : ''}</Typography> : null}
        {selectedAnalysis?.sourceUrl ? <MuiLink href={selectedAnalysis.sourceUrl} target="_blank" rel="noreferrer" variant="caption">{t('workstation.source')}</MuiLink> : null}
      </WorkstationCard>
      <WorkstationCard title={t('workstation.crossMarket')} icon={QueryStatsRoundedIcon}>
        {unavailable(t('workstation.metrics.dxy'))}
        {['US2Y', 'US10Y'].map(symbol => {
          const item = macroObservations.find(observation => observation.canonicalInstrument === symbol
            && observation.provider === 'US_TREASURY' && observation.provenance === 'OFFICIAL_PUBLIC'
            && observation.priceBasis === 'OFFICIAL_DAILY_CLOSE' && observation.unit === '%')
          const value = item?.value == null || !Number.isFinite(item.value) ? t('workstation.unavailable') : `${item.value.toFixed(3)}%`
          const detail = item?.value == null
            ? t(`workstation.availability.${item?.availabilityReason ?? 'NO_COMPLETED_REFERENCE'}`)
            : `${t('workstation.officialDailyReference')} · ${item.observationDate}${item.freshness === 'STALE' ? ` · ${t('workstation.freshness.STALE')}` : ''}${item.changeBasisPoints == null ? '' : ` · ${item.changeBasisPoints > 0 ? '+' : ''}${item.changeBasisPoints.toFixed(1)} bp`}`
          return <Stack key={symbol} sx={{ py: 0.65, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="caption" color="text.secondary">{t(`workstation.metrics.${symbol.toLowerCase()}`)}</Typography><Typography variant="caption" sx={{ fontWeight: 700 }}>{value}</Typography></Stack>
            <Typography variant="caption" color="text.secondary">{detail}</Typography>
            {item?.retrievedAt ? <Typography variant="caption">{t('workstation.retrievedAt')}: {localTime(item.retrievedAt)} · {displayTimezone}</Typography> : null}
            {item?.sourceUrl ? <MuiLink href={item.sourceUrl} target="_blank" rel="noreferrer" variant="caption">{t('workstation.source')}</MuiLink> : null}
          </Stack>
        })}
      </WorkstationCard>
    </Box>
    {isCurrentDate && <OfficialReferenceCard timezone={displayTimezone} />}
  </Stack>
}
