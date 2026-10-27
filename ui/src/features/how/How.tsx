// How it works, in the app: each pipeline step illustrated with the real run of one showcase case,
// then the eval figures (synthetic test set) and the nightly policy watch.
import NumberFlow from "@number-flow/react"
import { motion, useInView } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { useRef, type ReactNode } from "react"
import { useCase, useCases, useDrift } from "@/lib/api"
import { STATUS, STATUS_ORDER, VERDICT, coverage, fmtDate, shortPayer, type CaseDetail, type Match } from "@/lib/data"
import { EASE_ENTER, enter } from "@/lib/motion"
import { Glyph, Mark } from "@/features/ui"
import "./how.css"

const SHOWCASE = "case_015"

// eval/results/final_super_scan.md: 30 synthetic cases scored, 0 skipped, 0 errors.
const EVAL = [
  { n: 30, of: 30, label: "Recommendations match ground truth" },
  { n: 30, of: 30, label: "Reason-code routes right" },
  { n: 138, of: 138, label: "Rule statuses right" },
]

type Who = "model" | "code"
function Station({ i, title, who, whoText, line, children }: { i: number; title: string; who: Who; whoText: string; line: string; children: ReactNode }) {
  const ref = useRef<HTMLLIElement>(null)
  const seen = useInView(ref, { once: true, margin: "-15% 0px" })
  return (
    <motion.li
      ref={ref}
      className={`hiw-st ${seen ? "is-seen" : ""}`}
      initial={{ opacity: 0, y: 16 }}
      animate={seen ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.7, ease: EASE_ENTER }}
    >
      <div className="hiw-st-l">
        <span className="hiw-n mono" aria-hidden="true">{String(i).padStart(2, "0")}</span>
        <h3>{title}</h3>
        <span className={`hiw-who is-${who}`}>
          <i aria-hidden="true" />
          {whoText}
        </span>
        <p>{line}</p>
      </div>
      <div className="hiw-st-r">{seen && children}</div>
    </motion.li>
  )
}

