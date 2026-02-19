import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded'
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded'
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import {
  closeTradeFromSession,
  createChecklistTemplate,
  getTodaySession,
  listChecklistTemplates,
  saveTodaySessionConfig,
  startTradeFromSession,
  updateTodaySessionChecklist,
  updateTodaySessionPlannedTickers,
  type SessionChecklistItem,
  type TodaySessionResponse
} from '../api/session'
import { listDailyPlans, type DailyPlan } from '../api/plans'
import { listStrategies } from '../api/strategies'
import { FEELING_OPTIONS, RULE_BREAK_OPTIONS } from '../constants/tradeTaxonomy'
import { formatCurrency, formatNumber, formatSignedCurrency } from '../utils/format'

const toBullets = (value?: string | null) => {
  if (!value) return []
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s*/, ''))
    .filter(Boolean)
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toSessionProgress = (session: TodaySessionResponse) => {
  const pnlFloor = -Math.abs(session.lossLimit || 0)
  const pnlCeiling = Math.abs(session.profitTarget || 0)
  const range = pnlCeiling - pnlFloor
  const pnlValue = session.realizedPnl || 0
  const pnlProgress = range <= 0 ? 0 : clamp(((pnlValue - pnlFloor) / range) * 100, 0, 100)
  const tradeProgress = session.maxTrades <= 0 ? 0 : clamp((session.closedTradesCount / session.maxTrades) * 100, 0, 100)
  return { pnlProgress, tradeProgress }
}

type StrategyOption = {
  id: string
  source: 'MY' | 'MENTOR'
  name: string
  model: string
  entryConditions: string[]
  invalidationLogic: string
  tpFramework: string
  noTradeRules?: string | null
  sessionSuitability: string[]
  tags: string[]
}

