import { useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
  type ChipProps
} from '@mui/material'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import { formatDate, formatDateTime, formatSignedCurrency } from '../utils/format'
import { listTrades, TradeResponse } from '../api/trades'
import { fetchCoachFocus, fetchFeaturedDailyPlan, fetchFeaturedWeeklyPlan, FeaturedPlan } from '../api/today'
import { useTodayChecklistQuery, useUpdateTodayChecklistMutation } from '../hooks/useChecklist'

const planDetailPath = (plan?: FeaturedPlan) => {
  if (!plan) return '/insights'
  return `/insights/${plan.slug || plan.id}`
}

const sessionPath = (plan?: FeaturedPlan) => {
  if (!plan) return '/today/session'
  const params = new URLSearchParams()
  params.set('plan', plan.slug || plan.id)
  return `/today/session?${params.toString()}`
}

const tradeLogPath = (plan?: FeaturedPlan) => {
  const params = new URLSearchParams()
  params.set('quickLog', '1')
  if (plan?.id) {
    params.set('linkedContentIds', plan.id)
  }
  if (plan?.symbols?.[0]) {
    params.set('symbol', plan.symbols[0])
  }
  if (plan?.primaryModel) {
    params.set('strategyTag', plan.primaryModel)
  }
  return `/trades?${params.toString()}`
}

const coachChipColor = (severity: string): ChipProps['color'] => {
  if (severity === 'critical') return 'error'
  if (severity === 'warn') return 'warning'
  return 'info'
}

