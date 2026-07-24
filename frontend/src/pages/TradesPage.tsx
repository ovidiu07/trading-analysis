import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
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
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded'
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded'
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded'
import FitScreenRoundedIcon from '@mui/icons-material/FitScreenRounded'
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined'
import FlashOnRoundedIcon from '@mui/icons-material/FlashOnRounded'
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded'
import CandlestickChartRoundedIcon from '@mui/icons-material/CandlestickChartRounded'
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded'
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded'
import { useLocation, useNavigate } from 'react-router-dom'
import { TradeCsvImportSummary, TradeResponse, createTrade, deleteTrade, getTradeById, importTradesCsv, listTrades, searchTrades, updateTrade } from '../api/trades'
import { createNotebookNote } from '../api/notebook'
import { AssetItem, listTradeAssets } from '../api/assets'
import { TradeFormValues, buildTradePayload } from '../utils/tradePayload'
import { currentDateTimeForInput, formatUtcForDateTimeLocal } from '../utils/tradeDateTime'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { formatCurrency, formatDateTime, formatNumber, formatPercent, formatSignedCurrency } from '../utils/format'
import { TradeForm } from '../components/trades/TradeForm'
import { TradeCreateFormV2 } from '../components/trades/TradeCreateFormV2'
import type { TradeEntryMode } from '../components/trades/TradeModeSwitch'
import SecureAssetImage from '../components/assets/SecureAssetImage'
import AssetThumbnail from '../components/assets/AssetThumbnail'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'
import PageHero from '../components/ui/PageHero'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import { alpha } from '@mui/material/styles'
import { useDemoData } from '../features/demo/DemoDataContext'
import { trackEvent } from '../utils/analytics/ga4'
import { listMyPlans } from '../api/plans'
import { listStrategies } from '../api/strategies'
import { RULE_BREAK_OPTIONS } from '../constants/tradeTaxonomy'
import TradeImportDialog from '../components/trades/TradeImportDialog'
import { useAccountScope } from '../features/accountScope/useAccountScope'
import type { AccountScopeValue } from '../features/accountScope/accountScope'
import type { TradingAccountOption } from '../api/accounts'
import AccountScopeSelector from '../components/accounts/AccountScopeSelector'
import AccountScopeSummary from '../components/accounts/AccountScopeSummary'

type ContentOption = {
  id: string
  label: string
  source?: 'MENTOR' | 'USER'
}

type ScreenshotViewerState = {
  open: boolean
  trade: TradeResponse | null
  assets: AssetItem[]
  loading: boolean
  error: string
}

const emptyScreenshotViewerState: ScreenshotViewerState = {
  open: false,
  trade: null,
  assets: [],
  loading: false,
  error: ''
}

const getTradeNotesPreview = (trade: TradeResponse | null | undefined) => {
  if (!trade) {
    return ''
  }

  const parts = [trade.latestTradeNotePreview, trade.notes]
    .map((value) => value?.trim() || '')
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)

  return parts.join(' | ')
}

const hasTradeScreenshots = (trade: TradeResponse | null | undefined) => Boolean(trade?.entryScreenshotAssetIds?.length)

