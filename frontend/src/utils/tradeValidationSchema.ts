import { z } from 'zod'
import { parseLocalizedNumberInput } from './numberInput'

const marketValues = ['STOCK', 'CFD', 'FOREX', 'CRYPTO', 'FUTURES', 'OPTIONS', 'OTHER'] as const
const directionValues = ['LONG', 'SHORT'] as const
const statusValues = ['OPEN', 'CLOSED'] as const
const setupGradeValues = ['A', 'B', 'C'] as const
const sessionValues = ['ASIA', 'LONDON', 'NY_AM', 'NY_PM', 'NY', 'CUSTOM'] as const

const toUndefinedIfEmpty = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return undefined
  return value
}

const optionalCurrencyCode = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return toUndefinedIfEmpty(value)
    const normalized = value.trim().toUpperCase()
    return normalized || undefined
  },
  z.string().regex(/^[A-Z]{3}$/, 'trades.form.validation.currencyCode').optional()
)

const positiveRequiredNumber = (messageKey: string) =>
  z.preprocess(
    parseLocalizedNumberInput,
    z.number(messageKey).gt(0, messageKey)
  )

const positiveOptionalNumber = (messageKey: string) =>
  z.preprocess(
    parseLocalizedNumberInput,
    z.number(messageKey).gt(0, messageKey).optional()
  )

const nonNegativeOptionalNumber = (messageKey: string) =>
  z.preprocess(
    parseLocalizedNumberInput,
    z.number(messageKey).min(0, messageKey).optional()
  )

export const tradeValidationSchema = z
  .object({
    symbol: z
      .string()
      .trim()
      .min(1, 'trades.form.validation.symbolRequired')
      .max(15, 'trades.form.validation.symbolTooLong'),
    market: z.enum(marketValues),
    direction: z.enum(directionValues),
    status: z.enum(statusValues),
    openedAt: z.string().trim().min(1, 'trades.form.validation.openedAtRequired'),
    closedAt: z.preprocess(toUndefinedIfEmpty, z.string().trim().optional()),
    timeframe: z.preprocess(toUndefinedIfEmpty, z.string().trim().max(64).optional()),
    quantity: positiveRequiredNumber('trades.form.validation.quantityPositive'),
    entryPrice: positiveRequiredNumber('trades.form.validation.entryPricePositive'),
    exitPrice: positiveOptionalNumber('trades.form.validation.exitPricePositive'),
    stopLossPrice: positiveOptionalNumber('trades.form.validation.stopLossPositive'),
    takeProfitPrice: positiveOptionalNumber('trades.form.validation.takeProfitPositive'),
    fees: nonNegativeOptionalNumber('trades.form.validation.costNonNegative'),
    feesProfileCurrency: nonNegativeOptionalNumber('trades.form.validation.costNonNegative'),
    commission: nonNegativeOptionalNumber('trades.form.validation.costNonNegative'),
    slippage: nonNegativeOptionalNumber('trades.form.validation.costNonNegative'),
    tradeCurrency: optionalCurrencyCode,
    profileCurrency: optionalCurrencyCode,
    fxRateTradeToProfile: positiveOptionalNumber('trades.form.validation.fxRatePositive'),
    fxRateSource: z.preprocess(toUndefinedIfEmpty, z.string().trim().max(64).optional()),
    pnlProfileCurrency: z.preprocess(
      parseLocalizedNumberInput,
      z.number('trades.form.validation.pnlProfileNumber').optional()
    ),
    riskAmount: positiveOptionalNumber('trades.form.validation.riskAmountPositive'),
    capitalUsed: positiveOptionalNumber('trades.form.validation.capitalUsedPositive'),
    setup: z.preprocess(toUndefinedIfEmpty, z.string().trim().max(120).optional()),
    strategyTag: z.preprocess(toUndefinedIfEmpty, z.string().trim().max(120).optional()),
    catalystTag: z.preprocess(toUndefinedIfEmpty, z.string().trim().max(120).optional()),
    strategyId: z.preprocess(toUndefinedIfEmpty, z.string().trim().optional()),
    setupGrade: z.preprocess(toUndefinedIfEmpty, z.enum(setupGradeValues).optional()),
    ruleBreaks: z.array(z.string().trim().min(1)).optional(),
    session: z.preprocess(toUndefinedIfEmpty, z.enum(sessionValues).optional()),
    linkedContentIds: z.array(z.string().trim().min(1)).optional(),
    linkedPlanIds: z.array(z.string().trim().min(1)).optional(),
    notes: z.preprocess(toUndefinedIfEmpty, z.string().trim().max(2000).optional()),
    accountRefId: z.preprocess(toUndefinedIfEmpty, z.string().uuid().optional())
  })
  .superRefine((values, ctx) => {
    if (values.status === 'CLOSED') {
      if (values.exitPrice === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['exitPrice'],
          message: 'trades.form.validation.exitPriceRequired'
        })
      }
      if (!values.closedAt || values.closedAt.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['closedAt'],
          message: 'trades.form.validation.closedAtRequired'
        })
      }
    }
  })

export type TradeValidationValues = z.output<typeof tradeValidationSchema>
