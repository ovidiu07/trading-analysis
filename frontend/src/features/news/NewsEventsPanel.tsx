import { useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, Link, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material'
import NewspaperOutlinedIcon from '@mui/icons-material/NewspaperOutlined'
import { fetchNewsContext, refreshNewsContext, forecastDifference, newsInstrumentLabel, type NewsContextRequest, type NewsFigure } from '../../api/newsContext'
import { WorkstationCard } from '../../components/trading-workspace/WorkspacePrimitives'
import { useI18n } from '../../i18n'

export default function NewsEventsPanel(props: { instrument: string; date: string; timezone: string; isCurrentDate: boolean; asOf?: string }) {
  // A keyed child also resets pagination, tabs and cooldown messages at a context switch.
  return <ContextPanel key={`${props.instrument}:${props.date}:${props.timezone}:${props.asOf ?? ''}`} {...props} />
}
function ContextPanel({ instrument, date, timezone, isCurrentDate, asOf }: { instrument: string; date: string; timezone: string; isCurrentDate: boolean; asOf?: string }) {
  const { t, locale } = useI18n()
  const id = useId()
  const [tab, setTab] = useState(0)
  const [window, setWindow] = useState<NewsContextRequest['window']>('SESSION')
  const [limit, setLimit] = useState(6)
  const [eventLimit, setEventLimit] = useState(6)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshState, setRefreshState] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = globalThis.setInterval(() => setNow(Date.now()), 30_000); return () => globalThis.clearInterval(timer) }, [])
  const request = { instrument, date, timezone, window, asOf }
  const query = useQuery({ queryKey: ['automaticNewsContext', request], queryFn: ({ signal }) => fetchNewsContext(request, signal), staleTime: 60_000, retry: false, refetchInterval: isCurrentDate ? 60_000 : false, refetchIntervalInBackground: false, keepPreviousData: false })
  const data = query.data?.instrument === instrument && query.data.date === date && query.data.window === window ? query.data : undefined
  const localTime = (value: string) => new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value)
  const figure = (value: NewsFigure | null) => value?.value != null && Number.isFinite(value.value) ? `${number(value.value)} ${value.unit}` : <Tooltip title={t('news.missingFigure')}><span tabIndex={0}>—</span></Tooltip>
  const visibleCoverage = data?.coverage.filter(row => row.capability === (tab === 0 ? 'NEWS' : 'CALENDAR')) ?? []
  const failed = visibleCoverage.some(row => row.state === 'FAILED')
  const stale = visibleCoverage.some(row => row.state === 'STALE')
  const pending = visibleCoverage.some(row => row.state === 'PENDING')
  const unsupported = visibleCoverage.some(row => ['UNSUPPORTED_HISTORY', 'OUT_OF_RANGE', 'UNSUPPORTED', 'DISABLED'].includes(row.state))
  const next = data?.events.find(event => event.status === 'UPCOMING' && event.scheduledAt && new Date(event.scheduledAt).getTime() > now)
  const sourceFetch = (source: string, capability: 'NEWS' | 'CALENDAR' | 'OBSERVATIONS', feedId?: string) => data?.coverage.find(row => row.capability === capability && (row.source === source || row.source === `${source} API`) && (!feedId || !row.feedId || row.feedId === feedId))?.lastSuccessAt
  const forecastPresent = data?.events.some(event => event.forecast?.value != null)
  const refresh = async () => {
    setRefreshing(true); setRefreshState('')
    try { await refreshNewsContext(instrument); await query.refetch(); setCooldown(Date.now() + 30 * 60_000); setRefreshState('refreshQueued') }
    catch { setRefreshState('fetchFailed') }
    finally { setRefreshing(false) }
  }
  return <WorkstationCard title={t('news.title')} icon={NewspaperOutlinedIcon} sx={{ '& h2': { whiteSpace: 'normal' } }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
      <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography variant="body2" fontWeight={700}>{newsInstrumentLabel(instrument)}</Typography>
        <Typography variant="caption" color="text.secondary" display="block">{date} · {timezone}</Typography>
        {data?.lastSuccessAt && <Typography variant="caption" color="text.secondary" display="block">{t('news.updated')}: {localTime(data.lastSuccessAt)}</Typography>}
      </Box>
      {isCurrentDate && !asOf && <Button size="small" onClick={() => void refresh()} disabled={refreshing || cooldown > now}>{t('news.refresh')}</Button>}
    </Stack>
    {refreshState && <Typography role="status" variant="caption">{t(`news.${refreshState}`)}</Typography>}
    {next?.scheduledAt && <Box sx={{ px: 1.25, py: 1, borderLeft: '2px solid', borderColor: 'primary.main', bgcolor: 'action.hover', borderRadius: 0.5 }}>
      <Typography variant="caption" color="text.secondary">{t('news.nextTracked')} · {localTime(next.scheduledAt)} · {t('news.inMinutes', { minutes: Math.ceil((new Date(next.scheduledAt).getTime() - now) / 60_000) })}</Typography>
      <Typography variant="body2">{next.name}</Typography>
    </Box>}
    <Tabs value={tab} onChange={(_, value: number) => setTab(value)} aria-label={t('news.title')} variant="fullWidth" sx={{ minHeight: 40, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { minHeight: 40, minWidth: 0 } }}>
      <Tab id={`${id}-news-tab`} aria-controls={`${id}-news-panel`} label={t('news.latest')} />
      <Tab id={`${id}-events-tab`} aria-controls={`${id}-events-panel`} label={t('news.events')} />
    </Tabs>
    <Typography variant="caption" color="text.secondary">{t('news.coverage')}</Typography>
    {(query.isError || failed) && <Alert severity="warning" sx={{ py: 0 }}>{t('news.fetchFailed')}</Alert>}
    {stale && <Alert severity="warning" sx={{ py: 0 }}>{t('news.stale')}</Alert>}
    {unsupported && <Typography role="status" variant="body2" color="text.secondary">{t(isCurrentDate && !asOf ? 'news.incomplete' : 'news.historyLimited')}</Typography>}
    {pending && <Typography role="status" variant="body2" color="text.secondary">{t('news.pending')}</Typography>}
    {query.isLoading && <Typography role="status" variant="body2">{t('common.loading')}</Typography>}
    <Box role="tabpanel" id={`${id}-news-panel`} aria-labelledby={`${id}-news-tab`} hidden={tab !== 0}>
      {tab === 0 && <Stack spacing={1.25}>
        {isCurrentDate && !asOf && <Stack direction="row" spacing={1}>
          {(['SESSION', 'LAST_24_HOURS'] as const).map(value => <Button key={value} size="small" variant={window === value ? 'outlined' : 'text'} aria-pressed={window === value} onClick={() => { setWindow(value); setLimit(6) }}>{t(value === 'SESSION' ? 'news.sessionDay' : 'news.last24')}</Button>)}
        </Stack>}
        {data?.news.slice(0, limit).map(story => <Box component="article" key={`${story.publisher}:${story.id}:${story.publishedAt}:${story.headline}`} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1.25, overflowWrap: 'anywhere' }}>
          <Link href={story.url} target="_blank" rel="noopener noreferrer" color="text.primary" underline="hover" sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{story.headline}</Link>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>{story.publisher} · <time dateTime={story.publishedAt}>{localTime(story.publishedAt)}</time></Typography>
          {story.excerpt && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{story.excerpt}</Typography>}
          <Typography variant="caption" color="primary.main">{t(`news.categories.${story.category}`)}</Typography>
        </Box>)}
        {data && !data.news.length && !failed && !unsupported && !pending && !query.isError && <Typography variant="body2" color="text.secondary">{t('news.emptyNews')}</Typography>}
        {data && data.news.length > limit && <Button size="small" onClick={() => setLimit(limit + 6)}>{t('news.more')}</Button>}
        {data?.coverage.some(row => row.source === 'Company news') && <Typography variant="caption" color="text.secondary">{t('news.companyLimited')}</Typography>}
      </Stack>}
    </Box>
    <Box role="tabpanel" id={`${id}-events-panel`} aria-labelledby={`${id}-events-tab`} hidden={tab !== 1}>
      {tab === 1 && <Stack spacing={1.5}>
        {(['UPCOMING', 'AWAITING_RESULT', 'RELEASED', 'CANCELLED'] as const).map(status => {
          const events = data?.events.filter(event => event.status === status) ?? []
          return events.length ? <Stack key={status} spacing={1}>
            <Typography component="h3" variant="overline" color="text.secondary">{t(`news.status.${status}`)}</Typography>
            {events.slice(0, eventLimit).map(event => <Box key={event.id} component="article" sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1.25 }}>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center"><Typography variant="caption">{event.scheduledAt ? localTime(event.scheduledAt) : event.publishedAt ? localTime(event.publishedAt) : `${event.scheduledDate} · ${t('news.timeUnconfirmed')}`}</Typography><Chip size="small" variant="outlined" label={event.region} sx={{ height: 20, fontSize: 10 }} /></Stack>
              <Link href={event.url} target="_blank" rel="noopener noreferrer" color="text.primary" underline="hover" sx={{ fontSize: 14, fontWeight: 600 }}>{event.name}</Link>
              {event.referencePeriod && <Typography variant="caption" display="block">{t('news.period')}: {event.referencePeriod}{event.actual?.adjustment ? ` · ${event.actual.adjustment}` : ''}</Typography>}
              {(status === 'RELEASED' || status === 'AWAITING_RESULT') && <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} sx={{ mt: 0.5 }}>
                <Typography variant="caption">{t('news.actual')}: {figure(event.actual)}</Typography>
                {forecastPresent && <Typography variant="caption">{t('news.forecast')}: {figure(event.forecast)}</Typography>}
                {event.previous && <Typography variant="caption">{t('news.previous')}: {figure(event.previous)} · {event.previous.period}</Typography>}
                {event.revisedPrevious && <Typography variant="caption">{t('news.revisedPrevious')}: {figure(event.revisedPrevious)}</Typography>}
                {forecastDifference(event.actual, event.forecast) != null && <Typography variant="caption">Δ {number(forecastDifference(event.actual, event.forecast)!)}</Typography>}
              </Stack>}
              <Typography variant="caption" display="block" color="text.secondary">{event.source} · {t(`news.categories.${event.category}`)}{sourceFetch(event.source, event.publishedAt ? 'NEWS' : 'CALENDAR') ? ` · ${t('news.updated')}: ${localTime(sourceFetch(event.source, event.publishedAt ? 'NEWS' : 'CALENDAR')!)}` : ''}{event.sourceUpdatedAt ? ` · ${localTime(event.sourceUpdatedAt)}` : ''}</Typography>
            </Box>)}
            {events.length > eventLimit && <Button size="small" onClick={() => setEventLimit(eventLimit + 6)}>{t('news.more')}</Button>}
          </Stack> : null
        })}
        {data && !data.events.length && !failed && !unsupported && !pending && !query.isError && <Typography variant="body2" color="text.secondary">{t('news.emptyEvents')}</Typography>}
        {data?.coverage.some(row => row.capability === 'OBSERVATIONS' && ['FAILED', 'STALE', 'PENDING'].includes(row.state)) && <Typography variant="caption" color="text.secondary">{t('news.observationsIncomplete')}</Typography>}
        {!!data?.observations.length && <Box component="details" sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
          <Box component="summary" sx={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{t('news.observations')}</Box>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ my: 1 }}>{t('news.observationBoundary')}</Typography>
          {data.observations.map(item => <Box key={item.id} sx={{ mb: 1.5 }}>
            <Link href={item.url} target="_blank" rel="noopener noreferrer" variant="body2">{item.name}</Link>
            <Typography variant="body2">{figure(item.actual)} · {item.actual.period} · {item.actual.adjustment}</Typography>
            {item.previous && <Typography variant="caption" display="block">{t('news.previous')}: {figure(item.previous)} · {item.previous.period}</Typography>}
            <Typography variant="caption" display="block" color="text.secondary">{item.source}{sourceFetch(item.source, 'OBSERVATIONS', item.id) ? ` · ${t('news.updated')}: ${localTime(sourceFetch(item.source, 'OBSERVATIONS', item.id)!)}` : ''}{item.sourceUpdatedAt ? ` · ${t('news.datasetUpdated')}: ${localTime(item.sourceUpdatedAt)}` : ''}</Typography>
            {item.flag && <Typography variant="caption" display="block" color="text.secondary">{item.flag}</Typography>}
          </Box>)}
        </Box>}
      </Stack>}
    </Box>
    <Typography variant="caption" color="text.secondary">{t('news.freeSources')}</Typography>
    <Box component="details">
      <Box component="summary" sx={{ fontSize: 12, cursor: 'pointer', color: 'text.secondary' }}>{t('news.sourceCoverage')}</Box>
      <Stack spacing={0.5} sx={{ pt: 1 }}>
        {data?.coverage.map((row, index) => <Typography key={`${row.source}:${index}`} variant="caption" color="text.secondary">{row.source} · {t(`news.capabilities.${row.capability}`)} · {t(`news.coverageStates.${row.state}`)}{row.lastSuccessAt ? ` · ${localTime(row.lastSuccessAt)}` : ''}</Typography>)}
      </Stack>
    </Box>
  </WorkstationCard>
}
