// The case's reference panes: the rules (coverage path, rule rows, waiting periods counted from chart dates), the
// policy reader, the chart notes and the denial notice. Plain words for a biller; the mechanics live on How it works.
import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react"
import { EASE_ENTER, EASE_OUT } from "@/lib/motion"
import { PLAN, daysBetween, fmtDate, noteKind, policyHuman, sec, secLong, shortPayer, toT, type CaseDetail, type Facts, type GlyphName, type Tone } from "@/lib/data"
import { Glyph, Mark } from "@/features/ui"
import { RuleRow } from "./parts"
import {
  RANK, SHOW, capFirst, carcLine, carcMeaning, countWait, deciding, denialOf, notesOf, policyOf, thresholdFor, thresholdsOf,
  type Prepped, type Show,
} from "./model"

export type Focus = { kind: "policy"; n: number; at: number } | { kind: "note"; id: string; at: number } | { kind: "rule"; id: string; at: number }

// Scroll a focused element into view and flash it once.
function useFocusEl(sel: string | null, at: number | undefined) {
  useEffect(() => {
    if (!sel) return
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(sel)
      if (!el) return
      el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
      el.classList.remove("is-flash")
      void el.offsetWidth
      el.classList.add("is-flash")
    }, 80)
    return () => window.clearTimeout(t)
  }, [sel, at])
}

// ================= Rules =================
const STAGES = [
  { key: "routes", title: "Route to coverage", kinds: ["indication", "red_flag"] },
  { key: "waits", title: "Waiting periods", kinds: ["duration"] },
  { key: "limits", title: "Restrictions", kinds: ["exclusion"] },
  { key: "docs", title: "Documentation", kinds: ["documentation"] },
]
type Res = { tone: Tone; glyph: GlyphName; word: string }
const R = {
  ok: (word: string): Res => ({ tone: "pos", glyph: "check", word }),
  bad: (word: string): Res => ({ tone: "neg", glyph: "cross", word }),
  warn: (word: string): Res => ({ tone: "warn", glyph: "half", word }),
  mute: (word: string): Res => ({ tone: "quiet", glyph: "dash", word }),
}

