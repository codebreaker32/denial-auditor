// The worklist: denials on the left (filter by recommendation or work state, j/k to move, Enter to open), the open
// case on the right. Rows draw from /api/cases at once; held denials then refine to the case view's own wording
// ("Reorder, don't appeal") from the same cached case and check answers, in place, without moving anything.
import NumberFlow from "@number-flow/react"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useCase, useCases } from "@/lib/api"
import { go } from "@/lib/router"
import { EASE_ENTER, EASE_OUT } from "@/lib/motion"
import { ORDER, VERDICT, initials, shortPayer, usd, verdictView, type Row, type Verdict } from "@/lib/data"
import { Glyph, Mark, useGlow } from "@/features/ui"
import { Checking } from "@/features/case/Checking"
import { Detail } from "@/features/case/Detail"
import { heldEarly } from "@/features/case/model"
import { WORK, WORK_ORDER, useWorkMap, type WorkStatus } from "@/features/case/work"

function useIsPhone() {
  const q = "(max-width: 899px)"
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return m
}

const FILTERS: (Verdict | null)[] = [null, ...ORDER]
// The row's short word for a work state; the full label is in the tooltip and for screen readers.
const ROW_WORD: Record<WorkStatus, string> = { todo: "To do", waiting: "Waiting", ready: "Ready", sent: "Sent" }
// Filter names cover every row they hold: "Don't appeal" spans "Don't appeal yet" and "Reorder, don't appeal".
const FILTER_LABEL: Record<Verdict, string> = { ...Object.fromEntries(ORDER.map((v) => [v, VERDICT[v].label])), dont_appeal: "Don't appeal" } as Record<Verdict, string>

// For each held denial: is it too early to win (reorder) or documentable? Unknown until its case has loaded.
function useEarly(rows: Row[]) {
  const [early, setEarly] = useState<Record<string, boolean>>({})
  const ids = rows.filter((r) => r.verdict === "dont_appeal").map((r) => r.id).join(",")
  useEffect(() => {
    let live = true
    ids.split(",").filter(Boolean).forEach((id) =>
      heldEarly(id).then((e) => live && setEarly((m) => (m[id] === e ? m : { ...m, [id]: e })), () => {}),
    )
    return () => {
      live = false
    }
  }, [ids])
  return early
}

