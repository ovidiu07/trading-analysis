import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTodayMentorPlanQuery, useTodayMyPlanQuery } from './usePlans'

const fetchTodayMentorPlanMock = vi.fn()
const fetchTodayMyPlanMock = vi.fn()

vi.mock('../api/plans', async () => {
  const actual = await vi.importActual<typeof import('../api/plans')>('../api/plans')
  return {
    ...actual,
    fetchTodayMentorPlan: (...args: unknown[]) => fetchTodayMentorPlanMock(...args),
    fetchTodayMyPlan: (...args: unknown[]) => fetchTodayMyPlanMock(...args)
  }
})

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('usePlans today empty-state behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('treats empty mentor-plan payload as null instead of query error', async () => {
    fetchTodayMentorPlanMock.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useTodayMentorPlanQuery('2026-02-15', 'Europe/Bucharest'), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.status === 'success' || result.current.status === 'error').toBe(true)
    })

    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it('treats empty my-plan payload as null instead of query error', async () => {
    fetchTodayMyPlanMock.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useTodayMyPlanQuery('2026-02-15', 'Europe/Bucharest'), {
      wrapper: createWrapper()
    })

    await waitFor(() => {
      expect(result.current.status === 'success' || result.current.status === 'error').toBe(true)
    })

    expect(result.current.isError).toBe(false)
    expect(result.current.data).toBeNull()
  })
})
