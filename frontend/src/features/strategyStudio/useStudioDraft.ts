import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import { getStudio, saveStudio } from '../../api/strategyStudio'
import { definitionError, writeRequest, type Studio } from './model'

const signature = (s: Studio) => JSON.stringify({ strategy: writeRequest(s).strategy, definition: s.definition })
export function useStudioDraft(id: string, onSaved: (studio: Studio) => void) {
  const [draft, setDraft] = useState<Studio | null>(null)
  const [status, setStatus] = useState<'loading' | 'saved' | 'pending' | 'saving' | 'error' | 'conflict'>('loading')
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState<Studio | null>(null)
  const current = useRef<Studio | null>(null),
    baseline = useRef(''),
    pending = useRef<Promise<Studio> | null>(null),
    stopped = useRef(false),
    mounted = useRef(true)
  const savedCallback = useRef(onSaved)
  savedCallback.current = onSaved
  const recoveryKey = `tradejaudit:studio-recovery:${id}`
  const publish = useCallback((value: Studio) => {
    current.current = value
    if (mounted.current) setDraft(value)
  }, [])
  const retain = useCallback(
    (value: Studio) => {
      try {
        sessionStorage.setItem(recoveryKey, JSON.stringify(value))
      } catch {
        /* Server saving remains available when browser storage is full. */
      }
    },
    [recoveryKey]
  )
  const accept = useCallback(
    (value: Studio) => {
      baseline.current = signature(value)
      stopped.current = false
      publish(value)
      setError('')
      setStatus('saved')
      savedCallback.current(value)
    },
    [publish]
  )
  useEffect(() => {
    mounted.current = true
    let cancelled = false
    getStudio(id)
      .then((value) => {
        if (cancelled) return
        accept(value)
        try {
          const raw = sessionStorage.getItem(recoveryKey)
          const retained = raw ? (JSON.parse(raw) as Studio) : null
          if (retained?.strategy?.id === id && signature(retained) !== signature(value)) setRecovery(retained)
        } catch {
          /* Invalid temporary recovery data is ignored. */
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message)
          setStatus('error')
        }
      })
    return () => {
      cancelled = true
      mounted.current = false
    }
  }, [id, recoveryKey, accept])
  const edit = useCallback(
    (change: (value: Studio) => Studio) => {
      if (!current.current) return
      const value = change(current.current)
      publish(value)
      retain(value)
      if (!stopped.current) setStatus('pending')
    },
    [publish, retain]
  )
  const flush = useCallback(async (): Promise<Studio> => {
    if (pending.current) await pending.current
    const capture = current.current
    if (!capture) throw new Error('Strategy is still loading')
    if (stopped.current) throw new Error('Resolve the editing conflict before saving')
    if (signature(capture) === baseline.current) return capture
    const invalid =
      definitionError(capture.definition) || (!capture.strategy.name.trim() ? 'Strategy name is required' : '')
    if (invalid) {
      setError(invalid)
      setStatus('error')
      throw new Error(invalid)
    }
    setStatus('saving')
    setError('')
    const hash = signature(capture)
    const promise = saveStudio(id, writeRequest(capture))
    pending.current = promise
    try {
      const result = await promise
      baseline.current = signature(result)
      const latest = current.current!
      const next =
        signature(latest) === hash
          ? result
          : {
              ...latest,
              revision: result.revision,
              strategy: { ...latest.strategy, updatedAt: result.strategy.updatedAt, assets: result.strategy.assets }
            }
      publish(next)
      savedCallback.current(result)
      if (signature(next) === baseline.current) {
        try {
          sessionStorage.removeItem(recoveryKey)
        } catch {
          /* optional */
        }
        if (mounted.current) setStatus('saved')
      } else {
        retain(next)
        if (mounted.current) setStatus('pending')
      }
      return next
    } catch (e) {
      const conflict = e instanceof ApiError && e.status === 409
      if (conflict) stopped.current = true
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'Save failed')
        setStatus(conflict ? 'conflict' : 'error')
      }
      throw e
    } finally {
      pending.current = null
    }
  }, [id, publish, recoveryKey, retain])
  const flushAll = useCallback(async () => {
    let result = await flush()
    while (signature(result) !== baseline.current) result = await flush()
    return result
  }, [flush])
  useEffect(() => {
    if (status !== 'pending') return
    const timer = window.setTimeout(() => {
      void flush().catch(() => {})
    }, 900)
    return () => window.clearTimeout(timer)
  }, [draft, status, flush])
  const dirty = Boolean(draft && signature(draft) !== baseline.current)
  useEffect(() => {
    if (!dirty && status !== 'saving') return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (current.current) retain(current.current)
      event.preventDefault()
      event.returnValue = ''
    }
    const visibility = () => {
      if (document.visibilityState === 'hidden') void flush().catch(() => {})
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [dirty, status, flush, retain])
  const restoreRecovery = () => {
    if (!recovery) return
    stopped.current = false
    publish(recovery)
    setStatus('pending')
    setRecovery(null)
  }
  const reviewedRebase = (server: Studio) => {
    if (!current.current) return
    stopped.current = false
    publish({ ...current.current, revision: server.revision })
    setStatus('pending')
    setError('')
  }
  return {
    draft,
    status,
    error,
    recovery,
    dirty,
    edit,
    flush: flushAll,
    accept,
    restoreRecovery,
    dismissRecovery: () => {
      try {
        sessionStorage.removeItem(recoveryKey)
      } catch {}
      setRecovery(null)
    },
    reviewedRebase
  }
}
