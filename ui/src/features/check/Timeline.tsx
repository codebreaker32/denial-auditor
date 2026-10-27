// The waiting-period timeline: chart notes, dated care, each of the policy's waits drawn from its start date,
// the planned MRI and the earliest qualifying date (computed by the server in code, never by a model).
import { motion } from "framer-motion"
import { addDays, daysBetween, fmtDate } from "@/lib/data"
import { EASE_ENTER } from "@/lib/motion"
import { Glyph } from "@/features/ui"
import { type CheckDetail, firstStart, waits } from "./model"

const NOTE_WORD: Record<string, string> = {
  initial_visit: "First visit",
  follow_up: "Follow-up",
  pt_note: "Therapy note",
  imaging_order: "MRI order",
}

export function Timeline({ d }: { d: CheckDetail }) {
  const ch = d.check
  const f = ch.facts
  const planned = ch.request.planned_dos
  const ws = waits(d)
  const dates = [
    f?.onset, firstStart(f), ...d.notes.map((n) => n.date), planned, ch.earliest,
    ...ws.map((w) => w.date), ...(f?.treatments ?? []).flatMap((t) => [t.start, t.end]),
  ].filter((x): x is string => !!x).sort()
  const start = addDays(dates[0], -3)
  const end = addDays(dates[dates.length - 1], 4)
  const span = Math.max(1, daysBetween(start, end))
  const x = (iso: string) => `${(daysBetween(start, iso) / span) * 100}%`
  const pct = (iso: string) => daysBetween(start, iso) / span

  // Week ticks; a label on every other one.
  const ticks: string[] = []
  for (let t = start; t <= end; t = addDays(t, 7)) ticks.push(t)

  const lastCare = (f?.treatments ?? []).map((t) => t.end).filter((e): e is string => !!e).sort().pop() ?? null
  let delay = 0.1
  const next = () => (delay += 0.06)

  return (
    <figure className="pt">
      <div className="pt-scroll" tabIndex={0} role="region" aria-label="Waiting-period timeline, scrolls sideways">
        <div className="pt-grid" aria-hidden="true">
          <div className="pt-axis pt-row">
            <span className="pt-l" />
            <div className="pt-track">
              {ticks.map((t, i) => (
                <span key={t} className="pt-tick" style={{ left: x(t) }}>
                  {i % 2 === 0 && pct(t) > 0.05 && pct(t) < 0.95 && <i className="mono">{fmtDate(t, false)}</i>}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-row">
            <span className="pt-l">Chart notes</span>
            <div className="pt-track">
              {d.notes.map((n) => (
                <motion.span
                  key={n.note_id}
                  className="pt-note"
                  style={{ left: x(n.date) }}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: EASE_ENTER, delay: next() }}
                  title={`${NOTE_WORD[n.note_type] ?? n.note_type}, ${fmtDate(n.date)}`}
                />
              ))}
            </div>
          </div>

          {(f?.treatments ?? []).length > 0 && (
            <div className="pt-row">
              <span className="pt-l">Care</span>
              <div className="pt-track pt-care">
                {f!.treatments.filter((t) => t.start).map((t, i) => {
                  const s = t.start!
                  const e = t.end ?? s
                  return (
                    <motion.span
                      key={i}
                      className="pt-bar"
                      style={{ left: x(s), width: `${(Math.max(1, daysBetween(s, e)) / span) * 100}%`, top: 6 + i * 12 }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.9, ease: EASE_ENTER, delay: next() }}
                    >
                      <i>{t.kind}</i>
                    </motion.span>
                  )
                })}
              </div>
            </div>
          )}

          {ws.map((w) => {
            if (!w.from || !w.date) return null
            const near = pct(w.date) > 0.78
            return (
              <div key={w.label} className="pt-row">
                <span className="pt-l">{w.label}</span>
                <div className="pt-track">
                  <motion.span
                    className={`pt-wait t-${w.tone}`}
                    style={{ left: x(w.from), width: `${(daysBetween(w.from, w.date) / span) * 100}%` }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 1.1, ease: EASE_ENTER, delay: next() }}
                  />
                  {lastCare && w.word.startsWith("Met once") && w.from !== f?.onset && (
                    <span className="pt-gap" style={{ left: x(lastCare), width: `${(Math.max(0, daysBetween(lastCare, w.date)) / span) * 100}%` }} />
                  )}
                  <motion.span
                    className={`pt-end t-${w.tone} ${near ? "is-near" : ""}`}
                    style={{ left: x(w.date) }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: delay + 0.6 }}
                  >
                    <Glyph name={w.glyph} size={13} />
                    <i className="mono">{fmtDate(w.date, false)}</i>
                  </motion.span>
                </div>
              </div>
            )
          })}

          <div className="pt-marks">
            <span className="pt-l" />
            <div className="pt-track">
              <span className={`pt-v pt-planned ${pct(planned) > 0.8 ? "is-right" : ""}`} style={{ left: x(planned) }}>
                <i className="mono">Planned {fmtDate(planned, false)}</i>
              </span>
              {ch.earliest && (
                <motion.span
                  className={`pt-v pt-earliest ${pct(ch.earliest) > 0.8 ? "is-right" : ""}`}
                  style={{ left: x(ch.earliest) }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: delay + 0.9 }}
                >
                  <i className="mono">Earliest {fmtDate(ch.earliest, false)}</i>
                </motion.span>
              )}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="sr">
        Timeline. Planned MRI {fmtDate(planned)}.
        {ch.earliest ? ` Earliest qualifying date ${fmtDate(ch.earliest)}.` : ""}
        {ws.map((w) => ` ${w.label}: ${w.word}.`).join("")}
        {` Chart notes on ${d.notes.map((n) => fmtDate(n.date, false)).join(", ")}.`}
      </figcaption>
    </figure>
  )
}
