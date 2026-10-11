import { useId, useMemo, useState } from 'react'
import {
  alpha, Alert, Box, Button, ButtonBase, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, IconButton, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography, useMediaQuery, useTheme
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth,
  parseISO, startOfMonth, startOfWeek, subMonths
} from 'date-fns'
import type { BacktestingTrade } from '../../api/backtesting'
import EmptyState from '../../components/ui/EmptyState'
import { useI18n } from '../../i18n'
import {
  CalendarPeriod, calendarPeriod, calendarPeriodValue, calendarResearchTrades,
  calendarTradeDate, groupCalendarPeriods, rankCalendarPeriods
} from './calendar'
import { computeResearchMetrics } from './research'
import { AnalysisBasis, formatBasis, formatMoney } from './ResearchPerformance'
import ReplayTradeDetails from './ReplayTradeDetails'

export default function BacktestingCalendar({ workspaceId, trades }: { workspaceId: string; trades: BacktestingTrade[] }) {
  const { t, locale } = useI18n()
  const theme = useTheme()
  const compact = useMediaQuery('(max-width:560px)')
  const mobile = useMediaQuery(theme.breakpoints.down('sm'))
  const light = theme.palette.mode === 'light'
  const dialogTitleId = useId()
  const rows = useMemo(() => calendarResearchTrades(trades, workspaceId), [trades, workspaceId])
  const latestDate = rows.reduce((latest, trade) => calendarTradeDate(trade) > latest ? calendarTradeDate(trade) : latest, '')
  const [month, setMonth] = useState(() => startOfMonth(latestDate ? parseISO(latestDate) : new Date()))
  const metrics = useMemo(() => computeResearchMetrics(rows), [rows])
  const currencies = Object.keys(metrics.currencyMetrics || {}).sort()
  const [basis, setBasis] = useState<string | null>(null)
  const currency = basis != null && (basis === '' || currencies.includes(basis)) ? basis : currencies[0] || ''
  const cashCurrency = currency || (currencies.length === 1 ? currencies[0] : '')
  const [selection, setSelection] = useState<{ start: string; end: string } | null>(null)
  const [detail, setDetail] = useState<BacktestingTrade | null>(null)
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const monthKey = format(month, 'yyyy-MM')
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const daily = useMemo(() => new Map(groupCalendarPeriods(rows, 'day').map(period => [period.start, period])), [rows])
  const weeks = useMemo(() => groupCalendarPeriods(rows, 'week'), [rows])
  const months = useMemo(() => groupCalendarPeriods(rows, 'month'), [rows])
  const summary = calendarPeriod(rows, format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd'))
  const visibleWeeks: CalendarPeriod[] = []
  for (let start = calendarStart; start <= calendarEnd; start = addDays(start, 7)) {
    const from = format(start < monthStart ? monthStart : start, 'yyyy-MM-dd')
    const weekEnd = addDays(start, 6)
    const to = format(weekEnd > monthEnd ? monthEnd : weekEnd, 'yyyy-MM-dd')
    visibleWeeks.push(calendarPeriod(rows, from, to))
  }
  const selected = selection ? calendarPeriod(rows, selection.start, selection.end) : null
  const amount = (period: CalendarPeriod, selectedCurrency = currency) => formatBasis(calendarPeriodValue(period, selectedCurrency), selectedCurrency, locale)
  const dateLabel = (date: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(parseISO(date))
  const periodLabel = (period: { start: string; end: string }) => period.start === period.end ? dateLabel(period.start) : `${dateLabel(period.start)} – ${dateLabel(period.end)}`
  const cashLabel = (period: CalendarPeriod) => cashCurrency ? amount(period, cashCurrency) : currencies.length > 1 ? t('backtesting.calendar.selectCurrency') : '—'
  const coverage = (period: CalendarPeriod) => t('backtesting.calendar.coverage', {
    known: currency ? period.metrics.currencyMetrics?.[currency]?.trades || 0 : period.metrics.rSampleSize || 0,
    total: period.metrics.trades
  })
  const openPeriod = (period: { start: string; end: string }) => setSelection({ start: period.start, end: period.end })
  const changeMonth = (next: Date) => { setMonth(startOfMonth(next)); setSelection(null); setDetail(null) }
  const valueColor = (value: number | null) => value == null || value === 0 ? 'text.primary' : value > 0 ? 'success.main' : 'error.main'

  const renderDay = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd')
    const period = daily.get(key)
    const value = period ? calendarPeriodValue(period, currency) : null
    const tone = value != null && value !== 0 ? value > 0 ? theme.palette.success.main : theme.palette.error.main : null
    const label = period ? amount(period) : '—'
    return <ButtonBase key={key} onClick={() => openPeriod({ start: key, end: key })}
      aria-label={t('backtesting.calendar.dayAria', { date: key, count: period?.metrics.trades || 0, value: label })}
      sx={{
        textAlign: 'left', borderRadius: 2, border: '1px solid',
        borderColor: tone ? light ? alpha(tone, 0.72) : tone : light ? alpha(theme.palette.text.secondary, 0.45) : 'divider',
        bgcolor: tone ? alpha(tone, light ? value! > 0 ? 0.14 : 0.13 : 0.25) : light ? alpha(theme.palette.grey[100], 0.95) : alpha(theme.palette.background.paper, 0.78),
        width: '100%', minHeight: compact ? 68 : { xs: 92, md: 110 }, p: compact ? 1.25 : { xs: 1, md: 1.5 },
        minWidth: 0, opacity: isSameMonth(day, month) ? 1 : 0.45, justifyContent: 'flex-start',
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 }
      }}>
      <Stack direction={compact ? 'row' : 'column'} spacing={0.5} justifyContent="space-between" sx={{ width: '100%', minWidth: 0, height: '100%' }}>
        <Stack spacing={0.25}>
          <Typography variant="subtitle2" fontWeight={600}>{compact ? new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(day) : format(day, 'd')}</Typography>
          <Typography variant="caption" color="text.secondary">{period ? t('calendar.tradeCount', { count: period.metrics.trades }) : t('calendar.noTrades')}</Typography>
        </Stack>
        <Stack spacing={0.5} alignItems={compact ? 'flex-end' : 'flex-start'} sx={{ minWidth: 0 }}>
          <Box sx={{ px: 0.75, py: 0.25, borderRadius: 1, bgcolor: tone ? light ? alpha(tone, 0.92) : tone : alpha(theme.palette.text.secondary, light ? 0.22 : 0.9), color: tone ? light ? 'common.white' : 'common.black' : light ? 'text.primary' : 'background.default', fontSize: '0.8rem', fontWeight: 700, overflowWrap: 'anywhere', maxWidth: '100%' }}>{label}</Box>
          {period && <Typography variant="caption" color="text.secondary">{coverage(period)}</Typography>}
        </Stack>
      </Stack>
    </ButtonBase>
  }

  const ranking = (title: string, periods: CalendarPeriod[], unit: 'week' | 'month') => {
    const ranked = rankCalendarPeriods(periods, currency)
    return <Card variant="outlined" sx={{ height: '100%' }}><CardContent>
      <Typography component="h3" variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>{title}</Typography>
      <Stack spacing={0.75}>
        {ranked.length ? ranked.map((period, index) => <ButtonBase key={period.start} onClick={() => {
          setMonth(startOfMonth(parseISO(period.trades.map(calendarTradeDate).sort()[0])))
          openPeriod(period)
        }} sx={{ textAlign: 'left', width: '100%', p: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider', '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main' } }}>
          <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ width: '100%', minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={700}>{index + 1}. {unit === 'month' ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(parseISO(period.start)) : periodLabel(period)}</Typography><Typography variant="caption" color="text.secondary">{t('calendar.tradeCount', { count: period.metrics.trades })} · {coverage(period)}</Typography></Box>
            <Typography variant="body2" fontWeight={800} sx={{ color: valueColor(calendarPeriodValue(period, currency)), overflowWrap: 'anywhere' }}>{amount(period)}</Typography>
          </Stack>
        </ButtonBase>) : <Typography variant="body2" color="text.secondary">{t('backtesting.calendar.noRankedPeriods')}</Typography>}
      </Stack>
    </CardContent></Card>
  }

  return <Stack spacing={2}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
      <Box><Typography component="h2" variant="h6" fontWeight={850}>{t('backtesting.calendar.title')}</Typography><Typography variant="body2" color="text.secondary">{t('backtesting.calendar.description')}</Typography></Box>
      <AnalysisBasis metrics={metrics} value={currency} onChange={setBasis} />
    </Stack>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" justifyContent="space-between">
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <IconButton aria-label={t('calendar.previousMonth')} onClick={() => changeMonth(subMonths(month, 1))} sx={{ width: 44, height: 44 }}><ChevronLeftIcon /></IconButton>
        <Typography variant="h6" textAlign="center">{monthLabel}</Typography>
        <IconButton aria-label={t('calendar.nextMonth')} onClick={() => changeMonth(addMonths(month, 1))} sx={{ width: 44, height: 44 }}><ChevronRightIcon /></IconButton>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
        <TextField size="small" type="month" label={t('backtesting.calendar.jumpToMonth')} value={monthKey} InputLabelProps={{ shrink: true }} onChange={event => {
          if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) && !event.target.value.startsWith('0000')) changeMonth(parseISO(`${event.target.value}-01`))
        }} sx={{ flex: 1, minWidth: 150 }} />
        <Button size="small" disabled={!latestDate} onClick={() => changeMonth(parseISO(latestDate))}>{t('backtesting.calendar.latestTrade')}</Button>
      </Stack>
    </Stack>
    {metrics.rSampleSize !== metrics.trades && <Alert severity="info">{t('backtesting.replay.rCoverage', { known: metrics.rSampleSize || 0, total: metrics.trades })}</Alert>}
    {currency && <Alert severity="info">{t('backtesting.replay.moneyCoverage', { count: metrics.currencyMetrics?.[currency]?.trades || 0, total: metrics.trades, currency })}</Alert>}
    <Card><CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Stack spacing={2}>
        <Box sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.background.default, 0.45) }}>
          <Grid container spacing={2}>
            {[
              [t('backtesting.calendar.monthlyR'), amount(summary, '')],
              [t('calendar.monthlyRealizedNet'), cashLabel(summary)],
              [t('calendar.tradesClosed'), summary.metrics.trades],
              [t('backtesting.metrics.winRate'), summary.metrics.trades ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(summary.metrics.winRate)}%` : '—']
            ].map(([label, value]) => <Grid item xs={6} md={3} key={label}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>{value}</Typography></Grid>)}
          </Grid>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{monthLabel} · {coverage(summary)}</Typography>
        </Box>
        <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
          {(['profit', 'loss', 'flat'] as const).map(key => <Stack key={key} direction="row" spacing={0.75} alignItems="center"><Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: key === 'flat' ? 'action.hover' : alpha(theme.palette[key === 'profit' ? 'success' : 'error'].main, 0.4), border: '1px solid', borderColor: key === 'flat' ? 'divider' : `${key === 'profit' ? 'success' : 'error'}.main` }} /><Typography variant="caption">{t(`calendar.legend.${key}`)}</Typography></Stack>)}
          <Typography variant="caption" color="text.secondary">{t('backtesting.calendar.unavailable')}</Typography>
        </Stack>
        {compact ? <Stack spacing={1}>{days.filter(day => isSameMonth(day, month)).map(renderDay)}</Stack> : <Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 1, mb: 1 }}>
            {Array.from({ length: 7 }, (_, index) => <Typography key={index} variant="caption" color="text.secondary" textAlign="center" fontWeight={600}>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(addDays(calendarStart, index))}</Typography>)}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: 0.5, sm: 1 }, gridAutoRows: 'minmax(110px, auto)' }}>{days.map(renderDay)}</Box>
        </Box>}
        {!summary.metrics.trades && <EmptyState title={t('backtesting.calendar.emptyMonth')} description={t('backtesting.calendar.emptyBody')} />}
      </Stack>
    </CardContent></Card>
    <Card variant="outlined"><CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Typography component="h3" variant="subtitle1" fontWeight={800}>{t('backtesting.calendar.weeklySummary')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('backtesting.calendar.weeklyDescription')}</Typography>
      {compact ? <Stack component="ul" aria-label={t('backtesting.calendar.weeklySummary')} spacing={1} sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {visibleWeeks.map(period => <Box component="li" key={period.start} sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Button size="small" onClick={() => openPeriod(period)} sx={{ p: 0, textAlign: 'left', justifyContent: 'flex-start' }}>{periodLabel(period)}</Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', my: 0.75 }}>{t('calendar.tradeCount', { count: period.metrics.trades })} · {t('backtesting.metrics.winRate')}: {period.metrics.trades ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(period.metrics.winRate)}%` : '—'}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
            <Box><Typography variant="caption" color="text.secondary">R</Typography><Typography variant="body2" fontWeight={800}>{amount(period, '')}</Typography><Typography variant="caption" color="text.secondary">{t('backtesting.calendar.coverage', { known: period.metrics.rSampleSize || 0, total: period.metrics.trades })}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">{cashCurrency || t('backtesting.replay.netPnl')}</Typography><Typography variant="body2" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>{cashLabel(period)}</Typography>{cashCurrency && <Typography variant="caption" color="text.secondary">{t('backtesting.calendar.coverage', { known: period.metrics.currencyMetrics?.[cashCurrency]?.trades || 0, total: period.metrics.trades })}</Typography>}</Box>
          </Box>
        </Box>)}
      </Stack> : <TableContainer><Table size="small" aria-label={t('backtesting.calendar.weeklySummary')}><TableHead><TableRow>
        {[t('backtesting.calendar.week'), t('backtesting.metrics.trades'), t('backtesting.metrics.winRate'), 'R', cashCurrency || t('backtesting.replay.netPnl')].map(label => <TableCell key={label}>{label}</TableCell>)}
      </TableRow></TableHead><TableBody>{visibleWeeks.map(period => <TableRow key={period.start}>
        <TableCell><Button size="small" onClick={() => openPeriod(period)} sx={{ textAlign: 'left', justifyContent: 'flex-start' }}>{periodLabel(period)}</Button></TableCell>
        <TableCell>{period.metrics.trades}</TableCell><TableCell>{period.metrics.trades ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(period.metrics.winRate)}%` : '—'}</TableCell>
        <TableCell><Typography variant="body2" fontWeight={700}>{amount(period, '')}</Typography><Typography variant="caption" color="text.secondary">{t('backtesting.calendar.coverage', { known: period.metrics.rSampleSize || 0, total: period.metrics.trades })}</Typography></TableCell>
        <TableCell><Typography variant="body2" fontWeight={700}>{cashLabel(period)}</Typography>{cashCurrency && <Typography variant="caption" color="text.secondary">{t('backtesting.calendar.coverage', { known: period.metrics.currencyMetrics?.[cashCurrency]?.trades || 0, total: period.metrics.trades })}</Typography>}</TableCell>
      </TableRow>)}</TableBody></Table></TableContainer>}
    </CardContent></Card>
    <Typography variant="body2" color="text.secondary">{t('backtesting.calendar.rankingDescription', { basis: currency || 'R' })}</Typography>
    <Grid container spacing={1.5} sx={{ width: 'auto' }}><Grid item xs={12} md={6}>{ranking(t('backtesting.calendar.bestWeeks'), weeks, 'week')}</Grid><Grid item xs={12} md={6}>{ranking(t('backtesting.calendar.bestMonths'), months, 'month')}</Grid></Grid>
    <Dialog open={Boolean(selected)} onClose={() => setSelection(null)} fullWidth fullScreen={mobile} maxWidth="sm" aria-labelledby={dialogTitleId}>
      <DialogTitle id={dialogTitleId}>{t('backtesting.calendar.periodTrades', { period: selected ? periodLabel(selected) : '' })}</DialogTitle>
      <DialogContent dividers>{selected && <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Chip label={t('calendar.tradeCount', { count: selected.metrics.trades })} /><Chip label={amount(selected, '')} /><Chip label={cashLabel(selected)} /></Stack>
        {!selected.trades.length && <Typography color="text.secondary">{t('calendar.noTrades')}</Typography>}
        {[...selected.trades].sort((a, b) => `${calendarTradeDate(a)}T${a.exitTime || a.entryTime}`.localeCompare(`${calendarTradeDate(b)}T${b.exitTime || b.entryTime}`) || a.id.localeCompare(b.id)).map(trade => <Box key={trade.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.52), border: '1px solid', borderColor: 'divider' }}>
          <Stack spacing={0.75}>
            <Stack direction="row" justifyContent="space-between" spacing={1}><Typography variant="subtitle2">{trade.instrument} · {t(`backtesting.direction.${trade.direction}`)}</Typography><Chip size="small" label={t(`backtesting.results.${trade.result}`)} /></Stack>
            <Typography variant="caption" color="text.secondary">{t('backtesting.replay.entry')}: {dateLabel(trade.date)} {trade.entryTime} · {t('backtesting.sources.' + trade.source)}</Typography>
            {trade.exitDate && <Typography variant="caption" color="text.secondary">{t('backtesting.replay.exit')}: {dateLabel(trade.exitDate)} {trade.exitTime || ''}</Typography>}
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap"><Typography variant="body2" fontWeight={800}>{formatBasis(trade.pnlR, '', locale)}</Typography><Typography variant="body2" fontWeight={800}>{formatMoney(trade.netPnl, trade.currency, locale)}</Typography></Stack>
            {(trade.setupName || trade.strategyNameSnapshot) && <Typography variant="body2" color="text.secondary">{trade.strategyNameSnapshot || trade.setupName}</Typography>}
            {trade.plannedRR != null && <Typography variant="body2" color="text.secondary">{t('backtesting.trades.plannedRR')}: 1:{trade.plannedRR}</Typography>}
            {trade.notes && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{trade.notes}</Typography>}
            {trade.importFormat && <Button size="small" onClick={() => setDetail(trade)} sx={{ alignSelf: 'flex-start' }}>{t('backtesting.replay.details')}</Button>}
          </Stack>
        </Box>)}
      </Stack>}</DialogContent>
      <DialogActions><Button onClick={() => setSelection(null)}>{t('backtesting.replay.done')}</Button></DialogActions>
    </Dialog>
    {detail && <ReplayTradeDetails trade={detail} onClose={() => setDetail(null)} />}
  </Stack>
}