export function How() {
  const { data: d, error } = useCase(SHOWCASE)
  const cases = useCases().data
  const docCase = cases?.cases.find((c) => c.verdict === "doc_request")
  return (
    <div className="page hw">
      <motion.header className="page-h" {...enter(0)}>
        <h1>How it works</h1>
        <p>Models read and judge. Code checks every quote, date and deadline before you see it. Shown on one real run: {d ? `${d.patient}, ${shortPayer(d.run.denial.payer_name)}` : "a showcase case"}.</p>
      </motion.header>
      {error && <p className="q-err">The showcase case didn't load ({error}).</p>}
      {d && (
        <ol className="hiw-steps">
          <Station i={1} title="Read the letter" who="model" whoText="Nemotron 3.5 Super-VL" line="The scanned denial becomes fields.">
            <Letter d={d} />
          </Station>
          <Station i={2} title="Triage" who="code" whoText="Fixed table, no model" line="The reason code picks the route.">
            <Triage d={d} />
          </Station>
          <Station i={3} title="Policy by date of service" who="code" whoText="CMS Coverage API · Tavily" line="The version in effect when the scan was done.">
            <Policy d={d} />
          </Station>
          <Station i={4} title="Cut into rules" who="model" whoText="Nemotron 3 Super picks sentence ids" line="Code numbers the sentences. The model only points.">
            <Rules d={d} />
          </Station>
          <Station i={5} title="Two votes, one referee" who="model" whoText="2× Super, Ultra on a split" line="Each rule against the chart, every quote located in its note.">
            <Votes d={d} />
          </Station>
          <Station i={6} title="Verdict by fixed rule" who="code" whoText="No model" line="Statuses in, one recommendation out.">
            <Verdict d={d} />
          </Station>
          <Station i={7} title="Appeal and citation gate" who="code" whoText="Ultra drafts · exact match in code" line="Export opens only when every quote matches fetched text.">
            <Gate d={d} docCase={docCase?.id ?? null} />
          </Station>
        </ol>
      )}

      <section className="hiw-eval" aria-labelledby="hiw-eval-h">
        <div className="hiw-sec-h">
          <h2 id="hiw-eval-h">Measured</h2>
          <span className="lbl">Synthetic test set · 30 cases</span>
        </div>
        <dl className="hiw-figs">
          {EVAL.map((e) => (
            <div key={e.label}>
              <dd className="hiw-fig num">
                <NumberFlow value={e.n} /> <span>/ {e.of}</span>
              </dd>
              <dt>{e.label}</dt>
            </div>
          ))}
          <div>
            <dd className="hiw-fig num">$0.048</dd>
            <dt>Mean cost per case</dt>
          </div>
          <div>
            <dd className="hiw-fig num">72 s</dd>
            <dt>Mean time per case</dt>
          </div>
        </dl>
        <p className="hiw-cap">We wrote these cases and their ground truth, so the figures show consistency on designed situations, not accuracy on real charts.</p>
      </section>

      <Watch />

      <p className="hiw-never">
        <Glyph name="pause" size={14} /> It never submits anything. A person sends every letter. Deadlines come from a fixed table checked against eCFR.
      </p>
    </div>
  )
}

function Letter({ d }: { d: CaseDetail }) {
  const den = d.run.denial
  return (
    <div className="hiw-letter">
      <div className="hiw-scan">
        <img src={`/api/cases/${d.id}/letter`} alt="Synthetic faxed denial notice for this case" loading="lazy" />
        <span className="hiw-scanline" aria-hidden="true" />
      </div>
      <dl className="hiw-kv">
        {[
          ["Payer", shortPayer(den.payer_name)],
          ["CPT", den.cpt],
          ["Service", fmtDate(den.dos)],
          ["Notice", fmtDate(den.notice_date)],
          ["CARC", den.carc.join(", ")],
        ].map(([k, v], i) => (
          <motion.div key={k} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, ease: EASE_ENTER, delay: 0.5 + i * 0.08 }}>
            <dt className="lbl">{k}</dt>
            <dd className={k === "Payer" ? "" : "mono"}>{v}</dd>
          </motion.div>
        ))}
      </dl>
    </div>
  )
}

function Triage({ d }: { d: CaseDetail }) {
  const den = d.run.denial
  const t = d.run.triage
  return (
    <div className="hiw-flow">
      <span className="hiw-chip mono">CARC {den.carc.join(", ")}</span>
      <Arrow />
      <span className="hiw-chip">{t.explanation}</span>
      <Arrow />
      <span className="hiw-chip is-ink">{t.route === "clinical_review" ? "Clinical review" : t.route.replace(/_/g, " ")}</span>
      <p className="hiw-q">“{den.reason_text}”</p>
    </div>
  )
}

function Policy({ d }: { d: CaseDetail }) {
  const p = d.run.policy
  if (!p) return null
  const dos = d.run.denial.dos
  return (
    <div className="hiw-pol">
      <div className="hiw-axis" aria-hidden="true">
        <motion.i className="hiw-axis-in" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.1, ease: EASE_ENTER, delay: 0.2 }} />
        <span className="hiw-pin" style={{ left: "8%" }}>
          <i />
          <b className="mono">v{p.version} from {fmtDate(p.effective_from)}</b>
        </span>
        <span className="hiw-pin is-dos" style={{ left: "78%" }}>
          <i />
          <b className="mono">Service {fmtDate(dos)}</b>
        </span>
      </div>
      <p className="hiw-pol-t">
        <Mark tone="pos" glyph="check" label={`${p.policy_id} v${p.version} · ${p.title}`} size={13} />
        <span className="mono">CMS Coverage API, versioned by effective date</span>
      </p>
      <p className="hiw-alt">Commercial plans: <b>Aetna CPB 0236</b>, located at runtime with a Tavily search, then fetched from the payer's site as a dated snapshot.</p>
    </div>
  )
}

