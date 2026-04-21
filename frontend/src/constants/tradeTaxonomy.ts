export const FEELING_OPTIONS = [
  'Calm',
  'Focused',
  'Confident',
  'Patient',
  'Disciplined',
  'Neutral',
  'Curious',
  'Alert',
  'Energized',
  'Motivated',
  'Determined',
  'Cautious',
  'Hesitant',
  'Uncertain',
  'Doubtful',
  'Anxious',
  'Stressed',
  'Overwhelmed',
  'Frustrated',
  'Irritated',
  'Impatient',
  'Fearful',
  'FOMO (Fear of missing out)',
  'Greedy',
  'Euphoric',
  'Revengeful',
  'Distracted',
  'Tired',
  'Bored',
  'Detached'
] as const

export type FeelingOption = typeof FEELING_OPTIONS[number]

export const RULE_BREAK_OPTIONS = [
  'No pre-trade plan',
  'Entered without confirmation',
  'Chased price (late entry)',
  'Entered in the middle of range (chop)',
  'Ignored HTF bias',
  'Ignored key level',
  'Ignored liquidity sweep requirement',
  'Ignored MSS/structure shift requirement',
  'Ignored displacement requirement',
  'Ignored retest requirement',
  'Traded against the trend',
  'Overtraded (too many trades)',
  'Revenge trade',
  'FOMO entry',
  'Impulsive entry',
  'Increased size after a loss',
  'Oversized position',
  'Risked more than daily limit',
  'Risked more than plan per trade',
  'Moved stop-loss further away',
  'Removed stop-loss',
  'Tightened stop-loss randomly',
  'Took profit too early (no rule)',
  'Let winner turn into loser',
  'Closed early due to fear',
  'Did not take partials per plan',
  'Did not trail per plan',
  'Moved to breakeven too early',
  'Did not move to breakeven when rules said',
  'Averaged down / added to loser',
  'Added without confirmation',
  'Held through high-impact news',
  'Entered during high-impact news window',
  'Traded outside session window',
  'Ignored max trades rule',
  'Ignored profit target stop rule',
  'Ignored loss limit stop rule',
  "Didn't respect entry trigger candle",
  'Ignored spread/volatility conditions',
  'Poor execution (market when limit planned)',
  'Misread direction (clicked wrong side)',
  'Wrong quantity entered',
  'Wrong instrument/symbol',
  "Didn't set TP",
  "Didn't set SL",
  'Slippage/fees not considered',
  'Emotional trading (anger/frustration)',
  'Emotional trading (euphoria/greed)',
  'Distracted / multitasking',
  'No journal / no post-trade review'
] as const

export type TradeRuleBreak = typeof RULE_BREAK_OPTIONS[number]

const RULE_BREAK_OPTION_SET = new Set<string>(RULE_BREAK_OPTIONS)

const LEGACY_NOTEBOOK_RULE_BREAK_ALIASES: Record<string, TradeRuleBreak> = {
  early_exit: 'Closed early due to fear',
  oversize: 'Oversized position',
  revenge: 'Revenge trade',
  moved_stop_loss: 'Moved stop-loss further away',
  chased_entry: 'Chased price (late entry)',
  no_entry_criteria: 'Entered without confirmation',
  added_without_setup: 'Added without confirmation',
  ignored_news: 'Entered during high-impact news window',
  no_risk_plan: 'No pre-trade plan'
}

export function isTradeRuleBreak(value: unknown): value is TradeRuleBreak {
  return typeof value === 'string' && RULE_BREAK_OPTION_SET.has(value)
}

export function normalizeTradeRuleBreak(value: unknown): TradeRuleBreak | null {
  if (isTradeRuleBreak(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  return LEGACY_NOTEBOOK_RULE_BREAK_ALIASES[value] || null
}

export function normalizeTradeRuleBreaks(values: unknown): TradeRuleBreak[] {
  if (!Array.isArray(values)) {
    return []
  }

  const normalized: TradeRuleBreak[] = []
  const seen = new Set<TradeRuleBreak>()

  values.forEach((value) => {
    const next = normalizeTradeRuleBreak(value)
    if (!next || seen.has(next)) {
      return
    }
    seen.add(next)
    normalized.push(next)
  })

  return normalized
}
