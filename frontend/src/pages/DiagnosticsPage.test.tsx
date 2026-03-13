import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import DiagnosticsPage from './DiagnosticsPage'

const diagnosticsApiMock = vi.hoisted(() => ({
  getLiveDiagnosticsSummary: vi.fn()
}))

const signalIntelApiMock = vi.hoisted(() => ({
  fetchSignalAnalyticsSummary: vi.fn(),
  fetchSignalBreakdownBySetup: vi.fn(),
  fetchSignalBreakdownByRegime: vi.fn(),
  fetchSignalRecommendations: vi.fn()
}))

vi.mock('../api/diagnostics', () => diagnosticsApiMock)
vi.mock('../api/signalIntel', () => signalIntelApiMock)

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <DiagnosticsPage />
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('DiagnosticsPage live summary', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
  })

  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    diagnosticsApiMock.getLiveDiagnosticsSummary.mockResolvedValue({
      coreMetrics: {
        sampleSize: 18,
        winRate: 55.56,
        expectancyR: 0.42,
        profitFactor: 1.71,
        avgMaeR: 0.38,
        avgMfeR: 1.24,
        avgDurationMinutes: 36
      },
      breakdownBySession: [
        { key: 'LONDON', sampleSize: 10, winRate: 60, expectancyR: 0.6 }
      ],
      breakdownBySymbol: [
        { key: 'EURUSD', sampleSize: 8, winRate: 62.5, expectancyR: 0.54 }
      ],
      breakdownByDayOfWeek: [
        { key: 'MONDAY', sampleSize: 3, winRate: 66.7, expectancyR: 0.5 }
      ],
      strategyPerformance: [
        { strategyId: 'strat-1', strategyName: 'London sweep', sampleSize: 12, winRate: 58, expectancyR: 0.48, profitFactor: 1.8 }
      ],
      failureModes: [
        { label: 'Late entries', count: 4, avgR: -0.31 }
      ],
      suggestions: [
        { title: 'Keep the reclaim requirement', description: 'The live sample is strongest when the reclaim prints before entry.' }
      ],
      generatedAt: '2026-03-06T08:00:00.000Z'
    })
    signalIntelApiMock.fetchSignalAnalyticsSummary.mockResolvedValue({
      overview: {
        totalSignals: 18,
        closedSignals: 14,
        openSignals: 4,
        winRate: 57.14,
        expectancyR: 0.36,
        avgPnlR: 0.36,
        avgConfidenceScore: 74,
        avgHoldBars: 5,
        avgHoldMinutes: 60
      },
      recentWindows: [],
      confidenceTrend: [
        { label: '2026-03-05', avgConfidenceScore: 72, expectancyR: 0.25, sampleSize: 4 }
      ],
      weakConditions: [
        { symbol: 'EURUSD', timeframe: '15', setupType: 'FVG_MITIGATION', regime: 'RANGE', direction: 'LONG', sampleSize: 6, winRate: 33, expectancyR: -0.28, action: 'REDUCE_CONFIDENCE' }
      ],
      topRecommendation: null
    })
    signalIntelApiMock.fetchSignalBreakdownBySetup.mockResolvedValue({
      rows: [
        { key: 'SWEEP_OB_REVERSAL', sampleSize: 10, winRate: 60, expectancyR: 0.48, avgPnlR: 0.48, avgConfidenceScore: 77, reducedConfidenceSuggested: false }
      ]
    })
    signalIntelApiMock.fetchSignalBreakdownByRegime.mockResolvedValue({
      rows: [
        { key: 'TREND', sampleSize: 9, winRate: 66, expectancyR: 0.52, avgPnlR: 0.52, avgConfidenceScore: 79, reducedConfidenceSuggested: false }
      ]
    })
    signalIntelApiMock.fetchSignalRecommendations.mockResolvedValue({
      recommendations: [
        {
          symbolScope: 'EURUSD',
          timeframe: '15',
          regimeScope: 'TREND',
          profileId: 'AUTO_15_TREND_V1',
          profileJson: {},
          minSamples: 12,
          sampleSize: 14,
          recommendationScore: 78,
          winRate: 57,
          expectancyR: 0.36,
          reasons: ['14 closed signals contributed to this recommendation.'],
          generatedAt: '2026-03-06T08:00:00.000Z'
        }
      ]
    })
  })

  it('renders live-only diagnostics sections', async () => {
    renderPage()

    expect(await screen.findByText('Live diagnostics')).toBeInTheDocument()
    expect(screen.getByText(/Backtest metrics are intentionally hidden/i)).toBeInTheDocument()
    expect(screen.getByText('Live session performance')).toBeInTheDocument()
    expect(screen.getByText('Strategy performance')).toBeInTheDocument()
    expect(screen.getByText('Symbol breakdown')).toBeInTheDocument()
    expect(screen.getByText('What to change')).toBeInTheDocument()
    expect(screen.getByText('Signal intelligence')).toBeInTheDocument()
    expect(screen.getByText('Recommended profile')).toBeInTheDocument()
    expect(screen.queryByText(/Backtest runs/i)).not.toBeInTheDocument()
  })
})
