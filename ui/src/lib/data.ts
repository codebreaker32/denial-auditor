// Types, labels and the arithmetic the app draws from. Everything here is computed from
// /api/cases, /api/cases/{id} and /api/drift; nothing is invented.

export type Verdict = "appeal" | "doc_request" | "fix_checklist" | "dont_appeal" | "not_winnable"
export type Status = "met" | "not_met" | "missing_documentation" | "not_applicable"
export type Tone = "pos" | "warn" | "neg" | "quiet" | "ink" | "teal" | "clay"
export type GlyphName = "check" | "half" | "ring" | "cross" | "dash" | "pause" | "return" | "slash"

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
export interface CasesResp { as_of: string; cases: Row[]; live_enabled?: boolean; available?: string[] }

export interface Evidence { note_id: string; quote: string; verified: boolean; start?: number | null; end?: number | null }
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
export interface Denial {
  payer_name: string; plan_type: string; cpt: string; dos: string; notice_date: string; carc: string[]
  reason_text: string; practice_state: string; icd10?: string[]; extracted_by?: string
}
// The policy as fetched in the run: the version basis, when and how it was fetched, its hash and its full text.
export interface Policy {
  source: string; policy_id: string; version: string; title: string; effective_from: string; url: string
  fetched_at?: string; fetched_via?: string; version_basis?: string; sha256?: string; text: string
}
export interface Critique { issue: string; severity: string; suggestion: string }
export interface AppealDraft { rendered: string; sections: { heading: string; body: string }[]; critique: Critique[]; revision: number }
export interface Run {
  denial: Denial
  triage: { reason_class: string; route: string; checklist: string[]; explanation: string }
  policy: Policy | null
  criteria: Criterion[] | null
  matches: Match[] | null
  verdict: Verdict
  appeal: AppealDraft | null
  doc_request: string | null
  gate: { ok: boolean; checks: GateCheck[] } | null
  facts: Facts | null
  trace: TraceCall[]
  cost_usd: number
}
export interface Note { note_id: string; date: string; note_type: string; author_role: string; text: string }
export interface Threshold { label: string; from: "onset" | "treatment" | string; days: number; address: string; sentence: number }
export interface Sentence { n: number; start: number; end: number; text: string; criteria: string[] }
export interface CaseDetail {
  id: string
  sentences: Sentence[]
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
  doc_request: { label: "Ask the physician", tone: "warn", glyph: "ring", line: "Winnable once the missing documentation is added to the chart.", next: "Open the request" },
  fix_checklist: { label: "Fix and resubmit", tone: "teal", glyph: "return", line: "Administrative denial: correct the claim, or dispute it with proof. No medical-necessity appeal is needed.", next: "Open fix checklist" },
  dont_appeal: { label: "Don't appeal yet", tone: "clay", glyph: "pause", line: "The chart doesn't meet the policy yet. Appealing now would likely fail.", next: "See what's missing" },
  not_winnable: { label: "Not winnable", tone: "quiet", glyph: "slash", line: "The plan excludes this service. Medical-necessity evidence won't change the outcome.", next: "See why" },
}
export const REORDER = { label: "Reorder, don't appeal", line: "The service came before the policy's waiting periods ended, so no chart note can change this denial. A new order can qualify." }
export const ORDER: Verdict[] = ["appeal", "doc_request", "fix_checklist", "dont_appeal", "not_winnable"]

export const STATUS: Record<Status, { label: string; tone: Tone; glyph: GlyphName }> = {
  met: { label: "Supports", tone: "pos", glyph: "check" },
  missing_documentation: { label: "Missing docs", tone: "warn", glyph: "ring" },
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
  p.replace(/\s*\(synthetic[^)]*\)/i, "").replace("Medicare Advantage", "MA").replace("Employer Health Plan", "Employer")

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

