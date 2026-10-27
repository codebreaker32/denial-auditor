// Prior-auth check types and the arithmetic the check screens draw. Everything is read from
// /api/checks and /api/checks/{id}; the earliest date itself is computed by the server in code.
import { addDays, daysBetween, fmtDate, type Criterion, type Facts, type GlyphName, type Match, type Note, type Sentence, type Threshold, type Tone, type TraceCall } from "@/lib/data"

export interface CheckRow {
  id: string
  patient: string
  payer: string
  plan_type: string
  cpt: string
  planned_dos: string
  readiness: Readiness
  earliest: string | null
  policy: string | null
  cost_usd: number
}
export type Readiness = "ready" | "add_documentation" | "not_yet" | "doesnt_qualify"
export interface CheckPolicy { policy_id: string; version: string; title: string; effective_from: string; url: string; source: string; version_basis: string }
export interface PriorAuthCheck {
  case_id: string
  request: { payer_name: string; plan_type: string; cpt: string; icd10: string[]; planned_dos: string; practice_state: string }
  policy: CheckPolicy | null
  criteria: Criterion[]
  matches: Match[]
  facts: (Facts & { neuro_exam?: string; radiculopathy?: string; plan_after_mri?: string }) | null
  readiness: Readiness
  earliest: string | null
  earliest_basis: string[]
  doc_request: string | null
  trace: TraceCall[]
  cost_usd: number
}
export interface CheckDetail {
  id: string
  patient: string
  check: PriorAuthCheck
  notes: (Note & { author_role?: string })[]
  sentences: Sentence[]
  addresses: Record<string, string>
  thresholds: (Threshold & { sentence?: number })[]
  policy_citation: string | null
}

export type ReadyKey = Readiness | "charted"
export const READY: Record<ReadyKey, { label: string; tone: Tone; glyph: GlyphName; line: string }> = {
  ready: { label: "Ready to submit", tone: "pos", glyph: "check", line: "The chart meets the policy in effect on the planned date." },
  charted: { label: "Qualifies if charted", tone: "warn", glyph: "half", line: "The wait is reached by the planned date, but the chart stops short of it." },
  add_documentation: { label: "Add documentation first", tone: "warn", glyph: "ring", line: "A route to coverage is met, but something the policy asks for isn't in the chart yet." },
  not_yet: { label: "Not yet", tone: "clay", glyph: "pause", line: "The chart falls short of a waiting period on the planned date." },
  doesnt_qualify: { label: "Doesn't qualify", tone: "quiet", glyph: "slash", line: "The chart doesn't meet this policy, and waiting won't change that." },
}

// "Not yet" whose earliest date falls on or before the planned date only needs charting (classic app: chartOnly).
export const readyKey = (r: Readiness, earliest: string | null, planned: string): ReadyKey =>
  r === "not_yet" && !!earliest && earliest <= planned ? "charted" : r

export const shortPolicy = (p: string | null) => (p ?? "").split(",")[0].replace(/^Aetna /, "").replace(/ snapshot.*/, "")

// The why-line, from the server's own basis text (same wording rules as the classic app).
export function checkLine(ch: PriorAuthCheck): string {
  const k = readyKey(ch.readiness, ch.earliest, ch.request.planned_dos)
  if (!ch.earliest) return READY[k].line
  const b = ch.earliest_basis[0] ?? ""
  const need = /^([^:]+):/.exec(b)?.[1]
  const planned = fmtDate(ch.request.planned_dos)
  const on = fmtDate(ch.earliest)
  const head = need ? `The policy needs ${need}.` : "The chart doesn't yet document the policy's waiting period."
  return ch.earliest <= ch.request.planned_dos
    ? `${head} Chart the care through ${on} and the ${planned} request qualifies.`
    : `${head} It's reached on ${on}, after the planned ${planned}. Move the MRI to that date or later.`
}

export function firstStart(f: Facts | null): string | null {
  return (f?.treatments ?? []).map((t) => t.start).filter((x): x is string => !!x).sort()[0] ?? null
}

