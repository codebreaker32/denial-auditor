// Case building blocks: a one-line policy rule row that opens to its evidence (app), and the payer's sentence under
// a highlighter (app and landing). The row speaks to a biller: whether the chart meets the rule, the rule's name and
// any counted wait; opened, the policy's own words, the quoted chart lines and one plain line on how sure the check is.
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


// One line per rule: status chip (glyph + word), the rule's name, the counted wait when it has one, a quiet section
// mark and a chevron. Everything else (the policy's words, the chart lines, why, how sure) opens below.
export function RuleHead({
  st, name, fig, review, addr, addrTitle, open, onToggle, bid, quiet,
}: {
  st: { label: string; tone: Tone; glyph: GlyphName }; name: string; fig?: { text: string; tone: Tone } | null
  review?: boolean; addr?: string; addrTitle?: string; open: boolean; onToggle: () => void; bid: string; quiet?: boolean
}) {
  return (
    <button type="button" className="rr" onClick={onToggle} aria-expanded={open} aria-controls={bid}>
      <span className={`rr-st t-${st.tone} ${quiet ? "is-quiet" : ""}`}>
        <Glyph name={st.glyph} size={14} />
        <span>{st.label}</span>
      </span>
      <span className="rr-n">{name}</span>
      {fig && <span className={`rr-f num t-${fig.tone}`}>{fig.text}</span>}
      <span className="rr-a">
        {review && <span className="rr-dc" title={DOUBLE_TIP}>Double-checked</span>}
        {addr && <span className="sec" title={addrTitle}>{addr}</span>}
      </span>
      <ChevronDown size={16} strokeWidth={1.7} className="rule-x" aria-hidden="true" />
    </button>
  )
}

// The counted wait, short: "82 days · needs 30", or why it can't be counted.
export function waitFig(count: Count | null | undefined): { text: string; tone: Tone } | null {
  if (!count) return null
  if (count.n != null) return { text: `${count.n} days · needs ${count.need}`, tone: count.tone }
  if (count.word === "Waived") return { text: "Waived: red flag", tone: "quiet" }
  return { text: "No dates to count", tone: count.tone }
}

export function RuleRow({
  d, m, c, open, onToggle, index = 0, show, count, quiet, onPolicy, onNote,
}: {
  d: CaseDetail; m: Match; c?: Criterion; open: boolean; onToggle: () => void; index?: number
  show?: { label: string; tone: Tone; glyph: GlyphName }; count?: Count | null; quiet?: boolean
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_ENTER, delay: Math.min(index, 6) * 0.04 }}
    >
      <RuleHead
        st={st}
        name={c ? ruleNames(d.run.criteria, d.addresses).get(c.criterion_id) ?? "Policy rule" : "Policy rule"}
        fig={m.status !== "not_applicable" ? waitFig(count) : null}
        review={sure?.review}
        addr={addr ? sec(addr) : undefined}
        addrTitle={addr ? secLong(policy, addr) : undefined}
        open={open}
        onToggle={onToggle}
        bid={bid}
        quiet={quiet}
      />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bid}
            className="rule-b"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
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
              {count && m.status !== "not_applicable" && <p className={`rule-count t-${count.tone}`}><Glyph name={count.glyph} size={13} /> {count.text}</p>}
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
