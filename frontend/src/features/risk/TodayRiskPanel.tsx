import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import { Alert, Box, Button, Chip, Divider, Stack, TextField, Typography } from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { SetupDirection, SetupItem, SetupDraftRequest } from '../../api/liveWorkspace'
import { createSetupCandidate, getSessionWorkspace } from '../../api/liveWorkspace'
import { fetchFxRate } from '../../api/fx'
import { ApiError } from '../../api/client'
import { useI18n } from '../../i18n'
import { formatCurrency, formatNumber } from '../../utils/format'
import { formatLocalizedNumberInput, parseLocalizedNumberInput } from '../../utils/numberInput'
import { WorkstationCard, PanelNumber } from '../../components/trading-workspace/WorkspacePrimitives'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import {
  buildPreparedExecutionDraft,
  calculatePreparedRisk,
  resolvePreparedInstrumentBasis,
  type CalculationResult
} from './preparedExecution'

import type { RiskDraft as StoredRiskDraft } from '../../api/sessionReviews'
import type { TradePreparationSnapshot } from '../preparation/tradePreparationSnapshot'

type TodayRiskPanelProps = {
  preparationSnapshot?: TradePreparationSnapshot
  storedDraft?: StoredRiskDraft
  onDraftChange?: (draft: StoredRiskDraft) => void
  afterFields?: ReactNode

  userId: string
  accountId: string
  accountLabel: string
  accountCurrency: string
  date: string
  isCurrentDate: boolean
  session: string
  symbol: string
  market: NonNullable<SetupItem['market']>
  direction: SetupDirection
  strategyId?: string | null
  strategyLabel?: string | null
  thesis: string
  defaultInvalidation: string
  maximumPermittedRisk?: number | null
  maximumPermittedRiskPct?: number | null
  remainingTrades?: number | null
  capacityReason?: string | null
}

