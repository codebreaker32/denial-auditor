// Work state per case, kept in this browser only (the demo has no accounts). The tool never sends anything:
// "Sent" is the biller's own note that they sent it. Any screen can read it with useWork(caseId).
import { useSyncExternalStore } from "react"
import type { GlyphName, Tone } from "@/lib/data"

export type WorkStatus = "todo" | "waiting" | "ready" | "sent"
export interface Work { status: WorkStatus; at: string }

export const WORK: Record<WorkStatus, { label: string; tone: Tone; glyph: GlyphName }> = {
  todo: { label: "To do", tone: "quiet", glyph: "ring" },
  waiting: { label: "Waiting on physician", tone: "warn", glyph: "pause" },
  ready: { label: "Ready to send", tone: "teal", glyph: "half" },
  sent: { label: "Sent", tone: "pos", glyph: "check" },
}
export const WORK_ORDER: WorkStatus[] = ["todo", "waiting", "ready", "sent"]

const KEY = "da.work.v2"
let memory: Record<string, Work> = read()
const subs = new Set<() => void>()

function read(): Record<string, Work> {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || "{}")
    return v && typeof v === "object" ? v : {}
  } catch {
    return {}
  }
}

const TODO: Work = { status: "todo", at: "" }
export function getWork(caseId: string): Work {
  return memory[caseId] ?? TODO
}

export function setWork(caseId: string, status: WorkStatus) {
  const next = { ...memory }
  if (status === "todo") delete next[caseId]
  else next[caseId] = { status, at: new Date().toISOString().slice(0, 10) }
  memory = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage blocked: the state lasts for this page only */
  }
  subs.forEach((f) => f())
}

function subscribe(f: () => void) {
  subs.add(f)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      memory = read()
      f()
    }
  }
  window.addEventListener("storage", onStorage)
  return () => {
    subs.delete(f)
    window.removeEventListener("storage", onStorage)
  }
}

export function useWork(caseId: string): Work {
  return useSyncExternalStore(subscribe, () => getWork(caseId))
}

// Fix-checklist ticks, per case, this browser only.
const FIX = "da.fix.v2"
export function getFix(caseId: string): number[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(FIX) || "{}")
    return Array.isArray(v?.[caseId]) ? v[caseId] : []
  } catch {
    return []
  }
}
export function setFix(caseId: string, done: number[]) {
  try {
    const v = JSON.parse(window.localStorage.getItem(FIX) || "{}") || {}
    if (done.length) v[caseId] = done
    else delete v[caseId]
    window.localStorage.setItem(FIX, JSON.stringify(v))
  } catch {
    /* storage blocked: ticks just aren't kept */
  }
}

// Every case's state at once, for the worklist's chips and filter.
export function useWorkMap(): Record<string, Work> {
  return useSyncExternalStore(subscribe, () => memory)
}
