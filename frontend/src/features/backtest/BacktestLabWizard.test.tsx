import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BacktestLabWizard from './BacktestLabWizard'

const backtestApiMock = vi.hoisted(() => ({
  createBacktestDatasetSet: vi.fn(),
  uploadBacktestDatasetCsv: vi.fn(),
  getBacktestDatasetSetDatasets: vi.fn(),
  deleteBacktestDataset: vi.fn(),
  saveBacktestStrategyConfig: vi.fn(),
  runBacktestDatasetSet: vi.fn(),
  runBacktestOptimizer: vi.fn(),
  getBacktestOptimizerRun: vi.fn(),
  getBacktestRunResultsV2: vi.fn(),
  getBacktestRunReportV2: vi.fn(),
  getBacktestRunCandidatesV2: vi.fn(),
  reviewBacktestCandidate: vi.fn(),
  promoteBacktestRunToPlaybook: vi.fn()
}))

const sessionApiMock = vi.hoisted(() => ({
  applyTodayPlaybook: vi.fn()
}))

vi.mock('../../api/backtest', () => backtestApiMock)
vi.mock('../../api/session', () => sessionApiMock)

const renderWizard = (props: ComponentProps<typeof BacktestLabWizard> = {}) => render(
  <MemoryRouter>
    <BacktestLabWizard {...props} />
  </MemoryRouter>
)

