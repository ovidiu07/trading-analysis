import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import DiagnosticsPage from './DiagnosticsPage'

const diagnosticsApiMock = vi.hoisted(() => ({
  listDiagnosticsStrategies: vi.fn(),
  getDiagnosticsStrategyDetail: vi.fn(),
  listDiagnosticsReports: vi.fn()
}))

vi.mock('../api/diagnostics', () => diagnosticsApiMock)
vi.mock('../api/backtest', () => ({
  getBacktestRunReportV2: vi.fn()
}))

describe('DiagnosticsPage', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // Recharts ResponsiveContainer relies on ResizeObserver in browser env.
    ;(globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
  })

  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    diagnosticsApiMock.listDiagnosticsStrategies.mockResolvedValue({
      strategies: [
        {
          strategyId: 'strat-1',
          strategyName: 'London Sweep',
          sampleSize: 20,
          winRate: 56,
          expectancyR: 0.24,
          profitFactor: 1.48
        }
      ]
    })
    diagnosticsApiMock.getDiagnosticsStrategyDetail.mockResolvedValue({
      strategyId: 'strat-1',
      strategyName: 'London Sweep',
      mode: 'BOTH',
      coreMetrics: {
        sampleSize: 20,
        winRate: 56,
        expectancyR: 0.24,
        profitFactor: 1.48,
        avgMaeR: 0.72,
        avgMfeR: 1.25,
        avgDurationMinutes: 42
      },
      breakdownBySession: [],
      breakdownBySymbol: [],
      breakdownByDayOfWeek: [],
      rDistribution: [
        { bucket: '-1R to 0R', count: 5 },
        { bucket: '0R to 1R', count: 8 },
        { bucket: '1R to 2R', count: 7 }
      ],
      triggerImpact: [
        {
          triggerKey: 'MSS confirmed',
          checkedExpectancy: 0.42,
          uncheckedExpectancy: -0.12,
          deltaExpectancy: 0.54,
          checkedCount: 12,
          uncheckedCount: 8
        }
      ],
      failureModes: [
        { label: 'RR < 1.5', count: 6, avgR: -0.45 }
      ],
      suggestions: [
        { title: 'Keep RR gate >= 1.5', description: 'Low RR setups are bleeding expectancy.' }
      ],
      backtestRuns: []
    })
    diagnosticsApiMock.listDiagnosticsReports.mockResolvedValue({ reports: [] })
  })

  it('loads diagnostics and renders core sections', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <I18nProvider>
          <DiagnosticsPage />
        </I18nProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(diagnosticsApiMock.getDiagnosticsStrategyDetail).toHaveBeenCalled()
    })

    expect(await screen.findByText('Strategy diagnostics')).toBeInTheDocument()
    expect(screen.getByText('R distribution')).toBeInTheDocument()
    expect(screen.getByText('What to change')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Strategy details' }))
    expect(await screen.findByText('Trigger impact')).toBeInTheDocument()
    expect(screen.getByText('MSS confirmed')).toBeInTheDocument()
  })

  it('shows unlock thresholds when sample size is too small', async () => {
    diagnosticsApiMock.getDiagnosticsStrategyDetail.mockResolvedValueOnce({
      strategyId: 'strat-1',
      strategyName: 'London Sweep',
      mode: 'BOTH',
      coreMetrics: {
        sampleSize: 1,
        winRate: 100,
        expectancyR: 0.2,
        profitFactor: 2,
        avgMaeR: 0.1,
        avgMfeR: 0.5,
        avgDurationMinutes: 10
      },
      breakdownBySession: [],
      breakdownBySymbol: [],
      breakdownByDayOfWeek: [],
      rDistribution: [],
      triggerImpact: [],
      failureModes: [],
      suggestions: [],
      backtestRuns: []
    })

    render(
      <MemoryRouter>
        <I18nProvider>
          <DiagnosticsPage />
        </I18nProvider>
      </MemoryRouter>
    )

    expect(await screen.findByText(/This section unlocks at 10/i)).toBeInTheDocument()
  })
})
