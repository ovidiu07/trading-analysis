import { Box, Chip, Link, Stack, Typography } from '@mui/material'
import { useI18n } from '../../i18n'
import { canShowEventActual, type BriefingEvent } from './model'

export default function EventDetails({ event, referenceTime }: { event: BriefingEvent; referenceTime?: string }) {
 const { t, locale } = useI18n()
 const actual = canShowEventActual(event, referenceTime) ? event.actual : null
 const time = event.scheduledAt ? new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Bucharest', dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.scheduledAt))
   : `${event.scheduledDate ?? '—'} · ${t('officialEvents.timeUnavailable')}`
 const source = (label: string, url?: string | null) => url && /^https?:\/\//.test(url)
   ? <Link href={url} target="_blank" rel="noopener noreferrer" variant="caption">{label}</Link> : <span>{label}</span>
 return <Stack spacing={0.5} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider', overflowWrap: 'anywhere' }}>
   <Typography variant="body2" fontWeight={600}>{event.name}</Typography>
   {event.impact ? <Chip size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }} label={t(`workstation.impact.${event.impact.toLowerCase()}`)} /> : null}
   <Typography variant="caption">{time} · {event.scheduledAt ? 'Europe/Bucharest · ' : ''}{event.region} · {t(`workstation.eventStatus.${event.status}`)} · {event.timezone}</Typography>
   <Box>{source(event.source, event.sourceUrl)}</Box>
   <Typography variant="caption">{t('workstation.eventActual')}: {actual ?? t('workstation.unavailable')}{actual && event.unit ? ` ${event.unit}` : ''}</Typography>
   <Typography variant="caption">{t('workstation.eventForecast')}: {event.forecast && event.forecastSourceUrl ? event.forecast : t('workstation.unavailable')}{event.forecast && event.forecastSourceUrl ? <> · {source(t('workstation.source'), event.forecastSourceUrl)}</> : null}</Typography>
   <Typography variant="caption">{t('workstation.eventPrevious')}: {event.previous && event.previousSourceUrl ? <>{event.previous} · {source(t('workstation.source'), event.previousSourceUrl)}</> : t('workstation.unavailable')}</Typography>
   {actual && event.publishedAt ? <Typography variant="caption">{t('editorial.publishedAt')}: {event.publishedAt}</Typography> : null}
   {event.official ? <>
     <Typography variant="caption">{event.official.measure} {event.official.referencePeriod} · {event.official.seriesId}</Typography>
     <Typography variant="caption">{t('workstation.retrievedAt')}: {event.official.retrievedAt}</Typography>
     <Typography variant="caption">{event.official.resultRetrievedAt ? `${t('officialEvents.resultData')} · ${t('workstation.retrievedAt')}: ${event.official.resultRetrievedAt}` : null}</Typography>
     <Typography variant="caption">{event.official.sourceId} · {event.official.eventId}</Typography>
     {event.official.previousScheduledDate ? <Typography variant="caption">{t('officialEvents.previouslyScheduled')}: {event.official.previousScheduledAt ?? event.official.previousScheduledDate}</Typography> : null}
     <Box>{event.official.publicationSourceUrl ? source(t('officialEvents.publicationEvidence'), event.official.publicationSourceUrl) : null}{event.official.resultSourceUrl ? <> · {source(t('officialEvents.resultData'), event.official.resultSourceUrl)}</> : null}</Box>
   </> : null}
   {event.explanation ? <Typography variant="caption" color="text.secondary">{event.explanation}</Typography> : null}
 </Stack>
}
