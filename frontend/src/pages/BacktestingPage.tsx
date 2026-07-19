import { Suspense, lazy, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded'
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded'
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  archiveBacktestingWorkspace,
  BacktestingAnalytics,
  BacktestingClassificationStatus,
  BacktestingEdgeLens,
  BacktestingEvidenceStatus,
  BacktestingMetric,
  BacktestingResearchInbox,
  BacktestingScreenshot,
  BacktestingTrade,
  BacktestingTradePayload,
  BacktestingWorkspace,
  BacktestingWorkspacePayload,
  createBacktestingEdgeLens,
  createBacktestingTrade,
  createBacktestingWorkspace,
  deleteBacktestingEdgeLens,
  deleteBacktestingScreenshot,
  deleteBacktestingTrade,
  getBacktestingAnalytics,
  getBacktestingResearchInbox,
  getBacktestingWorkspace,
  importBacktestingTrades,
  listBacktestingEdgeLenses,
  listBacktestingScreenshots,
  listBacktestingTrades,
  listBacktestingWorkspaces,
  excludeBacktestingEvidence,
  updateBacktestingEdgeLens,
  updateBacktestingScreenshot,
  updateBacktestingTrade,
  updateBacktestingWorkspace,
  uploadBacktestingScreenshots
} from '../api/backtesting'
import { ApiError } from '../api/client'
import { AssetItem, listTradeAssets } from '../api/assets'
import { listStrategies, StrategyResponse } from '../api/strategies'
import SecureAssetImage from '../components/assets/SecureAssetImage'
import EmptyState from '../components/ui/EmptyState'
import LoadingState from '../components/ui/LoadingState'
import {
  ImportTradesDialog,
  ManualTradeDialog,
  WorkspaceDialog
} from '../features/backtesting/BacktestingDialogs'
import {
  computeResearchMetrics,
  emptyResearchFilters,
  filterResearchTrades,
  ResearchFilters,
  sourceCounts
} from '../features/backtesting/research'
import ResearchInboxPanel from '../features/backtesting/ResearchInboxPanel'
import { useI18n } from '../i18n'

const BacktestingCharts = lazy(() => import('../features/backtesting/BacktestingCharts'))
type WorkspaceTab = 'overview' | 'trades' | 'edge' | 'evidence' | 'notes'

export default function BacktestingPage() {
  const { workspaceId } = useParams<{ workspaceId?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t, locale } = useI18n()
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [workspaceDialog, setWorkspaceDialog] = useState<BacktestingWorkspace | null | 'new'>(null)
  const [manualTrade, setManualTrade] = useState<BacktestingTrade | null | 'new'>(null)
  const [importTarget, setImportTarget] = useState<BacktestingWorkspace | null>(null)

  const workspacesQuery = useQuery({ queryKey: ['backtestingWorkspaces'], queryFn: () => listBacktestingWorkspaces(false) })
  const strategiesQuery = useQuery({ queryKey: ['strategies', 'backtesting'], queryFn: () => listStrategies({ includeArchived: false }) })
  const inboxQuery = useQuery({ queryKey: ['backtestingResearchInbox'], queryFn: getBacktestingResearchInbox })
  const detailQuery = useQuery({
    queryKey: ['backtestingWorkspace', workspaceId],
    queryFn: () => getBacktestingWorkspace(workspaceId!),
    enabled: Boolean(workspaceId)
  })
  const workspace = detailQuery.data || workspacesQuery.data?.workspaces.find((item) => item.id === workspaceId) || null
  const myStrategies = strategiesQuery.data?.myStrategies || []
  const allStrategies = [...myStrategies, ...(strategiesQuery.data?.mentorStrategies || [])]

  const invalidate = async (id?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['backtestingWorkspaces'] }),
      queryClient.invalidateQueries({ queryKey: ['backtestingResearchInbox'] }),
      id ? queryClient.invalidateQueries({ queryKey: ['backtestingWorkspace', id] }) : Promise.resolve(),
      id ? queryClient.invalidateQueries({ queryKey: ['backtestingTrades', id] }) : Promise.resolve(),
      id ? queryClient.invalidateQueries({ queryKey: ['backtestingAnalytics', id] }) : Promise.resolve(),
      id ? queryClient.invalidateQueries({ queryKey: ['backtestingScreenshots', id] }) : Promise.resolve(),
      id ? queryClient.invalidateQueries({ queryKey: ['backtestingEdgeLenses', id] }) : Promise.resolve()
    ])
  }
  const mutationError = (caught: unknown, key: string) => setError((caught as ApiError)?.message || t(key))

  const createWorkspaceMutation = useMutation({
    mutationFn: createBacktestingWorkspace,
    onSuccess: async (created) => {
      setWorkspaceDialog(null)
      setFeedback(t('backtesting.feedback.workspaceCreated'))
      await invalidate(created.id)
      navigate(`/backtesting/${created.id}`)
    },
    onError: (caught) => mutationError(caught, 'backtesting.errors.workspaceSave')
  })
  const updateWorkspaceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BacktestingWorkspacePayload }) => updateBacktestingWorkspace(id, payload),
    onSuccess: async (updated) => {
      setWorkspaceDialog(null)
      setFeedback(t('backtesting.feedback.workspaceUpdated'))
      await invalidate(updated.id)
    },
    onError: (caught) => mutationError(caught, 'backtesting.errors.workspaceSave')
  })
  const archiveMutation = useMutation({
    mutationFn: archiveBacktestingWorkspace,
    onSuccess: async () => {
      setFeedback(t('backtesting.feedback.workspaceArchived'))
      await invalidate()
      navigate('/backtesting')
    },
    onError: (caught) => mutationError(caught, 'backtesting.errors.archive')
  })
  const importMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => importBacktestingTrades(id, file),
    onSuccess: async (result, variables) => {
      setFeedback(t('backtesting.feedback.imported', { count: result.imported, invalid: result.invalid }))
      setImportTarget(null)
      await invalidate(variables.id)
    },
    onError: (caught) => mutationError(caught, 'backtesting.errors.import')
  })

  const saveWorkspace = (payload: BacktestingWorkspacePayload) => {
    if (workspaceDialog === 'new') createWorkspaceMutation.mutate(payload)
    else if (workspaceDialog) updateWorkspaceMutation.mutate({ id: workspaceDialog.id, payload })
  }

  if (workspacesQuery.isLoading || (workspaceId && detailQuery.isLoading)) return <LoadingState rows={5} height={92} />
  if (workspaceId && !workspace && (detailQuery.isError || workspacesQuery.isError)) {
    return <EmptyState title={t('backtesting.empty.workspaceMissingTitle')} description={t('backtesting.empty.workspaceMissingBody')} action={<Button onClick={() => navigate('/backtesting')}>{t('backtesting.actions.backToLibrary')}</Button>} />
  }

  return (
    <Stack spacing={2} sx={{ minWidth: 0, pb: { xs: 'calc(88px + env(safe-area-inset-bottom))', md: 3 } }}>
      {(feedback || error) && <Alert severity={error ? 'error' : 'success'} onClose={() => { setError(''); setFeedback('') }}>{error || feedback}</Alert>}
      {!workspaceId ? (
        <BacktestingLibrary
          data={workspacesQuery.data}
          inbox={inboxQuery.data}
          loadingInbox={inboxQuery.isLoading}
          onCreate={() => setWorkspaceDialog('new')}
          onOpen={(item) => navigate(`/backtesting/${item.id}`)}
          onEdit={(item) => setWorkspaceDialog(item)}
          onImport={(item) => setImportTarget(item)}
          onInboxChanged={async (message) => { setFeedback(message); await invalidate() }}
          onError={(caught) => mutationError(caught, 'backtesting.errors.evidenceUpdate')}
          locale={locale}
        />
      ) : workspace ? (
        <WorkspaceDetail
          workspace={workspace}
          strategies={allStrategies}
          onBack={() => navigate('/backtesting')}
          onEdit={() => setWorkspaceDialog(workspace)}
          onArchive={() => {
            if (window.confirm(t('backtesting.dialogs.archiveConfirm'))) archiveMutation.mutate(workspace.id)
          }}
          onImport={() => setImportTarget(workspace)}
          onAddManual={() => setManualTrade('new')}
          onEditManual={(trade) => setManualTrade(trade)}
          onFeedback={setFeedback}
          onError={(caught, key) => mutationError(caught, key)}
          invalidate={() => invalidate(workspace.id)}
        />
      ) : null}

      <WorkspaceDialog
        open={workspaceDialog !== null}
        workspace={workspaceDialog === 'new' ? null : workspaceDialog}
        strategies={myStrategies}
        saving={createWorkspaceMutation.isLoading || updateWorkspaceMutation.isLoading}
        onClose={() => setWorkspaceDialog(null)}
        onSave={saveWorkspace}
      />
      {workspace && (
        <ManualTradeMutationDialog
          open={manualTrade !== null}
          workspace={workspace}
          trade={manualTrade === 'new' ? null : manualTrade}
          strategies={allStrategies}
          onClose={() => setManualTrade(null)}
          onSaved={async (message) => { setManualTrade(null); setFeedback(message); await invalidate(workspace.id) }}
          onError={(caught) => mutationError(caught, 'backtesting.errors.tradeSave')}
        />
      )}
      <ImportTradesDialog
        open={Boolean(importTarget)}
        importing={importMutation.isLoading}
        onClose={() => setImportTarget(null)}
        onImport={(file) => importTarget && importMutation.mutate({ id: importTarget.id, file })}
      />
    </Stack>
  )
}