export function RulesPane({ d, ms, alt, onPolicy, onNote, focus }: { d: CaseDetail; ms: Prepped[]; alt: Facts | null; onPolicy: (n: number) => void; onNote: (id: string) => void; focus: Focus | null }) {
  const live = useMemo(() => deciding(ms).sort((a, b) => RANK[a.show] - RANK[b.show] || Number(b.confidence === "escalated") - Number(a.confidence === "escalated")), [ms])
  const quiet = ms.filter((m) => !live.includes(m))
  const firstOpen = live.find((m) => m.show === "not_met" || m.show === "missing_documentation")?.criterion_id ?? null
  const [open, setOpen] = useState<string | null>(firstOpen)
  const [showQuiet, setShowQuiet] = useState(false)
  const crit = (m: Prepped) => m.crit
  const count = (m: Prepped) => {
    const t = thresholdFor(d, m.addr)
    return t ? countWait(d, t, alt) : null
  }
  const ruleFocus = focus?.kind === "rule" ? focus : null
  useEffect(() => {
    if (!ruleFocus) return
    setOpen(ruleFocus.id)
    if (!live.some((m) => m.criterion_id === ruleFocus.id)) setShowQuiet(true)
  }, [ruleFocus, live])
  useFocusEl(ruleFocus ? `[data-rule="${ruleFocus.id}"]` : null, ruleFocus?.at)
  const jump = (id: string) => {
    setOpen(id)
    if (!live.some((m) => m.criterion_id === id)) setShowQuiet(true)
    window.setTimeout(() => document.querySelector(`[data-rule="${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60)
  }

  if (!ms.length) return <NoRules d={d} />
  return (
    <div className="pane">
      <Coverage d={d} ms={ms} alt={alt} onChip={jump} />
      <section className="cd-sec" aria-label="Policy rules">
        <div className="cd-sec-h">
          <h3>Rules that decide it</h3>
          <span className="cd-sec-a">
            {live.length} deciding · {quiet.length} don't apply
          </span>
        </div>
        <ul className="rules">
          {live.map((m, i) => (
            <RuleRow key={m.criterion_id} d={d} m={m} c={crit(m)} index={i} show={SHOW[m.show]} count={count(m)} open={open === m.criterion_id} onToggle={() => setOpen(open === m.criterion_id ? null : m.criterion_id)} onPolicy={onPolicy} onNote={onNote} />
          ))}
          {showQuiet &&
            quiet.map((m, i) => (
              <RuleRow key={m.criterion_id} d={d} m={m} c={crit(m)} index={i} show={SHOW[m.show]} open={open === m.criterion_id} onToggle={() => setOpen(open === m.criterion_id ? null : m.criterion_id)} onPolicy={onPolicy} onNote={onNote} />
            ))}
        </ul>
        {quiet.length > 0 && (
          <button type="button" className="textbtn" onClick={() => setShowQuiet(!showQuiet)} aria-expanded={showQuiet}>
            {showQuiet ? "Hide" : "Show"} the {quiet.length} rules that don't decide this case
          </button>
        )}
      </section>
      <Waits d={d} alt={alt} onPolicy={onPolicy} />
    </div>
  )
}

function NoRules({ d }: { d: CaseDetail }) {
  return (
    <div className="pane">
      <section className="cd-sec">
        <div className="cd-sec-h">
          <h3>{d.run.verdict === "fix_checklist" ? "Why no medical-necessity appeal" : "Why no clinical appeal"}</h3>
        </div>
        <p className="cd-body">
          {carcLine(d)} means {carcMeaning(d).toLowerCase() || "an administrative reason"}. That's{" "}
          {d.run.verdict === "fix_checklist" ? "an administrative reason" : "a plan exclusion"}, not a judgment on the chart, so no policy rules were checked.
        </p>
      </section>
    </div>
  )
}

function Coverage({ d, ms, alt, onChip }: { d: CaseDetail; ms: Prepped[]; alt: Facts | null; onChip: (id: string) => void }) {
  const cells = STAGES.map((st) => {
    const all = ms.filter((m) => st.kinds.includes(m.crit.kind))
    const on = all.filter((m) => m.show !== "route")
    const has = (s: Show) => on.some((m) => m.show === s)
    let res: Res
    let chips = on.filter((m) => m.show !== "not_applicable")
    if (st.key === "routes") res = has("met") ? R.ok("Qualifies") : has("not_met") ? R.bad("No route met") : R.warn("Not shown")
    else if (st.key === "waits") {
      res = has("not_met") ? R.bad("Not met") : has("missing_documentation") ? R.warn("Undocumented") : has("met") ? R.ok("Met") : R.mute("Waived or not relevant")
      // A wait that sits inside a route rule ("no improvement after 6 weeks"): name it with the days counted in code.
      if (!on.length && d.run.verdict !== "appeal") {
        const w = ms.find((m) => m.show === "not_met" && thresholdFor(d, m.addr))
        const t = w && thresholdFor(d, w.addr)
        if (w && t) {
          const k = countWait(d, t, alt)
          res = k.n != null ? { tone: k.tone, glyph: k.glyph, word: `${k.n} days · needs ${k.need}` } : R.bad("Not met")
          chips = [w]
        }
      }
    } else if (st.key === "limits") res = has("not_met") ? R.bad("Applies") : on.length ? R.ok("None apply") : R.mute("None listed")
    else res = has("missing_documentation") ? R.warn("Gaps") : has("not_met") ? R.bad("Not met") : has("met") ? R.ok("Complete") : R.mute("None listed")
    return { ...st, res, chips }
  })
  return (
    <section className="cov" aria-label="Coverage path">
      <div className="cov-h">
        <span className="lbl">Coverage path</span>
      </div>
      <ol className="cov-l">
        {cells.map((c, i) => (
          <motion.li key={c.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_ENTER, delay: 0.05 * i }}>
            <span className="cov-t">{c.title}</span>
            <Mark tone={c.res.tone} glyph={c.res.glyph} label={c.res.word} size={14} />
            {c.chips.length > 0 && (
              <span className="cov-c">
                {c.chips.slice(0, 4).map((m) => (
                  <button key={m.criterion_id} type="button" className="chip" onClick={() => onChip(m.criterion_id)} title={`${secLong(d.run.policy, m.addr)}: ${m.crit.summary}`}>
                    {sec(m.addr) || "Rule"}
                  </button>
                ))}
                {c.chips.length > 4 && <span className="cov-more num">+{c.chips.length - 4}</span>}
              </span>
            )}
          </motion.li>
        ))}
      </ol>
    </section>
  )
}

function Waits({ d, alt, onPolicy }: { d: CaseDetail; alt: Facts | null; onPolicy: (n: number) => void }) {
  const ts = thresholdsOf(d)
  if (!d.run.facts || !ts.length) return null
  return (
    <section className="cd-sec" aria-label="Waiting periods">
      <div className="cd-sec-h">
        <h3>Waiting periods</h3>
        <span className="cd-sec-a">Counted from the dates in the chart</span>
      </div>
      <ul className="thr">
        {ts.map((t) => {
          const k = countWait(d, t, alt)
          return (
            <li key={t.label}>
              <span className="thr-l">
                {t.label}
                <span className="thr-x">{k.text}</span>
              </span>
              <button type="button" className="chip" onClick={() => onPolicy(t.sentence)} title={secLong(d.run.policy, `S${t.sentence}`)}>
                §{t.sentence}
              </button>
              <Mark tone={k.tone} glyph={k.glyph} label={k.word} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ================= Policy reader =================
const isHeading = (t: string) => !/[.:;)”"]$/.test(t.trim()) && t.length < 70 && !t.trim().startsWith("•")

export function PolicyPane({ d, ms, focus }: { d: CaseDetail; ms: Prepped[]; focus: Focus | null }) {
  const p = policyOf(d)!
  const show = useMemo(() => new Map(ms.map((m) => [m.criterion_id, m])), [ms])
  const sel = focus?.kind === "policy" ? focus.n : null
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const S = d.sentences
  const pick = (crits: string[]) =>
    crits
      .map((c) => show.get(c))
      .filter((m): m is Prepped => !!m && m.show !== "not_applicable")
      .sort((a, b) => RANK[a.show] - RANK[b.show])[0] ?? null
  // Rows: headings, sentences, and folds of three or more sentences that carry no rule.
  type RowT = { k: "h"; s: string; n: number } | { k: "s"; i: number } | { k: "f"; key: string; from: number; to: number; count: number }
  const rows = useMemo(() => {
    const out: RowT[] = []
    let lastH = ""
    for (let i = 0; i < S.length; i++) {
      const s = S[i]
      if (isHeading(s.text)) {
        if (s.text.trim() !== lastH) out.push({ k: "h", s: s.text.trim(), n: s.n })
        lastH = s.text.trim()
        continue
      }
      if (!pick(s.criteria)) {
        let j = i
        while (j + 1 < S.length && !pick(S[j + 1].criteria) && !isHeading(S[j + 1].text)) j++
        const key = `f${s.n}`
        const holdsSel = sel != null && sel >= s.n && sel <= S[j].n
        if (j - i >= 2 && !expanded.has(key) && !holdsSel) {
          out.push({ k: "f", key, from: s.n, to: S[j].n, count: j - i + 1 })
          i = j
          continue
        }
      }
      out.push({ k: "s", i })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S, expanded, sel, show])
  useFocusEl(sel != null ? `.ps[data-s="${sel}"]` : null, focus?.at)
  let host = ""
  try {
    host = new URL(p.url).hostname.replace(/^www\./, "")
  } catch {
    host = "the payer's site"
  }
  const fetched = p.fetched_at ? fmtDate(p.fetched_at.slice(0, 10)) : null
  const via =
    p.version_basis === "api-versioned" ? "From Medicare's coverage database: the version in effect on the service date."
      : `Copied from ${host}${fetched ? ` on ${fetched}` : ""}. The payer's page has no version history, so this copy is what was checked.`
  return (
    <div className="pane">
      <header className="pol-h">
        <h3>{p.title}</h3>
        <p className="pol-m">
          <span>{policyHuman(p)}</span>
          <span>effective {fmtDate(p.effective_from)}</span>
          <a className="textlink" href={p.url} target="_blank" rel="noreferrer">
            Open on the payer's site <ArrowUpRight size={12} strokeWidth={1.8} />
          </a>
        </p>
        <p className="pol-v">{via}</p>
      </header>
      <div className="pol" role="list" aria-label="Policy sentences">
        {rows.map((r) => {
          if (r.k === "h") return <h4 key={`h${r.n}`} className="pol-hd">{r.s}</h4>
          if (r.k === "f")
            return (
              <button key={r.key} type="button" className="pol-fold" onClick={() => setExpanded(new Set(expanded).add(r.key))}>
                <span className="num">§{r.from}–{r.to}</span>
                <span>{r.count} sentences of background</span>
                <b>Show</b>
              </button>
            )
          const s = S[r.i]
          const m = pick(s.criteria)
          const st = m ? SHOW[m.show] : null
          const on = sel === s.n
          return (
            <div key={s.n} role="listitem" className={`ps ${m ? "is-rule" : ""} ${on ? "is-sel" : ""}`} data-s={s.n}>
              <span className="ps-g">
                <span className="ps-n num">§{s.n}</span>
                {st && (
                  <span className={`ps-st t-${st.tone}`}>
                    <Glyph name={st.glyph} size={12} />
                    <span>{st.label}</span>
                  </span>
                )}
              </span>
              <span className={`ps-t ${st ? `hl-${st.tone}` : ""}`}>{s.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ================= Chart =================
export function ChartPane({ d, ms, alt, focus, onPolicy }: { d: CaseDetail; ms: Prepped[]; alt: Facts | null; focus: Focus | null; onPolicy: (n: number) => void }) {
  const notes = notesOf(d)
  const sel = focus?.kind === "note" ? focus.id : null
  useFocusEl(sel ? `[data-note="${sel}"]` : null, focus?.at)
  return (
    <div className="pane">
      <Timeline d={d} alt={alt} />
      <section className="cd-sec" aria-label="Chart notes">
        <div className="cd-sec-h">
          <h3>Chart notes</h3>
          <span className="cd-sec-a">{notes.length} notes · synthetic patient · highlighted lines are the ones the rules quote</span>
        </div>
        <div className="notes">
          {notes.map((n, i) => {
            const marks: { a: number; b: number; m: Prepped }[] = []
            ms.forEach((m) =>
              m.evidence.forEach((e) => {
                if (e.verified && e.note_id === n.note_id && e.start != null && e.end != null && m.show !== "not_applicable") marks.push({ a: e.start, b: e.end, m })
              }),
            )
            marks.sort((x, y) => x.a - y.a || RANK[x.m.show] - RANK[y.m.show])
            const parts: ReactNode[] = []
            let at = 0
            marks.forEach((mk, j) => {
              if (mk.a < at) return
              const st = SHOW[mk.m.show]
              const r = /S(\d+)/.exec(mk.m.addr)
              parts.push(<Fragment key={`t${j}`}>{n.text.slice(at, mk.a)}</Fragment>)
              parts.push(
                <mark key={`m${j}`} className={`nq hl-${st.tone}`}>
                  {n.text.slice(mk.a, mk.b)}
                </mark>,
              )
              parts.push(
                <button key={`b${j}`} type="button" className={`nq-tag t-${st.tone}`} onClick={() => r && onPolicy(Number(r[1]))} title={`${st.label}: ${mk.m.crit.summary} (${secLong(d.run.policy, mk.m.addr)})`}>
                  <Glyph name={st.glyph} size={11} />
                  <span>{st.label} {sec(mk.m.addr)}</span>
                </button>,
              )
              at = mk.b
            })
            parts.push(<Fragment key="end">{n.text.slice(at)}</Fragment>)
            return (
              <motion.article key={n.note_id} className="note" data-note={n.note_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_ENTER, delay: Math.min(i, 6) * 0.05 }}>
                <p className="note-h">
                  <b>{fmtDate(n.date)}</b>
                  <span>{noteKind(n.note_type)}</span>
                  <span>{capFirst(n.author_role)}</span>
                </p>
                <p className="note-b">{parts}</p>
              </motion.article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Timeline({ d, alt }: { d: CaseDetail; alt: Facts | null }) {
  const f = d.run.facts
  if (!f) return null
  const onsetIso = f.onset ?? alt?.onset ?? null
  const dated = f.treatments.filter((t) => t.start && t.end)
  if (!onsetIso && !dated.length && !f.red_flags.length) return null
  const dos = toT(d.run.denial.dos)
  const onset = onsetIso ? toT(onsetIso) : null
  const starts = dated.map((t) => toT(t.start!))
  const firstTx = starts.length ? Math.min(...starts) : null
  const lines = thresholdsOf(d).flatMap((t) => {
    const base = t.from === "onset" ? onset : firstTx
    if (base == null) return []
    const k = countWait(d, t, alt)
    return [{ t, at: base + t.days * 864e5, k }]
  })
  const pts = [onset, ...starts, ...f.red_flags.map((r) => (r.noted_on ? toT(r.noted_on) : null)), dos].filter((x): x is number => x != null)
  const lo = Math.min(...pts) - 4 * 864e5
  const hi = Math.max(dos, ...lines.map((l) => l.at)) + 6 * 864e5
  const pct = (ms: number) => ((ms - lo) / (hi - lo)) * 100
  const months: number[] = []
  const dt = new Date(lo)
  dt.setUTCDate(1)
  dt.setUTCMonth(dt.getUTCMonth() + 1)
  while (dt.getTime() < hi) {
    months.push(dt.getTime())
    dt.setUTCMonth(dt.getUTCMonth() + 1)
  }
  const sorted = [...lines].sort((a, b) => a.at - b.at)
  const row = new Map(sorted.map((l, i) => [l, i > 0 && pct(l.at) - pct(sorted[i - 1].at) < 26 ? 1 : 0]))
  return (
    <section className="tl" aria-label="Chart timeline">
      <div className="cd-sec-h">
        <h3>Timeline</h3>
        <span className="cd-sec-a">
          {f.symptom_days != null ? `Onset to MRI ${f.symptom_days} days · ` : ""}conservative care {f.conservative_days ?? 0} days
        </span>
      </div>
      <div className="tl-track" style={{ height: 64 + dated.length * 30 + 44 }}>
        {lines.map((l) => (
          <span key={l.t.label} className={`tl-line t-${l.k.tone} ${pct(l.at) > 60 ? "is-flip" : ""}`} style={{ left: `${pct(l.at)}%`, ["--row" as string]: row.get(l) }}>
            <span className="tl-line-l">
              <Glyph name={l.k.glyph} size={11} /> {l.t.label}
            </span>
          </span>
        ))}
        {dated.map((t, i) => {
          const a = pct(toT(t.start!))
          const b = pct(toT(t.end!))
          return (
            <motion.span
              key={i}
              className="tl-bar"
              style={{ left: `${a}%`, width: `${b - a}%`, top: 56 + i * 30 }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, ease: EASE_ENTER, delay: 0.1 + i * 0.08 }}
            >
              <span className={a > 55 ? "is-left" : ""}>
                {capFirst(t.kind)} · {daysBetween(t.start!, t.end!)} days{t.sessions ? ` · ${t.sessions} sessions` : ""}
              </span>
            </motion.span>
          )
        })}
        <span className="tl-axis" />
        {months.map((ms, i) => (
          <span key={ms} className="tl-mo num" style={{ left: `${pct(ms)}%` }}>
            {new Date(ms).toLocaleString("en-US", { month: "short", timeZone: "UTC", ...(i === 0 ? { year: "numeric" } : {}) })}
          </span>
        ))}
        {f.red_flags.filter((r) => r.noted_on).map((r, i) => (
          <span key={i} className="tl-flag t-neg" style={{ left: `${pct(toT(r.noted_on!))}%` }} title={r.flag}>
            <Glyph name="cross" size={11} />
          </span>
        ))}
        {onset != null && (
          <span className={`tl-pt ${pct(onset) < 14 ? "is-start" : ""}`} style={{ left: `${pct(onset)}%` }}>
            <b>Onset</b> {fmtDate(onsetIso!, false)}
          </span>
        )}
        <span className={`tl-pt is-dos ${pct(dos) > 86 ? "is-end" : ""}`} style={{ left: `${pct(dos)}%` }}>
          <b>MRI</b> {fmtDate(d.run.denial.dos, false)}
        </span>
      </div>
      {f.red_flags.length > 0 && <p className="tl-note">Red flags in the chart: {f.red_flags.map((r) => r.flag).join(", ")}. The waits don't apply.</p>}
    </section>
  )
}

// ================= Denial notice =================
export function NoticePane({ d }: { d: CaseDetail }) {
  const den = denialOf(d)
  const [loaded, setLoaded] = useState(false)
  const rows: [string, ReactNode][] = [
    ["Payer", shortPayer(den.payer_name)],
    ["Plan", PLAN[den.plan_type] ?? den.plan_type],
    ["CPT", <span className="num">{den.cpt}</span>],
    ["Diagnosis (ICD-10)", <span className="num">{(den.icd10 ?? []).join(", ") || "Not given"}</span>],
    ["Service date", fmtDate(den.dos)],
    ["Notice date", fmtDate(den.notice_date)],
    ["Reason code", <span>{den.carc.length ? `${den.carc.join(", ")}: ${carcMeaning(d).toLowerCase()}` : "Not given"}</span>],
    ["Payer's reason", <q>{den.reason_text}</q>],
  ]
  return (
    <div className="pane">
      <div className="ntc">
        <figure className="ntc-f">
          <div className="ntc-scroll" tabIndex={0} role="region" aria-label="Denial letter scan, scrolls">
            {!loaded && <span className="sk ntc-sk" aria-hidden="true" />}
            <motion.img
              src={`/api/cases/${d.id}/letter`}
              alt={`Synthetic faxed denial notice for ${d.patient}`}
              onLoad={() => setLoaded(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: loaded ? 1 : 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
            />
          </div>
          <figcaption>Fictional test notice, not issued by any insurer.</figcaption>
        </figure>
        <div className="ntc-d">
          <p className="lbl">Read from the scan</p>
          <dl>
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="ntc-by">
            <Glyph name="check" size={12} className="t-ink" /> Read from the scanned letter. Check it against the paper copy if anything looks off.
          </p>
        </div>
      </div>
    </div>
  )
}
