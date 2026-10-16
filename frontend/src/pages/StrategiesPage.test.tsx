import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import StrategiesPage from './StrategiesPage'
import * as api from '../api/strategyStudio'
import { listStrategies } from '../api/strategies'
import { uploadAsset } from '../api/assets'
import { template, type Studio } from '../features/strategyStudio/model'
vi.mock('../api/assets', async () => ({ ...(await vi.importActual('../api/assets')), uploadAsset: vi.fn() }))
vi.mock('../api/strategies', () => ({ listStrategies: vi.fn() }))
vi.mock('../api/strategyStudio', () => ({
  getStudio: vi.fn(),
  saveStudio: vi.fn(),
  createStudio: vi.fn(),
  duplicateStudio: vi.fn(),
  exportStudio: vi.fn(),
  importStudio: vi.fn(),
  getStrategyEvidence: vi.fn(),
  listVersions: vi.fn(),
  listExecutions: vi.fn(),
  saveExecution: vi.fn(),
  getVersion: vi.fn(),
  createCheckpoint: vi.fn(),
  restoreVersion: vi.fn()
}))
vi.mock('../api/session', () => ({ listChecklistTemplates: vi.fn().mockResolvedValue([]) }))
vi.mock('../api/backtesting', () => ({
  listBacktestingWorkspaces: vi.fn().mockResolvedValue({ workspaces: [] }),
  listBacktestingTrades: vi.fn().mockResolvedValue([])
}))
const user = {
  click: (...args: Parameters<typeof userEvent.click>) =>
    act(async () => {
      await userEvent.click(...args)
    }),
  clear: (...args: Parameters<typeof userEvent.clear>) =>
    act(async () => {
      await userEvent.clear(...args)
    }),
  type: (...args: Parameters<typeof userEvent.type>) =>
    act(async () => {
      await userEvent.type(...args)
    })
}
const fixture = (): Studio => {
  const data = template(true)
  return {
    revision: 2,
    definition: data.definition,
    strategy: {
      ...data.strategy,
      id: 'strategy-1',
      source: 'MY',
      archived: false,
      entryConditions: ['Confirm structure shift'],
      entryConditionsRich: '<h3>Entry checklist</h3><ul><li>Confirm structure shift</li></ul>',
      assets: []
    }
  }
}
let stored: Studio
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/strategies', element: <StrategiesPage /> },
      { path: '/elsewhere', element: <div>Other page</div> }
    ],
    { initialEntries: ['/strategies?strategy=strategy-1'] }
  )
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>
  )
  return router
}
beforeEach(() => {
  stored = fixture()
  sessionStorage.clear()
  localStorage.setItem('app.language', 'en')
  vi.mocked(listStrategies).mockResolvedValue({ myStrategies: [stored.strategy], mentorStrategies: [] })
  vi.mocked(api.getStudio).mockImplementation(async () => structuredClone(stored))
  vi.mocked(api.saveStudio).mockImplementation(async (_id, body) => {
    stored = {
      ...stored,
      revision: stored.revision + 1,
      strategy: { ...stored.strategy, ...body.strategy },
      definition: body.definition
    }
    return structuredClone(stored)
  })
  vi.mocked(api.getStrategyEvidence).mockResolvedValue({ trades: [], workspaces: [] })
  vi.mocked(api.listVersions).mockResolvedValue([])
  vi.mocked(api.listExecutions).mockResolvedValue([])
  vi.mocked(api.createStudio).mockImplementation(async (body) => ({
    ...stored,
    definition: body.definition,
    strategy: { ...stored.strategy, ...body.strategy, id: 'strategy-2' }
  }))
  vi.mocked(api.saveExecution).mockResolvedValue({
    id: 'execution',
    template: stored.definition.checklists[0],
    answers: {},
    createdAt: '2026-10-16T10:00:00Z'
  })
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
describe('native Strategy Studio route', () => {
  it('opens the stored strategy with all seven sections and actual empty research state', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Five Sessions Model' })).toBeInTheDocument()
    for (const label of [
      'Overview',
      'Notebook',
      'Parameters',
      'Setup & Rules',
      'Checklists',
      'Backtesting & Evidence',
      'Version History'
    ])
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    expect(await screen.findByText('No research trades yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Entry philosophy' }))
    expect(screen.getByRole('textbox', { name: 'Entry philosophy' })).toHaveTextContent('Entry checklist')
    expect(screen.getByText('Confirm structure shift', { selector: 'li' })).toBeInTheDocument()
  })
  it('autosaves metadata edits and saves before route navigation', async () => {
    const router = renderPage()
    const name = await screen.findByLabelText('Strategy name')
    await user.clear(name)
    await user.type(name, 'Updated research')
    await act(async () => {
      await router.navigate('/elsewhere')
    })
    await waitFor(() => expect(screen.getByText('Other page')).toBeInTheDocument())
    expect(stored.strategy.name).toBe('Updated research')
    expect(api.saveStudio).toHaveBeenCalled()
  })
  it('inserts a persistent notebook table and preserves work across tabs', async () => {
    renderPage()
    await screen.findByLabelText('Strategy name')
    await user.click(screen.getByRole('tab', { name: 'Notebook' }))
    await user.click(screen.getAllByRole('button', { name: 'Add block' })[0])
    await user.click(screen.getByRole('menuitem', { name: 'Table', exact: true }))
    expect(screen.getByLabelText('Table 1, 1')).toHaveValue('Column 1')
    await user.clear(screen.getByLabelText('Table 1, 1'))
    await user.type(screen.getByLabelText('Table 1, 1'), 'FVG sample')
    await user.click(screen.getByRole('tab', { name: 'Parameters' }))
    await user.click(screen.getByRole('tab', { name: 'Notebook' }))
    expect(screen.getByLabelText('Table 1, 1')).toHaveValue('FVG sample')
    await waitFor(
      () =>
        expect(stored.definition.notebook.some((b) => b.type === 'TABLE' && b.rows?.[0][0] === 'FVG sample')).toBe(
          true
        ),
      { timeout: 2500 }
    )
  })
  it('creates named parameter presets with real values', async () => {
    renderPage()
    await screen.findByLabelText('Strategy name')
    await user.click(screen.getByRole('tab', { name: 'Parameters' }))
    await user.type(screen.getByLabelText('Preset name'), 'Conservative')
    await user.click(screen.getByRole('button', { name: 'Save preset' }))
    expect(screen.getByDisplayValue('Conservative')).toBeInTheDocument()
    await waitFor(() => expect(stored.definition.presets[0]?.name).toBe('Conservative'), { timeout: 2500 })
    expect(Object.keys(stored.definition.presets[0].values)).toHaveLength(stored.definition.parameters.length)
  }, 15000)
  it('exposes nested rules as documentation without claiming engine execution', async () => {
    renderPage()
    await screen.findByLabelText('Strategy name')
    await user.click(screen.getByRole('tab', { name: 'Setup & Rules' }))
    expect(screen.getByText(/existing backtest engine does not execute/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add rule' }))
    expect(screen.getAllByDisplayValue('New rule')).toHaveLength(1)
    await waitFor(() => expect(stored.definition.rules).toHaveLength(4), { timeout: 2500 })
  })
  it('runs checklist templates and requires mandatory items', async () => {
    renderPage()
    await screen.findByLabelText('Strategy name')
    await user.click(screen.getByRole('tab', { name: 'Checklists' }))
    await user.click(screen.getByRole('button', { name: 'Run checklist' }))
    expect(await screen.findByRole('button', { name: 'Save execution' })).toBeDisabled()
    for (const checkbox of screen.getAllByRole('checkbox')) await user.click(checkbox)
    expect(screen.getByRole('button', { name: 'Save execution' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save execution' }))
    await waitFor(() => expect(api.saveExecution).toHaveBeenCalled())
    expect(vi.mocked(api.saveExecution).mock.calls[0][1].answers).toHaveProperty(
      stored.definition.checklists[0].items[0].id,
      true
    )
  })
  it('creates a configured native Five Sessions strategy', async () => {
    renderPage()
    await screen.findByLabelText('Strategy name')
    const buttons = screen.getAllByRole('button', { name: 'Five Sessions Model', exact: true })
    await user.click(buttons[0])
    await waitFor(() => expect(api.createStudio).toHaveBeenCalled())
    const data = vi.mocked(api.createStudio).mock.calls[0][0]
    expect(data.definition.metadata.timezone).toBe('Europe/Bucharest')
    expect(data.definition.parameters.find((p) => p.name === 'Minimum FVG size')?.value).toBe(0.05)
  })
  it('waits for a pending image upload before saving and navigating away', async () => {
    const router = renderPage()
    await screen.findByLabelText('Strategy name')
    await user.click(screen.getByRole('tab', { name: 'Notebook' }))
    let finish: (value: Awaited<ReturnType<typeof uploadAsset>>) => void
    vi.mocked(uploadAsset).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const file = new File(['local fixture'], 'chart.png', { type: 'image/png' })
    const input = screen.getByRole('button', { name: 'Upload image' }).querySelector('input')!
    await act(async () => {
      await userEvent.upload(input, file)
    })
    await act(async () => {
      void router.navigate('/elsewhere')
    })
    expect(screen.queryByText('Other page')).not.toBeInTheDocument()
    await act(async () => {
      finish!({
        id: 'image-1',
        scope: 'STRATEGY',
        image: true,
        originalFileName: 'chart.png',
        viewUrl: '/api/assets/image-1/view'
      })
    })
    await waitFor(() => expect(screen.getByText('Other page')).toBeInTheDocument())
    expect(stored.definition.notebook.some((block) => block.type === 'IMAGE' && block.assetId === 'image-1')).toBe(true)
  })
  it('keeps category editing focused and saves it before blur or navigation', async () => {
    const router = renderPage()
    await screen.findByLabelText('Strategy name')
    await user.click(screen.getByRole('tab', { name: 'Parameters' }))
    await user.click(screen.getAllByRole('button', { name: 'Advanced details' })[0])
    const category = await screen.findByLabelText('Category', { exact: true })
    await user.clear(category)
    await user.type(category, 'ICT')
    expect(category).toHaveValue('ICT')
    expect(category).toHaveFocus()
    await act(async () => {
      await router.navigate('/elsewhere')
    })
    await waitFor(() => expect(screen.getByText('Other page')).toBeInTheDocument())
    expect(stored.definition.parameters[0].category).toBe('ICT')
  }, 15000)
})
