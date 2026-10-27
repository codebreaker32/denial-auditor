// Mockup b, "Mercury warmth": the Denial Auditor inbox on a warm stone ground, a deep forest rail and hero card,
// cream surfaces with layered shadows, large light figures that count up, and visuals drawn from the API.
import { LayoutGroup, MotionConfig, motion } from "framer-motion"
import { ArrowLeft, ArrowUpRight, ClipboardCheck, Copy, Inbox, PlayCircle, CircleHelp } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { TooltipProvider } from "@/components/skiper/skiper101"
import "./b.css"
import {
  ORDER, PLAN, RULE_NAME, STATUS, STATUS_ORDER, VERDICT, coverage, daysBetween, fmtDate, noteDate, parseHashCase, shortPayer,
  thresholdStates, tooEarly, traceGroups, usd, usd4, verdictView,
  type CaseDetail, type CasesResp, type Drift, type Match, type Verdict,
} from "./data"
import { CoverageRing, DeadlineRing, EASE, Figure, Glyph, Mark, Runway, StakeBar, Timeline, Trace } from "./viz"

function useIsPhone() {
  const q = "(max-width: 899px)"
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return m
}

const NAV = [
  { key: "worklist", label: "Worklist", icon: Inbox },
  { key: "checks", label: "Prior-auth checks", short: "Prior-auth", icon: ClipboardCheck },
  { key: "live", label: "Run live", icon: PlayCircle },
  { key: "how", label: "How it works", short: "How it works", icon: CircleHelp },
]

function BrandMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" className="b-brand">
      <rect x="1" y="1" width="32" height="32" rx="10" className="b-brand-bg" />
      <path d="M11 9.5h8.5l4 4V24a1 1 0 0 1-1 1H11a1 1 0 0 1-1-1V10.5a1 1 0 0 1 1-1Z" className="b-brand-doc" />
      <path d="M13.6 18.2l2.4 2.4 4.6-5" className="b-brand-tick" />
    </svg>
  )
}

