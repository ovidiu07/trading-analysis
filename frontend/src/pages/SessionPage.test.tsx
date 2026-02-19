import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import SessionPage from './SessionPage'

const sessionApiMock = vi.hoisted(() => ({
  getTodaySession: vi.fn(),
  saveTodaySessionConfig: vi.fn(),
  updateTodaySessionPlannedTickers: vi.fn(),
  updateTodaySessionChecklist: vi.fn(),
  listChecklistTemplates: vi.fn(),
  createChecklistTemplate: vi.fn(),
  startTradeFromSession: vi.fn(),
  closeTradeFromSession: vi.fn()
}))

const plansApiMock = vi.hoisted(() => ({
  listDailyPlans: vi.fn()
}))

const strategiesApiMock = vi.hoisted(() => ({
  listStrategies: vi.fn()
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'trader@example.com',
      timezone: 'Europe/Bucharest',
      baseCurrency: 'USD'
    }
  })
}))

vi.mock('../api/session', () => sessionApiMock)
vi.mock('../api/plans', () => plansApiMock)
vi.mock('../api/strategies', () => strategiesApiMock)

const renderSessionPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <MemoryRouter initialEntries={['/today/session']}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <SessionPage />
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('SessionPage', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    sessionApiMock.listChecklistTemplates.mockResolvedValue([])
    plansApiMock.listDailyPlans.mockResolvedValue([])
    strategiesApiMock.listStrategies.mockResolvedValue({ myStrategies: [], mentorStrategies: [] })
    sessionApiMock.updateTodaySessionPlannedTickers.mockResolvedValue({})
    sessionApiMock.updateTodaySessionChecklist.mockResolvedValue({})
    sessionApiMock.createChecklistTemplate.mockResolvedValue({})
    sessionApiMock.startTradeFromSession.mockResolvedValue({})
    sessionApiMock.closeTradeFromSession.mockResolvedValue({})
  })

  it('shows configuration form when no session exists', async () => {
    sessionApiMock.getTodaySession.mockResolvedValueOnce(null)
    sessionApiMock.saveTodaySessionConfig.mockResolvedValueOnce({
      id: 'session-1'
    })

    renderSessionPage()

    expect(await screen.findByText('Session configuration')).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /Profit for today/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /Loss for today/i })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /Max number of trades/i })).toBeInTheDocument()
  })

  it('renders workspace when session exists and allows scheduling a ticker', async () => {
    sessionApiMock.getTodaySession.mockResolvedValue({
      id: 'session-1',
      sessionDate: '2026-02-19',
      profitTarget: 200,
      lossLimit: 100,
      maxTrades: 3,
      status: 'ACTIVE',
      realizedPnl: 0,
      closedTradesCount: 0,
      remainingTrades: 3,
      plannedTickers: [],
      checklistItems: [
        { id: '1', text: 'Review plan', completed: false }
      ],
      activeTrade: null
    })
    plansApiMock.listDailyPlans.mockResolvedValue([{ id: 'plan-1', title: 'Plan A', summary: 'Summary' }])
    strategiesApiMock.listStrategies.mockResolvedValue({ myStrategies: [], mentorStrategies: [] })

    const user = userEvent.setup()
    renderSessionPage()

    expect(await screen.findByText('Session Checklist')).toBeInTheDocument()
    expect(screen.getByText('Mentor Plan')).toBeInTheDocument()
    expect(screen.getByText('Trade Planner + Execution')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ Schedule trade' }))
    await user.type(screen.getByLabelText('Enter the ticker you want to trade'), 'eurusd')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(sessionApiMock.updateTodaySessionPlannedTickers).toHaveBeenCalled()
  })
})
