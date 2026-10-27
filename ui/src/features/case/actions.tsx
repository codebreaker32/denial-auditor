// The next step for each recommendation, each with exactly one primary action that does something real:
// copy the physician request, work the fix checklist, see what's missing and when it can qualify, or explain
// a plan exclusion to the patient. Nothing is sent by the tool; a person does that.
import { AnimatePresence, motion } from "framer-motion"
import { Check, Copy } from "lucide-react"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { EASE_OUT } from "@/lib/motion"
import { fmtDate, sec, secLong, shortPayer, type CaseDetail, type Facts } from "@/lib/data"
import { Glyph, Mark, Press } from "@/features/ui"
import { postGate, type GateResp } from "@/features/appeal/Appeal"
import {
  carcLine, carcMeaning, copyText, countWait, fixPlain, insteadOf, lc1, patientNote, physicianNote, reorderPlain, squash, thresholdFor,
  type Hold, type Prepped,
} from "./model"
import { notify } from "@/features/toast"
import { WORK, getFix, getWork, setFix, setWork, type WorkStatus } from "./work"

// The pane's one primary command, with a short line beside it.
function ActBar({ title, line, label, onRun, icon = "copy" }: { title: string; line: ReactNode; label: string; onRun: () => Promise<boolean> | boolean; icon?: "copy" }) {
  const [done, setDone] = useState<null | "ok" | "fail">(null)
  useEffect(() => {
    if (!done) return
    const t = window.setTimeout(() => setDone(null), 1800)
    return () => window.clearTimeout(t)
  }, [done])
  return (
    <div className="act-bar">
      <div className="act-t">
        <h3>{title}</h3>
        <p>{line}</p>
      </div>
      <Press className="pill pill-ink pill-sm act-go" onClick={async () => setDone((await onRun()) ? "ok" : "fail")}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={done ?? "idle"} className="ap-ex-t" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.16 }}>
            {done === "ok" ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : icon === "copy" ? <Copy size={13} strokeWidth={1.8} aria-hidden="true" /> : null}
            {done === "ok" ? "Copied" : done === "fail" ? "Couldn't copy" : label}
          </motion.span>
        </AnimatePresence>
      </Press>
    </div>
  )
}

// Copy, then move the case's work state with an undo.
async function copyAndMark(caseId: string, text: string, to: WorkStatus | null, msg: string) {
  const ok = await copyText(text)
  if (ok && to) {
    const before = getWork(caseId).status
    if (before !== to && before !== "sent") {
      setWork(caseId, to)
      notify(msg, () => setWork(caseId, before), `Marked ${WORK[to].label}.`)
    }
  }
  return ok
}

