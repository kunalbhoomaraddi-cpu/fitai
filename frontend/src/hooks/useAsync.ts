import { useCallback, useEffect, useRef, useState } from 'react'

/** Load data with loading/error state and a reload function. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const alive = useRef(true)
  const run = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try { const d = await fn(); if (alive.current) setData(d) }
    catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Something went wrong') }
    finally { if (alive.current) setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { alive.current = true; run(); return () => { alive.current = false } }, [run])
  return { data, setData, error, loading, reload: run }
}
