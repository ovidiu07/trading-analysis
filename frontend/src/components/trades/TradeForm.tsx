import { ReactNode, useEffect } from 'react'
import { Box, Button, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { TradeFormValues } from '../../utils/tradePayload'
import { formatNumber, formatPercent } from '../../utils/format'

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
          <TextField label="Symbol" required fullWidth error={!!errors.symbol} helperText={errors.symbol?.message} {...register('symbol', { required: 'Symbol is required' })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Controller
            name="market"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <TextField label="Market" select required fullWidth {...field}>
                <MenuItem value="STOCK">Stock</MenuItem>
                <MenuItem value="CFD">CFD</MenuItem>
                <MenuItem value="FOREX">Forex</MenuItem>
                <MenuItem value="CRYPTO">Crypto</MenuItem>
                <MenuItem value="FUTURES">Futures</MenuItem>
                <MenuItem value="OPTIONS">Options</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
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
              <TextField label="Direction" select required fullWidth {...field}>
                <MenuItem value="LONG">Long</MenuItem>
                <MenuItem value="SHORT">Short</MenuItem>
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
              <TextField label="Status" select required fullWidth {...field}>
                <MenuItem value="OPEN">Open</MenuItem>
                <MenuItem value="CLOSED">Closed</MenuItem>
              </TextField>
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Opened At" type="datetime-local" fullWidth required InputLabelProps={{ shrink: true }} {...register('openedAt', { required: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Closed At" type="datetime-local" fullWidth InputLabelProps={{ shrink: true }} {...register('closedAt')} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Timeframe" fullWidth {...register('timeframe')} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Quantity" type="number" inputProps={{ step: '0.01' }} fullWidth required {...register('quantity', { valueAsNumber: true, required: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Entry Price" type="number" inputProps={{ step: '0.000001' }} fullWidth required {...register('entryPrice', { valueAsNumber: true, required: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Exit Price" type="number" inputProps={{ step: '0.000001' }} fullWidth {...register('exitPrice', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Stop Loss Price" type="number" inputProps={{ step: '0.000001' }} fullWidth {...register('stopLossPrice', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Take Profit Price" type="number" inputProps={{ step: '0.000001' }} fullWidth {...register('takeProfitPrice', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Fees" type="number" inputProps={{ step: '0.0001' }} fullWidth {...register('fees', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Commission" type="number" inputProps={{ step: '0.0001' }} fullWidth {...register('commission', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Slippage" type="number" inputProps={{ step: '0.0001' }} fullWidth {...register('slippage', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Risk Amount" type="number" inputProps={{ step: '0.0001' }} fullWidth helperText="Optional: improves P&L % and R multiple" {...register('riskAmount', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Capital Used" type="number" inputProps={{ step: '0.0001' }} fullWidth helperText="Optional: improves P&L %" {...register('capitalUsed', { valueAsNumber: true })} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Setup" fullWidth {...register('setup')} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Strategy Tag" fullWidth {...register('strategyTag')} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Catalyst Tag" fullWidth {...register('catalystTag')} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField label="Account ID" fullWidth {...register('accountId')} />
        </Grid>
        <Grid item xs={12}>
          <TextField label="Notes" fullWidth multiline minRows={3} {...register('notes')} />
        </Grid>

        {computedValues && (
          <>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">Computed metrics (read-only)</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField label="PnL Gross" value={formatNumber(computedValues.pnlGross)} fullWidth InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField label="PnL Net" value={formatNumber(computedValues.pnlNet)} fullWidth InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField label="PnL Percent" value={formatPercent(computedValues.pnlPercent)} fullWidth InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField label="Risk Percent" value={formatPercent(computedValues.riskPercent)} fullWidth InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField label="R Multiple" value={formatNumber(computedValues.rMultiple)} fullWidth InputProps={{ readOnly: true }} />
            </Grid>
          </>
        )}
      </Grid>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={2} justifyContent="flex-start" alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Button type="submit" variant="contained">{submitLabel}</Button>
        {onCancel && <Button variant="outlined" color="inherit" onClick={onCancel}>Cancel</Button>}
        {secondaryAction}
        {error && <Box sx={{ color: 'error.main' }}>{error}</Box>}
      </Stack>
    </Box>
  )
}
