import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import TodayPage from './TodayPage'
import { I18nProvider } from '../i18n'

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

vi.mock('../api/trades', () => ({
  listTrades: vi.fn().mockResolvedValue({
    content: [],
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: 6
  })
}))

vi.mock('../api/today', () => ({
  fetchCoachFocus: vi.fn().mockResolvedValue({
    available: true,
    severity: 'warn',
    leakTitle: 'Overtrading in NY AM',
    action: 'Cap at 3 trades',
    rationale: 'Too many low-quality entries.'
  })
}))

vi.mock('../hooks/usePlans', () => ({
  useTodayMentorPlanQuery: () => ({
    data: {
      id: 'daily-1',
      slug: 'mentor-daily-1',
      title: 'Mentor Daily Plan',
      summary: 'Favor longs above opening range.',
      keyLevels: ['1.0820', '1.0795'],
      updatedAt: '2026-02-19T08:00:00Z'
    },
    isLoading: false,
    isError: false
  })
}))

const renderTodayPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return render(
    <MemoryRouter initialEntries={['/today']}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <TodayPage />
        </I18nProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('TodayPage simplified dashboard', () => {
  it('shows only the requested sections and removes legacy cards', async () => {
    renderTodayPage()

    expect(await screen.findByRole('link', { name: 'Log trade' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start session' })).toBeInTheDocument()
    expect(screen.getByText('Mentor Focus Plan')).toBeInTheDocument()
    expect(screen.getByText('Your Focus Metric')).toBeInTheDocument()
    expect(screen.getByText('Recent trades')).toBeInTheDocument()

    expect(screen.queryByText('My Plan')).not.toBeInTheDocument()
    expect(screen.queryByText('Session checklist')).not.toBeInTheDocument()
  })
})
