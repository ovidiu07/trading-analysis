export type DataState = 'demo' | 'live' | 'manual' | 'unavailable'

export type MarketTickerItem = {
  symbol: string
  labelKey: string
  tradingViewSymbol: string
  price: string
  change: string
  direction: 'positive' | 'negative' | 'flat'
  dataState: DataState
}

export type EconomicEvent = {
  time: string
  titleKey: string
  impact: 'high' | 'medium' | 'low'
  dataState: DataState
}

export type MarketMetric = {
  labelKey: string
  value: string
  change?: string
  direction?: 'positive' | 'negative' | 'flat'
  dataState: DataState
}

/**
 * Phase 1 visual fixtures only. They are deliberately kept outside UI components
 * so a real market/calendar adapter can replace them without changing presentation.
 */
export const demoMarketTicker: MarketTickerItem[] = [
  { symbol: 'GBPUSD', labelKey: 'workstation.instruments.gbpusd', tradingViewSymbol: 'OANDA:GBPUSD', price: '1.3472', change: '-0.31%', direction: 'negative', dataState: 'demo' },
  { symbol: 'EURUSD', labelKey: 'workstation.instruments.eurusd', tradingViewSymbol: 'OANDA:EURUSD', price: '1.1623', change: '-0.18%', direction: 'negative', dataState: 'demo' },
  { symbol: 'GER40', labelKey: 'workstation.instruments.ger40', tradingViewSymbol: 'OANDA:DE30EUR', price: '25,201', change: '+0.24%', direction: 'positive', dataState: 'demo' },
  { symbol: 'NAS100', labelKey: 'workstation.instruments.nas100', tradingViewSymbol: 'OANDA:NAS100USD', price: '23,587', change: '+0.41%', direction: 'positive', dataState: 'demo' },
  { symbol: 'XAUUSD', labelKey: 'workstation.instruments.xauusd', tradingViewSymbol: 'OANDA:XAUUSD', price: '2,403.6', change: '+0.52%', direction: 'positive', dataState: 'demo' },
  { symbol: 'USOIL', labelKey: 'workstation.instruments.usoil', tradingViewSymbol: 'TVC:USOIL', price: '77.24', change: '-0.28%', direction: 'negative', dataState: 'demo' },
  { symbol: 'DXY', labelKey: 'workstation.instruments.dxy', tradingViewSymbol: 'TVC:DXY', price: '104.32', change: '+0.36%', direction: 'positive', dataState: 'demo' }
]

export const demoEconomicEvents: EconomicEvent[] = [
  { time: '15:30', titleKey: 'workstation.events.usCpiYoy', impact: 'high', dataState: 'demo' },
  { time: '15:30', titleKey: 'workstation.events.usCpiMom', impact: 'high', dataState: 'demo' },
  { time: '16:00', titleKey: 'workstation.events.fedSpeech', impact: 'medium', dataState: 'demo' },
  { time: 'workstation.events.tomorrow', titleKey: 'workstation.events.boeMeeting', impact: 'high', dataState: 'demo' }
]

export const demoKeyLevels: MarketMetric[] = [
  { labelKey: 'workstation.metrics.bslResistance', value: '1.3528 – 1.3560', dataState: 'demo' },
  { labelKey: 'workstation.metrics.dailyOpen', value: '1.3502', dataState: 'demo' },
  { labelKey: 'workstation.metrics.currentPrice', value: '1.3472', direction: 'negative', dataState: 'demo' },
  { labelKey: 'workstation.metrics.intradaySupport', value: '1.3450', direction: 'positive', dataState: 'demo' },
  { labelKey: 'workstation.metrics.sslSupport', value: '1.3415', dataState: 'demo' }
]

export const demoSessionRange: MarketMetric[] = [
  { labelKey: 'workstation.metrics.asiaHigh', value: '1.3528', dataState: 'demo' },
  { labelKey: 'workstation.metrics.asiaLow', value: '1.3492', dataState: 'demo' },
  { labelKey: 'workstation.metrics.londonHigh', value: '1.3528', dataState: 'demo' },
  { labelKey: 'workstation.metrics.londonLow', value: '1.3450', dataState: 'demo' },
  { labelKey: 'workstation.metrics.currentSession', value: 'London', direction: 'positive', dataState: 'demo' }
]

export const demoCrossMarket: MarketMetric[] = [
  { labelKey: 'workstation.metrics.dxy', value: '104.32', change: '+0.36%', direction: 'positive', dataState: 'demo' },
  { labelKey: 'workstation.metrics.us2y', value: '4.08%', change: '+4.1 bp', direction: 'positive', dataState: 'demo' },
  { labelKey: 'workstation.metrics.us10y', value: '4.21%', change: '+3.8 bp', direction: 'positive', dataState: 'demo' },
  { labelKey: 'workstation.metrics.nasdaqCfd', value: '23,587', change: '+0.41%', direction: 'positive', dataState: 'demo' },
  { labelKey: 'workstation.metrics.goldSpot', value: '2,403.6', change: '+0.52%', direction: 'positive', dataState: 'demo' },
  { labelKey: 'workstation.metrics.usOilCfd', value: '77.24', change: '-0.28%', direction: 'negative', dataState: 'demo' }
]
