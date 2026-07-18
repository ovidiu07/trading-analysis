import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import BacktestingPage from './BacktestingPage'

const backtestingApiMock = vi.hoisted(() => ({
  listBacktestingWorkspaces: vi.fn(),
  createBacktestingWorkspace: vi.fn(),
  getBacktestingWorkspace: vi.fn(),
  updateBacktestingWorkspace: vi.fn(),
  archiveBacktestingWorkspace: vi.fn(),
  listBacktestingTrades: vi.fn(),
  createBacktestingTrade: vi.fn(),
  updateBacktestingTrade: vi.fn(),
  deleteBacktestingTrade: vi.fn(),
  importBacktestingTrades: vi.fn(),
  getBacktestingAnalytics: vi.fn(),
  getBacktestingResearchInbox: vi.fn(),
  updateBacktestingEvidence: vi.fn(),
  retryBacktestingEvidence: vi.fn(),
  listBacktestingEdgeLenses: vi.fn(),
  createBacktestingEdgeLens: vi.fn(),
  updateBacktestingEdgeLens: vi.fn(),
  deleteBacktestingEdgeLens: vi.fn(),
  listBacktestingScreenshots: vi.fn(),
  uploadBacktestingScreenshots: vi.fn(),
  updateBacktestingScreenshot: vi.fn(),
  deleteBacktestingScreenshot: vi.fn()
}))

const strategiesApiMock = vi.hoisted(() => ({ listStrategies: vi.fn() }))

vi.mock('../api/backtesting', async () => {
  const actual = await vi.importActual<typeof import('../api/backtesting')>('../api/backtesting')
  return { ...actual, ...backtestingApiMock }
})
vi.mock('../api/strategies', () => strategiesApiMock)
vi.mock('../components/assets/SecureAssetImage', () => ({ default: ({ alt }: { alt: string }) => <img alt={alt} /> }))
vi.mock('../features/backtesting/BacktestingCharts', () => ({ default: () => <div data-testid="backtesting-charts" /> }))

const workspace = {
  id: 'workspace-1',
  symbol: 'NQ',
  title: 'NQ Liquidity Research',
  marketType: 'Futures',
  strategyId: 'strategy-1',
  strategyNameSnapshot: 'Liquidity Sweep',
  strategyName: 'Liquidity Sweep',
  primaryTimeframe: '5m',
  contextTimeframe: '15m',
  executionTimeframe: '5m',
  entryTimeframe: '1m',
  session: 'NY AM',
  autoImportMode: 'EXACT_MATCH' as const,
  numberOfTrades: 12,
  winningTrades: 7,
  losingTrades: 5,
  breakevenTrades: 0,
  winRate: 58.3,
  lossRate: 41.7,
  breakevenRate: 0,
  categorizedTrades: 12,
  missingClassificationCount: 1,
  manualTradeCount: 6,
  importedTradeCount: 2,
  liveTradeCount: 4,
  inboxCount: 1,
  evidenceStatus: 'NEEDS_REVIEW' as const,
  evidenceConfidence: 'MODERATE' as const,
  screenshotCount: 0,
  totalR: 4,
  expectancy: 0.33,
  status: 'ACTIVE' as const,
  updatedAt: '2026-07-18T10:00:00Z'
}

const trades = Array.from({ length: 12 }, (_, index) => ({
  id: `trade-${index}`,
  workspaceId: workspace.id,
  liveTradeId: index >= 8 ? `live-${index}` : null,
  date: `2026-07-${String(index + 1).padStart(2, '0')}`,
  weekday: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][index % 5],
  entryTime: '09:30:00',
  instrument: 'NQ',
  direction: index % 2 ? 'SHORT' as const : 'LONG' as const,
  session: 'NY AM',
  setupName: 'Sweep + MSS',
  strategyId: 'strategy-1',
  strategyNameSnapshot: 'Liquidity Sweep',
  result: index < 7 ? 'WIN' as const : 'LOSS' as const,
  pnlR: index < 7 ? 1 : -0.6,
  tags: [],
  source: index >= 8 ? 'LIVE' as const : index >= 6 ? 'IMPORT' as const : 'MANUAL' as const,
  tradeScope: index >= 8 ? 'LIVE' as const : 'BACKTEST' as const,
  syncStatus: 'SYNCED' as const,
  classificationStatus: index === 11 ? 'NEEDS_CLASSIFICATION' as const : 'COMPLETE' as const,
  includedInAnalytics: true,
  screenshotCount: 0
}))

