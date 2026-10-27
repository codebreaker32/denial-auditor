// One fetch per URL per page load; every screen reads the same cached promise.
import { useEffect, useState } from "react"
import type { CaseDetail, CasesResp, Drift } from "./data"

const cache = new Map<string, Promise<unknown>>()

export function getJSON<T>(url: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined
  if (!p) {
    p = fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`${url} answered ${r.status}`))))
    p.catch(() => cache.delete(url))
    cache.set(url, p)
  }
  return p
}

// Dropping a URL from the cache makes every mounted hook on it fetch again; the old data stays on screen until the
// new answer arrives, so nothing blanks or jumps.
const listeners = new Map<string, Set<() => void>>()
export function invalidate(...urls: string[]) {
  for (const u of urls) {
    cache.delete(u)
    listeners.get(u)?.forEach((f) => f())
  }
}
export const invalidateCases = (caseId?: string) =>
  invalidate("/api/cases", "/api/drift", ...(caseId ? [`/api/cases/${caseId}`] : []))

export type Load<T> = { data: T | null; error: string | null }

export function useJSON<T>(url: string | null): Load<T> {
  const [state, setState] = useState<Load<T>>({ data: null, error: null })
  const [rev, setRev] = useState(0)
  useEffect(() => {
    if (!url) return
    const set = listeners.get(url) ?? new Set()
    const bump = () => setRev((r) => r + 1)
    set.add(bump)
    listeners.set(url, set)
    return () => void set.delete(bump)
  }, [url])
  useEffect(() => {
    if (!url) return
    let live = true
    setState((s) => (s.data ? s : { data: null, error: null }))
    getJSON<T>(url).then(
      (data) => live && setState({ data, error: null }),
      (e: Error) => live && setState((s) => (s.data && rev > 0 ? s : { data: null, error: e.message })),
    )
    return () => {
      live = false
    }
  }, [url, rev])
  return state
}

export const useCases = () => useJSON<CasesResp>("/api/cases")
export const useCase = (id: string | null) => useJSON<CaseDetail>(id ? `/api/cases/${id}` : null)
export const useDrift = () => useJSON<Drift>("/api/drift")
export const getCase = (id: string) => getJSON<CaseDetail>(`/api/cases/${id}`)
