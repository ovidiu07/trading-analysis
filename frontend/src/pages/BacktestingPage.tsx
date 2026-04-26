import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded'
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AssetUploadDropzone from '../components/assets/AssetUploadDropzone'
import SecureAssetImage from '../components/assets/SecureAssetImage'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import {
  archiveBacktestingWorkspace,
  BacktestingScreenshot,
  BacktestingScreenshotPayload,
  BacktestingScreenshotResult,
  BacktestingWorkspace,
  BacktestingWorkspacePayload,
  createBacktestingWorkspace,
  deleteBacktestingScreenshot,
  getBacktestingWorkspace,
  listBacktestingScreenshots,
  listBacktestingWorkspaces,
  updateBacktestingScreenshot,
  updateBacktestingWorkspace,
  uploadBacktestingScreenshots
} from '../api/backtesting'
import { listStrategies, StrategyResponse } from '../api/strategies'
import { ApiError } from '../api/client'

type WorkspaceDraft = BacktestingWorkspacePayload

const emptyDraft: WorkspaceDraft = {
  symbol: '',
  marketType: '',
  strategyId: null,
  strategyNameSnapshot: '',
  title: '',
  primaryTimeframe: '',
  contextTimeframe: '',
  executionTimeframe: '',
  entryTimeframe: '',
  numberOfTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  breakevenTrades: 0,
  averageR: null,
  notes: '',
  whatWorked: '',
  whatFailed: '',
  bestConditions: '',
  avoidConditions: ''
}

const resultOptions: Array<{ value: BacktestingScreenshotResult; label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default' }> = [
  { value: 'WIN', label: 'WIN', color: 'success' },
  { value: 'LOSS', label: 'LOSS', color: 'error' },
  { value: 'BREAKEVEN', label: 'BE', color: 'warning' },
  { value: 'MISSED', label: 'MISSED', color: 'info' },
  { value: 'INVALID', label: 'INVALID', color: 'default' },
  { value: 'GOOD_EXAMPLE', label: 'GOOD EXAMPLE', color: 'success' },
  { value: 'BAD_EXAMPLE', label: 'BAD EXAMPLE', color: 'error' }
]

const sessionOptions = ['London', 'NY', 'Asia', 'Other']
const timeframeOptions = ['15m', '5m', '1m', '30m', '1h', '4h', 'Daily']

const workspaceToDraft = (workspace: BacktestingWorkspace): WorkspaceDraft => ({
  symbol: workspace.symbol || '',
  marketType: workspace.marketType || '',
  strategyId: workspace.strategyId || null,
  strategyNameSnapshot: workspace.strategyNameSnapshot || (workspace.strategyId ? '' : workspace.strategyName || ''),
  title: workspace.title || '',
  primaryTimeframe: workspace.primaryTimeframe || '',
  contextTimeframe: workspace.contextTimeframe || '',
  executionTimeframe: workspace.executionTimeframe || '',
  entryTimeframe: workspace.entryTimeframe || '',
  numberOfTrades: workspace.numberOfTrades || 0,
  winningTrades: workspace.winningTrades || 0,
  losingTrades: workspace.losingTrades || 0,
  breakevenTrades: workspace.breakevenTrades || 0,
  averageR: workspace.averageR ?? null,
  notes: workspace.notes || '',
  whatWorked: workspace.whatWorked || '',
  whatFailed: workspace.whatFailed || '',
  bestConditions: workspace.bestConditions || '',
  avoidConditions: workspace.avoidConditions || ''
})

const toNumber = (value: unknown) => {
  const next = Number(value)
  if (!Number.isFinite(next)) return 0
  return Math.max(0, next)
}

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

const splitTags = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)
const joinTags = (values?: string[]) => (values || []).join(', ')