function BacktestingLibrary({ data, inbox, loadingInbox, onCreate, onOpen, onEdit, onImport, onInboxChanged, onError, locale }: {
  data?: Awaited<ReturnType<typeof listBacktestingWorkspaces>>
  inbox?: BacktestingResearchInbox
  loadingInbox: boolean
  onCreate: () => void
  onOpen: (workspace: BacktestingWorkspace) => void
  onEdit: (workspace: BacktestingWorkspace) => void
  onImport: (workspace: BacktestingWorkspace) => void
  onInboxChanged: (message: string) => Promise<void>
  onError: (caught: unknown) => void
  locale: string
}) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [instrument, setInstrument] = useState('')
  const [strategy, setStrategy] = useState('')
  const [status, setStatus] = useState('')
  const [source, setSource] = useState('')
  const [importPicker, setImportPicker] = useState(false)
  const [importWorkspaceId, setImportWorkspaceId] = useState('')
  const workspaces = data?.workspaces || []
  const instruments = [...new Set(workspaces.map((workspace) => workspace.symbol))]
  const strategies = [...new Set(workspaces.map((workspace) => workspace.strategyName || workspace.strategyNameSnapshot || '').filter(Boolean))]
  const filtered = workspaces.filter((workspace) => {
    const text = `${workspace.title || ''} ${workspace.symbol} ${workspace.strategyName || workspace.strategyNameSnapshot || ''}`.toLowerCase()
    if (search && !text.includes(search.toLowerCase())) return false
    if (instrument && workspace.symbol !== instrument) return false
    if (strategy && (workspace.strategyName || workspace.strategyNameSnapshot || '') !== strategy) return false
    if (status && workspace.evidenceStatus !== status) return false
    if (source === 'LIVE' && !workspace.liveTradeCount) return false
    if (source === 'MANUAL' && !workspace.manualTradeCount) return false
    if (source === 'IMPORT' && !workspace.importedTradeCount) return false
    return true
  })
  const summary = data?.summary
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ md: 'center' }}>
        <Box>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 900 }}>{t('backtesting.page.title')}</Typography>
          <Typography color="text.secondary">{t('backtesting.page.subtitle')}</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onCreate}>{t('backtesting.actions.newBacktest')}</Button>
          <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} disabled={!workspaces.length} onClick={() => { if (workspaces.length === 1) onImport(workspaces[0]); else setImportPicker(true) }}>{t('backtesting.actions.importHistorical')}</Button>
        </Stack>
      </Stack>
      <Grid container spacing={1.25}>
        {[
          ['researchWorkspaces', summary?.totalBacktests || 0],
          ['tradesAnalyzed', summary?.totalTradesTested || 0],
          ['manualTrades', summary?.manualTrades || 0],
          ['liveTrades', summary?.liveTrades || 0],
          ['averageExpectancy', formatR(summary?.averageExpectancy, locale)],
          ['needsReview', summary?.strategiesNeedingReview || 0]
        ].map(([key, value]) => <Grid key={key} item xs={6} md={4} lg={2}><MetricCard label={t(`backtesting.metrics.${key}`)} value={value} /></Grid>)}
      </Grid>
      <Paper variant="outlined" sx={{ p: 1.5 }} aria-label={t('backtesting.library.filtersLabel')}>
        <Grid container spacing={1.25}>
          <Grid item xs={12} md={4}><TextField fullWidth size="small" label={t('backtesting.library.search')} value={search} onChange={(event) => setSearch(event.target.value)} /></Grid>
          <Grid item xs={12} sm={6} md={2}><SelectField label={t('backtesting.filters.instrument')} value={instrument} onChange={setInstrument} options={instruments.map((value) => [value, value])} /></Grid>
          <Grid item xs={12} sm={6} md={2}><SelectField label={t('backtesting.filters.strategy')} value={strategy} onChange={setStrategy} options={strategies.map((value) => [value, value])} /></Grid>
          <Grid item xs={12} sm={6} md={2}><SelectField label={t('backtesting.filters.evidenceStatus')} value={status} onChange={setStatus} options={(['INSUFFICIENT_DATA', 'EXPLORATORY', 'EARLY_SIGNAL', 'DEVELOPING_EDGE', 'VALIDATED_EVIDENCE', 'NEEDS_REVIEW'] as const).map((value) => [value, t(`backtesting.evidenceStatus.${value}.label`)])} /></Grid>
          <Grid item xs={12} sm={6} md={2}><SelectField label={t('backtesting.filters.sourceAvailability')} value={source} onChange={setSource} options={(['MANUAL', 'IMPORT', 'LIVE'] as const).map((value) => [value, t(`backtesting.sources.${value}`)])} /></Grid>
        </Grid>
      </Paper>
      <Box>
        <Typography component="h2" variant="h6" sx={{ fontWeight: 850, mb: 1 }}>{t('backtesting.library.workspaces')}</Typography>
        {filtered.length ? <Grid container spacing={1.5}>{filtered.map((workspace) => <Grid key={workspace.id} item xs={12} md={6} xl={4}><WorkspaceCard workspace={workspace} locale={locale} onOpen={() => onOpen(workspace)} onEdit={() => onEdit(workspace)} onImport={() => onImport(workspace)} /></Grid>)}</Grid> : <EmptyState title={t('backtesting.empty.libraryTitle')} description={t('backtesting.empty.libraryBody')} action={<Button variant="contained" onClick={onCreate}>{t('backtesting.actions.newBacktest')}</Button>} />}
      </Box>
      <ResearchInboxPanel inbox={inbox} loading={loadingInbox} onChanged={onInboxChanged} onError={onError} />
      <Dialog open={importPicker} onClose={() => setImportPicker(false)} fullWidth maxWidth="xs"><DialogTitle>{t('backtesting.dialogs.chooseImportWorkspace')}</DialogTitle><DialogContent><FormControl fullWidth sx={{ mt: 1 }}><InputLabel>{t('backtesting.workspace.name')}</InputLabel><Select label={t('backtesting.workspace.name')} value={importWorkspaceId} onChange={(event) => setImportWorkspaceId(event.target.value)}>{workspaces.map((item) => <MenuItem key={item.id} value={item.id}>{item.title || item.symbol}</MenuItem>)}</Select></FormControl><Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}><Button onClick={() => setImportPicker(false)}>{t('common.cancel')}</Button><Button variant="contained" disabled={!importWorkspaceId} onClick={() => { const selected = workspaces.find((item) => item.id === importWorkspaceId); if (selected) onImport(selected); setImportPicker(false); setImportWorkspaceId('') }}>{t('backtesting.actions.continue')}</Button></Stack></DialogContent></Dialog>
    </Stack>
  )
}