const uploadCsvAndContinue = async () => {
  const fileInput = document.querySelector('input[type="file"][accept=".csv,text/csv"]') as HTMLInputElement
  fireEvent.change(fileInput, { target: { files: [new File(['time,open,high,low,close\n1,1,2,0.5,1.5'], 'EURUSD_M5.csv', { type: 'text/csv' })] } })
  await waitFor(() => expect(backtestApiMock.uploadBacktestDatasetCsv).toHaveBeenCalled())
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

const runBacktestToResults = async () => {
  await uploadCsvAndContinue()
  await userEvent.click(screen.getByRole('button', { name: /Save Strategy/i }))
  await userEvent.click(screen.getByRole('button', { name: /Regenerate Backtest/i }))
  await waitFor(() => expect(backtestApiMock.runBacktestDatasetSet).toHaveBeenCalled())
  await screen.findByText('Quick Backtest Summary')
}

describe('BacktestLabWizard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    backtestApiMock.createBacktestDatasetSet.mockResolvedValue({
      id: 'set-1',
      instrument: 'EURUSD',
      timezoneBasis: 'UTC',
      createdAt: '2026-02-24T10:00:00Z'
    })
    backtestApiMock.uploadBacktestDatasetCsv.mockResolvedValue({
      datasetId: 'dataset-1',
      timeframe: 'M5',
      originalFilename: 'EURUSD_M5.csv',
      minTimeUtc: '2026-02-01T00:00:00Z',
      maxTimeUtc: '2026-02-10T23:55:00Z',
      candleCount: 2880,
      columnsMapped: 'time/open/high/low/close',
      status: 'READY',
      runnable: true,
      minRequiredCandles: 30,
      warnings: [],
      fatalErrors: []
    })
    backtestApiMock.getBacktestDatasetSetDatasets.mockResolvedValue({
      datasetSetId: 'set-1',
      instrument: 'EURUSD',
      timezoneBasis: 'UTC',
      datasets: [
        {
          datasetId: 'dataset-1',
          timeframe: 'M5',
          originalFilename: 'EURUSD_M5.csv',
          minTimeUtc: '2026-02-01T00:00:00Z',
          maxTimeUtc: '2026-02-10T23:55:00Z',
          candleCount: 2880,
          columnsMapped: 'time/open/high/low/close',
          status: 'READY',
          runnable: true,
          minRequiredCandles: 30,
          warnings: [],
          fatalErrors: []
        }
      ],
      sessionPreview: [
        {
          sessionName: 'LONDON',
          sessionDate: '2026-02-03',
          candleCount: 108,
          sessionHigh: 1.105,
          sessionLow: 1.101
        }
      ]
    })
    backtestApiMock.saveBacktestStrategyConfig.mockResolvedValue({
      id: 'cfg-1',
      datasetSetId: 'set-1',
      name: 'Asia Sweep -> London Reversal',
      configJson: {},
      createdAt: '2026-02-24T10:05:00Z',
      updatedAt: '2026-02-24T10:05:00Z'
    })
    backtestApiMock.runBacktestDatasetSet.mockResolvedValue({
      runId: 'run-1',
      status: 'COMPLETED',
      symbol: 'EURUSD',
      timeframe: 'M5',
      fromUtc: '2026-02-03T00:00:00Z',
      toUtc: '2026-02-10T23:59:59Z',
      createdAt: '2026-02-24T10:10:00Z',
      completedAt: '2026-02-24T10:10:04Z',
      errorMsg: null,
      warnings: []
    })
    backtestApiMock.getBacktestRunResultsV2.mockResolvedValue({
      runId: 'run-1',
      status: 'COMPLETED',
      strategyName: 'Asia Sweep -> London Reversal',
      createdAt: '2026-02-24T10:10:00Z',
      completedAt: '2026-02-24T10:10:04Z',
      summary: {
        sampleSize: 12,
        winRate: 58.33,
        expectancyR: 0.21,
        avgR: 0.21,
        avgMaeR: 0.65,
        avgMfeR: 1.45,
        fillRate: 81.2,
        avgDurationSec: 2140
      },
      trades: [
        {
          tradeId: 'trade-1',
          setupId: 'setup-1',
          sessionName: 'LONDON',
          direction: 'SHORT',
          entryTime: '2026-02-05T08:25:00Z',
          entryPrice: 1.102,
          stopLoss: 1.103,
          takeProfit: 1.1,
          exitTime: '2026-02-05T09:05:00Z',
          exitPrice: 1.1,
          exitReason: 'TP',
          fillStatus: 'FILLED',
          rMultiple: 2,
          maeR: 0.3,
          mfeR: 2.2,
          durationSec: 2400,
          evidence: {},
          timeline: [
            { stage: 'SWEEP', timeUtc: '2026-02-05T08:10:00Z', details: {} },
            { stage: 'DISPLACEMENT', timeUtc: '2026-02-05T08:15:00Z', details: {} },
            { stage: 'MSS_BOS', timeUtc: '2026-02-05T08:20:00Z', details: {} },
            { stage: 'ENTRY', timeUtc: '2026-02-05T08:25:00Z', details: {} },
            { stage: 'EXIT', timeUtc: '2026-02-05T09:05:00Z', details: {} }
          ]
        }
      ],
      candidates: [
        {
          candidateId: 'candidate-1',
          runId: 'run-1',
          tradeId: 'trade-1',
          symbol: 'EURUSD',
          sessionName: 'LONDON',
          setupTemplate: 'ASIA_SWEEP_LONDON_REVERSAL',
          state: 'CONVERTED_TO_TRADE',
          candidateTimeUtc: '2026-02-05T08:20:00Z',
          confidenceScore: 82,
          qualityLabel: 'HIGH',
          storySummary: 'Asia high sweep with London MSS confirmation.',
          qualifiedReason: 'Candidate passed all configured gates.',
          failedReason: null,
          pool: { type: 'ASIA_H' },
          sweep: { side: 'HIGH' },
          displacement: { ratio: '1.9' },
          structure: { confirmationType: 'MSS' },
          entry: { fillStatus: 'FILLED' },
          evidence: {}
        }
      ],
      candidateSummary: {
        totalCandidates: 1,
        convertedTrades: 1,
        userAccepted: 0,
        userRejected: 0,
        byState: { CONVERTED_TO_TRADE: 1 }
      },
      latestPlaybook: null
    })
    backtestApiMock.getBacktestRunCandidatesV2.mockResolvedValue([
      {
        candidateId: 'candidate-1',
        runId: 'run-1',
        tradeId: 'trade-1',
        symbol: 'EURUSD',
        sessionName: 'LONDON',
        setupTemplate: 'ASIA_SWEEP_LONDON_REVERSAL',
        state: 'CONVERTED_TO_TRADE',
        candidateTimeUtc: '2026-02-05T08:20:00Z',
        confidenceScore: 82,
        qualityLabel: 'HIGH',
        storySummary: 'Asia high sweep with London MSS confirmation.',
        qualifiedReason: 'Candidate passed all configured gates.',
        failedReason: null,
        pool: { type: 'ASIA_H' },
        sweep: { side: 'HIGH' },
        displacement: { ratio: '1.9' },
        structure: { confirmationType: 'MSS' },
        entry: { fillStatus: 'FILLED' },
        evidence: {}
      }
    ])
    backtestApiMock.getBacktestRunReportV2.mockResolvedValue({
      reportId: 'report-1',
      runId: 'run-1',
      strategyNameSnapshot: 'Asia Sweep -> London Reversal',
      strategyConfigSnapshotJson: {},
      filtersSnapshotJson: {},
      summarySnapshotJson: {},
      tradesTimelineSnapshotJson: [],
      recommendationsSnapshotJson: [],
      reportMarkdown: '# Strategy Diagnostics Report\n\n- Sample size: 12',
      reportVersion: 'v1',
      createdAtUtc: '2026-02-24T10:10:05Z'
    })
    backtestApiMock.runBacktestOptimizer.mockResolvedValue({
      optimizerRunId: 'opt-1',
      status: 'COMPLETED',
      variantCount: 8,
      maxVariants: 100,
      truncated: false,
      createdAtUtc: '2026-02-24T10:20:00Z',
      summary: { executedVariants: 8 },
      variants: []
    })
    backtestApiMock.getBacktestOptimizerRun.mockResolvedValue({
      optimizerRunId: 'opt-1',
      status: 'COMPLETED',
      variantCount: 8,
      maxVariants: 100,
      truncated: false,
      createdAtUtc: '2026-02-24T10:20:00Z',
      summary: {
        executedVariants: 8,
        bestWinRateVariant: { rank: 1, winRate: 60, sampleSize: 20, expectancyR: 0.2 },
        bestExpectancyVariant: { rank: 2, winRate: 55, sampleSize: 20, expectancyR: 0.3 },
        bestBalancedVariant: { rank: 3, winRate: 57, sampleSize: 24, expectancyR: 0.22 },
        recommendedLiveVariant: { rank: 4, winRate: 56, sampleSize: 26, expectancyR: 0.21 }
      },
      variants: [
        {
          rank: 1,
          params: { mssMinConfirmCandles: 3 },
          trades: 12,
          sampleSize: 12,
          winRate: 58.3,
          profitFactor: 1.7,
          expectancyR: 0.21,
          avgR: 0.21,
          maxDdR: 1.1,
          fillRate: 80
        }
      ]
    })
    backtestApiMock.reviewBacktestCandidate.mockResolvedValue({
      candidateId: 'candidate-1',
      candidateState: 'ACCEPTED_BY_USER',
      decision: 'ACCEPT',
      note: 'Accepted',
      reviewedAtUtc: '2026-02-24T10:30:00Z'
    })
    backtestApiMock.promoteBacktestRunToPlaybook.mockResolvedValue({
      playbookId: 'playbook-1',
      runId: 'run-1',
      datasetSetId: 'set-1',
      strategyConfigId: 'cfg-1',
      name: 'Asia Sweep Playbook',
      templateFamily: 'ASIA_SWEEP_LONDON_REVERSAL',
      status: 'ACTIVE',
      expectedWinRate: 58.33,
      expectancyR: 0.21,
      profitFactor: 1.7,
      maxDrawdownR: 1.2,
      sampleSize: 12,
      playbook: {},
      validationSummary: { confidence: 'Medium', sampleSize: 12 },
      createdAtUtc: '2026-02-24T10:35:00Z',
      updatedAtUtc: '2026-02-24T10:35:00Z'
    })

    sessionApiMock.applyTodayPlaybook.mockResolvedValue({
      id: 'today-1',
      sessionDate: '2026-03-01',
      activePlaybook: {
        playbookId: 'playbook-1',
        name: 'Asia Sweep Playbook',
        snapshot: {}
      }
    })

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width:599.95px') ? false : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })
  })

  it('shows quick backtest essential controls by default', async () => {
    renderWizard()
    await uploadCsvAndContinue()

    expect(screen.getByRole('button', { name: 'Quick Backtest' })).toBeInTheDocument()
    expect(screen.getByLabelText('Strategy template')).toBeInTheDocument()
    expect(screen.getByLabelText('Context TF')).toBeInTheDocument()
    expect(screen.getByLabelText('Pool TF')).toBeInTheDocument()
    expect(screen.getByLabelText('Entry TF')).toBeInTheDocument()
    expect(screen.getByLabelText('Sweep type')).toBeInTheDocument()
    expect(screen.getByLabelText('Minimum sweep depth (pips)')).toBeInTheDocument()
    expect(screen.getByLabelText('Displacement strictness')).toBeInTheDocument()
    expect(screen.getByLabelText('MSS strictness')).toBeInTheDocument()
    expect(screen.getByLabelText('Retrace %')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Advanced settings/i })).toBeInTheDocument()
  })

  it('runs quick flow and renders storyline-centric results', async () => {
    renderWizard()
    await runBacktestToResults()

    expect(screen.getByText('Quick Backtest Summary')).toBeInTheDocument()
    expect(screen.getByText('Candidate Flow')).toBeInTheDocument()
    expect(screen.getByText('Trades')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open Strategy Studio/i })).toBeInTheDocument()
  })

  it('renders strategy studio tabs and rule map/candidate/optimize panels', async () => {
    renderWizard()
    await uploadCsvAndContinue()

    await userEvent.click(screen.getByRole('button', { name: 'Strategy Studio' }))

    expect(screen.getByRole('tab', { name: 'Recipe' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Rules Map' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Candidates' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Optimize' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Rules Map' }))
    expect(screen.getByText(/Flow: Pool detected/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Candidates' }))
    expect(screen.getByText(/Run a backtest first/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Optimize' }))
    expect(screen.getByRole('button', { name: /Run Optimizer/i })).toBeInTheDocument()
  })

  it('supports candidate review actions in strategy studio', async () => {
    renderWizard()
    await runBacktestToResults()

    await userEvent.click(screen.getByRole('button', { name: /Open Strategy Studio/i }))
    await userEvent.click(screen.getByRole('tab', { name: 'Candidates' }))

    expect(await screen.findByText(/Asia high sweep with London MSS confirmation/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))

    await waitFor(() => expect(backtestApiMock.reviewBacktestCandidate).toHaveBeenCalledWith(
      'candidate-1',
      expect.objectContaining({ decision: 'ACCEPT' })
    ))
  })

  it('promotes a run to playbook and applies it to today session', async () => {
    renderWizard()
    await runBacktestToResults()

    await userEvent.click(screen.getByRole('button', { name: /Promote to Playbook/i }))
    await waitFor(() => expect(backtestApiMock.promoteBacktestRunToPlaybook).toHaveBeenCalled())

    await userEvent.click(screen.getByRole('button', { name: /Apply Playbook to Today/i }))
    await waitFor(() => expect(sessionApiMock.applyTodayPlaybook).toHaveBeenCalledWith('playbook-1'))
    expect(await screen.findByText(/Active Strategy Playbook: Asia Sweep Playbook/i)).toBeInTheDocument()
  })

  it('shows symbol mismatch warning when header symbol differs from dataset instrument', async () => {
    localStorage.setItem('session.backtestLab.datasetSetId', 'set-1')
    renderWizard({ headerSymbol: 'GBPUSD' })

    const fileInput = document.querySelector('input[type="file"][accept=".csv,text/csv"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['time,open,high,low,close\n1,1,2,0.5,1.5'], 'EURUSD_M5.csv', { type: 'text/csv' })] } })

    await waitFor(() => expect(backtestApiMock.uploadBacktestDatasetCsv).toHaveBeenCalled())
    expect(await screen.findByText(/Symbol mismatch/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Use GBPUSD/i })).toBeInTheDocument()
  })

  it('keeps upload section readable on mobile width', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width:599.95px'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })

    renderWizard()
    expect(await screen.findByText('Upload CSVs')).toBeInTheDocument()
    expect(screen.getByText(/No files uploaded yet/i)).toBeInTheDocument()
  })
})
