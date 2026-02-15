import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  type ChipProps
} from '@mui/material'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded'
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded'
import TodayRoundedIcon from '@mui/icons-material/TodayRounded'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import NoteAddRoundedIcon from '@mui/icons-material/NoteAddRounded'
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import PreviewRoundedIcon from '@mui/icons-material/PreviewRounded'
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import PageHero from '../components/ui/PageHero'
import MarkdownContent from '../components/ui/MarkdownContent'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import { formatDateTime, formatSignedCurrency } from '../utils/format'
import { listTrades, TradeResponse } from '../api/trades'
import { fetchCoachFocus } from '../api/today'
import { Plan } from '../api/plans'
import {
  useCreateMyDailyPlanMutation,
  useTodayMentorPlanQuery,
  useTodayMyPlanQuery,
  useUpdateMyPlanMutation
} from '../hooks/usePlans'
import { useTodayChecklistQuery, useUpdateTodayChecklistMutation } from '../hooks/useChecklist'

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

type PlanEditorMode = 'create' | 'edit'

type PlanDraft = {
  title: string
  content: string
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

const normalizePlanText = (value?: string | null, maxLength = 240) => {
  if (!value) return ''
  const compact = value
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength).trimEnd()}...`
}

const tzOffsetFormatterByTimezone = new Map<string, Intl.DateTimeFormat>()

const getTimeZoneOffsetMs = (timezone: string, date: Date) => {
  if (!tzOffsetFormatterByTimezone.has(timezone)) {
    tzOffsetFormatterByTimezone.set(timezone, new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }))
  }

  const formatter = tzOffsetFormatterByTimezone.get(timezone)!
  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  )

  return asUtc - date.getTime()
}

const toZonedIso = (dateKey: string, time: '00:00' | '23:59', timezone: string) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const offsetMs = getTimeZoneOffsetMs(timezone, utcGuess)
  return new Date(utcGuess.getTime() - offsetMs).toISOString()
}

const buildMyPlanWindow = (dateKey: string, timezone: string) => ({
  activeFrom: toZonedIso(dateKey, '00:00', timezone),
  activeTo: toZonedIso(dateKey, '23:59', timezone)
})

const tradeLogPath = (mentorPlan?: Plan | null, myPlan?: Plan | null) => {
  const params = new URLSearchParams()
  params.set('quickLog', '1')
  const linkedPlanIds = [mentorPlan?.id, myPlan?.id].filter(Boolean)
  if (linkedPlanIds.length > 0) {
    params.set('linkedPlanIds', linkedPlanIds.join(','))
  }
  return `/trades?${params.toString()}`
}

export default function TodayPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const timezone = user?.timezone ?? 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'
  const todayDate = useMemo(() => getTodayDateInTimezone(timezone), [timezone])

  const mentorPlanQuery = useTodayMentorPlanQuery(todayDate, timezone)
  const myPlanQuery = useTodayMyPlanQuery(todayDate, timezone)

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

  const todayChecklistQuery = useTodayChecklistQuery(timezone)
  const updateTodayChecklistMutation = useUpdateTodayChecklistMutation(timezone)

  const createMyPlanMutation = useCreateMyDailyPlanMutation(todayDate, timezone)
  const updateMyPlanMutation = useUpdateMyPlanMutation(todayDate, timezone)

  const [planEditorOpen, setPlanEditorOpen] = useState(false)
  const [planEditorMode, setPlanEditorMode] = useState<PlanEditorMode>('create')
  const [planEditorPreview, setPlanEditorPreview] = useState(false)
  const [planEditorDraft, setPlanEditorDraft] = useState<PlanDraft>({ title: '', content: '' })
  const [planEditorSavedSnapshot, setPlanEditorSavedSnapshot] = useState<PlanDraft>({ title: '', content: '' })
  const [planEditorError, setPlanEditorError] = useState('')
  const [closePromptOpen, setClosePromptOpen] = useState(false)

  const mentorPlan = mentorPlanQuery.data
  const myPlan = myPlanQuery.data

  const checklistItems = useMemo(() => todayChecklistQuery.data?.items || [], [todayChecklistQuery.data])
  const checklistCompleted = checklistItems.filter((item) => item.completed).length
  const checklistProgress = checklistItems.length ? Math.round((checklistCompleted / checklistItems.length) * 100) : 0

  const isPlanEditorDirty = useMemo(
    () => planEditorDraft.title !== planEditorSavedSnapshot.title || planEditorDraft.content !== planEditorSavedSnapshot.content,
    [planEditorDraft, planEditorSavedSnapshot]
  )

  const isSavingPlan = createMyPlanMutation.isLoading || updateMyPlanMutation.isLoading

  const openPlanEditor = useCallback((mode: PlanEditorMode, seed?: PlanDraft) => {
    const nextSeed = seed || {
      title: t('today.myPlan.defaultTitle', { date: todayDate }),
      content: ''
    }
    setPlanEditorMode(mode)
    setPlanEditorDraft(nextSeed)
    setPlanEditorSavedSnapshot(nextSeed)
    setPlanEditorPreview(false)
    setPlanEditorError('')
    setPlanEditorOpen(true)
  }, [t, todayDate])

  const openCreatePlanEditor = useCallback(() => {
    openPlanEditor('create')
  }, [openPlanEditor])

  const openEditPlanEditor = useCallback(() => {
    if (!myPlan) {
      openCreatePlanEditor()
      return
    }
    openPlanEditor('edit', {
      title: myPlan.title,
      content: myPlan.content
    })
  }, [myPlan, openCreatePlanEditor, openPlanEditor])

  const openDuplicateFromMentor = useCallback(() => {
    if (!mentorPlan) return

    if (myPlan) {
      openPlanEditor('edit', {
        title: myPlan.title,
        content: mentorPlan.content
      })
      return
    }

    openPlanEditor('create', {
      title: t('today.myPlan.defaultTitle', { date: todayDate }),
      content: mentorPlan.content
    })
  }, [mentorPlan, myPlan, openPlanEditor, t, todayDate])

  const closePlanEditor = useCallback(() => {
    setPlanEditorOpen(false)
    setPlanEditorError('')
    setClosePromptOpen(false)
  }, [])

  const handlePlanEditorRequestClose = useCallback(() => {
    if (isPlanEditorDirty) {
      setClosePromptOpen(true)
      return
    }
    closePlanEditor()
  }, [closePlanEditor, isPlanEditorDirty])

  const handleDiscardPlanEditorChanges = useCallback(() => {
    setPlanEditorDraft(planEditorSavedSnapshot)
    closePlanEditor()
  }, [closePlanEditor, planEditorSavedSnapshot])

  const handleSavePlan = useCallback(async () => {
    const title = planEditorDraft.title.trim()
    const content = planEditorDraft.content.trim()

    if (!title || !content) {
      setPlanEditorError(t('today.myPlan.validationRequired'))
      return
    }

    setPlanEditorError('')
    const window = buildMyPlanWindow(todayDate, timezone)
    const payload = {
      title,
      content,
      activeFrom: window.activeFrom,
      activeTo: window.activeTo
    }

    try {
      if (planEditorMode === 'edit' && myPlan?.id) {
        await updateMyPlanMutation.mutateAsync({
          planId: myPlan.id,
          payload
        })
      } else {
        await createMyPlanMutation.mutateAsync(payload)
      }

      setPlanEditorSavedSnapshot({ title, content })
      setPlanEditorOpen(false)
      setClosePromptOpen(false)
    } catch (err) {
      setPlanEditorError(translateApiError(err, t, 'today.myPlan.errors.save'))
    }
  }, [
    createMyPlanMutation,
    myPlan?.id,
    planEditorDraft.content,
    planEditorDraft.title,
    planEditorMode,
    t,
    timezone,
    todayDate,
    updateMyPlanMutation
  ])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!planEditorOpen || !isPlanEditorDirty) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isPlanEditorDirty, planEditorOpen])

  const loadingTopCards = mentorPlanQuery.isLoading || myPlanQuery.isLoading || coachFocusQuery.isLoading

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
        action={(
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              component={Link}
              to={tradeLogPath(mentorPlan || undefined, myPlan || undefined)}
              variant="contained"
              startIcon={<AddCircleOutlineRoundedIcon />}
              sx={{ minWidth: { sm: 140 } }}
            >
              {t('today.actions.logTrade')}
            </Button>
            <Button
              component={Link}
              to="/today/session"
              variant="outlined"
              startIcon={<RocketLaunchRoundedIcon />}
            >
              {t('today.actions.startSession')}
            </Button>
          </Stack>
        )}
      />

      {(mentorPlanQuery.isError || myPlanQuery.isError || coachFocusQuery.isError || todayChecklistQuery.isError) && (
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
                  <Chip
                    size="small"
                    label={t('today.mentor.attribution', { name: mentorPlan.authorDisplayName || t('today.mentor.defaultName') })}
                    variant="outlined"
                    sx={{ alignSelf: 'flex-start' }}
                  />
                  <Typography variant="h6" sx={{ fontSize: 18 }}>
                    {mentorPlan.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {normalizePlanText(mentorPlan.content, 220) || t('today.mentor.emptySummary')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('today.mentor.publishedAt', { date: formatDateTime(mentorPlan.updatedAt || mentorPlan.createdAt, timezone) })}
                  </Typography>
                  <Button
                    component={Link}
                    to="/insights"
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
                    <Button component={Link} to="/insights" size="small" variant="outlined">
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
                <EditNoteRoundedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1">{t('today.myPlan.title')}</Typography>
              </Stack>

              {loadingTopCards ? (
                <LoadingState rows={4} height={22} />
              ) : myPlan ? (
                <>
                  <Typography variant="h6" sx={{ fontSize: 18 }}>
                    {myPlan.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {normalizePlanText(myPlan.content, 220) || t('today.myPlan.emptyContent')}
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditRoundedIcon />}
                      onClick={openEditPlanEditor}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SaveRoundedIcon />}
                      onClick={openEditPlanEditor}
                    >
                      {t('common.save')}
                    </Button>
                    {mentorPlan && (
                      <Button
                        variant="text"
                        size="small"
                        startIcon={<ContentCopyRoundedIcon />}
                        onClick={openDuplicateFromMentor}
                      >
                        {t('today.myPlan.duplicateFromMentor')}
                      </Button>
                    )}
                  </Stack>
                </>
              ) : (
                <EmptyState
                  title={t('today.myPlan.emptyTitle')}
                  description={t('today.myPlan.emptyBody')}
                  icon={<NoteAddRoundedIcon fontSize="inherit" />}
                  action={(
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button size="small" variant="contained" onClick={openCreatePlanEditor}>
                        {t('today.myPlan.create')}
                      </Button>
                      {mentorPlan && (
                        <Button size="small" variant="outlined" onClick={openDuplicateFromMentor}>
                          {t('today.myPlan.duplicateFromMentor')}
                        </Button>
                      )}
                    </Stack>
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
          <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <ChecklistRoundedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1">{t('today.checklist.title')}</Typography>
                </Stack>
                <Button component={Link} to="/analytics#session-checklist" size="small" variant="text">
                  {t('today.checklist.edit')}
                </Button>
              </Stack>

              <Stack spacing={0.75}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {checklistItems.length > 0
                      ? `${checklistCompleted}/${checklistItems.length}`
                      : t('today.checklist.emptyTitle')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{checklistProgress}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={checklistProgress} sx={{ height: 8, borderRadius: 999 }} />
              </Stack>

              {todayChecklistQuery.isLoading ? (
                <LoadingState rows={5} height={20} />
              ) : checklistItems.length === 0 ? (
                <EmptyState
                  title={t('today.checklist.emptyTitle')}
                  description={t('today.checklist.emptyBody')}
                  icon={<ChecklistRoundedIcon fontSize="inherit" />}
                />
              ) : (
                <List disablePadding sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  {checklistItems.map((item, index) => (
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
                      sx={{
                        px: 1.25,
                        minHeight: 52,
                        borderBottom: index < checklistItems.length - 1 ? '1px solid' : 'none',
                        borderColor: 'divider'
                      }}
                    >
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          sx: {
                            textDecoration: item.completed ? 'line-through' : 'none',
                            color: item.completed ? 'text.secondary' : 'text.primary'
                          }
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
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
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  <Button
                    component={Link}
                    to={tradeLogPath(mentorPlan || undefined, myPlan || undefined)}
                    size="small"
                    variant="contained"
                    startIcon={<AddCircleOutlineRoundedIcon />}
                  >
                    {t('today.actions.logTrade')}
                  </Button>
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

      <Dialog
        open={planEditorOpen}
        onClose={handlePlanEditorRequestClose}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{planEditorMode === 'edit' ? t('today.myPlan.editTitle') : t('today.myPlan.createTitle')}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {planEditorError && <Alert severity="error">{planEditorError}</Alert>}

            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
              <ToggleButtonGroup
                size="small"
                value={planEditorPreview ? 'preview' : 'edit'}
                exclusive
                onChange={(_, value) => {
                  if (!value) return
                  setPlanEditorPreview(value === 'preview')
                }}
              >
                <ToggleButton value="edit" aria-label={t('common.edit')}>
                  <EditRoundedIcon fontSize="small" />
                  <Typography sx={{ ml: 0.75 }} variant="body2">{t('common.edit')}</Typography>
                </ToggleButton>
                <ToggleButton value="preview" aria-label={t('common.preview')}>
                  <PreviewRoundedIcon fontSize="small" />
                  <Typography sx={{ ml: 0.75 }} variant="body2">{t('common.preview')}</Typography>
                </ToggleButton>
              </ToggleButtonGroup>

              <Typography variant="caption" color="text.secondary">
                {isSavingPlan ? t('notebook.saveState.saving') : isPlanEditorDirty ? t('notebook.saveState.unsaved') : t('notebook.saveState.allSaved')}
              </Typography>
            </Stack>

            <TextField
              label={t('notebook.fields.title')}
              value={planEditorDraft.title}
              onChange={(event) => setPlanEditorDraft((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
              disabled={planEditorPreview}
            />

            {planEditorPreview ? (
              <Box sx={{ minHeight: 220, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                <MarkdownContent content={planEditorDraft.content} />
              </Box>
            ) : (
              <TextField
                label={t('today.myPlan.contentLabel')}
                value={planEditorDraft.content}
                onChange={(event) => setPlanEditorDraft((prev) => ({ ...prev, content: event.target.value }))}
                fullWidth
                multiline
                minRows={10}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePlanEditorRequestClose}>{t('common.cancel')}</Button>
          <Button
            onClick={handleDiscardPlanEditorChanges}
            color="inherit"
            disabled={!isPlanEditorDirty || isSavingPlan}
          >
            {t('today.myPlan.discard')}
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveRoundedIcon />}
            onClick={handleSavePlan}
            disabled={!isPlanEditorDirty || isSavingPlan}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={closePromptOpen}
        onClose={() => setClosePromptOpen(false)}
      >
        <DialogTitle>{t('notebook.saveState.unsaved')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{t('today.myPlan.unsavedPrompt')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClosePromptOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDiscardPlanEditorChanges}>{t('today.myPlan.discard')}</Button>
          <Button variant="contained" onClick={handleSavePlan} disabled={isSavingPlan}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
