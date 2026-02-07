import { ReactNode, useEffect } from 'react'
import { Box, Button, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { TradeFormValues } from '../../utils/tradePayload'
import { formatNumber, formatPercent } from '../../utils/format'
import { useI18n } from '../../i18n'

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
}

export function TradeForm({ initialValues, submitLabel, onSubmit, onCancel, error, secondaryAction, computedValues }: TradeFormProps) {
  const { t } = useI18n()
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<TradeFormValues>({ defaultValues: initialValues })

  useEffect(() => {
    reset(initialValues)
  }, [initialValues, reset])

  const submitHandler = async (values: TradeFormValues) => {
    await onSubmit(values)
  }

  return (
    <Box component="form" onSubmit={handleSubmit(submitHandler)}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.symbol')} required fullWidth error={!!errors.symbol} helperText={errors.symbol ? t('trades.form.validation.symbolRequired') : ''} {...register('symbol', { required: true })} />
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
          <TextField label={t('trades.form.openedAt')} type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} {...register('openedAt', { required: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.closedAt')} type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} {...register('closedAt')} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.timeframe')} fullWidth {...register('timeframe')} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.quantity')} type="number" inputProps={{ step: '0.01' }} fullWidth required {...register('quantity', { valueAsNumber: true, required: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.entryPrice')} type="number" inputProps={{ step: '0.000001' }} fullWidth required {...register('entryPrice', { valueAsNumber: true, required: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.exitPrice')} type="number" inputProps={{ step: '0.000001' }} fullWidth {...register('exitPrice', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.stopLossPrice')} type="number" inputProps={{ step: '0.000001' }} fullWidth {...register('stopLossPrice', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.takeProfitPrice')} type="number" inputProps={{ step: '0.000001' }} fullWidth {...register('takeProfitPrice', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.fees')} type="number" inputProps={{ step: '0.0001' }} fullWidth {...register('fees', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.commission')} type="number" inputProps={{ step: '0.0001' }} fullWidth {...register('commission', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.slippage')} type="number" inputProps={{ step: '0.0001' }} fullWidth {...register('slippage', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.riskAmount')} type="number" inputProps={{ step: '0.0001' }} fullWidth helperText={t('trades.form.riskAmountHint')} {...register('riskAmount', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.capitalUsed')} type="number" inputProps={{ step: '0.0001' }} fullWidth helperText={t('trades.form.capitalUsedHint')} {...register('capitalUsed', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.setup')} fullWidth {...register('setup')} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.strategyTag')} fullWidth {...register('strategyTag')} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.catalystTag')} fullWidth {...register('catalystTag')} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label={t('trades.form.accountId')} fullWidth {...register('accountId')} />
        </Grid>
        <Grid item xs={12}>
          <TextField label={t('trades.form.notes')} fullWidth multiline minRows={3} {...register('notes')} />
        </Grid>

        {computedValues && (
          <>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">{t('trades.form.computedMetrics')}</Typography>
            </Grid>
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
          </>
        )}
      </Grid>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={2} justifyContent="flex-start" alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Button type="submit" variant="contained">{submitLabel}</Button>
        {onCancel && <Button variant="outlined" color="inherit" onClick={onCancel}>{t('common.cancel')}</Button>}
        {secondaryAction}
        {error && <Box sx={{ color: 'error.main' }}>{error}</Box>}
      </Stack>
    </Box>
  )
}