// A short name for a criterion, for globe labels and compact rows. Falls back to the first words of the summary.
const SHORT: [RegExp, string][] = [
  [/^List of red-flag/i, "Red-flag list"],
  // "For non-red-flag conditions…" must not read as the red-flag route.
  [/non-red-flag/i, "Non-red-flag route"],
  [/red-flag conditions/i, "Red-flag route"],
  [/after 1 month/i, "One month of symptoms"],
  [/first month/i, "Not in the first month"],
  [/conservative management/i, "Four weeks of care"],
  [/do not improve within four weeks/i, "Reassessed at four weeks"],
  [/^Documentation/i, "Chart documentation"],
  [/will not affect treatment/i, "Changes treatment"],
  [/degenerative disc/i, "Uncomplicated disc disease"],
  [/duplicates/i, "Duplicate imaging"],
  [/investigative/i, "Investigational uses"],
  [/contrast/i, "Contrast use"],
]
export function shortRule(summary: string): string {
  for (const [re, label] of SHORT) if (re.test(summary)) return label
  return summary.split(/\s+/).slice(0, 3).join(" ")
}

export function initials(name: string) {
  const p = name.split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] ?? "") + (p[p.length - 1]?.[0] ?? "")).toUpperCase()
}

// CMS policies carry a version number; a payer page is a dated snapshot.
export function policyLabel(p: { policy_id: string; version: string }) {
  return /^\d{4}-\d{2}-\d{2}$/.test(p.version) ? `${p.policy_id}, snapshot ${fmtDate(p.version, false)}` : `${p.policy_id} v${p.version}`
}

// ---------- plain references for the app screens (billers, not engineers) ----------
// "Medicare policy L34220", "Aetna policy CPB 0236". policyLabel above stays the compact form for the landing.
type PolicyRef = { source?: string; policy_id: string; version: string; fetched_at?: string }
export function policyName(p: PolicyRef) {
  const aetna = p.source === "aetna-cpb" || /^Aetna\b/.test(p.policy_id)
  return aetna ? `Aetna policy ${p.policy_id.replace(/^Aetna\s+/, "")}` : `Medicare policy ${p.policy_id}`
}
// A payer page has no version history: name the snapshot by the date this run fetched it, never "in effect".
export const isSnapshot = (p: PolicyRef) => /^\d{4}-\d{2}-\d{2}$/.test(p.version)
export function policyHuman(p: PolicyRef & { fetched_at?: string }) {
  if (!isSnapshot(p)) return `${policyName(p)}, version ${p.version}`
  return `${policyName(p)}, snapshot fetched ${fmtDate((p.fetched_at ?? p.version).slice(0, 10))}`
}
// The policy line under a recommendation: a CMS version is the one in effect; a payer snapshot says what it is.
export function policyInForce(p: PolicyRef & { fetched_at?: string }) {
  return isSnapshot(p) ? `${policyHuman(p)} (Aetna doesn't publish versions)` : `${policyHuman(p)}, in effect on the service date`
}
// The one-line policy string on /api/checks rows ("L34220 v40, eff …" or "Aetna CPB 0236 snapshot …").
export const policyNameFromLine = (line: string | null) => {
  const id = (line ?? "").split(",")[0].replace(/ snapshot.*/, "").replace(/ v\d+$/, "").trim()
  return id ? policyName({ policy_id: id, version: "" }) : ""
}
const SEC = /S(\d+)(?:\s*[–-]\s*S?(\d+))?/
// A policy address ("S47", "L34220 · S89–92") as a short section mark and its spoken form.
export function sec(addr: string | null | undefined): string {
  const m = SEC.exec(addr ?? "")
  return m ? `§${m[1]}${m[2] && m[2] !== m[1] ? `–${m[2]}` : ""}` : ""
}
export function secLong(p: PolicyRef | null, addr: string | null | undefined): string {
  const m = SEC.exec(addr ?? "")
  if (!m) return p ? policyName(p) : "the policy"
  const span = m[2] && m[2] !== m[1] ? `sentences ${m[1]} to ${m[2]}` : `sentence ${m[1]}`
  return `${p ? policyName(p) : "The policy"}, ${span}`
}
// How sure the rule check is, in one plain phrase; a fixed-rule decision says nothing. "Double-checked": the first two
// checks disagreed and a third settled it, so the row says so and the biller may want to read the chart line.
export const DOUBLE_TIP = "The first two checks disagreed, so a third check settled it. Worth reading the chart line yourself."
export function sureWord(m: Pick<Match, "confidence" | "votes">): { word: string; review: boolean } | null {
  if (!m.votes.length || m.confidence === "rule") return null
  return m.confidence === "escalated" ? { word: "Double-checked", review: true } : { word: "Checked twice", review: false }
}
// A chart note named the way a biller would: "Office visit note, Jun 15, 2026".
export function noteName(notes: { note_id: string; date: string; note_type: string }[], id: string): string {
  const n = notes.find((x) => x.note_id === id)
  if (!n) return "the chart"
  return `${noteKind(n.note_type)}, ${fmtDate(n.date)}`
}
const NOTE_KIND: Record<string, string> = {
  pt_note: "Physical therapy note", imaging_order: "Imaging order", initial_visit: "First visit", follow_up: "Follow-up visit",
}
export const noteKind = (t: string) => NOTE_KIND[t] ?? t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())

