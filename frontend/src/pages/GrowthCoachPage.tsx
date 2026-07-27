import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Switch,
  useMediaQuery,
  useTheme
} from '@mui/material'
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded'
import { Link } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { useQuery } from '@tanstack/react-query'
import {
  createLedgerEvent,
  deleteLedgerEvent,
  fetchGrowthCoach,
  GrowthCoachDetail,
  GrowthCoachMessage,
  GrowthProfileRequest,
  LedgerEventRequest,
  MonthlyPlanRequest,
  GrowthPeriodPlan,
  GrowthPeriodType,
  PeriodPlanRequest,
  ReconcileBalanceRequest,
  reconcileAccountBalance,
  updatePeriodPlan,
  updateGrowthProfile,
  updateMonthlyPlan
} from '../api/growthCoach'
import { ApiError } from '../api/client'
import { useAccountScope } from '../features/accountScope/useAccountScope'
import { allAccountsScope, selectedAccountsScope } from '../features/accountScope/accountScope'
import { useI18n } from '../i18n'
import { translateApiError } from '../i18n/errorMessages'
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatSignedCurrency
} from '../utils/format'
import EmptyState from '../components/ui/EmptyState'
import ErrorBanner from '../components/ui/ErrorBanner'
import {
  GrowthProfileDialog,
  LedgerEventDialog,
  MonthlyPlanDialog,
  ManageAllPlansDialog,
  PeriodPlanDialog,
  ReconcileBalanceDialog
} from '../components/growthCoach/GrowthCoachDialogs'

const currentMonthKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const currentDateKey = () => new Date().toISOString().slice(0, 10)

