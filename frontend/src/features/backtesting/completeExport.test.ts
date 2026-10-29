import { beforeEach, describe, expect, it, vi } from 'vitest'
import { unzipSync } from 'fflate'
import { assembleCompleteExport, prepareCompleteExport } from './completeExport'
import { reportArchive, type ExportPeriod } from './export'
import { getBacktestingExportContext, type BacktestingExportContext } from '../../api/backtesting'
import { apiPost } from '../../api/client'
import { fetchAssetBlob, listTradeAssets } from '../../api/assets'
import { listStrategies } from '../../api/strategies'
import { getStudio, getVersion } from '../../api/strategyStudio'

vi.mock('../../api/backtesting', () => ({ getBacktestingExportContext: vi.fn() }))
vi.mock('../../api/assets', () => ({ fetchAssetBlob: vi.fn(), listTradeAssets: vi.fn() }))
vi.mock('../../api/client', () => ({ apiPost: vi.fn() }))
vi.mock('../../api/strategies', () => ({ listStrategies: vi.fn() }))
vi.mock('../../api/strategyStudio', () => ({ getStudio: vi.fn(), getVersion: vi.fn() }))

const period: ExportPeriod = { from: '', to: '', dateBasis: 'entry', allDates: true }
const context = (): BacktestingExportContext => ({
  generatedAt: '2026-10-29T10:00:00Z', workspace: { id: 'w', notes: 'Exact notes\nObservații', strategyId: 'strategy' },
  trades: [{ id: 't', workspaceId: 'w', date: '2021-10-05', entryTime: '10:15', instrument: 'DAX', direction: 'LONG', result: 'WIN',
    pnlR: 2, tags: ['a', 'b'], source: 'IMPORT', tradeScope: 'REPLAY', notes: '=literal\ntext', strategyId: 'strategy', strategyVersionId: 'v1', screenshotCount: 1 }],
  screenshots: [{ id: 's', workspaceId: 'w', assetId: 'image', backtestingTradeId: 't', originalFileName: 'chart.png', caption: 'Entry', tags: ['atEntry'] },
    { id: 'workspace-image', workspaceId: 'w', assetId: 'context', originalFileName: '../chart.png', tags: ['higherTimeframe'] },
    { id: 'other', workspaceId: 'other', assetId: 'secret', originalFileName: 'secret.png' }],
  lenses: [], analytics: {}, liveEvidence: []
} as unknown as BacktestingExportContext)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(apiPost).mockImplementation(async (url) => {
    const assetId = url.split('/')[2]
    return { assetId, url: `https://storage.test/${assetId}?signature=test`, expiresAt: '2026-11-05T10:00:00Z' } as never
  })
  vi.mocked(fetchAssetBlob).mockResolvedValue({ size: 3, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as Blob)
  vi.mocked(listTradeAssets).mockResolvedValue([])
  vi.mocked(getStudio).mockResolvedValue({ strategy: { id: 'strategy', assets: [] }, definition: { rules: 'Full entry rules' }, revision: 2 } as never)
  vi.mocked(getVersion).mockResolvedValue({ version: { id: 'v1', versionNumber: 1 }, snapshot: { rules: 'Historical rules' } })
})

describe('complete analysis package', () => {
  it('preserves exact text and relationships, includes workspace evidence, rules, versions and binary images', async () => {
    vi.mocked(getBacktestingExportContext).mockResolvedValue(context())
    const result = await prepareCompleteExport('w', period)
    expect(getBacktestingExportContext).toHaveBeenCalledWith('w')
    const trades = JSON.parse(result.files['trades.json'] as string)
    expect(trades[0].notes).toBe('=literal\ntext')
    expect(trades[0].attachments[0]).toMatchObject({ tradeId: 't', screenshotId: 's', publicUrl: expect.stringContaining('https://storage.test/image'), archivePath: 'images/image-chart.png' })
    const attachments = JSON.parse(result.files['attachments.json'] as string)
    expect(attachments).toHaveLength(2)
    expect(attachments[1]).toMatchObject({ scope: 'WORKSPACE', tradeId: null })
    expect(JSON.stringify(attachments)).not.toContain('secret')
    expect(result.files['strategies.json']).toContain('Historical rules')
    expect(getVersion).toHaveBeenCalledWith('strategy', 'v1')
    expect([...unzipSync(reportArchive(result.files))['images/image-chart.png']]).toEqual([1, 2, 3])
    expect(result.files['trades.csv']).toContain('https://storage.test/image')
    expect(JSON.parse(result.files['manifest.json'] as string).counts).toMatchObject({ backtestTrades: 1, uniqueAssets: 2, workspaceScreenshots: 1 })
  })

  it('exports a linked mentor strategy without calling the private studio API', async () => {
    const input = context()
    input.trades[0].strategySource = 'MENTOR'
    input.trades[0].strategyVersionId = null
    vi.mocked(listStrategies).mockResolvedValue({ myStrategies: [], mentorStrategies: [{ id: 'strategy', source: 'MENTOR', name: 'Mentor rules', assets: [] }] } as never)
    const { files } = await assembleCompleteExport(input, period)
    expect(files['strategies.json']).toContain('Mentor rules')
    expect(getStudio).not.toHaveBeenCalled()
  })

  it('fails on image or strategy retrieval errors rather than returning a partial package', async () => {
    vi.mocked(fetchAssetBlob).mockRejectedValueOnce(new Error('storage unavailable'))
    await expect(assembleCompleteExport(context(), period)).rejects.toThrow('storage unavailable')
    vi.mocked(getStudio).mockRejectedValueOnce(new Error('strategy unavailable'))
    await expect(assembleCompleteExport(context(), period)).rejects.toThrow('strategy unavailable')
  })

  it('retains excluded live evidence separately and loads its original assets', async () => {
    const input = context()
    input.liveEvidence = [{ id: 'link', workspaceId: 'w', liveTradeId: 'live', includedInAnalytics: false, excludedReason: 'Review', tradeDate: '2020-01-01' }] as never
    vi.mocked(listTradeAssets).mockResolvedValue([{ id: 'live-image', originalFileName: 'chart.png', scope: 'TRADE' }])
    const { files } = await assembleCompleteExport(input, period)
    expect(JSON.parse(files['trades.json'] as string)).toHaveLength(1)
    expect(JSON.parse(files['live-evidence.json'] as string).evidence[0].excludedReason).toBe('Review')
    expect(JSON.parse(files['attachments.json'] as string).find((a: { scope: string }) => a.scope === 'LIVE')).toMatchObject({ liveTradeId: 'live', tradeId: 'link' })
  })

  it('does not drop an empty workspace or unlinked evidence and does not fabricate trade associations', async () => {
    const input = context()
    input.trades = []
    input.workspace.strategyId = null
    const { files } = await assembleCompleteExport(input, period)
    expect(JSON.parse(files['trades.json'] as string)).toEqual([])
    expect(JSON.parse(files['attachments.json'] as string)).toHaveLength(1)
    expect(JSON.parse(files['workspace.json'] as string).workspace.notes).toBe('Exact notes\nObservații')
  })

  it('keeps period selection exact and detects missing linked screenshots', async () => {
    const input = context()
    const { files } = await assembleCompleteExport(input, { from: '2026-01-01', to: '2026-12-31', dateBasis: 'entry' })
    expect(JSON.parse(files['trades.json'] as string)).toHaveLength(0)
    expect(JSON.parse(files['attachments.json'] as string)).toHaveLength(1)
    input.screenshots = []
    await expect(assembleCompleteExport(input, period)).rejects.toThrow('MISSING_TRADE_SCREENSHOTS')
  })
})