function WorkspaceCard({ workspace, locale, onOpen, onEdit, onImport }: { workspace: BacktestingWorkspace; locale: string; onOpen: () => void; onEdit: () => void; onImport: () => void }) {
  const { t } = useI18n()
  return (
    <Paper variant="outlined" sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack spacing={1.25} sx={{ flex: 1 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Box sx={{ minWidth: 0 }}><Typography component="h3" variant="subtitle1" sx={{ fontWeight: 900, overflowWrap: 'anywhere' }}>{workspace.title || workspace.symbol}</Typography><Typography variant="body2" color="text.secondary">{workspace.strategyName || workspace.strategyNameSnapshot || t('backtesting.workspace.unlinkedStrategy')}</Typography></Box>
          <EvidenceStatusBadge status={workspace.evidenceStatus || 'INSUFFICIENT_DATA'} />
        </Stack>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap"><Chip size="small" label={workspace.symbol} /><Chip size="small" variant="outlined" label={workspace.session || t('backtesting.workspace.anySession')} /><Chip size="small" variant="outlined" label={workspace.primaryTimeframe || t('backtesting.workspace.anyTimeframe')} /></Stack>
        <Grid container spacing={1}>{[
          ['trades', workspace.numberOfTrades],
          ['manual', workspace.manualTradeCount || 0],
          ['live', workspace.liveTradeCount || 0],
          ['winRate', formatPercent(workspace.winRate, locale)],
          ['totalR', formatR(workspace.totalR, locale)],
          ['expectancy', formatR(workspace.expectancy, locale)]
        ].map(([key, value]) => <Grid key={key} item xs={4}><Typography variant="caption" color="text.secondary">{t(`backtesting.metrics.${key}`)}</Typography><Typography variant="body2" sx={{ fontWeight: 800 }}>{value}</Typography></Grid>)}</Grid>
        <Typography variant="caption" color="text.secondary">{t('backtesting.workspace.updated', { date: formatDate(workspace.updatedAt, locale) })}</Typography>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 'auto' }}>
          <Button size="small" variant="contained" onClick={onOpen}>{t('backtesting.actions.openWorkspace')}</Button>
          <Button size="small" startIcon={<UploadFileRoundedIcon />} onClick={onImport}>{t('backtesting.actions.import')}</Button>
          <Tooltip title={t('backtesting.actions.editWorkspace')}><IconButton size="small" aria-label={t('backtesting.actions.editWorkspace')} onClick={onEdit}><EditRoundedIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      </Stack>
    </Paper>
  )
}

function WorkspaceDetail({ workspace, strategies, onBack, onEdit, onArchive, onImport, onAddManual, onEditManual, onFeedback, onError, invalidate }: {
  workspace: BacktestingWorkspace
  strategies: StrategyResponse[]
  onBack: () => void
  onEdit: () => void
  onArchive: () => void
  onImport: () => void
  onAddManual: () => void
  onEditManual: (trade: BacktestingTrade) => void
  onFeedback: (message: string) => void
  onError: (caught: unknown, key: string) => void
  invalidate: () => Promise<void>
}) {
  const { t, locale } = useI18n()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [tab, setTab] = useState<WorkspaceTab>('overview')
  const [filters, setFilters] = useState<ResearchFilters>(emptyResearchFilters)
  const [filterDialog, setFilterDialog] = useState(false)
  const tradesQuery = useQuery({ queryKey: ['backtestingTrades', workspace.id], queryFn: () => listBacktestingTrades(workspace.id) })
  const analyticsQuery = useQuery({ queryKey: ['backtestingAnalytics', workspace.id], queryFn: () => getBacktestingAnalytics(workspace.id) })
  const screenshotsQuery = useQuery({ queryKey: ['backtestingScreenshots', workspace.id], queryFn: () => listBacktestingScreenshots(workspace.id) })
  const lensesQuery = useQuery({ queryKey: ['backtestingEdgeLenses', workspace.id], queryFn: () => listBacktestingEdgeLenses(workspace.id) })
  const trades = useMemo(() => tradesQuery.data || [], [tradesQuery.data])
  const filtered = useMemo(() => filterResearchTrades(trades, filters), [filters, trades])
  const metrics = useMemo(() => computeResearchMetrics(filtered), [filtered])
  const tabs: WorkspaceTab[] = ['overview', 'trades', 'edge', 'evidence', 'notes']
  if (tradesQuery.isLoading) return <LoadingState rows={5} height={88} />
  return (
    <Stack spacing={1.5}>
      <Button startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ alignSelf: 'flex-start' }}>{t('backtesting.actions.backToLibrary')}</Button>
      <WorkspaceHeader workspace={workspace} metrics={metrics} locale={locale} onEdit={onEdit} onArchive={onArchive} onImport={onImport} onAddManual={onAddManual} />
      <ResearchFilterBar filters={filters} setFilters={setFilters} resultCount={filtered.length} mobile={isMobile} onOpenMobile={() => setFilterDialog(true)} />
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {isMobile ? <Box sx={{ p: 1 }}><Select fullWidth size="small" value={tab} onChange={(event) => setTab(event.target.value as WorkspaceTab)} aria-label={t('backtesting.accessibility.sectionNavigation')}>{tabs.map((value) => <MenuItem key={value} value={value}>{t(`backtesting.tabs.${value}`)}</MenuItem>)}</Select></Box> : <Tabs value={tab} onChange={(_, value) => setTab(value)} aria-label={t('backtesting.accessibility.sectionNavigation')}>{tabs.map((value) => <Tab key={value} value={value} label={t(`backtesting.tabs.${value}`)} />)}</Tabs>}
        <Divider />
        <Box sx={{ p: { xs: 1.25, md: 2 } }}>
          {tab === 'overview' && <OverviewSection trades={filtered} allTrades={trades} metrics={metrics} analytics={analyticsQuery.data} />}
          {tab === 'trades' && <TradesSection trades={filtered} locale={locale} onAdd={onAddManual} onEdit={onEditManual} onFeedback={onFeedback} onError={onError} invalidate={invalidate} />}
          {tab === 'edge' && <EdgeAnalysisSection trades={filtered} baseline={metrics} lenses={lensesQuery.data || []} filters={filters} setFilters={setFilters} workspaceId={workspace.id} onFeedback={onFeedback} onError={onError} invalidate={invalidate} />}
          {tab === 'evidence' && <EvidenceSection workspace={workspace} screenshots={screenshotsQuery.data || []} trades={trades} onFeedback={onFeedback} onError={onError} invalidate={invalidate} />}
          {tab === 'notes' && <NotesSection workspace={workspace} onFeedback={onFeedback} onError={onError} invalidate={invalidate} />}
        </Box>
      </Paper>
      {isMobile && <Paper elevation={8} sx={{ position: 'fixed', zIndex: 10, left: 0, right: 0, bottom: 0, p: 1, pb: 'calc(8px + env(safe-area-inset-bottom))' }}><Stack direction="row" spacing={1}><Button fullWidth variant="contained" startIcon={<AddRoundedIcon />} onClick={onAddManual}>{t('backtesting.actions.addManualTrade')}</Button><Button fullWidth variant="outlined" startIcon={<FilterAltRoundedIcon />} onClick={() => setFilterDialog(true)}>{t('backtesting.actions.filters')}</Button></Stack></Paper>}
      <Dialog fullScreen open={filterDialog} onClose={() => setFilterDialog(false)}><DialogTitle>{t('backtesting.filters.title')}</DialogTitle><DialogContent dividers><ResearchFilterFields filters={filters} setFilters={setFilters} /></DialogContent><Box sx={{ p: 2 }}><Stack spacing={1}><Button variant="contained" onClick={() => setFilterDialog(false)}>{t('backtesting.actions.showResults', { count: filtered.length })}</Button><Button onClick={() => setFilters(emptyResearchFilters)}>{t('backtesting.actions.clearFilters')}</Button></Stack></Box></Dialog>
    </Stack>
  )
}

