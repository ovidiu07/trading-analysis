import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
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
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState, type FocusEvent } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { TradeRequest } from '../../api/trades'
import { PlanSource } from '../../api/plans'
import { useActivePlansForTradeQuery } from '../../hooks/usePlans'
import { useI18n } from '../../i18n'
import { formatCurrency } from '../../utils/format'
import { parseLocalizedNumberInput } from '../../utils/numberInput'
import { TradeFormValues } from '../../utils/tradePayload'
import { tradeValidationSchema } from '../../utils/tradeValidationSchema'
import { BottomActionBar } from './BottomActionBar'
import { SessionChips } from './SessionChips'
import { saveRecentSymbol, SymbolAutocomplete } from './SymbolAutocomplete'
import { TradeLiveSummary } from './TradeLiveSummary'
import { TradeModeSwitch, type TradeEntryMode } from './TradeModeSwitch'

type ContentOption = {
  id: string
  label: string
  source?: PlanSource
}

type TradeCreateFormV2Props = {
  initialValues: TradeFormValues
  submitLabel: string
  onSubmit: (values: TradeFormValues) => Promise<void>
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
  onModeChange?: (mode: TradeEntryMode) => void
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
  linkedPlanIds: values.linkedPlanIds || values.linkedContentIds || [],
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
  linkedContentIds: values.linkedContentIds || [],
  linkedPlanIds: values.linkedPlanIds || values.linkedContentIds || []
})

const getLocalDateTime = () => new Date().toISOString().slice(0, 16)
const localDateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/
const timezoneRegex = /(Z|[+-]\d{2}:\d{2})$/i

const toIsoDateTime = (value: string): string => {
  if (localDateTimeRegex.test(value) && !timezoneRegex.test(value)) {
    const withSeconds = value.length === 16 ? `${value}:00` : value
    return new Date(`${withSeconds}Z`).toISOString()
  }
  return new Date(value).toISOString()
}

function SectionHeader({ title, summary }: { title: string; summary?: string }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={1.5}
      width="100%"
      pr={1}
      sx={{ minWidth: 0 }}
    >
      <Typography variant="subtitle2" sx={{ minWidth: 0 }}>{title}</Typography>
      {summary && (
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ minWidth: 0, maxWidth: { xs: '52%', sm: '60%' }, overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {summary}
        </Typography>
      )}
    </Stack>
  )
}

