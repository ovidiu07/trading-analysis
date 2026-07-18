import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  useMediaQuery,
  useTheme
} from '@mui/material'
import type {
  BacktestingTrade,
  BacktestingTradePayload,
  BacktestingWorkspace,
  BacktestingWorkspacePayload
} from '../../api/backtesting'
import type { StrategyResponse } from '../../api/strategies'
import { useI18n } from '../../i18n'

const emptyWorkspace: BacktestingWorkspacePayload = {
  symbol: '',
  title: '',
  marketType: '',
  strategyId: null,
  strategyNameSnapshot: '',
  session: '',
  primaryTimeframe: '',
  contextTimeframe: '',
  executionTimeframe: '',
  entryTimeframe: '',
  autoImportMode: 'EXACT_MATCH',
  description: '',
  researchObjective: '',
  notes: '',
  whatWorked: '',
  whatFailed: '',
  bestConditions: '',
  avoidConditions: '',
  executionObservations: '',
  liveExecutionGap: '',
  nextTestingObjective: '',
  researchConclusion: ''
}

const emptyTrade = (): BacktestingTradePayload => ({
  date: new Date().toISOString().slice(0, 10),
  entryTime: '09:30',
  instrument: '',
  direction: 'LONG',
  session: '',
  setupName: '',
  strategyId: null,
  strategySource: null,
  strategyNameSnapshot: '',
  gapPresent: false,
  gapType: null,
  gapTimeframe: '',
  gapCreatedAt: '',
  gapMitigatedAt: '',
  gapHigh: null,
  gapLow: null,
  gapMidpoint: null,
  gapSizePoints: null,
  gapSizePercent: null,
  gapEntryPositionPercent: null,
  gapFillStatus: null,
  gapRelationToLiquidity: null,
  gapConfluenceNotes: '',
  riskPercent: null,
  plannedRR: null,
  result: 'WIN',
  pnlR: 1,
  contextTimeframe: '',
  executionTimeframe: '',
  entryTimeframe: '',
  tags: [],
  notes: '',
  source: 'MANUAL',
  tradeScope: 'BACKTEST'
})