function Missing({ items, onRule, policy }: { items: Prepped[]; onRule: (id: string) => void; policy: CaseDetail["run"]["policy"] }) {
  if (!items.length) return null
  return (
    <ul className="miss">
      {items.map((m) => (
        <li key={m.criterion_id}>
          <Glyph name={m.show === "not_met" ? "cross" : "half"} size={14} className={m.show === "not_met" ? "t-neg" : "t-warn"} />
          <span>{m.crit.summary}</span>
          {m.addr && (
            <button type="button" className="chip" onClick={() => onRule(m.criterion_id)} title={`Open this rule (${secLong(policy, m.addr)})`}>
              {sec(m.addr)}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

// ---------- Ask the physician ----------
export function RequestPane({ d, ms, onRule }: { d: CaseDetail; ms: Prepped[]; onRule: (id: string) => void }) {
  const text = d.run.doc_request ?? ""
  const missing = ms.filter((m) => m.show === "missing_documentation")
  return (
    <div className="pane">
      <ActBar
        title="Request to the physician"
        line="Copy it into your message to the physician. You send it; the tool never contacts anyone."
        label="Copy request"
        onRun={() => copyAndMark(d.id, text, "waiting", "Request copied")}
      />
      {missing.length > 0 && (
        <section className="cd-sec">
          <span className="lbl">Missing from the chart</span>
          <Missing items={missing} onRule={onRule} policy={d.run.policy} />
        </section>
      )}
      <pre className="sheet-doc" tabIndex={0} aria-label="Documentation request text">{text}</pre>
    </div>
  )
}

// ---------- Fix and resubmit ----------
export function FixPane({ d }: { d: CaseDetail }) {
  const items = d.run.triage.checklist
  const [done, setDone] = useState<Set<number>>(() => new Set(getFix(d.id).filter((i) => i < items.length)))
  const toggle = (i: number) => {
    const n = new Set(done)
    if (n.has(i)) n.delete(i)
    else n.add(i)
    setDone(n)
    setFix(d.id, [...n])
    if (n.size === items.length && items.length) {
      const before = getWork(d.id).status
      if (before === "todo") {
        setWork(d.id, "ready")
        notify("Checklist done", () => setWork(d.id, before), "Marked Ready to send. A person corrects and resends the claim.")
      }
    }
  }
  return (
    <div className="pane">
      <ActBar
        title="Fix checklist"
        line={
          <>
            {carcLine(d)} means {lc1(carcMeaning(d))}. That's a claim problem, not a medical one, so there's no policy to argue.
          </>
        }
        label="Copy checklist"
        onRun={() => copyText(fixPlain(d, done))}
      />
      <ul className="fix">
        {items.map((t, i) => (
          <li key={i}>
            <label className={done.has(i) ? "is-done" : ""}>
              <input type="checkbox" checked={done.has(i)} onChange={() => toggle(i)} />
              <motion.span className="fix-box" aria-hidden="true" animate={{ scale: done.has(i) ? [1, 0.86, 1] : 1 }} transition={{ duration: 0.22 }}>
                {done.has(i) && <Check size={12} strokeWidth={2.4} />}
              </motion.span>
              <span className="fix-t">{t}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="fix-n num" aria-live="polite">
        {done.size} of {items.length} done · kept in this browser
      </p>
      <p className="cd-note">The tool never resubmits anything. A person corrects the claim and sends it.</p>
    </div>
  )
}

// ---------- Not winnable ----------
export function WhyPane({ d }: { d: CaseDetail }) {
  const instead = insteadOf(d)
  const note = patientNote(d)
  return (
    <div className="pane">
      <ActBar
        title="Why it can't be won"
        line="The plan doesn't cover this service. That's a plan rule, not a judgment on the chart."
        label="Copy for the patient"
        onRun={() => copyText(note)}
      />
      <dl className="why">
        <div>
          <dt className="lbl">Reason code</dt>
          <dd>
            {carcLine(d)}: {lc1(carcMeaning(d))}
          </dd>
        </div>
        <div>
          <dt className="lbl">Payer said</dt>
          <dd>
            <q>{squash(d.run.denial.reason_text)}</q>
          </dd>
        </div>
        {instead && (
          <div>
            <dt className="lbl">Do instead</dt>
            <dd>{instead}</dd>
          </div>
        )}
      </dl>
      <section className="cd-sec">
        <span className="lbl">For the patient, plain words</span>
        <div className="sheet-doc is-prose" tabIndex={0} aria-label="Explanation for the patient">
          {note.split("\n\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <p className="cd-note">A person decides what to tell the patient. The tool never contacts anyone.</p>
      </section>
    </div>
  )
}

// ---------- Don't appeal yet / Reorder ----------
export function HoldPane({ d, h, alt, onRule }: { d: CaseDetail; h: Hold; alt: Facts | null; onRule: (id: string) => void }) {
  return h.early ? <ReorderPane d={d} h={h} alt={alt} onRule={onRule} /> : <DocsHold d={d} h={h} alt={alt} onRule={onRule} />
}

function DocsHold({ d, h, alt, onRule }: { d: CaseDetail; h: Hold; alt: Facts | null; onRule: (id: string) => void }) {
  const note = useMemo(() => physicianNote(d, h, alt), [d, h, alt])
  const wait = h.docs.map((m) => ({ m, t: thresholdFor(d, m.addr) })).find((x) => x.t)
  const k = wait?.t ? countWait(d, wait.t, alt) : null
  const reachedBeforeDos = !!h.reached && h.reached <= d.run.denial.dos
  return (
    <div className="pane">
      <ActBar
        title="What's missing"
        line="The chart doesn't meet the policy yet. A dated note could change that; appealing now would likely fail."
        label="Copy note to physician"
        onRun={() => (note.items.length ? copyAndMark(d.id, note.plain, "waiting", "Note copied") : false)}
      />
      <div className="hold">
        {k && k.n != null && (
          <div className="hold-f">
            <span className="lbl">Charted so far</span>
            <span className="hold-n num">
              {k.n}
              <span> days · policy needs {k.need}</span>
            </span>
            <Mark tone={k.tone} glyph={k.glyph} label={k.word} />
          </div>
        )}
        {h.reached && reachedBeforeDos && (
          <div className="hold-f">
            <span className="lbl">Wait reached</span>
            <span className="hold-d">{fmtDate(h.reached)}</span>
            <span className="hold-s">Before the {fmtDate(d.run.denial.dos, false)} service, if the care continued</span>
          </div>
        )}
        <div className="hold-f">
          <span className="lbl">Appeal window</span>
          <span className="hold-d">{fmtDate(d.deadline.due)}</span>
          <span className="hold-s">{d.deadline.days_left} days left · {d.deadline.citation}</span>
        </div>
      </div>
      <section className="cd-sec">
        <span className="lbl">Blocking rules</span>
        <Missing items={h.blockers} onRule={onRule} policy={d.run.policy} />
      </section>
      {note.items.length > 0 && <NoteSheet d={d} note={note} />}
    </div>
  )
}

function ReorderPane({ d, h, onRule }: { d: CaseDetail; h: Hold; alt: Facts | null; onRule: (id: string) => void }) {
  const now = h.newOrder === d.as_of
  return (
    <div className="pane">
      <ActBar
        title="When a new order can qualify"
        line="The service came before the policy's waits ended, so this denial can't be won on the chart. No note can change a service date."
        label="Copy for the file"
        onRun={() => copyText(reorderPlain(d, h))}
      />
      <div className="hold">
        <div className="hold-f is-key">
          <span className="lbl">Earliest new order</span>
          <span className="hold-d">{h.newOrder ? (now ? "Now" : fmtDate(h.newOrder)) : "Not counted"}</span>
          <span className="hold-s">{h.newOrder && now ? `From the ${fmtDate(d.as_of, false)} review date` : "Counted from the dates in the chart"}</span>
        </div>
        {h.reached && (
          <div className="hold-f">
            <span className="lbl">Waits reached</span>
            <span className="hold-d">{fmtDate(h.reached)}</span>
            <span className="hold-s">After the {fmtDate(d.run.denial.dos, false)} service</span>
          </div>
        )}
        <div className="hold-f">
          <span className="lbl">Service date</span>
          <span className="hold-d">{fmtDate(d.run.denial.dos)}</span>
          <span className="hold-s">{shortPayer(d.run.denial.payer_name)} · CPT {d.run.denial.cpt}</span>
        </div>
      </div>
      <section className="cd-sec">
        <span className="lbl">Waits the service fell short of</span>
        <Missing items={h.waits} onRule={onRule} policy={d.run.policy} />
      </section>
      <p className="cd-note">Counted from the dates in this patient's chart. A person decides and places the order.</p>
    </div>
  )
}

// The note's quoted policy lines go through the same citation gate as an appeal, and each is marked.
function NoteSheet({ d, note }: { d: CaseDetail; note: ReturnType<typeof physicianNote> }) {
  const [res, setRes] = useState<GateResp | null | "error">(null)
  useEffect(() => {
    let live = true
    const text = note.items.map((it) => `> ${it.quote}\n> — ${it.pid} · ${it.addr}\n`).join("\n")
    postGate(d.id, text).then((r) => live && setRes(r), () => live && setRes("error"))
    return () => {
      live = false
    }
  }, [d.id, note])
  return (
    <section className="cd-sec">
      <span className="lbl">Note to the physician, as it will be copied</span>
      <div className="sheet-doc is-prose" role="document">
        <p className="np-t">{note.title}</p>
        {note.intro.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
        <ol className="np-l">
          {note.items.map((it, i) => {
            const c = res && res !== "error" ? res.checks.find((x) => squash(x.text) === squash(it.quote)) : null
            return (
              <li key={i}>
                <p className="np-a">{secLong(d.run.policy, it.addr)}</p>
                <figure className={`lq ${c ? (c.status === "verified" ? "is-ok" : "is-bad") : "is-wait"}`}>
                  <blockquote>{it.quote}</blockquote>
                  <figcaption>
                    {res === null ? (
                      <span className="lq-wait">Checking against the policy</span>
                    ) : res === "error" || !c ? (
                      <Mark tone="quiet" glyph="dash" label="Not checked" size={13} />
                    ) : c.status === "verified" ? (
                      <span className="mark t-verified"><Glyph name="check" size={13} /> Matches the policy word for word</span>
                    ) : (
                      <Mark tone="neg" glyph="cross" label="This quote isn't in the policy" size={13} />
                    )}
                  </figcaption>
                </figure>
                {it.count && <p className="np-c">{it.count}</p>}
              </li>
            )
          })}
        </ol>
        {note.outro.map((t, i) => (
          <p key={i} className={i === note.outro.length - 1 ? "np-f" : ""}>{t}</p>
        ))}
      </div>
      <motion.p className="cd-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
        You send it. The tool never contacts anyone.
      </motion.p>
    </section>
  )
}
