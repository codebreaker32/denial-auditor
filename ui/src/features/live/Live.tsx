// Run live: the passcode-gated live run. POST /api/live starts a job; GET /api/live/{job} is polled once a
// second. The server sends an activity feed (`events`): each step's start, what it found, one line per rule as
// its check completes, and the recommendation. The active step shows that feed as it arrives; finished steps fold to
// their one-line result and open again on a click. A refusal before the job starts is said on the form.
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { ArrowRight, ChevronDown, Play } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react"
import { invalidateCases, useCases } from "@/lib/api"
import { go } from "@/lib/router"
import { STATUS, VERDICT, baseName, initials, shortPayer, type Row, type Status, type Verdict } from "@/lib/data"
import { EASE_ENTER, EASE_OUT, enter, prefersReducedMotion } from "@/lib/motion"
import { Glyph, Mark, Press } from "@/features/ui"
import "@/features/case/case.css"
import "./live.css"

const STAGES = [
  { match: "Reading the denial", title: "Read the faxed denial" },
  { match: "Triage", title: "Sort it by the payer's reason" },
  { match: "Finding the policy", title: "Find the policy in effect on the service date" },
  { match: "Splitting the policy", title: "List what the policy requires" },
  { match: "Extracting chart facts", title: "Read the chart" },
  { match: "Checking", title: "Check every rule against the chart" },
  { match: "Drafting", title: "Draft the appeal and check its quotes" },
  { match: "Done", title: "Recommendation" },
]
const MATCH_STEP = 5
// Older servers send only the progress strings, which name models and costs; a biller sees the plain part only.
function plainMsg(m: string): string {
  const done = /^Done: ([a-z_ ]+)/i.exec(m)
  if (done) {
    const v = done[1].trim().replace(/ /g, "_") as keyof typeof VERDICT
    return VERDICT[v] ? `Recommendation: ${VERDICT[v].label}` : "Finished"
  }
  return m.replace(/\s*\([^)]*\)/g, "").replace(/\s*·\s*\$[\d.]+/g, "").replace(/, payer-reviewer critique.*$/i, " and check its quotes").trim()
}
type Kind = "wait" | "now" | "done" | "skip" | "stop"
type Ev = {
  at: number; step: number; kind: "start" | "detail" | "rule" | "done"; text: string
  status?: Status; ref?: string; id?: string; summary?: string; span?: string; total?: number; verdict?: Verdict
}
type Job = { state: "running" | "done" | "error"; steps: string[]; events?: Ev[]; error: string | null }
type Phase = "idle" | "starting" | "running" | "done" | "error"
type Stage = (typeof STAGES)[number] & { kind: Kind; msg: string; evs: Ev[]; took: number | null }

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

// What a finished step folds to: the line that says what it found.
function resultLine(i: number, evs: Ev[]): string {
  const details = evs.filter((e) => e.kind === "detail" && !e.id)
  if (i === MATCH_STEP) return tallyLine(evs.filter((e) => e.kind === "rule"), true)
  if (i === 7) return (evs.find((e) => e.kind === "done")?.text ?? "").replace(/^Recommendation:\s*/, "").replace(/^./, (c) => c.toUpperCase())
  const pick = i === 6 ? details[details.length - 1] : details[0]
  const t = pick?.text ?? ""
  if (i === 0) return t.replace(/^Read the denial:\s*/, "")
  if (i === 2) return t.replace(/ version (\S+), in effect on the service date.*$/, " v$1 · in effect on the service date")
  return t
}

