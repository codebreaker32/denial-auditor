// The visuals of mockup b: glyphs, animated figures, rings, the stake bar, the deadline runway, the clinical
// timeline and the model-call trace. All of them draw only what the API returned.
import NumberFlow from "@number-flow/react"
import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/skiper/skiper101"
import {
  ORDER, VERDICT, STATUS, STATUS_ORDER, addDays, daysBetween, fmtDate, fmtMon, shortPayer, thresholdStates, toT, usd, usd4,
  type CaseDetail, type GlyphName, type Row, type Status, type Tone, type TraceGroup, type Verdict,
} from "./data"

export const EASE = [0.16, 1, 0.3, 1] as const

// ---------- glyphs: one authored set, 1.6px stroke, so status never rides on colour alone ----------
export function Glyph({ name, size = 14 }: { name: GlyphName; size?: number }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="b-glyph">
      {name === "check" && <path d="M3.5 8.4 6.6 11.3 12.6 4.8" {...p} />}
      {name === "cross" && <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" {...p} />}
      {name === "dash" && <path d="M4.5 8h7" {...p} />}
      {name === "half" && (
        <>
          <circle cx="8" cy="8" r="5.2" {...p} />
          <path d="M8 2.8a5.2 5.2 0 0 1 0 10.4z" fill="currentColor" />
        </>
      )}
      {name === "pause" && <path d="M6 4.5v7M10 4.5v7" {...p} />}
      {name === "return" && <path d="M6.5 4.5 3.5 7.5l3 3M3.8 7.5h5.7a3 3 0 0 1 0 6H8" {...p} />}
      {name === "slash" && (
        <>
          <circle cx="8" cy="8" r="5.2" {...p} />
          <path d="M4.4 11.6 11.6 4.4" {...p} />
        </>
      )}
    </svg>
  )
}

export function Mark({ tone, glyph, label, size = "md" }: { tone: Tone; glyph: GlyphName; label: string; size?: "md" | "lg" }) {
  return (
    <span className={`b-mark t-${tone} ${size === "lg" ? "is-lg" : ""}`}>
      <Glyph name={glyph} size={size === "lg" ? 16 : 13} />
      {label}
    </span>
  )
}

