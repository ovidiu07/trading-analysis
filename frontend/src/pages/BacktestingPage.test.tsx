import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  listBacktestingEdgeLenses: vi.fn(),
  createBacktestingEdgeLens: vi.fn(),
  updateBacktestingEdgeLens: vi.fn(),
  deleteBacktestingEdgeLens: vi.fn(),
  recalculateBacktestingEdgeLens: vi.fn(),
  listBacktestingScreenshots: vi.fn(),
  uploadBacktestingScreenshots: vi.fn(),
  updateBacktestingScreenshot: vi.fn(),
  deleteBacktestingScreenshot: vi.fn(),
  detachBacktestingScreenshotTrade: vi.fn()
}))

const strategiesApiMock = vi.hoisted(() => ({
  listStrategies: vi.fn()
}))

vi.mock('../api/backtesting', async () => {
  const actual = await vi.importActual<typeof import('../api/backtesting')>('../api/backtesting')
  return { ...actual, ...backtestingApiMock }
})

vi.mock('../api/strategies', () => strategiesApiMock)

vi.mock('../components/assets/SecureAssetImage', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} src="data:image/png;base64,stub" />
}))

const workspace = {
  id: 'workspace-1',
  symbol: 'NQ',
  marketType: 'Futures',
  strategyId: 'strategy-1',
  strategyNameSnapshot: 'Liquidity Sweep + FVG Mitigation',
  strategyName: 'Liquidity Sweep + FVG Mitigation',
  title: null,
  primaryTimeframe: null,
  contextTimeframe: '15m',
  executionTimeframe: '5m',
  entryTimeframe: '1m',
  numberOfTrades: 20,
  winningTrades: 12,
  losingTrades: 6,
  breakevenTrades: 2,
  averageR: null,
  winRate: 60,
  lossRate: 30,
  breakevenRate: 10,
  categorizedTrades: 20,
  missingClassificationCount: 0,
  screenshotCount: 2,
  notes: '',
  whatWorked: 'Clean displacement after sweep',
  whatFailed: 'Late entries',
  bestConditions: '',
  avoidConditions: '',
  status: 'ACTIVE' as const,
  createdAt: '2026-04-26T10:00:00Z',
  updatedAt: '2026-04-26T10:00:00Z',
  strategy: {
    id: 'strategy-1',
    name: 'Liquidity Sweep + FVG Mitigation',
    model: 'Sweep + MSS',
    entryConditions: ['Sweep liquidity', 'Displacement'],
    invalidationLogic: 'Close below origin',
    tpFramework: 'Target opposing liquidity',
    noTradeRules: 'No displacement'
  }
}

const screenshots = [
  {
    id: 'shot-1',
    workspaceId: 'workspace-1',
    assetId: 'asset-1',
    originalFileName: 'winner.png',
    contentType: 'image/png',
    sizeBytes: 100,
    url: '/api/assets/asset-1/view',
    viewUrl: '/api/assets/asset-1/view',
    downloadUrl: '/api/assets/asset-1/download',
    thumbnailUrl: '/api/assets/asset-1/view',
    caption: 'Clean winner',
    tradeResult: 'WIN' as const,
    session: 'NY',
    timeframe: '1m',
    tags: ['clean sweep'],
    sortOrder: 0,
    createdAt: '2026-04-26T10:00:00Z',
    updatedAt: '2026-04-26T10:00:00Z',
    asset: null
  },
  {
    id: 'shot-2',
    workspaceId: 'workspace-1',
    assetId: 'asset-2',
    originalFileName: 'loss.png',
    contentType: 'image/png',
    sizeBytes: 100,
    url: '/api/assets/asset-2/view',
    viewUrl: '/api/assets/asset-2/view',
    downloadUrl: '/api/assets/asset-2/download',
    thumbnailUrl: '/api/assets/asset-2/view',
    caption: 'Late loss',
    tradeResult: 'LOSS' as const,
    session: 'London',
    timeframe: '5m',
    tags: ['late entry'],
    sortOrder: 1,
    createdAt: '2026-04-26T10:00:00Z',
    updatedAt: '2026-04-26T10:00:00Z',
    asset: null
  }
]