export function TradeCreateFormV2({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  onDirtyChange,
  onModeChange,
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [mode, setMode] = useState<TradeEntryMode>(defaultMode)
  const [showValidationBanner, setShowValidationBanner] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const lastAutoLinkedRef = useRef('')
  const contentScrollRef = useRef<HTMLDivElement | null>(null)

  const {
    register,
    control,
    reset,
    watch,
    getValues,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty }
  } = useForm<TradeFormValues>({
    resolver: zodResolver(tradeValidationSchema as any) as any,
    defaultValues: normalizeDefaults(initialValues),
    mode: 'onChange'
  })

  useEffect(() => {
    reset(normalizeDefaults(initialValues))
    setMode(defaultMode)
    onModeChange?.(defaultMode)
    setShowValidationBanner(false)
    lastAutoLinkedRef.current = ''
  }, [defaultMode, initialValues, onModeChange, reset])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

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
  const watchedOpenedAt = watch('openedAt')
  const openedAtIso = useMemo(() => {
    if (!watchedOpenedAt || !watchedOpenedAt.trim()) return ''
    try {
      return toIsoDateTime(watchedOpenedAt)
    } catch {
      return ''
    }
  }, [watchedOpenedAt])

  const activePlansQuery = useActivePlansForTradeQuery(openedAtIso, timezone, Boolean(openedAtIso))

  const activePlanOptions = useMemo<ContentOption[]>(() => {
    return (activePlansQuery.data?.plans || []).map((plan) => ({
      id: plan.id,
      source: plan.source,
      label: plan.source === 'MENTOR'
        ? `${t('trades.form.mentorFocusPrefix')}: ${plan.title}`
        : `${t('trades.form.myPlanPrefix')}: ${plan.title}`
    }))
  }, [activePlansQuery.data?.plans, t])

  const allPlanOptions = useMemo<ContentOption[]>(() => {
    const map = new Map<string, ContentOption>()
    ;[...activePlanOptions, ...planOptions].forEach((option) => {
      if (!map.has(option.id)) {
        map.set(option.id, option)
      }
    })
    return Array.from(map.values())
  }, [activePlanOptions, planOptions])

  const planOptionsById = useMemo(() => {
    const map = new Map<string, ContentOption>()
    allPlanOptions.forEach((option) => {
      map.set(option.id, option)
    })
    return map
  }, [allPlanOptions])

  useEffect(() => {
    if (!openedAtIso || !activePlansQuery.data) return
    const suggestedPlanIds = activePlansQuery.data.suggestedPlanIds || []
    const nextMarker = `${openedAtIso}:${suggestedPlanIds.join(',')}`
    if (lastAutoLinkedRef.current === nextMarker) return
    lastAutoLinkedRef.current = nextMarker
    setValue('linkedPlanIds', suggestedPlanIds, { shouldDirty: true, shouldValidate: true })
  }, [activePlansQuery.data, openedAtIso, setValue])

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
    <InputAdornment position="end">
      <Typography variant="caption" color="text.secondary">{baseCurrency}</Typography>
    </InputAdornment>
  ), [baseCurrency])

  const submit = handleSubmit(async (values) => {
    const payload = toTradeFormValues(values)
    await onSubmit(payload)
    saveRecentSymbol(payload.symbol)
    setShowValidationBanner(false)
  }, () => {
    setShowValidationBanner(true)
  })

  const handleModeChange = (nextMode: TradeEntryMode) => {
    setMode(nextMode)
    onModeChange?.(nextMode)
  }

  const handleUseCalculatedRisk = (riskValue: number) => {
    if (getValues('riskAmount') === undefined) {
      setValue('riskAmount', Number(riskValue.toFixed(4)), { shouldValidate: true, shouldDirty: true })
    }
  }

  const handleFieldFocus = (event: FocusEvent<HTMLElement>) => {
    if (!isMobile) return
    const target = event.target as HTMLElement
    const scrollContainer = contentScrollRef.current
    if (!scrollContainer || !scrollContainer.contains(target)) return

    window.setTimeout(() => {
      const containerRect = scrollContainer.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const safeBottom = 88
      const isOutOfView =
        targetRect.bottom > containerRect.bottom - safeBottom ||
        targetRect.top < containerRect.top + 8

      if (isOutOfView) {
        const nextTop =
          scrollContainer.scrollTop +
          (targetRect.top - containerRect.top) -
          containerRect.height * 0.28
        const targetTop = Math.max(0, nextTop)
        if (typeof scrollContainer.scrollTo === 'function') {
          scrollContainer.scrollTo({ top: targetTop, behavior: 'smooth' })
        } else {
          scrollContainer.scrollTop = targetTop
        }
      }
    }, 80)
  }

  const costsSummary = useMemo(() => {
    const fees = parseLocalizedNumberInput(watchedValues.fees) ?? 0
    const commission = parseLocalizedNumberInput(watchedValues.commission) ?? 0
    const slippage = parseLocalizedNumberInput(watchedValues.slippage) ?? 0
    return formatCurrency(fees + commission + slippage, baseCurrency)
  }, [baseCurrency, watchedValues.commission, watchedValues.fees, watchedValues.slippage])

  const riskSummary = useMemo(() => {
    const risk = parseLocalizedNumberInput(watchedValues.riskAmount)
    const capital = parseLocalizedNumberInput(watchedValues.capitalUsed)
    if (risk === undefined && capital === undefined) return '—'
    const parts: string[] = []
    if (risk !== undefined) parts.push(`${t('trades.form.riskAmount')}: ${formatCurrency(risk, baseCurrency)}`)
    if (capital !== undefined) parts.push(`${t('trades.form.capitalUsed')}: ${formatCurrency(capital, baseCurrency)}`)
    return parts.join(' • ')
  }, [baseCurrency, t, watchedValues.capitalUsed, watchedValues.riskAmount])

  const contextSummary = useMemo(() => {
    const parts: string[] = []
    if (watchedValues.setupGrade) parts.push(`Grade ${watchedValues.setupGrade}`)
    if (watchedValues.session) parts.push(t(`trades.form.sessions.${watchedValues.session}`))
    if (watchedValues.strategyTag) parts.push(watchedValues.strategyTag)
    return parts[0] || '—'
  }, [t, watchedValues.session, watchedValues.setupGrade, watchedValues.strategyTag])

  const plansSummary = useMemo(() => {
    const linkedCount = watchedValues.linkedPlanIds?.length || 0
    if (linkedCount === 0) return '—'
    return `${linkedCount} ${t('trades.form.linkedPlans')}`
  }, [t, watchedValues.linkedPlanIds])

  const notesSummary = useMemo(() => {
    const notes = watchedValues.notes?.trim() || ''
    if (!notes) return '—'
    return notes.length > 40 ? `${notes.slice(0, 40)}…` : notes
  }, [watchedValues.notes])

  const executionSummary = useMemo(() => {
    const parts = [
      watchedValues.symbol?.trim()?.toUpperCase() || '—',
      watchedValues.direction ? t(`trades.direction.${watchedValues.direction}`) : '—',
      watchedValues.status ? t(`trades.status.${watchedValues.status}`) : '—'
    ]
    return parts.join(' • ')
  }, [t, watchedValues.direction, watchedValues.status, watchedValues.symbol])

  const executionSection = (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Grid container rowSpacing={2} columnSpacing={{ xs: 0, md: 2 }}>
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
                autoFocus
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

      <Grid container rowSpacing={2} columnSpacing={{ xs: 0, md: 2 }}>
        <Grid item xs={12} md={6}>
          <Controller
            name="direction"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.direction}>
                <ToggleButtonsField
                  value={field.value}
                  options={[
                    {
                      value: 'LONG',
                      label: t('trades.direction.LONG'),
                      selectedColor: 'success.main',
                      selectedBackground: 'success.50'
                    },
                    {
                      value: 'SHORT',
                      label: t('trades.direction.SHORT'),
                      selectedColor: 'error.main',
                      selectedBackground: 'error.50'
                    }
                  ]}
                  ariaLabel={t('trades.form.direction')}
                  onChange={(nextValue) => field.onChange(nextValue as TradeRequest['direction'])}
                />
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
                <ToggleButtonsField
                  value={field.value}
                  options={[
                    { value: 'OPEN', label: t('trades.status.OPEN') },
                    { value: 'CLOSED', label: t('trades.status.CLOSED') }
                  ]}
                  ariaLabel={t('trades.form.status')}
                  onChange={(nextValue) => field.onChange(nextValue as TradeRequest['status'])}
                />
                <FormHelperText>{resolveError('status')}</FormHelperText>
              </FormControl>
            )}
          />
        </Grid>
      </Grid>

      <Grid container rowSpacing={2} columnSpacing={{ xs: 0, md: 2 }}>
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

      <Grid container rowSpacing={2} columnSpacing={{ xs: 0, md: 2 }}>
        <Grid item xs={12} md={4}>
          <TextField
            label={t('trades.form.quantity')}
            fullWidth
            error={!!errors.quantity}
            helperText={resolveError('quantity') || t('trades.form.quantityHelper')}
            inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
            {...register('quantity', { setValueAs: parseLocalizedNumberInput })}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            label={t('trades.form.entryPrice')}
            fullWidth
            error={!!errors.entryPrice}
            helperText={resolveError('entryPrice') || t('trades.form.priceHelper')}
            inputProps={{ ...decimalInputProps, step: '0.0001', min: 0 }}
            InputProps={{ endAdornment: currencyAdornment }}
            {...register('entryPrice', { setValueAs: parseLocalizedNumberInput })}
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
              InputProps={{ endAdornment: currencyAdornment }}
              {...register('exitPrice', { setValueAs: parseLocalizedNumberInput })}
            />
          </Grid>
        )}
      </Grid>

      <Grid container rowSpacing={2} columnSpacing={{ xs: 0, md: 2 }}>
        <Grid item xs={12} md={6}>
          <TextField
            label={t('trades.form.stopLossPrice')}
            fullWidth
            error={!!errors.stopLossPrice}
            helperText={resolveError('stopLossPrice') || t('trades.form.priceHelper')}
            inputProps={{ ...decimalInputProps, step: '0.0001', min: 0 }}
            InputProps={{ endAdornment: currencyAdornment }}
            {...register('stopLossPrice', { setValueAs: parseLocalizedNumberInput })}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label={t('trades.form.takeProfitPrice')}
            fullWidth
            error={!!errors.takeProfitPrice}
            helperText={resolveError('takeProfitPrice') || t('trades.form.priceHelper')}
            inputProps={{ ...decimalInputProps, step: '0.0001', min: 0 }}
            InputProps={{ endAdornment: currencyAdornment }}
            {...register('takeProfitPrice', { setValueAs: parseLocalizedNumberInput })}
          />
        </Grid>
      </Grid>

      {mode === 'quick' && (
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <SectionHeader title={t('trades.form.quickNotes')} summary={notesSummary} />
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              label={t('trades.form.notes')}
              fullWidth
              minRows={4}
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
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SectionHeader title={t('trades.form.sections.execution')} summary={executionSummary} />
        </AccordionSummary>
        <AccordionDetails>{executionSection}</AccordionDetails>
      </Accordion>

      <Accordion disableGutters defaultExpanded={!isMobile}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SectionHeader title={t('trades.form.sections.riskCapital')} summary={riskSummary} />
        </AccordionSummary>
        <AccordionDetails>
          <Grid container rowSpacing={2} columnSpacing={{ xs: 0, md: 2 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label={t('trades.form.riskAmount')}
                fullWidth
                error={!!errors.riskAmount}
                helperText={resolveError('riskAmount') || t('trades.form.riskAmountHint')}
                inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
                InputProps={{ endAdornment: currencyAdornment }}
                {...register('riskAmount', { setValueAs: parseLocalizedNumberInput })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label={t('trades.form.capitalUsed')}
                fullWidth
                error={!!errors.capitalUsed}
                helperText={resolveError('capitalUsed') || t('trades.form.capitalUsedHint')}
                inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
                InputProps={{ endAdornment: currencyAdornment }}
                {...register('capitalUsed', { setValueAs: parseLocalizedNumberInput })}
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

      <Accordion disableGutters defaultExpanded={!isMobile}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SectionHeader title={t('trades.form.sections.costs')} summary={costsSummary} />
        </AccordionSummary>
        <AccordionDetails>
          <Grid container rowSpacing={2} columnSpacing={{ xs: 0, md: 2 }}>
            <Grid item xs={12} md={4}>
              <TextField
                label={t('trades.form.fees')}
                fullWidth
                error={!!errors.fees}
                helperText={resolveError('fees') || t('trades.form.costHelper')}
                inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
                InputProps={{ endAdornment: currencyAdornment }}
                {...register('fees', { setValueAs: parseLocalizedNumberInput })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label={t('trades.form.commission')}
                fullWidth
                error={!!errors.commission}
                helperText={resolveError('commission') || t('trades.form.costHelper')}
                inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
                InputProps={{ endAdornment: currencyAdornment }}
                {...register('commission', { setValueAs: parseLocalizedNumberInput })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label={t('trades.form.slippage')}
                fullWidth
                error={!!errors.slippage}
                helperText={resolveError('slippage') || t('trades.form.costHelper')}
                inputProps={{ ...decimalInputProps, step: '0.01', min: 0 }}
                InputProps={{ endAdornment: currencyAdornment }}
                {...register('slippage', { setValueAs: parseLocalizedNumberInput })}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters defaultExpanded={!isMobile}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SectionHeader title={t('trades.form.sections.context')} summary={contextSummary} />
        </AccordionSummary>
        <AccordionDetails>
          <Grid container rowSpacing={2} columnSpacing={{ xs: 0, md: 2 }}>
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
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion disableGutters defaultExpanded={!isMobile}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SectionHeader title={t('trades.form.sections.plans')} summary={plansSummary} />
        </AccordionSummary>
        <AccordionDetails>
          <Grid container rowSpacing={2} columnSpacing={{ xs: 0, md: 2 }}>
            <Grid item xs={12} md={6}>
              <Controller
                name="linkedPlanIds"
                control={control}
                render={({ field }) => (
                  <Autocomplete<ContentOption, true, false, false>
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
                      <TextField
                        {...params}
                        label={t('trades.form.linkedPlans')}
                        helperText={activePlansQuery.isFetching ? t('trades.form.loadingActivePlans') : ''}
                      />
                    )}
                  />
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

      <Accordion disableGutters defaultExpanded={!isMobile}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SectionHeader title={t('trades.form.sections.notes')} summary={notesSummary} />
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            label={t('trades.form.notes')}
            fullWidth
            multiline
            minRows={4}
            sx={{
              '& textarea': {
                resize: 'vertical'
              }
            }}
            {...register('notes')}
          />
        </AccordionDetails>
      </Accordion>
    </Stack>
  ) : (
    executionSection
  )

  return (
    <Box
      component="form"
      onSubmit={submit}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        overflowX: 'hidden'
      }}
      onFocusCapture={handleFieldFocus}
    >
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          pt: { xs: 'env(safe-area-inset-top)', md: 0 },
          flexShrink: 0
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" px={{ xs: 1, md: 2 }} py={1}>
          <IconButton onClick={onCancel} aria-label={t('common.close')}>
            <CloseRoundedIcon />
          </IconButton>
          <Typography variant="h6">{t('trades.create.title')}</Typography>
          <IconButton onClick={() => setInfoOpen(true)} aria-label={t('trades.form.openHelp')}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Stack
          direction={isMobile ? 'column' : 'row'}
          alignItems={isMobile ? 'stretch' : 'center'}
          spacing={1}
          px={{ xs: 2, md: 3 }}
          py={1}
          sx={{
            minWidth: 0,
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            '& > *': {
              minWidth: 0
            }
          }}
        >
          <TradeModeSwitch
            value={mode}
            onChange={handleModeChange}
            fullWidth={isMobile}
            ariaLabel={t('trades.form.quickAdvancedSubtitle')}
          />
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ minWidth: 0, maxWidth: '100%' }}>
            <Chip
              size="small"
              variant="outlined"
              label={baseCurrency}
              sx={{
                maxWidth: '100%',
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }
              }}
            />
            <Chip
              size="small"
              variant="outlined"
              label={timezone}
              sx={{
                maxWidth: '100%',
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }
              }}
            />
          </Stack>
        </Stack>
      </Box>

      <Box
        data-testid="trade-create-scroll-region"
        ref={contentScrollRef}
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          minHeight: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          overscrollBehaviorX: 'none',
          scrollPaddingTop: 16,
          scrollPaddingBottom: { xs: 'calc(env(safe-area-inset-bottom) + 128px)', md: 24 },
          px: { xs: 2, md: 3 },
          pt: 2,
          pb: { xs: 'calc(env(safe-area-inset-bottom) + 128px)', md: 2 },
          '& > *': {
            minWidth: 0
          },
          '& .MuiGrid-item': {
            minWidth: 0
          },
          '& .MuiAutocomplete-root, & .MuiFormControl-root, & .MuiTextField-root': {
            minWidth: 0,
            maxWidth: '100%'
          }
        }}
      >
        <Stack spacing={2}>
          {showValidationBanner && <Alert severity="error">{t('trades.form.validationBanner')}</Alert>}
          {!showValidationBanner && !!error && <Alert severity="error">{error}</Alert>}

          {isMobile && (
            <Accordion disableGutters defaultExpanded={false}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <SectionHeader title={t('trades.form.summaryAccordion')} summary={executionSummary} />
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Box sx={{ width: '100%', minWidth: 0 }}>
                  <TradeLiveSummary
                    values={watchedValues}
                    baseCurrency={baseCurrency}
                    variant="compact"
                    maxWarnings={2}
                    onUseCalculatedRisk={handleUseCalculatedRisk}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>
          )}

          <Grid container spacing={0} alignItems="flex-start" sx={{ minWidth: 0, width: '100%', m: 0 }}>
            <Grid item xs={12} md={8} sx={{ minWidth: 0, pr: { md: 1.25 }, pb: { xs: 2.5, md: 0 } }}>
              {advancedSections}
            </Grid>

            {!isMobile && (
              <Grid item xs={12} md={4} sx={{ minWidth: 0, pl: { md: 1.25 } }}>
                <Box sx={{ position: 'sticky', top: 16 }}>
                  <TradeLiveSummary
                    values={watchedValues}
                    baseCurrency={baseCurrency}
                    onUseCalculatedRisk={handleUseCalculatedRisk}
                  />
                </Box>
              </Grid>
            )}
          </Grid>
        </Stack>
      </Box>

      <BottomActionBar
        submitLabel={submitLabel}
        submitDisabled={!isValid}
        submitting={isSubmitting}
        onCancel={onCancel}
        mobileSticky={isMobile}
      />

      <Drawer anchor="right" open={infoOpen} onClose={() => setInfoOpen(false)}>
        <Box sx={{ width: { xs: '92vw', sm: 420 }, p: 2 }}>
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

