import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded'
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  createSetupCandidate,
  deleteSessionPlanImage,
  getSessionWorkspace,
  updateSetupCandidate,
  uploadSessionPlanImages,
  upsertSessionPeriodPlan,
  type LiveWorkspaceResponse,
  type PeriodPlan,
  type PlanImage,
  type SetupDirection,
  type SetupItem
} from '../api/liveWorkspace'
import { fetchTodayMentorPlan, type PlanScope } from '../api/plans'
import { fetchChartSettings } from '../api/chartSettings'
import { useAuth } from '../auth/AuthContext'
import TradingViewWidget from '../components/charts/TradingViewWidget'
import type { UploadQueueItem } from '../components/assets/AssetListRenderer'
import PlanImagesSection from '../components/session/PlanImagesSection'
import LoadingState from '../components/ui/LoadingState'
import {
  defaultConfluences,
  ensureExecutionWorkspace,
  ensureWorkspace,
  generateId,
  toPeriodPlanDraft,
  toPeriodPlanPayload,
  toSetupPayload,
  toTradingViewSymbol,
  type PeriodPlanDraft,
  type PlanScopeTab
} from '../features/session-workstation/sessionWorkstation'
import { useI18n } from '../i18n'
import { formatDate, formatSignedCurrency } from '../utils/format'

const LAST_SYMBOL_KEY = 'tradejaudit.session.lastSymbol'
const FOCUS_MODE_KEY = 'tradejaudit.session.focusMode'
const EXPANDED_PLANS_KEY = 'tradejaudit.session.expandedPlans'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const planScopeToApiScope = (scope: PlanScopeTab): PlanScope => scope === 'TODAY' ? 'DAILY' : scope

const planLabel = (scope: PlanScopeTab) => {
  if (scope === 'WEEKLY') return 'Weekly Plan'
  if (scope === 'MONTHLY') return 'Monthly Plan'
  return 'Today Plan'
}

const readExpandedPlans = (): PlanScopeTab[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPANDED_PLANS_KEY) || '[]') as PlanScopeTab[]
    return parsed.length ? parsed : ['TODAY']
  } catch {
    return ['TODAY']
  }
}

const normalizeSymbol = (value: string) => value.replace(/\s+/g, '').toUpperCase()

const hasMeaningfulSetupContent = (setup: SetupItem) => Boolean(
  setup.setupTitle.trim()
  || setup.direction !== 'UNDECIDED'
  || setup.context.narrative?.trim()
  || setup.context.liquidityNotes?.trim()
  || setup.context.invalidationIdea?.trim()
  || setup.context.notes?.trim()
  || setup.trigger.entryZone?.trim()
  || setup.execution.takeProfitPrice != null
  || setup.strategyId
  || setup.strategySnapshot
)

function createEmptySetup(workspace: LiveWorkspaceResponse, symbol: string): SetupItem {
  const now = new Date().toISOString()
  return ensureExecutionWorkspace({
    id: `draft-${generateId()}`,
    symbol,
    direction: 'UNDECIDED',
    market: 'FOREX',
    tradeSession: null,
    strategyId: null,
    strategyLabel: '',
    setupTitle: '',
    biasAlignment: '',
    status: 'DRAFT',
    linkedTradeId: null,
    readiness: workspace.session.readiness,
    context: { narrative: '', liquidityNotes: '', invalidationIdea: '', newsSafety: '', notes: '' },
    strategySnapshot: null,
    trigger: {
      sweepIdentified: false,
      displacementConfirmed: false,
      structureConfirmed: false,
      confirmationModel: '',
      sweepType: '',
      liquiditySource: '',
      confirmationTimeframe: '',
      displacementRule: '',
      structureRule: '',
      fvgRequirement: '',
      entryModel: '',
      entryZone: '',
      rrEstimate: null,
      rrMinimum: null,
      confluenceRequirement: '',
      newsRestriction: '',
      sessionRestriction: '',
      invalidationThreshold: '',
      notes: ''
    },
    execution: {
      activeExecutionId: null,
      entryPrice: null,
      stopLossPrice: null,
      takeProfitPrice: null,
      riskAmount: null,
      quantity: null,
      invalidation: '',
      whyWrong: '',
      initialNotes: '',
      tickets: []
    },
    executions: { activeExecutionId: null, tickets: [] },
    review: { liveNotes: '', mistakes: '', lessons: '', outcomeSummary: '', tags: [], timeline: [] },
    levels: [],
    mentorReference: null,
    confluences: defaultConfluences(),
    manualSetupMode: true,
    sortOrder: workspace.setups.length,
    createdAt: now,
    updatedAt: null
  })
}