const isoWeekValue = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00Z`)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const dateFromIsoWeek = (value: string) => {
  const match = value.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return currentDateKey()
  const year = Number(match[1])
  const week = Number(match[2])
  const januaryFourth = new Date(Date.UTC(year, 0, 4))
  const monday = new Date(januaryFourth)
  monday.setUTCDate(januaryFourth.getUTCDate() - (januaryFourth.getUTCDay() || 7) + 1 + (week - 1) * 7)
  return monday.toISOString().slice(0, 10)
}

const shiftAnchor = (value: string, period: GrowthPeriodType, direction: number) => {
  const next = new Date(`${value}T12:00:00`)
  if (period === 'MONTH') next.setMonth(next.getMonth() + direction)
  else next.setDate(next.getDate() + direction * (period === 'DAY' ? 1 : 7))
  return next.toISOString().slice(0, 10)
}

const sectionCardSx = { borderRadius: 3, overflow: 'hidden' }
const metricGrid = { xs: 12, sm: 6, md: 4, lg: 3 }
const permissionChipSx = {
  width: { xs: '100%', sm: 'auto' },
  height: 'auto',
  justifyContent: 'flex-start',
  '& .MuiChip-label': {
    display: 'block',
    py: 0.75,
    textAlign: 'left',
    whiteSpace: 'normal'
  }
}
const ledgerDebitTypes = new Set([
  'WITHDRAWAL', 'PAYOUT', 'COMMISSION', 'PLATFORM_FEE', 'DATA_FEE', 'RESET_FEE',
  'SWAP', 'TAX', 'PROFIT_SPLIT', 'PROP_FIRM_PAYOUT', 'PAYOUT_REQUEST',
  'BROKER_FEE', 'COMMISSION_ADJUSTMENT', 'FINANCING_ADJUSTMENT',
  'SWAP_ADJUSTMENT', 'TAX_DEDUCTION'
])

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
      <Box>
        <Typography variant="h6" fontWeight={800}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      </Box>
      {action}
    </Stack>
  )
}

function MetricCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'positive' | 'warning' }) {
  return (
    <Card variant="outlined" sx={{ height: '100%', borderRadius: 2.5 }}>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing=".06em">
          {label}
        </Typography>
        <Typography
          variant="h6"
          fontWeight={800}
          sx={{ mt: 0.5, color: tone === 'positive' ? 'success.main' : tone === 'warning' ? 'warning.main' : 'text.primary' }}
        >
          {value}
        </Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </CardContent>
    </Card>
  )
}

const severityColor = (severity: GrowthCoachMessage['severity']) => {
  if (severity === 'CRITICAL') return 'error'
  if (severity === 'WARNING' || severity === 'CAUTION') return 'warning'
  if (severity === 'POSITIVE') return 'success'
  return 'info'
}

export default function GrowthCoachPage() {
  const { t, locale } = useI18n()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const accountScope = useAccountScope()
  const selectedAccountId = accountScope.scope.mode === 'selected' && accountScope.scope.accountIds.length === 1
    ? accountScope.scope.accountIds[0]
    : undefined
  const [period, setPeriod] = useState<GrowthPeriodType>('MONTH')
  const [anchorDate, setAnchorDate] = useState(currentDateKey)
  const month = anchorDate.slice(0, 7) || currentMonthKey()
  const [profileOpen, setProfileOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [managePlansOpen, setManagePlansOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<GrowthPeriodPlan>()
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mutationError, setMutationError] = useState('')

  const coachQuery = useQuery({
    queryKey: ['growthCoach', selectedAccountId || 'all', month, period, anchorDate],
    queryFn: () => fetchGrowthCoach(selectedAccountId, month, period, anchorDate),
    enabled: !accountScope.isLoading
  })

  const detail = coachQuery.data?.detail
  const currency = detail?.account.currency || 'USD'
  const operatingSystem = detail?.operatingSystem
  const selectedPlan = operatingSystem
    ? period === 'DAY' ? operatingSystem.plans.day : period === 'WEEK'
      ? operatingSystem.plans.week : operatingSystem.plans.month
    : undefined
  const messageParams = (message: GrowthCoachMessage) => Object.fromEntries(
    Object.entries(message.params || {}).map(([key, value]) => {
      if (typeof value !== 'number') return [key, value]
      if (/amount|pnl|profit|buffer|riskamount/i.test(key)) return [key, formatCurrency(value, currency)]
      return [key, formatNumber(value)]
    })
  )

  const mutate = async (action: () => Promise<unknown>, close: () => void) => {
    setSaving(true)
    setMutationError('')
    try {
      await action()
      close()
      await coachQuery.refetch()
    } catch (error) {
      setMutationError(translateApiError(error as ApiError, t, 'growthCoach.errors.save'))
    } finally {
      setSaving(false)
    }
  }

  const handleProfileSave = (request: GrowthProfileRequest) =>
    mutate(() => updateGrowthProfile(detail!.account.id, request), () => setProfileOpen(false))
  const handlePlanSave = (request: PeriodPlanRequest) =>
    mutate(() => updatePeriodPlan(detail!.account.id, editingPlan!, request), () => {
      setPlanOpen(false)
      setEditingPlan(undefined)
    })
  const handleLedgerSave = (request: LedgerEventRequest) =>
    mutate(() => createLedgerEvent(detail!.account.id, request), () => setLedgerOpen(false))
  const handleReconcile = (request: ReconcileBalanceRequest) =>
    mutate(() => reconcileAccountBalance(detail!.account.id, request), () => setReconcileOpen(false))
  const periodInputType = period === 'MONTH' ? 'month' : period === 'WEEK' ? 'week' : 'date'
  const periodInputValue = period === 'MONTH' ? anchorDate.slice(0, 7)
    : period === 'WEEK' ? isoWeekValue(anchorDate) : anchorDate
  const selectedPeriodLabel = operatingSystem ? (() => {
    const start = new Date(operatingSystem.selectedPeriod.startsAt)
    const end = new Date(new Date(operatingSystem.selectedPeriod.endsAtExclusive).getTime() - 86_400_000)
    const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric',
      timeZone: operatingSystem.selectedPeriod.timezone })
    if (period === 'DAY') return day.format(start)
    if (period === 'MONTH') return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric',
      timeZone: operatingSystem.selectedPeriod.timezone }).format(start)
    const short = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long',
      timeZone: operatingSystem.selectedPeriod.timezone })
    return `${short.format(start)} – ${day.format(end)}`
  })() : anchorDate

  if (accountScope.isLoading || coachQuery.isLoading) {
    return <Stack spacing={2}>{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} variant="rounded" height={140} />)}</Stack>
  }
  if (accountScope.isError) {
    return <ErrorBanner message={t('accountScope.error')} />
  }
  if (coachQuery.isError) {
    return <ErrorBanner message={translateApiError(coachQuery.error as ApiError, t, 'growthCoach.errors.load')} />
  }

  return (
    <Stack spacing={{ xs: 2, md: 3 }} sx={{ minWidth: 0 }}>
      <Card sx={{ ...sectionCardSx, background: `linear-gradient(135deg, ${theme.palette.primary.main}18, ${theme.palette.background.paper})` }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex' }}>
                <AutoGraphRoundedIcon />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={900}>{t('growthCoach.title')}</Typography>
                <Typography variant="body2" color="text.secondary">{t('growthCoach.subtitle')}</Typography>
              </Box>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ width: { xs: '100%', md: 'auto' } }}>
              <Select
                size="small"
                aria-label={t('growthCoach.accountSelector')}
                value={selectedAccountId || 'all'}
                onChange={(event) => {
                  const value = String(event.target.value)
                  accountScope.setScope(value === 'all' ? allAccountsScope() : selectedAccountsScope([value]))
                }}
                sx={{ minWidth: { sm: 220 }, minHeight: 44 }}
              >
                <MenuItem value="all">{t('accountScope.all')}</MenuItem>
                {accountScope.accounts.filter((account) => account.status !== 'ARCHIVED').map((account) => (
                  <MenuItem key={account.id} value={account.id}>{account.name} · {account.currency}</MenuItem>
                ))}
              </Select>
              <Stack spacing={1} sx={{ minWidth: 0 }}>
                <ToggleButtonGroup
                  exclusive size="small" fullWidth value={period}
                  aria-label={t('growthCoach.periodSelector')}
                  role="tablist"
                  onChange={(_, value: GrowthPeriodType | null) => value && setPeriod(value)}
                  sx={{ '& .MuiToggleButton-root': { minHeight: 44, px: { xs: 1, sm: 2 },
                    borderWidth: 2, '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText',
                      borderColor: 'primary.dark', '&:hover': { bgcolor: 'primary.dark' } } } }}
                >
                  {(['DAY', 'WEEK', 'MONTH'] as GrowthPeriodType[]).map((value) => (
                    <ToggleButton key={value} value={value} role="tab" aria-selected={period === value}>
                      {t(`growthCoach.periods.${value}`)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <Typography fontWeight={800} textAlign="center" aria-live="polite">{selectedPeriodLabel}</Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <IconButton aria-label={t('growthCoach.previousPeriod')} onClick={() => setAnchorDate(shiftAnchor(anchorDate, period, -1))}
                    sx={{ minWidth: 44, minHeight: 44 }}><ChevronLeftRoundedIcon /></IconButton>
                  <TextField
                    fullWidth size="small" type={periodInputType} value={periodInputValue}
                    aria-label={t('growthCoach.dateSelector')}
                    onChange={(event) => setAnchorDate(period === 'MONTH'
                      ? `${event.target.value}-01`
                      : period === 'WEEK' ? dateFromIsoWeek(event.target.value) : event.target.value)}
                    inputProps={{ 'aria-label': t('growthCoach.dateSelector') }}
                    sx={{ minWidth: 145, '& .MuiInputBase-root': { minHeight: 44 } }}
                  />
                  <IconButton aria-label={t('growthCoach.nextPeriod')} onClick={() => setAnchorDate(shiftAnchor(anchorDate, period, 1))}
                    sx={{ minWidth: 44, minHeight: 44 }}><ChevronRightRoundedIcon /></IconButton>
                </Stack>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {mutationError && <Alert severity="error" onClose={() => setMutationError('')}>{mutationError}</Alert>}

      {!selectedAccountId || coachQuery.data?.mode === 'PORTFOLIO' ? (
        <PortfolioOverview
          accounts={coachQuery.data?.portfolioAccounts || []}
          onSelect={(id) => accountScope.setScope(selectedAccountsScope([id]))}
        />
      ) : detail ? (
        <>
          <AccountHeader detail={detail} period={period} onEditProfile={() => setProfileOpen(true)}
            onEditPlan={() => {
              if (selectedPlan) setEditingPlan(selectedPlan)
              setPlanOpen(true)
            }} onManagePlans={() => setManagePlansOpen(true)} />
          {operatingSystem ? (
            <>
              <TradingPermissionPanel detail={detail} />
              <SelectedPeriodScorecard detail={detail} />
              <OperatingProgressChart detail={detail} />
              <TodayTradingActivity detail={detail} />
            </>
          ) : (
            <>
              <MonthlyOverview detail={detail} />
              <ProgressChart detail={detail} />
            </>
          )}
          <ActiveExposure detail={detail} isMobile={isMobile} />
          {operatingSystem && <PeriodComparison detail={detail} isMobile={isMobile} />}
          <LiveCoach detail={detail} messageParams={messageParams} />
          {operatingSystem && <PlanAdherenceAndHistory detail={detail} />}
          <Accordion disableGutters sx={sectionCardSx}>
            <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ minHeight: 56 }}>
              <Typography variant="h6" fontWeight={800}>{t('growthCoach.advanced.title')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={{ xs: 2, md: 3 }}>
                <RecommendedPlan detail={detail} />
                <ScenarioComparison detail={detail} />
                <PerformanceDrivers detail={detail} />
                <DataQuality detail={detail} />
                {operatingSystem && <MetricConfidence detail={detail} />}
                <Ledger detail={detail} onAdd={() => setLedgerOpen(true)} onReconcile={() => setReconcileOpen(true)} onDelete={async (eventId) => {
                  if (!window.confirm(t('growthCoach.ledger.confirmDelete'))) return
                  await mutate(() => deleteLedgerEvent(detail.account.id, eventId), () => {})
                }} />
              </Stack>
            </AccordionDetails>
          </Accordion>
          <Alert severity="info" icon={<ShieldOutlinedIcon />}>{t(detail.disclaimer)}</Alert>

          <GrowthProfileDialog
            open={profileOpen} profile={detail.profile} currency={currency} saving={saving}
            onClose={() => setProfileOpen(false)} onSave={handleProfileSave}
          />
          {editingPlan ? (
            <PeriodPlanDialog open={planOpen} plan={editingPlan}
              allocationPlans={editingPlan.periodType === 'MONTH' && operatingSystem
                ? operatingSystem.plans
                : undefined}
              saving={saving}
              onClose={() => {
                setPlanOpen(false)
                setEditingPlan(undefined)
              }} onSave={handlePlanSave} />
          ) : (
            <MonthlyPlanDialog
              open={planOpen} plan={detail.monthlyPlan} saving={saving}
              onClose={() => setPlanOpen(false)} onSave={(request: MonthlyPlanRequest) =>
                mutate(() => updateMonthlyPlan(detail.account.id, month, request), () => setPlanOpen(false))}
            />
          )}
          {operatingSystem && (
            <ManageAllPlansDialog open={managePlansOpen} plans={operatingSystem.plans}
              onClose={() => setManagePlansOpen(false)}
              onEdit={(plan) => {
                setManagePlansOpen(false)
                setEditingPlan(plan)
                setPlanOpen(true)
              }} />
          )}
          <LedgerEventDialog
            open={ledgerOpen} currency={currency} saving={saving}
            onClose={() => setLedgerOpen(false)} onSave={handleLedgerSave}
          />
          <ReconcileBalanceDialog
            open={reconcileOpen} currency={currency} timezone={detail.account.timezone}
            systemBalance={detail.capital.currentRealisedBalance} saving={saving}
            onClose={() => setReconcileOpen(false)} onSave={handleReconcile}
          />
        </>
      ) : null}
    </Stack>
  )
}

function PortfolioOverview({ accounts, onSelect }: {
  accounts: NonNullable<Awaited<ReturnType<typeof fetchGrowthCoach>>['portfolioAccounts']>
  onSelect: (id: string) => void
}) {
  const { t } = useI18n()
  if (!accounts.length) {
    return <EmptyState title={t('growthCoach.portfolio.emptyTitle')} description={t('growthCoach.portfolio.emptyBody')} />
  }
  return (
    <Stack spacing={2}>
      <Alert severity="info">{t('growthCoach.portfolio.selectAccount')}</Alert>
      <SectionTitle title={t('growthCoach.portfolio.title')} subtitle={t('growthCoach.portfolio.subtitle')} />
      <Grid container spacing={2}>
        {accounts.map((account) => (
          <Grid item xs={12} md={6} xl={4} key={account.accountId}>
            <Card variant="outlined" sx={{ height: '100%', borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" fontWeight={800}>{account.accountName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(`growthCoach.accountTypes.${account.accountType}`)} · {account.currency}
                      </Typography>
                    </Box>
                    <Chip size="small" label={t(`growthCoach.riskStates.${account.riskState}`)} />
                  </Stack>
                  <Grid container spacing={1.5}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">{t('growthCoach.metrics.realisedBalance')}</Typography>
                      <Typography fontWeight={700}>{formatCurrency(account.realisedBalance, account.currency)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">{t('growthCoach.metrics.currentEquity')}</Typography>
                      <Typography fontWeight={700}>{formatCurrency(account.currentEquity, account.currency)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">{t('growthCoach.metrics.monthlyRealised')}</Typography>
                      <Typography fontWeight={700}>{formatSignedCurrency(account.currentMonthRealisedPnl, account.currency)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">{t('growthCoach.metrics.openTrades')}</Typography>
                      <Typography fontWeight={700}>{account.openTradeCount ?? '—'}</Typography>
                    </Grid>
                  </Grid>
                  <Button variant="outlined" onClick={() => onSelect(account.accountId)}>{t('growthCoach.portfolio.openPlan')}</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  )
}

function AccountHeader({ detail, period, onEditProfile, onEditPlan, onManagePlans }: {
  detail: GrowthCoachDetail
  period: GrowthPeriodType
  onEditProfile: () => void
  onEditPlan: () => void
  onManagePlans: () => void
}) {
  const { t } = useI18n()
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Chip color="primary" label={t(`growthCoach.accountTypes.${detail.profile.accountType}`)} />
        <Chip variant="outlined" label={`${t('growthCoach.confidence.label')}: ${t(`growthCoach.confidence.levels.${detail.confidence.level}`)} · ${detail.confidence.score}/100`} />
        <Chip variant="outlined" label={detail.account.timezone} />
        {detail.monthlyPlan.snapshotSource === 'RECONSTRUCTED' && (
          <Chip color="warning" variant="outlined" label={t('growthCoach.snapshot.reconstructed')} />
        )}
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
        <Button startIcon={<EditRoundedIcon />} variant="outlined" onClick={onEditProfile}>{t('growthCoach.profile.edit')}</Button>
        <Button variant="outlined" onClick={onManagePlans}>{t('growthCoach.plan.manageAll')}</Button>
        <Button startIcon={<EditRoundedIcon />} variant="contained" onClick={onEditPlan}>
          {t(`growthCoach.plan.editByPeriod.${period}`)}
        </Button>
      </Stack>
    </Stack>
  )
}

function MonthlyOverview({ detail }: { detail: GrowthCoachDetail }) {
  const { t } = useI18n()
  const { capital, target, monthlyPlan, account } = detail
  return (
    <Stack spacing={2}>
      <SectionTitle title={t('growthCoach.overview.title')} subtitle={t('growthCoach.overview.subtitle')} />
      <Grid container spacing={2}>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.monthStartBalance')} value={formatCurrency(monthlyPlan.monthStartBalance, account.currency)} hint={t(`growthCoach.snapshot.sources.${monthlyPlan.snapshotSource}`)} /></Grid>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.realisedBalance')} value={formatCurrency(capital.currentRealisedBalance, account.currency)} /></Grid>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.currentEquity')} value={formatCurrency(capital.currentEquity, account.currency)} hint={!capital.floatingPnlAvailable ? t('growthCoach.metrics.equityUnavailable') : undefined} /></Grid>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.monthlyTarget')} value={formatCurrency(target.targetAmount, account.currency)} hint={monthlyPlan.targetPct != null ? formatPercent(monthlyPlan.targetPct) : undefined} /></Grid>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.monthlyRealised')} value={formatSignedCurrency(target.realisedCurrentMonthPnl, account.currency)} tone={target.realisedCurrentMonthPnl >= 0 ? 'positive' : 'warning'} /></Grid>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.floatingPnl')} value={formatSignedCurrency(target.floatingPnl, account.currency)} hint={t('growthCoach.metrics.notRealised')} /></Grid>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.remainingTarget')} value={formatCurrency(target.remainingTargetAmount, account.currency)} /></Grid>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.tradingDaysRemaining')} value={formatNumber(target.tradingDaysRemaining, 0)} /></Grid>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.dailyLossRemaining')} value={formatCurrency(capital.dailyLossRemaining, account.currency)} /></Grid>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.drawdownBuffer')} value={formatCurrency(capital.drawdownBuffer, account.currency)} /></Grid>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.withdrawableProfit')} value={formatCurrency(capital.withdrawableProfit, account.currency)} /></Grid>
        <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.profitAfterSplit')} value={formatCurrency(capital.profitAfterSplit, account.currency)} /></Grid>
      </Grid>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography fontWeight={700}>{t('growthCoach.progress.realised')}</Typography>
                  <Typography fontWeight={800}>{formatPercent(target.realisedProgressPct)}</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, target.realisedProgressPct))} sx={{ height: 10, borderRadius: 99 }} />
                <Typography variant="caption" color="text.secondary">{t('growthCoach.progress.realisedHint')}</Typography>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography fontWeight={700}>{t('growthCoach.progress.equityAdjusted')}</Typography>
                  <Typography fontWeight={800}>{formatPercent(target.equityAdjustedProgressPct)}</Typography>
                </Stack>
                <LinearProgress color="secondary" variant="determinate" value={Math.max(0, Math.min(100, target.equityAdjustedProgressPct || 0))} sx={{ height: 10, borderRadius: 99 }} />
                <Typography variant="caption" color="text.secondary">{t('growthCoach.progress.equityHint')}</Typography>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Stack>
  )
}

function TradingPermissionPanel({ detail }: { detail: GrowthCoachDetail }) {
  const { t } = useI18n()
  const permission = detail.operatingSystem!.tradingPermission
  const severity = permission.state.includes('LOCKOUT') || permission.state.includes('BREACHED')
    ? 'error' : permission.state === 'REDUCED_RISK_ONLY' || permission.state === 'MONTHLY_PROTECTION_MODE'
      ? 'warning' : permission.state === 'INSUFFICIENT_DATA' ? 'info' : 'success'
  return (
    <Alert severity={severity} variant="filled" icon={<ShieldOutlinedIcon />}
      sx={{ borderRadius: 3, alignItems: 'flex-start', '& .MuiAlert-message': { width: '100%', minWidth: 0 } }}>
      <Stack spacing={1}>
        <Typography variant="h6" fontWeight={900}>{t(`growthCoach.permission.states.${permission.state}`)}</Typography>
        <Typography>{t(permission.primaryReason)}</Typography>
        {permission.secondaryReasons.map((reason) => <Typography key={reason} variant="body2">{t(reason)}</Typography>)}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          spacing={1}
          flexWrap="wrap"
        >
          <Chip color="default" sx={permissionChipSx} label={`${t('growthCoach.permission.riskAllowedNow')}: ${
            formatCurrency(permission.maximumPermittedRisk, detail.account.currency)
          }`} />
          <Chip color="default" sx={permissionChipSx} label={`${t('growthCoach.permission.riskWhenResumes')}: ${
            formatPercent(permission.recommendedRiskWhenTradingResumesPct)
          } · ${formatCurrency(permission.recommendedRiskWhenTradingResumes, detail.account.currency)}`} />
          <Chip color="default" sx={permissionChipSx} label={`${t('growthCoach.permission.theoreticalMaximum')}: ${
            formatPercent(permission.theoreticalMaximumRiskPct)
          } · ${formatCurrency(permission.theoreticalMaximumRisk, detail.account.currency)}`} />
          <Chip color="default" sx={permissionChipSx} label={`${t('growthCoach.permission.remainingTrades')}: ${
            permission.remainingTrades ?? '—'
          }`} />
          <Chip color="default" sx={permissionChipSx} label={`${t('growthCoach.permission.limit')}: ${
            t(`growthCoach.periods.${permission.applicableLimit}`)
          }`} />
        </Stack>
        <Typography fontWeight={700}>{t(permission.recommendedAction)}</Typography>
      </Stack>
    </Alert>
  )
}

function SelectedPeriodScorecard({ detail }: { detail: GrowthCoachDetail }) {
  const { t } = useI18n()
  const os = detail.operatingSystem!
  const summary = os.selectedSummary
  const targetCompletion = Math.max(0, summary.targetProgressPct || 0)
  const lossUtilisation = Math.max(0, summary.lossLimitUtilisationPct || 0)
  const distanceLabel = summary.targetExceededAmount > 0 ? 'amountAboveTarget' : 'distanceToTarget'
  const distanceValue = summary.targetExceededAmount > 0 ? summary.targetExceededAmount : summary.distanceToTarget
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
      <SectionTitle title={t('growthCoach.scorecard.title', {
        period: t(`growthCoach.periods.${os.selectedPeriod.periodType}`)
      })} subtitle={`${os.selectedPeriod.periodKey} · ${os.selectedPeriod.timezone}`} />
        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          <Grid item xs={6} md={3}><MetricCard label={t('growthCoach.scorecard.metrics.currentResult')}
            value={formatSignedCurrency(summary.realisedTradingPnl, detail.account.currency)}
            tone={summary.realisedTradingPnl >= 0 ? 'positive' : 'warning'} /></Grid>
          <Grid item xs={6} md={3}><MetricCard label={t('growthCoach.scorecard.metrics.target')}
            value={formatCurrency(summary.targetAmount, detail.account.currency)} /></Grid>
          <Grid item xs={6} md={3}><MetricCard label={t(`growthCoach.scorecard.metrics.${distanceLabel}`)}
            value={formatCurrency(distanceValue, detail.account.currency)} /></Grid>
          <Grid item xs={6} md={3}><MetricCard label={t('growthCoach.scorecard.metrics.lossRemaining')}
            value={formatCurrency(summary.lossAllowanceRemaining, detail.account.currency)} /></Grid>
          {summary.distanceToBreakeven > 0 && (
            <Grid item xs={12} sm={6}><MetricCard label={t('growthCoach.scorecard.metrics.distanceToBreakeven')}
              value={formatCurrency(summary.distanceToBreakeven, detail.account.currency)} /></Grid>
          )}
        </Grid>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={6}>
            <Stack spacing={0.75}>
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={700}>{t('growthCoach.scorecard.targetAchieved')}</Typography>
                <Typography>{formatPercent(targetCompletion)}</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={Math.min(100, targetCompletion)}
                aria-label={t('growthCoach.scorecard.targetAchieved')} sx={{ height: 10, borderRadius: 5 }} />
              <Typography variant="caption" color="text.secondary">
                {t('growthCoach.scorecard.targetSummary', {
                  achieved: formatCurrency(Math.max(0, summary.realisedTradingPnl), detail.account.currency),
                  target: formatCurrency(summary.targetAmount, detail.account.currency)
                })}
              </Typography>
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack spacing={0.75}>
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={700}>{t('growthCoach.scorecard.lossUtilisation')}</Typography>
                <Typography>{formatPercent(lossUtilisation)}</Typography>
              </Stack>
              <LinearProgress color="warning" variant="determinate" value={Math.min(100, lossUtilisation)}
                aria-label={t('growthCoach.scorecard.lossUtilisation')} sx={{ height: 10, borderRadius: 5 }} />
              <Typography variant="caption" color="text.secondary">
                {t('growthCoach.scorecard.lossSummary', {
                  used: formatCurrency(summary.distanceToBreakeven, detail.account.currency),
                  remaining: formatCurrency(summary.lossAllowanceRemaining, detail.account.currency)
                })}
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      <Alert severity="info" sx={{ mt: 2 }}>{t('growthCoach.scorecard.separation', {
        trading: formatSignedCurrency(summary.realisedTradingPnl, detail.account.currency),
        ledger: formatSignedCurrency(summary.netLedgerMovement, detail.account.currency),
        change: formatSignedCurrency(summary.netAccountChange, detail.account.currency)
      })}</Alert>
      </CardContent>
    </Card>
  )
}

function OperatingProgressChart({ detail }: { detail: GrowthCoachDetail }) {
  const { t, locale } = useI18n()
  const os = detail.operatingSystem!
  const selectedPlan = os.selectedPeriod.periodType === 'DAY' ? os.plans.day
    : os.selectedPeriod.periodType === 'WEEK' ? os.plans.week : os.plans.month
  const [chartMode, setChartMode] = useState<'SIMPLE' | 'ADVANCED'>('SIMPLE')
  const [showBalance, setShowBalance] = useState(false)
  const [showEquity, setShowEquity] = useState(false)
  const [showRisk, setShowRisk] = useState(false)
  const [dailyMode, setDailyMode] = useState(false)
  const [valueMode, setValueMode] = useState<'CURRENCY' | 'PERCENTAGE' | 'R'>('CURRENCY')
  const baseline = os.selectedSummary.periodStartBalance || 0
  const riskUnit = os.tradingPermission.recommendedRiskWhenTradingResumes || 0
  const convert = (value?: number | null, rValue?: number | null) => {
    if (valueMode === 'R') return rValue ?? (riskUnit > 0 && value != null ? value / riskUnit : 0)
    if (valueMode === 'PERCENTAGE') return baseline > 0 && value != null ? value * 100 / baseline : 0
    return value ?? 0
  }
  let runningPnl = 0
  let runningR = 0
  const dayTradeSeries = os.todayActivity.closedTrades.map((trade, index) => {
    runningPnl += trade.pnl
    runningR += trade.realisedR || 0
    return {
      date: trade.closedAt,
      cumulativeTradingPnl: runningPnl,
      dailyTradingPnl: trade.pnl,
      cumulativeR: runningR,
      dailyR: trade.realisedR || 0,
      realisedBalance: baseline + runningPnl,
      equity: undefined,
      plannedProgress: selectedPlan.targetAmount || 0,
      target: selectedPlan.targetAmount || 0,
      maximumLoss: selectedPlan.maxLossAmount == null ? undefined : -Math.abs(selectedPlan.maxLossAmount),
      cumulativeRisk: os.todayActivity.closedTrades.slice(0, index + 1)
        .reduce((sum, item) => sum + (item.initialRisk || 0), 0),
      tradeNumber: index + 1,
      symbol: trade.symbol,
      direction: trade.direction,
      realisedR: trade.realisedR,
      strategy: trade.strategy,
      setup: trade.setup,
      session: trade.session
    }
  })
  const sourceSeries = os.selectedPeriod.periodType === 'DAY' && dayTradeSeries.length > 0
    ? dayTradeSeries : os.chartSeries.map((point) => ({
      ...point,
      tradeNumber: undefined,
      symbol: undefined,
      direction: undefined,
      realisedR: undefined,
      strategy: undefined,
      setup: undefined,
      session: undefined
    }))
  const series = sourceSeries.map((point) => ({
    ...point,
    displayCumulative: convert(point.cumulativeTradingPnl, point.cumulativeR),
    displayDaily: convert(point.dailyTradingPnl, point.dailyR),
    displayBalance: valueMode === 'CURRENCY' ? point.realisedBalance : convert((point.realisedBalance || 0) - baseline),
    displayEquity: valueMode === 'CURRENCY' ? point.equity : convert((point.equity || 0) - baseline),
    displayPlan: convert(point.plannedProgress),
    displayRisk: convert(point.cumulativeRisk)
  }))
  const markerSeries = os.chartMarkers.map((marker) => ({
    date: marker.timestamp,
    markerValue: convert(marker.amount),
    markerType: marker.type,
    label: marker.label
  }))
  const formatChartValue = (value: number) => valueMode === 'CURRENCY'
    ? formatCurrency(value, detail.account.currency)
    : valueMode === 'PERCENTAGE' ? formatPercent(value) : `${formatNumber(value)}R`
  const xAxisLabel = (value: string) => {
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
    if (os.selectedPeriod.periodType === 'DAY') {
      return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit',
        timeZone: os.selectedPeriod.timezone }).format(date)
    }
    return new Intl.DateTimeFormat(locale, os.selectedPeriod.periodType === 'WEEK'
      ? { weekday: 'short', timeZone: os.selectedPeriod.timezone }
      : { day: 'numeric', month: 'short', timeZone: os.selectedPeriod.timezone }).format(date)
  }
  const tooltip = ({ active, payload }: {
    active?: boolean
    payload?: Array<{ payload: (typeof series)[number] }>
  }) => {
    if (!active || !payload?.length) return null
    const point = payload[0].payload
    return (
      <Card variant="outlined" sx={{ maxWidth: 280 }}>
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography fontWeight={800}>{point.tradeNumber
            ? t('growthCoach.operatingChart.tooltip.trade', { number: point.tradeNumber, time: xAxisLabel(point.date) })
            : xAxisLabel(point.date)}</Typography>
          {point.tradeNumber && <Typography variant="body2">{point.symbol} · {point.direction}</Typography>}
          <Typography variant="body2">{t('growthCoach.operatingChart.tooltip.periodPnl')}: {formatChartValue(point.displayDaily)}</Typography>
          <Typography variant="body2">{t('growthCoach.operatingChart.tooltip.cumulativePnl')}: {formatChartValue(point.displayCumulative)}</Typography>
          <Typography variant="body2">{t('growthCoach.operatingChart.tooltip.target')}: {formatChartValue(convert(point.target))}</Typography>
          <Typography variant="body2">{t('growthCoach.operatingChart.tooltip.lossLimit')}: {formatChartValue(convert(point.maximumLoss))}</Typography>
          {point.tradeNumber && (
            <>
              <Typography variant="body2">{t('growthCoach.operatingChart.tooltip.realisedR')}: {point.realisedR == null ? '—' : `${formatNumber(point.realisedR)}R`}</Typography>
              <Typography variant="body2">{t('growthCoach.operatingChart.tooltip.strategy')}: {point.strategy || '—'}</Typography>
              <Typography variant="body2">{t('growthCoach.operatingChart.tooltip.setup')}: {point.setup || '—'}</Typography>
              <Typography variant="body2">{t('growthCoach.operatingChart.tooltip.session')}: {point.session || '—'}</Typography>
            </>
          )}
        </CardContent>
      </Card>
    )
  }
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0 }}>
        <SectionTitle title={t('growthCoach.operatingChart.title')}
          subtitle={t(`growthCoach.operatingChart.explanation.${os.selectedPeriod.periodType}`)} />
        <ToggleButtonGroup exclusive fullWidth value={chartMode} sx={{ mt: 2 }}
          aria-label={t('growthCoach.operatingChart.chartMode')}
          onChange={(_, value) => value && setChartMode(value)}>
          <ToggleButton value="SIMPLE" sx={{ minHeight: 44 }}>{t('growthCoach.operatingChart.simple')}</ToggleButton>
          <ToggleButton value="ADVANCED" sx={{ minHeight: 44 }}>{t('growthCoach.operatingChart.advanced')}</ToggleButton>
        </ToggleButtonGroup>
        {chartMode === 'ADVANCED' && <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
          <ToggleButtonGroup exclusive size="small" value={valueMode}
            aria-label={t('growthCoach.operatingChart.valueMode')}
            onChange={(_, value) => value && setValueMode(value)}>
            {(['CURRENCY', 'PERCENTAGE', 'R'] as const).map((mode) => (
              <ToggleButton key={mode} value={mode} sx={{ minWidth: 44, minHeight: 44 }}>
                {t(`growthCoach.operatingChart.modes.${mode}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <FormControlLabel control={<Switch size="small" checked={dailyMode} onChange={(_, value) => setDailyMode(value)} />}
            label={t('growthCoach.operatingChart.dailyMode')} />
          <FormControlLabel control={<Switch size="small" checked={showBalance} onChange={(_, value) => setShowBalance(value)} />}
            label={t('growthCoach.operatingChart.balance')} />
          <FormControlLabel control={<Switch size="small" checked={showEquity} onChange={(_, value) => setShowEquity(value)} />}
            label={t('growthCoach.operatingChart.equity')} />
          <FormControlLabel control={<Switch size="small" checked={showRisk} onChange={(_, value) => setShowRisk(value)} />}
            label={t('growthCoach.operatingChart.risk')} />
        </Stack>}
        <Box sx={{ width: '100%', height: { xs: 290, md: 380 }, mt: 1, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 12, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" minTickGap={os.selectedPeriod.periodType === 'MONTH' ? 34 : 18}
                tickFormatter={xAxisLabel} tick={{ fontSize: 11 }} />
              <YAxis width={64} tick={{ fontSize: 11 }} />
              <ChartTooltip content={tooltip} />
              {chartMode === 'ADVANCED' && dailyMode && <Bar dataKey="displayDaily" fill="#64748b" name={t('growthCoach.operatingChart.dailyPnl')} />}
              <Line type="monotone" dataKey="displayCumulative" stroke="#16a34a" strokeWidth={2.5}
                dot={os.selectedPeriod.periodType === 'DAY'} name={t('growthCoach.operatingChart.tradingPnl')} />
              {chartMode === 'ADVANCED' && <Line type="monotone" dataKey="displayPlan" stroke="#7c8aa5" strokeDasharray="5 5"
                dot={false} name={t('growthCoach.operatingChart.plan')} />}
              {chartMode === 'ADVANCED' && showBalance && <Line type="monotone" dataKey="displayBalance" stroke="#8b5cf6" dot={false}
                name={t('growthCoach.operatingChart.balance')} />}
              {chartMode === 'ADVANCED' && showEquity && <Line type="monotone" dataKey="displayEquity" stroke="#0ea5e9" dot={false}
                name={t('growthCoach.operatingChart.equity')} />}
              {chartMode === 'ADVANCED' && showRisk && <Line type="monotone" dataKey="displayRisk" stroke="#f59e0b" dot={false}
                name={t('growthCoach.operatingChart.risk')} />}
              {chartMode === 'ADVANCED' && <Scatter data={markerSeries} dataKey="markerValue" fill="#ef4444"
                name={t('growthCoach.operatingChart.events')} />}
              <ReferenceLine y={0} stroke="#64748b" />
              <ReferenceLine y={convert(os.selectedSummary.targetAmount)} stroke="#16a34a" strokeDasharray="4 4"
                label={{ value: t('growthCoach.operatingChart.targetLine'), fill: '#16a34a', fontSize: 11 }} />
              {selectedPlan.maxLossAmount != null && (
                <ReferenceLine y={-Math.abs(convert(selectedPlan.maxLossAmount))} stroke="#dc2626" strokeDasharray="4 4"
                  label={{ value: t('growthCoach.operatingChart.lossLine'), fill: '#dc2626', fontSize: 11 }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('growthCoach.operatingChart.accessibleSummary', {
            pnl: formatSignedCurrency(os.selectedSummary.realisedTradingPnl, detail.account.currency),
            target: formatCurrency(os.selectedSummary.targetAmount, detail.account.currency),
            markers: os.chartMarkers.length
          })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('growthCoach.operatingChart.mobileSummary', {
            result: formatSignedCurrency(os.selectedSummary.realisedTradingPnl, detail.account.currency),
            target: formatCurrency(os.selectedSummary.targetAmount, detail.account.currency),
            loss: formatCurrency(selectedPlan.maxLossAmount, detail.account.currency)
          })}
        </Typography>
      </CardContent>
    </Card>
  )
}

function TodayTradingActivity({ detail }: { detail: GrowthCoachDetail }) {
  const { t } = useI18n()
  const activity = detail.operatingSystem!.todayActivity
  const summary = activity.summary
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <SectionTitle title={t('growthCoach.todayActivity.title')} subtitle={t('growthCoach.todayActivity.subtitle')}
          action={<Button component={Link} to="/trades" variant="outlined">{t('growthCoach.todayActivity.review')}</Button>} />
        <Grid container spacing={1.5} sx={{ my: 0.5 }}>
          {[
            ['closedTrades', summary.completedTrades],
            ['openTrades', activity.currentlyOpenTrades],
            ['realisedPnl', formatSignedCurrency(summary.realisedTradingPnl, detail.account.currency)],
            ['realisedR', `${formatNumber(summary.realisedR)}R`],
            ['winRate', formatPercent(summary.winRate)],
            ['grossProfit', formatCurrency(summary.grossProfit, detail.account.currency)],
            ['grossLoss', formatSignedCurrency(summary.grossLoss, detail.account.currency)],
            ['averageTrade', formatSignedCurrency(summary.averageTrade, detail.account.currency)],
            ['lossStreak', summary.currentConsecutiveLosses],
            ['riskUsed', formatCurrency(summary.riskUsed, detail.account.currency)],
            ['riskRemaining', formatCurrency(summary.riskRemaining, detail.account.currency)],
            ['tradesRemaining', summary.tradesRemaining ?? '—']
          ].map(([key, value]) => (
            <Grid item xs={6} sm={4} md={3} key={key}>
              <MetricCard label={t(`growthCoach.todayActivity.metrics.${key}`)} value={String(value)} />
            </Grid>
          ))}
        </Grid>
        {activity.closedTrades.length === 0 ? (
          <Typography variant="body2" color="text.secondary">{t('growthCoach.todayActivity.empty')}</Typography>
        ) : (
          <Stack spacing={1} sx={{ mt: 2 }}>
            {activity.closedTrades.map((trade) => (
              <Card variant="outlined" key={trade.tradeId}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                    <Box>
                      <Typography fontWeight={800}>{trade.symbol} · {trade.direction}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(trade.closedAt, detail.account.timezone)} · {trade.strategy || '—'} · {trade.setup || '—'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography fontWeight={800} color={trade.pnl >= 0 ? 'success.main' : 'error.main'}>
                        {formatSignedCurrency(trade.pnl, detail.account.currency)}
                      </Typography>
                      <Chip size="small" label={trade.realisedR == null ? 'R —' : `${formatNumber(trade.realisedR)}R`} />
                      <IconButton component={Link} to={`/trades?tradeId=${trade.tradeId}`}
                        aria-label={t('growthCoach.exposure.editTrade')} sx={{ minWidth: 44, minHeight: 44 }}>
                        <OpenInNewRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

function PeriodComparison({ detail, isMobile }: { detail: GrowthCoachDetail; isMobile: boolean }) {
  const { t } = useI18n()
  const comparisons = detail.operatingSystem!.periodComparisons
  if (isMobile) {
    return (
      <Stack spacing={2}>
        <SectionTitle title={t('growthCoach.comparison.title')} subtitle={t('growthCoach.comparison.subtitle')} />
        {comparisons.map((item) => (
          <Card variant="outlined" key={item.periodType} sx={sectionCardSx}>
            <CardContent>
              <Typography variant="h6" fontWeight={800}>{t(`growthCoach.periods.${item.periodType}`)}</Typography>
              <Grid container spacing={1.5} sx={{ mt: 0.25 }}>
                <Grid item xs={6}><MetricCard label={t('growthCoach.comparison.pnl')}
                  value={formatSignedCurrency(item.realisedPnl, detail.account.currency)} /></Grid>
                <Grid item xs={6}><MetricCard label={t('growthCoach.comparison.progress')}
                  value={formatPercent(item.targetProgress)} /></Grid>
                <Grid item xs={6}><MetricCard label={t('growthCoach.comparison.target')}
                  value={formatCurrency(item.target, detail.account.currency)} /></Grid>
                <Grid item xs={6}><MetricCard label={t('growthCoach.comparison.trades')}
                  value={formatNumber(item.trades, 0)} /></Grid>
                <Grid item xs={6}><MetricCard label={t('growthCoach.comparison.winRate')}
                  value={formatPercent(item.winRate)} /></Grid>
                <Grid item xs={6}><MetricCard label={t('growthCoach.comparison.riskUsed')}
                  value={formatCurrency(item.riskUsed, detail.account.currency)} /></Grid>
                <Grid item xs={6}><MetricCard label={t('growthCoach.comparison.drawdown')}
                  value={formatCurrency(item.drawdown, detail.account.currency)} /></Grid>
                <Grid item xs={6}><MetricCard label={t('growthCoach.comparison.adherence')}
                  value={`${item.adherenceScore}% · ${item.adherenceCoverage}% ${t('growthCoach.comparison.coverage').toLowerCase()}`} /></Grid>
                <Grid item xs={12}><MetricCard label={t('growthCoach.comparison.status')}
                  value={t(`growthCoach.periodStatus.${item.periodStatus}`)} /></Grid>
              </Grid>
            </CardContent>
          </Card>
        ))}
      </Stack>
    )
  }
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent>
        <SectionTitle title={t('growthCoach.comparison.title')} subtitle={t('growthCoach.comparison.subtitle')} />
        <TableContainer sx={{ mt: 2, overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow>
              {['period', 'pnl', 'target', 'progress', 'trades', 'winRate', 'riskUsed', 'drawdown', 'adherence', 'coverage', 'status']
                .map((key) => <TableCell key={key}>{t(`growthCoach.comparison.${key}`)}</TableCell>)}
            </TableRow></TableHead>
            <TableBody>
              {comparisons.map((item) => <TableRow key={item.periodType}>
                <TableCell>{t(`growthCoach.periods.${item.periodType}`)}</TableCell>
                <TableCell>{formatSignedCurrency(item.realisedPnl, detail.account.currency)}</TableCell>
                <TableCell>{formatCurrency(item.target, detail.account.currency)}</TableCell>
                <TableCell>{formatPercent(item.targetProgress)}</TableCell>
                <TableCell>{item.trades}</TableCell>
                <TableCell>{formatPercent(item.winRate)}</TableCell>
                <TableCell>{formatCurrency(item.riskUsed, detail.account.currency)}</TableCell>
                <TableCell>{formatCurrency(item.drawdown, detail.account.currency)}</TableCell>
                <TableCell>{item.adherenceScore}/100</TableCell>
                <TableCell>{formatPercent(item.adherenceCoverage)}</TableCell>
                <TableCell>{t(`growthCoach.periodStatus.${item.periodStatus}`)}</TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}

function PlanAdherenceAndHistory({ detail }: { detail: GrowthCoachDetail }) {
  const { t } = useI18n()
  const os = detail.operatingSystem!
  const ruleGroups = [
    ['passed', os.planAdherence.passed, 'success'] as const,
    ['failed', os.planAdherence.failed, 'error'] as const,
    ['unavailable', os.planAdherence.unavailable, 'warning'] as const
  ]
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <SectionTitle title={t('growthCoach.adherence.title')} subtitle={t('growthCoach.adherence.subtitle')} />
        <Grid container spacing={2} sx={{ mt: 0.25 }}>
          <Grid item xs={12} md={7}>
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip color="primary" label={t('growthCoach.adherence.score', { score: os.planAdherence.score })} />
                <Chip variant="outlined" label={t('growthCoach.adherence.coverage', {
                  coverage: os.planAdherence.evaluationCoverage
                })} />
                <Chip variant="outlined" label={t('growthCoach.adherence.confidence', {
                  confidence: t(`growthCoach.confidence.levels.${os.planAdherence.confidence}`)
                })} />
              </Stack>
              {os.planAdherence.evaluationCoverage < 50 && (
                <Alert severity="warning">{t('growthCoach.adherence.insufficient')}</Alert>
              )}
              {ruleGroups.map(([group, rules, color]) => rules.map((rule) => (
                <Alert key={`${group}-${rule}`} severity={color}>
                  <Typography fontWeight={700}>{t(`growthCoach.adherence.groups.${group}`)}</Typography>
                  <Typography variant="body2">{t(rule)}</Typography>
                </Alert>
              )))}
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Typography fontWeight={800} sx={{ mb: 1 }}>{t('growthCoach.planHistory.title')}</Typography>
            {os.planHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('growthCoach.planHistory.empty')}</Typography>
            ) : (
              <Stack spacing={1}>
                {os.planHistory.map((revision) => (
                  <Card variant="outlined" key={revision.id}>
                    <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                      <Typography fontWeight={700}>
                        {t(`growthCoach.periods.${revision.periodType}`)} · {revision.periodKey} · v{revision.version}
                      </Typography>
                      <Typography variant="body2">{revision.reason}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(revision.changedAt, detail.account.timezone)}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

function MetricConfidence({ detail }: { detail: GrowthCoachDetail }) {
  const { t } = useI18n()
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <SectionTitle title={t('growthCoach.metricConfidence.title')} subtitle={t('growthCoach.metricConfidence.subtitle')} />
        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          {detail.operatingSystem!.metricConfidence.map((item) => (
            <Grid item xs={12} sm={6} lg={4} key={item.metric}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={800}>{t(`growthCoach.metricConfidence.metrics.${item.metric}`)}</Typography>
                    <Chip size="small" color={item.status === 'HIGH' ? 'success' : item.status === 'MEDIUM' ? 'info' : 'warning'}
                      label={`${t(`growthCoach.confidence.levels.${item.status}`)} · ${item.score}`} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t(item.reason)}</Typography>
                  {item.missingDataCount > 0 && <Typography variant="caption" color="warning.main">
                    {t('growthCoach.metricConfidence.missing', { count: item.missingDataCount })}
                  </Typography>}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  )
}

function ProgressChart({ detail }: { detail: GrowthCoachDetail }) {
  const { t } = useI18n()
  const currency = detail.account.currency
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <SectionTitle title={t('growthCoach.chart.title')} subtitle={t('growthCoach.chart.subtitle')} />
        <Box sx={{ width: '100%', height: { xs: 260, md: 340 }, mt: 2 }}>
          <ResponsiveContainer>
            <LineChart data={detail.progressSeries} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
              <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(8)} fontSize={11} minTickGap={20} />
              <YAxis width={72} tickFormatter={(value) => formatNumber(Number(value), 0)} fontSize={11} />
              <ChartTooltip formatter={(value) => formatCurrency(Number(value), currency)} />
              <Line type="monotone" dataKey="realisedBalance" stroke={themeColor(detail.target.realisedCurrentMonthPnl >= 0, 'success', 'error')} strokeWidth={2.5} dot={false} name={t('growthCoach.chart.realised')} />
              <Line type="monotone" dataKey="plannedBalance" stroke="#7c8aa5" strokeDasharray="5 5" dot={false} name={t('growthCoach.chart.planned')} />
              <Line type="monotone" dataKey="targetBalance" stroke="#8b5cf6" strokeDasharray="2 4" dot={false} name={t('growthCoach.chart.target')} />
              {detail.capital.currentEquity != null && (
                <ReferenceLine y={detail.capital.currentEquity} stroke="#0ea5e9" strokeDasharray="4 4" label={t('growthCoach.chart.currentEquity')} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  )
}

function themeColor(positive: boolean, positiveTone: string, negativeTone: string) {
  return positive ? (positiveTone === 'success' ? '#16a34a' : positiveTone) : (negativeTone === 'error' ? '#dc2626' : negativeTone)
}

function RecommendedPlan({ detail }: { detail: GrowthCoachDetail }) {
  const { t } = useI18n()
  const { riskPlan, feasibility, projection, target, account, monthlyPlan } = detail
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <SectionTitle title={t('growthCoach.recommendedPlan.title')} subtitle={t('growthCoach.recommendedPlan.subtitle')} />
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.feasibility')} value={t(`growthCoach.feasibility.levels.${feasibility.classification}`)} /></Grid>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.recommendedRisk')} value={`${formatPercent(riskPlan.recommendedRiskPct)} · ${formatCurrency(riskPlan.recommendedRiskAmount, account.currency)}`} /></Grid>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.maxSupportedRisk')} value={`${formatPercent(riskPlan.maximumPermittedRiskPct)} · ${formatCurrency(riskPlan.maximumPermittedRiskAmount, account.currency)}`} /></Grid>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.currentOpenRisk')} value={detail.openExposure.openRiskKnown ? `${formatPercent(detail.openExposure.openRiskPct)} · ${formatCurrency(detail.openExposure.totalOpenRisk, account.currency)}` : t('growthCoach.unknown')} tone={!detail.openExposure.openRiskKnown ? 'warning' : undefined} /></Grid>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.requiredR')} value={target.requiredR == null ? '—' : `${formatNumber(target.requiredR)}R`} /></Grid>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.expectedTrades')} value={projection.available ? `${formatNumber(projection.expectedTradesLow, 0)}–${formatNumber(projection.expectedTradesHigh, 0)}` : '—'} hint={projection.unavailableReasonKey ? t(projection.unavailableReasonKey) : undefined} /></Grid>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.estimatedDays')} value={projection.available ? `${formatNumber(projection.expectedTradingDaysLow, 0)}–${formatNumber(projection.expectedTradingDaysHigh, 0)}` : '—'} /></Grid>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.expectancyR')} value={projection.expectancyR == null ? '—' : `${formatNumber(projection.expectancyR)}R`} hint={`${t('growthCoach.projection.basis')}: ${t(`growthCoach.projection.datasets.${projection.dataset}`)} · N=${projection.sampleSize}`} /></Grid>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.maxTradesDay')} value={formatNumber(monthlyPlan.plannedMaxTradesPerDay, 0)} /></Grid>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.maxTradesWeek')} value={formatNumber(monthlyPlan.plannedMaxTradesPerWeek, 0)} /></Grid>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.minimumRr')} value={monthlyPlan.plannedMinimumRr == null ? '—' : `${formatNumber(monthlyPlan.plannedMinimumRr)}R`} /></Grid>
          <Grid item {...metricGrid}><MetricCard label={t('growthCoach.metrics.targetProbability')} value={projection.available ? formatPercent(projection.probabilityTargetBeforeMonthEnd) : '—'} /></Grid>
        </Grid>
        {feasibility.reasonKeys.length > 0 && (
          <Alert severity={feasibility.classification === 'UNSAFE' ? 'error' : feasibility.classification === 'UNLIKELY' ? 'warning' : 'info'} sx={{ mt: 2 }}>
            <Stack spacing={0.5}>
              {feasibility.reasonKeys.map((key) => <Typography key={key} variant="body2">{t(key, feasibility.reasonParams)}</Typography>)}
            </Stack>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function ActiveExposure({ detail, isMobile }: { detail: GrowthCoachDetail; isMobile: boolean }) {
  const { t } = useI18n()
  const { openExposure, account } = detail
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <SectionTitle title={t('growthCoach.exposure.title')} subtitle={t('growthCoach.exposure.subtitle')} />
        <Grid container spacing={2} sx={{ my: 0.5 }}>
          <Grid item xs={6} md={3}><MetricCard label={t('growthCoach.metrics.openTrades')} value={formatNumber(openExposure.openTradeCount, 0)} /></Grid>
          <Grid item xs={6} md={3}><MetricCard label={t('growthCoach.metrics.floatingPnl')} value={formatSignedCurrency(openExposure.totalFloatingPnl, account.currency)} /></Grid>
          <Grid item xs={6} md={3}><MetricCard label={t('growthCoach.metrics.currentOpenRisk')} value={openExposure.openRiskKnown ? formatCurrency(openExposure.totalOpenRisk, account.currency) : t('growthCoach.unknown')} tone={!openExposure.openRiskKnown ? 'warning' : undefined} /></Grid>
          <Grid item xs={6} md={3}><MetricCard label={t('growthCoach.metrics.netExposure')} value={formatCurrency(openExposure.netExposure, account.currency)} /></Grid>
        </Grid>
        {openExposure.tradesWithoutStop > 0 && <Alert severity="error" sx={{ mb: 2 }}>{t('growthCoach.exposure.missingStops', { count: openExposure.tradesWithoutStop })}</Alert>}
        {openExposure.trades.length === 0 ? (
          <EmptyState title={t('growthCoach.exposure.emptyTitle')} description={t('growthCoach.exposure.emptyBody')} />
        ) : isMobile ? (
          <Stack spacing={1.5}>
            {openExposure.trades.map((trade) => (
              <Card variant="outlined" key={trade.tradeId}>
                <CardContent>
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography fontWeight={800}>{trade.symbol} · {trade.direction}</Typography>
                      <Button component={Link} to={`/trades?tradeId=${trade.tradeId}`} size="small" endIcon={<OpenInNewRoundedIcon />}>{t('common.edit')}</Button>
                    </Stack>
                    <Grid container spacing={1}>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary">{t('growthCoach.exposure.entry')}</Typography><Typography>{formatNumber(trade.entryPrice)}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary">{t('growthCoach.exposure.current')}</Typography><Typography>{formatNumber(trade.currentPrice)}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary">{t('growthCoach.exposure.openRisk')}</Typography><Typography>{formatCurrency(trade.openRisk, account.currency)}</Typography></Grid>
                      <Grid item xs={6}><Typography variant="caption" color="text.secondary">{t('growthCoach.exposure.floating')}</Typography><Typography>{formatSignedCurrency(trade.floatingPnl, account.currency)}</Typography></Grid>
                    </Grid>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      {trade.warnings.map((warning) => <Chip key={warning} size="small" color="warning" label={t(`growthCoach.exposure.warnings.${warning}`)} />)}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['symbol', 'direction', 'entry', 'current', 'quantity', 'stop', 'target', 'floating', 'openRisk', 'plannedRr', 'currentR', 'age', 'actions'].map((key) => (
                    <TableCell key={key}>{t(`growthCoach.exposure.columns.${key}`)}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {openExposure.trades.map((trade) => (
                  <TableRow key={trade.tradeId}>
                    <TableCell><Stack><Typography fontWeight={700}>{trade.symbol}</Typography>{trade.warnings.length > 0 && <Chip size="small" color="warning" label={trade.warnings.length} />}</Stack></TableCell>
                    <TableCell>{trade.direction}</TableCell>
                    <TableCell>{formatNumber(trade.entryPrice)}</TableCell>
                    <TableCell>{formatNumber(trade.currentPrice)}</TableCell>
                    <TableCell>{formatNumber(trade.quantity)}</TableCell>
                    <TableCell>{formatNumber(trade.stopLoss)}</TableCell>
                    <TableCell>{formatNumber(trade.takeProfit)}</TableCell>
                    <TableCell>{formatSignedCurrency(trade.floatingPnl, account.currency)}</TableCell>
                    <TableCell>{formatCurrency(trade.openRisk, account.currency)}</TableCell>
                    <TableCell>{trade.plannedRr == null ? '—' : `${formatNumber(trade.plannedRr)}R`}</TableCell>
                    <TableCell>{trade.currentR == null ? '—' : `${formatNumber(trade.currentR)}R`}</TableCell>
                    <TableCell>{formatRelativeTime(new Date(Date.now() - trade.ageMinutes * 60_000).toISOString())}</TableCell>
                    <TableCell><Tooltip title={t('growthCoach.exposure.editTrade')}><IconButton component={Link} to={`/trades?tradeId=${trade.tradeId}`}><OpenInNewRoundedIcon fontSize="small" /></IconButton></Tooltip></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  )
}

function LiveCoach({ detail, messageParams }: {
  detail: GrowthCoachDetail
  messageParams: (message: GrowthCoachMessage) => Record<string, string | number>
}) {
  const { t } = useI18n()
  const [primary, ...rest] = detail.coachMessages
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <SectionTitle title={t('growthCoach.liveCoach.title')} subtitle={t('growthCoach.liveCoach.subtitle')} />
        {!primary ? (
          <EmptyState title={t('growthCoach.liveCoach.emptyTitle')} description={t('growthCoach.liveCoach.emptyBody')} />
        ) : (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Alert severity={severityColor(primary.severity)} variant="filled">
              <Typography fontWeight={800}>{t(primary.titleKey, messageParams(primary))}</Typography>
              <Typography variant="body2">{t(primary.messageKey, messageParams(primary))}</Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
                {primary.actionKeys.map((key) => <Chip key={key} size="small" label={t(key)} sx={{ bgcolor: 'rgba(255,255,255,.2)', color: 'inherit' }} />)}
              </Stack>
            </Alert>
            <Grid container spacing={2}>
              {rest.slice(0, 3).map((message) => (
                <Grid item xs={12} md={4} key={message.key}>
                  <Alert severity={severityColor(message.severity)} sx={{ height: '100%' }}>
                    <Typography fontWeight={700}>{t(message.titleKey, messageParams(message))}</Typography>
                    <Typography variant="body2">{t(message.messageKey, messageParams(message))}</Typography>
                  </Alert>
                </Grid>
              ))}
            </Grid>
            {rest.length > 3 && (
              <Accordion disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>{t('growthCoach.liveCoach.more', { count: rest.length - 3 })}</AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1.5}>
                    {rest.slice(3).map((message) => (
                      <Alert key={message.key} severity={severityColor(message.severity)}>
                        <Typography fontWeight={700}>{t(message.titleKey, messageParams(message))}</Typography>
                        <Typography variant="body2">{t(message.messageKey, messageParams(message))}</Typography>
                      </Alert>
                    ))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

function ScenarioComparison({ detail }: { detail: GrowthCoachDetail }) {
  const { t } = useI18n()
  return (
    <Stack spacing={2}>
      <SectionTitle title={t('growthCoach.scenarios.title')} subtitle={t('growthCoach.scenarios.subtitle')} />
      <Grid container spacing={2}>
        {detail.scenarios.map((scenario) => (
          <Grid item xs={12} md={4} key={scenario.key}>
            <Card variant={scenario.recommended ? 'elevation' : 'outlined'} sx={{ height: '100%', borderRadius: 3, borderColor: scenario.recommended ? 'primary.main' : undefined }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" fontWeight={800}>{t(`growthCoach.scenarios.names.${scenario.key}`)}</Typography>
                    {scenario.recommended && <Chip color="primary" size="small" label={t('growthCoach.scenarios.recommended')} />}
                  </Stack>
                  <Divider />
                  <Typography>{t('growthCoach.scenarios.risk')}: <strong>{formatPercent(scenario.riskPct)} · {formatCurrency(scenario.riskAmount, detail.account.currency)}</strong></Typography>
                  <Typography>{t('growthCoach.scenarios.estimatedDays')}: <strong>{formatNumber(scenario.estimatedDays, 0)}</strong></Typography>
                  <Typography>{t('growthCoach.scenarios.targetProbability')}: <strong>{formatPercent(scenario.targetProbability)}</strong></Typography>
                  <Typography>{t('growthCoach.scenarios.drawdownProbability')}: <strong>{formatPercent(scenario.drawdownProbability)}</strong></Typography>
                  {scenario.warningKey && <Alert severity="warning">{t(scenario.warningKey)}</Alert>}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  )
}

function PerformanceDrivers({ detail }: { detail: GrowthCoachDetail }) {
  const { t } = useI18n()
  const entries = [
    ['strongestStrategy', detail.performanceDrivers.strongestStrategy],
    ['weakestStrategy', detail.performanceDrivers.weakestStrategy],
    ['strongestSession', detail.performanceDrivers.strongestSession],
    ['weakestSession', detail.performanceDrivers.weakestSession],
    ['strongestSymbol', detail.performanceDrivers.strongestSymbol],
    ['weakestSymbol', detail.performanceDrivers.weakestSymbol],
    ['strongestRrBucket', detail.performanceDrivers.strongestRrBucket]
  ] as const
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <SectionTitle title={t('growthCoach.drivers.title')} subtitle={t('growthCoach.drivers.subtitle')} />
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          {entries.map(([key, driver]) => (
            <Grid item xs={12} sm={6} lg={4} key={key}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">{t(`growthCoach.drivers.${key}`)}</Typography>
                  <Typography fontWeight={800} sx={{ mt: 0.5 }}>{driver?.name || '—'}</Typography>
                  {driver && <Typography variant="body2" color="text.secondary">{formatCurrency(driver.expectancy, detail.account.currency)} / trade · {driver.expectancyR == null ? '—' : `${formatNumber(driver.expectancyR)}R`} · N={driver.sampleSize} · {t(`growthCoach.confidence.levels.${driver.confidence}`)}</Typography>}
                </CardContent>
              </Card>
            </Grid>
          ))}
          <Grid item xs={12} sm={6} lg={4}><MetricCard label={t('growthCoach.drivers.costImpact')} value={formatPercent(detail.performanceDrivers.costPctOfGrossProfit)} hint={t('growthCoach.drivers.costPerTrade', { amount: formatCurrency(detail.performanceDrivers.costPerTrade, detail.account.currency) })} /></Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

function DataQuality({ detail }: { detail: GrowthCoachDetail }) {
  const { t } = useI18n()
  const quality = detail.dataQuality
  const metrics = ['validClosedTrades', 'missingCloseTime', 'missingPnl', 'inconsistentPnl', 'missingRisk', 'missingStop', 'missingQuantity', 'missingStrategy', 'missingSetup'] as const
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <SectionTitle title={t('growthCoach.dataQuality.title')} subtitle={t('growthCoach.dataQuality.subtitle')} action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button component={Link} to="/trades" variant="outlined">{t('growthCoach.dataQuality.viewTrades')}</Button>
            <Button component={Link} to="/settings" variant="outlined">{t('growthCoach.dataQuality.editSettings')}</Button>
          </Stack>
        } />
        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          {metrics.map((key) => (
            <Grid item xs={6} sm={4} md={3} key={key}>
              <MetricCard label={t(`growthCoach.dataQuality.metrics.${key}`)} value={formatNumber(quality[key], 0)} tone={key !== 'validClosedTrades' && quality[key] > 0 ? 'warning' : undefined} />
            </Grid>
          ))}
        </Grid>
        <Stack spacing={1} sx={{ mt: 2 }}>
          {detail.confidence.reasonKeys.map((key) => <Alert severity="info" key={key}>{t(key, detail.confidence.reasonParams)}</Alert>)}
        </Stack>
      </CardContent>
    </Card>
  )
}

function Ledger({ detail, onAdd, onReconcile, onDelete }: {
  detail: GrowthCoachDetail
  onAdd: () => void
  onReconcile: () => void
  onDelete: (eventId: string) => Promise<void>
}) {
  const { t } = useI18n()
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <SectionTitle title={t('growthCoach.ledger.title')} subtitle={t('growthCoach.ledger.subtitle')} action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" onClick={onReconcile}>{t('growthCoach.reconcile.title')}</Button>
            <Button startIcon={<AddRoundedIcon />} variant="outlined" onClick={onAdd}>{t('growthCoach.ledger.add')}</Button>
          </Stack>
        } />
        {detail.ledgerEvents.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{t('growthCoach.ledger.empty')}</Typography>
        ) : (
          <TableContainer sx={{ mt: 2, overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>{t('growthCoach.ledger.type')}</TableCell><TableCell>{t('growthCoach.ledger.date')}</TableCell><TableCell>{t('growthCoach.ledger.description')}</TableCell><TableCell align="right">{t('growthCoach.ledger.amount')}</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {detail.ledgerEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{t(`growthCoach.ledger.types.${event.eventType}`)}</TableCell>
                    <TableCell>{formatDateTime(event.eventTime, detail.account.timezone)}</TableCell>
                    <TableCell>{event.description || '—'}</TableCell>
                    <TableCell align="right">{formatSignedCurrency(
                      ledgerDebitTypes.has(event.eventType) ? -Math.abs(event.amount) : event.amount,
                      event.currency
                    )}</TableCell>
                    <TableCell align="right"><IconButton aria-label={t('growthCoach.ledger.reverse')}
                      sx={{ minWidth: 44, minHeight: 44 }} onClick={() => void onDelete(event.id)}>
                      <UndoRoundedIcon fontSize="small" />
                    </IconButton></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  )
}
