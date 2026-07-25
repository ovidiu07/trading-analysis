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
  useMediaQuery,
  useTheme
} from '@mui/material'
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import { Link } from 'react-router-dom'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
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
  MonthlyPlanDialog
} from '../components/growthCoach/GrowthCoachDialogs'

const currentMonthKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const sectionCardSx = { borderRadius: 3, overflow: 'hidden' }
const metricGrid = { xs: 12, sm: 6, md: 4, lg: 3 }

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
  const { t } = useI18n()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const accountScope = useAccountScope()
  const selectedAccountId = accountScope.scope.mode === 'selected' && accountScope.scope.accountIds.length === 1
    ? accountScope.scope.accountIds[0]
    : undefined
  const [month, setMonth] = useState(currentMonthKey)
  const [profileOpen, setProfileOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mutationError, setMutationError] = useState('')

  const coachQuery = useQuery({
    queryKey: ['growthCoach', selectedAccountId || 'all', month],
    queryFn: () => fetchGrowthCoach(selectedAccountId, month),
    enabled: !accountScope.isLoading
  })

  const detail = coachQuery.data?.detail
  const currency = detail?.account.currency || 'USD'
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
  const handlePlanSave = (request: MonthlyPlanRequest) =>
    mutate(() => updateMonthlyPlan(detail!.account.id, month, request), () => setPlanOpen(false))
  const handleLedgerSave = (request: LedgerEventRequest) =>
    mutate(() => createLedgerEvent(detail!.account.id, request), () => setLedgerOpen(false))

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
              <TextField
                size="small"
                type="month"
                value={month}
                aria-label={t('growthCoach.monthSelector')}
                onChange={(event) => setMonth(event.target.value)}
                inputProps={{ 'aria-label': t('growthCoach.monthSelector') }}
                sx={{ minWidth: { sm: 160 }, '& .MuiInputBase-root': { minHeight: 44 } }}
              />
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
          <AccountHeader detail={detail} onEditProfile={() => setProfileOpen(true)} onEditPlan={() => setPlanOpen(true)} />
          <MonthlyOverview detail={detail} />
          <ProgressChart detail={detail} />
          <RecommendedPlan detail={detail} />
          <ActiveExposure detail={detail} isMobile={isMobile} />
          <LiveCoach detail={detail} messageParams={messageParams} />
          <ScenarioComparison detail={detail} />
          <PerformanceDrivers detail={detail} />
          <DataQuality detail={detail} />
          <Ledger detail={detail} onAdd={() => setLedgerOpen(true)} onDelete={async (eventId) => {
            if (!window.confirm(t('growthCoach.ledger.confirmDelete'))) return
            await mutate(() => deleteLedgerEvent(detail.account.id, eventId), () => {})
          }} />
          <Alert severity="info" icon={<ShieldOutlinedIcon />}>{t(detail.disclaimer)}</Alert>

          <GrowthProfileDialog
            open={profileOpen} profile={detail.profile} currency={currency} saving={saving}
            onClose={() => setProfileOpen(false)} onSave={handleProfileSave}
          />
          <MonthlyPlanDialog
            open={planOpen} plan={detail.monthlyPlan} saving={saving}
            onClose={() => setPlanOpen(false)} onSave={handlePlanSave}
          />
          <LedgerEventDialog
            open={ledgerOpen} currency={currency} saving={saving}
            onClose={() => setLedgerOpen(false)} onSave={handleLedgerSave}
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

function AccountHeader({ detail, onEditProfile, onEditPlan }: {
  detail: GrowthCoachDetail
  onEditProfile: () => void
  onEditPlan: () => void
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
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button startIcon={<EditRoundedIcon />} variant="outlined" onClick={onEditProfile}>{t('growthCoach.profile.edit')}</Button>
        <Button startIcon={<EditRoundedIcon />} variant="contained" onClick={onEditPlan}>{t('growthCoach.plan.edit')}</Button>
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

function Ledger({ detail, onAdd, onDelete }: {
  detail: GrowthCoachDetail
  onAdd: () => void
  onDelete: (eventId: string) => Promise<void>
}) {
  const { t } = useI18n()
  return (
    <Card variant="outlined" sx={sectionCardSx}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <SectionTitle title={t('growthCoach.ledger.title')} subtitle={t('growthCoach.ledger.subtitle')} action={
          <Button startIcon={<AddRoundedIcon />} variant="outlined" onClick={onAdd}>{t('growthCoach.ledger.add')}</Button>
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
                    <TableCell align="right">{formatSignedCurrency(event.amount, event.currency)}</TableCell>
                    <TableCell align="right"><IconButton aria-label={t('common.delete')} onClick={() => void onDelete(event.id)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton></TableCell>
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