const TALLY: [Status, string][] = [["met", "supported"], ["missing_documentation", "missing docs"], ["not_met", "blocking"], ["not_applicable", "don't apply"]]
function tallyLine(rules: Ev[], final = false): string {
  const total = rules[0]?.total ?? rules.length
  const parts = TALLY.map(([s, w]) => [rules.filter((r) => r.status === s).length, w] as const).filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}`)
  return [final ? `${total} rules checked` : `${rules.length} of ${total} rules checked`, ...parts].join(" · ")
}

function stagesFrom(job: Job | null, phase: Phase): Stage[] {
  const events = job?.events ?? []
  if (!events.length) {
    // Fallback for a server without the feed: mark steps from the progress strings.
    const steps = job?.steps ?? []
    const reached = STAGES.map((st) => steps.findIndex((m) => m.startsWith(st.match)))
    const last = Math.max(-1, ...reached.map((r, i) => (r >= 0 ? i : -1)))
    return STAGES.map((st, i) => {
      const kind: Kind = reached[i] < 0 ? (i < last ? "skip" : "wait") : i === last && phase === "running" ? "now" : i === last && phase === "error" ? "stop" : "done"
      return { ...st, kind, msg: reached[i] >= 0 ? plainMsg(steps[reached[i]]) : "", evs: [], took: null }
    })
  }
  const begun = new Set(events.filter((e) => e.kind === "start" || e.kind === "done").map((e) => e.step))
  const last = Math.max(...events.map((e) => e.step))
  const startAt = (i: number) => events.find((e) => e.step === i)?.at
  return STAGES.map((st, i) => {
    const evs = events.filter((e) => e.step === i)
    const kind: Kind = !begun.has(i) ? (i < last ? "skip" : "wait") : i === last && phase === "running" ? "now" : i === last && phase === "error" ? "stop" : "done"
    const a = startAt(i)
    const next = events.find((e) => e.step > i)?.at
    const took = kind === "done" && a != null && next != null && i < 7 ? Math.max(0, next - a) : null
    return { ...st, kind, msg: kind === "done" || kind === "stop" ? resultLine(i, evs) : "", evs, took }
  })
}

// The newest line stays in view while the reader is at the bottom; scrolling up to read holds the place.
function useFollow(dep: number) {
  const ref = useRef<HTMLUListElement>(null)
  const stuck = useRef(true)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && stuck.current) el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" })
  }, [dep])
  const onScroll = () => {
    const el = ref.current
    if (el) stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }
  return { ref, onScroll }
}

const LINE = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.42, ease: EASE_ENTER } }

function Feed({ evs, live, total, elapsed = 0 }: { evs: Ev[]; live: boolean; total?: boolean; elapsed?: number }) {
  const lines = evs.filter((e) => e.kind !== "rule" && !e.id && e.kind !== "done")
  const { ref, onScroll } = useFollow(lines.length)
  return (
    <ul className="lv-feed" ref={ref} onScroll={onScroll}>
      {lines.map((e, i) => {
        const now = live && i === lines.length - 1 && !total
        return (
          <motion.li key={`${e.at}-${i}`} className={`lv-line ${now ? "is-now" : ""}`} {...LINE}>
            <span className="lv-line-dot" aria-hidden="true">{now ? <span className="lv-spin lv-spin-ink" /> : <span className="lv-tick" />}</span>
            <span className="lv-line-t">{e.text}</span>
            <span className="lv-line-at num" title={now ? "Time on this so far" : "Time since the run started"}>
              {now ? `${Math.max(0, Math.round(elapsed - e.at))} s so far` : clock(e.at)}
            </span>
          </motion.li>
        )
      })}
    </ul>
  )
}

function RuleFeed({ evs, live, elapsed }: { evs: Ev[]; live: boolean; elapsed: number }) {
  const rules = evs.filter((e) => e.kind === "rule")
  const second = new Set(evs.filter((e) => e.kind === "detail" && e.id).map((e) => e.id))
  const total = rules[0]?.total ?? 0
  const names = rules.map((r) => (r.summary && r.span ? baseName({ criterion_id: r.id ?? "", summary: r.summary, verbatim_span: r.span }) : r.text))
  const dup = (n: string) => names.filter((x) => x === n).length > 1
  const { ref, onScroll } = useFollow(rules.length)
  const pct = total ? Math.round((rules.length / total) * 100) : 0
  return (
    <>
      <Feed evs={evs.filter((e) => e.kind === "start")} live={live && !rules.length} elapsed={elapsed} />
      {rules.length > 0 && (
        <div className="lv-tally">
          <p className="lv-tally-t num">{tallyLine(rules)}</p>
          <span className="lv-bar" role="progressbar" aria-label="Rules checked" aria-valuemin={0} aria-valuemax={total} aria-valuenow={rules.length}>
            <motion.span className="lv-bar-fill" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: EASE_OUT }} />
          </span>
        </div>
      )}
      <ul className="lv-rules" ref={ref} onScroll={onScroll}>
        {rules.map((r, i) => {
          const st = STATUS[r.status ?? "not_applicable"]
          return (
            <motion.li key={r.id ?? i} className="lv-rule" {...LINE}>
              <span className={`rr-st t-${st.tone}`}>
                <Glyph name={st.glyph} size={14} />
                <span>{st.label}</span>
              </span>
              <span className="lv-rule-n">
                {names[i]}
                {dup(names[i]) && r.ref ? ` ${r.ref}` : ""}
                {second.has(r.id) && <span className="lv-rule-2">Second look settled this one</span>}
              </span>
              {r.ref && <span className="sec num">{r.ref}</span>}
              <span className="lv-line-at num">{clock(r.at)}</span>
            </motion.li>
          )
        })}
        {live && rules.length > 0 && rules.length < total && (
          <li className="lv-line is-now lv-rule-wait">
            <span className="lv-line-dot" aria-hidden="true"><span className="lv-spin lv-spin-ink" /></span>
            <span className="lv-line-t">Checking the other {total - rules.length} against the chart</span>
          </li>
        )}
      </ul>
    </>
  )
}

async function post(caseId: string, passcode: string): Promise<{ job?: string; status: number; detail?: string }> {
  try {
    const r = await fetch("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: caseId, passcode }) })
    const body = await r.json().catch(() => ({}))
    return r.ok ? { job: body.job, status: r.status } : { status: r.status, detail: typeof body.detail === "string" ? body.detail : undefined }
  } catch (e) {
    return { status: 0, detail: (e as Error).message }
  }
}

export function Live() {
  const { data } = useCases()
  const available = data?.available ?? []
  const left = data?.live_left
  const total = data?.live_total ?? 10
  const enabled = (data?.live_enabled ?? true) && left !== 0
  const [caseId, setCaseId] = useState("case_015")
  const [pass, setPass] = useState("")
  const [passErr, setPassErr] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [job, setJob] = useState<Job | null>(null)
  const [ranCase, setRanCase] = useState<string | null>(null)
  const [secs, setSecs] = useState(0)
  const [unfolded, setUnfolded] = useState<Set<number>>(new Set())
  const passRef = useRef<HTMLInputElement>(null)
  const alive = useRef(true)

  useEffect(() => {
    if (available.length && !available.includes(caseId)) setCaseId(available[0])
  }, [available, caseId])
  useEffect(() => {
    alive.current = true
    return () => void (alive.current = false)
  }, [])
  useEffect(() => {
    if (phase !== "running") return
    const t0 = Date.now() - secs * 1000
    const t = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const row: Row | undefined = data?.cases.find((c) => c.id === caseId)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (phase === "starting" || phase === "running" || !enabled) return
    setPassErr(null)
    setFormErr(null)
    if (!pass.trim()) {
      setPassErr("Enter the demo passcode. It's in the Devpost testing instructions.")
      passRef.current?.focus()
      return
    }
    setPhase("starting")
    const r = await post(caseId, pass)
    if (!alive.current) return
    if (!r.job) {
      setPhase("idle")
      if (r.status === 401) {
        setPassErr("That passcode isn't right. It's in the Devpost testing instructions.")
        passRef.current?.focus()
        passRef.current?.select()
      } else if (r.status === 403) setFormErr("Live runs are off on this deployment. The precomputed cases are free to explore.")
      else if (r.status === 429) setFormErr(r.detail ?? "Today's live-run limit has been reached.")
      else setFormErr(`Didn't start${r.detail ? `: ${r.detail}` : "."}`)
      return
    }
    setRanCase(caseId)
    setSecs(0)
    setUnfolded(new Set())
    setJob({ state: "running", steps: [], events: [], error: null })
    setPhase("running")
    const poll = async () => {
      let s: Job | null = null
      let fail: string | null = null
      try {
        const res = await fetch(`/api/live/${r.job}`)
        if (res.ok) s = await res.json()
        else fail = `Status check answered ${res.status}`
      } catch (err) {
        fail = (err as Error).message
      }
      if (!alive.current) return
      if (!s) {
        // Keep what the feed already showed; say why it stopped.
        setJob((j) => ({ ...(j ?? { steps: [], events: [] }), state: "error", error: fail }))
        setPhase("error")
        return
      }
      setJob(s)
      if (s.state === "running") setTimeout(poll, 1000)
      else {
        if (s.state === "done") invalidateCases(caseId)
        setPhase(s.state === "done" ? "done" : "error")
      }
    }
    poll()
  }

  const stages = stagesFrom(job, phase)
  const nowIdx = stages.findIndex((s) => s.kind === "now")
  const events = job?.events ?? []
  const latest = events[events.length - 1]
  const doneEv = events.find((e) => e.kind === "done")
  const rulesChecked = events.filter((e) => e.kind === "rule").length
  const quoteLine = stages[6].evs.filter((e) => e.kind === "detail").map((e) => e.text).reverse().find((t) => t.startsWith("Checking every quote"))
  const toggle = (i: number) =>
    setUnfolded((u) => {
      const n = new Set(u)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  const busy = phase === "starting" || phase === "running"

  // The worklist and the case read cached answers; drop them so the live result shows without a reload.
  const openCase = () => {
    if (!ranCase) return
    invalidateCases(ranCase)
    go(`#/app/c/${ranCase}`)
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="page lv">
      <motion.header className="page-h" {...enter(0)}>
        <h1>Run live</h1>
        <p>Check a synthetic denial from scratch: read the letter, fetch the policy in effect on the date of service, check the chart and draft the appeal. Takes one to three minutes.</p>
      </motion.header>

      <div className="lv-grid">
        <motion.form className="lv-form" onSubmit={submit} noValidate {...enter(1)} aria-label="Start a live run">
          {!enabled && <p className="lv-off"><Glyph name="pause" size={14} /> Live runs are off on this deployment.</p>}
          <div className="lv-field">
            <label htmlFor="lv-case" className="lbl">Synthetic case</label>
            <select id="lv-case" className="lv-input" value={caseId} onChange={(e) => setCaseId(e.target.value)} disabled={busy}>
              {(available.length ? available : [caseId]).map((c, i) => {
                const p = data?.cases.find((x) => x.id === c)?.patient
                return <option key={c} value={c}>{p ?? `Synthetic chart ${i + 1}`}</option>
              })}
            </select>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={caseId}
              className="lv-prev"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              {row ? (
                <>
                  <span className={`avatar t-${VERDICT[row.verdict].tone}`} aria-hidden="true">{initials(row.patient)}</span>
                  <span className="lv-prev-t">
                    <b>{row.patient}</b>
                    <span>{shortPayer(row.payer)} · <span className="num">CPT {row.cpt}</span></span>
                  </span>
                  <span className="lv-prev-v">
                    <span className="lbl">Saved result</span>
                    <Mark tone={VERDICT[row.verdict].tone} glyph={VERDICT[row.verdict].glyph} label={VERDICT[row.verdict].label} size={13} />
                  </span>
                </>
              ) : (
                <span className="lv-prev-t"><span>Not checked yet. This run would be its first.</span></span>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="lv-field">
            <label htmlFor="lv-pass" className="lbl">Demo passcode</label>
            <input
              id="lv-pass"
              ref={passRef}
              className="lv-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={pass}
              onChange={(e) => {
                setPass(e.target.value)
                if (passErr) setPassErr(null)
              }}
              placeholder="From the Devpost testing instructions"
              aria-invalid={passErr ? true : undefined}
              aria-describedby={passErr ? "lv-pass-err" : "lv-pass-hint"}
              disabled={busy}
            />
            <AnimatePresence initial={false}>
              {passErr ? (
                <motion.p
                  key="err"
                  id="lv-pass-err"
                  className="lv-err"
                  role="alert"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: [0, -3, 3, -2, 0] }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.36, ease: EASE_OUT }}
                >
                  <Glyph name="cross" size={13} /> {passErr}
                </motion.p>
              ) : (
                <p key="hint" id="lv-pass-hint" className="lv-hint">A shared code for this demo, not an account password.</p>
              )}
            </AnimatePresence>
          </div>

          <Press type="submit" className="pill pill-ink lv-go" disabled={busy || !enabled} aria-disabled={busy || !enabled}>
            {busy ? <span className="lv-spin" aria-hidden="true" /> : <Play size={14} strokeWidth={2} />}
            {phase === "starting" ? "Checking passcode" : phase === "running" ? "Running" : phase === "done" ? "Run again" : "Run live"}
          </Press>
          {formErr && (
            <p className="lv-err" role="alert">
              <Glyph name="cross" size={13} /> {formErr}
            </p>
          )}
          <p className="lv-small">
            {left === 0
              ? `All ${total} live runs for this demo have been used. The saved cases show the same pipeline's output.`
              : `${left ?? total} of ${total} live runs left on this demo. Each run makes real model calls, about $0.06.`}
          </p>
        </motion.form>

        <motion.section className="lv-run" aria-label="Progress" {...enter(2)}>
          <header className="lv-run-h">
            <h2>Progress</h2>
            <span className={`lv-clock num ${phase === "error" ? "t-neg" : ""}`}>
              {phase === "idle" || phase === "starting" ? "Not started" : phase === "running" ? `Running · ${clock(secs)}` : phase === "done" ? `Finished in ${clock(secs)}` : `Stopped after ${clock(secs)}`}
            </span>
          </header>
          <p className="sr" aria-live="polite">
            {phase === "error" ? "Run stopped" : latest ? (latest.kind === "rule" ? `${latest.text}: ${STATUS[latest.status ?? "not_applicable"].label}` : latest.text) : nowIdx >= 0 ? `Step ${nowIdx + 1} of ${STAGES.length}: ${stages[nowIdx].title}` : ""}
          </p>
          <ol className={`lv-steps ${phase === "idle" ? "is-idle" : ""}`}>
            {stages.map((s, i) => {
              const canOpen = (s.kind === "done" || s.kind === "stop") && s.evs.length > 0 && i < 7
              const open = s.kind === "now" || (canOpen && unfolded.has(i))
              const body = `lv-body-${i}`
              const head = (
                <>
                  <span className="lv-dot" aria-hidden="true">
                    {s.kind === "done" ? <Glyph name="check" size={16} className="t-pos" /> : s.kind === "stop" ? <Glyph name="cross" size={16} className="t-neg" /> : s.kind === "skip" ? <Glyph name="dash" size={16} className="t-quiet" /> : s.kind === "now" ? <span className="lv-pulse" /> : <span className="lv-idx num">{i + 1}</span>}
                  </span>
                  <span className="lv-step-t">
                    <b>{s.title}</b>
                    <AnimatePresence initial={false}>
                      {(s.msg || s.kind === "skip") && !open && (
                        <motion.span
                          className="lv-msg"
                          initial={{ opacity: 0, y: -4, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: "auto" }}
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                          transition={{ duration: 0.4, ease: EASE_ENTER }}
                        >
                          {s.kind === "skip" ? "Not needed for this denial" : s.msg}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className={`lv-word ${s.kind === "done" ? "t-pos" : s.kind === "stop" ? "t-neg" : s.kind === "now" ? "t-ink" : "t-quiet"}`}>
                    {{ done: "Done", now: "Running", wait: "Waiting", skip: "Skipped", stop: "Stopped" }[s.kind]}
                    {s.took != null && <span className="lv-took num"> · {s.took < 1 ? "<1" : Math.round(s.took)} s</span>}
                    {canOpen && <ChevronDown size={15} strokeWidth={1.7} className={`lv-x ${open ? "is-open" : ""}`} aria-hidden="true" />}
                  </span>
                </>
              )
              return (
                <li key={s.match} className={`lv-step is-${s.kind} ${open ? "is-open" : ""}`}>
                  {canOpen ? (
                    <button type="button" className="lv-step-h" onClick={() => toggle(i)} aria-expanded={open} aria-controls={body}>
                      {head}
                    </button>
                  ) : (
                    <div className="lv-step-h">{head}</div>
                  )}
                  <AnimatePresence initial={false}>
                    {open && s.evs.length > 0 && (
                      <motion.div
                        id={body}
                        className="lv-body"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                        transition={{ duration: 0.36, ease: EASE_OUT }}
                      >
                        {i === MATCH_STEP ? <RuleFeed evs={s.evs} live={s.kind === "now"} elapsed={secs} /> : <Feed evs={s.evs} live={s.kind === "now"} elapsed={secs} />}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ol>
          <AnimatePresence>
            {phase === "done" && (
              <motion.div className="lv-sum" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_ENTER }}>
                {doneEv?.verdict && VERDICT[doneEv.verdict] ? (
                  <Mark tone={VERDICT[doneEv.verdict].tone} glyph={VERDICT[doneEv.verdict].glyph} label={VERDICT[doneEv.verdict].label} size={16} className="lv-sum-v" />
                ) : (
                  <Mark tone="pos" glyph="check" label="Finished" />
                )}
                <p className="lv-sum-t">{doneEv?.verdict && VERDICT[doneEv.verdict] ? VERDICT[doneEv.verdict].line : "The run finished."}{doneEv && /blocked|to request/.test(doneEv.text) ? ` ${resultLine(7, [doneEv]).replace(/^[^(]*\((.*)\)$/, "$1").replace(/^./, (c) => c.toUpperCase())}.` : ""}</p>
                <p className="lv-sum-m num">
                  {[`Finished in ${clock(secs)}`, rulesChecked ? `${rulesChecked} rules checked` : "", quoteLine ? quoteLine.replace(/^Checking every quote: /, "").replace(/ match the fetched text.*$/, " quotes match") : ""].filter(Boolean).join(" · ")}
                </p>
                <Press className="pill pill-ink pill-sm" onClick={openCase}>
                  Open the case <ArrowRight size={14} strokeWidth={1.8} className="nudge" />
                </Press>
              </motion.div>
            )}
            {phase === "error" && (
              <motion.p className="lv-after lv-stop" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_ENTER }}>
                <Mark tone="neg" glyph="cross" label="Stopped" />
                <span>{job?.error ?? "The run stopped."}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </motion.section>
      </div>
    </div>
    </MotionConfig>
  )
}
