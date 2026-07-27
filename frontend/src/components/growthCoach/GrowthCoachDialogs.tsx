import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import type {
  GrowthProfile,
  GrowthProfileRequest,
  LedgerEventRequest,
  MonthlyGrowthPlan,
  MonthlyPlanRequest,
  GrowthPeriodPlan,
  PeriodPlanRequest,
  ReconcileBalanceRequest
} from '../../api/growthCoach'
import { useI18n } from '../../i18n'

type ProfileDialogProps = {
  open: boolean
  profile: GrowthProfile
  currency: string
  saving: boolean
  onClose: () => void
  onSave: (request: GrowthProfileRequest) => Promise<void>
}

const accountTypes = [
  'PERSONAL',
  'PROP_CHALLENGE',
  'PROP_FUNDED',
  'FUTURES_EVALUATION',
  'FUTURES_FUNDED',
  'DEMO',
  'OTHER'
] as const

const numeric = (value: string) => value.trim() === '' ? null : Number(value)

export function GrowthProfileDialog({ open, profile, currency, saving, onClose, onSave }: ProfileDialogProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<GrowthProfileRequest>({ ...profile, currency })

  useEffect(() => {
    setDraft({ ...profile, currency })
  }, [currency, profile])

  const update = <K extends keyof GrowthProfileRequest>(key: K, value: GrowthProfileRequest[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }
  const numberField = (key: keyof GrowthProfileRequest, labelKey: string) => (
    <TextField
      fullWidth
      type="number"
      label={t(labelKey)}
      value={(draft[key] as number | null | undefined) ?? ''}
      onChange={(event) => update(key, numeric(event.target.value) as never)}
      inputProps={{ step: 'any' }}
    />
  )
  const propAccount = draft.accountType.startsWith('PROP_') || draft.accountType.startsWith('FUTURES_')
  const futuresAccount = draft.accountType.startsWith('FUTURES_')

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t('growthCoach.profile.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">{t('growthCoach.profile.subtitle')}</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth label={t('growthCoach.profile.accountType')}
                value={draft.accountType}
                onChange={(event) => update('accountType', event.target.value as GrowthProfileRequest['accountType'])}
              >
                {accountTypes.map((type) => (
                  <MenuItem key={type} value={type}>{t(`growthCoach.accountTypes.${type}`)}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth label={t('growthCoach.profile.currency')} value={draft.currency}
                inputProps={{ maxLength: 3 }}
                onChange={(event) => update('currency', event.target.value.toUpperCase())}
              />
            </Grid>
            <Grid item xs={12} sm={6}>{numberField('initialCapital', 'growthCoach.profile.initialCapital')}</Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth label={t('growthCoach.profile.capitalSource')} value={draft.capitalSource}
                onChange={(event) => update('capitalSource', event.target.value as GrowthProfileRequest['capitalSource'])}
              >
                {['USER_ENTERED', 'IMPORTED', 'RECONSTRUCTED', 'ACCOUNT_DEFAULT'].map((value) => (
                  <MenuItem key={value} value={value}>{t(`growthCoach.capitalSources.${value}`)}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>{numberField('defaultRiskPerTradePct', 'growthCoach.profile.defaultRisk')}</Grid>
            <Grid item xs={12} sm={4}>{numberField('preferredMaxRiskPerTradePct', 'growthCoach.profile.maxRisk')}</Grid>
            <Grid item xs={12} sm={4}>{numberField('maxConcurrentRiskPct', 'growthCoach.profile.maxConcurrentRisk')}</Grid>
            <Grid item xs={12} sm={6}>{numberField('maxDailyRiskPct', 'growthCoach.profile.maxDailyRiskPct')}</Grid>
            <Grid item xs={12} sm={6}>{numberField('maxDailyLossAmount', 'growthCoach.profile.maxDailyLossAmount')}</Grid>
            <Grid item xs={12} sm={6}>{numberField('maxTotalDrawdownPct', 'growthCoach.profile.maxDrawdownPct')}</Grid>
            <Grid item xs={12} sm={6}>{numberField('maxTotalDrawdownAmount', 'growthCoach.profile.maxDrawdownAmount')}</Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select fullWidth label={t('growthCoach.profile.drawdownType')} value={draft.drawdownType}
                onChange={(event) => update('drawdownType', event.target.value)}
              >
                {['NONE', 'STATIC', 'TRAILING_INTRADAY', 'TRAILING_END_OF_DAY'].map((value) => (
                  <MenuItem key={value} value={value}>{t(`growthCoach.drawdownTypes.${value}`)}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>{numberField('monthlyTargetPct', 'growthCoach.profile.monthlyTarget')}</Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={draft.compoundsMonthly} onChange={(_, value) => update('compoundsMonthly', value)} />}
                label={t('growthCoach.profile.compoundsMonthly')}
              />
            </Grid>
          </Grid>

          {propAccount && (
            <>
              <Typography variant="subtitle1" fontWeight={700}>{t('growthCoach.profile.rulesTitle')}</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>{numberField('profitTargetPct', 'growthCoach.profile.profitTargetPct')}</Grid>
                <Grid item xs={12} sm={6}>{numberField('profitTargetAmount', 'growthCoach.profile.profitTargetAmount')}</Grid>
                <Grid item xs={12} sm={6}>{numberField('minimumTradingDays', 'growthCoach.profile.minimumTradingDays')}</Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth type="date" label={t('growthCoach.profile.deadline')}
                    InputLabelProps={{ shrink: true }} value={draft.challengeDeadline || ''}
                    onChange={(event) => update('challengeDeadline', event.target.value || null)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth label={t('growthCoach.profile.consistencyRuleType')}
                    value={draft.consistencyRuleType || ''}
                    onChange={(event) => update('consistencyRuleType', event.target.value || null)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>{numberField('consistencyRuleValue', 'growthCoach.profile.consistencyRuleValue')}</Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch checked={draft.trailingDrawdownEnabled} onChange={(_, value) => update('trailingDrawdownEnabled', value)} />}
                    label={t('growthCoach.profile.trailingEnabled')}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>{numberField('trailingDrawdownAmount', 'growthCoach.profile.trailingAmount')}</Grid>
                <Grid item xs={12} sm={6}>{numberField('trailingDrawdownHighWaterMark', 'growthCoach.profile.highWaterMark')}</Grid>
                <Grid item xs={12} sm={6}>{numberField('profitSplitPct', 'growthCoach.profile.profitSplit')}</Grid>
                <Grid item xs={12} sm={6}>{numberField('payoutThreshold', 'growthCoach.profile.payoutThreshold')}</Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label={t('growthCoach.profile.payoutFrequency')} value={draft.payoutFrequency || ''}
                    onChange={(event) => update('payoutFrequency', event.target.value || null)} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label={t('growthCoach.profile.payoutRules')} value={draft.payoutEligibilityRules || ''}
                    onChange={(event) => update('payoutEligibilityRules', event.target.value || null)} />
                </Grid>
                {futuresAccount && (
                  <>
                    <Grid item xs={12} sm={6}>{numberField('contractLimit', 'growthCoach.profile.contractLimit')}</Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label={t('growthCoach.profile.scalingRestrictions')} value={draft.scalingRestrictions || ''}
                        onChange={(event) => update('scalingRestrictions', event.target.value || null)} />
                    </Grid>
                  </>
                )}
                <Grid item xs={12}>
                  <TextField fullWidth multiline minRows={2} label={t('growthCoach.profile.resetDetails')} value={draft.resetDetails || ''}
                    onChange={(event) => update('resetDetails', event.target.value || null)} />
                </Grid>
              </Grid>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={saving} onClick={() => void onSave(draft)}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

type PlanDialogProps = {
  open: boolean
  plan: MonthlyGrowthPlan
  saving: boolean
  onClose: () => void
  onSave: (request: MonthlyPlanRequest) => Promise<void>
}

export function MonthlyPlanDialog({ open, plan, saving, onClose, onSave }: PlanDialogProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<MonthlyPlanRequest>({
    targetType: plan.targetType,
    targetBasis: plan.targetBasis,
    targetPct: plan.targetPct,
    targetAmount: plan.targetAmount,
    targetR: plan.targetR,
    plannedRiskPerTradePct: plan.plannedRiskPerTradePct,
    hardMaxRiskPerTradePct: plan.hardMaxRiskPerTradePct,
    plannedMaxTradesPerDay: plan.plannedMaxTradesPerDay,
    plannedMaxTradesPerWeek: plan.plannedMaxTradesPerWeek,
    plannedMinimumRr: plan.plannedMinimumRr
  })

  useEffect(() => {
    setDraft({
      targetType: plan.targetType,
      targetBasis: plan.targetBasis,
      targetPct: plan.targetPct,
      targetAmount: plan.targetAmount,
      targetR: plan.targetR,
      plannedRiskPerTradePct: plan.plannedRiskPerTradePct,
      hardMaxRiskPerTradePct: plan.hardMaxRiskPerTradePct,
      plannedMaxTradesPerDay: plan.plannedMaxTradesPerDay,
      plannedMaxTradesPerWeek: plan.plannedMaxTradesPerWeek,
      plannedMinimumRr: plan.plannedMinimumRr
    })
  }, [plan])

  const update = <K extends keyof MonthlyPlanRequest>(key: K, value: MonthlyPlanRequest[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const numberField = (key: keyof MonthlyPlanRequest, label: string) => (
    <TextField fullWidth type="number" label={t(label)} value={(draft[key] as number | null | undefined) ?? ''}
      inputProps={{ step: 'any' }} onChange={(event) => update(key, numeric(event.target.value) as never)} />
  )

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('growthCoach.plan.editTitle')}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth label={t('growthCoach.plan.targetType')} value={draft.targetType}
              onChange={(event) => update('targetType', event.target.value)}>
              {['PERCENTAGE', 'FIXED_AMOUNT', 'R_MULTIPLE', 'PROP_TARGET', 'CAPITAL_MILESTONE'].map((value) => (
                <MenuItem key={value} value={value}>{t(`growthCoach.targetTypes.${value}`)}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth label={t('growthCoach.plan.targetBasis')} value={draft.targetBasis}
              onChange={(event) => update('targetBasis', event.target.value)}>
              {['MONTH_START_BALANCE', 'INITIAL_CAPITAL', 'CURRENT_EQUITY', 'COMPOUNDED_MONTHLY_BALANCE'].map((value) => (
                <MenuItem key={value} value={value}>{t(`growthCoach.targetBases.${value}`)}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>{numberField('targetPct', 'growthCoach.plan.targetPct')}</Grid>
          <Grid item xs={12} sm={6}>{numberField('targetAmount', 'growthCoach.plan.targetAmount')}</Grid>
          <Grid item xs={12} sm={6}>{numberField('targetR', 'growthCoach.plan.targetR')}</Grid>
          <Grid item xs={12} sm={6}>{numberField('plannedMinimumRr', 'growthCoach.plan.minimumRr')}</Grid>
          <Grid item xs={12} sm={6}>{numberField('plannedRiskPerTradePct', 'growthCoach.plan.plannedRisk')}</Grid>
          <Grid item xs={12} sm={6}>{numberField('hardMaxRiskPerTradePct', 'growthCoach.plan.hardMaxRisk')}</Grid>
          <Grid item xs={12} sm={6}>{numberField('plannedMaxTradesPerDay', 'growthCoach.plan.maxTradesDay')}</Grid>
          <Grid item xs={12} sm={6}>{numberField('plannedMaxTradesPerWeek', 'growthCoach.plan.maxTradesWeek')}</Grid>
          <Grid item xs={12}>
            <TextField fullWidth label={t('growthCoach.plan.changeReason')} value={draft.changeReason || ''}
              onChange={(event) => update('changeReason', event.target.value)} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={saving} onClick={() => void onSave(draft)}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

type LedgerDialogProps = {
  open: boolean
  currency: string
  saving: boolean
  onClose: () => void
  onSave: (request: LedgerEventRequest) => Promise<void>
}

export function LedgerEventDialog({ open, currency, saving, onClose, onSave }: LedgerDialogProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState<LedgerEventRequest>({
    eventType: 'DEPOSIT',
    amount: 0,
    currency,
    eventTime: new Date().toISOString(),
    description: '',
    externalReference: ''
  })

  useEffect(() => {
    setDraft((current) => ({ ...current, currency }))
  }, [currency])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('growthCoach.ledger.addTitle')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField select fullWidth label={t('growthCoach.ledger.type')} value={draft.eventType}
            onChange={(event) => setDraft((current) => ({ ...current, eventType: event.target.value }))}>
            {['DEPOSIT', 'WITHDRAWAL', 'PAYOUT', 'PLATFORM_FEE', 'DATA_FEE', 'RESET_FEE', 'TAX',
              'MANUAL_ADJUSTMENT', 'PROFIT_SPLIT', 'ACCOUNT_RESET', 'OTHER'].map((value) => (
              <MenuItem key={value} value={value}>{t(`growthCoach.ledger.types.${value}`)}</MenuItem>
            ))}
          </TextField>
          <TextField fullWidth type="number" label={t('growthCoach.ledger.amount')} value={draft.amount}
            inputProps={{ step: 'any' }} onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value) }))} />
          <TextField fullWidth type="datetime-local" label={t('growthCoach.ledger.date')}
            InputLabelProps={{ shrink: true }} value={draft.eventTime.slice(0, 16)}
            onChange={(event) => setDraft((current) => ({ ...current, eventTime: new Date(event.target.value).toISOString() }))} />
          <TextField fullWidth label={t('growthCoach.ledger.description')} value={draft.description || ''}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          <TextField fullWidth label={t('growthCoach.ledger.reference')} value={draft.externalReference || ''}
            onChange={(event) => setDraft((current) => ({ ...current, externalReference: event.target.value }))} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={saving || !draft.amount} onClick={() => void onSave(draft)}>
          {saving ? t('common.saving') : t('growthCoach.ledger.add')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

type PeriodPlanDialogProps = {
  open: boolean
  plan: GrowthPeriodPlan
  saving: boolean
  onClose: () => void
  onSave: (request: PeriodPlanRequest) => Promise<void>
}

export function PeriodPlanDialog({ open, plan, saving, onClose, onSave }: PeriodPlanDialogProps) {
  const { t } = useI18n()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [draft, setDraft] = useState<PeriodPlanRequest>({
    targetType: plan.targetType,
    targetValue: plan.targetValue,
    maxLossType: plan.maxLossType,
    maxLossValue: plan.maxLossValue,
    maxTrades: plan.maxTrades,
    maxRiskBudget: plan.maxRiskBudget,
    maxConsecutiveLosses: plan.maxConsecutiveLosses,
    maxLosingDays: plan.maxLosingDays,
    defaultRiskPerTrade: plan.defaultRiskPerTrade,
    minimumRr: plan.minimumRr,
    stopAfterTarget: plan.stopAfterTarget,
    reduceRiskAfterTarget: plan.reduceRiskAfterTarget,
    riskReductionPct: plan.riskReductionPct,
    stopAfterMaxLoss: plan.stopAfterMaxLoss,
    stopAfterConsecutiveLosses: plan.stopAfterConsecutiveLosses,
    permittedSessions: plan.permittedSessions,
    focus: plan.focus,
    notes: plan.notes,
    allocationMode: plan.allocationMode,
    active: plan.active,
    changeReason: ''
  })

  useEffect(() => {
    setDraft({
      targetType: plan.targetType,
      targetValue: plan.targetValue,
      maxLossType: plan.maxLossType,
      maxLossValue: plan.maxLossValue,
      maxTrades: plan.maxTrades,
      maxRiskBudget: plan.maxRiskBudget,
      maxConsecutiveLosses: plan.maxConsecutiveLosses,
      maxLosingDays: plan.maxLosingDays,
      defaultRiskPerTrade: plan.defaultRiskPerTrade,
      minimumRr: plan.minimumRr,
      stopAfterTarget: plan.stopAfterTarget,
      reduceRiskAfterTarget: plan.reduceRiskAfterTarget,
      riskReductionPct: plan.riskReductionPct,
      stopAfterMaxLoss: plan.stopAfterMaxLoss,
      stopAfterConsecutiveLosses: plan.stopAfterConsecutiveLosses,
      permittedSessions: plan.permittedSessions,
      focus: plan.focus,
      notes: plan.notes,
      allocationMode: plan.allocationMode,
      active: plan.active,
      changeReason: ''
    })
  }, [plan])

  const update = <K extends keyof PeriodPlanRequest>(key: K, value: PeriodPlanRequest[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const numberField = (key: keyof PeriodPlanRequest, labelKey: string) => (
    <TextField fullWidth type="number" label={t(labelKey)}
      value={(draft[key] as number | null | undefined) ?? ''}
      inputProps={{ step: 'any' }}
      onChange={(event) => update(key, numeric(event.target.value) as never)} />
  )

  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="md">
      <DialogTitle>{t('growthCoach.periodPlan.editTitle', { period: t(`growthCoach.periods.${plan.periodType}`) })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">{t('growthCoach.periodPlan.referenceHint')}</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label={t('growthCoach.plan.targetType')} value={draft.targetType}
                onChange={(event) => update('targetType', event.target.value)}>
                {['FIXED_AMOUNT', 'PERCENTAGE', 'R_MULTIPLE'].map((value) => (
                  <MenuItem key={value} value={value}>{t(`growthCoach.targetTypes.${value}`)}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>{numberField('targetValue', 'growthCoach.periodPlan.targetValue')}</Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label={t('growthCoach.periodPlan.maxLossType')} value={draft.maxLossType}
                onChange={(event) => update('maxLossType', event.target.value)}>
                {['FIXED_AMOUNT', 'PERCENTAGE', 'R_MULTIPLE'].map((value) => (
                  <MenuItem key={value} value={value}>{t(`growthCoach.targetTypes.${value}`)}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>{numberField('maxLossValue', 'growthCoach.periodPlan.maxLossValue')}</Grid>
            <Grid item xs={12} sm={6}>{numberField('maxTrades', 'growthCoach.periodPlan.maxTrades')}</Grid>
            <Grid item xs={12} sm={6}>{numberField('maxRiskBudget', 'growthCoach.periodPlan.maxRiskBudget')}</Grid>
            <Grid item xs={12} sm={6}>{numberField('maxConsecutiveLosses', 'growthCoach.periodPlan.maxConsecutiveLosses')}</Grid>
            <Grid item xs={12} sm={6}>{numberField('maxLosingDays', 'growthCoach.periodPlan.maxLosingDays')}</Grid>
            <Grid item xs={12} sm={6}>{numberField('defaultRiskPerTrade', 'growthCoach.periodPlan.defaultRisk')}</Grid>
            <Grid item xs={12} sm={6}>{numberField('minimumRr', 'growthCoach.plan.minimumRr')}</Grid>
            <Grid item xs={12} sm={6}>{numberField('riskReductionPct', 'growthCoach.periodPlan.riskReduction')}</Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label={t('growthCoach.periodPlan.allocationMode')} value={draft.allocationMode}
                onChange={(event) => update('allocationMode', event.target.value as PeriodPlanRequest['allocationMode'])}>
                {['MANUAL', 'AUTOMATIC'].map((value) => (
                  <MenuItem key={value} value={value}>{t(`growthCoach.periodPlan.allocationModes.${value}`)}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}><TextField fullWidth label={t('growthCoach.periodPlan.sessions')}
              value={draft.permittedSessions || ''} onChange={(event) => update('permittedSessions', event.target.value)} /></Grid>
            <Grid item xs={12}><TextField fullWidth label={t('growthCoach.periodPlan.focus')}
              value={draft.focus || ''} onChange={(event) => update('focus', event.target.value)} /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline minRows={2} label={t('growthCoach.periodPlan.notes')}
              value={draft.notes || ''} onChange={(event) => update('notes', event.target.value)} /></Grid>
            <Grid item xs={12}>
              <Stack>
                <FormControlLabel control={<Switch checked={draft.stopAfterTarget}
                  onChange={(_, value) => update('stopAfterTarget', value)} />}
                  label={t('growthCoach.periodPlan.stopAfterTarget')} />
                <FormControlLabel control={<Switch checked={draft.reduceRiskAfterTarget}
                  onChange={(_, value) => update('reduceRiskAfterTarget', value)} />}
                  label={t('growthCoach.periodPlan.reduceAfterTarget')} />
                <FormControlLabel control={<Switch checked={draft.stopAfterMaxLoss}
                  onChange={(_, value) => update('stopAfterMaxLoss', value)} />}
                  label={t('growthCoach.periodPlan.stopAfterLoss')} />
                <FormControlLabel control={<Switch checked={draft.stopAfterConsecutiveLosses}
                  onChange={(_, value) => update('stopAfterConsecutiveLosses', value)} />}
                  label={t('growthCoach.periodPlan.stopAfterStreak')} />
                <FormControlLabel control={<Switch checked={draft.active}
                  onChange={(_, value) => update('active', value)} />}
                  label={t('growthCoach.periodPlan.active')} />
              </Stack>
            </Grid>
            <Grid item xs={12}><TextField required fullWidth label={t('growthCoach.plan.changeReason')}
              value={draft.changeReason} onChange={(event) => update('changeReason', event.target.value)} /></Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={saving || !draft.changeReason.trim()} onClick={() => void onSave(draft)}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

type ReconcileBalanceDialogProps = {
  open: boolean
  currency: string
  timezone: string
  systemBalance?: number | null
  saving: boolean
  onClose: () => void
  onSave: (request: ReconcileBalanceRequest) => Promise<void>
}

export function ReconcileBalanceDialog({
  open, currency, timezone, systemBalance, saving, onClose, onSave
}: ReconcileBalanceDialogProps) {
  const { t } = useI18n()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const now = new Date()
  const [draft, setDraft] = useState<ReconcileBalanceRequest>({
    brokerReportedBalance: systemBalance || 0,
    effectiveDate: now.toISOString().slice(0, 10),
    effectiveTime: now.toTimeString().slice(0, 5),
    timezone,
    reason: '',
    note: '',
    externalReference: '',
    planningBehavior: 'PRESERVE_BASELINE',
    resetConfirmed: false
  })

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      brokerReportedBalance: systemBalance || 0,
      timezone
    }))
  }, [systemBalance, timezone])

  const difference = draft.brokerReportedBalance - (systemBalance || 0)
  return (
    <Dialog open={open} onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm">
      <DialogTitle>{t('growthCoach.reconcile.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">{t('growthCoach.reconcile.subtitle')}</Typography>
          <TextField fullWidth disabled label={t('growthCoach.reconcile.systemBalance')}
            value={`${currency} ${(systemBalance || 0).toFixed(2)}`} />
          <TextField fullWidth type="number" label={t('growthCoach.reconcile.brokerBalance')}
            value={draft.brokerReportedBalance} inputProps={{ step: 'any' }}
            onChange={(event) => setDraft((current) => ({ ...current, brokerReportedBalance: Number(event.target.value) }))} />
          <Typography fontWeight={700}>{t('growthCoach.reconcile.difference')}: {currency} {difference.toFixed(2)}</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField fullWidth type="date" label={t('growthCoach.reconcile.effectiveDate')}
              InputLabelProps={{ shrink: true }} value={draft.effectiveDate}
              onChange={(event) => setDraft((current) => ({ ...current, effectiveDate: event.target.value }))} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth type="time" label={t('growthCoach.reconcile.effectiveTime')}
              InputLabelProps={{ shrink: true }} value={draft.effectiveTime}
              onChange={(event) => setDraft((current) => ({ ...current, effectiveTime: event.target.value }))} /></Grid>
          </Grid>
          <TextField fullWidth label={t('growthCoach.reconcile.timezone')} value={draft.timezone}
            onChange={(event) => setDraft((current) => ({ ...current, timezone: event.target.value }))} />
          <TextField required fullWidth label={t('growthCoach.reconcile.reason')} value={draft.reason}
            onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} />
          <TextField fullWidth multiline minRows={2} label={t('growthCoach.reconcile.note')} value={draft.note}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} />
          <TextField fullWidth label={t('growthCoach.ledger.reference')} value={draft.externalReference}
            onChange={(event) => setDraft((current) => ({ ...current, externalReference: event.target.value }))} />
          <TextField select fullWidth label={t('growthCoach.reconcile.planningBehavior')} value={draft.planningBehavior}
            onChange={(event) => setDraft((current) => ({
              ...current,
              planningBehavior: event.target.value as ReconcileBalanceRequest['planningBehavior']
            }))}>
            {['PRESERVE_BASELINE', 'REBASE_FUTURE', 'RESET_CURRENT'].map((value) => (
              <MenuItem key={value} value={value}>{t(`growthCoach.reconcile.behaviors.${value}`)}</MenuItem>
            ))}
          </TextField>
          {draft.planningBehavior === 'RESET_CURRENT' && (
            <FormControlLabel control={<Switch checked={draft.resetConfirmed}
              onChange={(_, value) => setDraft((current) => ({ ...current, resetConfirmed: value }))} />}
              label={t('growthCoach.reconcile.confirmReset')} />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="contained" disabled={saving || !draft.reason.trim() || difference === 0 ||
          (draft.planningBehavior === 'RESET_CURRENT' && !draft.resetConfirmed)}
          onClick={() => void onSave(draft)}>
          {saving ? t('common.saving') : t('growthCoach.reconcile.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
