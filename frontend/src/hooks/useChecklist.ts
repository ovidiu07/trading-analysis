import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChecklistTemplateItemInput,
  TodayChecklistResponse,
  TodayChecklistUpdate,
  fetchChecklistTemplate,
  fetchTodayChecklist,
  saveChecklistTemplate,
  updateTodayChecklist
} from '../api/checklist'

const checklistTemplateQueryKey = ['checklistTemplate'] as const
const todayChecklistQueryKey = (timezone: string) => ['todayChecklist', timezone] as const

export function useChecklistTemplateQuery() {
  return useQuery({
    queryKey: checklistTemplateQueryKey,
    queryFn: async () => fetchChecklistTemplate()
  })
}

export function useSaveChecklistTemplateMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (items: ChecklistTemplateItemInput[]) => saveChecklistTemplate(items),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: checklistTemplateQueryKey }),
        queryClient.invalidateQueries({ queryKey: ['todayChecklist'] })
      ])
    }
  })
}

export function useTodayChecklistQuery(timezone: string) {
  return useQuery({
    queryKey: todayChecklistQueryKey(timezone),
    queryFn: async () => fetchTodayChecklist(timezone),
    enabled: Boolean(timezone)
  })
}

export function useUpdateTodayChecklistMutation(timezone: string) {
  const queryClient = useQueryClient()
  const key = todayChecklistQueryKey(timezone)

  return useMutation({
    mutationFn: async (payload: { date: string; updates: TodayChecklistUpdate[] }) =>
      updateTodayChecklist(payload.date, payload.updates),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<TodayChecklistResponse>(key)

      if (previous && previous.date === payload.date) {
        const updatesById = new Map(payload.updates.map((update) => [update.checklistItemId, update.completed]))
        queryClient.setQueryData<TodayChecklistResponse>(key, {
          ...previous,
          items: previous.items.map((item) => (
            updatesById.has(item.id)
              ? { ...item, completed: Boolean(updatesById.get(item.id)) }
              : item
          ))
        })
      }

      return { previous }
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(key, data)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: key })
    }
  })
}