const renderPage = (path = '/backtesting') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider>
        <QueryClientProvider client={client}>
          <Routes>
            <Route path="/backtesting" element={<BacktestingPage />} />
            <Route path="/backtesting/:workspaceId" element={<BacktestingPage />} />
          </Routes>
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>
  )
}

describe('BacktestingPage Evidence Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem('app.language', 'en')
    backtestingApiMock.listBacktestingWorkspaces.mockResolvedValue({
      summary: { totalBacktests: 1, totalTradesTested: 12, manualTrades: 6, importedTrades: 2, liveTrades: 4, averageWinRate: 58.3, averageExpectancy: 0.33, strategiesNeedingReview: 1 },
      workspaces: [workspace]
    })
    backtestingApiMock.getBacktestingWorkspace.mockResolvedValue(workspace)
    backtestingApiMock.listBacktestingTrades.mockResolvedValue(trades)
    backtestingApiMock.getBacktestingResearchInbox.mockResolvedValue({ total: 0, needsWorkspace: 0, needsClassification: 0, ambiguousMatch: 0, syncErrors: 0, excluded: 0, items: [] })
    backtestingApiMock.getBacktestingAnalytics.mockResolvedValue({ baseline: {}, breakdowns: {}, impactRows: [], sourceMetrics: {}, regressionStatus: 'INSUFFICIENT_LIVE_DATA', recentLiveSampleSize: 4 })
    backtestingApiMock.listBacktestingScreenshots.mockResolvedValue([])
    backtestingApiMock.listBacktestingEdgeLenses.mockResolvedValue([])
    backtestingApiMock.createBacktestingTrade.mockResolvedValue(trades[0])
    strategiesApiMock.listStrategies.mockResolvedValue({ myStrategies: [{ id: 'strategy-1', source: 'MY', name: 'Liquidity Sweep', sessionSuitability: [], tags: [], archived: false }], mentorStrategies: [] })
  })

  it('separates the workspace library and surfaces source-aware research summary', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Backtesting' })).toBeInTheDocument()
    expect(screen.getByText('NQ Liquidity Research')).toBeInTheDocument()
    expect(screen.getAllByText('Live trades').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Research Inbox' })).toBeInTheDocument()
    expect(screen.queryByText('Manual versus live')).not.toBeInTheDocument()
  })

  it('renders a focused workspace with manual/live comparison and source labels', async () => {
    renderPage('/backtesting/workspace-1')
    expect(await screen.findByRole('heading', { name: 'NQ Liquidity Research' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Manual versus live' })).toBeInTheDocument()
    expect(screen.getAllByText('Live').length).toBeGreaterThan(0)
    expect(screen.getByText(/Insufficient live data/)).toBeInTheDocument()
  })

  it('requires a consistent result and R multiple before saving a manual trade', async () => {
    renderPage('/backtesting/workspace-1')
    await screen.findByRole('heading', { name: 'NQ Liquidity Research' })
    await userEvent.click(screen.getAllByRole('button', { name: 'Add manual trade' })[0])
    const rMultiple = await screen.findByRole('spinbutton', { name: 'R multiple' })
    fireEvent.change(rMultiple, { target: { value: '-1' } })
    expect(await screen.findByText('Result and R multiple point in opposite directions. Correct them before saving.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(backtestingApiMock.createBacktestingTrade).not.toHaveBeenCalled()
  })
})
