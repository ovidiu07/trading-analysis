import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TodayPage from './TodayPage'
import { I18nProvider } from '../i18n'
import { getSessionReview, saveSessionReview } from '../api/sessionReviews'

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1', timezone: 'Europe/Bucharest', baseCurrency: 'USD' } }) }))
vi.mock('../api/accounts', () => ({ fetchTradingAccounts: vi.fn().mockResolvedValue([{ id: 'a1', name: 'Synthetic account', currency: 'EUR' }]) }))
vi.mock('../api/growthCoach', () => ({ fetchGrowthCoach: vi.fn().mockResolvedValue({ detail: null }) }))
vi.mock('../api/analytics', () => ({ fetchAnalyticsCoach: vi.fn().mockResolvedValue({ advice: [] }) }))
vi.mock('../api/strategies', () => ({ listStrategies: vi.fn().mockResolvedValue({ myStrategies: [], mentorStrategies: [] }) }))
vi.mock('../api/trades', () => ({ searchTrades: vi.fn().mockResolvedValue({ content: [], totalPages: 0 }) }))
vi.mock('../api/sessionReviews', async importOriginal => ({ ...await importOriginal<typeof import('../api/sessionReviews')>(), getSessionReview: vi.fn().mockResolvedValue({ revision: 0, data: {} }), saveSessionReview: vi.fn(async (_a, _d, revision, data) => ({ revision: revision + 1, data })) }))
function show(path = '/today?accountIds=a1') {
  return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><I18nProvider><TodayPage /></I18nProvider></QueryClientProvider></MemoryRouter>)
}
beforeEach(() => { localStorage.clear(); localStorage.setItem('app.language', 'en'); vi.clearAllMocks() })
afterEach(cleanup)
describe('Today session review', () => {
  it('requires one account when an all-account URL is explicit', async () => {
    show('/today?accountScope=all')
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose one account')
    expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument()
  })
  it('starts deliberately and persists the session state', async () => {
    show(); fireEvent.click(await screen.findByRole('button', { name: 'Start session' }))
    await waitFor(() => expect(saveSessionReview).toHaveBeenCalledWith('a1', expect.any(String), 0, expect.objectContaining({ state: 'TRADE' })))
    expect(await screen.findByText('Execution timeline')).toBeInTheDocument()
  })
  it('recovers a preparation draft after remount', async () => {
    const first = show(); const input = await screen.findByLabelText('One session focus')
    fireEvent.change(input, { target: { value: 'Wait for confirmation' } }); first.unmount(); show()
    expect(await screen.findByDisplayValue('Wait for confirmation')).toBeInTheDocument()
  })
  it('allows direct review and requires an explicit carry-forward choice', async () => {
    show(); fireEvent.click(await screen.findByRole('button', { name: 'Review', exact: true }))
    expect(screen.getByRole('button', { name: 'Finish review' })).toBeDisabled()
    expect(screen.getByText('Review your decisions')).toBeInTheDocument()
    expect(saveSessionReview).not.toHaveBeenCalled()
  })
  it('respects the date deep link and offers recovery of a conflicting draft', async () => {
    vi.mocked(getSessionReview).mockResolvedValueOnce({ revision: 2, data: { focus: 'Saved focus' } })
    localStorage.setItem('today.review.user-1.a1.2026-09-01', JSON.stringify({ revision: 1, data: { state: 'PREPARE', focus: 'Retained focus', assessments: [] } }))
    show('/today?accountIds=a1&date=2026-09-01')
    expect(await screen.findByDisplayValue('Saved focus')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restore my retained draft' }))
    expect(screen.getByDisplayValue('Retained focus')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save session' }))
    await waitFor(() => expect(saveSessionReview).toHaveBeenCalledWith('a1', '2026-09-01', 2, expect.objectContaining({ focus: 'Retained focus' })))
  })
})
