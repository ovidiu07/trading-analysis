import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InsightDetailPage from './InsightDetailPage'
import { I18nProvider } from '../i18n'

const contentApiMock = vi.hoisted(() => ({
  getContent: vi.fn()
}))

const assetsApiMock = vi.hoisted(() => ({
  fetchAssetBlob: vi.fn(),
  resolveAssetUrl: vi.fn((value?: string | null) => value || ''),
  isProtectedApiUrl: vi.fn((value?: string | null) => (value || '').startsWith('/api/'))
}))

vi.mock('../api/content', () => ({
  getContent: contentApiMock.getContent
}))

vi.mock('../api/assets', () => assetsApiMock)

vi.mock('../components/charts/TradingViewWidget', () => ({
  default: ({ symbol }: { symbol?: string | null }) => <div data-testid="tradingview-widget">{symbol || 'none'}</div>
}))

const renderInsightDetail = () => {
  return render(
    <MemoryRouter initialEntries={['/insights/dax-morning-plan']}>
      <I18nProvider>
        <Routes>
          <Route path="/insights/:idOrSlug" element={<InsightDetailPage />} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>
  )
}

describe('InsightDetailPage daily plan rendering', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('(max-width:900px)') ? false : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    })

    assetsApiMock.fetchAssetBlob.mockReset()
    assetsApiMock.fetchAssetBlob.mockResolvedValue(new Blob(['img'], { type: 'image/png' }))
    assetsApiMock.resolveAssetUrl.mockImplementation((value?: string | null) => value || '')

    contentApiMock.getContent.mockResolvedValue({
      id: 'plan-1',
      contentTypeId: 'type-daily',
      contentTypeKey: 'DAILY_PLAN',
      contentTypeDisplayName: 'Daily plan',
      title: 'DAX Morning Plan',
      slug: 'dax-morning-plan',
      summary: 'Execution-focused opening plan.',
      body: '![Body chart](/api/assets/body-asset/view)\n\nBody markdown details.',
      locale: 'en',
      resolvedLocale: 'en',
      status: 'PUBLISHED',
      tags: ['DAX', 'INDEX'],
      symbols: ['GER40'],
      templateFields: {
        biasSummary: 'Long bias while opening range low holds.',
        keyLevels: '20500\n20420',
        executionRules: 'Wait for pullback\nEnter on reclaim',
        riskNote: 'No trade during macro release window.',
        primaryModel: 'Open drive continuation',
        liquidityNarrative: 'Sweep Asia high then hold above VWAP',
        alternativeScenario: 'Fade at 20550 if rejection confirms',
        context: 'US CPI later in session'
      },
      tradingViewSymbol: 'TVC:DAX',
      tradingViewInterval: '15',
      tradingViewTheme: 'SYSTEM',
      tradingViewHideControls: true,
      tradingViewAllowSymbolChange: false,
      snapshotAssetId: 'snapshot-1',
      snapshotCaption: 'Annotated pre-open snapshot.',
      updatedAt: '2026-02-19T08:00:00Z',
      publishedAt: '2026-02-19T08:00:00Z',
      assets: [
        {
          id: 'snapshot-1',
          scope: 'CONTENT',
          originalFileName: 'snapshot.png',
          contentType: 'image/png',
          url: '/api/assets/snapshot-1/view',
          viewUrl: '/api/assets/snapshot-1/view',
          downloadUrl: '/api/assets/snapshot-1/download',
          thumbnailUrl: '/api/assets/snapshot-1/view',
          image: true
        }
      ],
      translations: null,
      missingLocales: []
    })
  })

  it('shows snapshot, essentials, live chart, and advanced markdown for daily plans', async () => {
    const user = userEvent.setup()

    renderInsightDetail()

    expect(await screen.findByRole('heading', { name: 'DAX Morning Plan' })).toBeInTheDocument()
    expect(screen.getByText('Essentials')).toBeInTheDocument()
    expect(screen.getByText('Long bias while opening range low holds.')).toBeInTheDocument()
    expect(screen.getByText('Live chart')).toBeInTheDocument()
    expect(screen.getByTestId('tradingview-widget')).toHaveTextContent('TVC:DAX')

    await user.click(screen.getByRole('button', { name: 'Advanced details' }))
    expect(await screen.findByText('Open drive continuation')).toBeInTheDocument()
    expect(screen.getByText('Body markdown details.')).toBeInTheDocument()

    await waitFor(() => {
      expect(assetsApiMock.fetchAssetBlob).toHaveBeenCalledWith('/api/assets/body-asset/view')
    })
  })
})
