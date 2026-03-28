import { useState, useEffect, useCallback, useRef } from 'react'

interface DraftPayload<T> {
  data: T
  savedAt: string
}

/**
 * Auto-saves form state to localStorage every 30s and on window blur/beforeunload.
 * Returns helpers to restore or clear the draft.
 *
 * @param key   Unique draft key, e.g. `draft-layer-{enterpriseId}-{date}`
 * @param getValues  Callback that returns current form values (e.g. form.getValues)
 * @param enabled    Set to false to disable (e.g. after successful save)
 */
export function useDraftSave<T>(
  key: string,
  getValues: () => T,
  enabled = true,
) {
  const [hasDraft, setHasDraft] = useState(() => !!localStorage.getItem(key))
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const save = useCallback(() => {
    if (!enabledRef.current) return
    const payload: DraftPayload<T> = { data: getValues(), savedAt: new Date().toISOString() }
    try {
      localStorage.setItem(key, JSON.stringify(payload))
      setHasDraft(true)
    } catch {
      // localStorage full — silently ignore
    }
  }, [key, getValues])

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(save, 30_000)
    window.addEventListener('blur', save)
    window.addEventListener('beforeunload', save)
    return () => {
      clearInterval(timer)
      window.removeEventListener('blur', save)
      window.removeEventListener('beforeunload', save)
    }
  }, [save, enabled])

  const getDraft = useCallback((): DraftPayload<T> | null => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as DraftPayload<T>) : null
    } catch {
      return null
    }
  }, [key])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key)
    setHasDraft(false)
  }, [key])

  return { hasDraft, getDraft, clearDraft, saveNow: save }
}