const structuredTrades = Array.from({ length: 20 }, (_, index) => ({
  id: `trade-${index + 1}`,
  workspaceId: 'workspace-1',
  date: `2026-04-${String((index % 20) + 1).padStart(2, '0')}`,
  weekday: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][index % 5],
  entryTime: `${String(9 + (index % 4)).padStart(2, '0')}:30:00`,
  instrument: 'NQ',
  direction: index % 2 === 0 ? 'LONG' as const : 'SHORT' as const,
  session: index % 2 === 0 ? 'NY AM' : 'London',
  setupName: 'Sweep + FVG',
  strategyId: 'strategy-1',
  riskPercent: 1,
  plannedRR: 2,
  result: index < 12 ? 'WIN' as const : index < 18 ? 'LOSS' as const : 'BREAKEVEN' as const,
  pnlR: index < 12 ? 1 : index < 18 ? -1 : 0,
  contextTimeframe: '15m',
  executionTimeframe: '5m',
  entryTimeframe: '1m',
  tags: ['clean sweep'],
  notes: index < 12 ? 'Clean winner' : 'Late entry',
  source: 'MANUAL' as const,
  tradeScope: 'BACKTEST' as const,
  screenshotCount: index < 2 ? 1 : 0,
  createdAt: '2026-04-26T10:00:00Z',
  updatedAt: '2026-04-26T10:00:00Z'
}))

const renderBacktestingPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <MemoryRouter initialEntries={['/backtesting']}>
      <QueryClientProvider client={queryClient}>
        <BacktestingPage />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('BacktestingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    backtestingApiMock.listBacktestingWorkspaces.mockResolvedValue({
      summary: {
        totalBacktests: 1,
        totalScreenshots: 2,
        totalTradesTested: 20,
        averageWinRate: 60,
        bestPerformer: 'NQ · Liquidity Sweep + FVG Mitigation'
      },
      workspaces: [workspace]
    })
    backtestingApiMock.getBacktestingWorkspace.mockResolvedValue(workspace)
    backtestingApiMock.listBacktestingTrades.mockResolvedValue(structuredTrades)
    backtestingApiMock.listBacktestingEdgeLenses.mockResolvedValue([])
    backtestingApiMock.listBacktestingScreenshots.mockResolvedValue(screenshots)
    backtestingApiMock.updateBacktestingWorkspace.mockResolvedValue(workspace)
    backtestingApiMock.createBacktestingTrade.mockResolvedValue(structuredTrades[0])
    backtestingApiMock.deleteBacktestingScreenshot.mockResolvedValue(undefined)
    strategiesApiMock.listStrategies.mockResolvedValue({
      myStrategies: [
        {
          id: 'strategy-1',
          source: 'MY',
          name: 'Liquidity Sweep + FVG Mitigation',
          model: 'Sweep + MSS',
          entryConditions: ['Sweep liquidity'],
          invalidationLogic: 'Close below origin',
          tpFramework: 'Target opposing liquidity',
          sessionSuitability: [],
          tags: [],
          archived: false
        }
      ],
      mentorStrategies: []
    })
  })

  it('renders structured workspace stats, evidence, and carousel review', async () => {
    renderBacktestingPage()

    expect((await screen.findAllByText(/NQ · Liquidity Sweep \+ FVG Mitigation/i)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('60%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Early signal').length).toBeGreaterThan(0)

    await userEvent.click(await screen.findByAltText('Clean winner'))
    expect(await screen.findByText('1 / 2')).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText('Close carousel'))
  })

  it('shows trade validation warnings in Quick Add', async () => {
    renderBacktestingPage()

    await screen.findByText('Latest evidence')
    await userEvent.click(screen.getByRole('button', { name: /Quick add trade/i }))
    expect(await screen.findByText('Quick Add Trade')).toBeInTheDocument()
    const pnl = await screen.findByRole('spinbutton', { name: /P&L/i })
    await userEvent.clear(pnl)
    await userEvent.type(pnl, '-1')

    expect(await screen.findByText('Result is WIN but P&L(R) is negative. You can save it, but check the row.')).toBeInTheDocument()
    expect(backtestingApiMock.createBacktestingTrade).not.toHaveBeenCalled()
  })
})