// ---------- rule names: short, accurate and distinct within one policy ----------
// Read from the rule's own policy words first (summaries can repeat across rules), then its summary; a name that
// still repeats gets its section mark. shortRule above stays as the landing's compact label.
const BY_SPAN: [RegExp, string][] = [
  [/need for both studies/i, "Need for both studies"],
  [/available upon request|documented in the medical record/i, "Records on file"],
  [/abnormalities alone/i, "Clinical reason for the MRI"],
  [/reasonable trial of conservative management lasting at least four weeks/i, "Four weeks of conservative care"],
  [/do not improve within four weeks/i, "Reassessed at four weeks"],
  [/after 1 month of symptoms/i, "One month of symptoms"],
]
const BY_SUMMARY: [RegExp, string][] = [
  [/^List of red-flag/i, "Red-flag list"],
  [/after 1 month of symptoms/i, "One month of symptoms"],
  [/first month/i, "Not in the first month"],
  [/trial of conservative management/i, "Four weeks of conservative care"],
  [/do not improve within four weeks/i, "Reassessed at four weeks"],
  [/(?<!non-)red-flag conditions/i, "Red-flag route"],
  [/will not affect treatment/i, "Changes treatment"],
  [/degenerative disc/i, "Uncomplicated disc disease"],
  [/duplicates/i, "Duplicate imaging"],
  [/contrast.*\bCNS\b/i, "Contrast for brain and cord studies"],
  [/spine study, contrast/i, "Contrast within a spine study"],
  [/investigative/i, "Investigational uses"],
  [/6 weeks conservative/i, "Six weeks of conservative care"],
  [/unresponsive to 4 weeks/i, "Four weeks, degenerative disease"],
]
type Named = { criterion_id: string; summary: string; verbatim_span: string }
function baseName(c: Named): string {
  for (const [re, n] of BY_SPAN) if (re.test(c.verbatim_span)) return n
  for (const [re, n] of BY_SUMMARY) if (re.test(c.summary)) return n
  const clause = c.summary
    .replace(/\s+(indicates?|is|are)\s+(medically necessary|considered).*$/i, "")
    .split(/[,;(]/)[0]
    .trim()
  const words = clause.split(/\s+/)
  return words.length > 6 ? words.slice(0, 6).join(" ").replace(/\s+(of|for|or|and|the|to|a|with|in)$/i, "") + "…" : clause
}
const NAMES = new WeakMap<object, Map<string, string>>()
export function ruleNames(criteria: Named[] | null, addresses: Record<string, string>): Map<string, string> {
  const key = criteria ?? []
  const hit = NAMES.get(key)
  if (hit) return hit
  const base = new Map(key.map((c) => [c.criterion_id, baseName(c)]))
  const seen = new Map<string, number>()
  base.forEach((n) => seen.set(n, (seen.get(n) ?? 0) + 1))
  const out = new Map<string, string>()
  base.forEach((n, id) => out.set(id, (seen.get(n) ?? 0) > 1 && addresses[id] ? `${n} ${sec(addresses[id])}` : n))
  NAMES.set(key, out)
  return out
}

// ---------- quote counts: one definition everywhere (unique quoted passages) ----------
// A letter can quote the same passage more than once; the count is of distinct passages, and a passage counts as
// matching only when every use of it matches.
const squashQ = (t: string) => String(t ?? "").replace(/\s+/g, " ").trim()
export function quoteCount(checks: { text: string; status: string }[]): { ok: number; total: number } {
  const all = new Set(checks.map((c) => squashQ(c.text)))
  const bad = new Set(checks.filter((c) => c.status !== "verified").map((c) => squashQ(c.text)))
  return { ok: all.size - bad.size, total: all.size }
}
