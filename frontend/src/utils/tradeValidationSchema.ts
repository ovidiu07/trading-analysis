import { z } from 'zod'

const marketValues = ['STOCK', 'CFD', 'FOREX', 'CRYPTO', 'FUTURES', 'OPTIONS', 'OTHER'] as const
const directionValues = ['LONG', 'SHORT'] as const
const statusValues = ['OPEN', 'CLOSED'] as const
const setupGradeValues = ['A', 'B', 'C'] as const
const sessionValues = ['ASIA', 'LONDON', 'NY', 'CUSTOM'] as const

const toUndefinedIfEmpty = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') return undefined
  return value
}

const parseNumberInput = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return undefined
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\s+/g, '').replace(',', '.')
    if (normalized.length === 0) {
      return undefined
    }
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

const positiveRequiredNumber = (messageKey: string) =>
  z.preprocess(
    parseNumberInput,
    z.number(messageKey).gt(0, messageKey)
  )

const positiveOptionalNumber = (messageKey: string) =>
  z.preprocess(
    parseNumberInput,
    z.number(messageKey).gt(0, messageKey).optional()
  )

const nonNegativeOptionalNumber = (messageKey: string) =>
  z.preprocess(
    parseNumberInput,
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
    commission: nonNegativeOptionalNumber('trades.form.validation.costNonNegative'),
    slippage: nonNegativeOptionalNumber('trades.form.validation.costNonNegative'),
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
    notes: z.preprocess(toUndefinedIfEmpty, z.string().trim().max(2000).optional()),
    accountId: z.preprocess(toUndefinedIfEmpty, z.string().trim().max(120).optional())
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