export default function Comp() {
  const [list, setList] = useState<CasesResp | null>(null)
  const [details, setDetails] = useState<Record<string, CaseDetail>>({})
  const [drift, setDrift] = useState<Drift | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<string>(() => parseHashCase() ?? "case_031")
  const [filter, setFilter] = useState<Verdict | null>(null)
  const [phoneView, setPhoneView] = useState<"list" | "detail">(() => (/[?&]view=detail/.test(window.location.hash) ? "detail" : "list"))
  const phone = useIsPhone()

  useEffect(() => {
    let live = true
    fetch("/api/cases")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`cases ${r.status}`))))
      .then((d: CasesResp) => {
        if (!live) return
        setList(d)
        d.cases.forEach((c) =>
          fetch(`/api/cases/${c.id}`)
            .then((r) => r.json())
            .then((x: CaseDetail) => live && setDetails((p) => ({ ...p, [c.id]: x })))
            .catch(() => {}),
        )
      })
      .catch((e) => live && setErr(String(e.message ?? e)))
    fetch("/api/drift")
      .then((r) => r.json())
      .then((d: Drift) => live && setDrift(d))
      .catch(() => live && setDrift({ checked_at: null, items: [] }))
    return () => {
      live = false
    }
  }, [])

  const rows = useMemo(() => {
    if (!list) return []
    // Ready to act first (the fixed recommendation order), then the nearest deadline.
    return [...list.cases].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict) || a.days_left - b.days_left)
  }, [list])
  const shown = filter ? rows.filter((r) => r.verdict === filter) : rows
  const total = rows.reduce((s, r) => s + r.billed_usd, 0)
  const pick = (id: string) => {
    setSel(id)
    if (phone) {
      setPhoneView("detail")
      window.scrollTo({ top: 0 })
    }
  }
  const d = details[sel]
  const row = rows.find((r) => r.id === sel)

  const watch = useMemo(() => {
    if (!drift) return null
    const den = drift.items
    const affected = den.filter((i) => i.affects_case).length
    return { n: den.length, affected, at: drift.checked_at }
  }, [drift])

  const showList = !phone || phoneView === "list"
  const showDetail = !phone || phoneView === "detail"

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={80}>
        <div className="b-root">
          {/* ---------- nav rail (desktop) / top bar (phone) ---------- */}
          <nav className="b-rail" aria-label="Main">
            <div className="b-rail-brand">
              <BrandMark />
              <span className="b-rail-name">Denial Auditor</span>
            </div>
            <ul className="b-rail-nav">
              {NAV.map((n) => (
                <li key={n.key}>
                  <a href="#/comp/b" className="b-rail-item" aria-current={n.key === "worklist" ? "page" : undefined} onClick={(e) => e.preventDefault()}>
                    <n.icon size={19} strokeWidth={1.6} aria-hidden="true" />
                    <span>{phone ? (n.short ?? n.label) : n.label}</span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="b-rail-foot">Road House</div>
          </nav>

          <div className="b-main">
            <div className="b-notice" role="note">
              <span className="b-notice-l">
                <b>Synthetic data — no real patients.</b>
                <span className="b-notice-d">Review date {list ? fmtDate(list.as_of) : "…"} on the demo calendar.</span>
              </span>
              {watch && (
                <span className="b-notice-r">
                  <Glyph name={watch.affected ? "half" : "check"} size={13} />
                  <span>
                    {watch.affected
                      ? `Policy watch: ${watch.affected} cited ${watch.affected === 1 ? "policy has" : "policies have"} changed`
                      : `Policy watch: all ${watch.n} cited policy versions current`}
                    {watch.at && <span className="b-notice-d">, checked {fmtDate(watch.at.slice(0, 10), false)}</span>}
                  </span>
                </span>
              )}
            </div>

            <div className="b-panes">
              {/* ---------- queue ---------- */}
              {showList && (
                <section className="b-queue" aria-label="Denials">
                  <header className="b-q-head">
                    <h1>Denials</h1>
                    <span className="b-q-count">{rows.length ? `${rows.length} open` : ""}</span>
                  </header>

                  <div className="b-card b-sum">
                    <p className="b-label">At stake across the queue</p>
                    <div className="b-sum-fig">
                      <Figure value={total} currency className="b-fig-xl" />
                    </div>
                    <p className="b-caption">Billed amounts on synthetic claims, by recommendation</p>
                    {rows.length > 0 && <StakeBar rows={rows} filter={filter} onFilter={setFilter} />}
                    <div className="b-sum-rw">
                      <p className="b-label">Deadline runway <span className="b-label-q">days left · dot size is the amount</span></p>
                      {rows.length > 0 && <Runway rows={rows} selected={sel} onSelect={pick} />}
                    </div>
                  </div>

                  <div className="b-q-listhead">
                    <span>{filter ? `${VERDICT[filter].label} · ${shown.length} of ${rows.length}` : "Ready to act first, then nearest deadline"}</span>
                    {filter && (
                      <button type="button" className="b-linkbtn" onClick={() => setFilter(null)}>
                        Show all
                      </button>
                    )}
                  </div>
                  {err && <p className="b-err">Couldn't load the denials ({err}). Is the API on port 8600 running?</p>}
                  {!list && !err && <div className="b-skel" aria-hidden="true" />}
                  <LayoutGroup id="queue">
                    <ul className="b-rows">
                      {shown.map((r, i) => {
                        const det = details[r.id]
                        const v = verdictView(r.verdict, det ? tooEarly(det) : false)
                        const on = r.id === sel && !phone
                        return (
                          <motion.li
                            key={r.id}
                            layout="position"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, ease: EASE, delay: 0.15 + i * 0.045 }}
                          >
                            <button type="button" className={`b-row ${on ? "is-sel" : ""}`} onClick={() => pick(r.id)} aria-current={on ? "true" : undefined}>
                              {on && <motion.span layoutId="b-row-sel" className="b-row-bg" transition={{ type: "spring", stiffness: 420, damping: 38 }} />}
                              <span className={`b-ava t-${v.tone}`} aria-hidden="true">{initials(r.patient)}</span>
                              <span className="b-row-a">
                                <span className="b-row-name">{r.patient}</span>
                                <span className="b-row-amt">{usd(r.billed_usd)}</span>
                              </span>
                              <span className="b-row-b">
                                <Mark tone={v.tone} glyph={v.glyph} label={v.label} />
                                <span className="b-row-payer">{shortPayer(r.payer)}</span>
                                <span className={`b-row-days ${r.days_left <= 45 ? "is-soon" : ""}`}>
                                  {r.days_left} <span>days</span>
                                </span>
                              </span>
                            </button>
                          </motion.li>
                        )
                      })}
                    </ul>
                  </LayoutGroup>
                  {phone && <Legal />}
                </section>
              )}

              {/* ---------- detail ---------- */}
              {showDetail && (
                <section className="b-detail" aria-label="Selected denial">
                  {phone && (
                    <button type="button" className="b-back" onClick={() => setPhoneView("list")}>
                      <ArrowLeft size={16} strokeWidth={1.8} /> Denials
                    </button>
                  )}
                  {d && row ? (
                    <motion.div
                      key={sel}
                      initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.42, ease: EASE }}
                    >
                      <Detail d={d} drift={drift} />
                    </motion.div>
                  ) : (
                    <div className="b-skel b-skel-d" aria-hidden="true" />
                  )}
                  <Legal />
                </section>
              )}
            </div>
          </div>
        </div>
      </TooltipProvider>
    </MotionConfig>
  )
}

