import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BacktestLabWizard from './BacktestLabWizard'

const backtestApiMock = vi.hoisted(() => ({
  createBacktestDatasetSet: vi.fn(),
  uploadBacktestDatasetCsv: vi.fn(),
  getBacktestDatasetSetDatasets: vi.fn(),
  deleteBacktestDataset: vi.fn(),
  saveBacktestStrategyConfig: vi.fn(),
  runBacktestDatasetSet: vi.fn(),
  getBacktestRunResultsV2: vi.fn(),
  getBacktestRunReportV2: vi.fn()
}))

vi.mock('../../api/backtest', () => backtestApiMock)

const renderWizard = () => render(
  <MemoryRouter>
    <BacktestLabWizard />
  </MemoryRouter>
)

describe('BacktestLabWizard', () => {
  beforeEach(() => {
    localStorage.clear()
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
      name: 'Asia Raid -> London Reversal',
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
      errorMsg: null
    })
    backtestApiMock.getBacktestRunResultsV2.mockResolvedValue({
      runId: 'run-1',
      status: 'COMPLETED',
      strategyName: 'Asia Raid -> London Reversal',
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
            { stage: 'SWEEP', timeUtc: '2026-02-05T08:10:00Z', details: { depth: 0.0008 } },
            { stage: 'DISPLACEMENT', timeUtc: '2026-02-05T08:15:00Z', details: {} },
            { stage: 'MSS_BOS', timeUtc: '2026-02-05T08:20:00Z', details: {} },
            { stage: 'ENTRY', timeUtc: '2026-02-05T08:25:00Z', details: {} },
            { stage: 'EXIT', timeUtc: '2026-02-05T09:05:00Z', details: { reason: 'TP' } }
          ]
        }
      ]
    })
    backtestApiMock.getBacktestRunReportV2.mockResolvedValue({
      reportId: 'report-1',
      runId: 'run-1',
      strategyNameSnapshot: 'Asia Raid -> London Reversal',
      strategyConfigSnapshotJson: {},
      filtersSnapshotJson: {},
      summarySnapshotJson: {},
      tradesTimelineSnapshotJson: [],
      recommendationsSnapshotJson: [],
      reportMarkdown: '# Strategy Diagnostics Report\n\n- Sample size: 12',
      reportVersion: 'v1',
      createdAtUtc: '2026-02-24T10:10:05Z'
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

  it('supports upload -> strategy save -> run flow', async () => {
    const user = userEvent.setup()
    renderWizard()

    const fileInput = document.querySelector('input[type="file"][accept=".csv,text/csv"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()
    const file = new File(['time,open,high,low,close\n1,1,2,0.5,1.5'], 'EURUSD_M5.csv', { type: 'text/csv' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => expect(backtestApiMock.uploadBacktestDatasetCsv).toHaveBeenCalled())
    expect(await screen.findByText('Upload Summary')).toBeInTheDocument()
    expect(screen.getByText('EURUSD_M5.csv')).toBeInTheDocument()
    expect(screen.getByText('Session Preview')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByLabelText('Strategy name')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Asia Raid -> London Reversal/i }))
    await user.click(screen.getByRole('button', { name: /Save Strategy Config/i }))
    await waitFor(() => expect(backtestApiMock.saveBacktestStrategyConfig).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /Run backtest/i }))
    await waitFor(() => expect(backtestApiMock.runBacktestDatasetSet).toHaveBeenCalled())
    expect(await screen.findByText('Trades')).toBeInTheDocument()
    expect(screen.getByText(/Generate Diagnostics Report/i)).toBeInTheDocument()
  })

  it('opens trade timeline drawer and renders report markdown', async () => {
    const user = userEvent.setup()
    renderWizard()

    const fileInput = document.querySelector('input[type="file"][accept=".csv,text/csv"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: { files: [new File(['time,open,high,low,close\n1,1,2,0.5,1.5'], 'EURUSD_M5.csv', { type: 'text/csv' })] }
    })

    await waitFor(() => expect(backtestApiMock.uploadBacktestDatasetCsv).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /Save Strategy Config/i }))
    await user.click(screen.getByRole('button', { name: /Run backtest/i }))

    const timelineButton = await screen.findByRole('button', { name: /Timeline/i })
    await user.click(timelineButton)
    expect(await screen.findByText('Trade Timeline')).toBeInTheDocument()
    expect(screen.getByText('SWEEP')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: /Generate Diagnostics Report/i }))
    expect(await screen.findByText('Strategy Diagnostics Report')).toBeInTheDocument()
  })

  it('auto-populates run date range from dataset bounds', async () => {
    const user = userEvent.setup()
    backtestApiMock.getBacktestDatasetSetDatasets.mockResolvedValue({
      datasetSetId: 'set-1',
      instrument: 'EURUSD',
      timezoneBasis: 'UTC',
      datasets: [
        {
          datasetId: 'dataset-1',
          timeframe: 'M5',
          originalFilename: 'EURUSD_M5.csv',
          minTimeUtc: '2002-01-02T00:00:00Z',
          maxTimeUtc: '2025-12-31T23:55:00Z',
          candleCount: 2880,
          columnsMapped: 'time/open/high/low/close',
          status: 'READY',
          runnable: true,
          minRequiredCandles: 30,
          warnings: [],
          fatalErrors: []
        }
      ],
      sessionPreview: []
    })
    renderWizard()

    const fileInput = document.querySelector('input[type="file"][accept=".csv,text/csv"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['time,open,high,low,close\n1,1,2,0.5,1.5'], 'EURUSD_M5.csv', { type: 'text/csv' })] } })

    await waitFor(() => expect(backtestApiMock.uploadBacktestDatasetCsv).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /Save Strategy Config/i }))

    const fromField = await screen.findByLabelText('From')
    const toField = await screen.findByLabelText('To')
    expect(fromField).toHaveValue('2002-01-02')
    expect(toField).toHaveValue('2025-12-31')
  })

  it('uses selected execution timeframe dataset bounds instead of global earliest dataset', async () => {
    const user = userEvent.setup()
    backtestApiMock.getBacktestDatasetSetDatasets.mockResolvedValue({
      datasetSetId: 'set-1',
      instrument: 'EURUSD',
      timezoneBasis: 'UTC',
      datasets: [
        {
          datasetId: 'dataset-m5',
          timeframe: 'M5',
          originalFilename: 'EURUSD_M5.csv',
          minTimeUtc: '2025-11-09T22:00:00Z',
          maxTimeUtc: '2026-02-20T21:55:00Z',
          candleCount: 21024,
          columnsMapped: 'time/open/high/low/close',
          status: 'READY',
          runnable: true,
          minRequiredCandles: 30,
          warnings: [],
          fatalErrors: []
        },
        {
          datasetId: 'dataset-d1',
          timeframe: 'D1',
          originalFilename: 'EURUSD_D1.csv',
          minTimeUtc: '2002-05-05T21:00:00Z',
          maxTimeUtc: '2026-02-19T22:00:00Z',
          candleCount: 6181,
          columnsMapped: 'time/open/high/low/close',
          status: 'READY',
          runnable: true,
          minRequiredCandles: 30,
          warnings: [],
          fatalErrors: []
        }
      ],
      sessionPreview: []
    })
    renderWizard()

    const fileInput = document.querySelector('input[type="file"][accept=".csv,text/csv"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['time,open,high,low,close\n1,1,2,0.5,1.5'], 'EURUSD_M5.csv', { type: 'text/csv' })] } })

    await waitFor(() => expect(backtestApiMock.uploadBacktestDatasetCsv).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /Save Strategy Config/i }))

    const fromField = await screen.findByLabelText('From')
    const toField = await screen.findByLabelText('To')
    expect(fromField).toHaveValue('2025-11-09')
    expect(toField).toHaveValue('2026-02-20')
  })

  it('disables run button when date range is invalid', async () => {
    const user = userEvent.setup()
    renderWizard()

    const fileInput = document.querySelector('input[type="file"][accept=".csv,text/csv"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['time,open,high,low,close\n1,1,2,0.5,1.5'], 'EURUSD_M5.csv', { type: 'text/csv' })] } })

    await waitFor(() => expect(backtestApiMock.uploadBacktestDatasetCsv).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /Save Strategy Config/i }))

    fireEvent.change(await screen.findByLabelText('From'), { target: { value: '2026-02-10' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-02-01' } })

    const callsBefore = backtestApiMock.runBacktestDatasetSet.mock.calls.length
    const runButton = screen.getByRole('button', { name: /Run backtest/i })
    expect(runButton).toBeDisabled()
    expect(backtestApiMock.runBacktestDatasetSet.mock.calls.length).toBe(callsBefore)
  })

  it('enables run button and shows warning panel when dataset is WARN but runnable', async () => {
    const user = userEvent.setup()
    backtestApiMock.getBacktestDatasetSetDatasets.mockResolvedValue({
      datasetSetId: 'set-1',
      instrument: 'EURUSD',
      timezoneBasis: 'UTC',
      datasets: [
        {
          datasetId: 'dataset-m5',
          timeframe: 'M5',
          originalFilename: 'EURUSD_M5.csv',
          minTimeUtc: '2025-11-09T22:00:00Z',
          maxTimeUtc: '2026-02-20T21:55:00Z',
          candleCount: 21024,
          columnsMapped: 'time/open/high/low/close',
          status: 'WARN',
          runnable: true,
          minRequiredCandles: 30,
          warnings: [{ code: 'DUPLICATES_REMOVED', message: 'Removed 4 duplicate timestamps.' }],
          fatalErrors: []
        }
      ],
      sessionPreview: []
    })
    renderWizard()

    const fileInput = document.querySelector('input[type="file"][accept=".csv,text/csv"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['time,open,high,low,close\n1,1,2,0.5,1.5'], 'EURUSD_M5.csv', { type: 'text/csv' })] } })

    await waitFor(() => expect(backtestApiMock.uploadBacktestDatasetCsv).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /Save Strategy Config/i }))

    expect(await screen.findByText(/Dataset has warnings/i)).toBeInTheDocument()
    const runButton = screen.getByRole('button', { name: /Run backtest/i })
    expect(runButton).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /View warnings/i }))
    expect(await screen.findByText(/DUPLICATES_REMOVED: Removed 4 duplicate timestamps./i)).toBeInTheDocument()
  })

  it('disables run button when selected timeframe dataset is not runnable', async () => {
    const user = userEvent.setup()
    backtestApiMock.getBacktestDatasetSetDatasets.mockResolvedValue({
      datasetSetId: 'set-1',
      instrument: 'EURUSD',
      timezoneBasis: 'UTC',
      datasets: [
        {
          datasetId: 'dataset-m5',
          timeframe: 'M5',
          originalFilename: 'EURUSD_M5.csv',
          minTimeUtc: '2025-11-09T22:00:00Z',
          maxTimeUtc: '2026-02-20T21:55:00Z',
          candleCount: 0,
          columnsMapped: 'time/open/high/low/close',
          status: 'WARN',
          runnable: false,
          minRequiredCandles: 30,
          warnings: [],
          fatalErrors: [{ code: 'NO_CANDLES', message: 'No candles were persisted for this dataset.' }]
        }
      ],
      sessionPreview: []
    })
    renderWizard()

    const fileInput = document.querySelector('input[type="file"][accept=".csv,text/csv"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [new File(['time,open,high,low,close\n1,1,2,0.5,1.5'], 'EURUSD_M5.csv', { type: 'text/csv' })] } })

    await waitFor(() => expect(backtestApiMock.uploadBacktestDatasetCsv).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: /Save Strategy Config/i }))

    expect((await screen.findAllByText(/No candles were persisted for this dataset./i)).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Run backtest/i })).toBeDisabled()
  })

  it('keeps cards readable on mobile width', async () => {
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
    const card = screen.getByText('Upload Summary').closest('.MuiCard-root')
    expect(card).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText(/No files uploaded yet/i)).toBeInTheDocument()
  })
})
