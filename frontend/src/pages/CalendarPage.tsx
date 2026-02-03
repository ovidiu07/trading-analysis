import { useEffect, useMemo, useState } from 'react'
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
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { useAuth } from '../auth/AuthContext'
import { DailyPnlResponse, listClosedTradesForDate, fetchDailyPnl, TradeResponse } from '../api/trades'
import { NotebookNoteSummary, listNotebookNotesByDate } from '../api/notebook'
import { formatCompactCurrency, formatDateTime, formatSignedCurrency } from '../utils/format'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'

const weekStartsOn = 1

export default function CalendarPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'))
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
        const message = err instanceof Error ? err.message : 'Failed to load notes'
        setSelectedNotes([])
        setSelectedNotesError(message)
      } finally {
        setSelectedNotesLoading(false)
      }
    }
    loadNotes()
  }, [selectedDate])

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
    const isPositive = netPnl !== undefined && netPnl > 0
    const isNegative = netPnl !== undefined && netPnl < 0
    const pnlLabel = netPnl === undefined
      ? '—'
      : (isMobile ? formatCompactCurrency(netPnl, baseCurrency) : formatSignedCurrency(netPnl, baseCurrency))
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
    const pnlBadgeColor = isPositive
      ? theme.palette.success.main
      : isNegative
        ? theme.palette.error.main
        : theme.palette.grey[600]
    const ariaLabelParts = entry
      ? [
        `View realized P&L for ${dateKey}`,
        `Net P&L ${formatSignedCurrency(netPnl ?? 0, baseCurrency)}`,
        `${entry.tradeCount} trades`
      ]
      : [`View realized P&L for ${dateKey}`, 'No trades']

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
              {entry ? `${entry.tradeCount} trades` : 'No trades'}
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex' }}>
            <Box
              sx={{
                px: 0.75,
                py: 0.25,
                borderRadius: 1,
                bgcolor: pnlBadgeColor,
                color: 'common.white',
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

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Calendar"
        subtitle={`Realized P&L by trade close date in ${timezone}.`}
        actions={(
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
              aria-label="Previous month"
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
              {format(currentMonth, 'MMMM yyyy')}
            </Typography>
            <IconButton
              aria-label="Next month"
              onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
              sx={{ width: 44, height: 44 }}
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        )}
      />

      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} mb={{ xs: 1.5, sm: 2 }} flexWrap="wrap">
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

      <Dialog
        open={!!selectedDate}
        onClose={handleCloseDialog}
        fullWidth
        fullScreen={isMobile}
        maxWidth={isTablet ? 'md' : 'sm'}
      >
        <DialogTitle>
          {selectedDate ? `Trades closed on ${format(selectedDate, 'PPP')}` : 'Trades'}
        </DialogTitle>
        <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 2.5 } }}>
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Daily summary</Typography>
            <Typography variant={isMobile ? 'subtitle1' : 'h6'}>
              {formatSignedCurrency(selectedNetPnl, baseCurrency)}
            </Typography>
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
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography variant="subtitle2">{trade.symbol}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {trade.direction} · {formatDateTime(trade.closedAt)}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
                      {formatSignedCurrency(trade.pnlNet ?? 0, baseCurrency)}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1} sx={{ mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
            {selectedNotesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} />
              </Box>
            ) : selectedNotesError ? (
              <Typography color="error">{selectedNotesError}</Typography>
            ) : selectedNotes.length === 0 ? (
              <Typography color="text.secondary">No note for this day.</Typography>
            ) : (
              <Stack spacing={1}>
                {selectedNotes.map((note) => (
                  <Box key={note.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'grey.50' }}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      spacing={2}
                      alignItems={{ sm: 'center' }}
                    >
                      <Box>
                        <Typography variant="subtitle2">{note.title || 'Untitled note'}</Typography>
                        <Chip size="small" label={note.type.replace('_', ' ')} variant="outlined" />
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          navigate(`/notebook?noteId=${note.id}`)
                          handleCloseDialog()
                        }}
                      >
                        Open note
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1, px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 } }}>
          <Button onClick={handleCloseDialog} fullWidth={isMobile}>Close</Button>
          <Button variant="contained" onClick={handleViewInTrades} disabled={!selectedDate} fullWidth={isMobile}>
            View in Trades
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
