// The appeal letter: the draft typeset with every quote as a marked citation, an Edit mode that re-checks each
// quote against the sources fetched for this case (POST /api/gate), and an Export that stays locked until every
// quote matches word for word. A person reviews and sends the letter; the tool never submits anything.
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Download, Lock, PenLine, ScrollText } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { EASE_ENTER, EASE_OUT } from "@/lib/motion"
import { fmtDate, sec, type CaseDetail } from "@/lib/data"
import { Glyph, Press } from "@/features/ui"
import { appealOf } from "@/features/case/model"
import { notify } from "@/features/toast"
import { WORK, setWork, getWork, useWork } from "@/features/case/work"
import { letterCodec, parseLetter, splitInline, squash, type Block } from "./letter"

export interface GateCheck { text: string; status: string; source_id: string | null; address: string | null; closest?: { source_id: string; text: string; address: string | null } }
export interface GateResp { ok: boolean; reason: string; checks: GateCheck[]; quotes: number }
export type Gate = { state: "checking" } | { state: "done"; res: GateResp } | { state: "error"; message: string }
export type Target = { kind: "policy"; n: number } | { kind: "note"; id: string }

export async function postGate(caseId: string, text: string): Promise<GateResp> {
  const r = await fetch("/api/gate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: caseId, text }) })
  if (!r.ok) throw new Error(`the gate answered ${r.status}`)
  return r.json()
}

export function targetOf(c: { address: string | null; source_id: string | null }): Target | null {
  const a = c.address ?? ""
  if (a.startsWith("note ") && c.source_id) return { kind: "note", id: c.source_id }
  const m = /S(\d+)/.exec(a)
  return m ? { kind: "policy", n: Number(m[1]) } : null
}

// "L34220 · S47" → "Policy §47"; "note n2 · 06/15/2026" → "Chart note, Jun 15".
function addrWord(a: string | null): string {
  if (!a) return "Source"
  const note = /^note \S+ · (\d{2})\/(\d{2})\/(\d{4})/.exec(a)
  if (note) return `Chart note, ${fmtDate(`${note[3]}-${note[1]}-${note[2]}`, false)}`
  if (a.startsWith("note ")) return "Chart note"
  const s = sec(a)
  return s ? `Policy ${s}` : "Policy"
}

export function Addr({ c, goto, className = "" }: { c: { address: string | null; source_id: string | null }; goto: (t: Target) => void; className?: string }) {
  const t = targetOf(c)
  if (!t) return <span className={`addr ${className}`}>{addrWord(c.address)}</span>
  return (
    <button type="button" className={`addr ${className}`} onClick={() => goto(t)} title={t.kind === "policy" ? `Open sentence ${t.n} of the policy` : "Open the chart note"}>
      {addrWord(c.address)}
    </button>
  )
}

const DEBOUNCE = 400
// Edits survive switching tabs (and following a citation to the policy) for this page load.
const drafts = new Map<string, string>()

export function Appeal({ d, goto }: { d: CaseDetail; goto: (t: Target) => void }) {
  const appeal = appealOf(d)!
  const codec = useMemo(() => letterCodec(appeal.rendered), [appeal.rendered])
  const [plain, setPlainState] = useState(() => drafts.get(d.id) ?? codec.toPlain(appeal.rendered))
  const setPlain = (t: string) => {
    drafts.set(d.id, t)
    setPlainState(t)
  }
  const [editing, setEditing] = useState(false)
  const [gate, setGate] = useState<Gate>({ state: "checking" })
  const [last, setLast] = useState<GateResp | null>(null)
  const md = useMemo(() => codec.toMd(plain), [codec, plain])
  const seq = useRef(0)
  const work = useWork(d.id)
  const edited = plain !== codec.toPlain(appeal.rendered)

  const run = useCallback(
    (text: string) => {
      const mine = ++seq.current
      setGate({ state: "checking" })
      postGate(d.id, text).then(
        (res) => {
          if (mine !== seq.current) return
          setLast(res)
          setGate({ state: "done", res })
        },
        (e: Error) => mine === seq.current && setGate({ state: "error", message: e.message }),
      )
    },
    [d.id],
  )
  // Every change re-locks at once; the check runs once typing pauses.
  useEffect(() => {
    setGate({ state: "checking" })
    const t = window.setTimeout(() => run(md), seq.current === 0 ? 0 : DEBOUNCE)
    return () => window.clearTimeout(t)
  }, [md, run])

  const ok = gate.state === "done" && gate.res.ok && gate.res.checks.every((c) => c.status === "verified")
  const checks = gate.state === "done" ? gate.res.checks : last?.checks ?? []

  const doExport = () => {
    if (!ok) return
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }))
    a.download = `${d.id}_reconsideration.md`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    const before = getWork(d.id).status
    if (before !== "sent") {
      setWork(d.id, "ready")
      notify("Letter exported", () => setWork(d.id, before), "Marked Ready to send. You send it; Denial Auditor never does.")
    }
  }
  const markSent = () => {
    const before = getWork(d.id).status
    setWork(d.id, "sent")
    notify("Marked as sent by you", () => setWork(d.id, before))
  }

  return (
    <div className="ap">
      <div className="ap-bar" role="region" aria-label="Citation gate and export">
        <div className="ap-gate" aria-live="polite">
          <GateMark gate={gate} />
        </div>
        <div className="ap-tools">
          <div className="seg" role="group" aria-label="Letter view">
            <button type="button" className={`seg-b ${!editing ? "is-on" : ""}`} aria-pressed={!editing} onClick={() => setEditing(false)}>
              {!editing && <motion.span layoutId="ap-seg" className="seg-bg" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
              <ScrollText size={14} strokeWidth={1.7} aria-hidden="true" /> <span>Letter</span>
            </button>
            <button type="button" className={`seg-b ${editing ? "is-on" : ""}`} aria-pressed={editing} onClick={() => setEditing(true)}>
              {editing && <motion.span layoutId="ap-seg" className="seg-bg" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
              <PenLine size={14} strokeWidth={1.7} aria-hidden="true" /> <span>Edit</span>
            </button>
          </div>
          <ExportButton gate={gate} ok={ok} onExport={doExport} />
        </div>
        <p className="ap-who">
          {work.status === "ready" ? (
            <>
              <Glyph name={WORK.ready.glyph} size={13} className="t-teal" /> Exported{work.at ? ` ${fmtDate(work.at)}` : ""}. Once you've sent it,{" "}
              <button type="button" className="textbtn" onClick={markSent}>mark it sent</button>.
            </>
          ) : work.status === "sent" ? (
            <>
              <Glyph name="check" size={13} className="t-pos" /> Sent by you{work.at ? ` on ${fmtDate(work.at)}` : ""}.
            </>
          ) : (
            "A person reviews and sends this. The tool never submits."
          )}
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {editing ? (
          <motion.div key="ed" className="ap-edit" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.3, ease: EASE_OUT }}>
            <label className="sr" htmlFor="ap-ta">Letter text</label>
            <textarea
              id="ap-ta"
              className="ap-ta"
              value={plain}
              spellCheck
              aria-describedby="ap-help"
              onChange={(e) => setPlain(e.target.value)}
            />
            <p className="ap-help" id="ap-help">
              Quoted lines must stay word for word. Each edit locks export until the quotes check again.
              {edited && (
                <>
                  {" "}
                  <button type="button" className="textbtn" onClick={() => setPlain(codec.toPlain(appeal.rendered))}>Restore the draft</button>
                </>
              )}
            </p>
          </motion.div>
        ) : (
          <motion.article key="rd" className="ap-sheet" aria-label="Appeal letter" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.4, ease: EASE_ENTER }}>
            <LetterView text={md} checks={gate.state === "done" ? gate.res.checks : null} goto={goto} />
          </motion.article>
        )}
      </AnimatePresence>

      {checks.length > 0 && <QuoteList checks={checks} pending={gate.state !== "done"} goto={goto} />}

      {appeal.critique.length > 0 && (
        <details className="ap-crit">
          <summary>
            <ChevronDown size={15} strokeWidth={1.7} aria-hidden="true" /> Weak points found in the first draft, fixed in this one
            <span className="num">{appeal.critique.length}</span>
          </summary>
          <ul>
            {appeal.critique.map((c, i) => (
              <li key={i}>
                <span className={`sev ${c.severity === "major" ? "is-major" : ""}`}>{c.severity === "major" ? "Major" : "Minor"}</span>
                <span>{c.issue}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="ap-prov">A draft for you to review. Every quote is checked against the policy and chart before it can be exported.</p>
    </div>
  )
}

function GateMark({ gate }: { gate: Gate }) {
  if (gate.state === "checking")
    return (
      <span className="gm is-checking">
        <i className="gm-spin" aria-hidden="true" /> Checking every quote against the policy and chart
      </span>
    )
  if (gate.state === "error")
    return (
      <span className="gm t-neg">
        <Glyph name="cross" size={15} /> Couldn't check: {gate.message}
      </span>
    )
  const r = gate.res
  const uniq = new Set(r.checks.map((c) => squash(c.text))).size
  const bad = new Set(r.checks.filter((c) => c.status !== "verified").map((c) => squash(c.text))).size
  if (!r.checks.length)
    return (
      <span className="gm t-neg">
        <Glyph name="cross" size={15} /> No quotes to check
      </span>
    )
  if (bad)
    return (
      <span className="gm t-neg">
        <Glyph name="cross" size={15} /> {bad} of {uniq} {uniq === 1 ? "quote doesn't" : "quotes don't"} match the policy or chart
      </span>
    )
  return (
    <motion.span className="gm t-verified" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
      <Glyph name="check" size={15} /> Every quote matches the policy and chart, word for word ({uniq})
    </motion.span>
  )
}

function ExportButton({ gate, ok, onExport }: { gate: Gate; ok: boolean; onExport: () => void }) {
  const why = gate.state === "checking" ? "Checking every quote first" : gate.state === "error" ? "The check didn't run" : "Fix the quotes that don't match"
  return (
    <span className="ap-ex">
      <Press
        className={`pill pill-sm ${ok ? "pill-ink" : "pill-locked"}`}
        aria-disabled={!ok}
        aria-describedby={ok ? undefined : "ap-why"}
        onClick={onExport}
        whileTap={ok ? { scale: 0.97, transition: { duration: 0.08 } } : { x: [0, -3, 3, -2, 0], transition: { duration: 0.28 } }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={ok ? "on" : gate.state} className="ap-ex-t" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.16 }}>
            {ok ? <Download size={14} strokeWidth={1.8} aria-hidden="true" /> : <Lock size={13} strokeWidth={1.9} aria-hidden="true" />}
            {ok ? "Export letter" : "Export locked"}
          </motion.span>
        </AnimatePresence>
      </Press>
      {!ok && (
        <span id="ap-why" className="sr">
          {why}
        </span>
      )}
    </span>
  )
}

// ---------- the letter, typeset ----------
function LetterView({ text, checks, goto }: { text: string; checks: GateCheck[] | null; goto: (t: Target) => void }) {
  const blocks = useMemo(() => parseLetter(text), [text])
  const find = (q: string) => checks?.find((c) => squash(c.text) === squash(q))
  // A quote already shown whole in an earlier block quote is not repeated: it becomes a citation mark.
  // Display only; the gate and the export check every quote as stored.
  const seen: string[] = []
  const wasShown = (q: string) => {
    const t = squash(q)
    return seen.some((x) => x.includes(t))
  }
  const out: ReactNode[] = []
  blocks.forEach((b: Block, i) => {
    if (b.t === "h") {
      out.push(<h3 key={i}>{b.s}</h3>)
      return
    }
    if (b.t === "q") {
      const c = find(b.s)
      const bad = c && c.status !== "verified"
      if (!bad && wasShown(b.s)) return
      seen.push(squash(b.s))
      out.push(<Quote key={i} q={b.s} cite={b.cite} c={c} goto={goto} />)
      return
    }
    const inline = (q: string, key: string) => {
      const c = find(q)
      const shown = !!c && c.status === "verified" && wasShown(q)
      if (!shown && (!c || c.status === "verified")) seen.push(squash(q))
      return <Inline key={key} q={q} c={c} shown={shown} goto={goto} />
    }
    out.push(
      <p key={i}>
        {b.parts.map((pt, j) =>
          "q" in pt
            ? inline(pt.q, String(j))
            : splitInline(pt.s).map((x, k) => ("iq" in x ? inline(x.iq, `${j}-${k}`) : <span key={`${j}-${k}`}>{x.s}</span>)),
        )}
      </p>,
    )
  })
  return <>{out}</>
}

function Quote({ q, cite, c, goto }: { q: string; cite: string; c: GateCheck | undefined; goto: (t: Target) => void }) {
  if (c && c.status !== "verified") {
    return (
      <>
        <figure className="lq is-bad">
          <blockquote>
            <s>{squash(q)}</s>
          </blockquote>
          <figcaption>
            <span className="mark t-neg">
              <Glyph name="cross" size={13} /> This quote isn't in the policy
            </span>
            <span className="lq-claim">{cite ? "The words differ from the source it cites" : "Not found word for word in the policy or chart"}</span>
          </figcaption>
        </figure>
        {c.closest && (
          <figure className="lq is-says">
            <p className="lbl">The policy says</p>
            <blockquote>{c.closest.text}</blockquote>
            <figcaption>
              <span className="mark t-verified">
                <Glyph name="check" size={13} /> Word for word
              </span>
              <Addr c={c.closest} goto={goto} />
            </figcaption>
          </figure>
        )}
      </>
    )
  }
  return (
    <figure className={`lq ${c ? "is-ok" : "is-wait"}`}>
      <blockquote>{squash(q)}</blockquote>
      <figcaption>
        {c ? (
          <>
            <span className="mark t-verified">
              <Glyph name="check" size={13} /> Word for word
            </span>
            <Addr c={c} goto={goto} />
          </>
        ) : (
          <span className="lq-wait">{cite || "Checking"}</span>
        )}
      </figcaption>
    </figure>
  )
}

function Inline({ q, c, shown, goto }: { q: string; c: GateCheck | undefined; shown: boolean; goto: (t: Target) => void }) {
  if (c && c.status !== "verified")
    return (
      <span className="iq is-bad">
        <span className="mark t-neg">
          <Glyph name="cross" size={12} /> Doesn't match
        </span>{" "}
        <s>{squash(q)}</s>
      </span>
    )
  if (shown && c)
    return (
      <span className="cite">
        <Glyph name="check" size={11} className="t-verified" />
        <Addr c={c} goto={goto} />
      </span>
    )
  return (
    <span className="iq">
      {"“"}
      {squash(q)}
      {"”"}
      {c && (
        <span className="cite">
          <Glyph name="check" size={11} className="t-verified" />
          <Addr c={c} goto={goto} />
        </span>
      )}
    </span>
  )
}

// ---------- every checked quote, one row per distinct quote ----------
function QuoteList({ checks, pending, goto }: { checks: GateCheck[]; pending: boolean; goto: (t: Target) => void }) {
  const groups: { c: GateCheck; uses: number }[] = []
  for (const c of checks) {
    const hit = groups.find((g) => squash(g.c.text) === squash(c.text) && g.c.status === c.status)
    if (hit) hit.uses++
    else groups.push({ c, uses: 1 })
  }
  groups.sort((a, b) => Number(a.c.status === "verified") - Number(b.c.status === "verified"))
  const bad = groups.filter((g) => g.c.status !== "verified").length
  const [open, setOpen] = useState(bad > 0)
  useEffect(() => {
    if (bad > 0) setOpen(true)
  }, [bad])
  return (
    <section className={`ql ${pending ? "is-pending" : ""}`} aria-label="Checked quotes">
      <button type="button" className="ql-h" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          {groups.length} quotes checked
        </span>
        <span className="ql-sum">
          {bad ? (
            <span className="mark t-neg">
              <Glyph name="cross" size={13} /> {bad} don't match
            </span>
          ) : (
            <span className="mark t-verified">
              <Glyph name="check" size={13} /> All match
            </span>
          )}
          <ChevronDown size={15} strokeWidth={1.7} aria-hidden="true" className="ql-x" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol className="ql-l" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }} transition={{ duration: 0.36, ease: EASE_OUT }}>
            {groups.map(({ c, uses }, i) => (
              <li key={i} className={c.status === "verified" ? "" : "is-bad"}>
                <span className={c.status === "verified" ? "t-verified" : "t-neg"}>
                  <Glyph name={c.status === "verified" ? "check" : "cross"} size={14} />
                </span>
                <span className="ql-q">{squash(c.text)}</span>
                <span className="ql-a">
                  {c.status === "verified" ? <Addr c={c} goto={goto} /> : <span className="t-neg ql-ns">Doesn't match</span>}
                  {uses > 1 && <span className="num ql-n">used {uses} times</span>}
                </span>
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </section>
  )
}
