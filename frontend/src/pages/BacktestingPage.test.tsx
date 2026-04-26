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
  listBacktestingScreenshots: vi.fn(),
  uploadBacktestingScreenshots: vi.fn(),
  updateBacktestingScreenshot: vi.fn(),
  deleteBacktestingScreenshot: vi.fn()
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
    backtestingApiMock.listBacktestingScreenshots.mockResolvedValue(screenshots)
    backtestingApiMock.updateBacktestingWorkspace.mockResolvedValue(workspace)
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

  it('renders workspace stats, screenshot gallery, and carousel review', async () => {
    renderBacktestingPage()

    expect((await screen.findAllByText(/NQ · Liquidity Sweep \+ FVG Mitigation/i)).length).toBeGreaterThan(0)
    expect(screen.getByText('60% WR')).toBeInTheDocument()

    await userEvent.click(await screen.findByAltText('Clean winner'))
    expect(await screen.findByText('1 / 2')).toBeInTheDocument()
  })

  it('blocks invalid stat combinations before saving', async () => {
    renderBacktestingPage()

    await screen.findByText('Manual performance stats')
    const trades = screen.getByLabelText('Trades')
    await userEvent.clear(trades)
    await userEvent.type(trades, '10')
    const wins = screen.getByLabelText('Wins')
    await userEvent.clear(wins)
    await userEvent.type(wins, '9')
    const losses = screen.getByLabelText('Losses')
    await userEvent.clear(losses)
    await userEvent.type(losses, '9')

    expect(await screen.findByText('Wins, losses, and breakeven trades cannot exceed total trades.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save stats/i })).toBeDisabled()
    expect(backtestingApiMock.updateBacktestingWorkspace).not.toHaveBeenCalled()
  })
})
