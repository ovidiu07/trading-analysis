import { useEffect, useMemo, useRef, useState } from 'react'
import {
  alpha,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { useAuth } from '../auth/AuthContext'
import { DailyPnlResponse, MonthlyPnlSummaryResponse, fetchMonthlyPnlSummary, listClosedTradesForDate, fetchDailyPnl, TradeResponse } from '../api/trades'
import { NotebookNoteSummary, listNotebookNotesByDate } from '../api/notebook'
import { formatCompactCurrency, formatDateTime, formatSignedCurrency } from '../utils/format'
import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/ui/EmptyState'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import { useDemoData } from '../features/demo/DemoDataContext'

const weekStartsOn = 1

export default function CalendarPage() {
  const { t, locale } = useI18n()
  const theme = useTheme()
  const isLightMode = theme.palette.mode === 'light'
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'))
  const isCompact = useMediaQuery('(max-width:560px)')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refreshToken } = useDemoData()
  const baseCurrency = user?.baseCurrency || 'USD'
  const timezone = user?.timezone || 'Europe/Bucharest'

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [dailyPnl, setDailyPnl] = useState<DailyPnlResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [monthSummary, setMonthSummary] = useState<MonthlyPnlSummaryResponse | null>(null)
  const [monthSummaryLoading, setMonthSummaryLoading] = useState(false)
  const [monthSummaryError, setMonthSummaryError] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTrades, setSelectedTrades] = useState<TradeResponse[]>([])
  const [selectedNotes, setSelectedNotes] = useState<NotebookNoteSummary[]>([])
  const [selectedLoading, setSelectedLoading] = useState(false)
  const [selectedError, setSelectedError] = useState('')
  const [selectedNotesLoading, setSelectedNotesLoading] = useState(false)
  const [selectedNotesError, setSelectedNotesError] = useState('')

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth])
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth])
  const calendarStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn }), [monthStart])
  const calendarEnd = useMemo(() => endOfWeek(monthEnd, { weekStartsOn }), [monthEnd])
  const days = useMemo(() => eachDayOfInterval({ start: calendarStart, end: calendarEnd }), [calendarStart, calendarEnd])
  const monthDays = useMemo(() => days.filter((day) => isSameMonth(day, currentMonth)), [currentMonth, days])
  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    return eachDayOfInterval({ start: calendarStart, end: addDays(calendarStart, 6) }).map((day) => formatter.format(day))
  }, [calendarStart, locale])
  const monthKey = useMemo(() => format(currentMonth, 'yyyy-MM'), [currentMonth])
  const monthLabel = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(currentMonth), [currentMonth, locale])
  const summaryCacheKey = useMemo(() => `${monthKey}-${timezone}`, [monthKey, timezone])

  const pnlByDate = useMemo(() => new Map(dailyPnl.map((entry) => [entry.date, entry])), [dailyPnl])
  const monthSummaryCache = useRef(new Map<string, MonthlyPnlSummaryResponse>())

  useEffect(() => {
    monthSummaryCache.current.clear()
  }, [refreshToken])

  const derivedSummary = useMemo(() => {
    return dailyPnl.reduce((acc, entry) => {
      if (!entry.date.startsWith(monthKey)) {
        return acc
      }
      acc.netPnl += entry.netPnl
      acc.tradeCount += entry.tradeCount
      acc.tradingDays += 1
      return acc
    }, { netPnl: 0, tradeCount: 0, tradingDays: 0 })
  }, [dailyPnl, monthKey])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError('')
      try {
        const from = format(calendarStart, 'yyyy-MM-dd')
        const to = format(calendarEnd, 'yyyy-MM-dd')
        const data = await fetchDailyPnl({ from, to, tz: timezone, basis: 'close' })
        setDailyPnl(data)
      } catch (err) {
        const message = translateApiError(err, t, 'calendar.errors.loadCalendar')
        setError(message)
        setDailyPnl([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [calendarEnd, calendarStart, timezone, refreshToken])

  useEffect(() => {
    let active = true
    const cached = monthSummaryCache.current.get(summaryCacheKey)
    if (cached) {
      setMonthSummary(cached)
      setMonthSummaryLoading(false)
      setMonthSummaryError('')
      return
    }

    const loadSummary = async () => {
      setMonthSummaryLoading(true)
      setMonthSummaryError('')
      setMonthSummary(null)
      try {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth() + 1
        const data = await fetchMonthlyPnlSummary({ year, month, tz: timezone, basis: 'close' })
        if (!active) return
        monthSummaryCache.current.set(summaryCacheKey, data)
        setMonthSummary(data)
      } catch (err) {
        if (!active) return
        const message = translateApiError(err, t, 'calendar.errors.loadMonthlySummary')
        setMonthSummaryError(message)
      } finally {
        if (active) {
          setMonthSummaryLoading(false)
        }
      }
    }

    loadSummary()
    return () => {
      active = false
    }
  }, [currentMonth, summaryCacheKey, timezone, refreshToken])

  useEffect(() => {
    if (!selectedDate) return
    const loadTrades = async () => {
      setSelectedLoading(true)
      setSelectedError('')
      try {
        const dateKey = format(selectedDate, 'yyyy-MM-dd')
        const data = await listClosedTradesForDate(dateKey, timezone)
        setSelectedTrades(data)
      } catch (err) {
        const message = translateApiError(err, t, 'calendar.errors.loadTrades')
        setSelectedTrades([])
        setSelectedError(message)
      } finally {
        setSelectedLoading(false)
      }
    }
    loadTrades()
  }, [selectedDate, timezone, refreshToken])

  useEffect(() => {
    if (!selectedDate) return
    const loadNotes = async () => {
      setSelectedNotesLoading(true)
      setSelectedNotesError('')
      try {
        const dateKey = format(selectedDate, 'yyyy-MM-dd')
        const data = await listNotebookNotesByDate(dateKey, dateKey)
        setSelectedNotes(data)
      } catch (err) {
        const message = translateApiError(err, t, 'calendar.errors.loadNotes')
        setSelectedNotes([])
        setSelectedNotesError(message)
      } finally {
        setSelectedNotesLoading(false)
      }
    }
    loadNotes()
  }, [selectedDate, refreshToken])

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''
  const selectedAggregate = selectedDateKey ? pnlByDate.get(selectedDateKey) : undefined
  const selectedNetPnl = selectedAggregate?.netPnl ?? 0
  const selectedTradeCount = selectedAggregate?.tradeCount ?? selectedTrades.length

  const summaryNetPnl = monthSummary?.netPnl ?? derivedSummary.netPnl
  const summaryGrossPnl = monthSummary?.grossPnl
  const summaryTradeCount = monthSummary?.tradeCount ?? derivedSummary.tradeCount
  const summaryTradingDays = monthSummary?.tradingDays ?? derivedSummary.tradingDays
  const noteTypeLabels: Record<string, string> = {
    DAILY_LOG: t('notebook.noteType.DAILY_LOG'),
    TRADE_NOTE: t('notebook.noteType.TRADE_NOTE'),
    PLAN: t('notebook.noteType.PLAN'),
    GOAL: t('notebook.noteType.GOAL'),
    SESSION_RECAP: t('notebook.noteType.SESSION_RECAP'),
    NOTE: t('notebook.noteType.NOTE')
  }
  const showSummarySkeleton = (monthSummaryLoading || loading) && !monthSummary && dailyPnl.length === 0
  const showSummaryError = monthSummaryError && !monthSummary && dailyPnl.length === 0
  const hasGross = summaryGrossPnl !== undefined && summaryGrossPnl !== null
  const isSummaryPositive = summaryNetPnl > 0
  const isSummaryNegative = summaryNetPnl < 0
  const summaryBorderColor = isSummaryPositive
    ? theme.palette.success.main
    : isSummaryNegative
      ? theme.palette.error.main
      : theme.palette.divider
  const summaryBackground = isSummaryPositive
    ? alpha(theme.palette.success.main, isLightMode ? 0.14 : 0.2)
    : isSummaryNegative
      ? alpha(theme.palette.error.main, isLightMode ? 0.14 : 0.2)
      : isLightMode
        ? alpha(theme.palette.primary.main, 0.05)
        : alpha(theme.palette.background.paper, 0.82)
  const summaryTextColor = isSummaryPositive
    ? theme.palette.success.main
    : isSummaryNegative
      ? theme.palette.error.main
      : theme.palette.text.primary

  const resolveDayTone = (netPnl: number | undefined) => {
    const isPositive = netPnl !== undefined && netPnl > 0
    const isNegative = netPnl !== undefined && netPnl < 0

    if (isPositive) {
      return {
        isPositive,
        isNegative,
        backgroundColor: alpha(theme.palette.success.main, isLightMode ? 0.14 : 0.25),
        borderColor: isLightMode ? alpha(theme.palette.success.main, 0.72) : theme.palette.success.main,
        badgeColor: isLightMode ? alpha(theme.palette.success.main, 0.92) : theme.palette.success.main,
        badgeTextColor: isLightMode ? theme.palette.common.white : theme.palette.common.black
      }
    }

    if (isNegative) {
      return {
        isPositive,
        isNegative,
        backgroundColor: alpha(theme.palette.error.main, isLightMode ? 0.13 : 0.25),
        borderColor: isLightMode ? alpha(theme.palette.error.main, 0.72) : theme.palette.error.main,
        badgeColor: isLightMode ? alpha(theme.palette.error.main, 0.92) : theme.palette.error.main,
        badgeTextColor: isLightMode ? theme.palette.common.white : theme.palette.common.black
      }
    }

    return {
      isPositive,
      isNegative,
      backgroundColor: isLightMode
        ? alpha(theme.palette.grey[100], 0.95)
        : alpha(theme.palette.background.paper, 0.78),
      borderColor: isLightMode ? alpha(theme.palette.text.secondary, 0.45) : theme.palette.divider,
      badgeColor: isLightMode
        ? alpha(theme.palette.text.secondary, 0.22)
        : alpha(theme.palette.text.secondary, 0.9),
      badgeTextColor: isLightMode ? theme.palette.text.primary : theme.palette.background.default
    }
  }

  const handleDayClick = (day: Date) => {
    setSelectedDate(day)
  }

  const handleCloseDialog = () => {
    setSelectedDate(null)
    setSelectedTrades([])
    setSelectedError('')
    setSelectedNotes([])
    setSelectedNotesError('')
  }

  const handleViewInTrades = () => {
    if (!selectedDate) return
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    navigate(`/trades?closedDate=${dateKey}&status=CLOSED&tz=${encodeURIComponent(timezone)}`)
    handleCloseDialog()
  }

  const renderDayCell = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const entry = pnlByDate.get(dateKey)
    const netPnl = entry?.netPnl
    const isCurrentMonth = isSameMonth(day, currentMonth)
    const { isPositive, isNegative, backgroundColor, borderColor, badgeColor, badgeTextColor } = resolveDayTone(netPnl)
    const pnlLabel = netPnl === undefined
      ? t('common.na')
      : (isMobile ? formatCompactCurrency(netPnl, baseCurrency) : formatSignedCurrency(netPnl, baseCurrency))
    const ariaLabelParts = entry
      ? [
        t('calendar.aria.viewRealizedPnl', { date: dateKey }),
        t('calendar.aria.netPnl', { value: formatSignedCurrency(netPnl ?? 0, baseCurrency) }),
        t('calendar.aria.tradeCount', { count: entry.tradeCount })
      ]
      : [t('calendar.aria.viewRealizedPnl', { date: dateKey }), t('calendar.noTrades')]

    return (
      <ButtonBase
        key={dateKey}
        onClick={() => handleDayClick(day)}
        aria-label={ariaLabelParts.join('. ')}
        sx={{
          textAlign: 'left',
          borderRadius: 2,
          border: '1px solid',
          borderColor,
          backgroundColor,
          width: '100%',
          height: '100%',
          minHeight: { xs: 72, sm: 92, md: 110 },
          p: { xs: 1, sm: 1.25, md: 1.5 },
          opacity: isCurrentMonth ? 1 : 0.45,
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          minWidth: 0,
          overflow: 'hidden'
        }}
      >
        <Stack spacing={0.5} sx={{ width: '100%', minWidth: 0, height: '100%', justifyContent: 'space-between' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant={isMobile ? 'body2' : 'subtitle2'} fontWeight={600}>
              {format(day, 'd')}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem' }}
            >
              {entry ? t('calendar.tradeCount', { count: entry.tradeCount }) : t('calendar.noTrades')}
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex' }}>
            <Box
              sx={{
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
                bgcolor: badgeColor,
                color: badgeTextColor,
                fontSize: isMobile ? '0.7rem' : '0.75rem',
                fontWeight: 600,
                lineHeight: 1.2,
                whiteSpace: 'nowrap'
              }}
            >
              {pnlLabel}
            </Box>
          </Box>
        </Stack>
      </ButtonBase>
    )
  }

  const renderDayRow = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const entry = pnlByDate.get(dateKey)
    const netPnl = entry?.netPnl
    const { isPositive, isNegative, backgroundColor, borderColor, badgeColor, badgeTextColor } = resolveDayTone(netPnl)
    const pnlLabel = netPnl === undefined ? t('common.na') : formatSignedCurrency(netPnl, baseCurrency)
    const tradeLabel = entry ? t('calendar.tradeCount', { count: entry.tradeCount }) : t('calendar.noTrades')
    const ariaLabelParts = entry
      ? [
        t('calendar.aria.viewRealizedPnl', { date: dateKey }),
        t('calendar.aria.netPnl', { value: formatSignedCurrency(netPnl ?? 0, baseCurrency) }),
        t('calendar.aria.tradeCount', { count: entry.tradeCount })
      ]
      : [t('calendar.aria.viewRealizedPnl', { date: dateKey }), t('calendar.noTrades')]

    return (
      <ButtonBase
        key={dateKey}
        onClick={() => handleDayClick(day)}
        aria-label={ariaLabelParts.join('. ')}
        sx={{
          textAlign: 'left',
          borderRadius: 2,
          border: '1px solid',
          borderColor,
          backgroundColor,
          width: '100%',
          p: 1.25,
          minHeight: 68,
          alignItems: 'center',
          justifyContent: 'flex-start'
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ width: '100%', minWidth: 0 }}>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={600} noWrap>
              {new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(day)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {tradeLabel}
            </Typography>
          </Stack>
          <Box
            sx={{
              px: 1,
              py: 0.4,
              borderRadius: 1,
              bgcolor: badgeColor,
              color: badgeTextColor,
              fontSize: '0.8rem',
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: 'nowrap'
            }}
          >
            {pnlLabel}
          </Box>
        </Stack>
      </ButtonBase>
    )
  }

  return (
    <Stack spacing={isCompact ? 2 : 3}>
      <Box
        sx={{
          width: { xs: '100%', md: 'auto' },
          display: 'grid',
          gridTemplateColumns: { xs: '44px 1fr 44px', sm: 'auto auto auto' },
          alignItems: 'center',
          gap: { xs: 1, sm: 1.5 },
          justifyContent: { xs: 'center', sm: 'flex-start' }
        }}
      >
        <IconButton
          aria-label={t('calendar.previousMonth')}
          onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
          sx={{ width: 44, height: 44 }}
        >
          <ChevronLeftIcon />
        </IconButton>
        <Typography
          variant={isMobile ? 'subtitle1' : 'h6'}
          textAlign="center"
          sx={{ minWidth: 0, whiteSpace: 'nowrap' }}
        >
          {monthLabel}
        </Typography>
        <IconButton
          aria-label={t('calendar.nextMonth')}
          onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
          sx={{ width: 44, height: 44 }}
        >
          <ChevronRightIcon />
        </IconButton>
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Box
            sx={{
              mb: { xs: 1.5, sm: 2 },
              p: { xs: 1.5, sm: 2 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: summaryBorderColor,
              bgcolor: summaryBackground
            }}
          >
            <Stack
              direction={isCompact ? 'column' : 'row'}
              spacing={isCompact ? 1.5 : 3}
              alignItems={isCompact ? 'center' : 'flex-start'}
              justifyContent="space-between"
            >
              <Stack
                spacing={0.5}
                sx={{ minWidth: 0, width: isCompact ? '100%' : 'auto' }}
                alignItems={isCompact ? 'center' : 'flex-start'}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  {t('calendar.monthlyRealizedNet')}
                </Typography>
                {showSummarySkeleton ? (
                  <Skeleton variant="text" width={180} height={32} />
                ) : (
                  <Typography
                    variant={isCompact ? 'h5' : 'h4'}
                    className="metric-value"
                    sx={{ fontWeight: 700, color: summaryTextColor, textAlign: isCompact ? 'center' : 'left' }}
                  >
                    {formatSignedCurrency(summaryNetPnl, baseCurrency)}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {monthLabel} · {timezone}
                </Typography>
              </Stack>
              <Stack
                direction={isCompact ? 'column' : 'row'}
                spacing={1}
                sx={{ width: isCompact ? '100%' : 'auto' }}
                alignItems="stretch"
              >
                {hasGross && (
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: isCompact ? '100%' : 150,
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.background.default, 0.45),
                      border: '1px solid',
                      borderColor: 'divider',
                      textAlign: isCompact ? 'center' : 'left'
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {t('calendar.grossPnl')}
                    </Typography>
                    {showSummarySkeleton ? (
                      <Skeleton variant="text" width={120} height={20} />
                    ) : (
                    <Typography variant="subtitle2" className="metric-value">
                        {formatSignedCurrency(summaryGrossPnl ?? 0, baseCurrency)}
                    </Typography>
                    )}
                  </Box>
                )}
                <Box
                  sx={{
                    flex: 1,
                    minWidth: isCompact ? '100%' : 140,
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.background.default, 0.45),
                    border: '1px solid',
                    borderColor: 'divider',
                    textAlign: isCompact ? 'center' : 'left'
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t('calendar.tradingDays')}
                  </Typography>
                  {showSummarySkeleton ? (
                    <Skeleton variant="text" width={60} height={20} />
                  ) : (
                    <Typography variant="subtitle2" className="metric-value">{summaryTradingDays}</Typography>
                  )}
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    minWidth: isCompact ? '100%' : 140,
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.background.default, 0.45),
                    border: '1px solid',
                    borderColor: 'divider',
                    textAlign: isCompact ? 'center' : 'left'
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t('calendar.tradesClosed')}
                  </Typography>
                  {showSummarySkeleton ? (
                    <Skeleton variant="text" width={60} height={20} />
                  ) : (
                    <Typography variant="subtitle2" className="metric-value">{summaryTradeCount}</Typography>
                  )}
                </Box>
              </Stack>
            </Stack>
            {showSummaryError && (
              <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                {monthSummaryError}
              </Typography>
            )}
          </Box>

          <Stack direction={isCompact ? 'column' : 'row'} spacing={isCompact ? 1 : 2} mb={{ xs: 1.5, sm: 2 }} flexWrap="wrap">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: alpha(theme.palette.success.light, 0.4), border: `1px solid ${theme.palette.success.main}` }} />
              <Typography variant="caption">{t('calendar.legend.profit')}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: alpha(theme.palette.error.light, 0.4), border: `1px solid ${theme.palette.error.main}` }} />
              <Typography variant="caption">{t('calendar.legend.loss')}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: 1,
                  bgcolor: isLightMode ? alpha(theme.palette.grey[100], 0.95) : alpha(theme.palette.background.paper, 0.8),
                  border: `1px solid ${isLightMode ? alpha(theme.palette.text.secondary, 0.45) : theme.palette.divider}`
                }}
              />
              <Typography variant="caption">{t('calendar.legend.flat')}</Typography>
            </Stack>
          </Stack>

          {!isCompact && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: { xs: 0.5, sm: 1 },
                mb: { xs: 0.5, sm: 1 }
              }}
            >
              {weekdayLabels.map((label) => (
                <Typography
                  key={label}
                  variant="caption"
                  color="text.secondary"
                  textAlign="center"
                  fontWeight={600}
                  sx={{ minWidth: 0 }}
                >
                  {label}
                </Typography>
              ))}
            </Box>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {error && (
                <Typography color="error" sx={{ mb: 2 }}>
                  {error}
                </Typography>
              )}
              {isCompact ? (
                <Stack spacing={1}>
                  {monthDays.map(renderDayRow)}
                </Stack>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                    gap: { xs: 0.5, sm: 1 },
                    gridAutoRows: { xs: 'minmax(72px, auto)', sm: 'minmax(92px, auto)', md: 'minmax(110px, auto)' }
                  }}
                >
                  {days.map(renderDayCell)}
                </Box>
              )}
              {!error && dailyPnl.length === 0 && (
                <EmptyState
                  title={t('calendar.empty.closedTradesTitle')}
                  description={t('calendar.empty.closedTradesBody')}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedDate}
        onClose={handleCloseDialog}
        fullWidth
        fullScreen={isMobile}
        maxWidth={isTablet ? 'md' : 'sm'}
      >
        <DialogTitle>
          {selectedDate ? t('calendar.dialog.closedOn', { date: format(selectedDate, 'PPP') }) : t('nav.trades')}
        </DialogTitle>
        <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">{t('calendar.dialog.dailySummary')}</Typography>
            <Typography variant={isMobile ? 'subtitle1' : 'h6'} className="metric-value">
              {formatSignedCurrency(selectedNetPnl, baseCurrency)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('calendar.dialog.tradeCountClosed', { count: selectedTradeCount })}
            </Typography>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {selectedLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : selectedError ? (
            <Typography color="error">{selectedError}</Typography>
          ) : selectedTrades.length === 0 ? (
            <Typography color="text.secondary">{t('calendar.dialog.noClosedTrades')}</Typography>
          ) : (
            <Stack spacing={1.5}>
              {selectedTrades.map((trade) => (
                <Box key={trade.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.52), border: '1px solid', borderColor: 'divider' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="subtitle2">{trade.symbol}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`trades.direction.${trade.direction}`)} · {formatDateTime(trade.closedAt)}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2" className="metric-value" sx={{ whiteSpace: 'nowrap' }}>
                      {formatSignedCurrency(trade.pnlNet ?? 0, baseCurrency)}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1} sx={{ mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">{t('calendar.dialog.notes')}</Typography>
            {selectedNotesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            ) : selectedNotesError ? (
              <Typography color="error">{selectedNotesError}</Typography>
            ) : selectedNotes.length === 0 ? (
              <Typography color="text.secondary">{t('calendar.dialog.noNote')}</Typography>
            ) : (
              <Stack spacing={1}>
                {selectedNotes.map((note) => (
                  <Box key={note.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.background.default, 0.52), border: '1px solid', borderColor: 'divider' }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      spacing={2}
                      alignItems={{ sm: 'center' }}
                    >
                      <Box>
                        <Typography variant="subtitle2">{note.title || t('calendar.dialog.untitledNote')}</Typography>
                        <Chip size="small" label={noteTypeLabels[note.type] ?? note.type.replace('_', ' ')} variant="outlined" />
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          navigate(`/notebook?noteId=${note.id}`)
                          handleCloseDialog()
                        }}
                      >
                        {t('calendar.dialog.openNote')}
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 } }}>
          <Button onClick={handleCloseDialog} fullWidth={isMobile}>{t('common.close')}</Button>
          <Button variant="contained" onClick={handleViewInTrades} disabled={!selectedDate} fullWidth={isMobile}>
            {t('calendar.dialog.viewInTrades')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
