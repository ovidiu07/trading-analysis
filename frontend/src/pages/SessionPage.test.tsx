import '@testing-library/jest-dom/vitest'
import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, type AppLanguage, useI18n } from '../i18n'
import SessionPage from './SessionPage'

const sessionApiMock = vi.hoisted(() => ({
  getTodaySession: vi.fn(),
  saveTodaySessionConfig: vi.fn(),
  updateTodaySessionPlannedTickers: vi.fn(),
  startTradeFromSession: vi.fn(),
  closeTradeFromSession: vi.fn(),
  saveTradeEntryJournal: vi.fn()
}))

const plansApiMock = vi.hoisted(() => ({
  listDailyPlans: vi.fn()
}))

const strategiesApiMock = vi.hoisted(() => ({
  listStrategies: vi.fn()
}))

const fxApiMock = vi.hoisted(() => ({
  fetchFxRate: vi.fn()
}))

const assetsApiMock = vi.hoisted(() => ({
  uploadAsset: vi.fn()
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
vi.mock('../api/fx', () => fxApiMock)
vi.mock('../api/assets', async () => {
  const actual = await vi.importActual('../api/assets')
  return {
    ...actual,
    uploadAsset: assetsApiMock.uploadAsset
  }
})

vi.mock('../components/charts/TradingViewWidget', () => ({
  default: () => <div data-testid="mock-chart">chart</div>
}))

const LanguageInitializer = ({ language }: { language: AppLanguage }) => {
  const { setLanguage } = useI18n()

  useEffect(() => {
    setLanguage(language)
  }, [language, setLanguage])

  return null
}

const baseSession = {
  id: 'session-1',
  sessionDate: '2026-02-21',
  profitTarget: 200,
  lossLimit: 100,
  maxTrades: 3,
  status: 'ACTIVE',
  realizedPnl: 0,
  closedTradesCount: 0,
  remainingTrades: 3,
  plannedTickers: ['eurusd'],
  checklistItems: [],
  activeTrade: null
}

const basePlan = {
  id: 'plan-1',
  title: 'Plan A',
  summary: 'Summary',
  biasSummary: 'Bullish above PDL',
  keyLevels: ['PDH', 'PDL'],
  executionRules: 'Wait for sweep\nMSS then entry',
  riskNote: "I'm wrong if M5 closes below sweep low.",
  context: 'Macro calm'
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

const getPlannerPanel = () => {
  const plannerTitle = screen.getByText('Trade Planner + Execution')
  const panel = plannerTitle.closest('.MuiCard-root') as HTMLElement | null
  if (!panel) {
    throw new Error('Trade planner panel not found')
  }
  return panel
}

const completeLockIn = async (user: ReturnType<typeof userEvent.setup>) => {
  const lockInCard = screen.getByText('Session Lock-In').closest('.MuiBox-root') as HTMLElement
  const lockInSelects = within(lockInCard).getAllByRole('combobox')

  await user.click(lockInSelects[0])
  await user.click(await screen.findByRole('option', { name: 'London' }))

  await user.clear(within(lockInCard).getByLabelText('Daily max loss'))
  await user.type(within(lockInCard).getByLabelText('Daily max loss'), '100')

  await user.clear(within(lockInCard).getByLabelText('Max trades'))
  await user.type(within(lockInCard).getByLabelText('Max trades'), '2')

  await user.click(lockInSelects[1])
  await user.click(await screen.findByRole('option', { name: 'Long' }))

  await user.type(within(lockInCard).getByLabelText('Bias reason'), 'Trend continuation in London')
}

const completeChecklistAndTicket = async (user: ReturnType<typeof userEvent.setup>, highRr = true) => {
  const plannerPanel = getPlannerPanel()

  await user.click(screen.getByLabelText('News check done'))
  await user.click(screen.getByLabelText('Key levels marked (PDH/PDL, Asia H/L, Session H/L, EQH/EQL)'))

  await user.click(screen.getByLabelText('Liquidity sweep level'))
  await user.click(await screen.findByRole('option', { name: 'PDH' }))
  await user.click(screen.getByLabelText('Liquidity sweep confirmed'))
  await user.click(screen.getByLabelText('Displacement close (M5) away from sweep'))
  await user.click(screen.getByLabelText('MSS confirmed on close'))
  await user.click(screen.getByLabelText('Entry zone identified (FVG 50%)'))

  await user.clear(within(plannerPanel).getByLabelText(/entry price/i))
  await user.type(within(plannerPanel).getByLabelText(/entry price/i), '10')

  await user.clear(within(plannerPanel).getByLabelText(/stop[-\s]?loss/i))
  await user.type(within(plannerPanel).getByLabelText(/stop[-\s]?loss/i), '9')

  await user.clear(within(plannerPanel).getByLabelText(/take[-\s]?profit/i))
  await user.type(within(plannerPanel).getByLabelText(/take[-\s]?profit/i), highRr ? '12' : '10.4')

  await user.type(within(plannerPanel).getByLabelText(/i.?m wrong if/i), 'M5 closes below the sweep low')
}

describe('SessionPage execution funnel', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    localStorage.removeItem('today.session.selectedPlanId')
    localStorage.removeItem('sessionMode.layoutState.user-1')
    localStorage.removeItem('sessionMode.lockIn.user-1.2026-02-21')

    sessionApiMock.getTodaySession.mockResolvedValue(baseSession)
    sessionApiMock.saveTodaySessionConfig.mockResolvedValue({ id: 'session-1' })
    sessionApiMock.updateTodaySessionPlannedTickers.mockResolvedValue({})
    sessionApiMock.startTradeFromSession.mockResolvedValue({ id: 'trade-1', ...baseSession.activeTrade })
    sessionApiMock.closeTradeFromSession.mockResolvedValue({})
    sessionApiMock.saveTradeEntryJournal.mockResolvedValue({ id: 'trade-1' })

    plansApiMock.listDailyPlans.mockResolvedValue([basePlan])
    strategiesApiMock.listStrategies.mockResolvedValue({ myStrategies: [], mentorStrategies: [] })
    fxApiMock.fetchFxRate.mockResolvedValue({ rate: 1, source: 'AUTO' })
    assetsApiMock.uploadAsset.mockResolvedValue({
      id: 'asset-1',
      scope: 'TRADE',
      originalFileName: 'chart.png',
      url: '/api/assets/asset-1/view'
    })
  })

  it('renders panels in execution order', async () => {
    renderSessionPage()

    const progressHeading = await screen.findByText('Session progress')
    const checklistHeading = screen.getByText('Session checklist')
    const chartHeading = screen.getByText('Live chart')
    const mentorHeading = screen.getByText('Mentor Plan')
    const plannerHeading = screen.getByText('Trade Planner + Execution')

    const comesBefore = (first: HTMLElement, second: HTMLElement) => (
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
    )

    expect(comesBefore(progressHeading, checklistHeading)).toBe(true)
    expect(comesBefore(checklistHeading, chartHeading)).toBe(true)
    expect(comesBefore(chartHeading, mentorHeading)).toBe(true)
    expect(comesBefore(chartHeading, plannerHeading)).toBe(true)
  })

  it('keeps start disabled when lock-in is missing even if checklist/ticket are complete', async () => {
    const user = userEvent.setup()
    renderSessionPage()

    expect(await screen.findByText('Session Lock-In')).toBeInTheDocument()
    await completeChecklistAndTicket(user)

    expect(screen.getByRole('button', { name: 'Start trade' })).toBeDisabled()
  }, 10000)

  it('keeps start disabled until prerequisites and triggers are complete', async () => {
    const user = userEvent.setup()
    renderSessionPage()

    expect(await screen.findByText('Session Lock-In')).toBeInTheDocument()
    await completeLockIn(user)

    const plannerPanel = getPlannerPanel()
    await user.type(within(plannerPanel).getByLabelText(/i.?m wrong if/i), 'Invalidation')
    await user.type(within(plannerPanel).getByLabelText(/entry price/i), '10')
    await user.type(within(plannerPanel).getByLabelText(/stop[-\s]?loss/i), '9')
    await user.type(within(plannerPanel).getByLabelText(/take[-\s]?profit/i), '12')

    expect(screen.getByRole('button', { name: 'Start trade' })).toBeDisabled()
  })

  it('shows RR warning and blocks start when RR is below threshold', async () => {
    const user = userEvent.setup()
    renderSessionPage()

    expect(await screen.findByText('Session Lock-In')).toBeInTheDocument()
    await completeLockIn(user)
    await completeChecklistAndTicket(user, false)

    expect(screen.getByText(/RR is below 1.5R/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start trade' })).toBeDisabled()
  }, 10000)

  it('toggles mentor essentials/full plan', async () => {
    const user = userEvent.setup()
    renderSessionPage()

    expect(await screen.findByText('Show full plan')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show full plan' }))

    expect(screen.getByRole('button', { name: 'Show essentials only' })).toBeInTheDocument()
    expect(screen.getByText('Macro calm')).toBeInTheDocument()
  })

  it('renders only one Notes field (regression)', async () => {
    renderSessionPage()

    await screen.findByText('Trade Planner + Execution')
    expect(screen.getAllByRole('textbox', { name: /^Notes$/i })).toHaveLength(1)
  })

  it('supports screenshot attach via file upload and paste', async () => {
    const user = userEvent.setup()
    renderSessionPage()

    await screen.findByText('Live chart')
    await user.click(screen.getByRole('button', { name: /attach screenshot to trade/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Attach screenshot' })
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['img'], 'chart.png', { type: 'image/png' })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(assetsApiMock.uploadAsset).toHaveBeenCalledWith(expect.objectContaining({
        scope: 'TRADE'
      }))
    })

    const pasteZone = within(dialog).getByRole('textbox', { name: 'Paste screenshot' })
    fireEvent.paste(pasteZone, {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => file
          }
        ]
      }
    })

    await waitFor(() => {
      expect(assetsApiMock.uploadAsset).toHaveBeenCalledTimes(2)
    })
  })

  it('opens entry journal after successful start and saves journal payload', async () => {
    const user = userEvent.setup()
    renderSessionPage()

    expect(await screen.findByText('Session Lock-In')).toBeInTheDocument()

    await completeLockIn(user)
    await completeChecklistAndTicket(user, true)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start trade' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: 'Start trade' }))

    const journalDialog = await screen.findByRole('dialog', { name: 'Entry Journal' })
    expect(journalDialog).toBeInTheDocument()
    await user.clear(within(journalDialog).getByLabelText(/what did you see/i))
    await user.type(within(journalDialog).getByLabelText(/what did you see/i), 'Sweep + displacement + MSS')
    await user.click(within(journalDialog).getByRole('button', { name: 'Save journal' }))

    await waitFor(() => {
      expect(sessionApiMock.saveTradeEntryJournal).toHaveBeenCalledWith(
        'trade-1',
        expect.objectContaining({
          entryJournalText: 'Sweep + displacement + MSS'
        })
      )
    })
  }, 10000)
})