function WorkspaceHeader({ workspace, metrics, locale, onEdit, onArchive, onImport, onAddManual }: { workspace: BacktestingWorkspace; metrics: BacktestingMetric; locale: string; onEdit: () => void; onArchive: () => void; onImport: () => void; onAddManual: () => void }) {
  const { t } = useI18n()
  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1.5}>
        <Box sx={{ minWidth: 0 }}><Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap"><Typography component="h1" variant="h5" sx={{ fontWeight: 900, overflowWrap: 'anywhere' }}>{workspace.title || workspace.symbol}</Typography><EvidenceStatusBadge status={workspace.evidenceStatus || 'INSUFFICIENT_DATA'} /><ConfidenceBadge confidence={workspace.evidenceConfidence || 'VERY_LOW'} /></Stack><Typography color="text.secondary">{workspace.strategyName || workspace.strategyNameSnapshot || t('backtesting.workspace.unlinkedStrategy')} · {workspace.symbol} · {workspace.session || t('backtesting.workspace.anySession')}</Typography><Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}><Chip size="small" label={t(`backtesting.autoImport.${workspace.autoImportMode || 'EXACT_MATCH'}.label`)} /><Chip size="small" variant="outlined" label={t('backtesting.workspace.filteredTrades', { count: metrics.trades })} /><Chip size="small" variant="outlined" label={t('backtesting.workspace.updated', { date: formatDate(workspace.updatedAt, locale) })} /></Stack></Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.75}><Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onAddManual}>{t('backtesting.actions.addManualTrade')}</Button><Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={onImport}>{t('backtesting.actions.import')}</Button><Button startIcon={<EditRoundedIcon />} onClick={onEdit}>{t('backtesting.actions.editWorkspace')}</Button><Button color="warning" startIcon={<ArchiveOutlinedIcon />} onClick={onArchive}>{t('backtesting.actions.archive')}</Button></Stack>
      </Stack>
    </Paper>
  )
}

function ResearchFilterBar({ filters, setFilters, resultCount, mobile, onOpenMobile }: { filters: ResearchFilters; setFilters: (value: ResearchFilters) => void; resultCount: number; mobile: boolean; onOpenMobile: () => void }) {
  const { t } = useI18n()
  const active = Object.values(filters).filter(Boolean).length
  if (mobile) return <Paper variant="outlined" sx={{ p: 1 }}><Stack direction="row" spacing={1} alignItems="center"><Button fullWidth startIcon={<FilterAltRoundedIcon />} onClick={onOpenMobile}>{t('backtesting.actions.filters')}{active ? ` · ${active}` : ''}</Button><Chip label={t('backtesting.filters.resultCount', { count: resultCount })} /></Stack></Paper>
  return <Paper variant="outlined" sx={{ p: 1.25 }}><ResearchFilterFields filters={filters} setFilters={setFilters} /><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}><Typography variant="caption" color="text.secondary">{t('backtesting.filters.resultCount', { count: resultCount })}</Typography><Button size="small" startIcon={<RestartAltRoundedIcon />} onClick={() => setFilters(emptyResearchFilters)}>{t('backtesting.actions.clearFilters')}</Button></Stack></Paper>
}

function ResearchFilterFields({ filters, setFilters }: { filters: ResearchFilters; setFilters: (value: ResearchFilters) => void }) {
  const { t } = useI18n()
  const set = (key: keyof ResearchFilters, value: string) => setFilters({ ...filters, [key]: value })
  return <Grid container spacing={1}><Grid item xs={12} md={3}><TextField fullWidth size="small" label={t('backtesting.filters.searchTrades')} value={filters.search} onChange={(event) => set('search', event.target.value)} /></Grid><Grid item xs={6} md={1.5}><TextField fullWidth size="small" type="date" label={t('backtesting.filters.from')} InputLabelProps={{ shrink: true }} value={filters.dateFrom} onChange={(event) => set('dateFrom', event.target.value)} /></Grid><Grid item xs={6} md={1.5}><TextField fullWidth size="small" type="date" label={t('backtesting.filters.to')} InputLabelProps={{ shrink: true }} value={filters.dateTo} onChange={(event) => set('dateTo', event.target.value)} /></Grid><Grid item xs={12} sm={4} md={2}><SelectField label={t('backtesting.filters.source')} value={filters.source} onChange={(value) => set('source', value)} options={(['MANUAL', 'IMPORT', 'LIVE'] as const).map((value) => [value, t(`backtesting.sources.${value}`)])} /></Grid><Grid item xs={12} sm={4} md={2}><SelectField label={t('backtesting.filters.result')} value={filters.result} onChange={(value) => set('result', value)} options={(['WIN', 'LOSS', 'BREAKEVEN'] as const).map((value) => [value, t(`backtesting.results.${value}`)])} /></Grid><Grid item xs={12} sm={4} md={2}><SelectField label={t('backtesting.filters.direction')} value={filters.direction} onChange={(value) => set('direction', value)} options={(['LONG', 'SHORT'] as const).map((value) => [value, t(`backtesting.direction.${value}`)])} /></Grid><Grid item xs={12} sm={6} md={3}><TextField fullWidth size="small" label={t('backtesting.filters.session')} value={filters.session} onChange={(event) => set('session', event.target.value)} /></Grid><Grid item xs={12} sm={6} md={3}><SelectField label={t('backtesting.filters.classificationStatus')} value={filters.classificationStatus} onChange={(value) => set('classificationStatus', value)} options={(['COMPLETE', 'NEEDS_CLASSIFICATION', 'PARTIAL'] as const).map((value) => [value, t(`backtesting.classificationStatus.${value}`)])} /></Grid></Grid>
}

function OverviewSection({ trades, allTrades, metrics, analytics }: { trades: BacktestingTrade[]; allTrades: BacktestingTrade[]; metrics: BacktestingMetric; analytics?: BacktestingAnalytics }) {
  const { t, locale } = useI18n()
  return <Stack spacing={2}><Grid container spacing={1.25}>{[
    ['totalCompleted', metrics.trades], ['winRate', formatPercent(metrics.winRate, locale)], ['totalR', formatR(metrics.totalR, locale)], ['expectancy', formatR(metrics.expectancy, locale)], ['profitFactor', formatNumber(metrics.profitFactor, locale)], ['maximumDrawdown', formatR(metrics.maximumDrawdownR, locale)]
  ].map(([key, value]) => <Grid key={key} item xs={6} md={4} lg={2}><MetricCard label={t(`backtesting.metrics.${key}`)} value={value} /></Grid>)}</Grid><ManualLiveComparison trades={trades} analytics={analytics} /><RegressionPanel analytics={analytics} /><Suspense fallback={<LoadingState rows={2} height={280} />}><BacktestingCharts trades={trades} /></Suspense>{allTrades.length !== trades.length && <Alert severity="info">{t('backtesting.overview.filteredNotice', { visible: trades.length, total: allTrades.length })}</Alert>}</Stack>
}

