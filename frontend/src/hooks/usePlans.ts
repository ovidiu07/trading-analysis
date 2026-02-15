import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MyPlanPayload,
  createMyDailyPlan,
  fetchActivePlansForTrade,
  fetchTodayMentorPlan,
  fetchTodayMyPlan,
  updateMyPlan
} from '../api/plans'

const todayMentorPlanQueryKey = (date: string, timezone: string) => ['todayMentorPlan', date, timezone] as const
const todayMyPlanQueryKey = (date: string, timezone: string) => ['todayMyPlan', date, timezone] as const
const activeTradePlansQueryKey = (openedAt: string, timezone?: string) => ['activeTradePlans', openedAt, timezone || ''] as const

export function useTodayMentorPlanQuery(date: string, timezone: string) {
  return useQuery({
    queryKey: todayMentorPlanQueryKey(date, timezone),
    queryFn: async () => fetchTodayMentorPlan({ date, tz: timezone }),
    enabled: Boolean(date) && Boolean(timezone)
  })
}

export function useTodayMyPlanQuery(date: string, timezone: string) {
  return useQuery({
    queryKey: todayMyPlanQueryKey(date, timezone),
    queryFn: async () => fetchTodayMyPlan({ date, tz: timezone }),
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

export function useActivePlansForTradeQuery(openedAt: string, timezone?: string, enabled = true) {
  return useQuery({
    queryKey: activeTradePlansQueryKey(openedAt, timezone),
    queryFn: async () => fetchActivePlansForTrade({ openedAt, tz: timezone }),
    enabled: enabled && Boolean(openedAt)
  })
}
