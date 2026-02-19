import '@testing-library/jest-dom/vitest'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, type AppLanguage, useI18n } from '../i18n'
import SessionPage from './SessionPage'

const sessionApiMock = vi.hoisted(() => ({
  getTodaySession: vi.fn(),
  saveTodaySessionConfig: vi.fn(),
  updateTodaySessionPlannedTickers: vi.fn(),
  updateTodaySessionChecklist: vi.fn(),
  listChecklistTemplates: vi.fn(),
  createChecklistTemplate: vi.fn(),
  updateChecklistTemplate: vi.fn(),
  startTradeFromSession: vi.fn(),
  closeTradeFromSession: vi.fn()
}))

const plansApiMock = vi.hoisted(() => ({
  listDailyPlans: vi.fn()
}))

const checklistApiMock = vi.hoisted(() => ({
  fetchChecklistTemplate: vi.fn()
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
vi.mock('../api/checklist', () => checklistApiMock)
vi.mock('../api/strategies', () => strategiesApiMock)

const LanguageInitializer = ({ language }: { language: AppLanguage }) => {
  const { setLanguage } = useI18n()

  useEffect(() => {
    setLanguage(language)
  }, [language, setLanguage])

  return null
}

const renderSessionPage = (language: AppLanguage = 'en') => {
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
          <LanguageInitializer language={language} />
          <SessionPage />
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('SessionPage', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    localStorage.removeItem('today.session.selectedPlanId')
    sessionApiMock.listChecklistTemplates.mockResolvedValue([])
    plansApiMock.listDailyPlans.mockResolvedValue([])
    checklistApiMock.fetchChecklistTemplate.mockResolvedValue([])
    strategiesApiMock.listStrategies.mockResolvedValue({ myStrategies: [], mentorStrategies: [] })
    sessionApiMock.updateTodaySessionPlannedTickers.mockResolvedValue({})
    sessionApiMock.updateTodaySessionChecklist.mockResolvedValue({})
    sessionApiMock.createChecklistTemplate.mockResolvedValue({})
    sessionApiMock.updateChecklistTemplate.mockResolvedValue({})
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

    expect(await screen.findByText('Session checklist')).toBeInTheDocument()
    expect(screen.getByText('Mentor Plan')).toBeInTheDocument()
    expect(screen.getByText('Trade Planner + Execution')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Schedule trade' }))
    await user.type(screen.getByLabelText('Ticker to schedule'), 'eurusd')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(sessionApiMock.updateTodaySessionPlannedTickers).toHaveBeenCalled()
  })

  it('renders translated labels in Romanian', async () => {
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
        { id: '1', text: 'Revizuiește planul', completed: false }
      ],
      activeTrade: null
    })
    plansApiMock.listDailyPlans.mockResolvedValue([{ id: 'plan-1', title: 'Plan A', summary: 'Summary' }])

    renderSessionPage('ro')

    expect(await screen.findByText('Checklist sesiune')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Programează tranzacție' })).toBeInTheDocument()
  })

  it('supports checklist template save and import flow', async () => {
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
    sessionApiMock.listChecklistTemplates.mockResolvedValue([
      { id: 'tpl-1', name: 'Morning template', items: ['Review plan'] }
    ])

    const user = userEvent.setup()
    renderSessionPage()

    expect(await screen.findByText('Session checklist')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save template' }))
    const saveDialog = await screen.findByRole('dialog', { name: 'Save template' })
    await user.type(within(saveDialog).getByRole('textbox', { name: /template name/i }), 'London Open')
    await user.click(within(saveDialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(sessionApiMock.createChecklistTemplate).toHaveBeenCalledWith({
        name: 'London Open',
        items: ['Review plan']
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Save template' })).not.toBeInTheDocument()
    })

    await user.click(screen.getByLabelText(/import template/i))
    await user.click(await screen.findByRole('option', { name: 'Morning template' }))
    await user.click(await screen.findByRole('button', { name: /^Import$/ }))

    const importDialog = await screen.findByRole('dialog', { name: 'Import template' })
    await user.click(within(importDialog).getByRole('button', { name: 'Import' }))

    await waitFor(() => {
      expect(sessionApiMock.updateTodaySessionChecklist).toHaveBeenCalledWith({ templateId: 'tpl-1' })
    })
  })

  it('auto-switches mentor plan when persisted selection is no longer eligible', async () => {
    localStorage.setItem('today.session.selectedPlanId', 'expired-plan')

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

    const now = Date.now()
    plansApiMock.listDailyPlans.mockResolvedValue([
      {
        id: 'expired-plan',
        title: 'Expired plan',
        summary: 'old',
        visibleFrom: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        visibleUntil: new Date(now - 60 * 60 * 1000).toISOString()
      },
      {
        id: 'active-plan',
        title: 'Active plan',
        summary: 'new',
        visibleFrom: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        visibleUntil: null
      }
    ])

    renderSessionPage()

    expect(await screen.findByText('Mentor plan updated (previous plan no longer active)')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Active plan' })).toBeInTheDocument()
    expect(localStorage.getItem('today.session.selectedPlanId')).toBe('active-plan')
  })

  it('shows full strategy detail panel content after selection', async () => {
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
    plansApiMock.listDailyPlans.mockResolvedValue([{ id: 'plan-1', title: 'Plan A', summary: 'Summary', visibleUntil: null }])
    strategiesApiMock.listStrategies.mockResolvedValue({
      myStrategies: [
        {
          id: 'strat-1',
          source: 'MY',
          name: 'London Sweep',
          model: 'Sweep + MSS + displacement',
          entryConditions: ['Sweep previous high', 'Break BOS on 5m'],
          invalidationLogic: '- Close below sweep origin\n- No displacement candle',
          tpFramework: '- Partial at 1R\n- Runner to session low',
          noTradeRules: '- Skip during high-impact news',
          sessionSuitability: ['LONDON', 'NY_AM'],
          tags: [],
          archived: false
        }
      ],
      mentorStrategies: []
    })

    const user = userEvent.setup()
    renderSessionPage()

    expect(await screen.findByText('Trade Planner + Execution')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Strategy'))
    await user.click(await screen.findByRole('option', { name: 'London Sweep' }))

    expect(await screen.findByText('Strategy details')).toBeInTheDocument()
    expect(await screen.findByText(/Break BOS on 5m/i)).toBeInTheDocument()
    expect(await screen.findByText(/Partial at 1R/i)).toBeInTheDocument()
    expect(await screen.findByText(/Skip during high-impact news/i)).toBeInTheDocument()
  })

  it('sends planner notes as initialNotes when starting a trade', async () => {
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
      plannedTickers: ['eurusd'],
      checklistItems: [
        { id: '1', text: 'Review plan', completed: false }
      ],
      activeTrade: null
    })
    plansApiMock.listDailyPlans.mockResolvedValue([])

    const user = userEvent.setup()
    renderSessionPage()

    expect(await screen.findByText('Trade Planner + Execution')).toBeInTheDocument()

    await user.type(screen.getByRole('spinbutton', { name: /entry price/i }), '1.25')
    await user.type(screen.getByRole('textbox', { name: /^Notes$/i }), 'Opening notes from start phase')
    await user.click(screen.getByRole('button', { name: 'Start trade' }))

    await waitFor(() => {
      expect(sessionApiMock.startTradeFromSession).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'EURUSD',
        entryPrice: 1.25,
        initialNotes: 'Opening notes from start phase'
      }))
    })
  })
})