function ManualLiveComparison({ trades, analytics }: { trades: BacktestingTrade[]; analytics?: BacktestingAnalytics }) {
  const { t, locale } = useI18n()
  const sources = (['MANUAL', 'IMPORT', 'LIVE'] as const).map((source) => {
    const sourceTrades = trades.filter((trade) => trade.source === source)
    return { source, sourceTrades, metrics: analytics?.sourceMetrics?.[source] || computeResearchMetrics(sourceTrades) }
  })
  const historical = computeResearchMetrics(trades.filter((trade) => trade.source !== 'LIVE'))
  const live = computeResearchMetrics(trades.filter((trade) => trade.source === 'LIVE'))
  const gap = live.trades ? live.expectancy - historical.expectancy : null
  return <Paper variant="outlined" sx={{ p: 1.5 }}><Stack spacing={1}><Box><Typography component="h2" variant="h6" sx={{ fontWeight: 850 }}>{t('backtesting.comparison.title')}</Typography><Typography variant="body2" color="text.secondary">{t('backtesting.comparison.description')}</Typography></Box>{gap !== null && <Alert severity={gap < -0.5 ? 'warning' : gap > 0.2 ? 'success' : 'info'}>{gap < 0 ? t('backtesting.comparison.liveUnderperforms', { gap: formatR(Math.abs(gap), locale), count: live.trades }) : t('backtesting.comparison.liveConfirms', { gap: formatR(gap, locale), count: live.trades })}</Alert>}<TableContainer><Table size="small"><TableHead><TableRow><TableCell>{t('backtesting.filters.source')}</TableCell>{['trades', 'winRate', 'averageR', 'expectancy', 'profitFactor', 'averageWinner', 'averageLoser', 'maximumDrawdown', 'ruleBreakFrequency'].map((key) => <TableCell key={key} align="right">{t(`backtesting.metrics.${key}`)}</TableCell>)}</TableRow></TableHead><TableBody>{sources.map(({ source, sourceTrades, metrics }) => <TableRow key={source}><TableCell><SourceBadge source={source} /></TableCell><TableCell align="right">{metrics.trades}</TableCell><TableCell align="right">{formatPercent(metrics.winRate, locale)}</TableCell><TableCell align="right">{formatR(metrics.averageR, locale)}</TableCell><TableCell align="right">{formatR(metrics.expectancy, locale)}</TableCell><TableCell align="right">{formatNumber(metrics.profitFactor, locale)}</TableCell><TableCell align="right">{formatR(metrics.averageWinR, locale)}</TableCell><TableCell align="right">{formatR(metrics.averageLossR, locale)}</TableCell><TableCell align="right">{formatR(metrics.maximumDrawdownR, locale)}</TableCell><TableCell align="right">{formatPercent(sourceTrades.length ? (sourceTrades.filter((trade) => (trade.ruleBreakCount || 0) > 0).length / sourceTrades.length) * 100 : 0, locale)}</TableCell></TableRow>)}</TableBody></Table></TableContainer></Stack></Paper>
}

function RegressionPanel({ analytics }: { analytics?: BacktestingAnalytics }) {
  const { t } = useI18n()
  const status = analytics?.regressionStatus || 'INSUFFICIENT_LIVE_DATA'
  const severity = status === 'DETERIORATING' ? 'error' : status === 'WATCH' ? 'warning' : status === 'IMPROVING' ? 'success' : 'info'
  return <Alert severity={severity}><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{t('backtesting.regression.title')} · {t(`backtesting.regression.status.${status}`)}</Typography><Typography variant="body2">{t(`backtesting.regression.description.${status}`, { count: analytics?.recentLiveSampleSize || 0 })}</Typography></Alert>
}

