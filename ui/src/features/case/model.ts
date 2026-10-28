// Case-view arithmetic on top of lib/data: the fields the API sends that lib/data doesn't type yet, the statuses a
// rule shows, waits counted in code, and the held-denial logic (documentable vs. too early). Ported from the classic
// app (web/app.js), which is the source of truth for behaviour. Nothing here calls a model.
import { getCase, getJSON, useJSON } from "@/lib/api"
import {
  STATUS, addDays, daysBetween, firstTreatmentStart, fmtDate, policyHuman, sec, shortPayer,
  type CaseDetail, type Criterion, type Facts, type GlyphName, type Match, type Status, type Threshold, type Tone,
} from "@/lib/data"

// ---------- the API's fuller shapes (typed in lib/data) ----------
export const policyOf = (d: CaseDetail) => d.run.policy
export const notesOf = (d: CaseDetail) => d.notes
export const thresholdsOf = (d: CaseDetail) => d.thresholds
export const appealOf = (d: CaseDetail) => d.run.appeal
export const denialOf = (d: CaseDetail) => d.run.denial

// ---------- the prior-auth check for the same chart (its earliest date is worked out in code) ----------
export interface CheckRow { id: string; readiness: string; earliest: string | null; planned_dos: string }
export interface CheckFull { id: string; check: { facts: Facts | null; earliest: string | null } }
export function useCheck(caseId: string) {
  const list = useJSON<{ checks: CheckRow[] }>("/api/checks")
  const row = list.data?.checks.find((c) => c.id === caseId) ?? null
  const full = useJSON<CheckFull>(row ? `/api/checks/${caseId}` : null)
  return { row, facts: full.data?.check.facts ?? null, loaded: !!list.data || !!list.error }
}

