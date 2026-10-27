// Prior-auth checks: the list of saved checks, and one check with its readiness, waiting-period timeline,
// the rules against the chart, and the later denial when the MRI went ahead anyway.
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, Copy } from "lucide-react"
import { useMemo, useState } from "react"
import { useCase, useCases, useDrift, useJSON } from "@/lib/api"
import {
  PLAN, daysBetween, fmtDate, initials, noteName, policyHuman, policyNameFromLine, ruleNames, sec, secLong, shortPayer, DOUBLE_TIP, sureWord, tooEarly, verdictView,
  type Criterion, type Match,
} from "@/lib/data"
import { EASE_ENTER, EASE_OUT, enter } from "@/lib/motion"
import { Glyph, Mark, Press, useGlow } from "@/features/ui"
import {
  READY, SHOW, SHOW_ORDER, checkLine, readyKey, ruleShows, waits,
  type CheckDetail as Detail, type CheckRow, type Show,
} from "./model"
import { Timeline } from "./Timeline"
import "./check.css"

// ---------------- list ----------------
export function CheckList() {
  const { data, error } = useJSON<{ checks: CheckRow[] }>("/api/checks")
  const cases = useCases().data
  const denied = new Set(cases?.cases.map((c) => c.id) ?? [])
  const rows = useMemo(() => [...(data?.checks ?? [])].sort((a, b) => a.planned_dos.localeCompare(b.planned_dos)), [data])
  const glow = useGlow()

  // One shared date axis for the window column: planned date and earliest qualifying date.
  const all = rows.flatMap((r) => [r.planned_dos, r.earliest].filter((x): x is string => !!x)).sort()
  const lo = all[0]
  const hi = all[all.length - 1]
  const span = lo && hi ? Math.max(1, daysBetween(lo, hi)) : 1
  const px = (iso: string) => 8 + (daysBetween(lo, iso) / span) * 84

  const ready = rows.filter((r) => r.readiness === "ready").length
  const firstWait = rows.filter((r) => r.earliest).sort((a, b) => a.earliest!.localeCompare(b.earliest!))[0]

  return (
    <div className="page pa">
      <motion.header className="page-h" {...enter(0)}>
        <h1>Prior-auth checks</h1>
        <p>
          {rows.length ? (
            <>
              <b className="num">{ready} of {rows.length}</b> ready to submit.
              {firstWait && <> Next qualifying date: <b>{fmtDate(firstWait.earliest!)}</b>, counted from the chart's dates.</>}
            </>
          ) : (
            "The same rule check, run on an MRI order before it goes out."
          )}
        </p>
      </motion.header>
      {error && <p className="q-err">The checks didn't load ({error}).</p>}

      <div className="pa-head lbl" aria-hidden="true">
        <span>Planned</span>
        <span>Patient</span>
        <span>Readiness</span>
        <span>Window</span>
      </div>
      <ul className="pa-list">
        {!data && !error && [0, 1, 2, 3].map((i) => <li key={i} className="pa-skel"><span className="sk sk-l1" /><span className="sk sk-l2" /></li>)}
        {rows.map((r, i) => {
          const k = readyKey(r.readiness, r.earliest, r.planned_dos)
          const rd = READY[k]
          return (
            <motion.li
              key={r.id}
              className="pa-row glow"
              onPointerMove={glow}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.64, ease: EASE_ENTER, delay: 0.08 + Math.min(i, 6) * 0.05 }}
            >
              <span className="pa-date num">{fmtDate(r.planned_dos, false)}</span>
              <span className="pa-who">
                <span className={`avatar t-${rd.tone}`} aria-hidden="true">{initials(r.patient)}</span>
                <span className="pa-who-t">
                  <a className="pa-open" href={`#/app/checks/${r.id}`}>{r.patient}</a>
                  <span>
                    {shortPayer(r.payer)} · <span className="num">CPT {r.cpt}</span> · {policyNameFromLine(r.policy)}
                  </span>
                </span>
              </span>
              <span className="pa-ready">
                <Mark tone={rd.tone} glyph={rd.glyph} label={rd.label} size={13} />
                {denied.has(r.id) && (
                  <a className="pa-later" href={`#/app/c/${r.id}`}>
                    See the denial <ArrowRight size={12} strokeWidth={1.8} />
                  </a>
                )}
              </span>
              <span className="pa-win">
                <span className="pa-w-track" aria-hidden="true">
                  {r.earliest && (
                    <motion.i
                      className={`pa-w-gap t-${rd.tone}`}
                      style={{
                        left: `${Math.min(px(r.planned_dos), px(r.earliest))}%`,
                        width: `${Math.abs(px(r.earliest) - px(r.planned_dos))}%`,
                        transformOrigin: r.earliest > r.planned_dos ? "left" : "right",
                      }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.9, ease: EASE_ENTER, delay: 0.3 + i * 0.06 }}
                    />
                  )}
                  <i className="pa-w-plan" style={{ left: `${px(r.planned_dos)}%` }} />
                  {r.earliest && <i className="pa-w-dot" style={{ left: `${px(r.earliest)}%` }} />}
                </span>
                <span className="pa-w-t num">{r.earliest ? `Earliest ${fmtDate(r.earliest, false)}` : "Meets on date"}</span>
              </span>
            </motion.li>
          )
        })}
      </ul>
      <motion.p className="pa-key" {...enter(3)}>
        <span><i className="pa-key-plan" aria-hidden="true" /> Planned MRI</span>
        <span><i className="pa-key-dot" aria-hidden="true" /> Earliest date the chart meets the policy</span>
      </motion.p>
    </div>
  )
}