export function WorkspaceDialog({
  open,
  workspace,
  strategies,
  saving,
  onClose,
  onSave
}: {
  open: boolean
  workspace: BacktestingWorkspace | null
  strategies: StrategyResponse[]
  saving: boolean
  onClose: () => void
  onSave: (payload: BacktestingWorkspacePayload) => void
}) {
  const { t } = useI18n()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [draft, setDraft] = useState<BacktestingWorkspacePayload>(emptyWorkspace)

  useEffect(() => {
    setDraft(workspace ? {
      ...emptyWorkspace,
      symbol: workspace.symbol,
      title: workspace.title || '',
      marketType: workspace.marketType || '',
      strategyId: workspace.strategyId || null,
      strategyNameSnapshot: workspace.strategyNameSnapshot || '',
      session: workspace.session || '',
      primaryTimeframe: workspace.primaryTimeframe || '',
      contextTimeframe: workspace.contextTimeframe || '',
      executionTimeframe: workspace.executionTimeframe || '',
      entryTimeframe: workspace.entryTimeframe || '',
      autoImportMode: workspace.autoImportMode || 'EXACT_MATCH',
      description: workspace.description || '',
      researchObjective: workspace.researchObjective || '',
      notes: workspace.notes || '',
      whatWorked: workspace.whatWorked || '',
      whatFailed: workspace.whatFailed || '',
      bestConditions: workspace.bestConditions || '',
      avoidConditions: workspace.avoidConditions || '',
      executionObservations: workspace.executionObservations || '',
      liveExecutionGap: workspace.liveExecutionGap || '',
      nextTestingObjective: workspace.nextTestingObjective || '',
      researchConclusion: workspace.researchConclusion || ''
    } : emptyWorkspace)
  }, [open, workspace])

  const set = <K extends keyof BacktestingWorkspacePayload>(key: K, value: BacktestingWorkspacePayload[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }
  const selectedStrategy = strategies.find((strategy) => strategy.id === draft.strategyId)
  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md" aria-labelledby="backtesting-workspace-dialog-title">
      <DialogTitle id="backtesting-workspace-dialog-title">
        {t(workspace ? 'backtesting.dialogs.editWorkspace' : 'backtesting.dialogs.newWorkspace')}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={7}>
            <TextField fullWidth required label={t('backtesting.workspace.name')} value={draft.title || ''} onChange={(event) => set('title', event.target.value)} />
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField fullWidth required label={t('backtesting.workspace.instrument')} value={draft.symbol} onChange={(event) => set('symbol', event.target.value.toUpperCase())} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>{t('backtesting.workspace.linkedStrategy')}</InputLabel>
              <Select label={t('backtesting.workspace.linkedStrategy')} value={draft.strategyId || ''} onChange={(event) => set('strategyId', event.target.value || null)}>
                <MenuItem value="">{t('backtesting.common.none')}</MenuItem>
                {strategies.map((strategy) => <MenuItem key={strategy.id} value={strategy.id}>{strategy.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label={t('backtesting.workspace.manualStrategyName')} disabled={Boolean(selectedStrategy)} value={selectedStrategy?.name || draft.strategyNameSnapshot || ''} onChange={(event) => set('strategyNameSnapshot', event.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label={t('backtesting.workspace.market')} value={draft.marketType || ''} onChange={(event) => set('marketType', event.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label={t('backtesting.workspace.session')} value={draft.session || ''} onChange={(event) => set('session', event.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label={t('backtesting.workspace.timeframe')} value={draft.primaryTimeframe || ''} onChange={(event) => set('primaryTimeframe', event.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>{t('backtesting.workspace.autoImportMode')}</InputLabel>
              <Select label={t('backtesting.workspace.autoImportMode')} value={draft.autoImportMode || 'EXACT_MATCH'} onChange={(event) => set('autoImportMode', event.target.value as BacktestingWorkspacePayload['autoImportMode'])}>
                {(['EXACT_MATCH', 'STRATEGY_MATCH', 'REVIEW_BEFORE_IMPORT', 'DISABLED'] as const).map((mode) => (
                  <MenuItem key={mode} value={mode}>{t(`backtesting.autoImport.${mode}.label`)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Alert severity="info" sx={{ mt: 1 }}>{t(`backtesting.autoImport.${draft.autoImportMode || 'EXACT_MATCH'}.description`)}</Alert>
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label={t('backtesting.workspace.description')} value={draft.description || ''} onChange={(event) => set('description', event.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth multiline minRows={2} label={t('backtesting.workspace.researchObjective')} value={draft.researchObjective || ''} onChange={(event) => set('researchObjective', event.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>{t('backtesting.actions.cancel')}</Button>
        <Button variant="contained" disabled={saving || !draft.symbol.trim() || !(draft.title || '').trim()} onClick={() => onSave({ ...draft, strategyNameSnapshot: selectedStrategy?.name || draft.strategyNameSnapshot })}>
          {saving ? t('backtesting.actions.saving') : t('backtesting.actions.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function ManualTradeDialog({
  open,
  workspace,
  trade,
  strategies,
  saving,
  onClose,
  onSave
}: {
  open: boolean
  workspace: BacktestingWorkspace
  trade: BacktestingTrade | null
  strategies: StrategyResponse[]
  saving: boolean
  onClose: () => void
  onSave: (payload: BacktestingTradePayload) => void
}) {
  const { t } = useI18n()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [advanced, setAdvanced] = useState(false)
  const [tags, setTags] = useState('')
  const [draft, setDraft] = useState<BacktestingTradePayload>(emptyTrade())
  useEffect(() => {
    const next = emptyTrade()
    next.instrument = workspace.symbol
    next.strategyId = workspace.strategyId || null
    next.strategyNameSnapshot = workspace.strategyName || workspace.strategyNameSnapshot || ''
    next.session = workspace.session || ''
    next.contextTimeframe = workspace.contextTimeframe || ''
    next.executionTimeframe = workspace.executionTimeframe || ''
    next.entryTimeframe = workspace.entryTimeframe || ''
    if (trade) Object.assign(next, trade, { entryTime: trade.entryTime.slice(0, 5), source: 'MANUAL', tradeScope: 'BACKTEST' })
    setDraft(next)
    setTags((trade?.tags || []).join(', '))
    setAdvanced(false)
  }, [open, trade, workspace])
  const set = <K extends keyof BacktestingTradePayload>(key: K, value: BacktestingTradePayload[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const mismatch = (draft.result === 'WIN' && draft.pnlR < 0) || (draft.result === 'LOSS' && draft.pnlR > 0)
  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md" aria-labelledby="backtesting-trade-dialog-title">
      <DialogTitle id="backtesting-trade-dialog-title">{t(trade ? 'backtesting.dialogs.editManualTrade' : 'backtesting.dialogs.addManualTrade')}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}><TextField fullWidth required type="date" label={t('backtesting.trades.date')} InputLabelProps={{ shrink: true }} value={draft.date} onChange={(event) => set('date', event.target.value)} /></Grid>
          <Grid item xs={12} sm={4}><TextField fullWidth required label={t('backtesting.trades.instrument')} value={draft.instrument} onChange={(event) => set('instrument', event.target.value.toUpperCase())} /></Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth><InputLabel>{t('backtesting.trades.direction')}</InputLabel><Select label={t('backtesting.trades.direction')} value={draft.direction} onChange={(event) => set('direction', event.target.value as BacktestingTradePayload['direction'])}><MenuItem value="LONG">{t('backtesting.direction.LONG')}</MenuItem><MenuItem value="SHORT">{t('backtesting.direction.SHORT')}</MenuItem></Select></FormControl>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth><InputLabel>{t('backtesting.trades.result')}</InputLabel><Select label={t('backtesting.trades.result')} value={draft.result} onChange={(event) => set('result', event.target.value as BacktestingTradePayload['result'])}>{(['WIN', 'LOSS', 'BREAKEVEN'] as const).map((result) => <MenuItem key={result} value={result}>{t(`backtesting.results.${result}`)}</MenuItem>)}</Select></FormControl>
          </Grid>
          <Grid item xs={12} sm={4}><TextField fullWidth required type="number" label={t('backtesting.trades.rMultiple')} value={draft.pnlR} onChange={(event) => set('pnlR', Number(event.target.value))} inputProps={{ step: 0.1 }} /></Grid>
          <Grid item xs={12} sm={4}><TextField fullWidth label={t('backtesting.trades.session')} value={draft.session || ''} onChange={(event) => set('session', event.target.value)} /></Grid>
          <Grid item xs={12} sm={6}><TextField fullWidth label={t('backtesting.trades.setup')} value={draft.setupName || ''} onChange={(event) => set('setupName', event.target.value)} /></Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth><InputLabel>{t('backtesting.workspace.linkedStrategy')}</InputLabel><Select label={t('backtesting.workspace.linkedStrategy')} value={draft.strategyId || ''} onChange={(event) => set('strategyId', event.target.value || null)}><MenuItem value="">{t('backtesting.common.none')}</MenuItem>{strategies.map((strategy) => <MenuItem key={`${strategy.source}-${strategy.id}`} value={strategy.id}>{strategy.name}</MenuItem>)}</Select></FormControl>
          </Grid>
          {mismatch && <Grid item xs={12}><Alert severity="warning">{t('backtesting.errors.resultMismatch')}</Alert></Grid>}
          <Grid item xs={12}><Button onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}>{t(advanced ? 'backtesting.actions.hideAdvanced' : 'backtesting.actions.showAdvanced')}</Button></Grid>
          <Grid item xs={12}>
            <Collapse in={advanced}>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}><TextField fullWidth type="time" label={t('backtesting.trades.entryTime')} InputLabelProps={{ shrink: true }} value={draft.entryTime} onChange={(event) => set('entryTime', event.target.value)} /></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth type="number" label={t('backtesting.trades.riskPercent')} value={draft.riskPercent ?? ''} onChange={(event) => set('riskPercent', event.target.value === '' ? null : Number(event.target.value))} /></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth type="number" label={t('backtesting.trades.plannedRR')} value={draft.plannedRR ?? ''} onChange={(event) => set('plannedRR', event.target.value === '' ? null : Number(event.target.value))} /></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth label={t('backtesting.trades.contextTimeframe')} value={draft.contextTimeframe || ''} onChange={(event) => set('contextTimeframe', event.target.value)} /></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth label={t('backtesting.trades.executionTimeframe')} value={draft.executionTimeframe || ''} onChange={(event) => set('executionTimeframe', event.target.value)} /></Grid>
                <Grid item xs={12} sm={4}><TextField fullWidth label={t('backtesting.trades.entryTimeframe')} value={draft.entryTimeframe || ''} onChange={(event) => set('entryTimeframe', event.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth label={t('backtesting.trades.tags')} value={tags} onChange={(event) => setTags(event.target.value)} /></Grid>
                <Grid item xs={12}><TextField fullWidth multiline minRows={3} label={t('backtesting.trades.notes')} value={draft.notes || ''} onChange={(event) => set('notes', event.target.value)} /></Grid>
              </Grid>
            </Collapse>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>{t('backtesting.actions.cancel')}</Button><Button variant="contained" disabled={saving || !draft.date || !draft.instrument || mismatch} onClick={() => onSave({ ...draft, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) })}>{saving ? t('backtesting.actions.saving') : t('backtesting.actions.save')}</Button></DialogActions>
    </Dialog>
  )
}

export function ImportTradesDialog({ open, importing, onClose, onImport }: { open: boolean; importing: boolean; onClose: () => void; onImport: (file: File) => void }) {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="backtesting-import-dialog-title">
      <DialogTitle id="backtesting-import-dialog-title">{t('backtesting.dialogs.importTrades')}</DialogTitle>
      <DialogContent dividers><Stack spacing={2}><Alert severity="info">{t('backtesting.dialogs.importDescription')}</Alert><Button component="label" variant="outlined">{file?.name || t('backtesting.actions.chooseCsv')}<input hidden type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} /></Button></Stack></DialogContent>
      <DialogActions><Button onClick={onClose}>{t('backtesting.actions.cancel')}</Button><Button variant="contained" disabled={!file || importing} onClick={() => file && onImport(file)}>{importing ? t('backtesting.actions.importing') : t('backtesting.actions.import')}</Button></DialogActions>
    </Dialog>
  )
}