type ToggleButtonsFieldOption = {
  value: string
  label: string
  selectedColor?: string
  selectedBackground?: string
}

function ToggleButtonsField({
  value,
  options,
  onChange,
  ariaLabel
}: {
  value?: string
  options: ToggleButtonsFieldOption[]
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <Box sx={{ width: '100%' }}>
      <Box
        role="group"
        aria-label={ariaLabel}
        sx={{
          display: 'flex',
          flexWrap: 'nowrap',
          width: '100%',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden'
        }}
      >
        {options.map((option) => {
          const selected = value === option.value
          return (
            <Button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              sx={{
                flex: `1 1 ${100 / options.length}%`,
                borderRadius: 0,
                borderRight: '1px solid',
                borderColor: 'divider',
                minWidth: 0,
                py: 1.1,
                justifyContent: 'center',
                color: selected ? option.selectedColor || 'text.primary' : 'text.secondary',
                bgcolor: selected ? option.selectedBackground || 'action.selected' : 'transparent',
                textTransform: 'none',
                '&:last-of-type': {
                  borderRight: 'none'
                },
                '&:only-of-type': {
                  borderRight: 'none'
                }
              }}
            >
              <Typography variant="body2" sx={{ lineHeight: 1.2 }}>{option.label}</Typography>
            </Button>
          )
        })}
      </Box>
    </Box>
  )
}
