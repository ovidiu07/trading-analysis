import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MyPlanPayload,
  createMyDailyPlan,
  deleteMyPlan,
  fetchActivePlansForTrade,
  fetchTodayMentorPlan,
  fetchTodayMyPlan,
  updateMyPlan
} from '../api/plans'

const todayMentorPlanQueryKey = (date: string, timezone: string) => ['todayMentorPlan', date, timezone] as const
const todayMyPlanQueryKey = (date: string, timezone: string) => ['todayMyPlan', date, timezone] as const
const activeTradePlansQueryKey = (openedAt: string, timezone?: string) => ['activeTradePlans', openedAt, timezone || ''] as const

const logTodayPlanQueryError = (queryName: 'mentor-plan' | 'my-plan', date: string, timezone: string, error: unknown) => {
  console.error(`[today] Failed to load ${queryName}`, {
    date,
    timezone,
    error
  })
}

export function useTodayMentorPlanQuery(date: string, timezone: string) {
  return useQuery({
    queryKey: todayMentorPlanQueryKey(date, timezone),
    queryFn: async () => {
      const plan = await fetchTodayMentorPlan({ date, tz: timezone })
      return plan ?? null
    },
    onError: (error) => {
      logTodayPlanQueryError('mentor-plan', date, timezone, error)
    },
    enabled: Boolean(date) && Boolean(timezone)
  })
}

export function useTodayMyPlanQuery(date: string, timezone: string) {
  return useQuery({
    queryKey: todayMyPlanQueryKey(date, timezone),
    queryFn: async () => {
      const plan = await fetchTodayMyPlan({ date, tz: timezone })
      return plan ?? null
    },
    onError: (error) => {
      logTodayPlanQueryError('my-plan', date, timezone, error)
    },
    enabled: Boolean(date) && Boolean(timezone)
  })
}

export function useCreateMyDailyPlanMutation(date: string, timezone: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: MyPlanPayload) => createMyDailyPlan(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todayMyPlan'] }),
        queryClient.invalidateQueries({ queryKey: ['activeTradePlans'] }),
        queryClient.invalidateQueries({ queryKey: todayMyPlanQueryKey(date, timezone) })
      ])
    }
  })
}

export function useUpdateMyPlanMutation(date: string, timezone: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { planId: string; payload: MyPlanPayload }) => updateMyPlan(params.planId, params.payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todayMyPlan'] }),
        queryClient.invalidateQueries({ queryKey: ['activeTradePlans'] }),
        queryClient.invalidateQueries({ queryKey: todayMyPlanQueryKey(date, timezone) })
      ])
    }
  })
}

export function useDeleteMyPlanMutation(date: string, timezone: string) {
  const queryClient = useQueryClient()
  const key = todayMyPlanQueryKey(date, timezone)

  return useMutation({
    mutationFn: async (planId: string) => deleteMyPlan(planId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, null)
      return { previous }
    },
    onError: (_error, _planId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(key, context.previous)
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['todayMyPlan'] }),
        queryClient.invalidateQueries({ queryKey: ['activeTradePlans'] }),
        queryClient.invalidateQueries({ queryKey: key })
      ])
    }
  })
}

export function useActivePlansForTradeQuery(openedAt: string, timezone?: string, enabled = true) {
  return useQuery({
    queryKey: activeTradePlansQueryKey(openedAt, timezone),
    queryFn: async () => fetchActivePlansForTrade({ openedAt, tz: timezone }),
    enabled: enabled && Boolean(openedAt)
  })
}
