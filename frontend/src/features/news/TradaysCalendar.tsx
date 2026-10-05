import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Link, Stack, Typography, useTheme } from '@mui/material'
import { useI18n } from '../../i18n'
import { imminentTradaysEvents, type TradaysCoverage } from './tradaysWarnings'

export function useContextClock(clock: () => number = Date.now) {
  const [now, setNow] = useState(clock)
  useEffect(() => {
    const update = () => setNow(clock())
    const timer = globalThis.setInterval(update, 1_000)
    globalThis.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => { globalThis.clearInterval(timer); globalThis.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update) }
  }, [clock])
  return now
}
export function TradaysWarning({ data, now, date, timezone, frozen, compact = false }: { data: TradaysCoverage; now: number; date: string; timezone: string; frozen: boolean; compact?: boolean }) {
  const { t, locale } = useI18n()
  const result = imminentTradaysEvents(data, now, date, timezone, frozen)
  if (result.state === 'HISTORICAL') return null
  return <Alert severity={result.events.length ? 'warning' : 'info'} role="status" sx={{ py: 0.5, '& .MuiAlert-message': { minWidth: 0, overflowWrap: 'anywhere' } }}>
    <Typography variant="body2">{t(compact && !result.events.length && result.state !== 'CLEAR' ? 'chartPlan.eventsUnavailable' : `news.tradays.warning.${result.state}`)}</Typography>
    {result.events.map(event => <Typography key={event.id} variant="body2">
      {event.name} · {event.region} / {event.currency} · {new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(event.scheduledAt!))} · {t('news.inMinutes', { minutes: Math.ceil((Date.parse(event.scheduledAt!) - now) / 60_000) })}
    </Typography>)}
  </Alert>
}
/** Generated official HTML, unchanged inside a separate document; no widget content access. */
export default function TradaysCalendar({ live, timezone }: { live: boolean; timezone: string }) {
  const { t } = useI18n()
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  const srcDoc = useMemo(() => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%}body{display:flex;flex-direction:column}main{flex:1;min-height:0}</style></head><body><main>
<div id="economicCalendarWidget"></div>
<div class="ecw-copyright"><a href="https://www.mql5.com/?utm_source=calendar.widget&utm_medium=link&utm_term=economic.calendar&utm_content=visit.mql5.calendar&utm_campaign=202.calendar.widget" rel="noopener nofollow" target="_blank">MQL5 Algo Trading Community</a></div>
<script async type="text/javascript" data-type="calendar-widget" src="https://www.tradays.com/c/js/widgets/calendar/widget.js?v=15">
  {"width":"100%","height":"100%","mode":"1","fw":"html","lang":"en"${dark ? ',"theme":1' : ''}}
</script>
</main></body></html>`, [dark])
  return <Stack spacing={1} sx={{ minWidth: 0 }}>
    <Typography variant="subtitle2">Tradays</Typography>
    <Typography variant="caption" color="text.secondary">{t('news.tradays.scope')}</Typography>
    {live ? <>
      <Alert severity="info" sx={{ py: 0 }}>{t('news.tradays.limits', { timezone })}</Alert>
      {<Box component="iframe" title={t('news.tradays.title')} srcDoc={srcDoc} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" sx={{ border: 0, width: '100%', minWidth: 0, height: { xs: 480, md: 560 }, bgcolor: 'background.paper' }} />}
      <Typography variant="caption" color="text.secondary">{t('news.tradays.unverified')}</Typography>
    </> : <Typography role="status" variant="body2">{t('news.tradays.history')}</Typography>}
    <Link href="https://www.tradays.com/en/economic-calendar" target="_blank" rel="noopener noreferrer" variant="caption">{t('news.tradays.open')}</Link>
  </Stack>
}