export default function SessionPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const baseCurrency = user?.baseCurrency || 'USD'

  const [config, setConfig] = useState({
    profitTarget: '',
    lossLimit: '',
    maxTrades: ''
  })

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [tickerDraft, setTickerDraft] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [checklistItems, setChecklistItems] = useState<SessionChecklistItem[]>([])

  const [planner, setPlanner] = useState({
    symbol: '',
    direction: 'LONG' as 'LONG' | 'SHORT',
    quantity: '1',
    entryPrice: '',
    takeProfitPrice: '',
    stopLossPrice: '',
    session: 'LONDON' as 'ASIA' | 'LONDON' | 'NY_AM' | 'NY_PM',
    feeling: FEELING_OPTIONS[0] as string,
    setupGrade: 'A' as 'A' | 'B' | 'C',
    strategyKey: '',
    notes: ''
  })

  const [closeFormOpen, setCloseFormOpen] = useState(false)
  const [closeDraft, setCloseDraft] = useState({
    exitPrice: '',
    ruleBreaks: [] as string[],
    postTradeNotes: ''
  })

  const [apiError, setApiError] = useState('')

  const sessionQuery = useQuery({
    queryKey: ['todaySession'],
    queryFn: () => getTodaySession()
  })

  const dailyPlansQuery = useQuery({
    queryKey: ['dailyPlans', 60],
    queryFn: () => listDailyPlans({ recentDays: 60 })
  })

  const templatesQuery = useQuery({
    queryKey: ['checklistTemplates'],
    queryFn: () => listChecklistTemplates()
  })

  const strategiesQuery = useQuery({
    queryKey: ['strategies', false],
    queryFn: () => listStrategies({ includeArchived: false })
  })

  const session = sessionQuery.data || null

  useEffect(() => {
    if (!session) {
      setChecklistItems([])
      return
    }
    setChecklistItems(session.checklistItems || [])
  }, [session])

  useEffect(() => {
    const plans = dailyPlansQuery.data || []
    if (!plans.length) return
    if (selectedPlanId) return
    setSelectedPlanId(plans[0].id)
  }, [dailyPlansQuery.data, selectedPlanId])

  useEffect(() => {
    if (!session) return
    if (planner.symbol) return
    if (!session.plannedTickers || session.plannedTickers.length === 0) return
    setPlanner((prev) => ({ ...prev, symbol: session.plannedTickers[0] }))
  }, [planner.symbol, session])

  const saveConfigMutation = useMutation({
    mutationFn: saveTodaySessionConfig,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const patchTickersMutation = useMutation({
    mutationFn: updateTodaySessionPlannedTickers,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['todaySession'] })
    }
  })

  const patchChecklistMutation = useMutation({
    mutationFn: updateTodaySessionChecklist,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todaySession'] }),
        queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] })
      ])
    }
  })

  const createTemplateMutation = useMutation({
    mutationFn: createChecklistTemplate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] })
    }
  })

  const startTradeMutation = useMutation({
    mutationFn: startTradeFromSession,
    onSuccess: async () => {
      setApiError('')
      setCloseFormOpen(false)
      setCloseDraft({ exitPrice: '', ruleBreaks: [], postTradeNotes: '' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todaySession'] }),
        queryClient.invalidateQueries({ queryKey: ['recentTrades'] }),
        queryClient.invalidateQueries({ queryKey: ['trades'] })
      ])
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || 'Failed to start trade')
    }
  })

  const closeTradeMutation = useMutation({
    mutationFn: ({ tradeId, payload }: { tradeId: string; payload: { exitPrice: number; ruleBreaks: string[]; postTradeNotes: string } }) =>
      closeTradeFromSession(tradeId, payload),
    onSuccess: async () => {
      setApiError('')
      setCloseFormOpen(false)
      setCloseDraft({ exitPrice: '', ruleBreaks: [], postTradeNotes: '' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todaySession'] }),
        queryClient.invalidateQueries({ queryKey: ['recentTrades'] }),
        queryClient.invalidateQueries({ queryKey: ['trades'] })
      ])
    },
    onError: (error: unknown) => {
      setApiError((error as Error)?.message || 'Failed to close trade')
    }
  })

  const plans = dailyPlansQuery.data || []
  const selectedPlan = plans.find((item) => item.id === selectedPlanId) || plans[0] || null

  const strategyOptions = useMemo<StrategyOption[]>(() => {
    const grouped = strategiesQuery.data
    if (!grouped) return []
    const my = (grouped.myStrategies || []).filter((item) => !item.archived)
    const mentor = grouped.mentorStrategies || []

    return [
      ...my.map((item) => ({ ...item, source: 'MY' as const })),
      ...mentor.map((item) => ({ ...item, source: 'MENTOR' as const }))
    ]
  }, [strategiesQuery.data])

  const strategyByKey = useMemo(() => {
    const map = new Map<string, StrategyOption>()
    strategyOptions.forEach((item) => {
      map.set(`${item.source}:${item.id}`, item)
    })
    return map
  }, [strategyOptions])

  const selectedStrategy = planner.strategyKey ? strategyByKey.get(planner.strategyKey) : undefined

  const progress = session ? toSessionProgress(session) : { pnlProgress: 0, tradeProgress: 0 }

  const canStartTrade = Boolean(session && session.status === 'ACTIVE' && !session.activeTrade)

  const handleSaveConfig = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError('')

    const payload = {
      profitTarget: Number(config.profitTarget),
      lossLimit: Number(config.lossLimit),
      maxTrades: Number(config.maxTrades)
    }

    if (!payload.profitTarget && payload.profitTarget !== 0) {
      setApiError('Profit target is required')
      return
    }
    if (!payload.lossLimit && payload.lossLimit !== 0) {
      setApiError('Loss limit is required')
      return
    }
    if (!payload.maxTrades || payload.maxTrades <= 0) {
      setApiError('Max trades must be greater than zero')
      return
    }

    await saveConfigMutation.mutateAsync(payload)
  }

  const handleAddTicker = async () => {
    if (!session) return
    const ticker = tickerDraft.trim().toUpperCase()
    if (!ticker) return

    const nextTickers = Array.from(new Set([...(session.plannedTickers || []), ticker]))
    setTickerDraft('')
    setScheduleOpen(false)
    await patchTickersMutation.mutateAsync(nextTickers)
  }

  const handleRemoveTicker = async (ticker: string) => {
    if (!session) return
    const nextTickers = (session.plannedTickers || []).filter((item) => item !== ticker)
    await patchTickersMutation.mutateAsync(nextTickers)
  }

  const handleToggleChecklistItem = async (itemId: string, completed: boolean) => {
    const nextItems = checklistItems.map((item) => item.id === itemId ? { ...item, completed } : item)
    setChecklistItems(nextItems)
    await patchChecklistMutation.mutateAsync({ items: nextItems })
  }

  const handleSaveChecklistTemplate = async () => {
    const name = saveTemplateName.trim()
    if (!name) {
      setApiError('Template name is required')
      return
    }
    const items = checklistItems.map((item) => item.text)
    await createTemplateMutation.mutateAsync({ name, items })
    setSaveTemplateName('')
    setSaveTemplateOpen(false)
  }

  const handleImportTemplate = async () => {
    if (!selectedTemplateId) return
    await patchChecklistMutation.mutateAsync({ templateId: selectedTemplateId })
  }

  const handleStartTrade = async () => {
    if (!session) return
    if (!planner.symbol.trim()) {
      setApiError('Ticker is required')
      return
    }
    if (!planner.entryPrice || !planner.quantity) {
      setApiError('Quantity and entry price are required')
      return
    }

    const payload = {
      symbol: planner.symbol.trim().toUpperCase(),
      direction: planner.direction,
      quantity: Number(planner.quantity),
      entryPrice: Number(planner.entryPrice),
      takeProfitPrice: planner.takeProfitPrice ? Number(planner.takeProfitPrice) : null,
      stopLossPrice: planner.stopLossPrice ? Number(planner.stopLossPrice) : null,
      session: planner.session,
      feeling: planner.feeling,
      setupGrade: planner.setupGrade,
      strategyId: selectedStrategy?.source === 'MENTOR' ? selectedStrategy.id : undefined,
      strategyTag: selectedStrategy ? selectedStrategy.name : undefined,
      linkedPlanId: selectedPlan?.id,
      notes: planner.notes || undefined
    }

    await startTradeMutation.mutateAsync(payload)
  }

  const handleCloseTrade = async () => {
    if (!session?.activeTrade) return
    if (!closeDraft.exitPrice) {
      setApiError('Exit price is required')
      return
    }

    await closeTradeMutation.mutateAsync({
      tradeId: session.activeTrade.id,
      payload: {
        exitPrice: Number(closeDraft.exitPrice),
        ruleBreaks: closeDraft.ruleBreaks,
        postTradeNotes: closeDraft.postTradeNotes
      }
    })
  }

  if (sessionQuery.isLoading) {
    return <LoadingState rows={8} height={26} />
  }

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {t('today.session.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('today.session.subtitle')}
          </Typography>
        </Box>
        <Button component={Link} to="/today" variant="outlined">
          {t('today.session.exit')}
        </Button>
      </Stack>

      {apiError && <Alert severity="error">{apiError}</Alert>}

      {!session ? (
        <Card>
          <CardContent>
            <Stack spacing={2} component="form" onSubmit={handleSaveConfig}>
              <Typography variant="h6">Session configuration</Typography>
              <Typography variant="body2" color="text.secondary">
                Set your daily guardrails before you start execution.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Profit for today (USD)"
                    type="number"
                    value={config.profitTarget}
                    onChange={(event) => setConfig((prev) => ({ ...prev, profitTarget: event.target.value }))}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Loss for today (USD)"
                    type="number"
                    value={config.lossLimit}
                    onChange={(event) => setConfig((prev) => ({ ...prev, lossLimit: event.target.value }))}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Max number of trades"
                    type="number"
                    value={config.maxTrades}
                    onChange={(event) => setConfig((prev) => ({ ...prev, maxTrades: event.target.value }))}
                    fullWidth
                    required
                  />
                </Grid>
              </Grid>
              <Button type="submit" variant="contained" disabled={saveConfigMutation.isLoading}>
                {saveConfigMutation.isLoading ? 'Saving...' : 'Save and open workspace'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card sx={{ position: { xs: 'sticky', md: 'static' }, top: { xs: 0, md: 'auto' }, zIndex: 5 }}>
            <CardContent sx={{ py: 1.5 }}>
              <Stack spacing={1.25}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
                  <Stack spacing={0.35}>
                    <Typography variant="subtitle2">Session progress</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Realized PnL: {formatSignedCurrency(session.realizedPnl || 0, baseCurrency)} / {formatCurrency(session.profitTarget || 0, baseCurrency)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Trades: {session.closedTradesCount}/{session.maxTrades}
                    </Typography>
                  </Stack>
                  <Chip
                    color={session.status === 'COMPLETED' ? 'error' : 'success'}
                    label={session.status === 'COMPLETED' ? 'Completed / Locked' : 'Active'}
                    sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                  />
                </Stack>
                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">PnL guardrail</Typography>
                  <LinearProgress variant="determinate" value={progress.pnlProgress} sx={{ height: 8, borderRadius: 999 }} />
                </Stack>
                <Stack spacing={0.75}>
                  <Typography variant="caption" color="text.secondary">Trade count guardrail</Typography>
                  <LinearProgress variant="determinate" value={progress.tradeProgress} sx={{ height: 8, borderRadius: 999 }} />
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: '1fr 1.25fr 1fr' },
              gap: 2,
              minWidth: 0,
              '& > *': { minWidth: 0 }
            }}
          >
            <Card sx={{ order: { xs: 3, md: 3, xl: 1 }, gridColumn: { md: '1 / -1', xl: 'auto' } }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PlaylistAddCheckRoundedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1">Session Checklist</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => setSaveTemplateOpen((prev) => !prev)}>
                        Save template
                      </Button>
                    </Stack>
                  </Stack>

                  {saveTemplateOpen && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        size="small"
                        label="Template name"
                        value={saveTemplateName}
                        onChange={(event) => setSaveTemplateName(event.target.value)}
                        fullWidth
                      />
                      <Button variant="contained" size="small" onClick={handleSaveChecklistTemplate}>
                        Save
                      </Button>
                    </Stack>
                  )}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      select
                      size="small"
                      label="Import template"
                      value={selectedTemplateId}
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                      fullWidth
                    >
                      <MenuItem value="">None</MenuItem>
                      {(templatesQuery.data || []).map((template) => (
                        <MenuItem key={template.id} value={template.id}>{template.name}</MenuItem>
                      ))}
                    </TextField>
                    <Button variant="outlined" size="small" onClick={handleImportTemplate} disabled={!selectedTemplateId}>
                      Import
                    </Button>
                  </Stack>

                  {checklistItems.length === 0 ? (
                    <EmptyState title="No checklist items" description="Add one from a template or update your defaults." />
                  ) : (
                    <List disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      {checklistItems.map((item, index) => (
                        <ListItem
                          key={item.id}
                          disableGutters
                          secondaryAction={(
                            <Checkbox
                              edge="end"
                              checked={item.completed}
                              onChange={(event) => void handleToggleChecklistItem(item.id, event.target.checked)}
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

            <Card sx={{ order: { xs: 1, md: 1, xl: 2 } }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <AutoStoriesRoundedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle1">Mentor Plan</Typography>
                  </Stack>

                  <TextField
                    select
                    size="small"
                    label="Select daily plan"
                    value={selectedPlanId || ''}
                    onChange={(event) => setSelectedPlanId(event.target.value)}
                    fullWidth
                  >
                    {(plans || []).map((plan) => (
                      <MenuItem key={plan.id} value={plan.id}>{plan.title}</MenuItem>
                    ))}
                  </TextField>

                  {dailyPlansQuery.isLoading ? (
                    <LoadingState rows={8} height={20} />
                  ) : !selectedPlan ? (
                    <EmptyState title="No daily plans" description="Publish a daily mentor plan in Admin Content." />
                  ) : (
                    <Stack spacing={1.25}>
                      <Typography variant="h6" sx={{ fontSize: 18 }}>{selectedPlan.title}</Typography>

                      <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">Bias Summary</Typography>
                        <Typography variant="body2">{selectedPlan.biasSummary || selectedPlan.summary || 'No bias summary.'}</Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">Key Levels</Typography>
                        {(selectedPlan.keyLevels || []).length === 0 ? (
                          <Typography variant="body2" color="text.secondary">No key levels.</Typography>
                        ) : (
                          <List dense disablePadding>
                            {(selectedPlan.keyLevels || []).map((level) => (
                              <ListItem key={level} disableGutters sx={{ py: 0.25 }}>
                                <ListItemText primary={`• ${level}`} />
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Box>

                      {selectedPlan.primaryModel && (
                        <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary">Primary Model</Typography>
                          <Typography variant="body2">{selectedPlan.primaryModel}</Typography>
                        </Box>
                      )}

                      {toBullets(selectedPlan.executionRules).length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Execution Rules</Typography>
                          <List dense disablePadding>
                            {toBullets(selectedPlan.executionRules).map((item) => (
                              <ListItem key={item} disableGutters sx={{ py: 0.25 }}>
                                <ListItemText primary={`• ${item}`} />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}

                      {selectedPlan.riskNote && (
                        <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary">Risk Note</Typography>
                          <Typography variant="body2">{selectedPlan.riskNote}</Typography>
                        </Box>
                      )}

                      {(selectedPlan.liquidityNarrative || selectedPlan.alternativeScenario) && (
                        <Accordion disableGutters>
                          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                            <Typography variant="body2">Liquidity narrative & scenarios</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={1.25}>
                              {selectedPlan.liquidityNarrative && (
                                <Box>
                                  <Typography variant="caption" color="text.secondary">Liquidity Narrative</Typography>
                                  <Typography variant="body2">{selectedPlan.liquidityNarrative}</Typography>
                                </Box>
                              )}
                              {selectedPlan.alternativeScenario && (
                                <Box>
                                  <Typography variant="caption" color="text.secondary">Alternative Scenario</Typography>
                                  <Typography variant="body2">{selectedPlan.alternativeScenario}</Typography>
                                </Box>
                              )}
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      )}

                      <Button
                        component={Link}
                        to={`/insights/${selectedPlan.slug || selectedPlan.id}`}
                        variant="outlined"
                        size="small"
                        startIcon={<OpenInNewRoundedIcon />}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        Open full article
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ order: { xs: 2, md: 2, xl: 3 } }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CandlestickChartRoundedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1">Trade Planner + Execution</Typography>
                    </Stack>
                  </Stack>

                  <Stack spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddRoundedIcon />}
                      onClick={() => setScheduleOpen((prev) => !prev)}
                    >
                      + Schedule trade
                    </Button>
                    {scheduleOpen && (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                          size="small"
                          label="Enter the ticker you want to trade"
                          value={tickerDraft}
                          onChange={(event) => setTickerDraft(event.target.value)}
                          fullWidth
                        />
                        <Button size="small" variant="contained" onClick={handleAddTicker}>Add</Button>
                      </Stack>
                    )}
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      {(session.plannedTickers || []).map((ticker) => (
                        <Chip key={ticker} label={ticker} onDelete={() => void handleRemoveTicker(ticker)} size="small" />
                      ))}
                    </Stack>
                  </Stack>

                  <Divider />

                  <Grid container spacing={1.5}>
                    <Grid item xs={12}>
                      <TextField
                        label="Ticker"
                        value={planner.symbol}
                        onChange={(event) => setPlanner((prev) => ({ ...prev, symbol: event.target.value }))}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        select
                        label="Direction"
                        value={planner.direction}
                        onChange={(event) => setPlanner((prev) => ({ ...prev, direction: event.target.value as 'LONG' | 'SHORT' }))}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="LONG">Long</MenuItem>
                        <MenuItem value="SHORT">Short</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        label="Quantity"
                        type="number"
                        value={planner.quantity}
                        onChange={(event) => setPlanner((prev) => ({ ...prev, quantity: event.target.value }))}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Entry price"
                        type="number"
                        value={planner.entryPrice}
                        onChange={(event) => setPlanner((prev) => ({ ...prev, entryPrice: event.target.value }))}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        label="Take profit"
                        type="number"
                        value={planner.takeProfitPrice}
                        onChange={(event) => setPlanner((prev) => ({ ...prev, takeProfitPrice: event.target.value }))}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        label="Stop loss"
                        type="number"
                        value={planner.stopLossPrice}
                        onChange={(event) => setPlanner((prev) => ({ ...prev, stopLossPrice: event.target.value }))}
                        fullWidth
                        size="small"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        select
                        label="Trade session"
                        value={planner.session}
                        onChange={(event) => setPlanner((prev) => ({ ...prev, session: event.target.value as 'ASIA' | 'LONDON' | 'NY_AM' | 'NY_PM' }))}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="ASIA">Asia</MenuItem>
                        <MenuItem value="LONDON">London</MenuItem>
                        <MenuItem value="NY_AM">NY AM</MenuItem>
                        <MenuItem value="NY_PM">NY PM</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        select
                        label="How are you feeling?"
                        value={planner.feeling}
                        onChange={(event) => setPlanner((prev) => ({ ...prev, feeling: event.target.value }))}
                        fullWidth
                        size="small"
                      >
                        {FEELING_OPTIONS.map((item) => (
                          <MenuItem key={item} value={item}>{item}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        select
                        label="Setup grade"
                        value={planner.setupGrade}
                        onChange={(event) => setPlanner((prev) => ({ ...prev, setupGrade: event.target.value as 'A' | 'B' | 'C' }))}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="A">A</MenuItem>
                        <MenuItem value="B">B</MenuItem>
                        <MenuItem value="C">C</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        select
                        label="Strategy"
                        value={planner.strategyKey}
                        onChange={(event) => setPlanner((prev) => ({ ...prev, strategyKey: event.target.value }))}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="">None</MenuItem>
                        <MenuItem disabled value="group-my">My strategies</MenuItem>
                        {strategyOptions.filter((item) => item.source === 'MY').map((item) => (
                          <MenuItem key={`MY:${item.id}`} value={`MY:${item.id}`}>{item.name}</MenuItem>
                        ))}
                        <MenuItem disabled value="group-mentor">Mentor strategies</MenuItem>
                        {strategyOptions.filter((item) => item.source === 'MENTOR').map((item) => (
                          <MenuItem key={`MENTOR:${item.id}`} value={`MENTOR:${item.id}`}>{item.name}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Linked plan"
                        value={selectedPlan?.title || 'None'}
                        fullWidth
                        size="small"
                        InputProps={{ readOnly: true }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Notes"
                        value={planner.notes}
                        onChange={(event) => setPlanner((prev) => ({ ...prev, notes: event.target.value }))}
                        fullWidth
                        size="small"
                        multiline
                        minRows={2}
                      />
                    </Grid>
                  </Grid>

                  {selectedStrategy && (
                    <Box sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Selected strategy</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedStrategy.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{selectedStrategy.model}</Typography>
                      {selectedStrategy.entryConditions?.length > 0 && (
                        <List dense disablePadding>
                          {selectedStrategy.entryConditions.slice(0, 4).map((item) => (
                            <ListItem key={item} disableGutters sx={{ py: 0.2 }}>
                              <ListItemText primary={`• ${item}`} />
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </Box>
                  )}

                  {!session.activeTrade ? (
                    <Button
                      variant="contained"
                      onClick={handleStartTrade}
                      disabled={!canStartTrade || startTradeMutation.isLoading}
                    >
                      {startTradeMutation.isLoading ? 'Starting...' : 'Start trade'}
                    </Button>
                  ) : (
                    <Stack spacing={1}>
                      <Alert severity="info">
                        Active trade: {session.activeTrade.symbol} {session.activeTrade.direction} at {formatNumber(session.activeTrade.entryPrice, 4)}
                      </Alert>
                      <Button variant="outlined" color="error" onClick={() => setCloseFormOpen((prev) => !prev)}>
                        Stop trade
                      </Button>
                      {closeFormOpen && (
                        <Stack spacing={1.25} sx={{ p: 1.2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                          <TextField
                            label="Exit price"
                            type="number"
                            value={closeDraft.exitPrice}
                            onChange={(event) => setCloseDraft((prev) => ({ ...prev, exitPrice: event.target.value }))}
                            fullWidth
                            size="small"
                          />
                          <TextField
                            select
                            label="Rule breaks"
                            value={closeDraft.ruleBreaks}
                            onChange={(event) => {
                              const value = event.target.value
                              setCloseDraft((prev) => ({
                                ...prev,
                                ruleBreaks: typeof value === 'string' ? value.split(',') : value
                              }))
                            }}
                            SelectProps={{
                              multiple: true,
                              renderValue: (selected) => (selected as string[]).join(', ')
                            }}
                            fullWidth
                            size="small"
                          >
                            {RULE_BREAK_OPTIONS.map((item) => (
                              <MenuItem key={item} value={item}>{item}</MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            label="Post trade notes"
                            value={closeDraft.postTradeNotes}
                            onChange={(event) => setCloseDraft((prev) => ({ ...prev, postTradeNotes: event.target.value }))}
                            fullWidth
                            size="small"
                            multiline
                            minRows={3}
                          />
                          <Button
                            variant="contained"
                            color="error"
                            onClick={handleCloseTrade}
                            disabled={closeTradeMutation.isLoading}
                          >
                            {closeTradeMutation.isLoading ? 'Closing...' : 'Close trade'}
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </>
      )}
    </Stack>
  )
}
