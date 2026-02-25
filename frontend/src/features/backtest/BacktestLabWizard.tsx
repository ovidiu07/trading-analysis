import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  Drawer,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import { Link } from 'react-router-dom'
import {
  BacktestDatasetSetDatasets,
  BacktestLabRun,
  BacktestLabRunResults,
  BacktestLabTradeResult,
  BacktestRunReport,
  createBacktestDatasetSet,
  deleteBacktestDataset,
  getBacktestDatasetSetDatasets,
  getBacktestRunReportV2,
  getBacktestRunResultsV2,
  runBacktestDatasetSet,
  saveBacktestStrategyConfig,
  uploadBacktestDatasetCsv
} from '../../api/backtest'
import MarkdownContent from '../../components/ui/MarkdownContent'

const STORAGE_KEY = 'session.backtestLab.datasetSetId'
const STEPS = ['Upload CSVs', 'Strategy Builder', 'Run Backtest', 'Results + Report']

type TemplateKey = 'ASIA_LONDON_REVERSAL' | 'LONDON_NY_REVERSAL' | 'BOS_CONTINUATION'

type StrategyConfigState = {
  name: string
  context: {
    pipSize: number
    spreadPips: number
    slippagePips: number
    touchTolerancePips: number
    timezoneBasis: string
    executionTimeframe: string
  }
  sessions: Array<{
    name: string
    zoneId: string
    startLocal: string
    endLocal: string
  }>
  setupRule: {
    session: string
    sweepType: 'SESSION_HL' | 'PDH_PDL' | 'EQH_EQL' | 'HTF_SWING'
    confirmationType: 'MSS' | 'BOS'
    confirmationTf: string
    direction: 'AUTO_FROM_SWEEP' | 'LONG' | 'SHORT'
  }
  entryModel: {
    type: 'MARKET_ON_CONFIRM_CLOSE' | 'LIMIT_RETRACE_PERCENT'
    retracePercent: number
    entryWindowBars: number
  }
  riskModel: {
    stopRule: 'SWEEP_EXTREME_PLUS_BUFFER' | 'LAST_SWING_PLUS_BUFFER'
    tpRule: 'FIXED_R'
    fixedR: number
    minRR: number
  }
  qualityFilters: {
    displacementMultiplier: number
    bodyLookback: number
    antiChop: boolean
    maxTradesPerSession: number
    maxTradesPerDay: number
    pivotLeft: number
    pivotRight: number
    confirmBreakBufferPips: number
  }
}

const defaultConfig = (): StrategyConfigState => ({
  name: 'SMC Rule Strategy',
  context: {
    pipSize: 0.0001,
    spreadPips: 0,
    slippagePips: 0,
    touchTolerancePips: 0.1,
    timezoneBasis: 'UTC',
    executionTimeframe: 'M5'
  },
  sessions: [
    { name: 'ASIA', zoneId: 'Asia/Tokyo', startLocal: '08:00', endLocal: '17:00' },
    { name: 'LONDON', zoneId: 'Europe/London', startLocal: '08:00', endLocal: '17:00' },
    { name: 'NY', zoneId: 'America/New_York', startLocal: '08:00', endLocal: '17:00' }
  ],
  setupRule: {
    session: 'LONDON',
    sweepType: 'SESSION_HL',
    confirmationType: 'MSS',
    confirmationTf: 'M5',
    direction: 'AUTO_FROM_SWEEP'
  },
  entryModel: {
    type: 'MARKET_ON_CONFIRM_CLOSE',
    retracePercent: 50,
    entryWindowBars: 5
  },
  riskModel: {
    stopRule: 'SWEEP_EXTREME_PLUS_BUFFER',
    tpRule: 'FIXED_R',
    fixedR: 2,
    minRR: 1.5
  },
  qualityFilters: {
    displacementMultiplier: 1.5,
    bodyLookback: 20,
    antiChop: true,
    maxTradesPerSession: 1,
    maxTradesPerDay: 3,
    pivotLeft: 2,
    pivotRight: 2,
    confirmBreakBufferPips: 0
  }
})

const inferPipSize = (instrument: string) => {
  const symbol = instrument.toUpperCase()
  if (symbol.includes('JPY')) return 0.01
  if (symbol.includes('XAU') || symbol.includes('XAG')) return 0.1
  return 0.0001
}

const toIsoDay = (value?: string | null) => {
  if (!value) return ''
  const normalized = value.trim()
  const isoPrefix = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoPrefix?.[1]) return isoPrefix[1]
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const timeframeSeconds = (timeframe: string) => {
  switch ((timeframe || '').toUpperCase()) {
    case 'M1':
      return 60
    case 'M5':
      return 300
    case 'M15':
      return 900
    case 'H1':
      return 3600
    case 'H4':
      return 14_400
    case 'D1':
      return 86_400
    case 'W1':
      return 604_800
    default:
      return Number.MAX_SAFE_INTEGER
  }
}