function TradesSection({ trades, locale, onAdd, onEdit, onFeedback, onError, invalidate }: { trades: BacktestingTrade[]; locale: string; onAdd: () => void; onEdit: (trade: BacktestingTrade) => void; onFeedback: (message: string) => void; onError: (caught: unknown, key: string) => void; invalidate: () => Promise<void> }) {
  const { t } = useI18n()
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('md'))
  const [page, setPage] = useState(0)
  const pageSize = 25
  const pageCount = Math.max(1, Math.ceil(trades.length / pageSize))
  const visiblePage = Math.min(page, pageCount - 1)
  const visibleTrades = trades.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize)
  const deleteMutation = useMutation({ mutationFn: deleteBacktestingTrade, onSuccess: async () => { onFeedback(t('backtesting.feedback.tradeDeleted')); await invalidate() }, onError: (caught) => onError(caught, 'backtesting.errors.tradeDelete') })
  const evidenceMutation = useMutation({ mutationFn: excludeBacktestingEvidence, onSuccess: async () => { onFeedback(t('backtesting.feedback.evidenceExcluded')); await invalidate() }, onError: (caught) => onError(caught, 'backtesting.errors.evidenceUpdate') })
  if (!trades.length) return <EmptyState title={t('backtesting.empty.tradesTitle')} description={t('backtesting.empty.tradesBody')} action={<Button variant="contained" onClick={onAdd}>{t('backtesting.actions.addManualTrade')}</Button>} />
  const actions = (trade: BacktestingTrade) => trade.source === 'LIVE' ? <Stack direction="row" spacing={0.5}><Button size="small" startIcon={<OpenInNewRoundedIcon />} href={`/trades?tradeId=${trade.liveTradeId}`}>{t('backtesting.actions.openLiveTrade')}</Button><Button size="small" color="warning" onClick={() => evidenceMutation.mutate(trade.id)}>{t('backtesting.actions.exclude')}</Button></Stack> : <Stack direction="row" spacing={0.5}><Button size="small" onClick={() => onEdit(trade)}>{t('backtesting.actions.edit')}</Button><Button size="small" color="error" onClick={() => { if (window.confirm(t('backtesting.dialogs.deleteTradeConfirm'))) deleteMutation.mutate(trade.id) }}>{t('backtesting.actions.delete')}</Button></Stack>
  const content = mobile ? <Stack spacing={1}>{visibleTrades.map((trade) => <Paper key={trade.id} variant="outlined" sx={{ p: 1.25 }}><Stack spacing={1}><Stack direction="row" justifyContent="space-between" spacing={1}><Box><Typography variant="subtitle2" sx={{ fontWeight: 850 }}>{trade.instrument} · {t(`backtesting.direction.${trade.direction}`)}</Typography><Typography variant="caption" color="text.secondary">{formatDate(trade.date, locale)} · {trade.session || t('backtesting.workspace.anySession')}</Typography></Box><ResultBadge result={trade.result} /></Stack><Typography variant="body2">{trade.strategyNameSnapshot || trade.setupName || t('backtesting.workspace.unlinkedStrategy')}</Typography><Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap"><SourceBadge source={trade.source} /><ClassificationBadge status={trade.classificationStatus || 'COMPLETE'} /><Chip size="small" label={formatR(trade.pnlR, locale)} /></Stack>{actions(trade)}</Stack></Paper>)}</Stack> : <TableContainer><Table size="small"><TableHead><TableRow>{['date', 'instrument', 'direction', 'strategySetup', 'session', 'source', 'result', 'r', 'classification', 'actions'].map((key) => <TableCell key={key}>{t(`backtesting.trades.${key}`)}</TableCell>)}</TableRow></TableHead><TableBody>{visibleTrades.map((trade) => <TableRow key={trade.id} hover><TableCell>{formatDate(trade.date, locale)}</TableCell><TableCell>{trade.instrument}</TableCell><TableCell>{t(`backtesting.direction.${trade.direction}`)}</TableCell><TableCell>{trade.strategyNameSnapshot || trade.setupName || '-'}</TableCell><TableCell>{trade.session || '-'}</TableCell><TableCell><SourceBadge source={trade.source} /></TableCell><TableCell><ResultBadge result={trade.result} /></TableCell><TableCell sx={{ fontWeight: 800 }}>{formatR(trade.pnlR, locale)}</TableCell><TableCell><ClassificationBadge status={trade.classificationStatus || 'COMPLETE'} /></TableCell><TableCell>{actions(trade)}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
  return <Stack spacing={1}>{content}{pageCount > 1 && <Stack direction="row" justifyContent="flex-end" spacing={1} alignItems="center"><Button size="small" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>{t('backtesting.pagination.previous')}</Button><Typography variant="caption" aria-live="polite">{t('backtesting.pagination.status', { current: visiblePage + 1, total: pageCount })}</Typography><Button size="small" disabled={visiblePage >= pageCount - 1} onClick={() => setPage(visiblePage + 1)}>{t('backtesting.pagination.next')}</Button></Stack>}</Stack>
}

function EdgeAnalysisSection({ trades, baseline, lenses, filters, setFilters, workspaceId, onFeedback, onError, invalidate }: { trades: BacktestingTrade[]; baseline: BacktestingMetric; lenses: BacktestingEdgeLens[]; filters: ResearchFilters; setFilters: (value: ResearchFilters) => void; workspaceId: string; onFeedback: (message: string) => void; onError: (caught: unknown, key: string) => void; invalidate: () => Promise<void> }) {
  const { t, locale } = useI18n()
  const lensMutation = useMutation({ mutationFn: ({ id, name, definition }: { id?: string; name: string; definition: Record<string, unknown> }) => id ? updateBacktestingEdgeLens(id, { name, filterDefinition: definition }) : createBacktestingEdgeLens(workspaceId, { name, filterDefinition: definition }), onSuccess: async () => { onFeedback(t('backtesting.feedback.lensSaved')); await invalidate() }, onError: (caught) => onError(caught, 'backtesting.errors.lensSave') })
  const deleteMutation = useMutation({ mutationFn: deleteBacktestingEdgeLens, onSuccess: async () => { onFeedback(t('backtesting.feedback.lensDeleted')); await invalidate() }, onError: (caught) => onError(caught, 'backtesting.errors.lensDelete') })
  const breakdowns = buildEdgeBreakdowns(trades)
  const supported = breakdowns.filter((row) => row.metrics.trades >= 5)
  const best = [...supported].sort((left, right) => right.metrics.expectancy - left.metrics.expectancy)[0]
  const weakest = [...supported].sort((left, right) => left.metrics.expectancy - right.metrics.expectancy)[0]
  const saveLens = () => { const name = window.prompt(t('backtesting.dialogs.lensNamePrompt')); if (name?.trim()) lensMutation.mutate({ name: name.trim(), definition: filters }) }
  return <Stack spacing={2}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Box><Typography component="h2" variant="h6" sx={{ fontWeight: 850 }}>{t('backtesting.edge.title')}</Typography><Typography variant="body2" color="text.secondary">{t('backtesting.edge.description')}</Typography></Box><Button variant="outlined" onClick={saveLens}>{t('backtesting.actions.saveEdgeLens')}</Button></Stack><Grid container spacing={1.5}><Grid item xs={12} md={6}><FindingCard title={t('backtesting.edge.bestSupported')} finding={best} locale={locale} /></Grid><Grid item xs={12} md={6}><FindingCard title={t('backtesting.edge.weakestSupported')} finding={weakest} locale={locale} /></Grid></Grid>{breakdowns.length ? <TableContainer><Table size="small"><TableHead><TableRow>{['condition', 'tradeCount', 'winRate', 'expectancy', 'sourceMix', 'strength'].map((key) => <TableCell key={key}>{t(`backtesting.edge.${key}`)}</TableCell>)}</TableRow></TableHead><TableBody>{breakdowns.map((row) => <TableRow key={`${row.dimension}-${row.label}`}><TableCell><Typography variant="caption" color="text.secondary">{t(`backtesting.edge.dimension.${row.dimension}`)}</Typography><Typography variant="body2" sx={{ fontWeight: 800 }}>{row.label}</Typography></TableCell><TableCell>{row.metrics.trades}</TableCell><TableCell>{formatPercent(row.metrics.winRate, locale)}</TableCell><TableCell>{formatR(row.metrics.expectancy, locale)}</TableCell><TableCell><Stack direction="row" spacing={0.35}>{Object.entries(sourceCounts(row.trades)).filter(([, count]) => count).map(([source, count]) => <Chip key={source} size="small" label={`${t(`backtesting.sources.${source}`)} ${count}`} />)}</Stack></TableCell><TableCell><EvidenceStatusBadge status={row.metrics.trades >= 50 && row.metrics.expectancy >= 0 ? 'VALIDATED_EVIDENCE' : row.metrics.trades >= 30 ? 'DEVELOPING_EDGE' : row.metrics.trades >= 10 ? 'EARLY_SIGNAL' : row.metrics.trades >= 5 ? 'EXPLORATORY' : 'INSUFFICIENT_DATA'} /></TableCell></TableRow>)}</TableBody></Table></TableContainer> : <EmptyState title={t('backtesting.empty.edgeTitle')} description={t('backtesting.empty.edgeBody')} />}<Paper variant="outlined" sx={{ p: 1.25 }}><Typography variant="subtitle2" sx={{ fontWeight: 850, mb: 1 }}>{t('backtesting.edge.savedLenses')}</Typography>{lenses.length ? <Stack spacing={0.75}>{lenses.map((lens) => <Stack key={lens.id} direction={{ xs: 'column', sm: 'row' }} spacing={0.75} alignItems={{ sm: 'center' }} justifyContent="space-between"><Box><Typography variant="body2" sx={{ fontWeight: 800 }}>{lens.name}</Typography><Typography variant="caption" color="text.secondary">{t('backtesting.filters.resultCount', { count: lens.metrics.trades })}</Typography></Box><Stack direction="row" spacing={0.5}><Button size="small" onClick={() => setFilters({ ...emptyResearchFilters, ...(lens.filterDefinition as Partial<ResearchFilters>) })}>{t('backtesting.actions.apply')}</Button><IconButton size="small" aria-label={t('backtesting.actions.duplicate')} onClick={() => lensMutation.mutate({ name: `${lens.name} · ${t('backtesting.edge.copy')}`, definition: lens.filterDefinition })}><ContentCopyRoundedIcon fontSize="small" /></IconButton><IconButton size="small" color="error" aria-label={t('backtesting.actions.delete')} onClick={() => deleteMutation.mutate(lens.id)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Stack></Stack>)}</Stack> : <Typography variant="body2" color="text.secondary">{t('backtesting.empty.lenses')}</Typography>}</Paper><Alert severity="info">{t('backtesting.edge.sampleWarning', { count: baseline.trades })}</Alert></Stack>
}

function EvidenceSection({ workspace, screenshots, trades, onFeedback, onError, invalidate }: { workspace: BacktestingWorkspace; screenshots: BacktestingScreenshot[]; trades: BacktestingTrade[]; onFeedback: (message: string) => void; onError: (caught: unknown, key: string) => void; invalidate: () => Promise<void> }) {
  const { t, locale } = useI18n()
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [preview, setPreview] = useState<{ url?: string | null; alt: string } | null>(null)
  const liveTradesWithScreenshots = useMemo(
    () => trades.filter((trade) => trade.source === 'LIVE' && trade.liveTradeId && (trade.screenshotCount || 0) > 0),
    [trades]
  )
  const liveAssetQueries = useQueries({
    queries: liveTradesWithScreenshots.map((trade) => ({
      queryKey: ['tradeAssets', trade.liveTradeId],
      queryFn: () => listTradeAssets(trade.liveTradeId!),
      staleTime: 60_000
    }))
  })
  const liveAssets = liveAssetQueries.flatMap((query, index) =>
    (query.data || [])
      .filter((asset) => asset.image !== false)
      .map((asset) => ({ asset, trade: liveTradesWithScreenshots[index] }))
  )
  const uploadMutation = useMutation({ mutationFn: (files: File[]) => uploadBacktestingScreenshots(workspace.id, files), onSuccess: async () => { onFeedback(t('backtesting.feedback.screenshotsUploaded')); await invalidate() }, onError: (caught) => onError(caught, 'backtesting.errors.screenshotUpload') })
  const deleteMutation = useMutation({ mutationFn: deleteBacktestingScreenshot, onSuccess: async () => { onFeedback(t('backtesting.feedback.screenshotDeleted')); await invalidate() }, onError: (caught) => onError(caught, 'backtesting.errors.screenshotDelete') })
  const categoryMutation = useMutation({ mutationFn: ({ id, category }: { id: string; category: string }) => updateBacktestingScreenshot(id, { tags: [category] }), onSuccess: invalidate, onError: (caught) => onError(caught, 'backtesting.errors.screenshotSave') })
  const uploadFiles = (files: File[]) => { if (files.length) uploadMutation.mutate(files) }
  const assetUrl = (asset: AssetItem) => asset.thumbnailUrl || asset.viewUrl || asset.url || asset.downloadUrl
  return <Stack spacing={1.5}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
      <Box><Typography component="h2" variant="h6" sx={{ fontWeight: 850 }}>{t('backtesting.evidence.title')}</Typography><Typography variant="body2" color="text.secondary">{t('backtesting.evidence.description')}</Typography></Box>
      <Paper
        variant="outlined"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); uploadFiles(Array.from(event.dataTransfer.files || [])) }}
        aria-label={t('backtesting.accessibility.screenshotDropZone')}
        sx={{ p: 0.75, borderStyle: { sm: 'dashed' } }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          {!mobile && <Typography variant="caption" color="text.secondary">{t('backtesting.evidence.dropScreenshots')}</Typography>}
          <Button component="label" variant="contained" startIcon={<PhotoLibraryRoundedIcon />}>
            {uploadMutation.isLoading ? t('backtesting.actions.uploading') : t('backtesting.actions.uploadScreenshots')}
            <input hidden multiple type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { uploadFiles(Array.from(event.target.files || [])); event.target.value = '' }} />
          </Button>
        </Stack>
      </Paper>
    </Stack>
    {screenshots.length ? <Grid container spacing={1.5}>{screenshots.map((screenshot) => {
      const url = screenshot.thumbnailUrl || screenshot.viewUrl || screenshot.url
      const alt = screenshot.caption || screenshot.originalFileName
      return <Grid key={screenshot.id} item xs={12} sm={6} lg={4}><Paper variant="outlined" sx={{ overflow: 'hidden' }}><ButtonBase aria-label={t('backtesting.accessibility.openScreenshot', { name: alt })} onClick={() => setPreview({ url: screenshot.viewUrl || screenshot.url || screenshot.thumbnailUrl, alt })} sx={{ display: 'block', width: '100%' }}><Box sx={{ aspectRatio: '16 / 10', bgcolor: 'action.hover' }}><SecureAssetImage url={url} alt={alt} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Box></ButtonBase><Stack spacing={1} sx={{ p: 1.25 }}><Typography variant="body2" sx={{ fontWeight: 800 }}>{alt}</Typography><Select size="small" fullWidth displayEmpty value={screenshot.tags?.[0] || ''} onChange={(event) => categoryMutation.mutate({ id: screenshot.id, category: event.target.value })}><MenuItem value="">{t('backtesting.evidence.chooseCategory')}</MenuItem>{['higherTimeframe', 'beforeEntry', 'atEntry', 'duringTrade', 'afterExit', 'reviewAnnotation'].map((key) => <MenuItem key={key} value={key}>{t(`backtesting.evidence.categories.${key}`)}</MenuItem>)}</Select><Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">{screenshot.backtestingTradeId ? t('backtesting.evidence.linkedTrade') : t('backtesting.evidence.workspaceEvidence')}</Typography><IconButton size="small" color="error" aria-label={t('backtesting.actions.deleteScreenshot')} onClick={() => { if (window.confirm(t('backtesting.dialogs.deleteScreenshotConfirm'))) deleteMutation.mutate(screenshot.id) }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></Stack></Stack></Paper></Grid>
    })}</Grid> : <EmptyState title={t('backtesting.empty.evidenceTitle')} description={t('backtesting.empty.evidenceBody')} />}
    <Box>
      <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 850 }}>{t('backtesting.evidence.linkedLiveTitle')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('backtesting.evidence.liveReuse', { count: liveTradesWithScreenshots.length })}</Typography>
      {liveAssetQueries.some((query) => query.isLoading) && <LoadingState rows={1} height={180} />}
      {liveAssets.length > 0 && <Grid container spacing={1.5}>{liveAssets.map(({ asset, trade }) => {
        const alt = asset.originalFileName || `${trade.instrument} ${formatDate(trade.date, locale)}`
        return <Grid key={`${trade.id}-${asset.id}`} item xs={12} sm={6} lg={4}><Paper variant="outlined" sx={{ overflow: 'hidden' }}><ButtonBase aria-label={t('backtesting.accessibility.openScreenshot', { name: alt })} onClick={() => setPreview({ url: asset.viewUrl || asset.url || asset.downloadUrl || asset.thumbnailUrl, alt })} sx={{ display: 'block', width: '100%' }}><Box sx={{ aspectRatio: '16 / 10', bgcolor: 'action.hover' }}><SecureAssetImage url={assetUrl(asset)} alt={alt} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /></Box></ButtonBase><Stack spacing={0.75} sx={{ p: 1.25 }}><Stack direction="row" spacing={0.5} alignItems="center"><SourceBadge source="LIVE" /><Typography variant="body2" sx={{ fontWeight: 800 }}>{trade.instrument} · {formatR(trade.pnlR, locale)}</Typography></Stack><Typography variant="caption" color="text.secondary">{t('backtesting.evidence.canonicalLiveAsset')}</Typography><Button size="small" startIcon={<OpenInNewRoundedIcon />} href={`/trades?tradeId=${trade.liveTradeId}`}>{t('backtesting.actions.openLiveTrade')}</Button></Stack></Paper></Grid>
      })}</Grid>}
      {!liveAssetQueries.some((query) => query.isLoading) && liveAssets.length === 0 && <Alert severity="info">{t('backtesting.evidence.noLinkedLiveScreenshots')}</Alert>}
    </Box>
    <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} fullScreen={mobile} fullWidth maxWidth="lg" aria-labelledby="backtesting-screenshot-preview-title"><DialogTitle id="backtesting-screenshot-preview-title">{t('backtesting.evidence.previewTitle')}</DialogTitle><DialogContent sx={{ display: 'grid', placeItems: 'center', minHeight: { xs: '70vh', sm: 560 } }}>{preview && <SecureAssetImage url={preview.url} alt={preview.alt} sx={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} />}</DialogContent></Dialog>
  </Stack>
}