export function Queue({ caseId }: { caseId: string | null }) {
  const { data, error } = useCases()
  const phone = useIsPhone()
  const [filter, setFilter] = useState<Verdict | null>(null)
  const [state, setState] = useState<WorkStatus | "any">("any")
  const work = useWorkMap()
  const stateOf = (id: string): WorkStatus => work[id]?.status ?? "todo"
  const rows = useMemo(
    () => (data ? [...data.cases].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict) || a.days_left - b.days_left) : []),
    [data],
  )
  const early = useEarly(rows)
  const shown = rows.filter((r) => (!filter || r.verdict === filter) && (state === "any" || stateOf(r.id) === state))
  const openId = caseId ?? (phone ? null : rows[0]?.id ?? null)
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const i = shown.findIndex((r) => r.id === openId)
    if (i >= 0) setCursor(i)
  }, [openId, shown])

  const open = useCallback((id: string) => go(`#/app/c/${id}`), [])

  // j/k (and arrows) move the cursor, Enter opens. Ignored while typing.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!shown.length) return
      if (e.key === "j" || e.key === "ArrowDown" || e.key === "k" || e.key === "ArrowUp") {
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !listRef.current?.contains(t)) return
        e.preventDefault()
        const dir = e.key === "j" || e.key === "ArrowDown" ? 1 : -1
        setCursor((c) => {
          const n = Math.max(0, Math.min(shown.length - 1, c + dir))
          const b = listRef.current?.querySelectorAll<HTMLButtonElement>("button.qrow")[n]
          b?.focus({ preventScroll: true })
          b?.scrollIntoView({ block: "nearest" })
          return n
        })
      } else if (e.key === "Enter" && listRef.current?.contains(t)) {
        e.preventDefault()
        open(shown[cursor]?.id ?? shown[0].id)
      }
    }
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
  }, [shown, cursor, open])

  const total = shown.reduce((s, r) => s + r.billed_usd, 0)
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    rows.forEach((r) => (c[r.verdict] = (c[r.verdict] ?? 0) + 1))
    return c
  }, [rows])
  const maxDays = Math.max(1, ...rows.map((r) => r.days_left))
  const glow = useGlow()

  const showList = !phone || !caseId
  const showDetail = !phone || !!caseId

  return (
    <div className="q">
      {showList && (
        <section className="q-list" aria-label="Denials">
          <header className="q-head">
            <div className="q-title">
              <h1>Denials</h1>
              <span className="mono num">{rows.length || ""} open</span>
            </div>
            <div className="q-stake">
              <span className="q-stake-fig num">
                <NumberFlow value={total} format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
              </span>
              <span className="q-stake-l">at stake{filter ? ` in ${FILTER_LABEL[filter].toLowerCase()}` : ""} · synthetic claims</span>
            </div>
          </header>

          <div className="q-filters" role="toolbar" aria-label="Filter by recommendation">
            <LayoutGroup id="qf">
              {FILTERS.map((f) => {
                const on = filter === f
                const n = f ? counts[f] ?? 0 : rows.length
                return (
                  <button
                    key={f ?? "all"}
                    type="button"
                    className={`qf ${on ? "is-on" : ""}`}
                    aria-pressed={on}
                    disabled={!n}
                    onClick={() => setFilter(f)}
                  >
                    {on && <motion.span layoutId="qf-on" className="qf-bg" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
                    <span className="qf-t">{f ? FILTER_LABEL[f] : "All"}</span>
                    <span className="qf-n mono num">{n}</span>
                  </button>
                )
              })}
            </LayoutGroup>
            <label className="qs">
              <span className="sr">Work state</span>
              <select value={state} onChange={(e) => setState(e.target.value as WorkStatus | "any")}>
                <option value="any">Any state</option>
                {WORK_ORDER.map((w) => (
                  <option key={w} value={w}>
                    {WORK[w].label} ({rows.filter((r) => stateOf(r.id) === w).length})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="q-err">The worklist didn't load ({error}). Is the API on port 8600 running?</p>}
          {!data && !error && <QueueSkeleton />}
          {data && !shown.length && (
            <p className="q-empty">
              Nothing here.{" "}
              <button type="button" className="textbtn" onClick={() => { setFilter(null); setState("any") }}>Show every denial</button>
            </p>
          )}
          <LayoutGroup id="qrows">
            <ul className="q-rows" ref={listRef}>
              <AnimatePresence initial={false} mode="popLayout">
                {shown.map((r, i) => (
                  <motion.li
                    key={r.id}
                    layout="position"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.64, ease: EASE_ENTER, delay: Math.min(i, 6) * 0.05 }}
                  >
                    <QueueRow r={r} early={early[r.id]} work={stateOf(r.id)} on={r.id === openId && !phone} cursor={i === cursor} maxDays={maxDays} onOpen={() => open(r.id)} onFocus={() => setCursor(i)} glow={glow} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </LayoutGroup>
          <p className="q-keys">
            <kbd>j</kbd> <kbd>k</kbd> to move · <kbd>Enter</kbd> to open
          </p>
        </section>
      )}

      {showDetail && (
        <section className="q-detail" aria-label="Open denial">
          {phone && <h1 className="sr">Open denial</h1>}
          {phone && (
            <button type="button" className="q-back" onClick={() => go("#/app")}>
              <ArrowLeft size={16} strokeWidth={1.8} /> Denials
            </button>
          )}
          {openId && <CasePane key={openId} id={openId} />}
        </section>
      )}
    </div>
  )
}

function QueueRow({
  r, early, work, on, cursor, maxDays, onOpen, onFocus, glow,
}: { r: Row; early: boolean | undefined; work: WorkStatus; on: boolean; cursor: boolean; maxDays: number; onOpen: () => void; onFocus: () => void; glow: ReturnType<typeof useGlow> }) {
  // A held denial reads "Don't appeal" until its case says which kind of hold it is.
  const held = r.verdict === "dont_appeal"
  const v = held && early === undefined ? { ...VERDICT.dont_appeal, label: "Don't appeal" } : verdictView(r.verdict, !!early)
  const w = WORK[work]
  const soon = r.days_left <= 45
  return (
    <button
      type="button"
      className={`qrow glow ${on ? "is-on" : ""} ${cursor ? "is-cursor" : ""}`}
      onClick={onOpen}
      onFocus={onFocus}
      onPointerMove={glow}
      aria-current={on ? "true" : undefined}
    >
      {on && <motion.span layoutId="qrow-on" className="qrow-bg" transition={{ type: "spring", stiffness: 420, damping: 38 }} />}
      <span className={`avatar t-${v.tone}`} aria-hidden="true">{initials(r.patient)}</span>
      <span className="qrow-a">
        <span className="qrow-name">{r.patient}</span>
        <span className="qrow-amt mono num">{usd(r.billed_usd)}</span>
      </span>
      <span className="qrow-b">
        <Mark tone={v.tone} glyph={v.glyph} label={v.label} size={13} />
        {/* Once work has started, its state replaces the payer, so the row keeps one line. */}
        {work === "todo" && <span className="qrow-payer">{shortPayer(r.payer)}</span>}
        {work !== "todo" && (
          <span className={`qrow-work t-${w.tone}`} title={`Work state: ${w.label}`}>
            <Glyph name={w.glyph} size={12} />
            <span aria-hidden="true">{ROW_WORD[work]}</span>
            <span className="sr">{w.label}</span>
          </span>
        )}
        <span className={`qrow-days mono num ${soon ? "is-soon" : ""}`} title={`Due ${r.due}`}>
          <span className="qrow-run" aria-hidden="true">
            <i style={{ transform: `scaleX(${r.days_left / maxDays})` }} />
          </span>
          {r.days_left}d
        </span>
      </span>
    </button>
  )
}

function QueueSkeleton() {
  return (
    <ul className="q-rows" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="qrow-skel">
          <span className="sk sk-av" />
          <span className="sk sk-l1" />
          <span className="sk sk-l2" />
        </li>
      ))}
    </ul>
  )
}

function CasePane({ id }: { id: string }) {
  const { data, error } = useCase(id)
  const [checked, setChecked] = useState(false)
  const done = useCallback(() => setChecked(true), [])
  return (
    <div className="q-pane">
      {error && <p className="q-err">This case didn't load ({error}).</p>}
      <AnimatePresence mode="wait">
        {data && !checked ? (
          <Checking key="ck" d={data} onDone={done} />
        ) : data ? (
          <motion.div key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
            <Detail d={data} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
