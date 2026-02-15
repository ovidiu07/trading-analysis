import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { TradeRequest } from '../../api/trades'
import { useI18n } from '../../i18n'
import { TradeFormValues } from '../../utils/tradePayload'
import { tradeValidationSchema } from '../../utils/tradeValidationSchema'
import { SessionChips } from './SessionChips'
import { saveRecentSymbol, SymbolAutocomplete } from './SymbolAutocomplete'
import { TradeLiveSummary } from './TradeLiveSummary'
import { TradeModeSwitch, type TradeEntryMode } from './TradeModeSwitch'

type ContentOption = {
  id: string
  label: string
}

type TradeCreateFormV2Props = {
  initialValues: TradeFormValues
  submitLabel: string
  onSubmit: (values: TradeFormValues) => Promise<void>
  onCancel?: () => void
  error?: string
  strategyOptions?: ContentOption[]
  planOptions?: ContentOption[]
  ruleBreakOptions?: string[]
  baseCurrency: string
  timezone: string
  defaultMode?: TradeEntryMode
}

const MARKET_OPTIONS: Array<{ value: TradeRequest['market']; short: string }> = [
  { value: 'STOCK', short: 'EQ' },
  { value: 'CFD', short: 'CFD' },
  { value: 'FOREX', short: 'FX' },
  { value: 'CRYPTO', short: 'CR' },
  { value: 'FUTURES', short: 'FUT' },
  { value: 'OPTIONS', short: 'OPT' },
  { value: 'OTHER', short: 'OTR' }
]

const parseLocalizedNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\s+/g, '').replace(',', '.')
    if (!normalized) return undefined
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const normalizeDefaults = (values: TradeFormValues): TradeFormValues => ({
  symbol: values.symbol || '',
  market: values.market,
  direction: values.direction,
  status: values.status,
  openedAt: values.openedAt || '',
  closedAt: values.closedAt || undefined,
  timeframe: values.timeframe || undefined,
  quantity: values.quantity,
  entryPrice: values.entryPrice,
  exitPrice: values.exitPrice,
  stopLossPrice: values.stopLossPrice,
  takeProfitPrice: values.takeProfitPrice,
  fees: values.fees ?? 0,
  commission: values.commission ?? 0,
  slippage: values.slippage ?? 0,
  riskAmount: values.riskAmount,
  capitalUsed: values.capitalUsed,
  setup: values.setup || undefined,
  strategyTag: values.strategyTag || undefined,
  catalystTag: values.catalystTag || undefined,
  strategyId: values.strategyId || undefined,
  setupGrade: values.setupGrade || undefined,
  ruleBreaks: values.ruleBreaks || [],
  session: values.session || undefined,
  linkedContentIds: values.linkedContentIds || [],
  notes: values.notes || undefined,
  accountId: values.accountId || undefined
})

const toTradeFormValues = (values: TradeFormValues): TradeFormValues => ({
  ...values,
  symbol: values.symbol.trim().toUpperCase(),
  closedAt: values.status === 'CLOSED' ? values.closedAt : undefined,
  exitPrice: values.status === 'CLOSED' ? values.exitPrice : undefined,
  fees: values.fees ?? 0,
  commission: values.commission ?? 0,
  slippage: values.slippage ?? 0,
  ruleBreaks: values.ruleBreaks || [],
  linkedContentIds: values.linkedContentIds || []
})

const getLocalDateTime = () => new Date().toISOString().slice(0, 16)

