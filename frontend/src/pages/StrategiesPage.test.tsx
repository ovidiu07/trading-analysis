import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import StrategiesPage from './StrategiesPage'

const strategiesApiMock = vi.hoisted(() => ({
  listStrategies: vi.fn(),
  createStrategy: vi.fn(),
  updateStrategy: vi.fn(),
  archiveStrategy: vi.fn(),
  removeStrategyAsset: vi.fn(),
  setStrategySnapshot: vi.fn()
}))

vi.mock('../api/strategies', () => strategiesApiMock)

const renderStrategiesPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <MemoryRouter initialEntries={['/strategies']}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <StrategiesPage />
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const min = query.match(/min-width:\s*(\d+(?:\.\d+)?)px/)
    const max = query.match(/max-width:\s*(\d+(?:\.\d+)?)px/)
    const matches = (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]))
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }
  }) as unknown as typeof window.matchMedia
}

const strategyFixture = {
  id: 'strat-1',
  source: 'MY',
  name: 'London Sweep Responsive Audit Strategy',
  model: 'Sweep + market structure shift',
  entryConditionsRich: '<ul><li>Wait for liquidity sweep</li><li>Confirm structure shift</li></ul>',
  entryConditions: ['Wait for liquidity sweep', 'Confirm structure shift'],
  invalidationLogic: 'Close below sweep origin',
  tpFramework: 'Partial at 1R',
  noTradeRules: 'Skip high-impact news',
  sessionSuitability: ['LONDON'],
  tags: ['BOS'],
  assets: [],
  archived: false
}

describe('StrategiesPage', () => {
  beforeEach(() => {
    strategiesApiMock.createStrategy.mockResolvedValue({})
    strategiesApiMock.updateStrategy.mockResolvedValue({})
    strategiesApiMock.archiveStrategy.mockResolvedValue({})
    strategiesApiMock.removeStrategyAsset.mockResolvedValue({})
    strategiesApiMock.setStrategySnapshot.mockResolvedValue({})
  })

  it('renders rich entry conditions in preview from stored strategy content', async () => {
    strategiesApiMock.listStrategies.mockResolvedValue({
      myStrategies: [
        {
          id: 'strat-1',
          source: 'MY',
          name: 'London Sweep',
          model: 'Sweep + MSS',
          entryConditionsRich: '<h3>Entry checklist</h3><ul><li>Break BOS on 5m</li><li><strong>Wait</strong> for retest candle</li></ul>',
          entryConditions: ['Break BOS on 5m', 'Wait for retest candle'],
          invalidationLogic: 'Close below sweep origin',
          tpFramework: 'Partial at 1R',
          noTradeRules: 'Skip high-impact news',
          sessionSuitability: ['LONDON'],
          tags: ['BOS'],
          assets: [],
          archived: false
        }
      ],
      mentorStrategies: []
    })

    renderStrategiesPage()

    expect(await screen.findByText('Preview')).toBeInTheDocument()
    expect((await screen.findAllByText('London Sweep')).length).toBeGreaterThan(0)
    expect(await screen.findByText(/Entry checklist/i)).toBeInTheDocument()
    expect(await screen.findByText(/Break BOS on 5m/i)).toBeInTheDocument()
    expect((await screen.findAllByText((_, node) => node?.textContent?.includes('Wait for retest candle') ?? false)).length).toBeGreaterThan(0)
  })

  it.each([
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ])('keeps the strategy editor centered and single-column at $width x $height', async ({ width, height }) => {
    setViewport(width, height)
    strategiesApiMock.listStrategies.mockResolvedValue({
      myStrategies: [strategyFixture],
      mentorStrategies: []
    })

    renderStrategiesPage()

    expect((await screen.findAllByText('London Sweep Responsive Audit Strategy')).length).toBeGreaterThan(0)
    const page = screen.getByTestId('strategies-page')
    const grid = screen.getByTestId('strategies-grid')
    const strategyRow = screen.getByTestId('strategy-list-row')
    expect(screen.queryByTestId('rich-text-toolbar')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create strategy', exact: true }))
    const toolbar = screen.getByTestId('rich-text-toolbar')

    expect(page).toHaveStyle({ width: '100%', maxWidth: '100%' })
    expect(Number.parseFloat(window.getComputedStyle(grid).marginLeft) || 0).toBe(0)
    expect(grid).toHaveAttribute('data-mobile-column-spacing', '0')
    expect(strategyRow).toHaveAttribute('data-mobile-layout', 'single-column')
    expect(toolbar).toHaveAttribute('data-mobile-wrap', 'true')
    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Create strategy' })).toBeVisible()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })
})