function NotesSection({ workspace, onFeedback, onError, invalidate }: { workspace: BacktestingWorkspace; onFeedback: (message: string) => void; onError: (caught: unknown, key: string) => void; invalidate: () => Promise<void> }) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<BacktestingWorkspacePayload>(() => workspacePayload(workspace))
  const mutation = useMutation({ mutationFn: (payload: BacktestingWorkspacePayload) => updateBacktestingWorkspace(workspace.id, payload), onSuccess: async () => { onFeedback(t('backtesting.feedback.notesSaved')); await invalidate() }, onError: (caught) => onError(caught, 'backtesting.errors.notesSave') })
  const fields: Array<[keyof BacktestingWorkspacePayload, string]> = [['whatWorked', 'whatWorks'], ['whatFailed', 'whatFails'], ['bestConditions', 'requiredConditions'], ['avoidConditions', 'invalidConditions'], ['executionObservations', 'executionObservations'], ['liveExecutionGap', 'liveExecutionGap'], ['nextTestingObjective', 'nextTestingObjective'], ['researchConclusion', 'researchConclusion'], ['notes', 'freeformNotes']]
  return <Stack spacing={1.5}><Box><Typography component="h2" variant="h6" sx={{ fontWeight: 850 }}>{t('backtesting.notes.title')}</Typography><Typography variant="body2" color="text.secondary">{t('backtesting.notes.description')}</Typography></Box><Grid container spacing={1.5}>{fields.map(([key, translation]) => <Grid key={key} item xs={12} md={key === 'notes' ? 12 : 6}><TextField fullWidth multiline minRows={3} label={t(`backtesting.notes.${translation}`)} value={String(draft[key] || '')} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></Grid>)}</Grid><Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1}><Typography role="status" variant="caption" color="text.secondary">{mutation.isLoading ? t('backtesting.notes.savingStatus') : t('backtesting.notes.readyStatus')}</Typography><Button variant="contained" disabled={mutation.isLoading} onClick={() => mutation.mutate(draft)}>{t('backtesting.actions.saveNotes')}</Button></Stack></Stack>
}

