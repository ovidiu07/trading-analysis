import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TodayPage from './TodayPage'
import { I18nProvider } from '../i18n'

const plansMock = vi.hoisted(() => ({
  myPlan: {
    id: 'plan-1',
    scope: 'DAILY',
    source: 'USER',
    title: 'My execution plan',
    content: 'Execute only A+ setups',
    activeFrom: '2026-02-15T00:00:00+02:00',
    activeTo: '2026-02-15T23:59:59+02:00',
    featured: false,
    createdAt: '2026-02-15T06:00:00+02:00',
    updatedAt: '2026-02-15T06:00:00+02:00'
  } as any,
  deleteMutation: vi.fn(),
  createMutation: vi.fn(),
  updateMutation: vi.fn()
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
  fetchCoachFocus: vi.fn().mockResolvedValue(null)
}))

vi.mock('../hooks/useChecklist', () => ({
  useTodayChecklistQuery: () => ({
    data: { date: '2026-02-15', items: [] },
    isLoading: false,
    isError: false
  }),
  useUpdateTodayChecklistMutation: () => ({
    mutate: vi.fn(),
    isLoading: false
  })
}))

vi.mock('../hooks/usePlans', () => ({
  useTodayMentorPlanQuery: () => ({
    data: null,
    isLoading: false,
    isError: false
  }),
  useTodayMyPlanQuery: () => ({
    data: plansMock.myPlan,
    isLoading: false,
    isError: false
  }),
  useCreateMyDailyPlanMutation: () => ({
    mutateAsync: plansMock.createMutation,
    isLoading: false
  }),
  useUpdateMyPlanMutation: () => ({
    mutateAsync: plansMock.updateMutation,
    isLoading: false
  }),
  useDeleteMyPlanMutation: () => ({
    mutateAsync: plansMock.deleteMutation,
    isLoading: false
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

describe('TodayPage my plan removal', () => {
  beforeEach(() => {
    localStorage.setItem('app.language', 'en')
    plansMock.myPlan = {
      id: 'plan-1',
      scope: 'DAILY',
      source: 'USER',
      title: 'My execution plan',
      content: 'Execute only A+ setups',
      activeFrom: '2026-02-15T00:00:00+02:00',
      activeTo: '2026-02-15T23:59:59+02:00',
      featured: false,
      createdAt: '2026-02-15T06:00:00+02:00',
      updatedAt: '2026-02-15T06:00:00+02:00'
    } as any
    plansMock.createMutation.mockReset()
    plansMock.updateMutation.mockReset()
    plansMock.deleteMutation.mockReset()
    plansMock.deleteMutation.mockImplementation(async () => {
      plansMock.myPlan = null
      return undefined
    })
  })

  it('removes my plan with confirmation and keeps it removed after reload', async () => {
    const view = renderTodayPage()
    const user = userEvent.setup()

    expect(await screen.findByText('My execution plan')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Remove plan' }))
    const removeDialog = await screen.findByRole('dialog', { name: 'Remove plan' })
    expect(within(removeDialog).getByText('Remove plan? This cannot be undone.')).toBeInTheDocument()

    await user.click(within(removeDialog).getByRole('button', { name: 'Remove plan' }))

    await waitFor(() => {
      expect(plansMock.deleteMutation).toHaveBeenCalledTimes(1)
      expect(plansMock.myPlan).toBeNull()
    })
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog', { name: 'Remove plan' }))

    view.rerender(
      <MemoryRouter initialEntries={['/today']}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <I18nProvider>
            <TodayPage />
          </I18nProvider>
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect(await screen.findByText('No plan for today')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create my plan' })).toBeInTheDocument()
  })
})