export type Wait = { label: string; address: string; from: string | null; date: string | null; tone: Tone; glyph: GlyphName; word: string }
// Each waiting period against the planned date. Counted here from chart dates, never by a model.
export function waits(d: CheckDetail): Wait[] {
  const ch = d.check
  const f = ch.facts
  const planned = ch.request.planned_dos
  const ready = ch.readiness === "ready"
  return d.thresholds.map((t) => {
    const base = { label: t.label, address: t.address }
    if (t.from === "onset") {
      if (!f?.onset) return { ...base, from: null, date: null, tone: "warn", glyph: "half", word: "No onset date in the chart" }
      const date = addDays(f.onset, t.days)
      const n = daysBetween(f.onset, planned)
      if (n >= t.days) return { ...base, from: f.onset, date, tone: "pos", glyph: "check", word: `Met: ${n} days by the planned date` }
      if (ready) return { ...base, from: f.onset, date, tone: "quiet", glyph: "dash", word: "Not needed on the route that's met" }
      return { ...base, from: f.onset, date, tone: "neg", glyph: "cross", word: `Short by ${t.days - n} days · reached ${fmtDate(date, false)}` }
    }
    const start = firstStart(f)
    if (!start || f?.conservative_days == null) {
      if (ready) return { ...base, from: null, date: null, tone: "quiet", glyph: "dash", word: "Not needed on the route that's met" }
      return { ...base, from: null, date: null, tone: "warn", glyph: "half", word: "No dated care in the chart" }
    }
    const date = addDays(start, t.days)
    const n = f.conservative_days
    if (n >= t.days) return { ...base, from: start, date, tone: "pos", glyph: "check", word: `Met: ${n} days of care` }
    if (ready) return { ...base, from: start, date, tone: "quiet", glyph: "dash", word: "Not needed on the route that's met" }
    if (date <= planned) return { ...base, from: start, date, tone: "warn", glyph: "half", word: `Met once charted through ${fmtDate(date, false)}` }
    return { ...base, from: start, date, tone: "neg", glyph: "cross", word: `${n} of ${t.days} days · reached ${fmtDate(date, false)}` }
  })
}

// The status each rule shows. A not-met rule on a waiting period that charting will meet reads "Met once charted";
// an unmet alternative route, when another route is met, reads "Other route".
export type Show = "not_met" | "pending" | "missing_documentation" | "met" | "route" | "not_applicable"
export const SHOW: Record<Show, { label: string; tone: Tone; glyph: GlyphName }> = {
  not_met: { label: "Blocks", tone: "neg", glyph: "cross" },
  pending: { label: "Met once charted", tone: "warn", glyph: "half" },
  missing_documentation: { label: "Missing docs", tone: "warn", glyph: "ring" },
  met: { label: "Supports", tone: "pos", glyph: "check" },
  route: { label: "Other route", tone: "quiet", glyph: "dash" },
  not_applicable: { label: "Doesn't apply", tone: "quiet", glyph: "dash" },
}
export const SHOW_ORDER: Show[] = ["not_met", "pending", "missing_documentation", "met", "route", "not_applicable"]

export function ruleShows(d: CheckDetail): Record<string, Show> {
  const ch = d.check
  const k = readyKey(ch.readiness, ch.earliest, ch.request.planned_dos)
  const byId = Object.fromEntries(ch.criteria.map((c) => [c.criterion_id, c]))
  const routeOk = k === "ready" || k === "charted"
  const pending = new Set<string>()
  if (k === "charted") {
    const waitS = new Set(d.thresholds.map((t) => t.sentence))
    const sNum = (cid: string) => {
      const m = /S(\d+)/.exec(d.addresses[cid] ?? "")
      return m ? Number(m[1]) : null
    }
    const blk = ch.matches.filter((m) => m.status === "not_met" && ["indication", "duration"].includes(byId[m.criterion_id]?.kind))
    let hit = blk.filter((m) => waitS.has(sNum(m.criterion_id) ?? -1))
    if (!hit.length) hit = blk.filter((m) => byId[m.criterion_id]?.kind === "indication" && /\b\d+\s*(weeks?|months?|days?)\b/i.test(byId[m.criterion_id].verbatim_span)).slice(0, 1)
    hit.forEach((m) => pending.add(m.criterion_id))
  }
  const out: Record<string, Show> = {}
  for (const m of ch.matches) {
    const kind = byId[m.criterion_id]?.kind
    out[m.criterion_id] = pending.has(m.criterion_id) ? "pending" : m.status === "not_met" && kind === "indication" && routeOk ? "route" : (m.status as Show)
  }
  return out
}