function Rules({ d }: { d: CaseDetail }) {
  const picked = d.sentences.filter((s) => s.criteria.length).length
  const crit = d.run.criteria ?? []
  const sample = crit.find((c) => c.kind === "indication" && /1 month/.test(c.verbatim_span)) ?? crit[0]
  const addr = sample ? d.addresses[sample.criterion_id] : ""
  return (
    <div className="hiw-rules">
      <div className="hiw-strip" aria-hidden="true">
        {d.sentences.map((s, i) => (
          <motion.i
            key={s.n}
            className={s.criteria.length ? (sample && s.criteria.includes(sample.criterion_id) ? "is-sample" : "is-on") : ""}
            initial={{ scaleY: 0.2, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: EASE_ENTER, delay: 0.1 + i * 0.008 }}
          />
        ))}
      </div>
      <p className="hiw-count mono num">
        {d.sentences.length} sentences numbered · {picked} picked · {crit.length} rules
      </p>
      {sample && (
        <blockquote className="hiw-span">
          <span className="lbl">{d.run.policy?.policy_id} {addr}</span>
          <span>{sample.verbatim_span}</span>
          <span className="ver t-verified"><Glyph name="check" size={12} /> Cut from the source, not written by the model</span>
        </blockquote>
      )}
    </div>
  )
}

const VOTE_WORD: Record<string, string> = { met: "Supports", not_met: "Blocks", missing_documentation: "Missing docs", not_applicable: "Doesn't apply" }
function Votes({ d }: { d: CaseDetail }) {
  const ms = d.run.matches ?? []
  const split = ms.find((m) => m.confidence === "escalated")
  const agreed = ms.find((m) => m.confidence === "agreed" && m.status === "met")
  const cov = coverage(ms)
  const shown = [agreed, split].filter((m): m is Match => !!m)
  const name = (m: Match) => d.run.criteria?.find((c) => c.criterion_id === m.criterion_id)?.summary ?? m.criterion_id
  const ev = agreed?.evidence.find((e) => e.verified)
  return (
    <div className="hiw-votes">
      {shown.map((m, j) => (
        <div key={m.criterion_id} className="hiw-vrow">
          <span className="hiw-vname">
            <span className="mono">{d.addresses[m.criterion_id]}</span> {name(m)}
          </span>
          <span className="hiw-vchips">
            {m.votes.map((v, i) => {
              const [who, what] = v.split(":")
              return (
                <motion.span
                  key={i}
                  className={`vote ${who === "ultra" ? "is-ref" : ""}`}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: EASE_ENTER, delay: 0.3 + j * 0.5 + i * 0.22 }}
                >
                  {who === "ultra" ? "Ultra" : "Super"} <b>{VOTE_WORD[what] ?? what}</b>
                </motion.span>
              )
            })}
          </span>
        </div>
      ))}
      {ev && (
        <p className="hiw-ev">
          <q>{ev.quote}</q>
          <span className="ver t-verified"><Glyph name="check" size={12} /> Found word for word in note {ev.note_id.split("-").pop()}</span>
        </p>
      )}
      <p className="hiw-count mono num">
        {cov.votes.agreed} agreed · {cov.votes.escalated} split, Ultra decided · {cov.votes.rule} by fixed rule
      </p>
    </div>
  )
}