export default function BacktestingPage() {
  const queryClient = useQueryClient()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<BacktestingWorkspace | null>(null)
  const [draft, setDraft] = useState<WorkspaceDraft>(emptyDraft)
  const [statsDraft, setStatsDraft] = useState<WorkspaceDraft>(emptyDraft)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [resultFilter, setResultFilter] = useState<'ALL' | BacktestingScreenshotResult>('ALL')
  const [sessionFilter, setSessionFilter] = useState('ALL')
  const [timeframeFilter, setTimeframeFilter] = useState('ALL')
  const [tagFilter, setTagFilter] = useState('')
  const [workspaceSearch, setWorkspaceSearch] = useState('')
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null)

  const workspacesQuery = useQuery({
    queryKey: ['backtestingWorkspaces'],
    queryFn: listBacktestingWorkspaces
  })

  const strategiesQuery = useQuery({
    queryKey: ['strategies', 'backtesting'],
    queryFn: () => listStrategies({ includeArchived: false })
  })

  const selectedWorkspace = workspacesQuery.data?.workspaces.find((item) => item.id === selectedWorkspaceId)
    || workspacesQuery.data?.workspaces[0]
    || null

  useEffect(() => {
    if (!selectedWorkspaceId && workspacesQuery.data?.workspaces[0]) {
      setSelectedWorkspaceId(workspacesQuery.data.workspaces[0].id)
    }
  }, [selectedWorkspaceId, workspacesQuery.data?.workspaces])

  const workspaceDetailQuery = useQuery({
    queryKey: ['backtestingWorkspace', selectedWorkspace?.id],
    queryFn: () => getBacktestingWorkspace(selectedWorkspace!.id),
    enabled: Boolean(selectedWorkspace?.id)
  })

  const detail = workspaceDetailQuery.data || selectedWorkspace

  useEffect(() => {
    if (detail) {
      setStatsDraft(workspaceToDraft(detail))
    }
  }, [detail?.id, detail?.updatedAt])

  const screenshotsQuery = useQuery({
    queryKey: ['backtestingScreenshots', selectedWorkspace?.id],
    queryFn: () => listBacktestingScreenshots(selectedWorkspace!.id),
    enabled: Boolean(selectedWorkspace?.id)
  })

  const createMutation = useMutation({
    mutationFn: createBacktestingWorkspace,
    onSuccess: async (created) => {
      setSelectedWorkspaceId(created.id)
      setDialogOpen(false)
      setFeedback('Backtest workspace created.')
      await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspaces'] })
      await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspace', created.id] })
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not create backtest workspace.')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BacktestingWorkspacePayload }) => updateBacktestingWorkspace(id, payload),
    onSuccess: async (updated) => {
      setDialogOpen(false)
      setEditingWorkspace(null)
      setFeedback('Backtest workspace updated.')
      await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspaces'] })
      await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspace', updated.id] })
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not update backtest workspace.')
  })

  const archiveMutation = useMutation({
    mutationFn: archiveBacktestingWorkspace,
    onSuccess: async (_, id) => {
      if (selectedWorkspaceId === id) setSelectedWorkspaceId(null)
      setFeedback('Backtest archived.')
      await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspaces'] })
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not archive backtest.')
  })

  const uploadMutation = useMutation({
    mutationFn: ({ workspaceId, files }: { workspaceId: string; files: File[] }) => uploadBacktestingScreenshots(workspaceId, files),
    onSuccess: async (_, variables) => {
      setFeedback('Screenshots uploaded.')
      await queryClient.invalidateQueries({ queryKey: ['backtestingScreenshots', variables.workspaceId] })
      await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspaces'] })
      await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspace', variables.workspaceId] })
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not upload screenshots.')
  })

  const screenshotUpdateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BacktestingScreenshotPayload }) => updateBacktestingScreenshot(id, payload),
    onSuccess: async (updated) => {
      setFeedback('Screenshot updated.')
      await queryClient.invalidateQueries({ queryKey: ['backtestingScreenshots', updated.workspaceId] })
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not update screenshot.')
  })

  const screenshotDeleteMutation = useMutation({
    mutationFn: deleteBacktestingScreenshot,
    onSuccess: async () => {
      setCarouselIndex(null)
      setFeedback('Screenshot deleted.')
      await queryClient.invalidateQueries({ queryKey: ['backtestingScreenshots', selectedWorkspace?.id] })
      await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspaces'] })
      await queryClient.invalidateQueries({ queryKey: ['backtestingWorkspace', selectedWorkspace?.id] })
    },
    onError: (err) => setError((err as ApiError)?.message || 'Could not delete screenshot.')
  })

  const myStrategies = strategiesQuery.data?.myStrategies || []

  const filteredWorkspaces = useMemo(() => {
    const term = workspaceSearch.trim().toLowerCase()
    return (workspacesQuery.data?.workspaces || []).filter((workspace) => {
      if (!term) return true
      return [workspace.symbol, workspace.strategyName, workspace.strategyNameSnapshot, workspace.marketType]
        .some((value) => (value || '').toLowerCase().includes(term))
    })
  }, [workspaceSearch, workspacesQuery.data?.workspaces])

  const screenshots = screenshotsQuery.data || []
  const filteredScreenshots = useMemo(() => screenshots.filter((item) => {
    if (resultFilter !== 'ALL' && item.tradeResult !== resultFilter) return false
    if (sessionFilter !== 'ALL' && item.session !== sessionFilter) return false
    if (timeframeFilter !== 'ALL' && item.timeframe !== timeframeFilter) return false
    if (tagFilter.trim()) {
      const tag = tagFilter.trim().toLowerCase()
      if (!item.tags.some((value) => value.toLowerCase().includes(tag))) return false
    }
    return true
  }), [resultFilter, screenshots, sessionFilter, tagFilter, timeframeFilter])

  const selectedStrategy = myStrategies.find((item) => item.id === draft.strategyId) || null

  const openCreate = () => {
    setEditingWorkspace(null)
    setDraft(emptyDraft)
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (workspace: BacktestingWorkspace) => {
    setEditingWorkspace(workspace)
    setDraft(workspaceToDraft(workspace))
    setError('')
    setDialogOpen(true)
  }

  const saveWorkspace = () => {
    setError('')
    const payload = normalizeWorkspacePayload(draft)
    if (!payload.symbol.trim()) {
      setError('Symbol is required.')
      return
    }
    if ((payload.winningTrades || 0) + (payload.losingTrades || 0) + (payload.breakevenTrades || 0) > (payload.numberOfTrades || 0)) {
      setError('Wins, losses, and BE cannot exceed total trades.')
      return
    }
    if (editingWorkspace) {
      updateMutation.mutate({ id: editingWorkspace.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const saveStats = () => {
    if (!detail) return
    const payload = normalizeWorkspacePayload(statsDraft)
    if ((payload.winningTrades || 0) + (payload.losingTrades || 0) + (payload.breakevenTrades || 0) > (payload.numberOfTrades || 0)) {
      setError('Wins, losses, and BE cannot exceed total trades.')
      return
    }
    updateMutation.mutate({ id: detail.id, payload })
  }

  const handleFiles = (files: File[]) => {
    if (!detail || files.length === 0) return
    uploadMutation.mutate({ workspaceId: detail.id, files })
  }

  const handleArchive = (workspace: BacktestingWorkspace) => {
    const confirmed = window.confirm('Archive this backtest? It will be removed from your active Backtesting tab, but existing screenshots and research data will not be used in active summaries.')
    if (!confirmed) return
    archiveMutation.mutate(workspace.id)
  }

  const summary = workspacesQuery.data?.summary

  return (
    <Stack spacing={2.5} sx={{ width: '100%', minWidth: 0, overflowX: 'clip' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Visual strategy research by symbol, setup, and screenshot evidence.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>New backtest</Button>
          <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} disabled={!detail} onClick={() => document.getElementById('backtesting-upload-input')?.click()}>
            Upload screenshots
          </Button>
          <Button variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => detail ? openEdit(detail) : openCreate()}>
            Import/select strategy
          </Button>
        </Stack>
      </Stack>

      {(feedback || error) && (
        <Alert severity={error ? 'error' : 'success'} onClose={() => { setFeedback(''); setError('') }}>
          {error || feedback}
        </Alert>
      )}

      <Grid container spacing={1.5}>
        {[
          { label: 'Total backtests', value: summary?.totalBacktests ?? 0 },
          { label: 'Screenshots', value: summary?.totalScreenshots ?? 0 },
          { label: 'Trades tested', value: summary?.totalTradesTested ?? 0 },
          { label: 'Average win rate', value: `${summary?.averageWinRate ?? 0}%` },
          { label: 'Best performer', value: summary?.bestPerformer || '-' }
        ].map((item) => (
          <Grid key={item.label} item xs={6} md={item.label === 'Best performer' ? 4 : 2}>
            <Paper variant="outlined" sx={{ p: 1.5, height: '100%', borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">{item.label}</Typography>
              <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 800, wordBreak: 'break-word' }}>{item.value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12} lg={4}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Research workspaces</Typography>
                <Tooltip title="Filter workspaces">
                  <FilterAltRoundedIcon fontSize="small" color="action" />
                </Tooltip>
              </Stack>
              <TextField
                size="small"
                label="Symbol or strategy"
                value={workspaceSearch}
                onChange={(event) => setWorkspaceSearch(event.target.value)}
              />
              {workspacesQuery.isLoading ? (
                <LoadingState rows={3} height={84} />
              ) : filteredWorkspaces.length === 0 ? (
                <EmptyState
                  title="No backtests yet"
                  description="Create a backtest for NQ, link a strategy, then upload screenshots of winning and losing examples."
                  action={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>New backtest</Button>}
                />
              ) : (
                <Stack spacing={1}>
                  {filteredWorkspaces.map((workspace) => (
                    <WorkspaceCard
                      key={workspace.id}
                      workspace={workspace}
                      selected={workspace.id === detail?.id}
                      onOpen={() => setSelectedWorkspaceId(workspace.id)}
                      onEdit={() => openEdit(workspace)}
                      onArchive={() => handleArchive(workspace)}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={8}>
          {!detail ? (
            <EmptyState
              title="Create a visual research board"
              description="Start with a symbol, then collect screenshots and manual stats around the setup you are validating."
              icon={<PhotoLibraryRoundedIcon />}
              action={<Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>New backtest</Button>}
            />
          ) : (
            <Stack spacing={2}>
              <WorkspaceDetailHeader workspace={detail} onEdit={() => openEdit(detail)} onArchive={() => handleArchive(detail)} />
              <StatsEditor
                draft={statsDraft}
                setDraft={setStatsDraft}
                onSave={saveStats}
                saving={updateMutation.isLoading}
              />
              <StrategySnapshot workspace={detail} />
              <Paper variant="outlined" sx={{ p: { xs: 1.25, sm: 1.75 }, borderRadius: 2, minWidth: 0 }}>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Screenshot evidence</Typography>
                      <Typography variant="body2" color="text.secondary">Review winning and losing examples visually.</Typography>
                    </Box>
                    <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => document.getElementById('backtesting-upload-input')?.click()}>
                      Upload
                    </Button>
                  </Stack>
                  <Box sx={{ display: 'none' }}>
                    <input
                      id="backtesting-upload-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      multiple
                      onChange={(event) => {
                        handleFiles(Array.from(event.target.files || []))
                        event.target.value = ''
                      }}
                    />
                  </Box>
                  <AssetUploadDropzone
                    title="Drop backtest screenshots or choose files"
                    hint="Images are stored as private backtesting evidence and rendered with fresh asset URLs."
                    buttonLabel={uploadMutation.isLoading ? 'Uploading...' : 'Select screenshots'}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={uploadMutation.isLoading}
                    onFilesSelected={handleFiles}
                  />
                  <ScreenshotFilters
                    resultFilter={resultFilter}
                    sessionFilter={sessionFilter}
                    timeframeFilter={timeframeFilter}
                    tagFilter={tagFilter}
                    setResultFilter={setResultFilter}
                    setSessionFilter={setSessionFilter}
                    setTimeframeFilter={setTimeframeFilter}
                    setTagFilter={setTagFilter}
                  />
                  {screenshotsQuery.isLoading ? (
                    <LoadingState rows={2} height={160} />
                  ) : filteredScreenshots.length === 0 ? (
                    <EmptyState
                      title={screenshots.length === 0 ? 'No screenshots uploaded' : 'No screenshots match the filters'}
                      description="Upload chart examples, tag the result, then compare what clean winners and repeating failures look like."
                    />
                  ) : (
                    <ScreenshotGallery
                      screenshots={filteredScreenshots}
                      onOpen={(index) => setCarouselIndex(index)}
                      onSave={(screenshot, payload) => screenshotUpdateMutation.mutate({ id: screenshot.id, payload })}
                      onDelete={(screenshot) => screenshotDeleteMutation.mutate(screenshot.id)}
                    />
                  )}
                </Stack>
              </Paper>
            </Stack>
          )}
        </Grid>
      </Grid>

      <WorkspaceDialog
        open={dialogOpen}
        draft={draft}
        setDraft={setDraft}
        strategies={myStrategies}
        selectedStrategy={selectedStrategy}
        editing={Boolean(editingWorkspace)}
        saving={createMutation.isLoading || updateMutation.isLoading}
        error={error}
        onClose={() => setDialogOpen(false)}
        onSave={saveWorkspace}
      />

      <ScreenshotCarousel
        open={carouselIndex !== null}
        screenshots={filteredScreenshots}
        index={carouselIndex || 0}
        setIndex={setCarouselIndex}
        onClose={() => setCarouselIndex(null)}
        isMobile={isMobile}
      />
    </Stack>
  )
}

function normalizeWorkspacePayload(draft: WorkspaceDraft): BacktestingWorkspacePayload {
  const numberOfTrades = toNumber(draft.numberOfTrades)
  return {
    ...draft,
    symbol: (draft.symbol || '').trim().toUpperCase(),
    strategyId: draft.strategyId || null,
    strategyNameSnapshot: draft.strategyId ? draft.strategyNameSnapshot || null : draft.strategyNameSnapshot || null,
    numberOfTrades,
    winningTrades: toNumber(draft.winningTrades),
    losingTrades: toNumber(draft.losingTrades),
    breakevenTrades: toNumber(draft.breakevenTrades),
    averageR: normalizeAverageR(draft.averageR)
  }
}

function normalizeAverageR(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function WorkspaceCard({ workspace, selected, onOpen, onEdit, onArchive }: {
  workspace: BacktestingWorkspace
  selected: boolean
  onOpen: () => void
  onEdit: () => void
  onArchive: () => void
}) {
  return (
    <Paper
      variant="outlined"
      onClick={onOpen}
      sx={{
        p: 1.25,
        borderRadius: 2,
        cursor: 'pointer',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper'
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 850, wordBreak: 'break-word' }}>
              {workspace.symbol} · {workspace.strategyName || workspace.strategyNameSnapshot || 'Manual strategy'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {workspace.marketType || 'Market'} · Updated {formatDate(workspace.updatedAt)}
            </Typography>
          </Box>
          <Chip size="small" label={`${workspace.winRate || 0}% WR`} color="success" variant="outlined" />
        </Stack>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {workspace.contextTimeframe && <Chip size="small" label={`${workspace.contextTimeframe} context`} />}
          {workspace.executionTimeframe && <Chip size="small" label={`${workspace.executionTimeframe} execution`} />}
          {workspace.entryTimeframe && <Chip size="small" label={`${workspace.entryTimeframe} entry`} />}
        </Stack>
        <Grid container spacing={0.75}>
          {[
            ['Trades', workspace.numberOfTrades],
            ['Wins', workspace.winningTrades],
            ['Losses', workspace.losingTrades],
            ['BE', workspace.breakevenTrades],
            ['Shots', workspace.screenshotCount]
          ].map(([label, value]) => (
            <Grid key={label} item xs={2.4}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>{value}</Typography>
            </Grid>
          ))}
        </Grid>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant={selected ? 'contained' : 'outlined'} onClick={(event) => { event.stopPropagation(); onOpen() }}>Open</Button>
          <IconButton size="small" aria-label="Edit backtest" onClick={(event) => { event.stopPropagation(); onEdit() }}><EditRoundedIcon fontSize="small" /></IconButton>
          <IconButton size="small" aria-label="Archive backtest" onClick={(event) => { event.stopPropagation(); onArchive() }}><ArchiveOutlinedIcon fontSize="small" /></IconButton>
        </Stack>
      </Stack>
    </Paper>
  )
}

function WorkspaceDetailHeader({ workspace, onEdit, onArchive }: {
  workspace: BacktestingWorkspace
  onEdit: () => void
  onArchive: () => void
}) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.25, sm: 1.75 }, borderRadius: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, wordBreak: 'break-word' }}>
            {workspace.symbol} · {workspace.strategyName || workspace.strategyNameSnapshot || 'Manual strategy'}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            <Chip size="small" label={workspace.marketType || 'Market not set'} />
            <Chip size="small" label={workspace.status} color="primary" variant="outlined" />
            <Chip size="small" label={`Updated ${formatDate(workspace.updatedAt)}`} variant="outlined" />
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<EditRoundedIcon />} onClick={onEdit}>Edit</Button>
          <Button size="small" color="warning" startIcon={<ArchiveOutlinedIcon />} onClick={onArchive}>Archive</Button>
        </Stack>
      </Stack>
    </Paper>
  )
}

function StatsEditor({ draft, setDraft, onSave, saving }: {
  draft: WorkspaceDraft
  setDraft: (value: WorkspaceDraft | ((current: WorkspaceDraft) => WorkspaceDraft)) => void
  onSave: () => void
  saving: boolean
}) {
  const trades = toNumber(draft.numberOfTrades)
  const wins = toNumber(draft.winningTrades)
  const losses = toNumber(draft.losingTrades)
  const be = toNumber(draft.breakevenTrades)
  const categorized = wins + losses + be
  const invalid = categorized > trades
  const missing = Math.max(0, trades - categorized)
  const winRate = trades > 0 ? ((wins / trades) * 100).toFixed(1) : '0.0'
  const lossRate = trades > 0 ? ((losses / trades) * 100).toFixed(1) : '0.0'
  const beRate = trades > 0 ? ((be / trades) * 100).toFixed(1) : '0.0'
  const updateNumber = (field: keyof WorkspaceDraft) => (event: ChangeEvent<HTMLInputElement>) => {
    setDraft((current) => ({ ...current, [field]: toNumber(event.target.value) }))
  }
  const updateText = (field: keyof WorkspaceDraft) => (event: ChangeEvent<HTMLInputElement>) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }))
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.25, sm: 1.75 }, borderRadius: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Manual performance stats</Typography>
            <Typography variant="body2" color="text.secondary">Keep the numbers quick and trader-friendly.</Typography>
          </Box>
          <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={onSave} disabled={saving || invalid}>Save stats</Button>
        </Stack>
        <Grid container spacing={1.25}>
          {[
            ['numberOfTrades', 'Trades'],
            ['winningTrades', 'Wins'],
            ['losingTrades', 'Losses'],
            ['breakevenTrades', 'BE']
          ].map(([field, label]) => (
            <Grid key={field} item xs={6} sm={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label={label}
                inputProps={{ min: 0 }}
                value={draft[field as keyof WorkspaceDraft] ?? 0}
                onChange={updateNumber(field as keyof WorkspaceDraft)}
              />
            </Grid>
          ))}
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" type="number" label="Average R" value={draft.averageR ?? ''} onChange={updateNumber('averageR')} />
          </Grid>
        </Grid>
        {invalid ? (
          <Alert severity="error">Wins, losses, and breakeven trades cannot exceed total trades.</Alert>
        ) : missing > 0 ? (
          <Alert severity="info">Some tested trades are not categorized yet.</Alert>
        ) : null}
        <Grid container spacing={1}>
          {[
            ['Win rate', `${winRate}%`],
            ['Loss rate', `${lossRate}%`],
            ['BE rate', `${beRate}%`],
            ['Categorized', `${categorized} / ${trades}`],
            ['Missing', missing]
          ].map(([label, value]) => (
            <Grid key={label} item xs={6} sm={2.4}>
              <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body1" sx={{ fontWeight: 850 }}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={1.25}>
          <Grid item xs={12} md={6}>
            <TextField fullWidth multiline minRows={3} label="What worked" value={draft.whatWorked || ''} onChange={updateText('whatWorked')} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth multiline minRows={3} label="What failed" value={draft.whatFailed || ''} onChange={updateText('whatFailed')} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label="Improvement notes" value={draft.notes || ''} onChange={updateText('notes')} />
          </Grid>
        </Grid>
      </Stack>
    </Paper>
  )
}

function StrategySnapshot({ workspace }: { workspace: BacktestingWorkspace }) {
  const [expanded, setExpanded] = useState(false)
  if (!workspace.strategy) {
    return (
      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Strategy snapshot</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {workspace.strategyNameSnapshot ? `Manual strategy: ${workspace.strategyNameSnapshot}` : 'No linked strategy yet.'}
        </Typography>
      </Paper>
    )
  }
  const strategy = workspace.strategy
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Strategy snapshot</Typography>
            <Typography variant="body2" color="text.secondary">{strategy.name}</Typography>
          </Box>
          <Button size="small" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Collapse' : 'Expand'}</Button>
        </Stack>
        <Typography variant="body2"><strong>Entry model:</strong> {strategy.model || '-'}</Typography>
        <Typography variant="body2"><strong>Invalidation:</strong> {strategy.invalidationLogic || '-'}</Typography>
        {expanded && (
          <Stack spacing={0.75}>
            <Typography variant="body2"><strong>Confluences:</strong> {(strategy.entryConditions || []).join(' / ') || '-'}</Typography>
            <Typography variant="body2"><strong>Targets:</strong> {strategy.tpFramework || '-'}</Typography>
            <Typography variant="body2"><strong>Failure conditions:</strong> {strategy.noTradeRules || '-'}</Typography>
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}

function ScreenshotFilters(props: {
  resultFilter: 'ALL' | BacktestingScreenshotResult
  sessionFilter: string
  timeframeFilter: string
  tagFilter: string
  setResultFilter: (value: 'ALL' | BacktestingScreenshotResult) => void
  setSessionFilter: (value: string) => void
  setTimeframeFilter: (value: string) => void
  setTagFilter: (value: string) => void
}) {
  return (
    <Grid container spacing={1}>
      <Grid item xs={12} sm={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Result</InputLabel>
          <Select label="Result" value={props.resultFilter} onChange={(event) => props.setResultFilter(event.target.value as 'ALL' | BacktestingScreenshotResult)}>
            <MenuItem value="ALL">All results</MenuItem>
            {resultOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Session</InputLabel>
          <Select label="Session" value={props.sessionFilter} onChange={(event) => props.setSessionFilter(event.target.value)}>
            <MenuItem value="ALL">All sessions</MenuItem>
            {sessionOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Timeframe</InputLabel>
          <Select label="Timeframe" value={props.timeframeFilter} onChange={(event) => props.setTimeframeFilter(event.target.value)}>
            <MenuItem value="ALL">All timeframes</MenuItem>
            {timeframeOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={3}>
        <TextField fullWidth size="small" label="Tag" value={props.tagFilter} onChange={(event) => props.setTagFilter(event.target.value)} />
      </Grid>
    </Grid>
  )
}

function ScreenshotGallery({ screenshots, onOpen, onSave, onDelete }: {
  screenshots: BacktestingScreenshot[]
  onOpen: (index: number) => void
  onSave: (screenshot: BacktestingScreenshot, payload: BacktestingScreenshotPayload) => void
  onDelete: (screenshot: BacktestingScreenshot) => void
}) {
  return (
    <Grid container spacing={1.25}>
      {screenshots.map((screenshot, index) => (
        <Grid key={screenshot.id} item xs={12} sm={6} md={4}>
          <ScreenshotCard screenshot={screenshot} index={index} onOpen={onOpen} onSave={onSave} onDelete={onDelete} />
        </Grid>
      ))}
    </Grid>
  )
}

function ScreenshotCard({ screenshot, index, onOpen, onSave, onDelete }: {
  screenshot: BacktestingScreenshot
  index: number
  onOpen: (index: number) => void
  onSave: (screenshot: BacktestingScreenshot, payload: BacktestingScreenshotPayload) => void
  onDelete: (screenshot: BacktestingScreenshot) => void
}) {
  const [caption, setCaption] = useState(screenshot.caption || '')
  const [result, setResult] = useState<BacktestingScreenshotResult | ''>(screenshot.tradeResult || '')
  const [session, setSession] = useState(screenshot.session || '')
  const [timeframe, setTimeframe] = useState(screenshot.timeframe || '')
  const [tags, setTags] = useState(joinTags(screenshot.tags))

  useEffect(() => {
    setCaption(screenshot.caption || '')
    setResult(screenshot.tradeResult || '')
    setSession(screenshot.session || '')
    setTimeframe(screenshot.timeframe || '')
    setTags(joinTags(screenshot.tags))
  }, [screenshot.id, screenshot.updatedAt])

  const selectedResult = resultOptions.find((item) => item.value === screenshot.tradeResult)

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', height: '100%' }}>
      <Box
        role="button"
        tabIndex={0}
        onClick={() => onOpen(index)}
        onKeyDown={(event) => { if (event.key === 'Enter') onOpen(index) }}
        sx={{ aspectRatio: '16 / 10', bgcolor: 'action.hover', cursor: 'zoom-in', position: 'relative', overflow: 'hidden' }}
      >
        <SecureAssetImage
          url={screenshot.thumbnailUrl || screenshot.viewUrl || screenshot.url}
          alt={screenshot.caption || screenshot.originalFileName}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          fallback={<Stack alignItems="center" justifyContent="center" sx={{ height: '100%', p: 2 }}><Typography variant="body2">Image could not render</Typography></Stack>}
        />
        {selectedResult && (
          <Chip size="small" color={selectedResult.color} label={selectedResult.label} sx={{ position: 'absolute', top: 8, left: 8 }} />
        )}
      </Box>
      <Stack spacing={1} sx={{ p: 1.25 }}>
        <TextField size="small" label="Caption" value={caption} onChange={(event) => setCaption(event.target.value)} />
        <Grid container spacing={1}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Result</InputLabel>
              <Select label="Result" value={result} onChange={(event) => setResult(event.target.value as BacktestingScreenshotResult | '')}>
                <MenuItem value="">None</MenuItem>
                {resultOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="Session" value={session} onChange={(event) => setSession(event.target.value)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField fullWidth size="small" label="TF" value={timeframe} onChange={(event) => setTimeframe(event.target.value)} />
          </Grid>
        </Grid>
        <TextField size="small" label="Tags" value={tags} onChange={(event) => setTags(event.target.value)} helperText="Comma separated" />
        <Stack direction="row" spacing={1} justifyContent="space-between">
          <Button size="small" startIcon={<SaveRoundedIcon />} onClick={() => onSave(screenshot, {
            caption,
            tradeResult: result || null,
            session,
            timeframe,
            tags: splitTags(tags)
          })}>Save</Button>
          <IconButton size="small" color="error" aria-label="Delete screenshot" onClick={() => onDelete(screenshot)}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
    </Paper>
  )
}

function ScreenshotCarousel({ open, screenshots, index, setIndex, onClose, isMobile }: {
  open: boolean
  screenshots: BacktestingScreenshot[]
  index: number
  setIndex: (value: number | null) => void
  onClose: () => void
  isMobile: boolean
}) {
  const touchStart = useRef<number | null>(null)
  const screenshot = screenshots[index]
  const go = (delta: number) => {
    if (screenshots.length === 0) return
    setIndex((index + delta + screenshots.length) % screenshots.length)
  }
  if (!screenshot) return null
  return (
    <Dialog open={open} onClose={onClose} fullScreen={isMobile} fullWidth maxWidth="lg">
      <DialogTitle sx={{ pr: 7 }}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>{index + 1} / {screenshots.length}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{screenshot.caption || screenshot.originalFileName}</Typography>
        </Stack>
        <IconButton aria-label="Close carousel" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return
          const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current
          if (Math.abs(delta) > 40) go(delta > 0 ? -1 : 1)
          touchStart.current = null
        }}
        sx={{ p: { xs: 1, sm: 2 }, bgcolor: 'background.default' }}
      >
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ minHeight: { xs: '70vh', sm: 560 } }}>
          <IconButton aria-label="Previous screenshot" onClick={() => go(-1)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0, maxHeight: { xs: '72vh', sm: 640 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SecureAssetImage
              url={screenshot.viewUrl || screenshot.url}
              alt={screenshot.caption || screenshot.originalFileName}
              sx={{ maxWidth: '100%', maxHeight: { xs: '72vh', sm: 640 }, objectFit: 'contain', borderRadius: 1 }}
              fallback={<Alert severity="warning">Image could not render. Metadata is still available for this screenshot.</Alert>}
            />
          </Box>
          <IconButton aria-label="Next screenshot" onClick={() => go(1)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            <ArrowForwardIosRoundedIcon />
          </IconButton>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', gap: 1 }}>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {screenshot.tradeResult && <Chip size="small" label={screenshot.tradeResult} />}
          {screenshot.session && <Chip size="small" label={screenshot.session} />}
          {screenshot.timeframe && <Chip size="small" label={screenshot.timeframe} />}
          {screenshot.tags.map((tag) => <Chip key={tag} size="small" variant="outlined" label={tag} />)}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ display: { xs: 'flex', sm: 'none' } }}>
          <IconButton aria-label="Previous screenshot" onClick={() => go(-1)}><ArrowBackIosNewRoundedIcon /></IconButton>
          <IconButton aria-label="Next screenshot" onClick={() => go(1)}><ArrowForwardIosRoundedIcon /></IconButton>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

function WorkspaceDialog({ open, draft, setDraft, strategies, selectedStrategy, editing, saving, error, onClose, onSave }: {
  open: boolean
  draft: WorkspaceDraft
  setDraft: (value: WorkspaceDraft | ((current: WorkspaceDraft) => WorkspaceDraft)) => void
  strategies: StrategyResponse[]
  selectedStrategy: StrategyResponse | null
  editing: boolean
  saving: boolean
  error: string
  onClose: () => void
  onSave: () => void
}) {
  const update = (field: keyof WorkspaceDraft) => (event: ChangeEvent<HTMLInputElement>) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }))
  }
  const updateNumber = (field: keyof WorkspaceDraft) => (event: ChangeEvent<HTMLInputElement>) => {
    setDraft((current) => ({ ...current, [field]: toNumber(event.target.value) }))
  }
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{editing ? 'Edit backtest' : 'New backtest'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Grid container spacing={1.25}>
            <Grid item xs={12} sm={4}>
              <TextField required fullWidth label="Symbol" value={draft.symbol} onChange={update('symbol')} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Market type" value={draft.marketType || ''} onChange={update('marketType')} placeholder="Futures" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth label="Title" value={draft.title || ''} onChange={update('title')} />
            </Grid>
          </Grid>
          <Autocomplete
            options={strategies}
            value={selectedStrategy}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, value) => setDraft((current) => ({
              ...current,
              strategyId: value?.id || null,
              strategyNameSnapshot: value ? value.name : current.strategyNameSnapshot
            }))}
            renderInput={(params) => <TextField {...params} label="Link existing strategy" placeholder="Search strategies" />}
          />
          <TextField
            fullWidth
            label="Manual strategy name"
            value={draft.strategyNameSnapshot || ''}
            onChange={update('strategyNameSnapshot')}
            helperText="Use this when the strategy does not exist yet, or keep it as a snapshot label."
          />
          <Grid container spacing={1.25}>
            {[
              ['primaryTimeframe', 'Primary TF'],
              ['contextTimeframe', 'Context TF'],
              ['executionTimeframe', 'Execution TF'],
              ['entryTimeframe', 'Entry TF']
            ].map(([field, label]) => (
              <Grid key={field} item xs={6} sm={3}>
                <TextField fullWidth label={label} value={draft[field as keyof WorkspaceDraft] || ''} onChange={update(field as keyof WorkspaceDraft)} />
              </Grid>
            ))}
          </Grid>
          <Divider />
          <Grid container spacing={1.25}>
            {[
              ['numberOfTrades', 'Trades'],
              ['winningTrades', 'Wins'],
              ['losingTrades', 'Losses'],
              ['breakevenTrades', 'BE']
            ].map(([field, label]) => (
              <Grid key={field} item xs={6} sm={3}>
                <TextField fullWidth type="number" inputProps={{ min: 0 }} label={label} value={draft[field as keyof WorkspaceDraft] ?? 0} onChange={updateNumber(field as keyof WorkspaceDraft)} />
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={1.25}>
            <Grid item xs={12} md={6}>
              <TextField fullWidth multiline minRows={3} label="What worked" value={draft.whatWorked || ''} onChange={update('whatWorked')} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth multiline minRows={3} label="What failed" value={draft.whatFailed || ''} onChange={update('whatFailed')} />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onSave} disabled={saving || !draft.symbol.trim()}>
          {editing ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
