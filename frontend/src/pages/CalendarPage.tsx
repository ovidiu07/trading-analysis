import { useEffect, useMemo, useState } from 'react'
import {
  alpha,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { useAuth } from '../auth/AuthContext'
import { DailyPnlResponse, listClosedTradesForDate, fetchDailyPnl, TradeResponse } from '../api/trades'
import { formatDateTime, formatSignedCurrency } from '../utils/format'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

const weekStartsOn = 1

export default function CalendarPage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const { user } = useAuth()
  const baseCurrency = user?.baseCurrency || 'USD'
  const timezone = user?.timezone || 'Europe/Bucharest'

  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [dailyPnl, setDailyPnl] = useState<DailyPnlResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTrades, setSelectedTrades] = useState<TradeResponse[]>([])
  const [selectedLoading, setSelectedLoading] = useState(false)
  const [selectedError, setSelectedError] = useState('')

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth])
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth])
  const calendarStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn }), [monthStart])
  const calendarEnd = useMemo(() => endOfWeek(monthEnd, { weekStartsOn }), [monthEnd])
  const days = useMemo(() => eachDayOfInterval({ start: calendarStart, end: calendarEnd }), [calendarStart, calendarEnd])
  const weekdayLabels = useMemo(() => eachDayOfInterval({ start: calendarStart, end: addDays(calendarStart, 6) })
    .map((day) => format(day, 'EEE')), [calendarStart])

  const pnlByDate = useMemo(() => new Map(dailyPnl.map((entry) => [entry.date, entry])), [dailyPnl])

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
        const message = err instanceof Error ? err.message : 'Failed to load calendar data'
        setError(message)
        setDailyPnl([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [calendarEnd, calendarStart, timezone])

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
        const message = err instanceof Error ? err.message : 'Failed to load trades'
        setSelectedTrades([])
        setSelectedError(message)
      } finally {
        setSelectedLoading(false)
      }
    }
    loadTrades()
  }, [selectedDate, timezone])

  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''
  const selectedAggregate = selectedDateKey ? pnlByDate.get(selectedDateKey) : undefined
  const selectedNetPnl = selectedAggregate?.netPnl ?? 0
  const selectedTradeCount = selectedAggregate?.tradeCount ?? selectedTrades.length

  const handleDayClick = (day: Date) => {
    setSelectedDate(day)
  }

  const handleCloseDialog = () => {
    setSelectedDate(null)
    setSelectedTrades([])
    setSelectedError('')
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
    const isPositive = netPnl !== undefined && netPnl > 0
    const isNegative = netPnl !== undefined && netPnl < 0
    const backgroundColor = isPositive
      ? alpha(theme.palette.success.light, 0.25)
      : isNegative
        ? alpha(theme.palette.error.light, 0.25)
        : alpha(theme.palette.grey[200], 0.6)
    const borderColor = isPositive
      ? theme.palette.success.main
      : isNegative
        ? theme.palette.error.main
        : theme.palette.grey[300]

    return (
      <ButtonBase
        key={dateKey}
        onClick={() => handleDayClick(day)}
        aria-label={`View realized P&L for ${dateKey}`}
        sx={{
          textAlign: 'left',
          borderRadius: 2,
          border: '1px solid',
          borderColor,
          backgroundColor,
          width: '100%',
          minHeight: 110,
          p: 1.5,
          opacity: isCurrentMonth ? 1 : 0.45,
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
        }}
      >
        <Stack spacing={0.5} sx={{ width: '100%' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            {format(day, 'd')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatSignedCurrency(netPnl ?? null, baseCurrency)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {entry ? `${entry.tradeCount} trades` : 'No trades'}
          </Typography>
        </Stack>
      </ButtonBase>
    )
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Calendar"
        subtitle={`Realized P&L by trade close date in ${timezone}.`}
        actions={(
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton aria-label="Previous month" onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h6">{format(currentMonth, 'MMMM yyyy')}</Typography>
            <IconButton aria-label="Next month" onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}>
              <ChevronRightIcon />
            </IconButton>
          </Stack>
        )}
      />

      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: alpha(theme.palette.success.light, 0.4), border: `1px solid ${theme.palette.success.main}` }} />
              <Typography variant="caption">Profit</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: alpha(theme.palette.error.light, 0.4), border: `1px solid ${theme.palette.error.main}` }} />
              <Typography variant="caption">Loss</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 14, height: 14, borderRadius: 1, bgcolor: alpha(theme.palette.grey[200], 0.8), border: `1px solid ${theme.palette.grey[300]}` }} />
              <Typography variant="caption">Flat or No trades</Typography>
            </Stack>
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mb: 1 }}>
            {weekdayLabels.map((label) => (
              <Typography key={label} variant="caption" color="text.secondary" textAlign="center" fontWeight={600}>
                {label}
              </Typography>
            ))}
          </Box>

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
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
                {days.map(renderDayCell)}
              </Box>
              {!error && dailyPnl.length === 0 && (
                <EmptyState
                  title="No closed trades in this range"
                  description="Once trades close, daily P&L will populate here."
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedDate} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>
          {selectedDate ? `Trades closed on ${format(selectedDate, 'PPP')}` : 'Trades'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Daily summary</Typography>
            <Typography variant="h6">{formatSignedCurrency(selectedNetPnl, baseCurrency)}</Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedTradeCount} trades closed
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
            <Typography color="text.secondary">No closed trades for this day.</Typography>
          ) : (
            <Stack spacing={1.5}>
              {selectedTrades.map((trade) => (
                <Box key={trade.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'grey.50' }}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="subtitle2">{trade.symbol}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {trade.direction} · {formatDateTime(trade.closedAt)}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2">
                      {formatSignedCurrency(trade.pnlNet ?? 0, baseCurrency)}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          <Button variant="contained" onClick={handleViewInTrades} disabled={!selectedDate}>
            View in Trades
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
