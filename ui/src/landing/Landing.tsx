// The landing page: one dark band with the policy globe, then sections separated by tone steps, each illustrated
// with the product's own UI (live from the API) and cropped screenshots of the app in public/img/landing.
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import Lenis from "lenis"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useCase, useCases, useDrift, useJSON } from "@/lib/api"
import { ORDER, VERDICT, fmtDate, policyLabel, shortPayer, shortRule, type CaseDetail } from "@/lib/data"
import { EASE_ENTER } from "@/lib/motion"
import { Glyph, Mark, SkipLink, Wordmark } from "@/features/ui"
import { Highlight } from "@/features/case/parts"
import { PolicyGlobe, type GlobeCase } from "./Globe"
import { GateDemo } from "./GateDemo"
import "./landing.css"

const REPLAY = ["case_031", "case_015", "case_018"]

function useIsCompact() {
  const q = "(max-width: 767px)"
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return m
}

function Reveal({ children, className = "", delay = 0, as = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "li" }) {
  const M = as === "li" ? motion.li : motion.div
  return (
    <M
      className={className}
      initial={{ opacity: 0.001, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      // Starts 15% of a screen before the block scrolls in, so nothing is blank while you scroll.
      viewport={{ once: true, amount: 0, margin: "0px 0px 15% 0px" }}
      transition={{ duration: 0.64, ease: EASE_ENTER, delay: Math.min(delay, 0.3) }}
    >
      {children}
    </M>
  )
}

function useLenis() {
  const ref = useRef<Lenis | null>(null)
  useEffect(() => {
    // Native scrolling on touch screens and for reduced motion; smooth wheel scrolling elsewhere.
    if (window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches) return
    const l = new Lenis({ lerp: 0.1 })
    ref.current = l
    let raf = 0
    const loop = (t: number) => {
      l.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      l.destroy()
      ref.current = null
    }
  }, [])
  return (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    if (ref.current) ref.current.scrollTo(el, { offset: -24 })
    else el.scrollIntoView()
  }
}


export default function Landing() {
  const scrollTo = useLenis()
  const compact = useIsCompact()
  const cases = useCases().data
  const drift = useDrift().data
  const a = useCase(REPLAY[0]).data
  const b = useCase(REPLAY[1]).data
  const c = useCase(REPLAY[2]).data
  const globeCases = useMemo<GlobeCase[]>(() => {
    const ds = [a, b, c].filter((x): x is CaseDetail => !!x && !!x.sentences?.length)
    if (ds.length < 3) return []
    return ds.map((d) => ({ id: d.id, patient: d.patient, verdict: d.run.verdict, detail: d }))
  }, [a, b, c])

  return (
    <div className="lp">
      <SkipLink />
      {/* ---------------- the one dark band ---------------- */}
      <header className="hero">
        <nav className="lp-nav" aria-label="Main">
          <a href="#/" className="lp-brand" aria-label="Denial Auditor">
            <Wordmark onNight />
          </a>
          <div className="lp-links">
            <button type="button" onClick={() => scrollTo("how")}>How it works</button>
            <a href="#/login">Sign in</a>
          </div>
          <a href="#/login" className="pill pill-light pill-sm">Open the demo</a>
        </nav>

        <div className="hero-in">
          <div className="hero-copy" id="main" tabIndex={-1}>
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE_ENTER, delay: 0.15 }}>
              Quote the policy <span>back to the payer.</span>
            </motion.h1>
            <motion.p className="hero-sub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE_ENTER, delay: 0.25 }}>
              Checks a denied MRI claim against the payer's own policy, rule by rule.
            </motion.p>
            <motion.div className="hero-cta" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE_ENTER, delay: 0.35 }}>
              <a href="#/login" className="pill pill-light">
                Open the demo <ArrowRight size={16} strokeWidth={1.8} className="nudge" />
              </a>
              <button type="button" className="pill pill-dim" onClick={() => scrollTo("how")}>How it works</button>
            </motion.div>
          </div>

          <div className="hero-globe">
            <p className="sr">
              Illustration: a slowly turning globe of dots. Each cell is one sentence of the Medicare lumbar MRI policy L34220. Saved
              synthetic cases are replayed on it: rules the chart supports turn blue, and rules missing documentation get an amber ring.
            </p>
            {globeCases.length > 0 && <PolicyGlobe cases={globeCases} onPhase={() => {}} compact={compact} />}
          </div>

        </div>
      </header>

      <main>
      {/* ---------------- proof: three figures on a tone step ---------------- */}
      <section className="proof" aria-label="Evaluation on synthetic cases">
        <div className="wrap proof-in">
          <Reveal className="proof-c">
            <b className="num">30/30</b>
            <span>recommendations correct</span>
          </Reveal>
          <Reveal className="proof-c" delay={0.075}>
            <b className="num">138/138</b>
            <span>gold rule statuses matched</span>
          </Reveal>
          <Reveal className="proof-c" delay={0.15}>
            <b className="num">$0.048</b>
            <span>mean model cost per case</span>
          </Reveal>
          <p className="proof-n">Measured on our 30-case synthetic test set.</p>
        </div>
      </section>

      {/* ---------------- the gate: copy left, live gate over the real appeal ---------------- */}
      <section className="sec" id="gate" aria-labelledby="gate-h">
        <div className="wrap sec-in">
          <div className="sec-copy">
            <Reveal><h2 id="gate-h">A quote that doesn't match <span>doesn't ship.</span></h2></Reveal>
            <Reveal delay={0.075}><p>Every quoted policy line is checked against the text fetched for this case. Change one word and export locks.</p></Reveal>
          </div>
          <Reveal className="sec-fig gate-fig" delay={0.15}>
            <img className="pic pic-appeal" src="/img/landing/appeal.webp" width={1494} height={630} alt="The appeal letter in Denial Auditor, with 22 of 22 quotes matching the fetched policy text" loading="lazy" />
            {b && <GateDemo d={b} />}
          </Reveal>
        </div>
      </section>

      {/* ---------------- five answers: the real queue beside a large-type list ---------------- */}
      <section className="sec band-white" aria-labelledby="outcomes-h">
        <div className="wrap out-in">
          <Reveal className="out-pic" delay={0.15}>
            <img className="pic" src="/img/landing/queue.webp" width={760} height={1692} alt="The denial worklist: eight synthetic denials, each sorted into one of five answers" loading="lazy" />
          </Reveal>
          <div className="out-copy">
            <Reveal><h2 id="outcomes-h">Five answers. <span>Not every denial gets a letter.</span></h2></Reveal>
            <Outcomes counts={cases?.cases.reduce<Record<string, number>>((m, r) => ((m[r.verdict] = (m[r.verdict] ?? 0) + 1), m), {}) ?? {}} />
          </div>
        </div>
      </section>

      {/* ---------------- how it works: tabbed real screens ---------------- */}
      <section className="sec" id="how" aria-labelledby="how-h">
        <div className="wrap">
          <Reveal className="sec-copy-wide">
            <h2 id="how-h">From fax to appeal <span>in four checked steps.</span></h2>
          </Reveal>
          {a && b && <HowSteps a={a} b={b} />}
        </div>
      </section>

      {/* ---------------- before you submit: stacked, timeline beside the checks list ---------------- */}
      <section className="sec band-sunk" aria-labelledby="pre-h">
        <div className="wrap">
          <div className="pre-head">
            <Reveal><h2 id="pre-h">Check the order <span>before it is sent.</span></h2></Reveal>
            <Reveal delay={0.075}><p>The same rule checks run on an imaging order. When a waiting period is the only gap, the earliest date is counted in code.</p></Reveal>
          </div>
          <div className="pre-grid">
            <Reveal delay={0.15}><Prevention /></Reveal>
            <Reveal className="pre-pic" delay={0.225}>
              <img className="pic" src="/img/landing/checks.webp" width={1757} height={835} alt="The prior-auth checks list: two orders ready to send, two not yet, each with its earliest date" loading="lazy" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- policy watch: picture left, copy and live list right ---------------- */}
      <section className="sec" id="watch" aria-labelledby="watch-h">
        <div className="wrap watch-in">
          <Reveal className="watch-pic" delay={0.15}>
            <img className="pic" src="/img/landing/rules.webp" width={1494} height={1710} alt="A case in Denial Auditor: the verdict, the deadline and each rule with its policy sentence and version" loading="lazy" />
          </Reveal>
          <div className="watch-copy">
            <Reveal><h2 id="watch-h">Policies change. <span>Open cases hear about it.</span></h2></Reveal>
            <Reveal delay={0.075}><p>Every rule cites the policy version in effect on the date of service. Each night the cited text is compared with the live source.</p></Reveal>
            <Reveal delay={0.15}>
              {drift && cases && (
                <div className="ui-card watch" data-ui>
                  <div className="ui-card-h">
                    <span className="lbl">Policy watch</span>
                    <span className="watch-at">Checked {drift.checked_at ? fmtDate(drift.checked_at.slice(0, 10)) : "not yet"}</span>
                  </div>
                  <ul>
                    {drift.items.filter((i) => i.kind === "denial").slice(0, 5).map((i) => {
                      const row = cases.cases.find((x) => x.id === i.case_id)
                      return (
                        <li key={i.case_id + i.kind}>
                          <span className="w-p">{row ? shortPayer(row.payer) : i.case_id}</span>
                          <span className="num w-v">{i.policy_id} · cited {i.cited}</span>
                          <Mark tone={i.affects_case ? "warn" : "pos"} glyph={i.affects_case ? "ring" : "check"} label={i.affects_case ? "Changed" : "Current"} size={13} />
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------------- closing band: compact, with the app moving ---------------- */}
      <section className="close" aria-labelledby="close-h">
        <div className="wrap close-in">
          <div className="close-copy">
            <Reveal><h2 id="close-h">Open a denial and read the rules.</h2></Reveal>
            <Reveal delay={0.075}><p>Eight synthetic denials, ready to open. No sign-up.</p></Reveal>
            <Reveal delay={0.15}>
              <a href="#/login" className="pill pill-ink pill-lg">
                Open the demo <ArrowRight size={16} strokeWidth={1.8} className="nudge" />
              </a>
            </Reveal>
          </div>
          <Reveal className="close-vid" delay={0.225}>
            <video src="/img/landing/replay.webm" poster="/img/landing/replay-poster.webp" autoPlay muted loop playsInline preload="metadata" aria-label="Screen recording: a saved synthetic case opens in Denial Auditor and its rules check in turn" />
          </Reveal>
        </div>
      </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-in">
          <div className="foot-a">
            <Wordmark />
            <p>Built by team Road House: Aman Bihari and Bhawna, for the Nebius x NVIDIA Global AI Hackathon.</p>
            <p>NVIDIA Nemotron on Nebius Token Factory · Tavily</p>
          </div>
          <ul className="foot-b">
            <li>Synthetic data only. No real patients appear anywhere in this product.</li>
            <li>Decision support, not legal or medical advice. A person reviews and sends every appeal.</li>
            <li>CPT © American Medical Association. All rights reserved.</li>
          </ul>
        </div>
      </footer>
    </div>
  )
}

// ---------------- five outcomes band ----------------
function Outcomes({ counts }: { counts: Record<string, number> }) {
  return (
    <motion.ol className="outcomes" initial="off" whileInView="on" viewport={{ once: true, amount: 0, margin: "0px 0px 15% 0px" }}>
      {ORDER.map((v, i) => {
        const x = VERDICT[v]
        return (
          <motion.li key={v} variants={{ off: { opacity: 0, y: 12 }, on: { opacity: 1, y: 0, transition: { duration: 0.64, ease: EASE_ENTER, delay: 0.15 + i * 0.075 } } }}>
            <span className={`out-g t-${x.tone}`}><Glyph name={x.glyph} size={20} /></span>
            <span className="out-t">
              <b className={`t-${x.tone}`}>{x.label}</b>
              <span>{x.line}</span>
            </span>
            <span className="out-n num" aria-label={`${counts[v] ?? 0} in the demo queue`}>{counts[v] ?? 0}</span>
          </motion.li>
        )
      })}
    </motion.ol>
  )
}

// ---------------- how it works: four steps, real screens ----------------
function HowSteps({ a, b }: { a: CaseDetail; b: CaseDetail }) {
  const steps = ["Read the faxed denial letter", "Fetch the policy for that date", "Check each rule against the chart", "Draft the appeal, then gate it"]
  const [i, setI] = useState(0)
  const [hold, setHold] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!inView || hold || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const t = window.setTimeout(() => setI((x) => (x + 1) % steps.length), 6500)
    return () => window.clearTimeout(t)
  }, [i, inView, hold, steps.length])

  return (
    <div className="lhw" ref={box} onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)}>
      <ol className="lhw-steps">
        {steps.map((s, k) => (
          <li key={s}>
            <button type="button" className={k === i ? "is-on" : ""} onClick={() => setI(k)} aria-pressed={k === i}>
              <span>{s}</span>
              {k === i && !hold && inView && (
                <motion.i key={`p${i}`} className="lhw-prog" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 6.5, ease: "linear" }} />
              )}
            </button>
          </li>
        ))}
      </ol>
      <div className="lhw-screen">
        <AnimatePresence mode="wait">
          <motion.div key={i} className="lhw-shot" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.2 } }} transition={{ duration: 0.64, ease: EASE_ENTER }}>
            {i === 0 && <ShotLetter d={a} />}
            {i === 1 && <ShotPolicy d={a} />}
            {i === 2 && <ShotRules d={a} />}
            {i === 3 && <ShotAppeal d={b} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function ShotLetter({ d }: { d: CaseDetail }) {
  const den = d.run.denial
  return (
    <div className="shot shot-letter" data-ui>
      <img src={`/api/cases/${d.id}/letter`} alt={`Synthetic denial letter for ${d.patient}`} loading="lazy" />
      <dl className="ui-card shot-fields">
        <div><dt className="lbl">Payer</dt><dd>{shortPayer(den.payer_name)}</dd></div>
        <div><dt className="lbl">CARC</dt><dd className="mono">{den.carc.join(", ")}</dd></div>
        <div><dt className="lbl">CPT</dt><dd className="mono">{den.cpt}</dd></div>
        <div><dt className="lbl">Date of service</dt><dd className="mono">{fmtDate(den.dos)}</dd></div>
        <div className="shot-by"><dt className="lbl">Read by</dt><dd>Nemotron 3.5 Super-VL</dd></div>
      </dl>
    </div>
  )
}

function ShotPolicy({ d }: { d: CaseDetail }) {
  const p = d.run.policy!
  const ids = new Set((d.run.matches ?? []).filter((m) => m.status !== "not_applicable").map((m) => m.criterion_id))
  const sents = d.sentences.filter((s) => s.n >= 44 && s.n <= 50)
  return (
    <div className="ui-card shot-policy" data-ui>
      <div className="ui-card-h">
        <span className="lbl">{policyLabel(p)} · effective {fmtDate(p.effective_from)}</span>
        <a className="mono textlink" href={p.url} target="_blank" rel="noreferrer">CMS Coverage API <ArrowUpRight size={12} /></a>
      </div>
      <ol className="sents">
        {sents.map((s) => {
          const on = s.criteria.some((c) => ids.has(c))
          return (
            <li key={s.n} className={on ? "is-rule" : ""}>
              <span className="mono s-n">S{s.n}</span>
              <span>{on ? <Highlight text={s.text} delay={0.2} /> : s.text}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ShotRules({ d }: { d: CaseDetail }) {
  const ms = (d.run.matches ?? []).filter((m) => m.status !== "not_applicable").slice(0, 5)
  return (
    <div className="ui-card shot-rules" data-ui>
      <div className="ui-card-h">
        <span className="lbl">{d.patient} · {d.id}</span>
        <Mark tone={VERDICT[d.run.verdict].tone} glyph="ring" label={VERDICT[d.run.verdict].label} size={13} />
      </div>
      <ul>
        {ms.map((m, k) => {
          const c = d.run.criteria?.find((x) => x.criterion_id === m.criterion_id)
          const miss = m.status === "missing_documentation"
          const ev = m.evidence.find((e) => e.verified)
          return (
            <motion.li key={m.criterion_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_ENTER, delay: 0.15 + k * 0.05 }}>
              <span className={miss ? "t-warn" : "t-pos"}><Glyph name={miss ? "ring" : "check"} size={14} /></span>
              <span className="sr-t">
                <b>{c ? shortRule(c.summary) : m.criterion_id}</b>
                {ev && <q>{ev.quote}</q>}
              </span>
              <span className="mono sr-a">{d.addresses[m.criterion_id]}</span>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}

function ShotAppeal({ d }: { d: CaseDetail }) {
  const g = d.run.gate!
  const ok = g.checks.filter((c) => c.status === "verified").length
  const q = g.checks.find((c) => c.source_id.startsWith("L"))
  return (
    <div className="ui-card shot-appeal" data-ui>
      <div className="ui-card-h">
        <span className="lbl">Appeal letter · {d.patient}</span>
        <span className="mark t-verified"><Glyph name="check" size={13} /> {ok} of {g.checks.length} quotes verified</span>
      </div>
      <div className="paper">
        <b>Applicable coverage policy</b>
        <p>The policy ({d.run.policy?.policy_id} v{d.run.policy?.version}) establishes criteria for lumbar MRI coverage in non-red flag conditions:</p>
        {q && (
          <blockquote>
            <Highlight text={q.text} delay={0.3} />
            <cite className="mono">{d.policy_citation}</cite>
          </blockquote>
        )}
      </div>
      <div className="gate-cells" aria-hidden="true">
        {g.checks.map((c, k) => (
          <motion.i key={k} className={c.source_id.startsWith("case_") ? "k-chart" : "k-pol"} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: EASE_ENTER, delay: 0.3 + k * 0.025 }} />
        ))}
      </div>
    </div>
  )
}

// ---------------- prevention: earliest qualifying date ----------------
interface CheckDetail {
  id: string
  patient: string
  check: {
    request: { payer_name: string; planned_dos: string }
    readiness: string
    earliest: string | null
    earliest_basis: string[]
    facts: { conservative_days: number | null; treatments: { kind: string; start: string | null; end: string | null }[] } | null
  }
}
function Prevention() {
  const { data } = useJSON<CheckDetail>("/api/checks/case_009")
  if (!data) return <div className="ui-card prev prev-skel" data-ui />
  const ch = data.check
  const tr = (ch.facts?.treatments ?? []).filter((t) => t.start)
  const start = tr.map((t) => t.start!).sort()[0]
  const last = tr.map((t) => t.end ?? t.start!).sort().pop()!
  const pts = [
    { k: "Care starts", d: start, cls: "" },
    { k: `${ch.facts?.conservative_days ?? "?"} days documented`, d: last, cls: "" },
    { k: "Six weeks reached", d: ch.earliest!, cls: "is-key" },
    { k: "Planned scan", d: ch.request.planned_dos, cls: "is-plan" },
  ]
  const t0 = Date.parse(start), t1 = Date.parse(ch.request.planned_dos)
  const x = (d: string) => 6 + ((Date.parse(d) - t0) / (t1 - t0)) * 74
  return (
    <div className="ui-card prev" data-ui>
      <div className="ui-card-h">
        <span className="lbl">Prior-auth check · {data.patient}</span>
        <Mark tone="clay" glyph="pause" label="Not yet" size={13} />
      </div>
      <div className="ltl" role="img" aria-label={`Earliest qualifying date ${fmtDate(ch.earliest!)}`}>
        <span className="ltl-line" />
        <motion.span className="ltl-fill" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE_ENTER, delay: 0.2 }} style={{ width: `${x(last) - 6}%` }} />
        {pts.map((p, k) => (
          <span key={k} className={`ltl-pt ${p.cls} ${["is-start", "is-up is-end", "", "is-up is-start"][k] ?? ""}`} style={{ left: `${x(p.d)}%` }}>
            <i />
            <span className="ltl-lab">
              <b className="mono">{fmtDate(p.d, false)}</b>
              <span>{p.k}</span>
            </span>
          </span>
        ))}
      </div>
      <p className="prev-basis">{ch.earliest_basis[0]}</p>
    </div>
  )
}

