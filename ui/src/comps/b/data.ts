// Types, labels and the arithmetic every visual in mockup b draws from. Everything here is computed from
// /api/cases, /api/cases/{id} and /api/drift; nothing is invented.

export type Verdict = "appeal" | "doc_request" | "fix_checklist" | "dont_appeal" | "not_winnable"
export type Status = "met" | "not_met" | "missing_documentation" | "not_applicable"
export type Tone = "pos" | "warn" | "neg" | "quiet" | "ink" | "teal" | "clay"
export type GlyphName = "check" | "half" | "cross" | "dash" | "pause" | "return" | "slash"

export interface Row {
  id: string
  patient: string
  payer: string
  plan_type: string
  cpt: string
  dos: string
  reason: string
  billed_usd: number
  verdict: Verdict
  days_left: number
  due: string
  policy: string | null
  cost_usd: number
}
export interface CasesResp { as_of: string; cases: Row[] }

export interface Evidence { note_id: string; quote: string; verified: boolean }
export interface Match {
  criterion_id: string
  status: Status
  evidence: Evidence[]
  rationale: string
  model: string
  votes: string[]
  confidence: "agreed" | "escalated" | "rule" | string
}
export interface Criterion { criterion_id: string; summary: string; verbatim_span: string; kind: string }
export interface Treatment { kind: string; start: string | null; end: string | null; sessions: number | null; response: string | null }
export interface Facts {
  onset: string | null
  symptom_days: number | null
  conservative_days: number | null
  treatments: Treatment[]
  red_flags: { flag: string; noted_on?: string }[]
}
export interface TraceCall { step: string; model: string; prompt_tokens: number; completion_tokens: number; cost_usd: number; latency_s: number }
export interface GateCheck { text: string; status: string; source_id: string }
export interface Deadline { rule_id: string; due: string; days_left: number; basis: string; citation: string; verified: boolean }
export interface Run {
  denial: { payer_name: string; plan_type: string; cpt: string; dos: string; notice_date: string; carc: string[]; reason_text: string; practice_state: string }
  triage: { reason_class: string; route: string; checklist: string[]; explanation: string }
  policy: { policy_id: string; version: string; title: string; effective_from: string; url: string; source: string } | null
  criteria: Criterion[] | null
  matches: Match[] | null
  verdict: Verdict
  appeal: { rendered: string; sections: { heading: string; body: string }[] } | null
  doc_request: string | null
  gate: { ok: boolean; checks: GateCheck[] } | null
  facts: Facts | null
  trace: TraceCall[]
  cost_usd: number
}
export interface Note { note_id: string; date: string; note_type: string }
export interface Threshold { label: string; from: "onset" | "treatment" | string; days: number; address: string }
export interface CaseDetail {
  id: string
  patient: string
  billed_usd: number
  run: Run
  notes: Note[]
  addresses: Record<string, string>
  thresholds: Threshold[]
  policy_citation: string | null
  as_of: string
  deadline: Deadline
}
export interface DriftItem { case_id: string; kind: string; policy_id: string; cited: string; current: string; status: string; affects_case: boolean }
export interface Drift { checked_at: string | null; items: DriftItem[] }

// Wording follows the classic app (web/app.js VERDICT and STATUS maps).
export const VERDICT: Record<Verdict, { label: string; tone: Tone; glyph: GlyphName; line: string; next: string }> = {
  appeal: { label: "Appeal", tone: "pos", glyph: "check", line: "The chart meets the policy in effect on the date of service. Review the drafted letter and send it.", next: "Review the appeal" },
  doc_request: { label: "Ask the physician", tone: "warn", glyph: "half", line: "Winnable once the missing documentation is added to the chart.", next: "Open the request" },
  fix_checklist: { label: "Fix & resubmit", tone: "teal", glyph: "return", line: "Administrative denial: correct the claim, or dispute it with proof. No medical-necessity appeal is needed.", next: "Open fix checklist" },
  dont_appeal: { label: "Don't appeal yet", tone: "clay", glyph: "pause", line: "The chart doesn't meet the policy yet. Appealing now would likely fail.", next: "See what's missing" },
  not_winnable: { label: "Not winnable", tone: "quiet", glyph: "slash", line: "The plan excludes this service. Medical-necessity evidence won't change the outcome.", next: "See why" },
}
export const REORDER = { label: "Reorder, don't appeal", line: "The service came before the policy's waiting periods ended, so no chart note can change this denial. A new order can qualify." }
export const ORDER: Verdict[] = ["appeal", "doc_request", "fix_checklist", "dont_appeal", "not_winnable"]

export const STATUS: Record<Status, { label: string; tone: Tone; glyph: GlyphName }> = {
  met: { label: "Supports", tone: "pos", glyph: "check" },
  missing_documentation: { label: "Missing docs", tone: "warn", glyph: "half" },
  not_met: { label: "Blocks", tone: "neg", glyph: "cross" },
  not_applicable: { label: "Doesn't apply", tone: "quiet", glyph: "dash" },
}
export const STATUS_ORDER: Status[] = ["met", "missing_documentation", "not_met", "not_applicable"]

export const PLAN: Record<string, string> = {
  MA: "Medicare Advantage",
  FFS: "Medicare",
  COMMERCIAL_ACA: "Commercial (ACA)",
  COMMERCIAL_ERISA: "Employer plan (ERISA)",
}
export const RULE_NAME: Record<string, string> = {
  "ma-reconsideration": "Plan reconsideration",
  "aca-internal-appeal": "Internal appeal",
  "erisa-internal-appeal": "Internal appeal",
}