function TradeScreenshotViewerDialog({
  open,
  trade,
  assets,
  loading,
  error,
  onClose
}: ScreenshotViewerState & { onClose: () => void }) {
  const { t } = useI18n()
  const [activeIndex, setActiveIndex] = useState(0)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!open) {
      setActiveIndex(0)
      setZoom(1)
      return
    }

    setActiveIndex((current) => {
      if (assets.length === 0) {
        return 0
      }
      return Math.min(current, assets.length - 1)
    })
    setZoom(1)
  }, [assets.length, open])

  const activeAsset = assets[activeIndex] || null
  const hasMultipleAssets = assets.length > 1

  const handlePrevious = () => {
    if (!hasMultipleAssets) return
    setActiveIndex((current) => (current === 0 ? assets.length - 1 : current - 1))
    setZoom(1)
  }

  const handleNext = () => {
    if (!hasMultipleAssets) return
    setActiveIndex((current) => (current === assets.length - 1 ? 0 : current + 1))
    setZoom(1)
  }

  const handleZoomOut = () => {
    setZoom((current) => Math.max(1, Number((current - 0.25).toFixed(2))))
  }

  const handleZoomIn = () => {
    setZoom((current) => Math.min(4, Number((current + 0.25).toFixed(2))))
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        {trade
          ? t('trades.viewer.title', {
              symbol: trade.symbol,
              count: assets.length
            })
          : t('trades.viewer.titleFallback')}
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1}>
            <Typography variant="body2" color="text.secondary">
              {activeAsset
                ? t('trades.viewer.position', {
                    current: activeIndex + 1,
                    total: assets.length
                  })
                : t('trades.viewer.empty')}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title={t('trades.viewer.zoomOut')}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={t('trades.viewer.zoomOut')}
                    onClick={handleZoomOut}
                    disabled={!activeAsset || zoom <= 1}
                  >
                    <ZoomOutRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('trades.viewer.resetZoom')}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={t('trades.viewer.resetZoom')}
                    onClick={() => setZoom(1)}
                    disabled={!activeAsset || zoom === 1}
                  >
                    <FitScreenRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('trades.viewer.zoomIn')}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={t('trades.viewer.zoomIn')}
                    onClick={handleZoomIn}
                    disabled={!activeAsset || zoom >= 4}
                  >
                    <ZoomInRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>

          <Box
            sx={{
              position: 'relative',
              minHeight: { xs: 280, md: 520 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: alpha('#000', 0.04),
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: { xs: 1, md: 2 },
              py: { xs: 1, md: 2 }
            }}
          >
            {loading ? (
              <Stack alignItems="center" spacing={1}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>
              </Stack>
            ) : error ? (
              <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>
            ) : !activeAsset ? (
              <EmptyState
                title={t('trades.viewer.emptyTitle')}
                description={t('trades.viewer.emptyBody')}
                icon={<PhotoLibraryRoundedIcon fontSize="inherit" />}
              />
            ) : (
              <>
                {hasMultipleAssets && (
                  <IconButton
                    onClick={handlePrevious}
                    aria-label={t('trades.viewer.previous')}
                    sx={{
                      position: 'sticky',
                      left: 0,
                      alignSelf: 'center',
                      zIndex: 1,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <NavigateBeforeRoundedIcon />
                  </IconButton>
                )}

                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', px: 1 }}>
                  <SecureAssetImage
                    url={activeAsset.viewUrl || activeAsset.url || activeAsset.downloadUrl}
                    alt={activeAsset.originalFileName || trade?.symbol || t('trades.viewer.imageAlt')}
                    fallback={(
                      <Stack alignItems="center" spacing={1.25}>
                        <BrokenImageOutlinedIcon />
                        <Typography variant="body2" color="text.secondary">{t('trades.viewer.brokenImage')}</Typography>
                      </Stack>
                    )}
                    sx={{
                      maxWidth: '100%',
                      maxHeight: { xs: 320, md: 620 },
                      objectFit: 'contain',
                      transform: `scale(${zoom})`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.2s ease'
                    }}
                  />
                </Box>

                {hasMultipleAssets && (
                  <IconButton
                    onClick={handleNext}
                    aria-label={t('trades.viewer.next')}
                    sx={{
                      position: 'sticky',
                      right: 0,
                      alignSelf: 'center',
                      zIndex: 1,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <NavigateNextRoundedIcon />
                  </IconButton>
                )}
              </>
            )}
          </Box>

          {assets.length > 1 && (
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
              {assets.map((asset, index) => {
                const selected = index === activeIndex
                return (
                  <ButtonBase
                    key={asset.id}
                    onClick={() => {
                      setActiveIndex(index)
                      setZoom(1)
                    }}
                    sx={{
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: selected ? 'primary.main' : 'divider',
                      p: 0.4,
                      bgcolor: selected ? 'action.selected' : 'background.paper'
                    }}
                  >
                    <AssetThumbnail
                      url={asset.thumbnailUrl || asset.viewUrl || asset.url || asset.downloadUrl}
                      alt={asset.originalFileName || `${trade?.symbol || 'trade'} screenshot ${index + 1}`}
                    />
                  </ButtonBase>
                )
              })}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}

const buildDefaultValues = (timeZone: string, accountRefId = ''): TradeFormValues => ({
  symbol: '',
  market: 'STOCK',
  direction: 'LONG',
  status: 'OPEN',
  openedAt: currentDateTimeForInput(timeZone),
  closedAt: '',
  timeframe: '',
  quantity: 1,
  entryPrice: 0,
  exitPrice: undefined,
  stopLossPrice: undefined,
  takeProfitPrice: undefined,
  fees: 0,
  feesProfileCurrency: undefined,
  commission: 0,
  slippage: 0,
  tradeCurrency: '',
  profileCurrency: '',
  fxRateTradeToProfile: undefined,
  fxRateSource: '',
  pnlProfileCurrency: undefined,
  riskAmount: undefined,
  capitalUsed: undefined,
  setup: '',
  strategyTag: '',
  catalystTag: '',
  strategyId: '',
  setupGrade: undefined,
  ruleBreaks: [],
  session: undefined,
  linkedContentIds: [],
  linkedPlanIds: [],
  notes: '',
  accountRefId,
  contractMultiplier: undefined
})

const buildQuickLogDefaults = (timeZone: string, accountRefId = ''): TradeFormValues => ({
  ...buildDefaultValues(timeZone, accountRefId),
  market: 'FOREX',
  quantity: 1,
  openedAt: currentDateTimeForInput(timeZone)
})

const resolveTradeAccountPreselection = (
  accounts: TradingAccountOption[],
  scope: AccountScopeValue,
  explicitAccountId?: string | null
) => {
  const eligible = accounts.filter((account) => !account.status || account.status === 'ACTIVE')
  if (explicitAccountId && eligible.some((account) => account.id === explicitAccountId)) {
    return explicitAccountId
  }
  if (scope.mode === 'selected' && scope.accountIds.length === 1) {
    const scopedId = scope.accountIds[0]
    if (eligible.some((account) => account.id === scopedId)) {
      return scopedId
    }
  }
  const defaultAccount = eligible.find((account) => account.isDefault)
  if (defaultAccount) return defaultAccount.id
  return eligible.length === 1 ? eligible[0].id : ''
}

const defaultFilters = {
  openedAtFrom: '',
  openedAtTo: '',
  closedAtFrom: '',
  closedAtTo: '',
  closedDate: '',
  tz: '',
  symbol: '',
  accountId: '',
  direction: '',
  status: ''
}

type TradesFilters = typeof defaultFilters

type TradesRouteState = {
  filters: TradesFilters
  activeFilters: TradesFilters | null
  viewMode: 'list' | 'search'
  highlightTradeId: string
}

const areFiltersEqual = (left: TradesFilters | null, right: TradesFilters | null) => {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return left === right
  }
  return Object.keys(defaultFilters).every((key) => {
    const filterKey = key as keyof TradesFilters
    return left[filterKey] === right[filterKey]
  })
}

const deriveRouteState = (search: string, timezone: string): TradesRouteState => {
  if (!search) {
    return {
      filters: defaultFilters,
      activeFilters: null,
      viewMode: 'list',
      highlightTradeId: ''
    }
  }

  const params = new URLSearchParams(search)
  const closedDate = params.get('closedDate') || ''
  const filters: TradesFilters = {
    openedAtFrom: params.get('openedAtFrom') || '',
    openedAtTo: params.get('openedAtTo') || '',
    closedAtFrom: params.get('closedAtFrom') || '',
    closedAtTo: params.get('closedAtTo') || '',
    closedDate,
    tz: params.get('tz') || (closedDate ? timezone : ''),
    symbol: params.get('symbol') || '',
    accountId: params.get('accountId') || '',
    direction: params.get('direction') || '',
    status: params.get('status') || '',
  }
  const hasFilters = Object.values(filters).some((value) => value !== '')

  return {
    filters,
    activeFilters: hasFilters ? filters : null,
    viewMode: hasFilters ? 'search' : 'list',
    highlightTradeId: params.get('tradeId') || ''
  }
}

const countActiveFilters = (filters: typeof defaultFilters) =>
  Object.values(filters).filter((value) => value !== '').length

const mapTradeToFormValues = (trade: TradeResponse, timeZone: string): TradeFormValues => {
  const toInputDate = (value?: string | null) => {
    if (!value) return ''
    return formatUtcForDateTimeLocal(value, timeZone)
  }
  return {
    symbol: trade.symbol,
    market: trade.market,
    direction: trade.direction,
    status: trade.status,
    openedAt: toInputDate(trade.openedAt),
    closedAt: toInputDate(trade.closedAt),
    timeframe: trade.timeframe || '',
    quantity: trade.quantity ?? 0,
    entryPrice: trade.entryPrice ?? 0,
    exitPrice: trade.exitPrice ?? undefined,
    stopLossPrice: trade.stopLossPrice ?? undefined,
    takeProfitPrice: trade.takeProfitPrice ?? undefined,
    fees: trade.fees ?? 0,
    feesProfileCurrency: trade.feesProfileCurrency ?? undefined,
    commission: trade.commission ?? 0,
    slippage: trade.slippage ?? 0,
    tradeCurrency: trade.tradeCurrency ?? '',
    profileCurrency: trade.profileCurrency ?? '',
    fxRateTradeToProfile: trade.fxRateTradeToProfile ?? undefined,
    fxRateSource: trade.fxRateSource ?? '',
    pnlProfileCurrency: trade.pnlProfileCurrency ?? undefined,
    riskAmount: trade.riskAmount ?? undefined,
    capitalUsed: trade.capitalUsed ?? undefined,
    setup: trade.setup ?? '',
    strategyTag: trade.strategyTag ?? '',
    catalystTag: trade.catalystTag ?? '',
    strategyId: trade.strategyId ?? '',
    setupGrade: trade.setupGrade ?? undefined,
    ruleBreaks: trade.ruleBreaks ?? [],
    session: trade.session ?? undefined,
    linkedContentIds: trade.linkedContentIds ?? [],
    linkedPlanIds: trade.linkedPlanIds ?? trade.linkedContentIds ?? [],
    notes: trade.notes ?? '',
    accountRefId: trade.accountRefId ?? '',
    contractMultiplier: trade.contractMultiplier ?? undefined
  }
}

export default function TradesPage() {
  const { t } = useI18n()
  const [trades, setTrades] = useState<TradeResponse[]>([])
  const [totalRows, setTotalRows] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [fetchError, setFetchError] = useState<string>('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [createError, setCreateError] = useState('')
  const [editError, setEditError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [noteNavError, setNoteNavError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, logout, user } = useAuth()
  const { refreshToken } = useDemoData()
  const accountScope = useAccountScope()
  const accountPreselectionRef = useRef({
    accounts: accountScope.accounts,
    scope: accountScope.scope
  })
  accountPreselectionRef.current = {
    accounts: accountScope.accounts,
    scope: accountScope.scope
  }
  const accountPreselectionKey = [
    accountScope.scope.mode,
    accountScope.scope.mode === 'selected' ? accountScope.scope.accountIds.join(',') : '',
    ...accountScope.accounts.map((account) => (
      `${account.id}:${account.status || 'ACTIVE'}:${account.isDefault ? 'default' : ''}`
    ))
  ].join('|')
  const scopedAccountIds = accountScope.apiParams.accountIds
  const hasSelectedAccountScope = accountScope.scope.mode === 'selected'
  const baseCurrency = user?.baseCurrency || 'USD'
  const timezone = user?.timezone || 'Europe/Bucharest'
  const resolvePreselectedAccountId = useCallback((explicitAccountId?: string | null) => {
    const context = accountPreselectionRef.current
    return resolveTradeAccountPreselection(context.accounts, context.scope, explicitAccountId)
  }, [])
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'))
  const isCreateDialogMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isCreateDialogCompact = useMediaQuery(theme.breakpoints.down('md'))
  const routeState = useMemo(() => deriveRouteState(location.search, timezone), [location.search, timezone])

  const [viewMode, setViewMode] = useState<'list' | 'search'>(() => routeState.viewMode)
  const [filters, setFilters] = useState<TradesFilters>(() => routeState.filters)
  const [activeFilters, setActiveFilters] = useState<TradesFilters | null>(() => routeState.activeFilters)

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  })
  const [expandedTrade, setExpandedTrade] = useState<TradeResponse | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createDialogMode, setCreateDialogMode] = useState<TradeEntryMode>('advanced')
  const [createFormDirty, setCreateFormDirty] = useState(false)
  const [createDiscardDialogOpen, setCreateDiscardDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TradeResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TradeResponse | null>(null)
  const [createFormValues, setCreateFormValues] = useState<TradeFormValues>(() => (
    buildDefaultValues(timezone, resolvePreselectedAccountId())
  ))
  const [optionsLoadError, setOptionsLoadError] = useState('')
  const [strategyOptions, setStrategyOptions] = useState<ContentOption[]>([])
  const [planOptions, setPlanOptions] = useState<ContentOption[]>([])
  const [importSummary, setImportSummary] = useState<TradeCsvImportSummary | null>(null)
  const [importError, setImportError] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [highlightTradeId, setHighlightTradeId] = useState(() => routeState.highlightTradeId)
  const [screenshotViewer, setScreenshotViewer] = useState<ScreenshotViewerState>(emptyScreenshotViewerState)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const optionsLoadedRef = useRef(false)
  const optionsLoadingPromiseRef = useRef<Promise<void> | null>(null)
  const screenshotRequestRef = useRef(0)

  const handleAuthFailure = useCallback((message?: string) => {
    setFetchError(message || t('trades.errors.loginRequired'))
    logout()
    navigate('/login', { replace: true, state: { from: location.pathname } })
  }, [location.pathname, logout, navigate, t])

  const handleEditClick = useCallback((trade: TradeResponse) => {
    setEditTarget(trade)
    setEditError('')
    setEditDialogOpen(true)
  }, [])

  const handleDeleteClick = useCallback((trade: TradeResponse) => {
    setDeleteTarget(trade)
    setDeleteError('')
  }, [])

  const strategyNameById = useMemo(() => {
    const map = new Map<string, string>()
    strategyOptions.forEach((item) => map.set(item.id, item.label))
    return map
  }, [strategyOptions])
  const accountNameById = useMemo(
    () => new Map(accountScope.accounts.map((account) => [account.id, account.name])),
    [accountScope.accounts]
  )
  const tradeAccountLabel = useCallback(
    (trade: TradeResponse) => {
      const internalId = trade.accountRefId || ''
      return trade.accountName || accountNameById.get(internalId) || (
        trade.accountId && !trade.accountRefId ? t('tradingAccounts.unassignedLegacy') : t('tradingAccounts.unassigned')
      )
    },
    [accountNameById, t]
  )

  const handleCreateTradeNote = useCallback(async (trade: TradeResponse) => {
    setNoteNavError('')
    try {
      const note = await createNotebookNote({
        type: 'TRADE_NOTE',
        title: `${trade.symbol} ${t('trades.tradeNoteSuffix')}`,
        relatedTradeId: trade.id
      })
      const noteId = (note as any)?.id
      if (!noteId) {
        setNoteNavError(t('trades.errors.noteMissingId'))
        return
      }
      const target = `/notebook?noteId=${noteId}`
      navigate(target)
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      const message = apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.createTradeNoteFailed') : t('trades.errors.createTradeNoteFailed')
      setEditError(message)
      setNoteNavError(message)
    }
  }, [handleAuthFailure, navigate, t])

  const handleCloseScreenshotViewer = useCallback(() => {
    screenshotRequestRef.current += 1
    setScreenshotViewer(emptyScreenshotViewerState)
  }, [])

  const handleOpenScreenshotViewer = useCallback(async (trade: TradeResponse) => {
    const requestId = screenshotRequestRef.current + 1
    screenshotRequestRef.current = requestId
    setScreenshotViewer({
      open: true,
      trade,
      assets: [],
      loading: true,
      error: ''
    })

    try {
      const assets = await listTradeAssets(trade.id)
      if (screenshotRequestRef.current !== requestId) {
        return
      }
      const imageAssets = assets.filter((asset) => asset.image || asset.contentType?.startsWith('image/'))
      setScreenshotViewer({
        open: true,
        trade,
        assets: imageAssets,
        loading: false,
        error: imageAssets.length === 0 ? t('trades.errors.noScreenshotsFound') : ''
      })
    } catch (err) {
      const apiErr = err as ApiError
      if (screenshotRequestRef.current !== requestId) {
        return
      }
      if (apiErr.status === 401 || apiErr.status === 403) {
        setScreenshotViewer(emptyScreenshotViewerState)
        handleAuthFailure(apiErr.message)
        return
      }
      setScreenshotViewer({
        open: true,
        trade,
        assets: [],
        loading: false,
        error: apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.loadScreenshotsFailed') : t('trades.errors.loadScreenshotsFailed')
      })
    }
  }, [handleAuthFailure, t])


  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'openedAt',
      headerName: t('trades.table.opened'),
      flex: 1.1,
      minWidth: 170,
      valueFormatter: (params) => formatDateTime(params.value, timezone),
      sortComparator: (a, b) => new Date(a as string).getTime() - new Date(b as string).getTime()
    },
    { field: 'symbol', headerName: t('trades.table.symbol'), flex: 1, minWidth: 110 },
    {
      field: 'accountName',
      headerName: t('trades.table.account'),
      flex: 1.2,
      minWidth: 170,
      valueGetter: (params) => tradeAccountLabel(params.row as TradeResponse),
      renderCell: (params) => {
        const row = params.row as TradeResponse
        return (
          <Stack spacing={0.1} sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>{params.value}</Typography>
            {(row.accountBroker || row.accountCurrency) && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {[row.accountBroker, row.accountCurrency].filter(Boolean).join(' · ')}
              </Typography>
            )}
          </Stack>
        )
      }
    },
    {
      field: 'source',
      headerName: t('trades.table.source'),
      minWidth: 105,
      renderCell: (params) => <Chip size="small" variant="outlined" label={t(`trades.source.${params.value || 'MANUAL'}`)} />
    },
    { field: 'market', headerName: t('trades.table.market'), flex: 1, minWidth: 110 },
    {
      field: 'direction',
      headerName: t('trades.table.direction'),
      flex: 0.9,
      renderCell: (params) => (
        <Chip
          size="small"
          label={t(`trades.direction.${params.value}`)}
          color={params.value === 'LONG' ? 'success' : 'error'}
          variant="outlined"
        />
      )
    },
    {
      field: 'status',
      headerName: t('trades.table.status'),
      flex: 0.9,
      renderCell: (params) => (
        <Chip
          size="small"
          label={t(`trades.status.${params.value}`)}
          color={params.value === 'CLOSED' ? 'primary' : 'warning'}
          variant="outlined"
        />
      )
    },
    { field: 'quantity', headerName: t('trades.table.qty'), flex: 0.9, valueFormatter: (params) => formatNumber(params.value, 2) },
    {
      field: 'entryPrice',
      headerName: t('trades.table.entry'),
      flex: 1,
      renderCell: (params) => {
        const row = params.row as TradeResponse
        const tradeCurrency = row.tradeCurrency || row.profileCurrency || baseCurrency
        return (
          <Typography variant="body2">
            {formatCurrency(params.value, tradeCurrency)}
          </Typography>
        )
      }
    },
    {
      field: 'exitPrice',
      headerName: t('trades.table.exit'),
      flex: 1,
      renderCell: (params) => {
        const row = params.row as TradeResponse
        const tradeCurrency = row.tradeCurrency || row.profileCurrency || baseCurrency
        return (
          <Typography variant="body2">
            {formatCurrency(params.value, tradeCurrency)}
          </Typography>
        )
      }
    },
    {
      field: 'pnlNet',
      headerName: t('trades.table.pnlNet'),
      flex: 1,
      renderCell: (params) => {
        const row = params.row as TradeResponse
        const profileCurrency = row.profileCurrency || baseCurrency
        const tradeCurrency = row.tradeCurrency || profileCurrency
        const pnlProfileCurrency = row.pnlProfileCurrency ?? row.pnlNet
        return (
          <Stack spacing={0.1} sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatSignedCurrency(pnlProfileCurrency, profileCurrency)}
            </Typography>
            {tradeCurrency !== profileCurrency && (
              <Typography variant="caption" color="text.secondary">
                {formatSignedCurrency(row.pnlNet, tradeCurrency)}
              </Typography>
            )}
          </Stack>
        )
      },
      cellClassName: (params) => {
        const row = params.row as TradeResponse
        const value = row.pnlProfileCurrency ?? row.pnlNet ?? 0
        return value >= 0 ? 'pnl-positive' : 'pnl-negative'
      }
    },
    { field: 'pnlPercent', headerName: t('trades.table.pnlPercent'), flex: 0.9, valueFormatter: (params) => formatPercent(params.value) },
    { field: 'rMultiple', headerName: t('trades.table.rMultiple'), flex: 0.9, valueFormatter: (params) => formatNumber(params.value, 2) },
    {
      field: 'notes',
      headerName: t('trades.table.notes'),
      flex: 1.4,
      valueGetter: (params) => getTradeNotesPreview(params.row as TradeResponse),
      renderCell: (params) => (
        <Tooltip title={params.value || t('trades.table.noNotes')}>
          <Typography variant="body2" noWrap>
            {params.value || t('common.na')}
          </Typography>
        </Tooltip>
      )
    },
    {
      field: 'actions',
      headerName: t('trades.table.actions'),
      sortable: false,
      filterable: false,
      align: 'center',
      headerAlign: 'center',
      minWidth: 200,
      renderCell: (params) => (
        <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
          {hasTradeScreenshots(params.row as TradeResponse) && (
            <Tooltip title={t('trades.actions.previewScreenshots')}>
              <IconButton
                size="small"
                aria-label={t('trades.actions.previewScreenshots')}
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  handleOpenScreenshotViewer(params.row as TradeResponse)
                }}
              >
                <PhotoLibraryRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('trades.actions.createTradeNote')}>
            <IconButton
              size="small"
              aria-label={t('trades.actions.createTradeNote')}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                handleCreateTradeNote(params.row as TradeResponse)
              }}
            >
              <NoteAddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" aria-label={t('trades.actions.editTrade')} onClick={() => handleEditClick(params.row as TradeResponse)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" aria-label={t('trades.actions.deleteTrade')} onClick={() => handleDeleteClick(params.row as TradeResponse)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      )
    }
  ], [baseCurrency, handleCreateTradeNote, handleDeleteClick, handleEditClick, handleOpenScreenshotViewer, t, timezone, tradeAccountLabel])

  const fetchTrades = useCallback(async () => {
    if (!isAuthenticated) {
      setTrades([])
      setTotalRows(0)
      setFetchError(t('trades.errors.loginRequired'))
      return
    }

    setLoading(true)
    setFetchError('')

    try {
      const shouldSearch = viewMode === 'search' || hasSelectedAccountScope
      const appliedFilters = activeFilters || defaultFilters
      const response = shouldSearch
        ? await searchTrades({
          openedAtFrom: appliedFilters.openedAtFrom || undefined,
          openedAtTo: appliedFilters.openedAtTo || undefined,
          closedAtFrom: appliedFilters.closedAtFrom || undefined,
          closedAtTo: appliedFilters.closedAtTo || undefined,
          closedDate: appliedFilters.closedDate || undefined,
          symbol: appliedFilters.symbol || undefined,
          direction: appliedFilters.direction ? appliedFilters.direction as 'LONG' | 'SHORT' : undefined,
          status: appliedFilters.status ? appliedFilters.status as 'OPEN' | 'CLOSED' : undefined,
          tz: appliedFilters.closedDate ? (appliedFilters.tz || timezone) : appliedFilters.tz || undefined,
          ...(scopedAccountIds ? { accountIds: scopedAccountIds } : {}),
          page: paginationModel.page,
          size: paginationModel.pageSize,
        })
        : await listTrades({
          page: paginationModel.page,
          size: paginationModel.pageSize,
        })

      const rows = response.content || []
      setTrades(rows)
      setTotalRows(response.totalElements)
      setExpandedTrade((prev) => rows.find((t) => t.id === prev?.id) ?? null)
    } catch (err) {
      setTrades([])
      setExpandedTrade(null)
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      setFetchError(apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.fetchFailed') : t('trades.errors.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }, [activeFilters, handleAuthFailure, hasSelectedAccountScope, isAuthenticated, paginationModel.page, paginationModel.pageSize, scopedAccountIds, t, timezone, viewMode])

  const handleImportClick = useCallback(() => {
    setImportDialogOpen(true)
  }, [])

  const handleTradovateImport = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handlePaginationModelChange = useCallback((nextModel: GridPaginationModel) => {
    setPaginationModel((prev) => (
      prev.page === nextModel.page && prev.pageSize === nextModel.pageSize
        ? prev
        : nextModel
    ))
  }, [])

  const handleImportChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    trackEvent('trade_import_start', {
      method: 'csv',
      success: true,
      feature_area: 'trades'
    })
    setImportLoading(true)
    setImportError('')
    try {
      const summary = await importTradesCsv(file)
      setImportSummary(summary)
      trackEvent('trade_import_success', {
        method: 'csv',
        success: true,
        total_rows: summary.totalRows,
        trades_created: summary.tradesCreated,
        trades_updated: summary.tradesUpdated,
        groups_skipped: summary.groupsSkipped,
        feature_area: 'trades'
      })
      fetchTrades()
    } catch (err) {
      const apiErr = err as ApiError
      const errorCode = apiErr.code || (apiErr.status ? `HTTP_${apiErr.status}` : 'UNKNOWN')
      const errorMessage = apiErr.rawMessage || apiErr.message
      if (apiErr.status === 401 || apiErr.status === 403) {
        trackEvent('trade_import_fail', {
          method: 'csv',
          success: false,
          error_code: errorCode,
          error_message: errorMessage,
          feature_area: 'trades'
        })
        handleAuthFailure(apiErr.message)
        return
      }
      trackEvent('trade_import_fail', {
        method: 'csv',
        success: false,
        error_code: errorCode,
        error_message: errorMessage,
        feature_area: 'trades'
      })
      const message = apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.importFailed') : t('trades.errors.importFailed')
      setImportError(message)
    } finally {
      setImportLoading(false)
      event.target.value = ''
    }
  }, [fetchTrades, handleAuthFailure, t])

  const fetchContentOptions = useCallback(async () => {
    if (optionsLoadedRef.current) return
    if (optionsLoadingPromiseRef.current) {
      await optionsLoadingPromiseRef.current
      return
    }

    const loadPromise = (async () => {
      try {
        setOptionsLoadError('')
        const [strategies, myPlans] = await Promise.all([
          listStrategies({ includeArchived: true }),
          listMyPlans({ scope: 'DAILY' })
        ])

        setStrategyOptions((strategies?.myStrategies || []).map((item) => ({
          id: item.id,
          label: item.name
        })))

        setPlanOptions((myPlans || []).map((plan) => ({
          id: plan.id,
          source: plan.source,
          label: `${t('trades.form.myPlanPrefix')}: ${plan.title}`
        })))
        optionsLoadedRef.current = true
      } catch (err) {
        const apiErr = err as ApiError
        setOptionsLoadError(apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.loadOptionsFailed') : t('trades.errors.loadOptionsFailed'))
      } finally {
        optionsLoadingPromiseRef.current = null
      }
    })()

    optionsLoadingPromiseRef.current = loadPromise
    await loadPromise
  }, [t])

  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  useEffect(() => {
    optionsLoadedRef.current = false
    optionsLoadingPromiseRef.current = null
    setStrategyOptions([])
    setPlanOptions([])
  }, [isAuthenticated, refreshToken, user?.timezone])

  useEffect(() => {
    if (!editDialogOpen && !createDialogOpen) return
    void fetchContentOptions()
  }, [createDialogOpen, editDialogOpen, fetchContentOptions])

  useEffect(() => {
    setFilters((prev) => areFiltersEqual(prev, routeState.filters) ? prev : routeState.filters)
    setActiveFilters((prev) => areFiltersEqual(prev, routeState.activeFilters) ? prev : routeState.activeFilters)
    setViewMode((prev) => prev === routeState.viewMode ? prev : routeState.viewMode)
    setHighlightTradeId((prev) => prev === routeState.highlightTradeId ? prev : routeState.highlightTradeId)
    if (routeState.viewMode === 'search') {
      setPaginationModel((prev) => prev.page === 0 ? prev : { ...prev, page: 0 })
    }
  }, [routeState])

  useEffect(() => {
    if (!location.search) return
    const params = new URLSearchParams(location.search)

    const shouldOpenQuickLog = params.get('quickLog') === '1'
    if (shouldOpenQuickLog) {
      const linkedRaw = params.get('linkedPlanIds') || params.get('linkedContentIds') || params.get('planId') || ''
      const linkedContentIds = linkedRaw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

      const requestedAccountId = params.get('accountRefId') || params.get('accountId')
      const quickDefaults = buildQuickLogDefaults(timezone, resolvePreselectedAccountId(requestedAccountId))
      const requestedDirection = params.get('direction')
      const direction = requestedDirection === 'LONG' || requestedDirection === 'SHORT'
        ? requestedDirection
        : quickDefaults.direction
      setCreateFormValues({
        ...quickDefaults,
        symbol: params.get('symbol') || quickDefaults.symbol,
        direction,
        setup: params.get('setup') || quickDefaults.setup,
        timeframe: params.get('timeframe') || quickDefaults.timeframe,
        session: (params.get('session') || quickDefaults.session) as TradeFormValues['session'],
        accountRefId: quickDefaults.accountRefId,
        strategyTag: params.get('strategyTag') || quickDefaults.strategyTag,
        strategyId: params.get('strategyId') || quickDefaults.strategyId,
        linkedContentIds: linkedContentIds.length > 0 ? linkedContentIds : quickDefaults.linkedContentIds,
        linkedPlanIds: linkedContentIds.length > 0 ? linkedContentIds : quickDefaults.linkedPlanIds,
      })
      setCreateDialogMode('quick')
      setCreateError('')
      setCreateFormDirty(false)
      setCreateDiscardDialogOpen(false)
      setCreateDialogOpen(true)
    }
  }, [accountPreselectionKey, location.search, resolvePreselectedAccountId, timezone])

  useEffect(() => {
    if (!highlightTradeId) return
    getTradeById(highlightTradeId)
      .then((trade) => setExpandedTrade(trade))
      .catch(() => {})
  }, [highlightTradeId])

  useEffect(() => {
    const editTradeId = new URLSearchParams(location.search).get('editTradeId')
    if (!editTradeId) return
    getTradeById(editTradeId)
      .then((trade) => handleEditClick(trade))
      .catch(() => setEditError(t('trades.errors.fetchFailed')))
  }, [handleEditClick, location.search, t])

  const handleCreate = async (values: TradeFormValues) => {
    setCreateSuccess('')
    setCreateError('')
    try {
      const payload = buildTradePayload(values, timezone)
      await createTrade(payload)
      trackEvent('trade_create_submit', {
        method: 'manual_form',
        success: true,
        feature_area: 'trades'
      })
      setCreateSuccess(t('trades.messages.created'))
      const freshDefaults = buildDefaultValues(timezone, resolvePreselectedAccountId())
      setCreateFormValues(freshDefaults)
      closeCreateDialog()
      fetchTrades()
    } catch (err) {
      const apiErr = err as ApiError
      const errorCode = apiErr.code || (apiErr.status ? `HTTP_${apiErr.status}` : 'UNKNOWN')
      const errorMessage = apiErr.rawMessage || apiErr.message
      if (apiErr.status === 401 || apiErr.status === 403) {
        trackEvent('trade_create_submit', {
          method: 'manual_form',
          success: false,
          error_code: errorCode,
          error_message: errorMessage,
          feature_area: 'trades'
        })
        handleAuthFailure(apiErr.message)
        return
      }
      trackEvent('trade_create_submit', {
        method: 'manual_form',
        success: false,
        error_code: errorCode,
        error_message: errorMessage,
        feature_area: 'trades'
      })
      setCreateError(apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.createFailed') : t('trades.errors.createFailed'))
    }
  }

  const handleUpdateTrade = async (values: TradeFormValues) => {
    if (!editTarget) return
    setEditError('')
    try {
      const payload = buildTradePayload(values, timezone)
      const updated = await updateTrade(editTarget.id, payload)
      setTrades((prev) => prev.map((t) => t.id === updated.id ? updated : t))
      setExpandedTrade((prev) => prev?.id === updated.id ? updated : prev)
      setEditDialogOpen(false)
      fetchTrades()
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      setEditError(apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.updateFailed') : t('trades.errors.updateFailed'))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteError('')
    try {
      await deleteTrade(deleteTarget.id)
      setTrades((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      setTotalRows((prev) => Math.max(prev - 1, 0))
      if (expandedTrade?.id === deleteTarget.id) {
        setExpandedTrade(null)
      }
      fetchTrades()
    } catch (err) {
      const apiErr = err as ApiError
      if (apiErr.status === 401 || apiErr.status === 403) {
        handleAuthFailure(apiErr.message)
        return
      }
      setDeleteError(apiErr instanceof Error ? translateApiError(apiErr, t, 'trades.errors.deleteFailed') : t('trades.errors.deleteFailed'))
    } finally {
      setDeleteTarget(null)
    }
  }

  const onSearch = () => {
    trackEvent('filter_apply', {
      method: 'manual_search',
      success: true,
      filter_count: countActiveFilters(filters),
      feature_area: 'trades'
    })
    setActiveFilters(filters)
    setViewMode('search')
    setPaginationModel((prev) => ({ ...prev, page: 0 }))
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
    setActiveFilters(null)
    setViewMode('list')
    setPaginationModel((prev) => ({ ...prev, page: 0 }))
    accountScope.clearScope()
  }

  const openCreateDialog = () => {
    setCreateFormValues(buildDefaultValues(timezone, resolvePreselectedAccountId()))
    setCreateDialogMode('advanced')
    setCreateError('')
    setCreateFormDirty(false)
    setCreateDiscardDialogOpen(false)
    setCreateDialogOpen(true)
    void fetchContentOptions()
  }

  const openQuickLogDialog = () => {
    setCreateFormValues(buildQuickLogDefaults(timezone, resolvePreselectedAccountId()))
    setCreateDialogMode('quick')
    setCreateError('')
    setCreateFormDirty(false)
    setCreateDiscardDialogOpen(false)
    setCreateDialogOpen(true)
    void fetchContentOptions()
  }

  function closeCreateDialog() {
    setCreateDialogOpen(false)
    setCreateFormDirty(false)
    setCreateDiscardDialogOpen(false)
  }

  function requestCloseCreateDialog() {
    if (createFormDirty && createDialogMode === 'advanced') {
      setCreateDiscardDialogOpen(true)
      return
    }
    closeCreateDialog()
  }

  const renderTradesTable = () => (
    <Box
      sx={{
        height: 560,
        width: '100%',
        position: 'relative',
        overflowX: 'auto',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
    >
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: alpha(theme.palette.background.default, 0.72),
            zIndex: 1,
          }}
        >
          <CircularProgress />
        </Box>
      )}
      <DataGrid
        rows={trades}
        columns={columns}
        rowCount={totalRows}
        loading={loading}
        density="compact"
        pageSizeOptions={[5, 10, 25]}
        paginationModel={paginationModel}
        paginationMode="server"
        onPaginationModelChange={handlePaginationModelChange}
        disableRowSelectionOnClick
        getRowId={(row) => row.id}
        initialState={{
          sorting: {
            sortModel: [{ field: 'openedAt', sort: 'desc' }],
          },
        }}
        sx={{
          minWidth: 860,
          border: 'none',
          '& .pnl-positive': { color: 'success.main', fontWeight: 600 },
          '& .pnl-negative': { color: 'error.main', fontWeight: 600 },
          '& .trade-row-highlight': {
            backgroundColor: 'action.selected'
          }
        }}
        getRowClassName={(params) => (params.id === highlightTradeId ? 'trade-row-highlight' : '')}
        onRowClick={(params) => setExpandedTrade((prev) => prev?.id === params.id ? null : params.row as TradeResponse)}
      />

      {!loading && trades.length === 0 && (
        <Box sx={{ position: 'absolute', inset: 0 }}>
          <EmptyState
            title={t('trades.empty.title')}
            description={t('trades.empty.body')}
          />
        </Box>
      )}
    </Box>
  )

  const renderTradeCards = () => (
    <Stack spacing={1.5}>
      {trades.map((trade) => (
        <Paper key={trade.id} className="interactive-lift" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>{trade.symbol}</Typography>
                <Typography variant="body2" color="text.secondary">{formatDateTime(trade.openedAt, timezone)}</Typography>
              </Box>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip size="small" label={t(`trades.source.${trade.source || 'MANUAL'}`)} variant="outlined" />
                <Chip size="small" label={t(`trades.direction.${trade.direction}`)} color={trade.direction === 'LONG' ? 'success' : 'error'} variant="outlined" />
                <Chip size="small" label={t(`trades.status.${trade.status}`)} color={trade.status === 'CLOSED' ? 'primary' : 'warning'} variant="outlined" />
                {trade.importStatus === 'NEEDS_REVIEW' && <Chip size="small" color="warning" label={t('trades.mt5.needsReview')} />}
              </Stack>
            </Stack>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  {t('trades.card.entry')}: {formatCurrency(trade.entryPrice, trade.tradeCurrency || trade.profileCurrency || baseCurrency)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  {t('trades.card.exit')}: {formatCurrency(trade.exitPrice, trade.tradeCurrency || trade.profileCurrency || baseCurrency)}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Stack spacing={0.1}>
                  <Typography variant="body2">
                    {t('trades.card.pnl')}: {formatSignedCurrency(trade.pnlProfileCurrency ?? trade.pnlNet, trade.profileCurrency || baseCurrency)}
                  </Typography>
                  {(trade.tradeCurrency || trade.profileCurrency || baseCurrency) !== (trade.profileCurrency || baseCurrency) && (
                    <Typography variant="caption" color="text.secondary">
                      {formatSignedCurrency(trade.pnlNet, trade.tradeCurrency || trade.profileCurrency || baseCurrency)}
                    </Typography>
                  )}
                </Stack>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">{t('trades.card.pnlPercent')}: {formatPercent(trade.pnlPercent)}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  {t('trades.details.fxRate')}: {formatNumber(trade.fxRateTradeToProfile ?? 1, 6)} • {t('trades.details.fxSource')}: {trade.fxRateSource || t('common.na')}
                </Typography>
              </Grid>
              {trade.source === 'TRADING212_CSV' && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    {t('trades.mt5.externalPositionId')}: {trade.externalPositionId || t('common.na')} •
                    {' '}{t('trades.mt5.reportedSpread')}: {formatCurrency(trade.brokerReportedSpread, trade.accountCurrency || baseCurrency)}
                    {' '}({t('trades.mt5.spreadNotDeducted')})
                  </Typography>
                </Grid>
              )}
            </Grid>
            <Typography variant="body2" color="text.secondary">{t('trades.card.notes')}: {getTradeNotesPreview(trade) || t('common.na')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('tradingAccounts.selectorLabel')}: {tradeAccountLabel(trade)}</Typography>
            {trade.initialNotes && (
              <Typography variant="body2" color="text.secondary">{t('trades.details.initialNotes')}: {trade.initialNotes}</Typography>
            )}
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {trade.strategyId && (
                <Chip size="small" variant="outlined" label={trade.strategyName || strategyNameById.get(trade.strategyId) || trade.strategyTag || t('common.na')} />
              )}
              {trade.setupGrade && (
                <Chip size="small" variant="outlined" label={`${t('trades.form.setupGrade')}: ${trade.setupGrade}`} />
              )}
              {trade.session && (
                <Chip size="small" variant="outlined" label={`${t('trades.form.session')}: ${t(`trades.form.sessions.${trade.session}`)}`} />
              )}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {hasTradeScreenshots(trade) && (
                <Button fullWidth size="small" startIcon={<PhotoLibraryRoundedIcon />} onClick={() => handleOpenScreenshotViewer(trade)}>
                  {t('trades.actions.previewScreenshots')}
                </Button>
              )}
              <Button fullWidth size="small" startIcon={<EditIcon />} onClick={() => handleEditClick(trade)}>{t('common.edit')}</Button>
              <Button fullWidth size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteClick(trade)}>{t('common.delete')}</Button>
            </Stack>
          </Stack>
        </Paper>
      ))}
      {!loading && trades.length === 0 && (
        <EmptyState
          title={t('trades.empty.title')}
          description={t('trades.empty.body')}
        />
      )}
    </Stack>
  )

  return (
    <Stack spacing={2.5} sx={{ pb: { xs: 'calc(84px + env(safe-area-inset-bottom))', md: 0 } }}>
      <PageHero
        eyebrow={t('nav.trades')}
        title={t('trades.list.title')}
        description={t('trades.subtitle')}
        icon={<CandlestickChartRoundedIcon fontSize="small" />}
        action={(
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              onClick={openQuickLogDialog}
              startIcon={<FlashOnRoundedIcon />}
              sx={{ minWidth: { sm: 128 } }}
            >
              {t('trades.quickLog.title')}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineRoundedIcon />}
              onClick={openCreateDialog}
              sx={{ minWidth: { sm: 148 }, display: { xs: 'none', md: 'inline-flex' } }}
            >
              {t('trades.create.title')}
            </Button>
          </Stack>
        )}
      />

      <AccountScopeSummary
        scope={accountScope.scope}
        accounts={accountScope.accounts}
        notice={accountScope.selectionNotice}
      />

      <Card className="interactive-lift">
        <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
          <Stack spacing={1.75} sx={{ mb: 1.5 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={1.25}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle1">{t('trades.list.title')}</Typography>
                {viewMode === 'search' && (
                  <Alert severity="info" sx={{ m: 0, py: 0.2, px: 1.2 }}>
                    {t('trades.list.searchResults')}
                  </Alert>
                )}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={importLoading ? <CircularProgress size={16} /> : <FileUploadRoundedIcon />}
                  onClick={handleImportClick}
                  disabled={importLoading}
                >
                  {t('trades.list.importTrades')}
                </Button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={handleImportChange}
                />
              </Stack>
            </Stack>
          </Stack>

          {createSuccess && <Alert severity="success" sx={{ mb: 2 }}>{createSuccess}</Alert>}
          {fetchError && <ErrorBanner message={fetchError} />}
          {noteNavError && <ErrorBanner message={noteNavError} />}
          {optionsLoadError && <Alert severity="warning" sx={{ mb: 2 }}>{optionsLoadError}</Alert>}
          {importError && <Alert severity="error" sx={{ mb: 2 }}>{importError}</Alert>}
          {importSummary && (
            <Box sx={{ mb: 2 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                {t('trades.import.summary', { rows: importSummary.totalRows, groups: importSummary.isinGroups })}
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">{t('trades.import.tradesCreated')}</Typography>
                  <Typography>{importSummary.tradesCreated}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">{t('trades.import.tradesUpdated')}</Typography>
                  <Typography>{importSummary.tradesUpdated}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">{t('trades.import.groupsSkipped')}</Typography>
                  <Typography>{importSummary.groupsSkipped}</Typography>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Typography variant="subtitle2">{t('trades.import.isinGroups')}</Typography>
                  <Typography>{importSummary.isinGroups}</Typography>
                </Grid>
              </Grid>
              {importSummary.groupResults?.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>{t('trades.import.perIsinResults')}</Typography>
                  <Stack spacing={1}>
                    {importSummary.groupResults.map((result) => (
                      <Alert
                        key={`${result.isin}-${result.status}`}
                        severity={result.status === 'SKIPPED' ? 'warning' : 'success'}
                      >
                        <strong>{result.isin}</strong>: {result.status === 'SKIPPED' ? t('trades.import.status.SKIPPED') : t('trades.import.status.IMPORTED')}
                        {result.reason ? ` — ${result.reason}` : ''}
                      </Alert>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          )}
          {isSmallScreen ? renderTradeCards() : renderTradesTable()}
          {expandedTrade && !isSmallScreen && (
            <Box sx={{ mt: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>{t('trades.details.title')}</Typography>
              {(() => {
                const profileCurrency = expandedTrade.profileCurrency || baseCurrency
                const tradeCurrency = expandedTrade.tradeCurrency || profileCurrency
                const pnlProfileCurrency = expandedTrade.pnlProfileCurrency ?? expandedTrade.pnlNet
                return (
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <Typography variant="subtitle2" gutterBottom>{t('trades.details.stopsAndTargets')}</Typography>
                      <Typography variant="body2">{t('trades.details.stopLoss')}: {formatCurrency(expandedTrade.stopLossPrice, tradeCurrency)}</Typography>
                      <Typography variant="body2">{t('trades.details.takeProfit')}: {formatCurrency(expandedTrade.takeProfitPrice, tradeCurrency)}</Typography>
                      <Typography variant="body2">{t('trades.details.timeframe')}: {expandedTrade.timeframe || t('common.na')}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Typography variant="subtitle2" gutterBottom>{t('trades.details.costsAndRisk')}</Typography>
                      <Typography variant="body2">{t('trades.form.fees')}: {formatCurrency(expandedTrade.fees, tradeCurrency)}</Typography>
                      <Typography variant="body2">{t('trades.details.feesProfile')}: {formatCurrency(expandedTrade.feesProfileCurrency, profileCurrency)}</Typography>
                      <Typography variant="body2">{t('trades.form.commission')}: {formatCurrency(expandedTrade.commission, tradeCurrency)}</Typography>
                      <Typography variant="body2">{t('trades.form.slippage')}: {formatCurrency(expandedTrade.slippage, tradeCurrency)}</Typography>
                      <Typography variant="body2">{t('trades.details.risk')}: {formatCurrency(expandedTrade.riskAmount, tradeCurrency)} ({formatPercent(expandedTrade.riskPercent)})</Typography>
                      <Typography variant="body2">{t('trades.form.rMultiple')}: {formatNumber(expandedTrade.rMultiple)}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Typography variant="subtitle2" gutterBottom>{t('trades.details.currency')}</Typography>
                      <Typography variant="body2">{t('trades.form.profileCurrency')}: {profileCurrency}</Typography>
                      <Typography variant="body2">{t('trades.form.tradeCurrency')}: {tradeCurrency}</Typography>
                      <Typography variant="body2">{t('trades.details.pnlProfile')}: {formatSignedCurrency(pnlProfileCurrency, profileCurrency)}</Typography>
                      <Typography variant="body2">{t('trades.details.pnlTrade')}: {formatSignedCurrency(expandedTrade.pnlNet, tradeCurrency)}</Typography>
                      <Typography variant="body2">{t('trades.details.fxRate')}: {formatNumber(expandedTrade.fxRateTradeToProfile ?? 1, 6)}</Typography>
                      <Typography variant="body2">{t('trades.details.fxSource')}: {expandedTrade.fxRateSource || t('common.na')}</Typography>
                      <Typography variant="body2">{t('trades.details.fxTimestamp')}: {expandedTrade.fxRateTimestamp ? formatDateTime(expandedTrade.fxRateTimestamp, timezone) : t('common.na')}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Typography variant="subtitle2" gutterBottom>{t('trades.details.setup')}</Typography>
                      <Typography variant="body2">{t('tradingAccounts.selectorLabel')}: {tradeAccountLabel(expandedTrade)}</Typography>
                      <Typography variant="body2">{t('trades.form.setup')}: {expandedTrade.setup || t('common.na')}</Typography>
                      <Typography variant="body2">{t('trades.form.strategy')}: {expandedTrade.strategyName || (expandedTrade.strategyId ? strategyNameById.get(expandedTrade.strategyId) : expandedTrade.strategyTag) || t('common.na')}</Typography>
                      <Typography variant="body2">{t('trades.form.strategyTag')}: {expandedTrade.strategyTag || t('common.na')}</Typography>
                      <Typography variant="body2">{t('trades.form.catalystTag')}: {expandedTrade.catalystTag || t('common.na')}</Typography>
                      <Typography variant="body2">{t('trades.form.setupGrade')}: {expandedTrade.setupGrade || t('common.na')}</Typography>
                      <Typography variant="body2">{t('trades.form.session')}: {expandedTrade.session ? t(`trades.form.sessions.${expandedTrade.session}`) : t('common.na')}</Typography>
                      <Typography variant="body2">{t('trades.form.linkedPlans')}: {(expandedTrade.linkedPlanIds || expandedTrade.linkedContentIds || []).length}</Typography>
                      <Typography variant="body2">{t('trades.form.capitalUsed')}: {formatCurrency(expandedTrade.capitalUsed, tradeCurrency)}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" gutterBottom>{t('trades.details.notesAndTags')}</Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>{t('trades.details.initialNotes')}:</strong> {expandedTrade.initialNotes || t('common.na')}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: expandedTrade.latestTradeNoteUpdatedAt ? 0.5 : 1 }}>
                        {getTradeNotesPreview(expandedTrade) || t('common.na')}
                      </Typography>
                      {expandedTrade.latestTradeNoteUpdatedAt && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          {t('trades.details.latestTradeNoteUpdated', { date: formatDateTime(expandedTrade.latestTradeNoteUpdatedAt, timezone) })}
                        </Typography>
                      )}
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {(expandedTrade.tags || []).map((tag: string) => (
                          <Chip key={tag} label={tag} size="small" color="info" variant="outlined" />
                        ))}
                        {(expandedTrade.ruleBreaks || []).map((rule) => (
                          <Chip key={rule} label={rule} size="small" color="warning" variant="outlined" />
                        ))}
                        {((expandedTrade.tags?.length || 0) + (expandedTrade.ruleBreaks?.length || 0)) === 0 && (
                          <Typography variant="body2" color="text.secondary">{t('trades.details.noTags')}</Typography>
                        )}
                      </Stack>
                    </Grid>
                  </Grid>
                )
              })()}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card className="interactive-lift">
        <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
          <Accordion defaultExpanded={!isSmallScreen} sx={{ boxShadow: 'none', bgcolor: 'transparent' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center">
                <FilterAltRoundedIcon fontSize="small" color="primary" />
                <Typography variant="subtitle1">{t('trades.filters.title')}</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField size="small" label={t('trades.filters.openedFrom')} type="datetime-local" value={filters.openedAtFrom} onChange={(e) => setFilters((prev) => ({ ...prev, openedAtFrom: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                    <TextField size="small" label={t('trades.filters.openedTo')} type="datetime-local" value={filters.openedAtTo} onChange={(e) => setFilters((prev) => ({ ...prev, openedAtTo: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField size="small" label={t('trades.filters.closedFrom')} type="datetime-local" value={filters.closedAtFrom} onChange={(e) => setFilters((prev) => ({ ...prev, closedAtFrom: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                    <TextField size="small" label={t('trades.filters.closedTo')} type="datetime-local" value={filters.closedAtTo} onChange={(e) => setFilters((prev) => ({ ...prev, closedAtTo: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField size="small" label={t('trades.filters.symbol')} value={filters.symbol} onChange={(e) => setFilters((prev) => ({ ...prev, symbol: e.target.value }))} fullWidth />
                    <AccountScopeSelector
                      value={accountScope.scope}
                      onChange={accountScope.setScope}
                      accounts={accountScope.accounts}
                      loading={accountScope.isLoading}
                      error={accountScope.isError}
                      onRetry={() => void accountScope.retry()}
                    />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                    <TextField size="small" label={t('trades.filters.direction')} select value={filters.direction} onChange={(e) => setFilters((prev) => ({ ...prev, direction: e.target.value }))} fullWidth>
                      <MenuItem value="">{t('trades.filters.any')}</MenuItem>
                      <MenuItem value="LONG">{t('trades.direction.LONG')}</MenuItem>
                      <MenuItem value="SHORT">{t('trades.direction.SHORT')}</MenuItem>
                    </TextField>
                    <TextField size="small" label={t('trades.filters.status')} select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} fullWidth>
                      <MenuItem value="">{t('trades.filters.any')}</MenuItem>
                      <MenuItem value="OPEN">{t('trades.status.OPEN')}</MenuItem>
                      <MenuItem value="CLOSED">{t('trades.status.CLOSED')}</MenuItem>
                    </TextField>
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Button variant="contained" onClick={onSearch} fullWidth={isSmallScreen}>{t('common.search')}</Button>
                    <Button variant="outlined" onClick={clearFilters} fullWidth={isSmallScreen}>{t('trades.filters.clear')}</Button>
                  </Stack>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>

      <Card className="interactive-lift">
        <CardContent sx={{ p: { xs: 1.75, md: 2 } }}>
          <Typography variant="h6" gutterBottom>{t('trades.help.title')}</Typography>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>{t('trades.help.sections.corePricing')}</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>{t('trades.help.corePricing.entryExit')}</strong>: {t('trades.help.corePricing.entryExitBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.corePricing.directionMarket')}</strong>: {t('trades.help.corePricing.directionMarketBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.corePricing.status')}</strong>: {t('trades.help.corePricing.statusBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.corePricing.capitalUsed')}</strong>: {t('trades.help.corePricing.capitalUsedBody')}</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>{t('trades.help.sections.pnlAndRisk')}</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.feesCosts')}</strong>: {t('trades.help.pnlAndRisk.feesCostsBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.pnlGross')}</strong>: {t('trades.help.pnlAndRisk.pnlGrossBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.pnlNet')}</strong>: {t('trades.help.pnlAndRisk.pnlNetBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.pnlPercent')}</strong>: {t('trades.help.pnlAndRisk.pnlPercentBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.riskAmountPercent')}</strong>: {t('trades.help.pnlAndRisk.riskAmountPercentBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.pnlAndRisk.rMultiple')}</strong>: {t('trades.help.pnlAndRisk.rMultipleBody')}</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>{t('trades.help.sections.context')}</AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>{t('trades.help.context.timeframe')}</strong>: {t('trades.help.context.timeframeBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.context.setupStrategyCatalyst')}</strong>: {t('trades.help.context.setupStrategyCatalystBody')}</Typography>
                <Typography variant="body2"><strong>{t('trades.help.context.statusDirection')}</strong>: {t('trades.help.context.statusDirectionBody')}</Typography>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>

      <Box
        sx={(theme) => ({
          position: 'fixed',
          left: 12,
          right: 12,
          bottom: 'calc(10px + env(safe-area-inset-bottom))',
          zIndex: theme.zIndex.appBar + 1,
          display: { xs: 'block', md: 'none' }
        })}
      >
        <Button fullWidth variant="contained" size="large" startIcon={<AddIcon />} onClick={openCreateDialog}>
          {t('trades.create.title')}
        </Button>
      </Box>

      {createDialogOpen && (
        <Dialog
          open={createDialogOpen}
          onClose={requestCloseCreateDialog}
          maxWidth="lg"
          fullWidth
          scroll="paper"
          aria-label={createDialogMode === 'quick' ? t('trades.quickLog.title') : t('trades.create.title')}
          sx={{
            '& .MuiDialog-container': {
              alignItems: { xs: 'center', sm: 'center' },
              justifyContent: 'center',
              p: 0
            }
          }}
          PaperProps={{
            sx: {
              m: isCreateDialogMobile ? 1 : isCreateDialogCompact ? 2 : 4,
              width: isCreateDialogCompact
                ? isCreateDialogMobile
                  ? 'calc(100vw - 16px)'
                  : 'calc(100vw - 32px)'
                : undefined,
              maxWidth: isCreateDialogCompact
                ? isCreateDialogMobile
                  ? 'calc(100vw - 16px)'
                  : 'calc(100vw - 32px)'
                : undefined,
              height: isCreateDialogMobile ? '92vh' : 'min(92dvh, 980px)',
              minHeight: isCreateDialogMobile ? '92vh' : 'min(92dvh, 980px)',
              maxHeight: isCreateDialogMobile ? '92vh' : 'min(92dvh, 980px)',
              borderRadius: 2,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              overflowX: 'hidden',
              '@supports (height: 100dvh)': {
                height: isCreateDialogMobile ? '92dvh' : 'min(92dvh, 980px)',
                minHeight: isCreateDialogMobile ? '92dvh' : 'min(92dvh, 980px)',
                maxHeight: isCreateDialogMobile ? '92dvh' : 'min(92dvh, 980px)'
              }
            }
          }}
        >
          <DialogContent
            data-testid="trade-create-dialog-content"
            sx={{
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            <TradeCreateFormV2
              initialValues={createFormValues}
              submitLabel={createDialogMode === 'quick' ? t('trades.quickLog.submit') : t('trades.create.save')}
              onSubmit={handleCreate}
              onCancel={requestCloseCreateDialog}
              onDirtyChange={setCreateFormDirty}
              onModeChange={setCreateDialogMode}
              error={createError}
              strategyOptions={strategyOptions}
              planOptions={planOptions}
              ruleBreakOptions={[...RULE_BREAK_OPTIONS]}
              baseCurrency={baseCurrency}
              timezone={timezone}
              defaultMode={createDialogMode}
              accounts={accountScope.accounts}
              accountsLoading={accountScope.isLoading}
              accountsError={accountScope.isError}
              onRetryAccounts={() => { void accountScope.retry() }}
              onAccountsChanged={() => accountScope.retry()}
            />
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={createDiscardDialogOpen} onClose={() => setCreateDiscardDialogOpen(false)}>
        <DialogTitle>{t('trades.form.discardChangesTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('trades.form.discardChangesPrompt')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDiscardDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={closeCreateDialog}>{t('trades.form.discardButton')}</Button>
        </DialogActions>
      </Dialog>

      {editDialogOpen && editTarget && (
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>{t('trades.actions.editTrade')}</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            <TradeForm
              initialValues={mapTradeToFormValues(editTarget, timezone)}
              submitLabel={t('trades.actions.updateTrade')}
              onSubmit={handleUpdateTrade}
              onCancel={() => setEditDialogOpen(false)}
              error={editError}
              computedValues={{
                pnlGross: editTarget.pnlGross,
                pnlNet: editTarget.pnlNet,
                pnlPercent: editTarget.pnlPercent,
                riskPercent: editTarget.riskPercent,
                rMultiple: editTarget.rMultiple,
              }}
              strategyOptions={strategyOptions}
              planOptions={planOptions}
              ruleBreakOptions={[...RULE_BREAK_OPTIONS]}
              timezone={timezone}
              accounts={accountScope.accounts}
              accountsLoading={accountScope.isLoading}
              accountsError={accountScope.isError}
              onRetryAccounts={() => { void accountScope.retry() }}
              onAccountsChanged={() => accountScope.retry()}
            />
          </DialogContent>
        </Dialog>
      )}

      <TradeScreenshotViewerDialog
        {...screenshotViewer}
        onClose={handleCloseScreenshotViewer}
      />

      <TradeImportDialog
        open={importDialogOpen}
        userTimezone={timezone}
        onClose={() => setImportDialogOpen(false)}
        onTradovate={handleTradovateImport}
        onCommitted={() => { void fetchTrades() }}
      />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('trades.actions.deleteTrade')}</DialogTitle>
        <DialogContent>
          <Typography>{t('trades.deleteConfirm', { symbol: deleteTarget?.symbol || '' })}</Typography>
          {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
