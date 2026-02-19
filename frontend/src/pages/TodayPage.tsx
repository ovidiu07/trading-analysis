import { useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
  type ChipProps
} from '@mui/material'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded'
import TodayRoundedIcon from '@mui/icons-material/TodayRounded'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import NoteAddRoundedIcon from '@mui/icons-material/NoteAddRounded'
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import PageHero from '../components/ui/PageHero'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import { formatDateTime, formatSignedCurrency } from '../utils/format'
import { listTrades, TradeResponse } from '../api/trades'
import { fetchCoachFocus } from '../api/today'
import { DailyPlan } from '../api/plans'
import { useTodayMentorPlanQuery } from '../hooks/usePlans'

const coachChipColor = (severity: string): ChipProps['color'] => {
  if (severity === 'critical') return 'error'
  if (severity === 'warn') return 'warning'
  return 'info'
}

const premiumCardSx = {
  height: '100%',
  '& .MuiCardContent-root': {
    p: { xs: 1.75, md: 2 }
  }
}

const dayFormatterByTimezone = new Map<string, Intl.DateTimeFormat>()

const getTodayDateInTimezone = (timezone: string) => {
  if (!dayFormatterByTimezone.has(timezone)) {
    dayFormatterByTimezone.set(timezone, new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }))
  }
  return dayFormatterByTimezone.get(timezone)!.format(new Date())
}