// ---------- dates (ISO yyyy-mm-dd, handled in UTC so the calendar never shifts) ----------
const MS = 86400000
export const toT = (iso: string) => Date.parse(iso + "T00:00:00Z")
export const addDays = (iso: string, n: number) => new Date(toT(iso) + n * MS).toISOString().slice(0, 10)
export const daysBetween = (a: string, b: string) => Math.round((toT(b) - toT(a)) / MS)
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
export const fmtDate = (iso: string, year = true) => {
  const [y, m, d] = iso.split("-").map(Number)
  return `${MON[m - 1]} ${d}${year ? `, ${y}` : ""}`
}
export const fmtMon = (iso: string) => MON[Number(iso.split("-")[1]) - 1]
export const usd = (n: number) => `$${n.toLocaleString("en-US")}`
export const usd4 = (n: number) => `$${n.toFixed(4)}`

export const shortPayer = (p: string) =>
  p.replace(/\s*\(synthetic( member)?\)/i, "").replace("Medicare Advantage", "MA").replace("Employer Health Plan", "Employer")

// ---------- per-case computations ----------
export function firstTreatmentStart(f: Facts | null): string | null {
  const s = (f?.treatments ?? []).map((t) => t.start).filter((x): x is string => !!x).sort()
  return s[0] ?? null
}

export type ThresholdState = { label: string; address: string; date: string | null; tone: Tone; glyph: GlyphName; word: string }
// Where each of the policy's waiting periods lands, and whether the chart meets it (counted here, never by a model).
export function thresholdStates(d: CaseDetail): ThresholdState[] {
  const f = d.run.facts
  const dos = d.run.denial.dos
  return d.thresholds.map((t) => {
    if (t.from === "onset") {
      if (!f?.onset) return { label: t.label, address: t.address, date: null, tone: "warn", glyph: "half", word: "No onset date in the chart" }
      const date = addDays(f.onset, t.days)
      const n = daysBetween(f.onset, dos)
      return n >= t.days
        ? { label: t.label, address: t.address, date, tone: "pos", glyph: "check", word: `Met: ${n} days by service` }
        : { label: t.label, address: t.address, date, tone: "neg", glyph: "cross", word: `Short by ${t.days - n} days` }
    }
    const start = firstTreatmentStart(f)
    if (!start || f?.conservative_days == null)
      return { label: t.label, address: t.address, date: null, tone: "warn", glyph: "half", word: "Can't be counted: no dated care in the chart" }
    const date = addDays(start, t.days)
    const n = f.conservative_days
    return n >= t.days
      ? { label: t.label, address: t.address, date, tone: "pos", glyph: "check", word: `Met: ${n} days of care` }
      : { label: t.label, address: t.address, date, tone: "neg", glyph: "cross", word: `Short by ${t.days - n} days` }
  })
}

// A held denial whose service date came before a waiting period could end: same verdict, reorder wording.
export function tooEarly(d: CaseDetail): boolean {
  if (d.run.verdict !== "dont_appeal") return false
  const dos = d.run.denial.dos
  const f = d.run.facts
  return d.thresholds.some((t) => {
    const from = t.from === "onset" ? f?.onset : firstTreatmentStart(f)
    return !!from && addDays(from, t.days) > dos
  })
}

export function verdictView(v: Verdict, early: boolean) {
  const base = VERDICT[v]
  return early ? { ...base, label: REORDER.label, line: REORDER.line } : base
}

export function coverage(ms: Match[] | null) {
  const c: Record<Status, number> = { met: 0, missing_documentation: 0, not_met: 0, not_applicable: 0 }
  for (const m of ms ?? []) c[m.status] = (c[m.status] ?? 0) + 1
  const votes = { agreed: 0, escalated: 0, rule: 0 }
  for (const m of ms ?? []) if (m.confidence in votes) votes[m.confidence as keyof typeof votes]++
  return { counts: c, total: (ms ?? []).length, votes }
}

export const modelShort = (m: string) => {
  const s = m.toLowerCase()
  if (s.includes("super-vl")) return "Super VL"
  if (s.includes("nano")) return "Nano"
  if (s.includes("ultra")) return "Ultra"
  if (s.includes("super")) return "Super"
  return m.split("/").pop() ?? m
}
const STEP_NAME: Record<string, string> = {
  intake: "Read the letter",
  facts: "Chart facts",
  criteria: "Policy rules",
  match: "Rule matching",
  appeal_draft: "Appeal draft",
  appeal_critique: "Critique",
  appeal_revise: "Revision",
}
export interface TraceGroup { key: string; name: string; calls: number; seconds: number; cost: number; models: { name: string; n: number }[]; referees: number }
export function traceGroups(trace: TraceCall[]): TraceGroup[] {
  const out = new Map<string, TraceGroup>()
  for (const t of trace) {
    const key = t.step.split(":")[0]
    const g = out.get(key) ?? { key, name: STEP_NAME[key] ?? key, calls: 0, seconds: 0, cost: 0, models: [], referees: 0 }
    g.calls++
    g.seconds += t.latency_s
    g.cost += t.cost_usd
    if (t.step.endsWith(":referee")) g.referees++
    const mn = modelShort(t.model)
    const hit = g.models.find((m) => m.name === mn)
    if (hit) hit.n++
    else g.models.push({ name: mn, n: 1 })
    out.set(key, g)
  }
  return [...out.values()]
}

export const noteDate = (d: CaseDetail, noteId: string) => d.notes.find((n) => n.note_id === noteId)?.date ?? null

export function parseHashCase(): string | null {
  const m = window.location.hash.match(/[?&]case=(case_\d+)/)
  return m ? m[1] : null
}
