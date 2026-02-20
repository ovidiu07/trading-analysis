import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import { ReactNode, useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { PlanSource } from '../../api/plans'
import { useActivePlansForTradeQuery } from '../../hooks/usePlans'
import { useI18n } from '../../i18n'
import { formatNumber, formatPercent } from '../../utils/format'
import { TradeFormValues } from '../../utils/tradePayload'

export type ComputedTradeMetrics = {
  pnlGross?: number | null
  pnlNet?: number | null
  pnlPercent?: number | null
  riskPercent?: number | null
  rMultiple?: number | null
}

export type TradeFormProps = {
  initialValues: TradeFormValues
  submitLabel: string
  onSubmit: (values: TradeFormValues) => Promise<void>
  onCancel?: () => void
  error?: string
  secondaryAction?: ReactNode
  computedValues?: ComputedTradeMetrics
  stickyActions?: boolean
  strategyOptions?: Array<{ id: string; label: string }>
  planOptions?: Array<{ id: string; label: string; source?: PlanSource }>
  ruleBreakOptions?: string[]
}

const localDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/
const timezoneRegex = /(Z|[+-]\d{2}:\d{2})$/i

const toIsoDateTime = (value: string): string => {
  if (localDateTimeRegex.test(value) && !timezoneRegex.test(value)) {
    const withSeconds = value.length === 16 ? `${value}:00` : value
    return new Date(`${withSeconds}Z`).toISOString()
  }
  return new Date(value).toISOString()
}

export function TradeForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  error,
  secondaryAction,
  computedValues,
  stickyActions = false,
  strategyOptions = [],
  planOptions = [],
  ruleBreakOptions = []
}: TradeFormProps) {
  const { t } = useI18n()
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<TradeFormValues>({ defaultValues: initialValues })

  useEffect(() => {
    reset(initialValues)
  }, [initialValues, reset])

  const statusValue = watch('status')
  const openedAtValue = watch('openedAt')
  const tradeCurrencyValue = watch('tradeCurrency')
  const profileCurrencyValue = watch('profileCurrency')
  const showClosedFields = statusValue === 'CLOSED'

  const openedAtIso = useMemo(() => {
    if (!openedAtValue || !openedAtValue.trim()) return ''
    try {
      return toIsoDateTime(openedAtValue)
    } catch {
      return ''
    }
  }, [openedAtValue])

  const activePlansQuery = useActivePlansForTradeQuery(openedAtIso, undefined, Boolean(openedAtIso))
  const activePlanOptions = useMemo(() => (
    (activePlansQuery.data?.plans || []).map((plan) => ({
      id: plan.id,
      source: plan.source,
      label: plan.source === 'MENTOR'
        ? `${t('trades.form.mentorFocusPrefix')}: ${plan.title}`
        : `${t('trades.form.myPlanPrefix')}: ${plan.title}`
    }))
  ), [activePlansQuery.data?.plans, t])

  const allPlanOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string; source?: PlanSource }>()
    ;[...activePlanOptions, ...planOptions].forEach((option) => {
      if (!map.has(option.id)) {
        map.set(option.id, option)
      }
    })
    return Array.from(map.values())
  }, [activePlanOptions, planOptions])

  const planOptionsById = useMemo(() => {
    const map = new Map<string, { id: string; label: string; source?: PlanSource }>()
    allPlanOptions.forEach((option) => map.set(option.id, option))
    return map
  }, [allPlanOptions])

  const submitHandler = async (values: TradeFormValues) => {
    await onSubmit(values)
  }

  return (
    <Box component="form" onSubmit={handleSubmit(submitHandler)}>
      <Stack spacing={1.5}>
        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">{t('trades.form.sections.required')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.symbol')}
                  required
                  fullWidth
                  error={!!errors.symbol}
                  helperText={errors.symbol ? t('trades.form.validation.symbolRequired') : ''}
                  {...register('symbol', { required: true })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  name="market"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField label={t('trades.form.market')} select required fullWidth {...field}>
                      <MenuItem value="STOCK">{t('trades.market.STOCK')}</MenuItem>
                      <MenuItem value="CFD">{t('trades.market.CFD')}</MenuItem>
                      <MenuItem value="FOREX">{t('trades.market.FOREX')}</MenuItem>
                      <MenuItem value="CRYPTO">{t('trades.market.CRYPTO')}</MenuItem>
                      <MenuItem value="FUTURES">{t('trades.market.FUTURES')}</MenuItem>
                      <MenuItem value="OPTIONS">{t('trades.market.OPTIONS')}</MenuItem>
                      <MenuItem value="OTHER">{t('trades.market.OTHER')}</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  name="direction"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField label={t('trades.form.direction')} select required fullWidth {...field}>
                      <MenuItem value="LONG">{t('trades.direction.LONG')}</MenuItem>
                      <MenuItem value="SHORT">{t('trades.direction.SHORT')}</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  name="status"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField label={t('trades.form.status')} select required fullWidth {...field}>
                      <MenuItem value="OPEN">{t('trades.status.OPEN')}</MenuItem>
                      <MenuItem value="CLOSED">{t('trades.status.CLOSED')}</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.openedAt')}
                  type="datetime-local"
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                  {...register('openedAt', { required: true })}
                />
              </Grid>
              {showClosedFields && (
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label={t('trades.form.closedAt')}
                    type="datetime-local"
                    fullWidth
                    required
                    InputLabelProps={{ shrink: true }}
                    {...register('closedAt', { required: true })}
                  />
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">{t('trades.form.sections.execution')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.quantity')}
                  type="number"
                  inputProps={{ step: '0.01' }}
                  fullWidth
                  required
                  {...register('quantity', { valueAsNumber: true, required: true })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.entryPrice')}
                  type="number"
                  inputProps={{ step: '0.000001' }}
                  fullWidth
                  required
                  {...register('entryPrice', { valueAsNumber: true, required: true })}
                />
              </Grid>
              {showClosedFields && (
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    label={t('trades.form.exitPrice')}
                    type="number"
                    inputProps={{ step: '0.000001' }}
                    fullWidth
                    required
                    {...register('exitPrice', { valueAsNumber: true, required: true })}
                  />
                </Grid>
              )}
              <Grid item xs={12} sm={6} md={4}>
                <TextField label={t('trades.form.timeframe')} fullWidth {...register('timeframe')} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.tradeCurrency')}
                  fullWidth
                  inputProps={{ maxLength: 3 }}
                  value={(tradeCurrencyValue || '').toUpperCase()}
                  onChange={(event) => setValue('tradeCurrency', event.target.value.toUpperCase())}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.profileCurrency')}
                  fullWidth
                  inputProps={{ maxLength: 3 }}
                  value={(profileCurrencyValue || '').toUpperCase()}
                  onChange={(event) => setValue('profileCurrency', event.target.value.toUpperCase())}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.fxRate')}
                  type="number"
                  inputProps={{ step: '0.0001', min: 0 }}
                  fullWidth
                  {...register('fxRateTradeToProfile', { valueAsNumber: true })}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">{t('trades.form.sections.risk')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.stopLossPrice')}
                  type="number"
                  inputProps={{ step: '0.000001' }}
                  fullWidth
                  {...register('stopLossPrice', { valueAsNumber: true })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.takeProfitPrice')}
                  type="number"
                  inputProps={{ step: '0.000001' }}
                  fullWidth
                  {...register('takeProfitPrice', { valueAsNumber: true })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.riskAmount')}
                  type="number"
                  inputProps={{ step: '0.0001' }}
                  fullWidth
                  helperText={t('trades.form.riskAmountHint')}
                  {...register('riskAmount', { valueAsNumber: true })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.capitalUsed')}
                  type="number"
                  inputProps={{ step: '0.0001' }}
                  fullWidth
                  helperText={t('trades.form.capitalUsedHint')}
                  {...register('capitalUsed', { valueAsNumber: true })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField label={t('trades.form.accountId')} fullWidth {...register('accountId')} />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">{t('trades.form.sections.costs')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.fees')}
                  type="number"
                  inputProps={{ step: '0.0001' }}
                  fullWidth
                  {...register('fees', { valueAsNumber: true })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.commission')}
                  type="number"
                  inputProps={{ step: '0.0001' }}
                  fullWidth
                  {...register('commission', { valueAsNumber: true })}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('trades.form.slippage')}
                  type="number"
                  inputProps={{ step: '0.0001' }}
                  fullWidth
                  {...register('slippage', { valueAsNumber: true })}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">{t('trades.form.sections.context')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField label={t('trades.form.setup')} fullWidth {...register('setup')} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  name="strategyId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label={t('trades.form.strategy')}
                      select
                      fullWidth
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    >
                      <MenuItem value="">{t('trades.form.none')}</MenuItem>
                      {strategyOptions.map((option) => (
                        <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  name="setupGrade"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label={t('trades.form.setupGrade')}
                      select
                      fullWidth
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    >
                      <MenuItem value="">{t('trades.form.none')}</MenuItem>
                      <MenuItem value="A">A</MenuItem>
                      <MenuItem value="B">B</MenuItem>
                      <MenuItem value="C">C</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField label={t('trades.form.strategyTag')} fullWidth {...register('strategyTag')} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField label={t('trades.form.catalystTag')} fullWidth {...register('catalystTag')} />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Controller
                  name="session"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label={t('trades.form.session')}
                      select
                      fullWidth
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    >
                      <MenuItem value="">{t('trades.form.none')}</MenuItem>
                      <MenuItem value="ASIA">{t('trades.form.sessions.ASIA')}</MenuItem>
                      <MenuItem value="LONDON">{t('trades.form.sessions.LONDON')}</MenuItem>
                      <MenuItem value="NY_AM">{t('trades.form.sessions.NY_AM')}</MenuItem>
                      <MenuItem value="NY_PM">{t('trades.form.sessions.NY_PM')}</MenuItem>
                      <MenuItem value="NY">{t('trades.form.sessions.NY')}</MenuItem>
                      <MenuItem value="CUSTOM">{t('trades.form.sessions.CUSTOM')}</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="linkedPlanIds"
                  control={control}
                  render={({ field }) => (
                    <Autocomplete<{ id: string; label: string; source?: PlanSource }, true, false, false>
                      multiple
                      options={allPlanOptions}
                      value={(field.value || []).map((id) => planOptionsById.get(id) || { id, label: id })}
                      onChange={(_, value) => field.onChange(value.map((item) => item.id))}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      getOptionLabel={(option) => option.label}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            {...getTagProps({ index })}
                            key={option.id}
                            size="small"
                            label={option.label}
                          />
                        ))
                      }
                      noOptionsText={t('trades.form.none')}
                      renderInput={(params) => (
                        <TextField {...params} label={t('trades.form.linkedPlans')} />
                      )}
                    />
                  )}
                />
                <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="text"
                    disabled={!activePlansQuery.data || activePlansQuery.isFetching}
                    onClick={() => {
                      const suggested = activePlansQuery.data?.suggestedPlanIds || []
                      setValue('linkedPlanIds', suggested, { shouldDirty: true, shouldValidate: true })
                    }}
                  >
                    {t('trades.form.linkActivePlans')}
                  </Button>
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Controller
                  name="ruleBreaks"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      label={t('trades.form.ruleBreaks')}
                      select
                      fullWidth
                      value={field.value ?? []}
                      onChange={(event) => {
                        const value = event.target.value
                        field.onChange(typeof value === 'string' ? value.split(',') : value)
                      }}
                      SelectProps={{
                        multiple: true,
                        renderValue: (selected) => (selected as string[]).join(', ')
                      }}
                    >
                      {ruleBreakOptions.map((option) => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField label={t('trades.form.notes')} fullWidth multiline minRows={3} {...register('notes')} />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {computedValues && (
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">{t('trades.form.computedMetrics')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label={t('trades.form.pnlGross')} value={formatNumber(computedValues.pnlGross)} fullWidth InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label={t('trades.form.pnlNet')} value={formatNumber(computedValues.pnlNet)} fullWidth InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label={t('trades.form.pnlPercent')} value={formatPercent(computedValues.pnlPercent)} fullWidth InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label={t('trades.form.riskPercent')} value={formatPercent(computedValues.riskPercent)} fullWidth InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField label={t('trades.form.rMultiple')} value={formatNumber(computedValues.rMultiple)} fullWidth InputProps={{ readOnly: true }} />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}
      </Stack>

      <Box
        sx={(theme) => ({
          mt: 2,
          pt: stickyActions ? 1.5 : 0,
          position: stickyActions ? 'sticky' : 'static',
          bottom: stickyActions ? 0 : 'auto',
          zIndex: stickyActions ? 2 : 0,
          borderTop: stickyActions ? '1px solid' : 'none',
          borderColor: stickyActions ? 'divider' : 'transparent',
          pb: stickyActions ? 'calc(10px + env(safe-area-inset-bottom))' : 0,
          backgroundColor: stickyActions ? alpha(theme.palette.background.paper, 0.97) : 'transparent',
          backdropFilter: stickyActions ? 'blur(8px)' : 'none'
        })}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="flex-start" alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button type="submit" variant="contained" fullWidth={stickyActions}>{submitLabel}</Button>
          {onCancel && <Button variant="outlined" color="inherit" onClick={onCancel}>{t('common.cancel')}</Button>}
          {secondaryAction}
          {error && <Box sx={{ color: 'error.main' }}>{error}</Box>}
        </Stack>
      </Box>
    </Box>
  )
}
