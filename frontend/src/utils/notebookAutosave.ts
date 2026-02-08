type NotebookDraftFingerprintInput = {
  title?: string | null
  body?: string | null
  dateKey?: string | null
  folderId?: string | null
  type?: string | null
  relatedTradeId?: string | null
  isPinned?: boolean | null
}

type AutosaveState = {
  hasNote: boolean
  isDirty: boolean
  isSaving: boolean
  viewMode: 'read' | 'edit'
}

export function buildNotebookFingerprint(input: NotebookDraftFingerprintInput): string {
  return JSON.stringify({
    title: input.title ?? '',
    body: input.body ?? '',
    dateKey: input.dateKey ?? '',
    folderId: input.folderId ?? '',
    type: input.type ?? '',
    relatedTradeId: input.relatedTradeId ?? '',
    isPinned: input.isPinned ?? false
  })
}

export function isNotebookDirty(input: NotebookDraftFingerprintInput, savedFingerprint: string): boolean {
  return buildNotebookFingerprint(input) !== savedFingerprint
}

export function shouldAutosave(state: AutosaveState): boolean {
  return state.hasNote && state.isDirty && !state.isSaving && state.viewMode === 'edit'
}

export function createAutosaveScheduler(callback: () => void, delayMs = 1200) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  return {
    schedule() {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        timeoutId = undefined
        callback()
      }, delayMs)
    },
    cancel() {
      if (!timeoutId) return
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
  }
}