// ---------- figures that count up (skiper37's NumberFlow pattern: start at zero, roll to the value) ----------
export function Figure({ value, currency, className }: { value: number; currency?: boolean; className?: string }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setV(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  return (
    <NumberFlow
      className={className}
      value={v}
      locales="en-US"
      format={currency ? { style: "currency", currency: "USD", maximumFractionDigits: 0 } : { maximumFractionDigits: 0 }}
      transformTiming={{ duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
      spinTiming={{ duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
    />
  )
}

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    setW(ref.current.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function Tip({ children, body }: { children: ReactNode; body: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="b-tip" sideOffset={6}>
        {body}
      </TooltipContent>
    </Tooltip>
  )
}

// ---------- deadline ring: the part of the appeal window still left, on the forest card ----------
export function DeadlineRing({ left, total, size = 148 }: { left: number; total: number; size?: number }) {
  const sw = 7
  const r = (size - sw) / 2
  const frac = Math.max(0, Math.min(1, left / total))
  return (
    <div className="b-dring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="b-dring-track" strokeWidth={sw} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="b-dring-arc"
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: frac }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.1 }}
        />
      </svg>
      <div className="b-dring-c">
        <Figure value={left} className="b-dring-n" />
        <span className="b-dring-u">days left</span>
      </div>
    </div>
  )
}

// ---------- rule coverage ring: thin, one segment per status, the total in the middle ----------
export function CoverageRing({ counts, total, size = 132 }: { counts: Record<Status, number>; total: number; size?: number }) {
  const sw = 10
  const r = (size - sw) / 2
  const gap = total > 1 ? 0.012 : 0
  let at = 0
  const segs = STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => {
    const len = counts[s] / Math.max(1, total)
    const seg = { s, start: at, len: Math.max(0.001, len - gap) }
    at += len
    return seg
  })
  return (
    <div className="b-cring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${total} policy rules`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="b-cring-track" strokeWidth={sw} fill="none" />
        {segs.map((g, i) => (
          <motion.circle
            key={g.s}
            cx={size / 2}
            cy={size / 2}
            r={r}
            pathLength={1}
            fill="none"
            strokeWidth={sw}
            className={`b-seg-${g.s}`}
            transform={`rotate(${-90 + g.start * 360} ${size / 2} ${size / 2})`}
            initial={{ strokeDasharray: `0 1` }}
            animate={{ strokeDasharray: `${g.len} ${1 - g.len}` }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.12 }}
          />
        ))}
      </svg>
      <div className="b-cring-c">
        <span className="b-cring-n">{total}</span>
        <span className="b-cring-u">rules</span>
      </div>
    </div>
  )
}

// ---------- money at stake by recommendation: one segmented meter, legend doubles as the queue filter ----------
export function StakeBar({ rows, filter, onFilter }: { rows: Row[]; filter: Verdict | null; onFilter: (v: Verdict | null) => void }) {
  const total = rows.reduce((s, r) => s + r.billed_usd, 0)
  const by = ORDER.map((v) => {
    const rs = rows.filter((r) => r.verdict === v)
    return { v, n: rs.length, sum: rs.reduce((s, r) => s + r.billed_usd, 0) }
  }).filter((x) => x.n > 0)
  return (
    <div className="b-stake">
      <div className="b-stake-bar" role="img" aria-label="Billed amount by recommendation">
        {by.map((x, i) => (
          <Tip
            key={x.v}
            body={
              <span>
                {VERDICT[x.v].label}: <b>{usd(x.sum)}</b> across {x.n} {x.n === 1 ? "denial" : "denials"}
              </span>
            }
          >
            <motion.button
              type="button"
              className={`b-stake-seg v-${x.v} ${filter && filter !== x.v ? "is-dim" : ""}`}
              style={{ flexGrow: x.sum, transformOrigin: "left center" }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.25 + i * 0.07 }}
              onClick={() => onFilter(filter === x.v ? null : x.v)}
              aria-label={`${VERDICT[x.v].label} ${usd(x.sum)}`}
            />
          </Tip>
        ))}
      </div>
      <ul className="b-stake-legend">
        {by.map((x) => (
          <li key={x.v}>
            <button
              type="button"
              className={`b-leg ${filter === x.v ? "is-on" : ""} ${filter && filter !== x.v ? "is-dim" : ""}`}
              onClick={() => onFilter(filter === x.v ? null : x.v)}
              aria-pressed={filter === x.v}
            >
              <span className={`b-leg-sw v-${x.v}`} />
              <span className={`b-leg-g t-${VERDICT[x.v].tone}`}>
                <Glyph name={VERDICT[x.v].glyph} size={12} />
              </span>
              <span className="b-leg-l">{VERDICT[x.v].label}</span>
              <span className="b-leg-n">{x.n}</span>
              <span className="b-leg-v">{usd(x.sum)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="b-sr">Total {usd(total)}</p>
    </div>
  )
}

// ---------- deadline runway: every denial on one days-left axis, sized by amount ----------
export function Runway({ rows, selected, onSelect }: { rows: Row[]; selected: string; onSelect: (id: string) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const reduce = useReducedMotion()
  const max = Math.max(180, Math.ceil(Math.max(...rows.map((r) => r.days_left), 0) / 30) * 30)
  const maxB = Math.max(...rows.map((r) => r.billed_usd), 1)
  const pad = 10
  const plotW = Math.max(10, w - pad * 2)
  const x = (d: number) => pad + (d / max) * plotW
  const lanesUp = (() => {
    // dry run to find how many lanes the swarm needs
    const pl: { cx: number; lane: number; r: number }[] = []
    let top = 0
    for (const r of [...rows].sort((a, b) => a.days_left - b.days_left)) {
      const rad = 4.5 + Math.sqrt(r.billed_usd / maxB) * 4.5
      const cx = pad + (r.days_left / max) * plotW
      let lane = 0
      while (pl.some((p) => p.lane === lane && Math.abs(p.cx - cx) < p.r + rad + 2)) lane++
      pl.push({ cx, lane, r: rad })
      top = Math.max(top, lane)
    }
    return top
  })()
  const base = 26 + lanesUp * 19
  // Beeswarm: each dot takes the lowest lane where it does not touch a dot already placed.
  const placed: { id: string; cx: number; cy: number; r: number; row: Row; lane: number }[] = []
  for (const r of [...rows].sort((a, b) => a.days_left - b.days_left)) {
    const rad = 4.5 + Math.sqrt(r.billed_usd / maxB) * 4.5
    const cx = x(r.days_left)
    let lane = 0
    while (placed.some((p) => p.lane === lane && Math.abs(p.cx - cx) < p.r + rad + 2)) lane++
    placed.push({ id: r.id, cx, cy: base - 10 - lane * 19, r: rad, row: r, lane })
  }
  const ticks = Array.from({ length: max / 30 + 1 }, (_, i) => i * 30)
  return (
    <div className="b-runway" ref={ref}>
      {w > 0 && (
        <svg width={w} height={base + 22} role="img" aria-label="Denials placed by days left to appeal">
          <line x1={pad} x2={pad + plotW} y1={base + 0.5} y2={base + 0.5} className="b-rw-base" />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={base} y2={base + 4} className="b-rw-tick" />
              <text x={x(t)} y={base + 17} textAnchor={t === 0 ? "start" : t === max ? "end" : "middle"} className="b-rw-label">
                {t === 0 ? "0 days" : t}
              </text>
            </g>
          ))}
          {placed.map((p, i) => (
            <Tip
              key={p.id}
              body={
                <span>
                  <b>{p.row.patient}</b> · {usd(p.row.billed_usd)} · {p.row.days_left} days left · {VERDICT[p.row.verdict].label}
                </span>
              }
            >
              <motion.circle
                cx={p.cx}
                cy={p.cy}
                r={p.r}
                className={`b-rw-dot v-${p.row.verdict} ${p.id === selected ? "is-sel" : ""}`}
                initial={reduce ? false : { opacity: 0, cy: base - p.r }}
                animate={{ opacity: 1, cy: p.cy }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.3 + i * 0.05 }}
                onClick={() => onSelect(p.id)}
                role="button"
                aria-label={`${p.row.patient}, ${p.row.days_left} days left`}
              />
            </Tip>
          ))}
        </svg>
      )}
    </div>
  )
}

// ---------- clinical timeline: chart facts on a date axis, with the policy's waiting thresholds ----------
export function Timeline({ d }: { d: CaseDetail }) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const f = d.run.facts
  const dos = d.run.denial.dos
  const notice = d.run.denial.notice_date
  const ths = thresholdStates(d)
  const dates = [f?.onset, dos, notice, ...(f?.treatments ?? []).flatMap((t) => [t.start, t.end]), ...d.notes.map((n) => n.date), ...ths.map((t) => t.date)].filter(
    (x): x is string => !!x,
  )
  const lo = addDays(dates.reduce((a, b) => (a < b ? a : b)), -5)
  const hi = addDays(dates.reduce((a, b) => (a > b ? a : b)), 5)
  const span = Math.max(1, daysBetween(lo, hi))
  const gutter = w < 520 ? 0 : 132
  const plotW = Math.max(10, w - gutter - 8)
  const px = (iso: string) => gutter + (daysBetween(lo, iso) / span) * plotW
  // Month ticks on the 1st.
  const months: string[] = []
  {
    const [y, m] = lo.split("-").map(Number)
    let yy = y
    let mm = m + 1
    for (;;) {
      if (mm > 12) { mm = 1; yy++ }
      const iso = `${yy}-${String(mm).padStart(2, "0")}-01`
      if (toT(iso) > toT(hi)) break
      months.push(iso)
      mm++
    }
  }
  // Marker labels go in lanes above the plot so none collide.
  const marks = [
    ...ths.filter((t) => t.date).map((t) => ({ key: t.label, iso: t.date!, text: `${t.label} · ${fmtDate(t.date!, false)}`, tone: t.tone, glyph: t.glyph, kind: "th" as const })),
    { key: "dos", iso: dos, text: `Service · ${fmtDate(dos, false)}`, tone: "ink" as Tone, glyph: null, kind: "dos" as const },
    { key: "notice", iso: notice, text: `Denied · ${fmtDate(notice, false)}`, tone: "quiet" as Tone, glyph: null, kind: "notice" as const },
  ]
  const lanes: { x0: number; x1: number }[][] = []
  const laid = marks
    .sort((a, b) => toT(a.iso) - toT(b.iso))
    .map((m) => {
      const cx = px(m.iso)
      const tw = m.text.length * 6.3 + (m.glyph ? 18 : 0) + 8
      const x0 = Math.min(Math.max(0, cx - 4), Math.max(0, w - tw))
      let lane = 0
      while (lanes[lane]?.some((s) => !(x0 + tw < s.x0 || x0 > s.x1))) lane++
      ;(lanes[lane] ??= []).push({ x0, x1: x0 + tw })
      return { ...m, cx, x0, lane }
    })
  const laneH = 22
  const top = Math.max(1, lanes.length) * laneH + 8
  const rowH = 44
  const rowsY = { sym: top + 18, care: top + 14 + rowH, notes: top + 14 + rowH * 2 }
  const h = rowsY.notes + 30
  const care = (f?.treatments ?? []).filter((t) => t.start)
  return (
    <div className="b-tl" ref={ref} style={{ height: h }}>
      {w > 0 && (
        <>
          {gutter > 0 && (
            <>
              <span className="b-tl-row" style={{ top: rowsY.sym - 9 }}>Symptoms</span>
              <span className="b-tl-row" style={{ top: rowsY.care - 9 }}>Conservative care</span>
              <span className="b-tl-row" style={{ top: rowsY.notes - 9 }}>Chart notes</span>
            </>
          )}
          {months.map((m) => (
            <span key={m} className="b-tl-month" style={{ left: px(m), top: top, height: h - top - 16 }}>
              <span>{fmtMon(m)}</span>
            </span>
          ))}
          {laid.map((m, i) => (
            <motion.span
              key={m.key}
              className={`b-tl-mk k-${m.kind} t-${m.tone}`}
              style={{ left: m.cx, top: m.lane * laneH + laneH - 2, height: h - (m.lane * laneH + laneH) - 18 }}
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.35 + i * 0.08 }}
            />
          ))}
          {laid.map((m) => (
            <span key={m.key + "l"} className={`b-tl-lab k-${m.kind} t-${m.tone}`} style={{ left: m.x0, top: m.lane * laneH }}>
              {m.glyph && <Glyph name={m.glyph} size={12} />}
              {m.text}
            </span>
          ))}
          {/* Symptoms: onset to the service date */}
          {f?.onset ? (
            <motion.span
              className="b-tl-bar k-sym"
              style={{ left: px(f.onset), width: px(dos) - px(f.onset), top: rowsY.sym - 5, transformOrigin: "left" }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
            >
              <span className="b-tl-bar-t">{f.symptom_days} days of symptoms</span>
            </motion.span>
          ) : (
            <span className="b-tl-empty" style={{ left: gutter, top: rowsY.sym - 10 }}>No onset date in the chart</span>
          )}
          {/* Conservative care: one bar per dated treatment */}
          {care.length ? (
            care.map((t, i) => {
              const end = t.end ?? dos
              return (
                <motion.span
                  key={i}
                  className="b-tl-bar k-care"
                  style={{ left: px(t.start!), width: Math.max(6, px(end) - px(t.start!)), top: rowsY.care - 5 + (care.length > 1 ? (i - (care.length - 1) / 2) * 9 : 0), transformOrigin: "left" }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.3 + i * 0.1 }}
                  title={`${t.kind}${t.sessions ? `, ${t.sessions} sessions` : ""}: ${fmtDate(t.start!)} to ${fmtDate(end)}`}
                />
              )
            })
          ) : (
            <span className="b-tl-empty is-warn" style={{ left: gutter, top: rowsY.care - 11 }}>
              <Glyph name="half" size={12} /> No dated therapy in the chart
            </span>
          )}
          {care.length > 0 &&
            (() => {
              // The care label goes right of the bars, else left of them, else above: never across a marker.
              const text = care.map((t) => t.kind + (t.sessions ? ` (${t.sessions} sessions)` : "")).join(", ")
              const tw = text.length * 6.2
              const x0 = px(care[0].start!)
              const x1 = Math.max(...care.map((t) => px(t.end ?? dos)))
              const markX = laid.map((m) => m.cx).filter((cx) => cx > x1)
              const room = (markX.length ? Math.min(...markX) : w) - x1 - 16
              const left = room >= tw ? x1 + 8 : Math.min(x0, Math.max(0, w - tw))
              const top = room >= tw ? rowsY.care - 9 : rowsY.care - 30
              return (
                <span className="b-tl-care-t" style={{ left, top, width: tw, }}>
                  {text}
                </span>
              )
            })()}
          {d.notes.map((n, i) => (
            <motion.span
              key={n.note_id}
              className="b-tl-note"
              style={{ left: px(n.date), top: rowsY.notes - 5 }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.45 + i * 0.06 }}
              title={`${n.note_type.replace(/_/g, " ")} · ${fmtDate(n.date)}`}
            />
          ))}
        </>
      )}
    </div>
  )
}

// ---------- model-call trace: cost per pipeline step, one hue ----------
export function Trace({ groups }: { groups: TraceGroup[] }) {
  const maxC = Math.max(...groups.map((g) => g.cost), 1e-9)
  return (
    <ul className="b-trace">
      {groups.map((g, i) => (
        <li key={g.key}>
          <div className="b-trace-h">
            <span className="b-trace-n">{g.name}</span>
            <span className="b-trace-c">{usd4(g.cost)}</span>
            <span className="b-trace-s">{g.seconds.toFixed(1)} s</span>
          </div>
          <div className="b-trace-track">
            <motion.span
              className="b-trace-fill"
              style={{ width: `${(g.cost / maxC) * 100}%`, transformOrigin: "left" }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.06 }}
            />
          </div>
          <span className="b-trace-m">
            {g.models.map((m) => `Nemotron ${m.name}${m.n > 1 ? ` × ${m.n}` : ""}`).join(", ")}
            {g.referees > 0 ? ` (${g.referees} as referee)` : ""}
          </span>
        </li>
      ))}
    </ul>
  )
}

export const rowPayer = (r: Row) => shortPayer(r.payer)
export { STATUS }