function Verdict({ d }: { d: CaseDetail }) {
  const cov = coverage(d.run.matches)
  const v = VERDICT[d.run.verdict]
  return (
    <div className="hiw-verdict">
      <div className="hiw-bar" aria-hidden="true">
        {STATUS_ORDER.filter((s) => cov.counts[s]).map((s, i) => (
          <motion.i
            key={s}
            className={`t-${STATUS[s].tone}`}
            style={{ flexGrow: cov.counts[s] }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, ease: EASE_ENTER, delay: 0.15 + i * 0.12 }}
          />
        ))}
      </div>
      <ul className="hiw-legend">
        {STATUS_ORDER.map((s) => (
          <li key={s}>
            <Mark tone={STATUS[s].tone} glyph={STATUS[s].glyph} label={STATUS[s].label} size={13} />
            <span className="mono num">{cov.counts[s]}</span>
          </li>
        ))}
      </ul>
      <motion.p className={`hiw-out tone-${v.tone}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_ENTER, delay: 0.8 }}>
        <Mark tone={v.tone} glyph={v.glyph} label={v.label} size={16} className="mark-lg" />
        <span>{d.run.verdict === "appeal" ? "Nothing blocks and a route is met." : v.line} The deadline comes from a table: {d.deadline.citation}.</span>
      </motion.p>
    </div>
  )
}

function Gate({ d, docCase }: { d: CaseDetail; docCase: string | null }) {
  const g = d.run.gate
  if (!g) return null
  const ok = g.checks.filter((c) => c.status === "verified").length
  const q = g.checks.find((c) => c.status === "verified" && c.source_id.startsWith("L"))
  return (
    <div className="hiw-gate">
      <p className={`hiw-gate-n ${g.ok ? "t-verified" : "t-neg"}`}>
        <Glyph name={g.ok ? "check" : "cross"} size={18} />
        <span className="num">
          <NumberFlow value={ok} /> of {g.checks.length}
        </span>
        <span className="hiw-gate-w">quotes match fetched text · export open</span>
      </p>
      {q && (
        <blockquote className="hiw-span">
          <span>{q.text}</span>
          <span className="ver t-verified"><Glyph name="check" size={12} /> Matches {q.source_id.replace("v", " v")} word for word</span>
        </blockquote>
      )}
      <p className="hiw-alt">
        Evidence missing instead? It becomes a dated request to the physician, in the policy's words.
        {docCase && (
          <>
            {" "}
            <a className="hiw-link" href={`#/app/c/${docCase}`}>See one <ArrowRight size={13} strokeWidth={1.8} /></a>
          </>
        )}
      </p>
    </div>
  )
}

function Arrow() {
  return (
    <svg className="hiw-arrow" width="28" height="10" viewBox="0 0 28 10" aria-hidden="true">
      <motion.path d="M1 5h24m-4-4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: EASE_ENTER, delay: 0.3 }} />
    </svg>
  )
}

function Watch() {
  const { data } = useDrift()
  const items = data?.items ?? []
  const changed = items.filter((i) => i.status !== "current")
  return (
    <section className="hiw-watch" aria-labelledby="hiw-watch-h">
      <div className="hiw-sec-h">
        <h2 id="hiw-watch-h">Policy watch</h2>
        <span className="lbl">Nightly · no model · {data?.checked_at ? `checked ${fmtDate(data.checked_at.slice(0, 10))}` : "not run yet"}</span>
      </div>
      <p className="hiw-cap">Each saved run's cited version is compared with the live source. Only rules whose wording moved are flagged.</p>
      {items.length > 0 && (
        <>
          <p className="hiw-watch-sum">
            <Mark tone={changed.length ? "warn" : "pos"} glyph={changed.length ? "half" : "check"} label={changed.length ? `${changed.length} cited versions changed` : `${items.length} of ${items.length} cited versions current`} />
          </p>
          <ul className="hiw-wl">
            {items.map((it, i) => (
              <motion.li key={`${it.case_id}-${it.kind}`} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: Math.min(i, 10) * 0.03 }}>
                <span className="mono">{it.case_id.replace("case_", "Case ")}</span>
                <span>{it.kind === "prior_auth" ? "Prior-auth" : "Denial"}</span>
                <span className="mono">{it.policy_id.replace(/^Aetna /, "")} {/^\d{4}-/.test(it.cited) ? fmtDate(it.cited, false) : `v${it.cited}`}</span>
                <Mark tone={it.status === "current" ? "pos" : "warn"} glyph={it.status === "current" ? "check" : "half"} label={it.status === "current" ? "Current" : "Changed"} size={12} />
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