// ---------- names ----------
export const squash = (t: string) => String(t ?? "").replace(/\s+/g, " ").trim()
export const lc1 = (t: string) => t.replace(/^./, (c) => c.toLowerCase())
export const capFirst = (t: string) => t.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
export const noteShort = (id: string) => id.split("-").pop() ?? id
export const mdy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-")
  return `${m}/${d}/${y}`
}
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`

// "S47", "S89–92" → [47, 92]
export function sRange(addr: string | undefined | null): [number, number] | null {
  const m = /S(\d+)(?:\s*[–-]\s*S?(\d+))?/.exec(addr ?? "")
  return m ? [Number(m[1]), Number(m[2] ?? m[1])] : null
}

// ---------- what each rule shows ----------
export type Show = Status | "route"
export const SHOW: Record<Show, { label: string; tone: Tone; glyph: GlyphName }> = {
  ...STATUS,
  route: { label: "Other route", tone: "quiet", glyph: "dash" },
}
export interface Prepped extends Match { crit: Criterion; addr: string; show: Show }
const DUR = /\b\d+\s*(weeks?|months?|days?)\b/i
const isRouteKind = (k: string) => k === "indication" || k === "red_flag"

// A route rule that isn't the deciding one reads "Other route": on an appeal, another route is met; on a denial with
// no route met, only the route that states a wait keeps "Blocks" (one red mark for one reason).
export function prep(d: CaseDetail): Prepped[] {
  const run = d.run
  const byId = new Map((run.criteria ?? []).map((c) => [c.criterion_id, c]))
  const routeMet = run.verdict === "appeal"
  const out: Prepped[] = (run.matches ?? []).flatMap((m) => {
    const crit = byId.get(m.criterion_id)
    if (!crit) return []
    const show: Show = m.status === "not_met" && crit.kind === "indication" && routeMet ? "route" : m.status
    return [{ ...m, crit, addr: d.addresses[m.criterion_id] ?? "", show }]
  })
  if (!routeMet && !out.some((m) => isRouteKind(m.crit.kind) && m.status === "met")) {
    const w = out.find((m) => m.status === "not_met" && m.crit.kind === "indication" && DUR.test(m.crit.verbatim_span))
    if (w) out.forEach((m) => { if (m !== w && m.status === "not_met" && m.crit.kind === "indication") m.show = "route" })
  }
  return out
}
export const RANK: Record<Show, number> = { not_met: 0, missing_documentation: 1, met: 2, route: 3, not_applicable: 4 }
export const deciding = (ms: Prepped[]) => ms.filter((m) => m.show !== "not_applicable" && m.show !== "route")
export const blockersOf = (ms: Prepped[]) => ms.filter((m) => m.show === "not_met")

// ---------- waits, counted in code from the chart's own dates ----------
export interface Count { tone: Tone; glyph: GlyphName; text: string; word: string; n: number | null; need: number; fromCheck: boolean }

export function thresholdFor(d: CaseDetail, addr: string): Threshold | null {
  const r = sRange(addr)
  return r ? thresholdsOf(d).find((t) => t.sentence >= r[0] && t.sentence <= r[1]) ?? null : null
}

// The onset: this run's own, or the verified onset on the same chart's prior-auth check, counted to this service date.
function onset(d: CaseDetail, alt: Facts | null): { date: string; fromCheck: boolean } | null {
  const f = d.run.facts
  if (f?.onset) return { date: f.onset, fromCheck: false }
  if (alt?.onset) return { date: alt.onset, fromCheck: true }
  return null
}

// The glyph and word come from the comparison itself, so the line always agrees with the count: a check when the
// days reach the policy's wait, a cross and the shortfall when they don't.
export function countWait(d: CaseDetail, t: Threshold, alt: Facts | null): Count {
  const f = d.run.facts
  const dos = d.run.denial.dos
  const flags = f?.red_flags ?? []
  if (flags.length) {
    return { tone: "quiet", glyph: "dash", n: null, need: t.days, fromCheck: false, word: "Waived", text: `Red flag in the chart: ${flags.map((x) => x.flag).join(", ")}` }
  }
  if (t.from === "onset") {
    const o = onset(d, alt)
    if (!o) return { tone: "warn", glyph: "half", n: null, need: t.days, fromCheck: false, word: "Can't count", text: "No onset date in the chart" }
    const n = daysBetween(o.date, dos)
    const ok = n >= t.days
    return {
      tone: ok ? "pos" : "neg", glyph: ok ? "check" : "cross", n, need: t.days, fromCheck: o.fromCheck,
      word: ok ? "Meets the wait" : `Short by ${plural(t.days - n, "day")}`,
      text: `${plural(n, "day")} since onset on ${fmtDate(o.date)} · policy needs ${t.days}${o.fromCheck ? " (onset from the prior-auth check)" : ""}`,
    }
  }
  const n = f?.conservative_days
  if (n == null || !firstTreatmentStart(f)) {
    return { tone: "warn", glyph: "half", n: null, need: t.days, fromCheck: false, word: "Can't count", text: "No dated care in the chart" }
  }
  const ok = n >= t.days
  return {
    tone: ok ? "pos" : "neg", glyph: ok ? "check" : "cross", n, need: t.days, fromCheck: false,
    word: ok ? "Meets the wait" : `Short by ${plural(t.days - n, "day")}`,
    text: `${plural(n, "day")} of conservative care · policy needs ${t.days}`,
  }
}

// ---------- held denials ----------
const WAIT_WORDS = /\b(\d+|one|two|three|four|five|six|seven|eight|ten|twelve|first)\s+(weeks?|months?|days?)\b/i

// The earliest date the policy's waits are reached: the prior-auth check's (worked out in code), else counted here.
export function waitsReached(d: CaseDetail, check: CheckRow | null, alt: Facts | null): string | null {
  if (check?.earliest) return check.earliest
  const ends = thresholdsOf(d).flatMap((t) => {
    const from = t.from === "onset" ? onset(d, alt)?.date : firstTreatmentStart(d.run.facts)
    return from ? [addDays(from, t.days)] : []
  })
  return ends.length ? ends.sort()[ends.length - 1] : null
}

export interface Hold {
  early: boolean // every blocking rule is a wait the service date fell short of: no chart note can win it
  reached: string | null // when the waits are (or were) reached
  newOrder: string | null // the earliest a new order can qualify: never before the review date
  docs: Prepped[] // blocking rules a dated chart note could meet
  waits: Prepped[] // blocking waits no note can change
  blockers: Prepped[]
}
export function hold(d: CaseDetail, ms: Prepped[], check: CheckRow | null, alt: Facts | null): Hold {
  const blockers = blockersOf(ms)
  const reached = waitsReached(d, check, alt)
  const dos = d.run.denial.dos
  const afterDos = !!reached && reached > dos
  const timeBound = (m: Prepped) => afterDos && (!!thresholdFor(d, m.addr) || WAIT_WORDS.test(m.crit.verbatim_span))
  const waits = blockers.filter(timeBound)
  const docs = blockers.filter((m) => !timeBound(m))
  const early = d.run.verdict === "dont_appeal" && blockers.length > 0 && docs.length === 0 && afterDos
  const newOrder = reached ? (reached > d.as_of ? reached : d.as_of) : null
  return { early, reached, newOrder, docs, waits, blockers }
}

// ---------- the note to the physician for a held denial a dated note could win ----------
export function physicianNote(d: CaseDetail, h: Hold, alt: Facts | null) {
  const den = d.run.denial
  const p = policyOf(d)
  const pid = p ? policyHuman(p) : "the payer's policy"
  const items = h.docs.map((m) => {
    const t = thresholdFor(d, m.addr)
    const k = t ? countWait(d, t, alt) : null
    return { pid, addr: m.addr || m.criterion_id, quote: squash(m.crit.verbatim_span), count: k && k.n != null ? `From the chart's dates: ${k.text}, ${lc1(k.word)}.` : "" }
  })
  const title = `Documentation request · ${d.patient}`
  const intro = [
    `Lumbar MRI, CPT ${den.cpt}, service date ${fmtDate(den.dos)}. ${shortPayer(den.payer_name)} denied it: "${squash(den.reason_text)}"`,
    `Policy in force on the service date: ${pid}.`,
    `The chart doesn't show the rules below are met. If your notes dated on or before ${fmtDate(den.dos)} document them, please send those notes.`,
    "Send only notes written at the time of care; don't add or amend entries after the fact.",
  ]
  const outro = [...(d.deadline?.due ? [`Appeal window closes ${fmtDate(d.deadline.due)} (${d.deadline.citation}).`] : []), "Synthetic case. A person reviews and sends this note."]
  const plain = [title, intro[0], intro[1], "", intro[2], intro[3], "",
    ...items.flatMap((it, i) => [`${i + 1}. ${it.pid}, ${sec(it.addr) || it.addr}: "${it.quote}"`, ...(it.count ? [`   ${it.count}`] : []), ""]),
    ...outro].join("\n")
  return { title, intro, items, outro, plain }
}

