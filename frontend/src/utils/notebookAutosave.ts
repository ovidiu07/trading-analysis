import { NotebookNote } from '../api/notebook'

export type NotebookDraftSnapshot = Pick<
  NotebookNote,
  'title' | 'body' | 'dateKey' | 'folderId' | 'type' | 'relatedTradeId' | 'isPinned'
>

export const buildNotebookFingerprint = (note: NotebookDraftSnapshot | null | undefined) => {
  if (!note) return ''
  return JSON.stringify({
    title: note.title ?? '',
    body: note.body ?? '',
    dateKey: note.dateKey ?? '',
    folderId: note.folderId ?? '',
    type: note.type ?? '',
    relatedTradeId: note.relatedTradeId ?? '',
    isPinned: Boolean(note.isPinned)
  })
}

export const isNotebookDirty = (note: NotebookDraftSnapshot | null | undefined, savedFingerprint: string | null) => {
  return buildNotebookFingerprint(note) !== (savedFingerprint ?? '')
}

type AutosaveState = {
  hasNote: boolean
  isDirty: boolean
  isSaving: boolean
  viewMode: 'read' | 'edit'
}

export const shouldAutosave = ({ hasNote, isDirty, isSaving, viewMode }: AutosaveState) => {
  return hasNote && isDirty && !isSaving && viewMode === 'edit'
}

export const createAutosaveScheduler = (callback: () => void, delayMs: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return {
    schedule() {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        timeoutId = null
        callback()
      }, delayMs)
    },
    cancel() {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
  }
}