export default function TodayPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const timezone = user?.timezone ?? 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'

  const dailyPlanQuery = useQuery({
    queryKey: ['featuredDailyPlan', timezone],
    queryFn: (): Promise<FeaturedPlan | null> => fetchFeaturedDailyPlan(timezone),
    enabled: Boolean(timezone)
  })

  const weeklyPlanQuery = useQuery({
    queryKey: ['featuredWeeklyPlan', timezone],
    queryFn: (): Promise<FeaturedPlan | null> => fetchFeaturedWeeklyPlan(timezone),
    enabled: Boolean(timezone)
  })

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

  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: async () => [] as string[],
    staleTime: 300_000
  })
  const todayChecklistQuery = useTodayChecklistQuery(timezone)
  const updateTodayChecklistMutation = useUpdateTodayChecklistMutation(timezone)
  const checklistItems = useMemo(() => todayChecklistQuery.data?.items || [], [todayChecklistQuery.data])

  const loadingTopCards = dailyPlanQuery.isLoading || weeklyPlanQuery.isLoading || coachFocusQuery.isLoading

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{t('today.heading')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('today.subheading')}</Typography>
        </Box>
        <Button component={Link} to={tradeLogPath(dailyPlanQuery.data)} variant="contained">
          {t('today.actions.logTrade')}
        </Button>
      </Stack>

      {(dailyPlanQuery.isError || weeklyPlanQuery.isError || coachFocusQuery.isError || todayChecklistQuery.isError) && (
        <Alert severity="error">{t('today.errors.load')}</Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
          minWidth: 0,
          '& > *': { minWidth: 0 }
        }}
      >
        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t('today.cards.daily.title')}
              </Typography>
              {loadingTopCards ? (
                <LoadingState rows={4} height={22} />
              ) : dailyPlanQuery.data ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {dailyPlanQuery.data.biasSummary || t('today.cards.daily.noSummary')}
                  </Typography>
                  <Stack direction="row" spacing={0.8} flexWrap="wrap">
                    {(dailyPlanQuery.data.keyLevels || []).slice(0, 5).map((level) => (
                      <Chip key={level} label={level} size="small" variant="outlined" />
                    ))}
                  </Stack>
                  {dailyPlanQuery.data.primaryModel && (
                    <Typography variant="body2">
                      <Typography component="span" color="text.secondary">{t('today.cards.daily.primaryModel')}:</Typography>{' '}
                      {dailyPlanQuery.data.primaryModel}
                    </Typography>
                  )}
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button component={Link} to={planDetailPath(dailyPlanQuery.data)} variant="outlined" size="small">
                      {t('today.actions.openPlan')}
                    </Button>
                    <Button component={Link} to={sessionPath(dailyPlanQuery.data)} variant="contained" size="small">
                      {t('today.actions.startSession')}
                    </Button>
                  </Stack>
                </>
              ) : (
                <EmptyState
                  title={t('today.cards.daily.emptyTitle')}
                  description={t('today.cards.daily.emptyBody')}
                  action={(
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button component={Link} to="/insights" size="small" variant="outlined">
                        {t('today.actions.openInsights')}
                      </Button>
                      {user?.role === 'ADMIN' && (
                        <Button component={Link} to="/admin/content/new" size="small" variant="contained">
                          {t('today.actions.createDailyPlan')}
                        </Button>
                      )}
                    </Stack>
                  )}
                />
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t('today.cards.weekly.title')}
              </Typography>
              {loadingTopCards ? (
                <LoadingState rows={4} height={22} />
              ) : weeklyPlanQuery.data ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    {weeklyPlanQuery.data.biasSummary || t('today.cards.weekly.noSummary')}
                  </Typography>
                  {!!weeklyPlanQuery.data.weekStart && !!weeklyPlanQuery.data.weekEnd && (
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(weeklyPlanQuery.data.weekStart)} - {formatDate(weeklyPlanQuery.data.weekEnd)}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={0.8} flexWrap="wrap">
                    {(weeklyPlanQuery.data.symbols || []).slice(0, 5).map((symbol) => (
                      <Chip key={symbol} label={symbol} size="small" variant="outlined" />
                    ))}
                  </Stack>
                  <Button component={Link} to={planDetailPath(weeklyPlanQuery.data)} variant="outlined" size="small">
                    {t('today.actions.openWeeklyPlan')}
                  </Button>
                </>
              ) : (
                <EmptyState
                  title={t('today.cards.weekly.emptyTitle')}
                  description={t('today.cards.weekly.emptyBody')}
                />
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t('today.cards.coach.title')}
              </Typography>
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
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {coachFocusQuery.data.leakTitle}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {coachFocusQuery.data.rationale}
                  </Typography>
                  <Typography variant="body2">
                    <Typography component="span" color="text.secondary">{t('today.cards.coach.action')}:</Typography>{' '}
                    {coachFocusQuery.data.action}
                  </Typography>
                  <Button component={Link} to="/analytics#coach-focus" variant="outlined" size="small">
                    {t('today.actions.seeWhy')}
                  </Button>
                </>
              ) : (
                <EmptyState
                  title={t('today.cards.coach.emptyTitle')}
                  description={t('today.cards.coach.emptyBody')}
                />
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 2,
          minWidth: 0,
          '& > *': { minWidth: 0 }
        }}
      >
        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {t('today.checklist.title')}
                </Typography>
                <Button component={Link} to="/analytics#session-checklist" size="small" variant="text">
                  {t('today.checklist.edit')}
                </Button>
              </Stack>
              {todayChecklistQuery.isLoading ? (
                <LoadingState rows={5} height={20} />
              ) : checklistItems.length === 0 ? (
                <EmptyState
                  title={t('today.checklist.emptyTitle')}
                  description={t('today.checklist.emptyBody')}
                />
              ) : (
                <List disablePadding>
                  {checklistItems.map((item) => (
                    <ListItem
                      key={item.id}
                      disableGutters
                      secondaryAction={(
                        <Checkbox
                          edge="end"
                          checked={item.completed}
                          disabled={updateTodayChecklistMutation.isLoading || !todayChecklistQuery.data?.date}
                          onChange={(event) => {
                            if (!todayChecklistQuery.data?.date) {
                              return
                            }
                            updateTodayChecklistMutation.mutate({
                              date: todayChecklistQuery.data.date,
                              updates: [
                                {
                                  checklistItemId: item.id,
                                  completed: event.target.checked
                                }
                              ]
                            })
                          }}
                          inputProps={{ 'aria-label': item.text }}
                        />
                      )}
                    >
                      <ListItemText primary={item.text} />
                    </ListItem>
                  ))}
                </List>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t('today.events.title')}
              </Typography>
              {eventsQuery.isLoading ? (
                <LoadingState rows={3} height={18} />
              ) : (
                <EmptyState
                  title={t('today.events.emptyTitle')}
                  description={t('today.events.emptyBody')}
                />
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', sm: 'center' }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t('today.recentTrades.title')}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button component={Link} to={tradeLogPath(dailyPlanQuery.data)} size="small" variant="contained">
                  {t('today.actions.logTrade')}
                </Button>
                <Button component={Link} to="/trades" size="small" variant="outlined">
                  {t('today.actions.viewAll')}
                </Button>
              </Stack>
            </Stack>

            {recentTradesQuery.isLoading ? (
              <LoadingState rows={5} height={18} />
            ) : (recentTradesQuery.data || []).length === 0 ? (
              <EmptyState
                title={t('today.recentTrades.emptyTitle')}
                description={t('today.recentTrades.emptyBody')}
              />
            ) : (
              <Stack spacing={1}>
                {(recentTradesQuery.data || []).map((trade: TradeResponse) => (
                  <Box
                    key={trade.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 1.25
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      justifyContent="space-between"
                    >
                      <Stack spacing={0.5}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{trade.symbol}</Typography>
                          <Chip
                            size="small"
                            label={trade.direction}
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
                        variant="body2"
                        className="metric-value"
                        color={(trade.pnlNet || 0) >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatSignedCurrency(trade.pnlNet || 0, baseCurrency)}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