// ---------- plain text for the file / the patient ----------
export const carcLine = (d: CaseDetail) => (d.run.denial.carc.length ? `Reason code ${d.run.denial.carc.join(", ")}` : "No reason code")
export const carcMeaning = (d: CaseDetail) => (d.run.triage.explanation || d.run.denial.reason_text || "").split(/(?<=\.)\s+/)[0].replace(/\.\s*$/, "")
export const insteadOf = (d: CaseDetail) =>
  (d.run.triage.explanation || "").split(/(?<=\.)\s+/).slice(1).filter((t) => !/won't change the outcome/i.test(t)).join(" ")

export function patientNote(d: CaseDetail) {
  const den = d.run.denial
  return [
    `Your plan, ${shortPayer(den.payer_name)}, did not pay for the lumbar MRI on ${fmtDate(den.dos)}.`,
    `The reason it gave: "${squash(den.reason_text)}"`,
    "This is a rule of your plan, not a judgment about your medical need, so sending more medical records won't change it.",
    "We'll check whether another insurer or a covered option applies, and talk it through with you.",
  ].join("\n\n")
}
export function fixPlain(d: CaseDetail, done: Set<number>) {
  return [`Fix checklist · ${d.patient}`, `Flagged because ${carcLine(d)}: ${lc1(carcMeaning(d))}.`,
    ...d.run.triage.checklist.map((t, i) => `${done.has(i) ? "[x]" : "[ ]"} ${i + 1}. ${t}`)].join("\n")
}
export function reorderPlain(d: CaseDetail, h: Hold) {
  const den = d.run.denial
  return [`Reorder, don't appeal · ${d.patient}`,
    `The ${fmtDate(den.dos)} service came before the policy's waiting periods ended (reached ${h.reached ? fmtDate(h.reached) : "later"}), so no chart note can win this denial.`,
    h.newOrder ? `A new order can qualify from ${fmtDate(h.newOrder)}${h.newOrder === d.as_of ? " (the review date)" : ""}.` : "",
    "Counted from the dates in the chart. A person decides and places the order."].filter(Boolean).join("\n")
}

// ---------- copy ----------
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.opacity = "0"
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand("copy")
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

// ---------- the worklist's view of a held denial ----------
// The same computation the case view runs (hold() on the same cached answers), so the queue and the case agree on
// "Don't appeal yet" versus "Reorder, don't appeal".
export async function heldEarly(id: string): Promise<boolean> {
  const d = await getCase(id)
  if (d.run.verdict !== "dont_appeal") return false
  const list = await getJSON<{ checks: CheckRow[] }>("/api/checks").catch(() => null)
  const row = list?.checks.find((c) => c.id === id) ?? null
  const full = row ? await getJSON<CheckFull>(`/api/checks/${id}`).catch(() => null) : null
  return hold(d, prep(d), row, full?.check.facts ?? null).early
}