// Two letters for the row's monogram, tinted by its recommendation.
function initials(name: string) {
  const p = name.split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] ?? "") + (p[p.length - 1]?.[0] ?? "")).toUpperCase()
}

function Legal() {
  return (
    <footer className="b-legal">
      <p>
        <b>A person reviews and sends every appeal.</b> The tool never submits anything. Decision support, not legal or medical advice.
      </p>
      <p>CPT © American Medical Association. All rights reserved.</p>
      <p>Policy reading by NVIDIA Nemotron on Nebius Token Factory. Payer policy located with Tavily.</p>
    </footer>
  )
}

// ======================= detail pane =======================
function Detail({ d, drift }: { d: CaseDetail; drift: Drift | null }) {
  const run = d.run
  const den = run.denial
  const early = tooEarly(d)
  const v = verdictView(run.verdict, early)
  const cov = coverage(run.matches)
  const windowDays = Math.max(1, daysBetween(den.notice_date, d.deadline.due))
  const watch = drift?.items.find((i) => i.case_id === d.id && i.kind === "denial")
  const groups = traceGroups(run.trace ?? [])
  const clinical = !!run.matches?.length

  return (
    <div className="b-d">
      <header className="b-d-head">
        <h2>{d.patient}</h2>
        <div className="b-d-acts">
          {run.policy && (
            <a className="b-btn b-btn-ghost" href={run.policy.url} target="_blank" rel="noreferrer">
              {policyLabel(run.policy)} <ArrowUpRight size={14} strokeWidth={1.8} />
            </a>
          )}
          <button type="button" className="b-btn b-btn-ink">{VERDICT[run.verdict].next}</button>
        </div>
        <dl className="b-d-meta">
          <div><dt>Payer</dt><dd>{shortPayer(den.payer_name)}</dd></div>
          <div><dt>Plan</dt><dd>{PLAN[den.plan_type] ?? den.plan_type}</dd></div>
          <div><dt>CPT</dt><dd className="b-num">{den.cpt}</dd></div>
          <div><dt>Service</dt><dd>{fmtDate(den.dos)}</dd></div>
          <div><dt>Denied</dt><dd>{fmtDate(den.notice_date)}</dd></div>
        </dl>
      </header>

      {/* ---------- hero: the answer, on the forest card ---------- */}
      <section className="b-hero" aria-label="Recommendation">
        <div className="b-hero-v">
          <Mark tone={v.tone} glyph={v.glyph} label={v.label} size="lg" />
          <p className="b-hero-line">{v.line}</p>
          <div className="b-hero-reason">
            <span className="b-hero-k">Payer's reason{den.carc.length ? ` · CARC ${den.carc.join(", ")}` : ""}</span>
            <q>{den.reason_text}</q>
          </div>
        </div>
        <div className="b-hero-amt">
          <span className="b-hero-k">Billed, at stake</span>
          <Figure value={d.billed_usd} currency className="b-fig-hero" />
          <span className="b-hero-sub">
            Reviewed for {usd4(run.cost_usd)} in model calls
          </span>
        </div>
        <div className="b-hero-dl">
          <DeadlineRing left={d.deadline.days_left} total={windowDays} />
          <div className="b-hero-dl-t">
            <span className="b-hero-due">Due {fmtDate(d.deadline.due)}</span>
            <span className="b-hero-sub">
              {d.deadline.days_left} of {windowDays} days in the window
            </span>
            <span className="b-hero-sub">
              {RULE_NAME[d.deadline.rule_id] ?? "Appeal window"}, {d.deadline.citation}
            </span>
          </div>
        </div>
      </section>

      {/* ---------- policy coverage and the deciding rules ---------- */}
      {clinical ? (
        <div className="b-grid2">
          <section className="b-card b-cov" aria-label="Policy rules">
            <div className="b-card-h">
              <h3>Policy rules</h3>
              <span className="b-card-aside">
                {watch && watch.status === "current" ? (
                  <span className="b-chip t-verified">
                    <Glyph name="check" size={12} /> Current version
                  </span>
                ) : (
                  run.policy && policyLabel(run.policy)
                )}
              </span>
            </div>
            <div className="b-cov-body">
              <CoverageRing counts={cov.counts} total={cov.total} />
              <table className="b-cov-t">
                <tbody>
                  {STATUS_ORDER.map((s) => (
                    <tr key={s} className={cov.counts[s] ? "" : "is-zero"}>
                      <td><span className={`b-sw b-seg-${s}`} /></td>
                      <td><Mark tone={STATUS[s].tone} glyph={STATUS[s].glyph} label={STATUS[s].label} /></td>
                      <td className="b-num">{cov.counts[s]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DecidingRules d={d} />
            <p className="b-cov-votes">
              Each rule gets two Nemotron Super votes: <b>{cov.votes.agreed}</b> agreed, <b>{cov.votes.escalated}</b> split and went to the Ultra referee,{" "}
              <b>{cov.votes.rule}</b> settled by a fixed rule.
            </p>
          </section>
          <KeyCard d={d} />
        </div>
      ) : null}

      {/* ---------- clinical timeline ---------- */}
      {run.facts && (
        <section className="b-card" aria-label="Clinical timeline">
          <div className="b-card-h">
            <h3>Clinical timeline</h3>
            <span className="b-card-aside">Dates from the chart; waiting periods counted in code</span>
          </div>
          <Timeline d={d} />
          <ul className="b-th">
            {thresholdStates(d).map((t) => (
              <li key={t.label}>
                <span className="b-th-l">
                  {t.label} <span className="b-th-a">{t.address}</span>
                </span>
                <Mark tone={t.tone} glyph={t.glyph} label={t.word} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- next step and model trace ---------- */}
      <div className="b-grid2 b-grid2-b">
        {clinical ? <NextCard d={d} /> : <AdminCard d={d} />}
        <section className="b-card" aria-label="Model calls">
          <div className="b-card-h">
            <h3>Model calls</h3>
            <span className="b-card-aside b-num">
              {run.trace?.length ?? 0} calls · {usd4(run.cost_usd)}
            </span>
          </div>
          <Trace groups={groups} />
          <p className="b-caption">Bar length is cost per step. Seconds add up each call, so parallel votes count in full.</p>
        </section>
      </div>
    </div>
  )
}

// CMS policies carry a version number; a payer page is a dated snapshot.
function policyLabel(p: { policy_id: string; version: string }) {
  return /^\d{4}-\d{2}-\d{2}$/.test(p.version) ? `${p.policy_id}, snapshot ${fmtDate(p.version, false)}` : `${p.policy_id} v${p.version}`
}

const VOTE_WORD: Record<string, string> = { met: "Supports", not_met: "Blocks", missing_documentation: "Missing docs", not_applicable: "Doesn't apply" }
// The two Super votes and, on a split, the Ultra referee: read straight from the run.
function Votes({ m }: { m: Match }) {
  if (!m.votes.length) return <p className="b-votes"><span className="b-votes-k">Decided by a fixed rule</span></p>
  return (
    <p className="b-votes">
      <span className="b-votes-k">{m.confidence === "escalated" ? "Votes split, referee decided" : "Votes agreed"}</span>
      {m.votes.map((v, i) => {
        const [who, what] = v.split(":")
        const ref = who === "ultra"
        return (
          <span key={i} className={`b-vote ${ref ? "is-ref" : ""}`}>
            {ref ? "Ultra" : "Super"} <b>{VOTE_WORD[what] ?? what}</b>
          </span>
        )
      })}
    </p>
  )
}

// The rules that bear on this case (everything except "doesn't apply"), blockers first, each with its address.
const RANK: Record<string, number> = { not_met: 0, missing_documentation: 1, met: 2 }
function DecidingRules({ d }: { d: CaseDetail }) {
  const run = d.run
  const ms = (run.matches ?? []).filter((m) => m.status !== "not_applicable").sort((a, b) => RANK[a.status] - RANK[b.status])
  if (!ms.length) return null
  return (
    <ul className="b-rules" aria-label="Rules that bear on this case">
      {ms.slice(0, 6).map((m) => {
        const c = run.criteria?.find((x) => x.criterion_id === m.criterion_id)
        const st = STATUS[m.status]
        return (
          <li key={m.criterion_id} className={`t-${st.tone}`}>
            <span className="b-rules-g"><Glyph name={st.glyph} size={12} /></span>
            <span className="b-rules-t" title={c?.summary}>{c?.summary ?? m.criterion_id}</span>
            <span className="b-rules-a">{d.addresses[m.criterion_id] ?? ""}</span>
            <span className="b-sr">{st.label}</span>
          </li>
        )
      })}
    </ul>
  )
}

function quoteList(m: Match) {
  return m.evidence.filter((e) => e.verified).slice(0, 2)
}

function KeyCard({ d }: { d: CaseDetail }) {
  const run = d.run
  const crit = (id: string) => run.criteria?.find((c) => c.criterion_id === id)
  if (run.verdict === "appeal" && run.gate) {
    const checks = run.gate.checks
    const pol = checks.filter((c) => !c.source_id.startsWith("case_"))
    const chart = checks.filter((c) => c.source_id.startsWith("case_"))
    const ok = checks.filter((c) => c.status === "verified").length
    return (
      <section className="b-card b-gate" aria-label="Citation gate">
        <div className="b-card-h">
          <h3>Citation gate</h3>
          <span className={`b-chip ${run.gate.ok ? "t-verified" : "t-neg"}`}>
            <Glyph name={run.gate.ok ? "check" : "cross"} size={12} /> {run.gate.ok ? "Passed" : "Blocked"}
          </span>
        </div>
        <p className="b-gate-fig">
          <Figure value={ok} className="b-fig-md" />
          <span className="b-gate-of">of {checks.length} quotes match the fetched text</span>
        </p>
        <div className="b-gate-cells" role="img" aria-label={`${ok} of ${checks.length} quotes verified`}>
          {[...pol, ...chart].map((c, i) => (
            <motion.span
              key={i}
              className={`b-gate-cell ${c.status === "verified" ? "is-ok" : "is-bad"} ${c.source_id.startsWith("case_") ? "k-chart" : "k-pol"}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: EASE, delay: 0.25 + i * 0.03 }}
              title={c.text}
            />
          ))}
        </div>
        <div className="b-gate-k">
          <span><span className="b-gate-cell is-ok k-pol" /> Policy lines {pol.length}</span>
          <span><span className="b-gate-cell is-ok k-chart" /> Chart quotes {chart.length}</span>
        </div>
        <p className="b-caption">The letter can be exported only while every quote matches text fetched this session.</p>
      </section>
    )
  }
  const want = run.verdict === "doc_request" ? "missing_documentation" : "not_met"
  const ms = (run.matches ?? []).filter((m) => m.status === want)
  const title = run.verdict === "doc_request" ? "Missing from the chart" : "What blocks"
  return (
    <section className="b-card b-key" aria-label={title}>
      <div className="b-card-h">
        <h3>{title}</h3>
        <span className="b-card-aside">{ms.length} {ms.length === 1 ? "rule" : "rules"}</span>
      </div>
      {ms.slice(0, 2).map((m) => {
        const c = crit(m.criterion_id)
        return (
          <article key={m.criterion_id} className="b-key-r">
            <div className="b-key-top">
              <Mark tone={STATUS[m.status].tone} glyph={STATUS[m.status].glyph} label={STATUS[m.status].label} />
              <span className="b-key-addr">
                {run.policy?.policy_id} · {d.addresses[m.criterion_id] ?? m.criterion_id}
              </span>
            </div>
            {c && <RuleQuote text={c.verbatim_span} />}
            <Votes m={m} />
            {quoteList(m).slice(0, ms.length > 1 ? 1 : 2).map((e, i) => (
              <p key={i} className="b-key-ev">
                <span className="b-key-evk">Chart, {noteDate(d, e.note_id) ? fmtDate(noteDate(d, e.note_id)!, true) : e.note_id}</span>
                <span>“{e.quote}”</span>
              </p>
            ))}
          </article>
        )
      })}
    </section>
  )
}

// The payer's own sentence, clamped to four lines; the waiting period it turns on is marked.
const KEY_PHRASE = /(at least [a-z]+ (?:weeks?|months?)|(?:\d+|six|four|two) weeks?|first month)/i
function RuleQuote({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const parts = text.split(KEY_PHRASE)
  return (
    <>
      <blockquote className={`b-key-q ${open ? "is-open" : ""}`}>
        {parts.map((t, i) => (i % 2 ? <mark key={i}>{t}</mark> : <span key={i}>{t}</span>))}
      </blockquote>
      {text.length > 220 && (
        <button type="button" className="b-key-more" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Show less" : "Read the full rule"}
        </button>
      )}
    </>
  )
}

function AdminCard({ d }: { d: CaseDetail }) {
  const t = d.run.triage
  return (
    <section className="b-card" aria-label="Triage">
      <div className="b-card-h">
        <h3>{t.route === "fix_checklist" ? "Fix checklist" : "Why it can't be won"}</h3>
        <span className="b-card-aside">CARC {d.run.denial.carc.join(", ")} · from the code table, no policy review needed</span>
      </div>
      {t.checklist.length ? (
        <ul className="b-check">
          {t.checklist.map((c, i) => (
            <li key={i}>
              <span className="b-check-box" aria-hidden="true" />
              {c}
            </li>
          ))}
        </ul>
      ) : (
        <p className="b-body">{t.explanation}</p>
      )}
    </section>
  )
}

function NextCard({ d }: { d: CaseDetail }) {
  const run = d.run
  const [copied, setCopied] = useState(false)
  if (run.verdict === "doc_request" && run.doc_request) {
    return (
      <section className="b-card" aria-label="Request to the physician">
        <div className="b-card-h">
          <h3>Request to the physician</h3>
          <button
            type="button"
            className="b-btn b-btn-ghost b-btn-sm"
            onClick={() => {
              navigator.clipboard?.writeText(run.doc_request!).then(() => setCopied(true), () => {})
            }}
          >
            <Copy size={13} strokeWidth={1.8} /> {copied ? "Copied" : "Copy request"}
          </button>
        </div>
        <div className="b-paper">{run.doc_request}</div>
      </section>
    )
  }
  if (run.verdict === "appeal" && run.appeal) {
    const secs = run.appeal.sections.slice(0, 3)
    return (
      <section className="b-card" aria-label="Appeal letter">
        <div className="b-card-h">
          <h3>Appeal letter</h3>
          <span className="b-card-aside">Drafted by Ultra, critiqued by Super, revised once</span>
        </div>
        <div className="b-paper">
          {secs.map((s) => (
            <div key={s.heading} className="b-paper-s">
              <b>{s.heading}</b>
              <p>{s.body.replace(/\{\{Q:[A-Z]\d+\}\}\n?/g, "").trim() || "Quoted policy lines follow in the letter."}</p>
            </div>
          ))}
        </div>
      </section>
    )
  }
  const v = verdictView(run.verdict, tooEarly(d))
  const ths = thresholdStates(d).filter((t) => t.date)
  const reorder = ths.length ? ths.map((t) => t.date!).sort().pop()! : null
  return (
    <section className="b-card" aria-label="Next step">
      <div className="b-card-h">
        <h3>Next step</h3>
      </div>
      <p className="b-body">{v.line}</p>
      {tooEarly(d) && reorder && (
        <p className="b-body">
          Every waiting period is reached by <b>{fmtDate(reorder)}</b>, counted from the chart dates.
        </p>
      )}
    </section>
  )
}
