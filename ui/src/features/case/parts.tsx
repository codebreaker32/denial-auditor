// Case building blocks: a policy rule row with its chart evidence (app), and the payer's sentence under a
// highlighter (app and landing). The row speaks to a biller: what the policy requires, whether the chart shows it,
// the quoted chart line, and at most one plain word on how sure the check is.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { EASE_ENTER, EASE_OUT } from "@/lib/motion"
import { STATUS, noteName, policyHuman, ruleNames, sec, secLong, DOUBLE_TIP, sureWord, type CaseDetail, type Criterion, type GlyphName, type Match, type Tone } from "@/lib/data"
import type { Count } from "./model"
import { Glyph, Mark } from "@/features/ui"

export function Highlight({ text, delay = 0.15 }: { text: string; delay?: number }) {
  // The highlighter sweep: yellow drawn left to right behind the payer's own words, line by line.
  const [on, setOn] = useState(false)
  return (
    <motion.span
      className={`hl ${on ? "is-on" : ""}`}
      style={{ transitionDelay: `${delay}s` }}
      onViewportEnter={() => setOn(true)}
      viewport={{ once: true }}
    >
      {text}
    </motion.span>
  )
}


export function RuleRow({
  d, m, c, open, onToggle, index = 0, show, count, onPolicy, onNote,
}: {
  d: CaseDetail; m: Match; c?: Criterion; open: boolean; onToggle: () => void; index?: number
  show?: { label: string; tone: Tone; glyph: GlyphName }; count?: Count | null
  onPolicy?: (n: number) => void; onNote?: (noteId: string) => void
}) {
  const st = show ?? STATUS[m.status]
  const addr = d.addresses[m.criterion_id]
  const policy = d.run.policy
  const first = /S(\d+)/.exec(addr ?? "")
  const sure = sureWord(m)
  const ev = m.evidence.filter((e) => e.verified)
  const bid = `rb-${m.criterion_id}`
  return (
    <motion.li
      className={`rule ${open ? "is-open" : ""}`}
      data-rule={m.criterion_id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.64, ease: EASE_ENTER, delay: Math.min(index, 6) * 0.05 }}
    >
      <button type="button" className="rule-h" onClick={onToggle} aria-expanded={open} aria-controls={bid}>
        <span className={`rule-g t-${st.tone}`}><Glyph name={st.glyph} size={15} /></span>
        <span className="rule-t">
          <b>{c ? ruleNames(d.run.criteria, d.addresses).get(c.criterion_id) : "Policy rule"}</b>
          <span>{c?.summary}</span>
        </span>
        <span className="rule-a">
          {sure?.review && <span className="rule-split" title={DOUBLE_TIP}>Double-checked</span>}
          {addr && <span className="sec" title={secLong(policy, addr)}>{sec(addr)}</span>}
        </span>
        <span className={`rule-s t-${st.tone}`}>{st.label}</span>
        <ChevronDown size={15} strokeWidth={1.7} className="rule-x" aria-hidden="true" />
      </button>
      {count && m.status !== "not_applicable" && (
        <p className={`counted t-${count.tone}`}>
          <Glyph name={count.glyph} size={13} />
          <span>
            {count.text} · <b>{count.word}</b>
          </span>
        </p>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bid}
            className="rule-b"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.36, ease: EASE_OUT }}
          >
            <div className="rule-bi">
              {c && (
                <div className="rule-q">
                  <span className="lbl">What the policy requires</span>
                  <blockquote>
                    <Highlight text={c.verbatim_span.length > 360 ? c.verbatim_span.slice(0, 357).trimEnd() + "..." : c.verbatim_span} />
                  </blockquote>
                  <span className="ver t-verified">
                    <Glyph name="check" size={12} /> Word for word from {policy ? policyHuman(policy) : "the policy"}
                    {first && onPolicy && (
                      <button type="button" className="textbtn rule-go" onClick={() => onPolicy(Number(first[1]))}>
                        Read {sec(addr)} in the policy
                      </button>
                    )}
                  </span>
                </div>
              )}
              <div className="rule-ev">
                <span className="lbl">What the chart shows</span>
                {ev.length === 0 && <p className="muted">{m.status === "missing_documentation" ? "No chart note documents this yet." : "Nothing in the chart speaks to this."}</p>}
                <ul>
                  {ev.slice(0, 3).map((e, i) => {
                    const where = noteName(d.notes, e.note_id)
                    return (
                      <li key={i}>
                        <q>{e.quote}</q>
                        <span className="ver t-verified">
                          <Glyph name="check" size={12} /> Found in{" "}
                          {onNote ? (
                            <button type="button" className="textbtn" onClick={() => onNote(e.note_id)}>
                              {where}
                            </button>
                          ) : (
                            <>{where}</>
                          )}
                        </span>
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

export { Mark }
