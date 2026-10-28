// The citation gate, live: the quote is sent to POST /api/gate (code only, no model, $0) and checked against
// the policy text fetched for the saved run. Changing one word blocks the export.
import { AnimatePresence, motion, useAnimationControls } from "framer-motion"
import { Download, PenLine, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { EASE_ENTER } from "@/lib/motion"
import { go } from "@/lib/router"
import { quoteCount, type CaseDetail } from "@/lib/data"
import { Glyph, Press } from "@/features/ui"

interface GateResp { ok: boolean; reason: string | null; checks: { text: string; status: string; address: string | null; closest?: { address: string | null } }[] }

const SWAP: [RegExp, string, string][] = [
  [/after 1 month/, "after 1 month", "after 2 weeks"],
  [/at least four weeks/, "at least four weeks", "at least two weeks"],
]

export function GateDemo({ d }: { d: CaseDetail }) {
  const quote = useMemo(() => {
    const pol = (d.run.gate?.checks ?? []).filter((c) => c.source_id.startsWith("L") && SWAP.some(([re]) => re.test(c.text)))
    return pol.sort((a, b) => a.text.length - b.text.length)[0]?.text ?? null
  }, [d])
  const swap = quote ? SWAP.find(([re]) => re.test(quote)) : undefined
  const [edited, setEdited] = useState(false)
  const [res, setRes] = useState<GateResp | null>(null)
  const [busy, setBusy] = useState(false)
  const shake = useAnimationControls()
  const text = quote && swap ? (edited ? quote.replace(swap[1], swap[2]) : quote) : null
  const others = quoteCount(d.run.gate?.checks ?? []).total - 1

  useEffect(() => {
    if (!text) return
    let live = true
    setBusy(true)
    fetch("/api/gate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: d.id, text: `"${text}"` }) })
      .then((r) => r.json())
      .then((j: GateResp) => live && setRes(j))
      .catch(() => live && setRes(null))
      .finally(() => live && setBusy(false))
    return () => {
      live = false
    }
  }, [text, d.id])

  if (!text || !swap) return null
  const ok = res?.ok ?? !edited
  const chk = res?.checks[0]
  const parts = edited ? text.split(swap[2]) : text.split(swap[1])

  return (
    <div className="ui-card gate" data-ui>
      <div className="ui-card-h">
        <span className="lbl">Citation gate · {d.patient}'s appeal</span>
        <code className="gate-src">POST /api/gate</code>
      </div>
      <blockquote className={`gate-q ${ok ? "is-ok" : "is-bad"}`}>
        “{parts[0]}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={String(edited)}
            className={edited ? "gate-word is-bad" : "gate-word"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3, ease: EASE_ENTER }}
          >
            {edited ? swap[2] : swap[1]}
          </motion.span>
        </AnimatePresence>
        {parts[1]}”
      </blockquote>
      <div className="gate-row">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={busy ? "busy" : String(ok)}
            className={`mark ${busy ? "t-quiet" : ok ? "t-verified" : "t-neg"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
          >
            {busy ? (
              <>Checking against the fetched text</>
            ) : ok ? (
              <>
                <Glyph name="check" size={14} /> Matches {chk?.address ?? "the fetched policy"} word for word
              </>
            ) : (
              <>
                <Glyph name="cross" size={14} /> Not in the fetched text{chk?.closest?.address ? `. Closest: ${chk.closest.address}` : ""}
              </>
            )}
          </motion.span>
        </AnimatePresence>
        <span className="gate-others num">+ {others} other quotes verified</span>
      </div>
      <div className="gate-acts">
        <Press className="pill pill-ghost pill-sm" onClick={() => setEdited(!edited)}>
          {edited ? <RotateCcw size={14} strokeWidth={1.8} /> : <PenLine size={14} strokeWidth={1.8} />}
          {edited ? "Restore the wording" : "Change one word"}
        </Press>
        <motion.div animate={shake}>
          <Press
            className={`pill pill-sm ${ok ? "pill-ink" : "pill-blocked"}`}
            aria-disabled={!ok}
            onClick={() => {
              if (ok) go("#/login")
              else shake.start({ x: [0, -3, 3, -3, 3, -2, 0], transition: { duration: 0.24 } })
            }}
          >
            <Download size={14} strokeWidth={1.8} /> {ok ? "Export the letter" : "Export blocked"}
          </Press>
        </motion.div>
      </div>
    </div>
  )
}
