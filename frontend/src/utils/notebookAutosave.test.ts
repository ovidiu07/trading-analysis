import { describe, expect, it, vi } from 'vitest'
import { buildNotebookFingerprint, createAutosaveScheduler, isNotebookDirty, shouldAutosave } from './notebookAutosave'

describe('notebook autosave helpers', () => {
  it('builds a stable fingerprint for draft data', () => {
    const fingerprint = buildNotebookFingerprint({
      title: 'Title',
      body: '<p>Body</p>',
      dateKey: '2024-01-01',
      folderId: 'folder-1',
      type: 'NOTE',
      relatedTradeId: null,
      isPinned: true
    })

    expect(fingerprint).toMatchInlineSnapshot(
      `"{"title":"Title","body":"<p>Body</p>","dateKey":"2024-01-01","folderId":"folder-1","type":"NOTE","relatedTradeId":"","isPinned":true}"`
    )
  })

  it('detects dirty state against the saved fingerprint', () => {
    const saved = buildNotebookFingerprint({ title: 'Saved', body: 'Body', type: 'NOTE' })
    expect(isNotebookDirty({ title: 'Saved', body: 'Body', type: 'NOTE' }, saved)).toBe(false)
    expect(isNotebookDirty({ title: 'Changed', body: 'Body', type: 'NOTE' }, saved)).toBe(true)
  })

  it('evaluates autosave state requirements', () => {
    expect(shouldAutosave({
      hasNote: true,
      isDirty: true,
      isSaving: false,
      viewMode: 'edit'
    })).toBe(true)

    expect(shouldAutosave({
      hasNote: true,
      isDirty: true,
      isSaving: true,
      viewMode: 'edit'
    })).toBe(false)
  })

  it('debounces autosave scheduling to a single callback', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const scheduler = createAutosaveScheduler(callback, 1200)

    scheduler.schedule()
    scheduler.schedule()
    scheduler.schedule()

    vi.advanceTimersByTime(1199)
    expect(callback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)

    scheduler.cancel()
    vi.useRealTimers()
  })
})
