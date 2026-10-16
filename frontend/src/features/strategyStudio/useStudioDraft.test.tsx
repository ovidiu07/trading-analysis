import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../api/client'
import { getStudio, saveStudio } from '../../api/strategyStudio'
import { template, type Studio } from './model'
import { useStudioDraft } from './useStudioDraft'
vi.mock('../../api/strategyStudio', () => ({ getStudio: vi.fn(), saveStudio: vi.fn() }))
const fixture = (): Studio => {
  const t = template(true)
  return {
    strategy: { ...t.strategy, id: 'strategy', source: 'MY', entryConditions: [], archived: false },
    definition: t.definition,
    revision: 2
  }
}
let saved: Studio
beforeEach(() => {
  sessionStorage.clear()
  saved = fixture()
  vi.mocked(getStudio).mockResolvedValue(structuredClone(saved))
  vi.mocked(saveStudio).mockImplementation(async (_id, body) => {
    saved = {
      strategy: { ...saved.strategy, ...body.strategy },
      definition: body.definition,
      revision: saved.revision + 1
    }
    return structuredClone(saved)
  })
})
afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})
async function editor() {
  const hook = renderHook(() => useStudioDraft('strategy', vi.fn()))
  await waitFor(() => expect(hook.result.current.status).toBe('saved'))
  return hook
}
describe('server autosave and recovery', () => {
  it('debounces a burst of edits into one persistent save', async () => {
    const hook = await editor()
    vi.useFakeTimers()
    act(() => {
      hook.result.current.edit((s) => ({ ...s, strategy: { ...s.strategy, name: 'A' } }))
      hook.result.current.edit((s) => ({ ...s, strategy: { ...s.strategy, name: 'B' } }))
    })
    expect(saveStudio).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(901)
    })
    expect(saveStudio).toHaveBeenCalledTimes(1)
    expect(saved.strategy.name).toBe('B')
    expect(hook.result.current.status).toBe('saved')
    expect(sessionStorage.getItem('tradejaudit:studio-recovery:strategy')).toBeNull()
  })
  it('retains edits made while an earlier save is in flight', async () => {
    const hook = await editor()
    let resolve: (s: Studio) => void
    vi.mocked(saveStudio).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r
        })
    )
    act(() => hook.result.current.edit((s) => ({ ...s, strategy: { ...s.strategy, name: 'First' } })))
    let first: Promise<Studio>
    act(() => {
      first = hook.result.current.flush()
    })
    act(() => hook.result.current.edit((s) => ({ ...s, strategy: { ...s.strategy, name: 'Second' } })))
    await act(async () => {
      resolve!({ ...saved, revision: 3, strategy: { ...saved.strategy, name: 'First' } })
      await first!
    })
    expect(hook.result.current.draft?.strategy.name).toBe('Second')
    expect(vi.mocked(saveStudio).mock.calls[1][1].strategy.name).toBe('Second')
    expect(hook.result.current.status).toBe('saved')
  })
  it('keeps a recovery draft and exposes a failed save for retry', async () => {
    const hook = await editor()
    vi.mocked(saveStudio).mockRejectedValueOnce(new Error('Offline'))
    act(() => hook.result.current.edit((s) => ({ ...s, strategy: { ...s.strategy, name: 'Offline work' } })))
    await act(async () => {
      await expect(hook.result.current.flush()).rejects.toThrow('Offline')
    })
    expect(hook.result.current.status).toBe('error')
    expect(sessionStorage.getItem('tradejaudit:studio-recovery:strategy')).toContain('Offline work')
    await act(async () => {
      await hook.result.current.flush()
    })
    expect(hook.result.current.status).toBe('saved')
  })
  it('stops after a conflict until the reviewed draft is explicitly rebased', async () => {
    const hook = await editor()
    const conflict = new ApiError('Changed')
    conflict.status = 409
    vi.mocked(saveStudio).mockRejectedValueOnce(conflict)
    act(() => hook.result.current.edit((s) => ({ ...s, strategy: { ...s.strategy, name: 'My draft' } })))
    await act(async () => {
      await expect(hook.result.current.flush()).rejects.toThrow('Changed')
    })
    expect(hook.result.current.status).toBe('conflict')
    await expect(hook.result.current.flush()).rejects.toThrow('Resolve')
    expect(saveStudio).toHaveBeenCalledTimes(1)
    act(() => hook.result.current.reviewedRebase({ ...saved, revision: 8 }))
    await act(async () => {
      await hook.result.current.flush()
    })
    expect(vi.mocked(saveStudio).mock.calls[1][1].expectedRevision).toBe(8)
  })
  it('rejects invalid parameters without sending them to the server', async () => {
    const hook = await editor()
    act(() =>
      hook.result.current.edit((s) => ({
        ...s,
        definition: {
          ...s.definition,
          parameters: s.definition.parameters.map((p) => (p.type === 'PERCENTAGE' ? { ...p, value: 0.075 } : p))
        }
      }))
    )
    await act(async () => {
      await expect(hook.result.current.flush()).rejects.toThrow('step')
    })
    expect(saveStudio).not.toHaveBeenCalled()
    expect(hook.result.current.status).toBe('error')
  })
  it('offers browser recovery without automatically replacing the saved server copy', async () => {
    sessionStorage.setItem(
      'tradejaudit:studio-recovery:strategy',
      JSON.stringify({ ...saved, strategy: { ...saved.strategy, name: 'Recovered' } })
    )
    const hook = await editor()
    expect(hook.result.current.draft?.strategy.name).toBe('Five Sessions Model')
    expect(hook.result.current.recovery?.strategy.name).toBe('Recovered')
    act(() => hook.result.current.restoreRecovery())
    await act(async () => {
      await hook.result.current.flush()
    })
    expect(saved.strategy.name).toBe('Recovered')
  })
})
