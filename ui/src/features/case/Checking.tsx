// The "checking" state when a case opens: the real pipeline steps of the saved run, replayed in under a second.
// Skippable with a click or any key; never blocks longer than about 900ms.
import { motion } from "framer-motion"
import { useEffect, useMemo, useState } from "react"
import { EASE_ENTER } from "@/lib/motion"
import { policyHuman, quoteCount, type CaseDetail } from "@/lib/data"
import { Glyph } from "@/features/ui"

export function stepsFor(d: CaseDetail): { name: string; detail: string }[] {
  const run = d.run
  const out: { name: string; detail: string }[] = []
  const code = run.denial.carc.length ? `Reason code ${run.denial.carc.join(", ")}` : "No reason code"
  const why = (run.triage.explanation || "").split(/(?<=\.)\s+/)[0].replace(/\.$/, "")
  out.push({ name: "Read the denial letter", detail: why ? `${code}: ${why.toLowerCase()}` : code })
  if (run.policy) {
    out.push({ name: "Find the policy for the service date", detail: policyHuman(run.policy) })
    out.push({ name: "List what the policy requires", detail: `${run.criteria?.length ?? 0} rules, word for word` })
  } else out.push({ name: "Sort the denial", detail: run.verdict === "fix_checklist" ? "A claim fix, no policy review" : "A plan exclusion, no policy review" })
  if (run.matches?.length) out.push({ name: "Check each rule against the chart", detail: `${run.matches.length} rules checked` })
  if (run.gate) {
    const q = quoteCount(run.gate.checks)
    out.push({ name: "Check every quote in the letter", detail: `${q.ok} of ${q.total} quotes match the policy and chart` })
  } else if (run.doc_request) out.push({ name: "Write the request to the physician", detail: "Ready to copy" })
  return out
}

export function Checking({ d, onDone }: { d: CaseDetail; onDone: () => void }) {
  const steps = useMemo(() => stepsFor(d), [d])
  const per = Math.min(120, 720 / steps.length)
  const [n, setN] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setN((x) => x + 1), per)
    const done = window.setTimeout(onDone, per * steps.length + 160)
    const skip = () => onDone()
    window.addEventListener("keydown", skip, { once: true })
    return () => {
      window.clearInterval(t)
      window.clearTimeout(done)
      window.removeEventListener("keydown", skip)
    }
  }, [per, steps.length, onDone])
  return (
    <motion.div
      className="checking"
      onClick={onDone}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      role="status"
      aria-live="polite"
    >
      <p className="lbl">Checking this denial</p>
      <ol>
        {steps.map((s, i) =>
          i <= n ? (
            <motion.li key={s.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: EASE_ENTER }}>
              <span className={`ck-g ${i < n ? "is-done" : ""}`}>{i < n ? <Glyph name="check" size={13} /> : <i />}</span>
              <span className="ck-n">{s.name}</span>
              <span className="ck-d">{s.detail}</span>
            </motion.li>
          ) : null,
        )}
      </ol>
      <p className="ck-skip">Click or press any key to skip</p>
    </motion.div>
  )
}