// ---------------- one check ----------------
export function CheckView({ id }: { id: string }) {
  const { data, error } = useJSON<Detail>(`/api/checks/${id}`)
  return (
    <div className="page pa pa-d">
      <a className="pa-back" href="#/app/checks">
        <ArrowLeft size={15} strokeWidth={1.8} /> Prior-auth checks
      </a>
      {error && <p className="q-err">This check didn't load ({error}).</p>}
      {!data && !error && <div className="pa-skel-d" aria-hidden="true"><span className="sk sk-l1" /><span className="sk sk-l2" /></div>}
      {data && <CheckBody d={data} />}
    </div>
  )
}

function CheckBody({ d }: { d: Detail }) {
  const ch = d.check
  const r = ch.request
  const k = readyKey(ch.readiness, ch.earliest, r.planned_dos)
  const rd = READY[k]
  const shows = useMemo(() => ruleShows(d), [d])
  const ws = waits(d)
  const crit = (cid: string) => ch.criteria.find((c) => c.criterion_id === cid)
  const sorted = [...ch.matches].sort((a, b) => SHOW_ORDER.indexOf(shows[a.criterion_id]) - SHOW_ORDER.indexOf(shows[b.criterion_id]))
  const deciding = sorted.filter((m) => !["not_applicable", "route"].includes(shows[m.criterion_id]))
  const quiet = sorted.filter((m) => ["not_applicable", "route"].includes(shows[m.criterion_id]))
  const firstOpen = deciding.find((m) => ["not_met", "pending", "missing_documentation"].includes(shows[m.criterion_id]))?.criterion_id ?? null
  const [open, setOpen] = useState<string | null>(firstOpen)
  const [showQuiet, setShowQuiet] = useState(false)
  const gap = ch.earliest ? daysBetween(r.planned_dos, ch.earliest) : 0
  const polLabel = ch.policy ? policyHuman(ch.policy) : null

  return (
    <article className="cd" aria-label={`Prior-auth check for ${d.patient}`}>
      <motion.header className="cd-head" {...enter(0)}>
        <div className="cd-who">
          <h1 className="pa-h1">{d.patient}</h1>
          <p className="cd-meta">
            <span>{shortPayer(r.payer_name)}</span>
            <span>{PLAN[r.plan_type] ?? r.plan_type}</span>
            <span>CPT {r.cpt}</span>
            <span>Planned {fmtDate(r.planned_dos)}</span>
          </p>
        </div>
        {ch.policy && (
          <div className="cd-acts">
            <a className="pill pill-ghost pill-sm" href={ch.policy.url} target="_blank" rel="noreferrer">
              {polLabel} <ArrowUpRight size={14} strokeWidth={1.8} className="nudge" />
            </a>
          </div>
        )}
      </motion.header>

      <motion.section className={`cd-verdict tone-${rd.tone}`} aria-label="Readiness" {...enter(1)}>
        <div className="cd-v-main">
          <span className="lbl pa-lbl">Readiness</span>
          <Mark tone={rd.tone} glyph={rd.glyph} label={rd.label} size={18} className="mark-lg pa-mark" />
          <p>{checkLine(ch)}</p>
        </div>
        <dl className="pa-date-cell">
          <dt className="lbl">{ch.earliest ? (gap <= 0 ? "Qualifies on" : "Earliest date") : "Planned MRI"}</dt>
          <dd className="cd-fig num">{fmtDate(ch.earliest ?? r.planned_dos)}</dd>
          <dd className="cd-sub">
            {ch.earliest
              ? gap <= 0
                ? `${-gap === 0 ? "No" : -gap} ${-gap === 1 ? "day" : "days"} of margin before the planned date`
                : `${gap} days after the planned ${fmtDate(r.planned_dos, false)}`
              : polLabel
                ? `Meets ${polLabel}`
                : ""}
          </dd>
          <dd className="cd-sub pa-code">
            <Glyph name="check" size={12} /> Counted from the dates in the chart
          </dd>
        </dl>
      </motion.section>

      <Later id={d.id} />

      {d.thresholds.length > 0 && (
        <motion.section className="cd-sec" aria-label="Waiting periods" {...enter(2)}>
          <div className="cd-sec-h">
            <h2 className="pa-h2">Waiting periods</h2>
            <span className="cd-sec-a">From the policy, measured against the planned date</span>
          </div>
          <Timeline d={d} />
          <ul className="thr">
            {ws.map((w) => (
              <li key={w.label}>
                <span className="thr-l">{w.label}</span>
                <span className="thr-a chip" title={secLong(ch.policy, w.address)}>{sec(w.address)}</span>
                <Mark tone={w.tone} glyph={w.glyph} label={w.word} />
              </li>
            ))}
          </ul>
          {ch.earliest_basis.length > 0 && (
            <ul className="pa-basis">
              {ch.earliest_basis.map((b) => <li key={b}>{b}</li>)}
            </ul>
          )}
        </motion.section>
      )}

      <motion.section className="cd-sec" aria-label="Policy rules" {...enter(3)}>
        <div className="cd-sec-h">
          <h2 className="pa-h2">Rules against the chart</h2>
          <span className="cd-sec-a">{deciding.length} of {ch.matches.length} decide it</span>
        </div>
        <ul className="rules">
          {[...deciding, ...(showQuiet ? quiet : [])].map((m, i) => (
            <CheckRule key={m.criterion_id} d={d} m={m} c={crit(m.criterion_id)} show={shows[m.criterion_id]} index={i} open={open === m.criterion_id} onToggle={() => setOpen(open === m.criterion_id ? null : m.criterion_id)} />
          ))}
        </ul>
        {quiet.length > 0 && (
          <button type="button" className="textbtn" onClick={() => setShowQuiet(!showQuiet)} aria-expanded={showQuiet}>
            {showQuiet ? "Hide" : "Show"} the {quiet.length} other rules
          </button>
        )}
      </motion.section>

      <motion.section className="cd-sec" aria-label="Next step" {...enter(4)}>
        <NextStep d={d} />
      </motion.section>

      <motion.section className="cd-sec" aria-label="Policy watch" {...enter(5)}>
        <Footer d={d} />
      </motion.section>
    </article>
  )
}

// The same chart's denial, when the MRI went ahead and the claim was denied (case_023 is the clearest).
function Later({ id }: { id: string }) {
  const rows = useCases().data
  const row = rows?.cases.find((c) => c.id === id) ?? null
  const det = useCase(row ? id : null).data
  const glow = useGlow()
  if (!row) return null
  const v = verdictView(row.verdict, det ? tooEarly(det) : false)
  return (
    <motion.a className="pa-linked glow" href={`#/app/c/${id}`} {...enter(2)} onPointerMove={glow}>
      <span className="lbl">After this check</span>
      <span className="pa-linked-t">
        MRI done {fmtDate(row.dos)}, claim denied
        <Mark tone={v.tone} glyph={v.glyph} label={v.label} size={13} />
      </span>
      <span className="pa-linked-go">
        Open the denial <ArrowRight size={14} strokeWidth={1.8} className="nudge" />
      </span>
    </motion.a>
  )
}

function CheckRule({
  d, m, c, show, open, onToggle, index,
}: { d: Detail; m: Match; c?: Criterion; show: Show; open: boolean; onToggle: () => void; index: number }) {
  const st = SHOW[show]
  const pol = d.check.policy
  const sure = sureWord(m)
  return (
    <motion.li
      className={`rule ${open ? "is-open" : ""}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.64, ease: EASE_ENTER, delay: Math.min(index, 6) * 0.05 }}
    >
      <button type="button" className="rule-h" onClick={onToggle} aria-expanded={open}>
        <span className={`rule-g t-${st.tone}`}><Glyph name={st.glyph} size={15} /></span>
        <span className="rule-t">
          <b>{c ? ruleNames(d.check.criteria, d.addresses).get(c.criterion_id) : "Policy rule"}</b>
          <span>{c?.summary}</span>
        </span>
        <span className="rule-a">
          {sure?.review && <span className="rule-split" title={DOUBLE_TIP}>Double-checked</span>}
          {d.addresses[m.criterion_id] && <span className="sec" title={secLong(pol, d.addresses[m.criterion_id])}>{sec(d.addresses[m.criterion_id])}</span>}
        </span>
        <span className={`rule-s t-${st.tone}`}>{st.label}</span>
        <ChevronDown size={15} strokeWidth={1.7} className="rule-x" aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="rule-b"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            <div className="rule-bi">
              {c && (
                <div className="rule-q">
                  <span className="lbl">What the policy requires</span>
                  <blockquote>{c.verbatim_span.length > 360 ? c.verbatim_span.slice(0, 357).trimEnd() + "..." : c.verbatim_span}</blockquote>
                  <span className="ver t-verified">
                    <Glyph name="check" size={12} /> Word for word from {pol ? policyHuman(pol) : "the policy"}
                  </span>
                </div>
              )}
              <div className="rule-ev">
                <span className="lbl">What the chart shows</span>
                {m.evidence.length === 0 && <p className="muted">Nothing in the chart speaks to this.</p>}
                <ul>
                  {m.evidence.slice(0, 3).map((e, i) => {
                    return (
                      <li key={i}>
                        <q>{e.quote}</q>
                        {e.verified ? (
                          <span className="ver t-verified"><Glyph name="check" size={12} /> Found in {noteName(d.notes, e.note_id)}</span>
                        ) : (
                          <span className="ver t-warn"><Glyph name="ring" size={12} /> Not found word for word in the chart, so not used</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
              <p className="rule-why"><span className="lbl">Why</span> {m.rationale}</p>
              {sure && (
                <p className={`sure ${sure.review ? "is-review" : ""}`}>
                  <Glyph name={sure.review ? "half" : "check"} size={12} />
                  {sure.review ? DOUBLE_TIP : "Checked twice, same answer."}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

function NextStep({ d }: { d: Detail }) {
  const ch = d.check
  const [copied, setCopied] = useState(false)
  const text = ch.doc_request ?? [
    `Prior-auth check · ${d.patient} · planned ${fmtDate(ch.request.planned_dos)}`,
    `${READY[readyKey(ch.readiness, ch.earliest, ch.request.planned_dos)].label}. ${checkLine(ch)}`,
    ...(ch.earliest ? [`Earliest date the chart meets the policy: ${fmtDate(ch.earliest)} (counted from the dates in the chart).`] : []),
    ...ch.earliest_basis,
    "Synthetic case. A person reviews and sends every request.",
  ].join("\n")
  const copy = () => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})
  return (
    <>
      <div className="cd-sec-h">
        <h2 className="pa-h2">{ch.doc_request ? "Request to the physician" : "Next step"}</h2>
        <Press className="pill pill-ghost pill-sm" onClick={copy}>
          {copied ? <Glyph name="check" size={13} /> : <Copy size={13} strokeWidth={1.8} />} {copied ? "Copied" : ch.doc_request ? "Copy request" : "Copy next step"}
        </Press>
      </div>
      <pre className="paper" tabIndex={0} aria-label="Next step text">{text}</pre>
      <p className="cd-note">The tool never submits anything. A person reviews and sends every request.</p>
    </>
  )
}

function Footer({ d }: { d: Detail }) {
  const drift = useDrift().data
  const item = drift?.items.find((i) => i.case_id === d.id && i.kind === "prior_auth")
  return (
    <dl className="pa-foot">
      <div>
        <dt className="lbl">Policy watch</dt>
        <dd>
          {item ? (
            <Mark
              tone={item.status === "current" ? "pos" : "warn"}
              glyph={item.status === "current" ? "check" : "half"}
              label={item.status === "current" ? `Cited version still current${drift?.checked_at ? `, checked ${fmtDate(drift.checked_at.slice(0, 10), false)}` : ""}` : "The cited policy changed since this check"}
              size={13}
            />
          ) : (
            <span className="muted">Not watched yet</span>
          )}
        </dd>
      </div>
    </dl>
  )
}
