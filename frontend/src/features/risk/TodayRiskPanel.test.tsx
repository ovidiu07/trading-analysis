import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { TodayRiskPanel } from './TodayRiskPanel'

const liveWorkspaceMock = vi.hoisted(() => ({
  getSessionWorkspace: vi.fn(),
  createSetupCandidate: vi.fn()
}))

vi.mock('../../api/liveWorkspace', () => liveWorkspaceMock)
vi.mock('../../api/fx', () => ({ fetchFxRate: vi.fn() }))

const baseProps = {
  userId: 'user-1',
  accountId: 'account-1',
  accountLabel: 'Primary futures',
  accountCurrency: 'USD',
  date: '2026-09-13',
  isCurrentDate: true,
  session: 'EUROPE',
  symbol: 'ESZ6',
  market: 'FUTURES' as const,
  direction: 'LONG' as const,
  thesis: 'Wait for the reclaim.',
  defaultInvalidation: 'Acceptance below the stop.',
  maximumPermittedRisk: 500,
  maximumPermittedRiskPct: 0.5,
  remainingTrades: 2
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

function renderPanel(overrides: Partial<typeof baseProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <QueryClientProvider client={client}>
        <I18nProvider>
          <Routes>
            <Route path="*" element={<><TodayRiskPanel {...baseProps} {...overrides} /><LocationProbe /></>} />
          </Routes>
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

const fillValidLong = () => {
  fireEvent.change(screen.getByLabelText('Intended risk'), { target: { value: '500' } })
  fireEvent.change(screen.getByLabelText('Entry price'), { target: { value: '6000,5' } })
  fireEvent.change(screen.getByLabelText('Stop loss'), { target: { value: '5995,5' } })
  fireEvent.change(screen.getByLabelText('Take profit'), { target: { value: '6010,5' } })
}

describe('TodayRiskPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    liveWorkspaceMock.getSessionWorkspace.mockReset()
    liveWorkspaceMock.createSetupCandidate.mockReset()
  })

  it('renders an honest incomplete state and never enables handoff with blank values', () => {
    renderPanel()

    expect(screen.getByText('Enter entry, stop and target')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to execution' })).toBeDisabled()
    expect(screen.getByText(/does not create a Trade or transmit a broker order/i)).toBeInTheDocument()
  })

  it('accepts localized decimals and reports a directionally invalid stop', () => {
    renderPanel()
    fillValidLong()
    fireEvent.change(screen.getByLabelText('Stop loss'), { target: { value: '6001,5' } })

    expect(screen.getAllByText('For Long, stop loss must be below entry').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Continue to execution' })).toBeDisabled()
  })

  it('blocks a risk amount above the currently permitted cap', () => {
    renderPanel({ maximumPermittedRisk: 499 })
    fillValidLong()

    expect(screen.getByText('Intended risk exceeds the current permitted-risk cap.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to execution' })).toBeDisabled()
  })

  it('allows an unsupported market only through explicit manual quantity', () => {
    renderPanel({ market: 'CFD', symbol: 'GER40' })
    fireEvent.change(screen.getByLabelText('Intended risk'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Entry price'), { target: { value: '24000' } })
    fireEvent.change(screen.getByLabelText('Stop loss'), { target: { value: '23990' } })
    fireEvent.change(screen.getByLabelText('Take profit'), { target: { value: '24020' } })

    expect(screen.getAllByText(/Automatic sizing is unavailable: no verified unit model exists/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Continue to execution' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } })
    expect(screen.getByRole('button', { name: 'Continue to execution' })).toBeEnabled()
  })

  it('creates one canonical setup draft with transferred values and then navigates to its review', async () => {
    liveWorkspaceMock.getSessionWorkspace.mockResolvedValue({ session: { id: 'session-1' } })
    liveWorkspaceMock.createSetupCandidate.mockImplementation(async (_sessionId: string, payload: { sourceDraftId: string }) => ({
      session: { id: 'session-1' },
      setups: [{ id: 'setup-1', sourceDraftId: payload.sourceDraftId }]
    }))
    renderPanel()
    fillValidLong()

    fireEvent.click(screen.getByRole('button', { name: 'Use calculated quantity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue to execution' }))

    await waitFor(() => expect(liveWorkspaceMock.createSetupCandidate).toHaveBeenCalledTimes(1))
    const [sessionId, payload] = liveWorkspaceMock.createSetupCandidate.mock.calls[0]
    expect(sessionId).toBe('session-1')
    expect(payload).toMatchObject({
      accountRefId: 'account-1',
      symbol: 'ESZ6',
      market: 'FUTURES',
      direction: 'LONG',
      execution: {
        entryPrice: 6000.5,
        stopLossPrice: 5995.5,
        takeProfitPrice: 6010.5,
        riskAmount: 500,
        quantity: 2,
        tickets: [{ contractMultiplier: 50, plannedRr: 2, costsIncluded: false }]
      }
    })
    expect(payload.sourceDraftId).toBeTruthy()
    expect(await screen.findByTestId('location')).toHaveTextContent('/today/session?accountIds=account-1&source=today-risk&setupId=setup-1')
  })
})