const pickExecutionDataset = (
  datasets: BacktestDatasetSetDatasets['datasets'] | null | undefined,
  requestedTimeframe: string
) => {
  const rows = datasets || []
  if (!rows.length) return null
  const exact = rows.find((row) => row.timeframe === requestedTimeframe)
  if (exact) return exact

  const requestedSeconds = timeframeSeconds(requestedTimeframe)
  const sorted = [...rows].sort((a, b) => timeframeSeconds(a.timeframe) - timeframeSeconds(b.timeframe))
  let source = null as BacktestDatasetSetDatasets['datasets'][number] | null
  for (const row of sorted) {
    if (timeframeSeconds(row.timeframe) <= requestedSeconds) {
      source = row
    }
  }
  return source || sorted[0]
}

const resolveDatasetRangeBounds = (datasets?: BacktestDatasetSetDatasets['datasets'] | null) => {
  const rows = datasets || []
  if (!rows.length) return { min: '', max: '' }
  const min = rows.map((row) => row.minTimeUtc).filter(Boolean).sort()[0]
  const max = rows.map((row) => row.maxTimeUtc).filter(Boolean).sort().at(-1)
  return { min: toIsoDay(min), max: toIsoDay(max) }
}

const clampIsoDay = (value: string, min: string, max: string) => {
  if (!value) return value
  if (min && value < min) return min
  if (max && value > max) return max
  return value
}

const normalizeRunWindowToBounds = (
  current: { fromUtc: string, toUtc: string, sessionFilter: string },
  bounds: { min: string, max: string }
) => {
  if (!bounds.min || !bounds.max) return current
  let nextFrom = current.fromUtc || bounds.min
  let nextTo = current.toUtc || bounds.max
  nextFrom = clampIsoDay(nextFrom, bounds.min, bounds.max)
  nextTo = clampIsoDay(nextTo, bounds.min, bounds.max)
  if (nextFrom > nextTo) {
    nextFrom = bounds.min
    nextTo = bounds.max
  }
  if (nextFrom === current.fromUtc && nextTo === current.toUtc) {
    return current
  }
  return {
    ...current,
    fromUtc: nextFrom,
    toUtc: nextTo
  }
}

const applyTemplate = (prev: StrategyConfigState, key: TemplateKey): StrategyConfigState => {
  if (key === 'ASIA_LONDON_REVERSAL') {
    return {
      ...prev,
      name: 'Asia Raid -> London Reversal',
      context: { ...prev.context, executionTimeframe: 'M5' },
      setupRule: {
        ...prev.setupRule,
        session: 'LONDON',
        sweepType: 'SESSION_HL',
        confirmationType: 'MSS',
        direction: 'AUTO_FROM_SWEEP'
      },
      entryModel: { ...prev.entryModel, type: 'MARKET_ON_CONFIRM_CLOSE', entryWindowBars: 4 },
      qualityFilters: { ...prev.qualityFilters, displacementMultiplier: 1.6 }
    }
  }
  if (key === 'LONDON_NY_REVERSAL') {
    return {
      ...prev,
      name: 'London Raid -> NY Reversal',
      setupRule: {
        ...prev.setupRule,
        session: 'NY',
        sweepType: 'SESSION_HL',
        confirmationType: 'MSS',
        direction: 'AUTO_FROM_SWEEP'
      },
      entryModel: { ...prev.entryModel, type: 'LIMIT_RETRACE_PERCENT', retracePercent: 50, entryWindowBars: 6 },
      riskModel: { ...prev.riskModel, fixedR: 2 }
    }
  }
  return {
    ...prev,
    name: 'BOS Continuation',
    setupRule: {
      ...prev.setupRule,
      session: 'LONDON',
      sweepType: 'PDH_PDL',
      confirmationType: 'BOS',
      direction: 'AUTO_FROM_SWEEP'
    },
    entryModel: { ...prev.entryModel, type: 'MARKET_ON_CONFIRM_CLOSE' },
    qualityFilters: { ...prev.qualityFilters, displacementMultiplier: 1.4 }
  }
}