export function TradeCreateFormV2({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  error,
  strategyOptions = [],
  planOptions = [],
  ruleBreakOptions = [],
  baseCurrency,
  timezone,
  defaultMode = 'advanced'
}: TradeCreateFormV2Props) {
  const { t } = useI18n()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const [mode, setMode] = useState<TradeEntryMode>(defaultMode)
  const [showValidationBanner, setShowValidationBanner] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  const {
    register,
    control,
    reset,
    watch,
    getValues,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting, isValid }
  } = useForm<TradeFormValues>({
    resolver: zodResolver(tradeValidationSchema as any) as any,
    defaultValues: normalizeDefaults(initialValues),
    mode: 'onChange'
  })

  useEffect(() => {
    reset(normalizeDefaults(initialValues))
    setMode(defaultMode)
    setShowValidationBanner(false)
  }, [defaultMode, initialValues, reset])

  const status = watch('status')

  useEffect(() => {
    if (status === 'OPEN') {
      setValue('closedAt', undefined, { shouldValidate: true })
      setValue('exitPrice', undefined, { shouldValidate: true })
      return
    }

    if (status === 'CLOSED' && !getValues('closedAt')) {
      setValue('closedAt', getLocalDateTime(), { shouldValidate: true })
    }
  }, [getValues, setValue, status])

  useEffect(() => {
    if (isValid) {
      setShowValidationBanner(false)
    }
  }, [isValid])

  const watchedValues = watch()

  const resolveError = (key: keyof TradeFormValues) => {
    const message = errors[key]?.message
    if (!message || typeof message !== 'string') return ''
    return t(message)
  }

  const decimalInputProps = {
    inputMode: 'decimal' as const,
    pattern: '^[0-9]*[.,]?[0-9]*$'
  }

  const currencyAdornment = useMemo(() => (
    <InputAdornment position="start">{baseCurrency}</InputAdornment>
  ), [baseCurrency])

  const submit = handleSubmit(async (values) => {
    const payload = toTradeFormValues(values)
    await onSubmit(payload)
    saveRecentSymbol(payload.symbol)
    setShowValidationBanner(false)
  }, () => {
    setShowValidationBanner(true)
  })

  const executionSection = (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Controller
            name="symbol"
            control={control}
            render={({ field }) => (
              <SymbolAutocomplete
                value={field.value}
                market={watch('market')}
                onChange={field.onChange}
                required
                error={!!errors.symbol}
                helperText={resolveError('symbol')}
              />
            )}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Controller
            name="market"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.market}>
                <Select {...field} displayEmpty>
                  {MARKET_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip size="small" label={option.short} variant="outlined" />
                        <Typography variant="body2">{t(`trades.market.${option.value}`)}</Typography>
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>{resolveError('market') || t('trades.form.marketHelper')}</FormHelperText>
              </FormControl>
            )}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Controller
            name="direction"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.direction}>
                <ToggleButtonGroup
                  value={field.value}
                  exclusive
                  onChange={(_, nextValue: TradeRequest['direction'] | null) => {
                    if (nextValue) field.onChange(nextValue)
                  }}
                  fullWidth
                >
                  <ToggleButton
                    value="LONG"
                    sx={{
                      '&.Mui-selected': {
                        color: 'success.main',
                        backgroundColor: 'success.50'
                      }
                    }}
                  >
                    {t('trades.direction.LONG')}
                  </ToggleButton>
                  <ToggleButton
                    value="SHORT"
                    sx={{
                      '&.Mui-selected': {
                        color: 'error.main',
                        backgroundColor: 'error.50'
                      }
                    }}
                  >
                    {t('trades.direction.SHORT')}
                  </ToggleButton>
                </ToggleButtonGroup>
                <FormHelperText>{resolveError('direction')}</FormHelperText>
              </FormControl>
            )}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.status}>
                <ToggleButtonGroup
                  value={field.value}
                  exclusive
                  onChange={(_, nextValue: TradeRequest['status'] | null) => {
                    if (nextValue) field.onChange(nextValue)
                  }}
                  fullWidth
                >
                  <ToggleButton value="OPEN">{t('trades.status.OPEN')}</ToggleButton>
                  <ToggleButton value="CLOSED">{t('trades.status.CLOSED')}</ToggleButton>
                </ToggleButtonGroup>
                <FormHelperText>{resolveError('status')}</FormHelperText>
              </FormControl>
            )}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            label={t('trades.form.openedAt')}
            type="datetime-local"
            fullWidth
            InputLabelProps={{ shrink: true }}
            error={!!errors.openedAt}
            helperText={resolveError('openedAt')}
            {...register('openedAt')}
          />
        </Grid>
        {status === 'CLOSED' && mode === 'advanced' && (
          <Grid item xs={12} md={6}>
            <TextField
              label={t('trades.form.closedAt')}
              type="datetime-local"
              fullWidth
              InputLabelProps={{ shrink: true }}
              error={!!errors.closedAt}
              helperText={resolveError('closedAt')}
              {...register('closedAt')}
            />
          </Grid>
        )}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField
            label={t('trades.form.quantity')}
            fullWidth
            error={!!errors.quantity}
            helperText={resolveError('quantity') || t('trades.form.quantityHelper')}
            inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
            {...register('quantity', { setValueAs: parseLocalizedNumber })}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label={t('trades.form.entryPrice')}
            fullWidth
            error={!!errors.entryPrice}
            helperText={resolveError('entryPrice') || t('trades.form.priceHelper')}
            inputProps={{ ...decimalInputProps, step: '0.0001', min: 0 }}
            InputProps={{ startAdornment: currencyAdornment }}
            {...register('entryPrice', { setValueAs: parseLocalizedNumber })}
          />
        </Grid>
        {status === 'CLOSED' && (
          <Grid item xs={12} md={4}>
            <TextField
              label={t('trades.form.exitPrice')}
              fullWidth
              error={!!errors.exitPrice}
              helperText={resolveError('exitPrice') || t('trades.form.priceHelper')}
              inputProps={{ ...decimalInputProps, step: '0.0001', min: 0 }}
              InputProps={{ startAdornment: currencyAdornment }}
              {...register('exitPrice', { setValueAs: parseLocalizedNumber })}
            />
          </Grid>
        )}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            label={t('trades.form.stopLossPrice')}
            fullWidth
            error={!!errors.stopLossPrice}
            helperText={resolveError('stopLossPrice') || t('trades.form.priceHelper')}
            inputProps={{ ...decimalInputProps, step: '0.0001', min: 0 }}
            InputProps={{ startAdornment: currencyAdornment }}
            {...register('stopLossPrice', { setValueAs: parseLocalizedNumber })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label={t('trades.form.takeProfitPrice')}
            fullWidth
            error={!!errors.takeProfitPrice}
            helperText={resolveError('takeProfitPrice') || t('trades.form.priceHelper')}
            inputProps={{ ...decimalInputProps, step: '0.0001', min: 0 }}
            InputProps={{ startAdornment: currencyAdornment }}
            {...register('takeProfitPrice', { setValueAs: parseLocalizedNumber })}
          />
        </Grid>
      </Grid>

      {mode === 'quick' && (
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">{t('trades.form.quickNotes')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              label={t('trades.form.notes')}
              fullWidth
              minRows={1}
              multiline
              {...register('notes')}
            />
          </AccordionDetails>
        </Accordion>
      )}

      {mode === 'advanced' && (
        <TextField
          label={t('trades.form.timeframe')}
          fullWidth
          {...register('timeframe')}
        />
      )}
    </Stack>
  )

  const advancedSections = mode === 'advanced' ? (
    <Stack spacing={1.5}>
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">{t('trades.form.sections.execution')}</Typography>
        </AccordionSummary>
        <AccordionDetails>{executionSection}</AccordionDetails>
      </Accordion>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">{t('trades.form.sections.riskCapital')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label={t('trades.form.riskAmount')}
                fullWidth
                error={!!errors.riskAmount}
                helperText={resolveError('riskAmount') || t('trades.form.riskAmountHint')}
                inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
                InputProps={{ startAdornment: currencyAdornment }}
                {...register('riskAmount', { setValueAs: parseLocalizedNumber })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label={t('trades.form.capitalUsed')}
                fullWidth
                error={!!errors.capitalUsed}
                helperText={resolveError('capitalUsed') || t('trades.form.capitalUsedHint')}
                inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
                InputProps={{ startAdornment: currencyAdornment }}
                {...register('capitalUsed', { setValueAs: parseLocalizedNumber })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label={t('trades.form.accountId')}
                fullWidth
                error={!!errors.accountId}
                helperText={resolveError('accountId')}
                {...register('accountId')}
              />
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
            <Grid item xs={12} md={4}>
              <TextField
                label={t('trades.form.fees')}
                fullWidth
                error={!!errors.fees}
                helperText={resolveError('fees') || t('trades.form.costHelper')}
                inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
                InputProps={{ startAdornment: currencyAdornment }}
                {...register('fees', { setValueAs: parseLocalizedNumber })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label={t('trades.form.commission')}
                fullWidth
                error={!!errors.commission}
                helperText={resolveError('commission') || t('trades.form.costHelper')}
                inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
                InputProps={{ startAdornment: currencyAdornment }}
                {...register('commission', { setValueAs: parseLocalizedNumber })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label={t('trades.form.slippage')}
                fullWidth
                error={!!errors.slippage}
                helperText={resolveError('slippage') || t('trades.form.costHelper')}
                inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
                InputProps={{ startAdornment: currencyAdornment }}
                {...register('slippage', { setValueAs: parseLocalizedNumber })}
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
            <Grid item xs={12} md={6}>
              <TextField label={t('trades.form.setup')} fullWidth {...register('setup')} />
            </Grid>
            <Grid item xs={12} md={6}>
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
            <Grid item xs={12} md={6}>
              <Controller
                name="setupGrade"
                control={control}
                render={({ field }) => (
                  <TextField
                    label={t('trades.form.setupGrade')}
                    select
                    fullWidth
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value || undefined)}
                  >
                    <MenuItem value="">{t('trades.form.none')}</MenuItem>
                    <MenuItem value="A">A</MenuItem>
                    <MenuItem value="B">B</MenuItem>
                    <MenuItem value="C">C</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label={t('trades.form.strategyTag')} fullWidth {...register('strategyTag')} />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label={t('trades.form.catalystTag')} fullWidth {...register('catalystTag')} />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('trades.form.session')}</Typography>
              <Controller
                name="session"
                control={control}
                render={({ field }) => (
                  <SessionChips value={field.value} onChange={field.onChange} />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="linkedContentIds"
                control={control}
                render={({ field }) => (
                  <TextField
                    label={t('trades.form.linkedPlans')}
                    select
                    fullWidth
                    value={field.value ?? []}
                    onChange={(event) => {
                      const value = event.target.value
                      field.onChange(typeof value === 'string' ? value.split(',') : value)
                    }}
                    SelectProps={{
                      multiple: true,
                      renderValue: (selected) => {
                        const selectedIds = (selected as string[]) || []
                        if (selectedIds.length === 0) return t('trades.form.none')
                        return selectedIds
                          .map((id) => planOptions.find((option) => option.id === id)?.label || id)
                          .slice(0, 2)
                          .join(', ')
                      }
                    }}
                  >
                    {planOptions.map((option) => (
                      <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>
                    ))}
                  </TextField>
                )}
              />
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
                      renderValue: (selected) => {
                        const selectedValues = (selected as string[]) || []
                        if (selectedValues.length === 0) return t('trades.form.none')
                        return selectedValues.map((value) => t(`trades.form.ruleBreakOptions.${value}`)).join(', ')
                      }
                    }}
                  >
                    {ruleBreakOptions.map((option) => (
                      <MenuItem key={option} value={option}>{t(`trades.form.ruleBreakOptions.${option}`)}</MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">{t('trades.form.sections.notes')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            label={t('trades.form.notes')}
            fullWidth
            multiline
            minRows={3}
            {...register('notes')}
          />
        </AccordionDetails>
      </Accordion>
    </Stack>
  ) : (
    executionSection
  )

  return (
    <Box component="form" onSubmit={submit}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box>
            <Typography variant="h6">{t('trades.create.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('trades.form.quickAdvancedSubtitle')}</Typography>
            <Typography variant="caption" color="text.secondary">{baseCurrency} | {timezone}</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <TradeModeSwitch value={mode} onChange={setMode} />
            <IconButton onClick={() => setInfoOpen(true)} aria-label={t('trades.form.openHelp')}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {showValidationBanner && <Alert severity="error">{t('trades.form.validationBanner')}</Alert>}
        {!showValidationBanner && !!error && <Alert severity="error">{error}</Alert>}

        <Grid container spacing={2} alignItems="flex-start">
          {isMobile && (
            <Grid item xs={12}>
              <Accordion disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">{t('trades.form.summaryAccordion')}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <TradeLiveSummary
                    values={watchedValues}
                    baseCurrency={baseCurrency}
                    onUseCalculatedRisk={(riskValue) => {
                      if (getValues('riskAmount') === undefined) {
                        setValue('riskAmount', Number(riskValue.toFixed(4)), { shouldValidate: true, shouldDirty: true })
                      }
                    }}
                  />
                </AccordionDetails>
              </Accordion>
            </Grid>
          )}

          <Grid item xs={12} md={8}>
            <Stack spacing={1.5}>
              {advancedSections}

              <Box
                sx={{
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 3,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper',
                  py: 1.5,
                  mt: 1,
                  mb: isMobile ? 'calc(env(safe-area-inset-bottom) + 8px)' : 0
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={!isValid || isSubmitting}
                    fullWidth={isMobile}
                  >
                    {submitLabel}
                  </Button>
                  {onCancel && (
                    <Button variant="outlined" onClick={onCancel} fullWidth={isMobile}>
                      {t('common.cancel')}
                    </Button>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Grid>

          {!isMobile && (
            <Grid item xs={12} md={4}>
              <Box sx={{ position: 'sticky', top: 12 }}>
                <TradeLiveSummary
                  values={watchedValues}
                  baseCurrency={baseCurrency}
                  onUseCalculatedRisk={(riskValue) => {
                    if (getValues('riskAmount') === undefined) {
                      setValue('riskAmount', Number(riskValue.toFixed(4)), { shouldValidate: true, shouldDirty: true })
                    }
                  }}
                />
              </Box>
            </Grid>
          )}
        </Grid>
      </Stack>

      <Drawer anchor="right" open={infoOpen} onClose={() => setInfoOpen(false)}>
        <Box sx={{ width: { xs: '90vw', sm: 420 }, p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">{t('trades.help.title')}</Typography>
            <Button size="small" onClick={() => setInfoOpen(false)}>{t('common.close')}</Button>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>{t('trades.help.sections.corePricing')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('trades.help.corePricing.entryExitBody')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('trades.help.corePricing.directionMarketBody')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('trades.help.corePricing.statusBody')}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>{t('trades.help.sections.pnlAndRisk')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('trades.help.pnlAndRisk.pnlGrossBody')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('trades.help.pnlAndRisk.pnlNetBody')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('trades.help.pnlAndRisk.rMultipleBody')}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" gutterBottom>{t('trades.help.sections.context')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('trades.help.context.setupStrategyCatalystBody')}</Typography>
              <Typography variant="body2" color="text.secondary">{t('trades.help.context.timeframeBody')}</Typography>
            </Box>
          </Stack>
        </Box>
      </Drawer>
    </Box>
  )
}
