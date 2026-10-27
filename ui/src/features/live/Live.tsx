// Run live: the passcode-gated live run. POST /api/live starts a job; GET /api/live/{job} is polled once a
// second and each pipeline step is shown as it arrives. A refusal before the job starts is said on the form.
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Play } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { invalidateCases, useCases } from "@/lib/api"
import { go } from "@/lib/router"
import { VERDICT, initials, shortPayer, type Row } from "@/lib/data"
import { EASE_ENTER, EASE_OUT, enter } from "@/lib/motion"
import { Glyph, Mark, Press } from "@/features/ui"
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
// The server's progress lines name models and costs; a biller sees the plain part only.
function plainMsg(m: string): string {
  const done = /^Done: ([a-z_ ]+)/i.exec(m)
  if (done) {
    const v = done[1].trim().replace(/ /g, "_") as keyof typeof VERDICT
    return VERDICT[v] ? `Recommendation: ${VERDICT[v].label}` : "Finished"
  }
  return m.replace(/\s*\([^)]*\)/g, "").replace(/\s*·\s*\$[\d.]+/g, "").replace(/, payer-reviewer critique.*$/i, " and check its quotes").trim()
}
type Kind = "wait" | "now" | "done" | "skip"
type Job = { state: "running" | "done" | "error"; steps: string[]; error: string | null }
type Phase = "idle" | "starting" | "running" | "done" | "error"

function stageKinds(steps: string[], running: boolean) {
  const reached = STAGES.map((st) => steps.findIndex((m) => m.startsWith(st.match)))
  const last = Math.max(-1, ...reached.map((r, i) => (r >= 0 ? i : -1)))
  return STAGES.map((st, i) => {
    const kind: Kind = reached[i] < 0 ? (i < last ? "skip" : "wait") : i === last && running ? "now" : "done"
    return { ...st, kind, msg: reached[i] >= 0 ? plainMsg(steps[reached[i]]) : "" }
  })
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
  const enabled = data?.live_enabled ?? true
  const [caseId, setCaseId] = useState("case_015")
  const [pass, setPass] = useState("")
  const [passErr, setPassErr] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [job, setJob] = useState<Job | null>(null)
  const [ranCase, setRanCase] = useState<string | null>(null)
  const [secs, setSecs] = useState(0)
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
    setJob({ state: "running", steps: [], error: null })
    setPhase("running")
    const poll = async () => {
      let s: Job
      try {
        const res = await fetch(`/api/live/${r.job}`)
        s = res.ok ? await res.json() : { state: "error", steps: [], error: `Status check answered ${res.status}` }
      } catch (err) {
        s = { state: "error", steps: [], error: (err as Error).message }
      }
      if (!alive.current) return
      setJob(s)
      if (s.state === "running") setTimeout(poll, 1000)
      else {
        if (s.state === "done") invalidateCases(caseId)
        setPhase(s.state === "done" ? "done" : "error")
      }
    }
    poll()
  }

  const stages = stageKinds(job?.steps ?? [], phase === "running")
  const nowIdx = stages.findIndex((s) => s.kind === "now")
  const busy = phase === "starting" || phase === "running"

  // The worklist and the case read cached answers; drop them so the live result shows without a reload.
  const openCase = () => {
    if (!ranCase) return
    invalidateCases(ranCase)
    go(`#/app/c/${ranCase}`)
  }

  return (
    <div className="page lv">
      <motion.header className="page-h" {...enter(0)}>
        <h1>Run live</h1>
        <p>Check a synthetic denial from scratch: read the letter, fetch today's policy, check the chart and draft the appeal. Takes one to three minutes.</p>
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
          <p className="lv-small">30 live runs a day across all visitors.</p>
        </motion.form>

        <motion.section className="lv-run" aria-label="Progress" {...enter(2)}>
          <header className="lv-run-h">
            <h2>Progress</h2>
            <span className={`lv-clock num ${phase === "error" ? "t-neg" : ""}`}>
              {phase === "idle" || phase === "starting" ? "Not started" : phase === "running" ? `Running · ${secs} s` : phase === "done" ? `Finished in ${secs} s` : `Stopped after ${secs} s`}
            </span>
          </header>
          <p className="sr" aria-live="polite">
            {nowIdx >= 0 ? `Step ${nowIdx + 1} of ${STAGES.length}: ${stages[nowIdx].title}` : phase === "done" ? "Run finished" : phase === "error" ? "Run stopped" : ""}
          </p>
          <ol className={`lv-steps ${phase === "idle" ? "is-idle" : ""}`}>
            {stages.map((s, i) => (
              <li key={s.match} className={`lv-step is-${s.kind}`}>
                <span className="lv-dot" aria-hidden="true">
                  {s.kind === "done" ? <Glyph name="check" size={16} className="t-pos" /> : s.kind === "skip" ? <Glyph name="dash" size={16} className="t-quiet" /> : s.kind === "now" ? <span className="lv-pulse" /> : <span className="lv-idx num">{i + 1}</span>}
                </span>
                <span className="lv-step-t">
                  <b>{s.title}</b>
                  <AnimatePresence initial={false}>
                    {(s.msg || s.kind === "skip") && (
                      <motion.span
                        className="lv-msg"
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        transition={{ duration: 0.4, ease: EASE_ENTER }}
                      >
                        {s.kind === "skip" ? "Not needed for this denial" : s.msg}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className={`lv-word ${s.kind === "done" ? "t-pos" : s.kind === "now" ? "t-ink" : "t-quiet"}`}>
                  {{ done: "Done", now: "Running", wait: "Waiting", skip: "Skipped" }[s.kind]}
                </span>
              </li>
            ))}
          </ol>
          <AnimatePresence>
            {phase === "done" && (
              <motion.div className="lv-after" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_ENTER }}>
                <Mark tone="pos" glyph="check" label="Finished" />
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
  )
}