export default function BacktestLabWizard() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [step, setStep] = useState(0)
  const [datasetSetId, setDatasetSetId] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || '')
  const [instrument, setInstrument] = useState('EURUSD')
  const [timezoneBasis, setTimezoneBasis] = useState('UTC')
  const [datasetInfo, setDatasetInfo] = useState<BacktestDatasetSetDatasets | null>(null)
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStage, setUploadStage] = useState<'' | 'UPLOADING' | 'PARSING' | 'PERSISTING' | 'READY'>('')
  const [saveStrategyBusy, setSaveStrategyBusy] = useState(false)
  const [runBusy, setRunBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [strategyConfig, setStrategyConfig] = useState<StrategyConfigState>(defaultConfig)
  const [strategyConfigId, setStrategyConfigId] = useState('')

  const [runWindow, setRunWindow] = useState({ fromUtc: '', toUtc: '', sessionFilter: '' })
  const [lastRun, setLastRun] = useState<BacktestLabRun | null>(null)
  const [results, setResults] = useState<BacktestLabRunResults | null>(null)
  const [report, setReport] = useState<BacktestRunReport | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<BacktestLabTradeResult | null>(null)
  const [showDatasetWarnings, setShowDatasetWarnings] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)

  const tfOptions = useMemo(() => {
    const set = new Set((datasetInfo?.datasets || []).map((item) => item.timeframe))
    if (!set.size) return ['M5']
    return Array.from(set)
  }, [datasetInfo])

  const executionDataset = useMemo(() => {
    return pickExecutionDataset(datasetInfo?.datasets, strategyConfig.context.executionTimeframe)
  }, [datasetInfo?.datasets, strategyConfig.context.executionTimeframe])

  const rangeBounds = useMemo(() => {
    return resolveDatasetRangeBounds(executionDataset ? [executionDataset] : [])
  }, [executionDataset])

  const datasetWarningIssues = executionDataset?.warnings || []
  const datasetFatalIssues = executionDataset?.fatalErrors || []
  const executionDatasetProcessing = executionDataset?.status === 'BUILDING' || executionDataset?.status === 'PROCESSING'

  const runWindowValid = useMemo(() => {
    if (!runWindow.fromUtc || !runWindow.toUtc) return false
    if (rangeBounds.min && runWindow.fromUtc < rangeBounds.min) return false
    if (rangeBounds.max && runWindow.toUtc > rangeBounds.max) return false
    return runWindow.fromUtc <= runWindow.toUtc
  }, [rangeBounds.max, rangeBounds.min, runWindow.fromUtc, runWindow.toUtc])

  const canRunBacktest = useMemo(() => {
    if (!strategyConfigId) return false
    if (!executionDataset) return false
    if (executionDatasetProcessing) return false
    if (!executionDataset.runnable) return false
    if ((executionDataset.candleCount || 0) <= 0) return false
    if (!runWindowValid) return false
    if (uploading || loadingDatasets || runBusy) return false
    return true
  }, [executionDataset, executionDatasetProcessing, loadingDatasets, runBusy, runWindowValid, strategyConfigId, uploading])

  const runBlockedReason = useMemo(() => {
    if (!executionDataset) {
      return `Upload a dataset for ${strategyConfig.context.executionTimeframe} (or a lower timeframe to resample).`
    }
    if (executionDatasetProcessing) {
      return `Selected timeframe dataset is ${executionDataset.status}. Wait until processing finishes.`
    }
    if (!executionDataset.runnable) {
      if (datasetFatalIssues.length > 0) {
        return datasetFatalIssues[0].message
      }
      return `Selected timeframe dataset is ${executionDataset.status} and is not runnable yet.`
    }
    if ((executionDataset.candleCount || 0) <= 0) {
      return `No persisted candles found for timeframe ${executionDataset.timeframe}. Re-import this CSV.`
    }
    if (!runWindowValid && rangeBounds.min && rangeBounds.max) {
      return `Select a valid range between ${rangeBounds.min} and ${rangeBounds.max}.`
    }
    return ''
  }, [datasetFatalIssues, executionDataset, executionDatasetProcessing, rangeBounds.max, rangeBounds.min, runWindowValid, strategyConfig.context.executionTimeframe])

  const loadDatasets = async (id: string) => {
    if (!id) return
    setLoadingDatasets(true)
    try {
      const info = await getBacktestDatasetSetDatasets(id)
      setDatasetInfo(info)
      if (info.instrument && info.instrument !== 'UNKNOWN') {
        const availableTimeframes = new Set(info.datasets.map((item) => item.timeframe))
        setInstrument(info.instrument)
        setStrategyConfig((prev) => ({
          ...prev,
          context: {
            ...prev.context,
            pipSize: inferPipSize(info.instrument),
            timezoneBasis: info.timezoneBasis || prev.context.timezoneBasis,
            executionTimeframe: availableTimeframes.has(prev.context.executionTimeframe)
              ? prev.context.executionTimeframe
              : (info.datasets.find((d) => d.timeframe === 'M5')?.timeframe || info.datasets[0]?.timeframe || prev.context.executionTimeframe)
          }
        }))
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load datasets')
    } finally {
      setLoadingDatasets(false)
    }
  }

  useEffect(() => {
    if (datasetSetId) {
      void loadDatasets(datasetSetId)
    }
  }, [datasetSetId])

  useEffect(() => {
    if (!rangeBounds.min || !rangeBounds.max) return
    setRunWindow((prev) => normalizeRunWindowToBounds(prev, rangeBounds))
  }, [rangeBounds.max, rangeBounds.min])

  const ensureSet = async () => {
    if (datasetSetId) return datasetSetId
    const created = await createBacktestDatasetSet({ instrument, timezoneBasis })
    setDatasetSetId(created.id)
    localStorage.setItem(STORAGE_KEY, created.id)
    return created.id
  }

  const uploadFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    setError('')
    setSuccess('')
    setUploading(true)
    setUploadStage('UPLOADING')
    try {
      const id = await ensureSet()
      for (const file of Array.from(files)) {
        setUploadStage('UPLOADING')
        await uploadBacktestDatasetCsv(id, file)
      }
      setUploadStage('PARSING')
      setUploadStage('PERSISTING')
      await loadDatasets(id)
      setUploadStage('READY')
      setSuccess(`${files.length} file(s) uploaded and ingested.`)
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
      setUploadStage('')
    } finally {
      setUploading(false)
    }
  }

  const handleFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    await uploadFiles(event.target.files)
    event.target.value = ''
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    await uploadFiles(event.dataTransfer.files)
  }

  const handleSaveStrategy = async () => {
    if (!datasetSetId) {
      setError('Upload data first.')
      return
    }
    setSaveStrategyBusy(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        name: strategyConfig.name,
        configJson: strategyConfig
      }
      const saved = await saveBacktestStrategyConfig(datasetSetId, payload)
      setStrategyConfigId(saved.id)
      setSuccess('Strategy config saved.')
      setStep(2)
    } catch (e: any) {
      setError(e?.message || 'Failed to save strategy config')
    } finally {
      setSaveStrategyBusy(false)
    }
  }

  const loadRunArtifacts = async (runId: string) => {
    const runResults = await getBacktestRunResultsV2(runId)
    setResults(runResults)
    try {
      const runReport = await getBacktestRunReportV2(runId)
      setReport(runReport)
    } catch {
      setReport(null)
    }
  }

  const handleRun = async () => {
    if (!datasetSetId) {
      setError('Upload data first.')
      return
    }
    if (!strategyConfigId) {
      setError('Save strategy config first.')
      return
    }
    if (!runWindowValid) {
      setError('Select a valid date range within dataset bounds.')
      return
    }
    if (!executionDataset) {
      setError(`Upload a dataset for timeframe ${strategyConfig.context.executionTimeframe} first.`)
      return
    }
    if (executionDatasetProcessing) {
      setError(`Selected timeframe dataset is ${executionDataset.status}. Wait until processing finishes.`)
      return
    }
    if (!executionDataset.runnable) {
      setError(datasetFatalIssues[0]?.message || `Selected timeframe dataset is ${executionDataset.status} and is not runnable.`)
      return
    }
    if ((executionDataset.candleCount || 0) <= 0) {
      setError(`No persisted candles found for timeframe ${executionDataset.timeframe}. Re-import this CSV.`)
      return
    }

    setRunBusy(true)
    setError('')
    setSuccess('')
    setResults(null)
    setReport(null)

    try {
      const fromUtc = runWindow.fromUtc === toIsoDay(executionDataset.minTimeUtc)
        ? executionDataset.minTimeUtc
        : `${runWindow.fromUtc}T00:00:00Z`
      const toUtc = runWindow.toUtc === toIsoDay(executionDataset.maxTimeUtc)
        ? executionDataset.maxTimeUtc
        : `${runWindow.toUtc}T23:59:59Z`
      const run = await runBacktestDatasetSet(datasetSetId, {
        strategyConfigId,
        fromUtc,
        toUtc,
        sessionFilter: runWindow.sessionFilter || undefined,
        autoGenerateReport: true
      })
      setLastRun(run)
      if (run.status === 'FAILED') {
        setError(run.errorMsg || 'Backtest run failed')
        return
      }
      await loadRunArtifacts(run.runId)
      setSuccess(run.warnings && run.warnings.length
        ? `Backtest completed with warnings: ${run.warnings[0]}`
        : 'Backtest completed.')
      setStep(3)
    } catch (e: any) {
      setError(e?.message || 'Backtest failed')
    } finally {
      setRunBusy(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!lastRun?.runId) {
      setError('Run backtest first.')
      return
    }
    try {
      const runReport = await getBacktestRunReportV2(lastRun.runId)
      setReport(runReport)
      setSuccess('Diagnostics report loaded.')
    } catch (e: any) {
      setError(e?.message || 'Report not available yet. Re-run with auto report enabled.')
    }
  }

  return (
    <Stack spacing={1.5}>
      <Stepper activeStep={step} alternativeLabel={!isMobile} orientation={isMobile ? 'vertical' : 'horizontal'}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {uploading || loadingDatasets || runBusy ? <LinearProgress /> : null}
      {uploadStage ? <Alert severity={uploadStage === 'READY' ? 'success' : 'info'}>{`Upload status: ${uploadStage}`}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {success ? <Alert severity="success">{success}</Alert> : null}

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            {step === 0 && (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Instrument"
                    value={instrument}
                    onChange={(event) => {
                      const value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                      setInstrument(value)
                      setStrategyConfig((prev) => ({
                        ...prev,
                        context: {
                          ...prev.context,
                          pipSize: inferPipSize(value)
                        }
                      }))
                    }}
                    helperText="Override before first upload if filename detection is wrong"
                  />
                  <FormControl size="small" fullWidth>
                    <InputLabel id="timezone-basis">Timezone basis</InputLabel>
                    <Select
                      labelId="timezone-basis"
                      label="Timezone basis"
                      value={timezoneBasis}
                      onChange={(event) => {
                        const value = event.target.value
                        setTimezoneBasis(value)
                        setStrategyConfig((prev) => ({
                          ...prev,
                          context: { ...prev.context, timezoneBasis: value }
                        }))
                      }}
                    >
                      <MenuItem value="UTC">UTC</MenuItem>
                      <MenuItem value="Europe/London">Europe/London</MenuItem>
                      <MenuItem value="America/New_York">America/New_York</MenuItem>
                      <MenuItem value="Europe/Bucharest">Europe/Bucharest</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                <Box
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => void handleDrop(event)}
                  sx={{
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'action.hover'
                  }}
                >
                  <Stack spacing={1} alignItems="center">
                    <UploadFileRoundedIcon color="primary" />
                    <Typography variant="subtitle2">Drop CSV files (multi-timeframe supported)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Required: time/open/high/low/close. Extra columns are ignored.
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button variant="contained" size="small" onClick={() => inputRef.current?.click()} disabled={uploading}>
                        Choose files
                      </Button>
                      <Button variant="outlined" size="small" onClick={() => setStep(1)} disabled={!datasetInfo?.datasets?.length}>
                        Continue
                      </Button>
                    </Stack>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".csv,text/csv"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(event) => void handleFileInput(event)}
                    />
                  </Stack>
                </Box>

                <Divider />
                <Typography variant="subtitle2">Upload Summary</Typography>
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Filename</TableCell>
                        <TableCell>TF</TableCell>
                        <TableCell>Candles</TableCell>
                        <TableCell>Min date</TableCell>
                        <TableCell>Max date</TableCell>
                        <TableCell>Mapped columns</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Remove</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(datasetInfo?.datasets || []).map((row) => (
                        <TableRow key={row.datasetId}>
                          <TableCell sx={{ maxWidth: 220, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{row.originalFilename}</TableCell>
                          <TableCell>{row.timeframe}</TableCell>
                          <TableCell>{row.candleCount}</TableCell>
                          <TableCell>{new Date(row.minTimeUtc).toLocaleString()}</TableCell>
                          <TableCell>{new Date(row.maxTimeUtc).toLocaleString()}</TableCell>
                          <TableCell>{row.columnsMapped}</TableCell>
                          <TableCell>
                            <Chip size="small" color={row.status === 'ERROR' ? 'error' : (row.status === 'WARN' ? 'warning' : 'success')} label={row.status} />
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              color="error"
                              onClick={async () => {
                                await deleteBacktestDataset(row.datasetId)
                                if (datasetSetId) {
                                  await loadDatasets(datasetSetId)
                                }
                              }}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!(datasetInfo?.datasets || []).length && (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <Typography variant="caption" color="text.secondary">No files uploaded yet.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {!!datasetInfo?.sessionPreview?.length && (
                  <>
                    <Typography variant="subtitle2">Session Preview</Typography>
                    <Grid container spacing={1}>
                      {datasetInfo.sessionPreview.map((session) => (
                        <Grid item xs={12} sm={4} key={`${session.sessionName}-${session.sessionDate}`}>
                          <Card variant="outlined">
                            <CardContent>
                              <Stack spacing={0.5}>
                                <Typography variant="subtitle2">{session.sessionName}</Typography>
                                <Typography variant="caption" color="text.secondary">{session.sessionDate}</Typography>
                                <Typography variant="body2">Candles: {session.candleCount}</Typography>
                                <Typography variant="body2">H/L: {session.sessionHigh} / {session.sessionLow}</Typography>
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    size="small"
                    label="Strategy name"
                    fullWidth
                    value={strategyConfig.name}
                    onChange={(event) => setStrategyConfig((prev) => ({ ...prev, name: event.target.value }))}
                  />
                  <FormControl size="small" fullWidth>
                    <InputLabel id="exec-tf">Execution TF</InputLabel>
                    <Select
                      labelId="exec-tf"
                      label="Execution TF"
                      value={strategyConfig.context.executionTimeframe}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        context: { ...prev.context, executionTimeframe: event.target.value }
                      }))}
                    >
                      {[...new Set([...tfOptions, 'M1', 'M5', 'M15', 'H1', 'H4', 'D1', 'W1'])].map((tf) => (
                        <MenuItem key={tf} value={tf}>{tf}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => setStrategyConfig((prev) => applyTemplate(prev, 'ASIA_LONDON_REVERSAL'))}>
                    Asia Raid -&gt; London Reversal
                  </Button>
                  <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => setStrategyConfig((prev) => applyTemplate(prev, 'LONDON_NY_REVERSAL'))}>
                    London Raid -&gt; NY Reversal
                  </Button>
                  <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => setStrategyConfig((prev) => applyTemplate(prev, 'BOS_CONTINUATION'))}>
                    BOS Continuation
                  </Button>
                </Stack>

                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Pip size"
                      fullWidth
                      value={strategyConfig.context.pipSize}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        context: { ...prev.context, pipSize: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Spread (pips)"
                      fullWidth
                      value={strategyConfig.context.spreadPips}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        context: { ...prev.context, spreadPips: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Slippage (pips)"
                      fullWidth
                      value={strategyConfig.context.slippagePips}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        context: { ...prev.context, slippagePips: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Touch tolerance (pips)"
                      fullWidth
                      value={strategyConfig.context.touchTolerancePips}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        context: { ...prev.context, touchTolerancePips: Number(event.target.value) }
                      }))}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="setup-session">Setup session</InputLabel>
                      <Select
                        labelId="setup-session"
                        label="Setup session"
                        value={strategyConfig.setupRule.session}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          setupRule: { ...prev.setupRule, session: event.target.value }
                        }))}
                      >
                        {strategyConfig.sessions.map((session) => (
                          <MenuItem key={session.name} value={session.name}>{session.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="sweep-type">Sweep type</InputLabel>
                      <Select
                        labelId="sweep-type"
                        label="Sweep type"
                        value={strategyConfig.setupRule.sweepType}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          setupRule: { ...prev.setupRule, sweepType: event.target.value as StrategyConfigState['setupRule']['sweepType'] }
                        }))}
                      >
                        <MenuItem value="SESSION_HL">SESSION_HL</MenuItem>
                        <MenuItem value="PDH_PDL">PDH/PDL</MenuItem>
                        <MenuItem value="EQH_EQL">EQH/EQL</MenuItem>
                        <MenuItem value="HTF_SWING">HTF_SWING</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="confirm-type">Confirmation</InputLabel>
                      <Select
                        labelId="confirm-type"
                        label="Confirmation"
                        value={strategyConfig.setupRule.confirmationType}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          setupRule: { ...prev.setupRule, confirmationType: event.target.value as 'MSS' | 'BOS' }
                        }))}
                      >
                        <MenuItem value="MSS">MSS</MenuItem>
                        <MenuItem value="BOS">BOS</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="direction">Direction</InputLabel>
                      <Select
                        labelId="direction"
                        label="Direction"
                        value={strategyConfig.setupRule.direction}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          setupRule: { ...prev.setupRule, direction: event.target.value as StrategyConfigState['setupRule']['direction'] }
                        }))}
                      >
                        <MenuItem value="AUTO_FROM_SWEEP">AUTO_FROM_SWEEP</MenuItem>
                        <MenuItem value="LONG">LONG</MenuItem>
                        <MenuItem value="SHORT">SHORT</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="entry-model">Entry model</InputLabel>
                      <Select
                        labelId="entry-model"
                        label="Entry model"
                        value={strategyConfig.entryModel.type}
                        onChange={(event) => setStrategyConfig((prev) => ({
                          ...prev,
                          entryModel: { ...prev.entryModel, type: event.target.value as StrategyConfigState['entryModel']['type'] }
                        }))}
                      >
                        <MenuItem value="MARKET_ON_CONFIRM_CLOSE">MARKET_ON_CONFIRM_CLOSE</MenuItem>
                        <MenuItem value="LIMIT_RETRACE_PERCENT">LIMIT_RETRACE_PERCENT</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      size="small"
                      type="number"
                      label="Retrace %"
                      fullWidth
                      value={strategyConfig.entryModel.retracePercent}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        entryModel: { ...prev.entryModel, retracePercent: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={4}>
                    <TextField
                      size="small"
                      type="number"
                      label="Entry window bars"
                      fullWidth
                      value={strategyConfig.entryModel.entryWindowBars}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        entryModel: { ...prev.entryModel, entryWindowBars: Number(event.target.value) }
                      }))}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Fixed R"
                      fullWidth
                      value={strategyConfig.riskModel.fixedR}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        riskModel: { ...prev.riskModel, fixedR: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Min RR"
                      fullWidth
                      value={strategyConfig.riskModel.minRR}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        riskModel: { ...prev.riskModel, minRR: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Displacement multiplier"
                      fullWidth
                      value={strategyConfig.qualityFilters.displacementMultiplier}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        qualityFilters: { ...prev.qualityFilters, displacementMultiplier: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      size="small"
                      type="number"
                      label="Max trades/session"
                      fullWidth
                      value={strategyConfig.qualityFilters.maxTradesPerSession}
                      onChange={(event) => setStrategyConfig((prev) => ({
                        ...prev,
                        qualityFilters: { ...prev.qualityFilters, maxTradesPerSession: Number(event.target.value) }
                      }))}
                    />
                  </Grid>
                </Grid>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="contained" onClick={() => void handleSaveStrategy()} disabled={saveStrategyBusy || !datasetInfo?.datasets?.length}>
                    Save Strategy Config
                  </Button>
                  <Button variant="outlined" onClick={() => setStep(2)} disabled={!strategyConfigId}>
                    Continue
                  </Button>
                </Stack>
              </>
            )}

            {step === 2 && (
              <>
                {executionDataset ? (
                  <Alert severity="info">
                    {`Execution TF ${strategyConfig.context.executionTimeframe} uses dataset TF ${executionDataset.timeframe} | Range ${executionDataset.minTimeUtc} → ${executionDataset.maxTimeUtc} | Candles ${executionDataset.candleCount} | Status ${executionDataset.status} | Runnable ${executionDataset.runnable ? 'YES' : 'NO'}`}
                  </Alert>
                ) : (
                  <Alert severity="warning">
                    {`No dataset available for execution timeframe ${strategyConfig.context.executionTimeframe}.`}
                  </Alert>
                )}
                {executionDataset?.status === 'WARN' && executionDataset.runnable ? (
                  <Alert severity="warning">
                    Dataset has warnings (gaps/duplicates/normalization), but it is runnable. You can run backtest anyway.
                  </Alert>
                ) : null}
                {executionDataset && (datasetWarningIssues.length > 0 || datasetFatalIssues.length > 0) ? (
                  <Stack spacing={1}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => setShowDatasetWarnings((prev) => !prev)}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {showDatasetWarnings ? 'Hide warnings' : 'View warnings'}
                    </Button>
                    <Collapse in={showDatasetWarnings}>
                      <Stack spacing={0.8} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.2 }}>
                        {datasetWarningIssues.map((issue) => (
                          <Typography key={`warn-${issue.code}-${issue.message}`} variant="body2" color="warning.dark">
                            {`${issue.code}: ${issue.message}`}
                          </Typography>
                        ))}
                        {datasetFatalIssues.map((issue) => (
                          <Typography key={`fatal-${issue.code}-${issue.message}`} variant="body2" color="error.main">
                            {`${issue.code}: ${issue.message}`}
                          </Typography>
                        ))}
                      </Stack>
                    </Collapse>
                  </Stack>
                ) : null}
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      size="small"
                      type="date"
                      fullWidth
                      label="From"
                      InputLabelProps={{ shrink: true }}
                      value={runWindow.fromUtc}
                      inputProps={{ min: rangeBounds.min, max: rangeBounds.max }}
                      onChange={(event) => setRunWindow((prev) => ({ ...prev, fromUtc: event.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      size="small"
                      type="date"
                      fullWidth
                      label="To"
                      InputLabelProps={{ shrink: true }}
                      value={runWindow.toUtc}
                      inputProps={{ min: rangeBounds.min, max: rangeBounds.max }}
                      onChange={(event) => setRunWindow((prev) => ({ ...prev, toUtc: event.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl size="small" fullWidth>
                      <InputLabel id="session-filter">Session filter</InputLabel>
                      <Select
                        labelId="session-filter"
                        label="Session filter"
                        value={runWindow.sessionFilter}
                        onChange={(event) => setRunWindow((prev) => ({ ...prev, sessionFilter: event.target.value }))}
                      >
                        <MenuItem value="">ALL</MenuItem>
                        {strategyConfig.sessions.map((session) => (
                          <MenuItem key={session.name} value={session.name}>{session.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                {!runWindowValid && rangeBounds.min && rangeBounds.max ? (
                  <Alert severity="warning">
                    {`Select a valid range between ${rangeBounds.min} and ${rangeBounds.max}.`}
                  </Alert>
                ) : null}
                {!executionDataset?.runnable && datasetFatalIssues.length > 0 ? (
                  <Alert severity="error">
                    {datasetFatalIssues[0].message}
                  </Alert>
                ) : null}
                {!canRunBacktest && strategyConfigId && runBlockedReason ? (
                  <Alert severity="warning">{runBlockedReason}</Alert>
                ) : null}

                {lastRun ? (
                  <Alert severity={lastRun.status === 'FAILED' ? 'error' : 'info'}>
                    {`Dataset range: ${lastRun.datasetMinUtc || '-'} → ${lastRun.datasetMaxUtc || '-'} | Effective: ${lastRun.effectiveFromUtc || lastRun.fromUtc} → ${lastRun.effectiveToUtc || lastRun.toUtc} | Candles: ${lastRun.candleCountInRange ?? '-'} / min ${lastRun.minRequiredCandles ?? '-'}`}
                  </Alert>
                ) : null}

                {lastRun?.warnings && lastRun.warnings.length > 0 ? (
                  <Alert severity="warning">{lastRun.warnings.join(' ')}</Alert>
                ) : null}

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={() => void handleRun()} disabled={!canRunBacktest}>
                    Run backtest
                  </Button>
                  <Button variant="outlined" onClick={() => setStep(3)} disabled={!results}>
                    Open results
                  </Button>
                  {lastRun ? <Chip size="small" label={`Status: ${lastRun.status}`} /> : null}
                </Stack>
              </>
            )}

            {step === 3 && (
              <>
                {!results ? (
                  <Alert severity="info">Run a backtest first to view results and report.</Alert>
                ) : (
                  <>
                    <Grid container spacing={1}>
                      <Grid item xs={6} md={2.4}><Card variant="outlined"><CardContent><Typography variant="caption">Sample</Typography><Typography variant="h6">{results.summary.sampleSize}</Typography></CardContent></Card></Grid>
                      <Grid item xs={6} md={2.4}><Card variant="outlined"><CardContent><Typography variant="caption">Win rate</Typography><Typography variant="h6">{results.summary.winRate?.toFixed(2)}%</Typography></CardContent></Card></Grid>
                      <Grid item xs={6} md={2.4}><Card variant="outlined"><CardContent><Typography variant="caption">Expectancy</Typography><Typography variant="h6">{results.summary.expectancyR?.toFixed(2)}R</Typography></CardContent></Card></Grid>
                      <Grid item xs={6} md={2.4}><Card variant="outlined"><CardContent><Typography variant="caption">Avg MAE/MFE</Typography><Typography variant="h6">{results.summary.avgMaeR?.toFixed(2)} / {results.summary.avgMfeR?.toFixed(2)}</Typography></CardContent></Card></Grid>
                      <Grid item xs={6} md={2.4}><Card variant="outlined"><CardContent><Typography variant="caption">Fill rate</Typography><Typography variant="h6">{results.summary.fillRate?.toFixed(2)}%</Typography></CardContent></Card></Grid>
                    </Grid>

                    <Typography variant="subtitle2">Trades</Typography>
                    <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Time</TableCell>
                            <TableCell>Session</TableCell>
                            <TableCell>Direction</TableCell>
                            <TableCell>Result</TableCell>
                            <TableCell>R</TableCell>
                            <TableCell>Fill</TableCell>
                            <TableCell align="right">Detail</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {results.trades.map((trade) => (
                            <TableRow key={trade.tradeId}>
                              <TableCell>{trade.entryTime ? new Date(trade.entryTime).toLocaleString() : '-'}</TableCell>
                              <TableCell>{trade.sessionName || '-'}</TableCell>
                              <TableCell>{trade.direction || '-'}</TableCell>
                              <TableCell>{trade.exitReason || '-'}</TableCell>
                              <TableCell>{trade.rMultiple != null ? trade.rMultiple.toFixed(2) : '-'}</TableCell>
                              <TableCell>{trade.fillStatus}</TableCell>
                              <TableCell align="right">
                                <Button size="small" onClick={() => setSelectedTrade(trade)}>Timeline</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {!results.trades.length && (
                            <TableRow>
                              <TableCell colSpan={7}>No trades for selected settings/date range.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button variant="contained" startIcon={<DescriptionRoundedIcon />} onClick={() => void handleGenerateReport()}>
                        Generate Diagnostics Report
                      </Button>
                      <Button component={Link} to="/diagnostics" variant="outlined">
                        Open Diagnostics
                      </Button>
                    </Stack>

                    {report ? (
                      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
                        <Typography variant="subtitle2" gutterBottom>{report.strategyNameSnapshot} • Report</Typography>
                        <MarkdownContent content={report.reportMarkdown} />
                      </Box>
                    ) : (
                      <Alert severity="info">No report snapshot found yet.</Alert>
                    )}
                  </>
                )}
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Drawer anchor={isMobile ? 'bottom' : 'right'} open={Boolean(selectedTrade)} onClose={() => setSelectedTrade(null)}>
        <Box sx={{ width: isMobile ? '100vw' : 460, p: 2 }}>
          {selectedTrade && (
            <Stack spacing={1}>
              <Typography variant="h6">Trade Timeline</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedTrade.direction} • {selectedTrade.sessionName || 'N/A'} • {selectedTrade.exitReason || 'N/A'}
              </Typography>
              <Divider />
              {(selectedTrade.timeline || []).map((event, index) => (
                <Card key={`${event.stage}-${event.timeUtc || index}`} variant="outlined">
                  <CardContent>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle2">{event.stage}</Typography>
                      <Typography variant="caption" color="text.secondary">{event.timeUtc ? new Date(event.timeUtc).toLocaleString() : 'N/A'}</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {JSON.stringify(event.details || {}, null, 2)}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      </Drawer>
    </Stack>
  )
}