function ManualTradeMutationDialog({ open, workspace, trade, strategies, onClose, onSaved, onError }: { open: boolean; workspace: BacktestingWorkspace; trade: BacktestingTrade | null; strategies: StrategyResponse[]; onClose: () => void; onSaved: (message: string) => Promise<void>; onError: (caught: unknown) => void }) {
  const { t } = useI18n()
  const mutation = useMutation({ mutationFn: (payload: BacktestingTradePayload) => trade ? updateBacktestingTrade(trade.id, payload) : createBacktestingTrade(workspace.id, payload), onSuccess: () => onSaved(t('backtesting.feedback.tradeSaved')), onError })
  return <ManualTradeDialog open={open} workspace={workspace} trade={trade} strategies={strategies} saving={mutation.isLoading} onClose={onClose} onSave={(payload) => mutation.mutate(payload)} />
}

function MetricCard({ label, value }: { label: string; value: unknown }) {
  return <Paper variant="outlined" sx={{ p: 1.25, height: '100%' }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6" sx={{ mt: 0.25, fontWeight: 900, overflowWrap: 'anywhere' }}>{String(value ?? '-')}</Typography></Paper>
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<readonly [string, string]> }) {
  const { t } = useI18n()
  return <FormControl fullWidth size="small"><InputLabel>{label}</InputLabel><Select label={label} value={value} onChange={(event) => onChange(event.target.value)}><MenuItem value="">{t('backtesting.common.all')}</MenuItem>{options.map(([option, display]) => <MenuItem key={option} value={option}>{display}</MenuItem>)}</Select></FormControl>
}

function EvidenceStatusBadge({ status }: { status: BacktestingEvidenceStatus }) {
  const { t } = useI18n()
  const color = status === 'NEEDS_REVIEW' ? 'warning' : status === 'VALIDATED_EVIDENCE' ? 'success' : status === 'INSUFFICIENT_DATA' ? 'default' : 'info'
  return <Tooltip title={t(`backtesting.evidenceStatus.${status}.description`)}><Chip size="small" color={color} variant="outlined" label={t(`backtesting.evidenceStatus.${status}.label`)} /></Tooltip>
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const { t } = useI18n()
  return <Tooltip title={t(`backtesting.confidence.${confidence}.description`)}><Chip size="small" variant="outlined" label={`${t('backtesting.metrics.evidenceConfidence')}: ${t(`backtesting.confidence.${confidence}.label`)}`} /></Tooltip>
}

function SourceBadge({ source }: { source: string }) {
  const { t } = useI18n()
  return <Chip size="small" color={source === 'LIVE' ? 'success' : source === 'IMPORT' ? 'info' : 'default'} label={t(`backtesting.sources.${source}`)} />
}

function ClassificationBadge({ status }: { status: BacktestingClassificationStatus }) {
  const { t } = useI18n()
  return <Chip size="small" variant="outlined" color={status === 'COMPLETE' ? 'success' : 'warning'} label={t(`backtesting.classificationStatus.${status}`)} />
}

function ResultBadge({ result }: { result: string }) {
  const { t } = useI18n()
  return <Chip size="small" color={result === 'WIN' ? 'success' : result === 'LOSS' ? 'error' : 'warning'} label={t(`backtesting.results.${result}`)} />
}

type EdgeRow = { dimension: 'session' | 'direction' | 'weekday' | 'source'; label: string; trades: BacktestingTrade[]; metrics: BacktestingMetric }
const buildEdgeBreakdowns = (trades: BacktestingTrade[]): EdgeRow[] => {
  const dimensions: Array<[EdgeRow['dimension'], (trade: BacktestingTrade) => string]> = [['session', (trade) => trade.session || '-'], ['direction', (trade) => trade.direction], ['weekday', (trade) => trade.weekday || '-'], ['source', (trade) => trade.source]]
  return dimensions.flatMap(([dimension, classifier]) => {
    const groups = new Map<string, BacktestingTrade[]>()
    trades.forEach((trade) => groups.set(classifier(trade), [...(groups.get(classifier(trade)) || []), trade]))
    return [...groups.entries()].map(([label, rows]) => ({ dimension, label, trades: rows, metrics: computeResearchMetrics(rows) }))
  }).sort((left, right) => right.metrics.trades - left.metrics.trades)
}

function FindingCard({ title, finding, locale }: { title: string; finding?: EdgeRow; locale: string }) {
  const { t } = useI18n()
  return <Paper variant="outlined" sx={{ p: 1.25, height: '100%' }}><Typography variant="caption" color="text.secondary">{title}</Typography>{finding ? <Stack spacing={0.5} sx={{ mt: 0.5 }}><Typography variant="subtitle1" sx={{ fontWeight: 850 }}>{finding.label}</Typography><Typography variant="body2">{t('backtesting.edge.findingSummary', { count: finding.metrics.trades, expectancy: formatR(finding.metrics.expectancy, locale), winRate: formatPercent(finding.metrics.winRate, locale) })}</Typography></Stack> : <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{t('backtesting.edge.notEnoughSupported')}</Typography>}</Paper>
}

const workspacePayload = (workspace: BacktestingWorkspace): BacktestingWorkspacePayload => ({
  symbol: workspace.symbol,
  marketType: workspace.marketType,
  strategyId: workspace.strategyId,
  strategyNameSnapshot: workspace.strategyNameSnapshot,
  title: workspace.title,
  primaryTimeframe: workspace.primaryTimeframe,
  contextTimeframe: workspace.contextTimeframe,
  executionTimeframe: workspace.executionTimeframe,
  entryTimeframe: workspace.entryTimeframe,
  session: workspace.session,
  autoImportMode: workspace.autoImportMode,
  description: workspace.description,
  researchObjective: workspace.researchObjective,
  notes: workspace.notes,
  whatWorked: workspace.whatWorked,
  whatFailed: workspace.whatFailed,
  bestConditions: workspace.bestConditions,
  avoidConditions: workspace.avoidConditions,
  executionObservations: workspace.executionObservations,
  liveExecutionGap: workspace.liveExecutionGap,
  nextTestingObjective: workspace.nextTestingObjective,
  researchConclusion: workspace.researchConclusion
})

const formatNumber = (value: number | null | undefined, locale: string) => value === null || value === undefined ? '-' : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
const formatR = (value: number | null | undefined, locale: string) => value === null || value === undefined ? '-' : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}R`
const formatPercent = (value: number | null | undefined, locale: string) => value === null || value === undefined ? '-' : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value / 100)
const formatDate = (value: string | null | undefined, locale: string) => !value ? '-' : new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