const newDraft = (): StoredRiskDraft => ({
  version: 1,
  draftId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `risk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  entryPrice: '',
  stopLossPrice: '',
  takeProfitPrice: '',
  intendedRiskAmount: '',
  manualQuantity: '',
  invalidation: ''
})

const readDraft = (key: string, fallbackInvalidation: string): StoredRiskDraft => {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || 'null') as StoredRiskDraft | null
    if (stored?.version === 1 && stored.draftId) return stored
  } catch { /* Invalid local data must never replace a valid fresh draft. */ }
  return { ...newDraft(), invalidation: fallbackInvalidation }
}

const numeric = (value: string) => parseLocalizedNumberInput(value) ?? null

const statusIcon = (state: string) => state === 'valid'
  ? <CheckCircleRoundedIcon aria-hidden sx={{ fontSize: 16, color: 'trading.profit' }} />
  : state === 'invalid'
    ? <WarningAmberRoundedIcon aria-hidden sx={{ fontSize: 16, color: 'error.main' }} />
    : <RadioButtonUncheckedRoundedIcon aria-hidden sx={{ fontSize: 16, color: 'text.disabled' }} />

export function TodayRiskPanel(props: TodayRiskPanelProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const scopeKey = useMemo(() => [props.userId, props.accountId, props.date, props.session, props.market, props.symbol.toUpperCase()].join('.'), [props.accountId, props.date, props.market, props.session, props.symbol, props.userId])
  const storageKey = `today.risk.v1.${scopeKey}`
  const [draft, setDraft] = useState<StoredRiskDraft>(() => props.storedDraft || readDraft(storageKey, props.defaultInvalidation))
  const [recovered, setRecovered] = useState(() => !props.storedDraft && Boolean(localStorage.getItem(storageKey)))

  const draftChange = useRef(props.onDraftChange)
  draftChange.current = props.onDraftChange
  const lastReportedDraft = useRef(props.storedDraft ? JSON.stringify(props.storedDraft) : null)
  useEffect(() => {
    const serialized = JSON.stringify(draft)
    if (lastReportedDraft.current !== serialized) {
      lastReportedDraft.current = serialized
      draftChange.current?.(draft)
    }
  }, [draft])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(draft)) } catch { /* The fields remain usable even when recovery storage is unavailable. */ }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [draft, storageKey])

  const basis = useMemo(() => resolvePreparedInstrumentBasis(props.market, props.symbol), [props.market, props.symbol])
  const tradeCurrency = basis.state === 'valid' ? basis.value.tradeCurrency : null
  const needsFx = Boolean(tradeCurrency && tradeCurrency.toUpperCase() !== props.accountCurrency.toUpperCase())
  const fx = useQuery({
    queryKey: ['todayRiskFx', tradeCurrency, props.accountCurrency],
    queryFn: () => fetchFxRate(tradeCurrency!, props.accountCurrency),
    enabled: needsFx,
    staleTime: 5 * 60_000,
    retry: 1
  })
  const fxRate = needsFx ? fx.data?.rate ?? null : tradeCurrency ? 1 : null
  const fxSource = needsFx ? fx.data?.source ?? null : tradeCurrency ? 'IDENTITY' : null

  const calculation = useMemo(() => calculatePreparedRisk({
    direction: props.direction,
    entryPrice: numeric(draft.entryPrice),
    stopLossPrice: numeric(draft.stopLossPrice),
    takeProfitPrice: numeric(draft.takeProfitPrice),
    intendedRiskAmount: numeric(draft.intendedRiskAmount),
    manualQuantity: numeric(draft.manualQuantity),
    instrumentBasis: basis.state === 'valid' ? basis.value : null,
    accountCurrency: props.accountCurrency,
    fxRateTradeToAccount: fxRate,
    maximumPermittedRisk: props.maximumPermittedRisk
  }), [basis, draft.entryPrice, draft.intendedRiskAmount, draft.manualQuantity, draft.stopLossPrice, draft.takeProfitPrice, fxRate, props.accountCurrency, props.direction, props.maximumPermittedRisk])

  const prepared = useMemo(() => buildPreparedExecutionDraft({
    draftId: draft.draftId,
    accountRefId: props.accountId,
    accountCurrency: props.accountCurrency,
    symbol: props.symbol,
    market: props.market,
    direction: props.direction,
    entryPrice: numeric(draft.entryPrice),
    stopLossPrice: numeric(draft.stopLossPrice),
    takeProfitPrice: numeric(draft.takeProfitPrice),
    intendedRiskAmount: numeric(draft.intendedRiskAmount),
    manualQuantity: numeric(draft.manualQuantity),
    invalidation: draft.invalidation,
    basis,
    fxRate,
    fxSource,
    calculation
  }), [basis, calculation, draft, fxRate, fxSource, props.accountCurrency, props.accountId, props.direction, props.market, props.symbol])

  const fieldError = (field: string) => prepared.invalidReasons[field] ? t(prepared.invalidReasons[field]) : ''
  const quantityReady = prepared.quantity != null && prepared.quantity > 0
  const capBlocks = calculation.capComparison.state === 'valid' && calculation.capComparison.value === 'above'
  const handoffBlocked = Boolean(props.preparationSnapshot?.review?.preparation?.observing) || !props.isCurrentDate
    || calculation.plannedRr.state !== 'valid'
    || !prepared.intendedRiskAmount || prepared.intendedRiskAmount <= 0
    || !quantityReady
    || !draft.invalidation.trim()
    || capBlocks

  const handoff = useMutation({
    mutationFn: async () => {
      const workspace = await getSessionWorkspace()
      const executionId = `today-${draft.draftId}`
      const payload: SetupDraftRequest = {
        accountRefId: props.accountId,
        sourceDraftId: draft.draftId,
        symbol: props.symbol,
        market: props.market,
        direction: props.direction,
        tradeSession: props.session === 'EUROPE' ? 'LONDON' : props.session === 'US' ? 'NY' : 'CUSTOM',
        strategyId: props.strategyId || null,
        strategyLabel: props.strategyLabel || null,
        setupTitle: t('risk.defaultSetupTitle', { symbol: props.symbol }),
        manualSetupMode: !props.strategyId,
        context: { narrative: props.thesis || null, invalidationIdea: draft.invalidation, liquidityNotes: null, newsSafety: null, notes: null, preparationSnapshot: props.preparationSnapshot ? { ...props.preparationSnapshot, risk: prepared, capacity: { maximumPermittedRisk: props.maximumPermittedRisk ?? null, maximumPermittedRiskPct: props.maximumPermittedRiskPct ?? null, remainingTrades: props.remainingTrades ?? null, reason: props.capacityReason ?? null } } : undefined },
        trigger: { rrEstimate: prepared.plannedRr, invalidationThreshold: draft.invalidation },
        execution: {
          activeExecutionId: executionId,
          entryPrice: prepared.entryPrice,
          stopLossPrice: prepared.stopLossPrice,
          takeProfitPrice: prepared.takeProfitPrice,
          riskAmount: prepared.intendedRiskAmount,
          quantity: prepared.quantity,
          invalidation: draft.invalidation,
          tickets: [{
            id: executionId,
            label: t('risk.executionLabel'),
            status: 'DRAFT',
            entryPrice: prepared.entryPrice,
            stopLossPrice: prepared.stopLossPrice,
            takeProfitPrice: prepared.takeProfitPrice,
            riskAmount: prepared.intendedRiskAmount,
            quantity: prepared.quantity,
            contractMultiplier: prepared.contractMultiplier,
            contractMetadataSource: prepared.contractMetadataSource,
            tradeCurrency: prepared.tradeCurrency,
            profileCurrency: prepared.profileCurrency,
            fxRateTradeToProfile: prepared.fxRateTradeToProfile,
            fxRateSource: prepared.fxSource,
            plannedRr: prepared.plannedRr,
            estimatedPriceRisk: prepared.estimatedPriceRisk,
            costsIncluded: false,
            calculationStatus: prepared.calculationStatus,
            unavailableReasons: prepared.unavailableReasons,
            invalidation: draft.invalidation
          }]
        }
      }
      return createSetupCandidate(workspace.session.id, payload)
    },
    onSuccess: (workspace) => {
      const setup = workspace.setups.find((item) => item.sourceDraftId === draft.draftId)
      const params = new URLSearchParams({ accountIds: props.accountId, source: 'today-risk' })
      if (setup) params.set('setupId', setup.id)
      navigate(`/today/session?${params.toString()}`)
    }
  })

  const validationRows: Array<{ label: string; result: CalculationResult<unknown> | { state: string } }> = [
    { label: t('risk.validation.directional'), result: calculation.plannedRr },
    { label: t('risk.validation.intended'), result: positiveResult(prepared.intendedRiskAmount) },
    { label: t('risk.validation.quantity'), result: quantityReady ? { state: 'valid' } : calculation.automaticQuantity },
    { label: t('risk.validation.capacity'), result: calculation.capComparison }
  ]
  const calculatedQuantity = calculation.automaticQuantity.state === 'valid' ? calculation.automaticQuantity.value : null

  return (
    <WorkstationCard title={t('workstation.risk')} icon={SecurityRoundedIcon} action={<PanelNumber>2</PanelNumber>}>
      <Stack spacing={1.05}>
        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="caption" color="text.secondary">{props.accountLabel}</Typography>
          <Typography variant="caption">{t('workstation.maximumRisk')}: {props.maximumPermittedRisk == null ? t('workstation.unavailable') : formatCurrency(props.maximumPermittedRisk, props.accountCurrency)} · {t('risk.remainingTrades', { value: props.remainingTrades ?? '—' })}</Typography>
        </Stack>
        {recovered ? <Chip size="small" label={t('risk.recovered')} sx={{ alignSelf: 'flex-start' }} /> : null}
        <TextField size="small" label={t('risk.intendedRisk')} value={draft.intendedRiskAmount} onChange={(event) => setDraft((current) => ({ ...current, intendedRiskAmount: event.target.value }))} error={Boolean(fieldError('intendedRiskAmount'))} helperText={fieldError('intendedRiskAmount')} InputProps={{ endAdornment: <Typography variant="caption">{props.accountCurrency}</Typography> }} inputProps={{ inputMode: 'decimal' }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
        <TextField size="small" label={t('workstation.entryPrice')} value={draft.entryPrice} onChange={(event) => setDraft((current) => ({ ...current, entryPrice: event.target.value }))} error={Boolean(fieldError('entryPrice'))} helperText={fieldError('entryPrice')} inputProps={{ inputMode: 'decimal' }} />
        <TextField size="small" label={t('workstation.stopLoss')} value={draft.stopLossPrice} onChange={(event) => setDraft((current) => ({ ...current, stopLossPrice: event.target.value }))} error={Boolean(fieldError('stopLossPrice'))} helperText={fieldError('stopLossPrice')} inputProps={{ inputMode: 'decimal' }} />
        <TextField size="small" label={t('workstation.takeProfit')} value={draft.takeProfitPrice} onChange={(event) => setDraft((current) => ({ ...current, takeProfitPrice: event.target.value }))} error={Boolean(fieldError('takeProfitPrice'))} helperText={fieldError('takeProfitPrice')} inputProps={{ inputMode: 'decimal' }} />
        </Box>
        <TextField size="small" label={t('risk.quantity')} value={draft.manualQuantity} onChange={(event) => setDraft((current) => ({ ...current, manualQuantity: event.target.value }))} error={Boolean(fieldError('quantity'))} helperText={calculation.automaticQuantity.state === 'valid' ? t('risk.automaticQuantity', { value: formatNumber(calculation.automaticQuantity.value, 4) }) : calculation.plannedRr.state === 'valid' ? t(calculation.automaticQuantity.reason) : undefined} inputProps={{ inputMode: 'decimal' }} />
        {calculatedQuantity != null ? <Button size="small" onClick={() => setDraft((current) => ({ ...current, manualQuantity: formatLocalizedNumberInput(calculatedQuantity) }))}>{t('risk.useCalculatedQuantity')}</Button> : null}
        <TextField size="small" label={t('dailyReview.invalidation')} value={draft.invalidation} onChange={(event) => setDraft((current) => ({ ...current, invalidation: event.target.value }))} multiline minRows={1} inputProps={{ maxLength: 4000 }} />
        <Divider />
        <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">{t('workstation.riskReward')}</Typography><Typography className="metric-value" variant="body2">{calculation.plannedRr.state === 'valid' ? `1 : ${formatNumber(calculation.plannedRr.value, 2)}` : '—'}</Typography></Stack>
        <Box component="details"><Box component="summary" sx={{ cursor: 'pointer', fontSize: 12, color: 'text.secondary' }}>{t('chartPlan.riskDetails')}</Box><Stack spacing={1} sx={{ pt: 1 }}>
        <Stack direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">{t('risk.estimatedPriceRisk')}</Typography><Typography className="metric-value" variant="body2">{calculation.estimatedPriceRisk.state === 'valid' ? formatCurrency(calculation.estimatedPriceRisk.value, props.accountCurrency) : t(calculation.estimatedPriceRisk.reason)}</Typography></Stack>
        <Typography variant="caption" color="text.secondary">
          {basis.state === 'valid' ? t('risk.basisKnown', { market: props.market, symbol: basis.value.symbol, multiplier: basis.value.contractMultiplier, currency: basis.value.tradeCurrency, source: basis.value.source }) : t(basis.reason)}
          {needsFx ? ` · ${fx.data ? t('risk.fxBasis', { rate: formatNumber(fx.data.rate, 6), source: fx.data.source }) : t('risk.reasons.fxUnavailable')}` : ''}
        </Typography>
        <Alert severity="warning" icon={<WarningAmberRoundedIcon fontSize="small" />}>{t('risk.costsExcluded')}</Alert>
        <Stack spacing={0.45} aria-label={t('risk.validation.title')}>
          {validationRows.map((row) => <Stack key={row.label} direction="row" spacing={0.7} alignItems="center">{statusIcon(row.result.state)}<Typography variant="caption">{row.label}: {t(`risk.states.${row.result.state}`)}</Typography></Stack>)}
        </Stack>
        </Stack></Box>
        {props.afterFields}
        {!props.isCurrentDate ? <Alert severity="warning">{t('risk.historicalBlocked')}</Alert> : null}
        {capBlocks ? <Alert severity="error">{t('risk.capExceeded')}</Alert> : null}
        {calculation.capComparison.state === 'unavailable' ? <Alert severity="info">{t('risk.capacityUnavailable')}</Alert> : null}
        {handoff.error ? <Alert severity="error" action={<Button onClick={() => handoff.reset()}>{t('dailyReview.retry')}</Button>}>{(handoff.error as ApiError).message || t('risk.handoffError')}</Alert> : null}
        <Button variant="contained" sx={{ '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'text.disabled' } }} disabled={handoffBlocked || handoff.isLoading} onClick={() => handoff.mutate()}>{handoff.isLoading ? t('risk.handingOff') : t('risk.continue')}</Button>
        {handoffBlocked && <Typography variant="caption" color="text.secondary">{t(props.preparationSnapshot?.review?.preparation?.observing ? 'chartPlan.observationOnly' : 'chartPlan.completeRisk')}</Typography>}
        <Button size="small" color="inherit" onClick={() => { const reset = { ...newDraft(), invalidation: props.defaultInvalidation }; setDraft(reset); setRecovered(false); localStorage.removeItem(storageKey) }}>{t('risk.clearDraft')}</Button>
        <Typography variant="caption" color="text.secondary">{t('risk.handoffBoundary')}</Typography>
      </Stack>
    </WorkstationCard>
  )
}

function positiveResult(value: number | null): CalculationResult<number> {
  return value != null && value > 0 ? { state: 'valid', value } : { state: value == null ? 'incomplete' : 'invalid', reason: value == null ? 'risk.reasons.intendedRiskRequired' : 'risk.reasons.intendedRiskPositive' }
}