const normalizePlanText = (value?: string | null, maxLength = 220) => {
  if (!value) return ''
  const compact = value
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength).trimEnd()}...`
}

const tradeLogPath = () => '/trades?quickLog=1'

export default function TodayPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const timezone = user?.timezone ?? 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'
  const todayDate = useMemo(() => getTodayDateInTimezone(timezone), [timezone])

  const mentorPlanQuery = useTodayMentorPlanQuery(todayDate, timezone)

  const coachFocusQuery = useQuery({
    queryKey: ['coachFocus'],
    queryFn: () => fetchCoachFocus()
  })

  const recentTradesQuery = useQuery({
    queryKey: ['recentTrades'],
    queryFn: async () => {
      const page = await listTrades({ page: 0, size: 6 })
      return page.content || []
    }
  })

  const mentorPlan = mentorPlanQuery.data as DailyPlan | null | undefined
  const loadingTopCards = mentorPlanQuery.isLoading || coachFocusQuery.isLoading

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <PageHero
        eyebrow={t('today.title')}
        title={t('today.heading')}
        description={t('today.subheading')}
        icon={<TodayRoundedIcon fontSize="small" />}
        meta={(
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip label={baseCurrency} size="small" variant="outlined" />
            <Chip label={timezone} size="small" variant="outlined" />
          </Stack>
        )}
      />

      {(mentorPlanQuery.isError || coachFocusQuery.isError || recentTradesQuery.isError) && (
        <Alert severity="error">{t('today.errors.load')}</Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          minWidth: 0,
          '& > *': { minWidth: 0 }
        }}
      >
        <Card className="interactive-lift" sx={premiumCardSx}>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AddCircleOutlineRoundedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1">{t('today.actions.logTrade')}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {t('today.recentTrades.emptyBody')}
              </Typography>
              <Button component={Link} to={tradeLogPath()} variant="contained" startIcon={<AddCircleOutlineRoundedIcon />}>
                {t('today.actions.logTrade')}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Card className="interactive-lift" sx={premiumCardSx}>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <RocketLaunchRoundedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1">{t('today.actions.startSession')}</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {t('today.session.subtitle')}
              </Typography>
              <Button component={Link} to="/today/session" variant="outlined" startIcon={<RocketLaunchRoundedIcon />}>
                {t('today.actions.startSession')}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
          minWidth: 0,
          '& > *': { minWidth: 0 }
        }}
      >
        <Card className="interactive-lift" sx={premiumCardSx}>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <InsightsRoundedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1">{t('today.mentor.title')}</Typography>
              </Stack>

              {loadingTopCards ? (
                <LoadingState rows={4} height={22} />
              ) : mentorPlan ? (
                <>
                  <Typography variant="h6" sx={{ fontSize: 18 }}>
                    {mentorPlan.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {normalizePlanText(mentorPlan.summary || mentorPlan.biasSummary, 220) || t('today.mentor.emptySummary')}
                  </Typography>
                  {(mentorPlan.keyLevels || []).length > 0 && (
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      {(mentorPlan.keyLevels || []).slice(0, 4).map((item) => (
                        <Chip key={item} size="small" variant="outlined" label={item} />
                      ))}
                    </Stack>
                  )}
                  {mentorPlan.updatedAt && (
                    <Typography variant="caption" color="text.secondary">
                      {t('today.mentor.publishedAt', { date: formatDateTime(mentorPlan.updatedAt, timezone) })}
                    </Typography>
                  )}
                  <Button
                    component={Link}
                    to={`/insights/${mentorPlan.slug || mentorPlan.id}`}
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNewRoundedIcon />}
                  >
                    {t('today.actions.openFullPlan')}
                  </Button>
                </>
              ) : (
                <EmptyState
                  title={t('today.mentor.emptyTitle')}
                  description={t('today.mentor.emptyBody')}
                  icon={<InsightsRoundedIcon fontSize="inherit" />}
                  action={(
                    <Button component={Link} to="/insights/today" size="small" variant="outlined">
                      {t('today.actions.openInsights')}
                    </Button>
                  )}
                />
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card className="interactive-lift" sx={premiumCardSx}>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <AutoGraphRoundedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1">{t('today.cards.coach.title')}</Typography>
              </Stack>
              {loadingTopCards ? (
                <LoadingState rows={4} height={22} />
              ) : coachFocusQuery.data ? (
                <>
                  <Chip
                    size="small"
                    color={coachChipColor(coachFocusQuery.data.severity)}
                    label={t(`today.coachSeverity.${coachFocusQuery.data.severity}`)}
                    sx={{ alignSelf: 'flex-start' }}
                  />
                  <Typography variant="h6" sx={{ fontSize: 18 }}>
                    {coachFocusQuery.data.leakTitle}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {coachFocusQuery.data.rationale}
                  </Typography>
                  <Typography variant="body2">
                    <Typography component="span" color="text.secondary">{t('today.cards.coach.action')}:</Typography>{' '}
                    <strong>{coachFocusQuery.data.action}</strong>
                  </Typography>
                  <Button component={Link} to="/analytics#coach-focus" variant="outlined" size="small">
                    {t('today.actions.seeWhy')}
                  </Button>
                </>
              ) : (
                <EmptyState
                  title={t('today.cards.coach.emptyTitle')}
                  description={t('today.cards.coach.emptyBody')}
                  icon={<AutoGraphRoundedIcon fontSize="inherit" />}
                />
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card className="interactive-lift" sx={premiumCardSx}>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <NoteAddRoundedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1">{t('today.recentTrades.title')}</Typography>
                </Stack>
                <Button
                  component={Link}
                  to="/trades"
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewRoundedIcon />}
                >
                  {t('today.actions.viewAll')}
                </Button>
              </Stack>

              {recentTradesQuery.isLoading ? (
                <LoadingState rows={5} height={18} />
              ) : (recentTradesQuery.data || []).length === 0 ? (
                <EmptyState
                  title={t('today.recentTrades.emptyTitle')}
                  description={t('today.recentTrades.emptyBody')}
                  icon={<NoteAddRoundedIcon fontSize="inherit" />}
                />
              ) : (
                <Stack
                  divider={<Divider flexItem />}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    overflow: 'hidden'
                  }}
                >
                  {(recentTradesQuery.data || []).map((trade: TradeResponse) => (
                    <Stack
                      key={trade.id}
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.25}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      sx={{ px: 1.5, py: 1.25 }}
                    >
                      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{trade.symbol}</Typography>
                          <Chip
                            size="small"
                            label={t(`trades.direction.${trade.direction}`)}
                            color={trade.direction === 'LONG' ? 'success' : 'error'}
                            variant="outlined"
                          />
                          {trade.strategyTag && (
                            <Chip size="small" label={trade.strategyTag} variant="outlined" />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(trade.openedAt)}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="subtitle2"
                        className="metric-value"
                        color={(trade.pnlNet || 0) >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatSignedCurrency(trade.pnlNet || 0, baseCurrency)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Stack>
  )
}