const planRange = (plan: PeriodPlan | null | undefined, timezone: string) => {
  if (!plan?.exists) return ''
  if (plan.periodStart === plan.periodEnd) return formatDate(plan.periodStart, timezone)
  return `${formatDate(plan.periodStart, timezone)} – ${formatDate(plan.periodEnd, timezone)}`
}

const planSummary = (plan: PeriodPlan | null | undefined, scope: PlanScopeTab) => {
  if (!plan?.exists) {
    if (scope === 'TODAY') return 'No Today Plan yet'
    if (scope === 'WEEKLY') return 'No weekly focus set'
    return 'No monthly focus set'
  }
  return plan.bias || plan.objectives || plan.focusSymbols?.join(', ') || 'Plan ready for review'
}

export default function SessionPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const timezone = user?.timezone || 'Europe/Bucharest'
  const baseCurrency = user?.baseCurrency || 'USD'
  const requestedPlan = (searchParams.get('plan') || '').toUpperCase()

  const [expandedPlans, setExpandedPlans] = useState<PlanScopeTab[]>(() => {
    if (requestedPlan === 'WEEKLY' || requestedPlan === 'MONTHLY') return [requestedPlan]
    return readExpandedPlans()
  })
  const [focusMode, setFocusMode] = useState(() => localStorage.getItem(FOCUS_MODE_KEY) === 'true')
  const [chartSymbol, setChartSymbol] = useState('')
  const [setupDraft, setSetupDraft] = useState<SetupItem | null>(null)
  const [planDrafts, setPlanDrafts] = useState<Record<PlanScopeTab, PeriodPlanDraft | null>>({ TODAY: null, WEEKLY: null, MONTHLY: null })
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [planImageUploads, setPlanImageUploads] = useState<Record<PlanScopeTab, UploadQueueItem[]>>({ TODAY: [], WEEKLY: [], MONTHLY: [] })
  const [deletingPlanImageIds, setDeletingPlanImageIds] = useState<Set<string>>(new Set())
  const setupSignatureRef = useRef('')
  const initializedWorkspaceRef = useRef(false)

  const workspaceQuery = useQuery({
    queryKey: ['liveWorkspace'],
    queryFn: async () => ensureWorkspace(await getSessionWorkspace())
  })

  const workspace = workspaceQuery.data
  const activeWorkspaceSetup = useMemo(() => {
    if (!workspace) return null
    return workspace.setups.find((item) => item.id === workspace.activeSetupId) || workspace.setups[0] || null
  }, [workspace])

  const mentorPlanQuery = useQuery({
    queryKey: ['todayMentorPlanWorkspace', workspace?.session.tradingDate || '', timezone],
    queryFn: () => fetchTodayMentorPlan({ date: workspace?.session.tradingDate || '', tz: timezone }),
    enabled: Boolean(workspace?.session.tradingDate)
  })

  const chartSettingsQuery = useQuery({
    queryKey: ['chartSettings'],
    queryFn: fetchChartSettings,
    staleTime: 5 * 60 * 1000
  })

  const applyWorkspace = (next: LiveWorkspaceResponse, preferredSetupId?: string | null) => {
    const normalized = ensureWorkspace(next)
    queryClient.setQueryData(['liveWorkspace'], normalized)
    const active = normalized.setups.find((item) => item.id === preferredSetupId)
      || normalized.setups.find((item) => item.id === normalized.activeSetupId)
      || normalized.setups[0]
      || null
    if (active) {
      const normalizedSetup = ensureExecutionWorkspace(active)
      setupSignatureRef.current = JSON.stringify(toSetupPayload(normalizedSetup))
      setSetupDraft(normalizedSetup)
    }
  }

  const setupMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setup: SetupItem; signature: string }) =>
      updateSetupCandidate(payload.sessionId, payload.setup.id, toSetupPayload(payload.setup)),
    onMutate: () => setSaveState('saving'),
    onSuccess: (next, variables) => {
      setupSignatureRef.current = variables.signature
      queryClient.setQueryData(['liveWorkspace'], ensureWorkspace(next))
      setSaveState('saved')
    },
    onError: (error) => {
      setSaveState('error')
      setFeedback((error as ApiError).message || 'Changes could not be saved.')
    }
  })

  const createSetupMutation = useMutation({
    mutationFn: (payload: { sessionId: string; setup: SetupItem }) =>
      createSetupCandidate(payload.sessionId, toSetupPayload(payload.setup)),
    onMutate: () => setSaveState('saving'),
    onSuccess: (next) => {
      const created = next.setups[next.setups.length - 1] || next.setups[0]
      applyWorkspace(next, created?.id)
      setSaveState('saved')
    },
    onError: (error) => {
      setSaveState('error')
      setFeedback((error as ApiError).message || 'Could not start the current setup.')
    }
  })

  const planMutation = useMutation({
    mutationFn: (payload: { scope: PlanScopeTab; draft: PeriodPlanDraft }) =>
      upsertSessionPeriodPlan(planScopeToApiScope(payload.scope), toPeriodPlanPayload(payload.draft)),
    onSuccess: (next) => {
      queryClient.setQueryData(['liveWorkspace'], ensureWorkspace(next))
      setFeedback('Plan saved.')
    },
    onError: (error) => setFeedback((error as ApiError).message || 'Could not save plan.')
  })
  const saveSetup = setupMutation.mutate
  const createSetup = createSetupMutation.mutate

  useEffect(() => {
    if (!workspace) return
    const selected = activeWorkspaceSetup ? ensureExecutionWorkspace(activeWorkspaceSetup) : null
    if (!initializedWorkspaceRef.current) {
      initializedWorkspaceRef.current = true
      setSetupDraft(selected)
      setupSignatureRef.current = selected ? JSON.stringify(toSetupPayload(selected)) : ''
      const todaySymbol = workspace.planningContext?.today?.focusSymbols?.[0] || ''
      const rememberedSymbol = localStorage.getItem(LAST_SYMBOL_KEY) || ''
      setChartSymbol(normalizeSymbol(selected?.symbol || todaySymbol || rememberedSymbol))
    } else if (selected && setupDraft?.id !== selected.id && !setupMutation.isPending) {
      setSetupDraft(selected)
      setupSignatureRef.current = JSON.stringify(toSetupPayload(selected))
    }
    setPlanDrafts({
      TODAY: toPeriodPlanDraft(workspace.planningContext?.today),
      WEEKLY: toPeriodPlanDraft(workspace.planningContext?.weekly),
      MONTHLY: toPeriodPlanDraft(workspace.planningContext?.monthly)
    })
  }, [activeWorkspaceSetup, setupDraft?.id, setupMutation.isPending, workspace])

  useEffect(() => {
    if (!workspace || !setupDraft || setupDraft.id.startsWith('draft-')) return
    const signature = JSON.stringify(toSetupPayload(setupDraft))
    if (signature === setupSignatureRef.current) return
    setSaveState('idle')
    const timer = window.setTimeout(() => {
      saveSetup({ sessionId: workspace.session.id, setup: setupDraft, signature })
    }, 600)
    return () => window.clearTimeout(timer)
  }, [saveSetup, setupDraft, workspace])

  const updateSetup = (updater: (current: SetupItem) => SetupItem) => {
    if (!workspace) return
    setSetupDraft((current) => {
      const base = current || createEmptySetup(workspace, normalizeSymbol(chartSymbol))
      return ensureExecutionWorkspace(updater(base))
    })
  }

  useEffect(() => {
    if (!workspace || !setupDraft?.id.startsWith('draft-') || createSetupMutation.isPending) return
    const timer = window.setTimeout(() => {
      createSetup({ sessionId: workspace.session.id, setup: setupDraft })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [createSetup, createSetupMutation.isPending, setupDraft, workspace])

  const handleChartSymbolChange = (value: string) => {
    const normalized = normalizeSymbol(value)
    setChartSymbol(normalized)
    localStorage.setItem(LAST_SYMBOL_KEY, normalized)
    if (!workspace) return
    if (!setupDraft) {
      setSetupDraft(createEmptySetup(workspace, normalized))
      return
    }
    if (!hasMeaningfulSetupContent(setupDraft)) {
      updateSetup((current) => ({ ...current, symbol: normalized }))
    }
  }

  const syncChartSymbolToSetup = () => {
    updateSetup((current) => ({ ...current, symbol: normalizeSymbol(chartSymbol) }))
  }

  const togglePlan = (scope: PlanScopeTab, expanded: boolean) => {
    const next = expanded ? [...new Set([...expandedPlans, scope])] : expandedPlans.filter((item) => item !== scope)
    setExpandedPlans(next)
    localStorage.setItem(EXPANDED_PLANS_KEY, JSON.stringify(next))
  }

  const updatePlanDraft = (scope: PlanScopeTab, patch: Partial<PeriodPlanDraft>) => {
    setPlanDrafts((current) => ({
      ...current,
      [scope]: { ...(current[scope] || toPeriodPlanDraft(null)), ...patch }
    }))
  }

  const updatePlanImageUpload = (scope: PlanScopeTab, id: string, patch: Partial<UploadQueueItem>) => {
    setPlanImageUploads((current) => ({
      ...current,
      [scope]: current[scope].map((item) => item.id === id ? { ...item, ...patch } : item)
    }))
  }

  const uploadPlanImages = async (scope: PlanScopeTab, files: File[]) => {
    if (!files.length) return
    const queue = files.map((file) => ({ id: `${scope}-${generateId()}`, fileName: file.name, sizeBytes: file.size, progress: 2 }))
    setPlanImageUploads((current) => ({ ...current, [scope]: [...current[scope], ...queue] }))
    try {
      await uploadSessionPlanImages(planScopeToApiScope(scope), files, (progress) => {
        queue.forEach((item) => updatePlanImageUpload(scope, item.id, { progress }))
      })
      setPlanImageUploads((current) => ({ ...current, [scope]: current[scope].filter((item) => !queue.some((row) => row.id === item.id)) }))
      await queryClient.invalidateQueries({ queryKey: ['liveWorkspace'] })
    } catch (error) {
      queue.forEach((item) => updatePlanImageUpload(scope, item.id, { progress: 0, error: (error as ApiError).message || 'Upload failed.' }))
    }
  }

  const deletePlanImage = async (scope: PlanScopeTab, image: PlanImage) => {
    setDeletingPlanImageIds((current) => new Set(current).add(image.id))
    try {
      await deleteSessionPlanImage(planScopeToApiScope(scope), image.id)
      await queryClient.invalidateQueries({ queryKey: ['liveWorkspace'] })
    } catch (error) {
      setFeedback((error as ApiError).message || 'Could not remove screenshot.')
    } finally {
      setDeletingPlanImageIds((current) => {
        const next = new Set(current)
        next.delete(image.id)
        return next
      })
    }
  }

  const openTradeLog = () => {
    const params = new URLSearchParams({ quickLog: '1' })
    const symbol = normalizeSymbol(setupDraft?.symbol || chartSymbol)
    if (symbol) params.set('symbol', symbol)
    if (setupDraft?.direction === 'LONG' || setupDraft?.direction === 'SHORT') params.set('direction', setupDraft.direction)
    if (setupDraft?.setupTitle) params.set('setup', setupDraft.setupTitle)
    if (setupDraft?.strategyLabel) params.set('strategyTag', setupDraft.strategyLabel)
    if (setupDraft?.strategyId) params.set('strategyId', setupDraft.strategyId)
    if (setupDraft?.tradeSession) params.set('session', setupDraft.tradeSession)
    if (setupDraft?.trigger.confirmationTimeframe) params.set('timeframe', setupDraft.trigger.confirmationTimeframe)
    const todayPlanId = workspace?.planningContext?.today?.id
    if (todayPlanId) params.set('planId', todayPlanId)
    navigate(`/trades?${params.toString()}`)
  }

  const deferredChartSymbol = useDeferredValue(toTradingViewSymbol(chartSymbol, null))
  const deferredChartInterval = useDeferredValue(mentorPlanQuery.data?.tradingViewInterval || '15')

  if (workspaceQuery.isLoading) return <LoadingState rows={8} height={38} />
  if (workspaceQuery.isError || !workspace) {
    return <Alert severity="error">{(workspaceQuery.error as ApiError)?.message || 'Could not load Session.'}</Alert>
  }

  const setupSymbolDiffers = Boolean(setupDraft?.symbol && normalizeSymbol(setupDraft.symbol) !== normalizeSymbol(chartSymbol))
  const meaningfulSummary = workspace.session.quickStats.tradesTaken > 0
    || Boolean(workspace.session.quickStats.realizedPnl)
    || Boolean(workspace.session.quickStats.riskConfigured)
  const sessionLabel = workspace.session.sessionName || setupDraft?.tradeSession?.replace('_', ' ') || 'Trading session'
  const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Could not save' : saveState === 'saved' ? 'Saved' : ''

  const renderPlan = (scope: PlanScopeTab, plan: PeriodPlan | null | undefined) => {
    const draft = planDrafts[scope]
    const isOpen = expandedPlans.includes(scope) && !focusMode
    return (
      <Accordion
        key={scope}
        expanded={isOpen}
        onChange={(_, expanded) => togglePlan(scope, expanded)}
        disableGutters
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px !important', '&::before': { display: 'none' }, overflow: 'hidden' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} aria-controls={`${scope.toLowerCase()}-plan-content`} id={`${scope.toLowerCase()}-plan-header`}>
          <Stack spacing={0.25} sx={{ minWidth: 0, pr: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{planLabel(scope)}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{planSummary(plan, scope)}</Typography>
            {plan?.exists ? <Typography variant="caption" color="text.secondary">{[plan.focusSymbols?.join(', '), planRange(plan, timezone)].filter(Boolean).join(' · ')}</Typography> : null}
          </Stack>
        </AccordionSummary>
        <AccordionDetails id={`${scope.toLowerCase()}-plan-content`} sx={{ pt: 0 }}>
          <Stack spacing={1.25}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.1 }}>
              <TextField label="Bias" value={draft?.bias || ''} onChange={(event) => updatePlanDraft(scope, { bias: event.target.value })} fullWidth />
              <TextField label="Symbols" value={draft?.focusSymbols || ''} onChange={(event) => updatePlanDraft(scope, { focusSymbols: event.target.value })} helperText="Comma-separated" fullWidth />
            </Box>
            <TextField label="Narrative / objectives" value={draft?.objectives || ''} onChange={(event) => updatePlanDraft(scope, { objectives: event.target.value })} multiline minRows={2} fullWidth />
            <TextField label="Important levels and notes" value={draft?.notes || ''} onChange={(event) => updatePlanDraft(scope, { notes: event.target.value })} multiline minRows={2} fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button
                variant="outlined"
                onClick={() => draft && planMutation.mutate({ scope, draft })}
                disabled={!draft || planMutation.isPending}
                sx={{ minHeight: 44 }}
              >
                {plan?.exists ? 'Save plan' : 'Create plan'}
              </Button>
              <Button endIcon={<OpenInNewRoundedIcon />} onClick={() => navigate(`/calendar?plan=${scope.toLowerCase()}`)} sx={{ minHeight: 44 }}>
                Open plan
              </Button>
            </Stack>
            {plan?.exists ? (
              <PlanImagesSection
                compact
                title="Charts"
                storageLabel="Screenshots attached to this plan"
                images={plan.images || []}
                uploads={planImageUploads[scope]}
                deletingIds={deletingPlanImageIds}
                onUpload={(files) => void uploadPlanImages(scope, files)}
                onDelete={(image) => void deletePlanImage(scope, image)}
                onRetry={() => void queryClient.invalidateQueries({ queryKey: ['liveWorkspace'] })}
                onOpenCalendar={() => navigate(`/calendar?plan=${scope.toLowerCase()}`)}
              />
            ) : null}
          </Stack>
        </AccordionDetails>
      </Accordion>
    )
  }

  return (
    <Box sx={(theme) => ({
      width: '100%',
      maxWidth: 1160,
      mx: 'auto',
      minWidth: 0,
      overflowX: 'clip',
      pb: { xs: 'calc(96px + env(safe-area-inset-bottom))', md: 5 },
      '& .session-section': {
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        backgroundColor: 'background.paper',
        boxShadow: theme.palette.mode === 'dark' ? 'none' : `0 12px 32px ${alpha(theme.palette.common.black, 0.045)}`
      },
      '& .MuiInputBase-root': { minWidth: 0 },
      '& .MuiButton-root': { minHeight: 44 }
    })}>
      <Stack spacing={{ xs: 2, md: 3 }}>
        <Stack component="header" direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.25}>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" variant="h4" sx={{ fontWeight: 850 }}>Session</Typography>
            <Typography color="text.secondary">
              {formatDate(workspace.session.tradingDate, timezone)} · {sessionLabel}
              {chartSymbol ? ` · ${chartSymbol}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/today')}>Back to Today</Button>
            <Button
              variant={focusMode ? 'contained' : 'outlined'}
              startIcon={<CenterFocusStrongRoundedIcon />}
              aria-pressed={focusMode}
              onClick={() => {
                const next = !focusMode
                setFocusMode(next)
                localStorage.setItem(FOCUS_MODE_KEY, String(next))
              }}
            >
              Focus mode
            </Button>
          </Stack>
        </Stack>

        {feedback ? <Alert severity={saveState === 'error' ? 'error' : 'info'} onClose={() => setFeedback(null)}>{feedback}</Alert> : null}

        {!focusMode ? (
          <Box component="section" aria-labelledby="plans-heading">
            <Typography id="plans-heading" component="h2" variant="h5" sx={{ fontWeight: 800, mb: 1.25 }}>Plans</Typography>
            <Stack spacing={1}>
              {renderPlan('TODAY', workspace.planningContext?.today)}
              {renderPlan('WEEKLY', workspace.planningContext?.weekly)}
              {renderPlan('MONTHLY', workspace.planningContext?.monthly)}
            </Stack>
          </Box>
        ) : null}

        <Card component="section" className="session-section" aria-labelledby="chart-heading" elevation={0}>
          <CardContent sx={{ p: { xs: 1.5, sm: 2.25 }, '&:last-child': { pb: { xs: 1.5, sm: 2.25 } } }}>
            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
              <TextField
                label="Symbol"
                value={chartSymbol}
                onChange={(event) => handleChartSymbolChange(event.target.value)}
                placeholder="GER30"
                inputProps={{ autoCapitalize: 'characters', spellCheck: false }}
                fullWidth
              />
              {setupSymbolDiffers ? (
                <Alert severity="info" action={<Button size="small" onClick={syncChartSymbolToSetup}>Use for setup</Button>}>
                  The chart changed without overwriting the setup you are editing.
                </Alert>
              ) : null}
              <Stack direction="row" spacing={1} alignItems="center">
                <CandlestickChartRoundedIcon color="primary" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography id="chart-heading" component="h2" variant="h5" sx={{ fontWeight: 800 }}>Chart</Typography>
                  {chartSymbol ? <Typography variant="body2" color="text.secondary" noWrap>{chartSymbol}</Typography> : null}
                </Box>
              </Stack>
              <Box
                role="region"
                aria-label={chartSymbol ? `Chart for ${chartSymbol}` : 'Trading chart'}
                sx={{
                  width: '100%',
                  minWidth: 0,
                  height: { xs: 'clamp(340px, 58vh, 440px)', md: 'clamp(500px, 64vh, 680px)' },
                  overflow: 'hidden',
                  borderRadius: 2,
                  bgcolor: '#050608'
                }}
              >
                {deferredChartSymbol ? (
                  <TradingViewWidget
                    symbol={deferredChartSymbol}
                    interval={deferredChartInterval}
                    minHeight={340}
                    hideControls={false}
                    allowSymbolChange={false}
                    preloadedIndicators={chartSettingsQuery.data?.preloadedIndicators || []}
                    fallbackMessage={t('today.mentor.liveChartFallback')}
                    fallbackLinkLabel={t('today.mentor.openOnTradingView')}
                  />
                ) : (
                  <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', px: 2 }}>
                    <Typography color="grey.400" textAlign="center">Enter a symbol to load the chart.</Typography>
                  </Stack>
                )}
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Card component="section" className="session-section" aria-labelledby="setup-heading" elevation={0}>
          <CardContent sx={{ p: { xs: 1.5, sm: 2.25 }, '&:last-child': { pb: { xs: 1.5, sm: 2.25 } } }}>
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                <Typography id="setup-heading" component="h2" variant="h5" sx={{ fontWeight: 800 }}>Current setup</Typography>
                <Typography
                  variant="caption"
                  color={saveState === 'error' ? 'error.main' : 'text.secondary'}
                  role="status"
                  aria-live="polite"
                >
                  {saveLabel}
                </Typography>
              </Stack>
              {!setupDraft ? <Typography color="text.secondary">Start typing to prepare your current setup.</Typography> : null}
              <TextField
                label="Setup title"
                value={setupDraft?.setupTitle || ''}
                onChange={(event) => updateSetup((current) => ({ ...current, setupTitle: event.target.value }))}
                fullWidth
              />
              <Box>
                <Typography component="label" id="direction-label" variant="body2" sx={{ display: 'block', mb: 0.75, fontWeight: 700 }}>Direction</Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={setupDraft?.direction || 'UNDECIDED'}
                  onChange={(_, value: SetupDirection | null) => value && updateSetup((current) => ({ ...current, direction: value }))}
                  aria-labelledby="direction-label"
                  sx={{ '& .MuiToggleButton-root': { minHeight: 44 } }}
                >
                  <ToggleButton value="LONG">Long</ToggleButton>
                  <ToggleButton value="SHORT">Short</ToggleButton>
                  <ToggleButton value="UNDECIDED">Undecided</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <TextField label="Narrative" value={setupDraft?.context.narrative || ''} onChange={(event) => updateSetup((current) => ({ ...current, context: { ...current.context, narrative: event.target.value } }))} multiline minRows={3} fullWidth />
              <TextField label="Liquidity" value={setupDraft?.context.liquidityNotes || ''} onChange={(event) => updateSetup((current) => ({ ...current, context: { ...current.context, liquidityNotes: event.target.value } }))} multiline minRows={2} fullWidth />
              <TextField label="Entry zone" value={setupDraft?.trigger.entryZone || ''} onChange={(event) => updateSetup((current) => ({ ...current, trigger: { ...current.trigger, entryZone: event.target.value } }))} multiline minRows={2} fullWidth />
              <TextField label="Invalidation" value={setupDraft?.context.invalidationIdea || ''} onChange={(event) => updateSetup((current) => ({ ...current, context: { ...current.context, invalidationIdea: event.target.value } }))} multiline minRows={2} fullWidth />
              <TextField label="Target" value={setupDraft?.trigger.notes || ''} onChange={(event) => updateSetup((current) => ({ ...current, trigger: { ...current.trigger, notes: event.target.value } }))} multiline minRows={2} fullWidth />
              <TextField label="Notes" value={setupDraft?.context.notes || ''} onChange={(event) => updateSetup((current) => ({ ...current, context: { ...current.context, notes: event.target.value } }))} multiline minRows={2} fullWidth />

              <Button
                variant="text"
                onClick={() => setMoreDetailsOpen((current) => !current)}
                aria-expanded={moreDetailsOpen}
                endIcon={<ExpandMoreRoundedIcon sx={{ transform: moreDetailsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }} />}
                sx={{ alignSelf: 'flex-start' }}
              >
                More details
              </Button>
              <Collapse in={moreDetailsOpen}>
                <Stack spacing={1.25} sx={{ pt: 0.5 }}>
                  <TextField label="Strategy" value={setupDraft?.strategyLabel || ''} onChange={(event) => updateSetup((current) => ({ ...current, strategyLabel: event.target.value }))} fullWidth />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.1 }}>
                    <TextField label="Timeframe" value={setupDraft?.trigger.confirmationTimeframe || ''} onChange={(event) => updateSetup((current) => ({ ...current, trigger: { ...current.trigger, confirmationTimeframe: event.target.value } }))} fullWidth />
                    <FormControl fullWidth>
                      <InputLabel id="trade-session-label">Session</InputLabel>
                      <Select
                        labelId="trade-session-label"
                        label="Session"
                        value={setupDraft?.tradeSession || ''}
                        onChange={(event) => updateSetup((current) => ({ ...current, tradeSession: (event.target.value || null) as SetupItem['tradeSession'] }))}
                      >
                        <MenuItem value="">Not set</MenuItem>
                        <MenuItem value="ASIA">Asia</MenuItem>
                        <MenuItem value="LONDON">London</MenuItem>
                        <MenuItem value="NY">New York</MenuItem>
                        <MenuItem value="NY_AM">New York AM</MenuItem>
                        <MenuItem value="NY_PM">New York PM</MenuItem>
                        <MenuItem value="CUSTOM">Custom</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <TextField label="Risk notes" value={setupDraft?.context.newsSafety || ''} onChange={(event) => updateSetup((current) => ({ ...current, context: { ...current.context, newsSafety: event.target.value } }))} multiline minRows={2} fullWidth />
                </Stack>
              </Collapse>

              <Box sx={{ pt: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>Trade executed?</Typography>
                <Button variant="contained" size="large" onClick={openTradeLog} fullWidth sx={{ minHeight: 48 }}>Log trade</Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {!focusMode && meaningfulSummary ? (
          <Box component="section" aria-labelledby="summary-heading" sx={{ px: { xs: 0.5, sm: 1 } }}>
            <Typography id="summary-heading" component="h2" variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Session summary</Typography>
            <Typography color="text.secondary">
              Trades: {workspace.session.quickStats.tradesTaken} · Realized P&amp;L: {formatSignedCurrency(workspace.session.quickStats.realizedPnl, baseCurrency)}
              {workspace.session.quickStats.riskConfigured ? ` · Risk used: ${workspace.session.quickStats.riskUsed || 0}` : ''}
            </Typography>
          </Box>
        ) : null}
      </Stack>

      <Box
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          zIndex: 20,
          left: 0,
          right: 0,
          bottom: 0,
          px: 2,
          pt: 1,
          pb: 'calc(12px + env(safe-area-inset-bottom))',
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Button variant="contained" size="large" onClick={openTradeLog} fullWidth sx={{ minHeight: 48 }}>Log trade</Button>
      </Box>
    </Box>
  )
}
