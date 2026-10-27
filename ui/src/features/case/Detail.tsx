// The case detail pane: the answer first, what is at stake, then one section at a time (the next step, the rules,
// the policy, the chart, the denial letter). Exactly one primary action is on screen at a time; on a phone the header
// keeps it at the top and jumps to the action bar (Export on an appeal).
import NumberFlow from "@number-flow/react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowUpRight, ChevronsUpDown } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EASE_ENTER, EASE_OUT, enter } from "@/lib/motion"
import { PLAN, RULE_NAME, daysBetween, fmtDate, policyInForce, shortPayer, verdictView, type CaseDetail, type GlyphName, type Verdict } from "@/lib/data"
import { Glyph, Mark, Press } from "@/features/ui"
import { Appeal, type Target } from "@/features/appeal/Appeal"
import { FixPane, HoldPane, RequestPane, WhyPane } from "./actions"
import { carcMeaning, deciding, hold, prep, useCheck } from "./model"
import { ChartPane, NoticePane, PolicyPane, RulesPane, type Focus } from "./panes"
import { notify } from "@/features/toast"
import { WORK, WORK_ORDER, getWork, setWork, useWork } from "./work"
import "./case.css"

type TabKey = "act" | "rules" | "policy" | "chart" | "notice"

const ACT: Record<Verdict, { tab: string; go: string; here: string }> = {
  appeal: { tab: "Appeal letter", go: "Review appeal", here: "Go to export" },
  doc_request: { tab: "Physician request", go: "Open the request", here: "Go to the request" },
  fix_checklist: { tab: "Fix checklist", go: "Open fix checklist", here: "Go to the checklist" },
  dont_appeal: { tab: "What's missing", go: "See what's missing", here: "Go to what's missing" },
  not_winnable: { tab: "Why", go: "See why", here: "Go to why" },
}
const PHONE = "(max-width: 899px)"
function usePhone() {
  const [m, setM] = useState(() => window.matchMedia(PHONE).matches)
  useEffect(() => {
    const mq = window.matchMedia(PHONE)
    const on = () => setM(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return m
}

function tabFromHash(valid: TabKey[]): TabKey | null {
  const m = window.location.hash.match(/[?&]tab=([a-z]+)/)
  const t = m?.[1] as TabKey | undefined
  return t && valid.includes(t) ? t : null
}

export function Detail({ d }: { d: CaseDetail }) {
  const run = d.run
  const den = run.denial
  const check = useCheck(d.id)
  const alt = check.facts
  const ms = useMemo(() => prep(d), [d])
  const h = useMemo(() => hold(d, ms, check.row, alt), [d, ms, check.row, alt])
  const v = verdictView(run.verdict, h.early)
  const act = h.early ? { tab: "Reorder", go: "See when it can qualify", here: "Go to the reorder date" } : ACT[run.verdict]
  const phone = usePhone()
  const dec = useMemo(() => deciding(ms), [ms])
  const clinical = run.triage.route === "clinical_review"

  const tabs = useMemo(() => {
    const t: { key: TabKey; label: string; glyph?: GlyphName }[] = [{ key: "act", label: act.tab, glyph: v.glyph }]
    if (clinical && (run.matches?.length ?? 0) > 0) t.push({ key: "rules", label: "Rules" })
    if (run.policy) t.push({ key: "policy", label: "Policy" })
    if (d.notes.length) t.push({ key: "chart", label: "Chart" })
    t.push({ key: "notice", label: "Denial letter" })
    return t
  }, [act.tab, v.glyph, clinical, run.matches, run.policy, d.notes.length])
  const keys = tabs.map((t) => t.key)
  const fallback: TabKey = keys.includes("rules") ? "rules" : "notice"
  const [tab, setTabState] = useState<TabKey>(() => tabFromHash(keys) ?? fallback)
  const [focus, setFocus] = useState<Focus | null>(null)
  const anchor = useRef<HTMLDivElement>(null)

  const setTab = useCallback(
    (t: TabKey, scroll = false) => {
      setTabState(t)
      try {
        history.replaceState(null, "", `#/app/c/${d.id}?tab=${t}`)
      } catch {
        /* the URL just doesn't remember the tab */
      }
      if (scroll && anchor.current) {
        const top = anchor.current.getBoundingClientRect().top + window.scrollY - 8
        if (window.scrollY > top || anchor.current.getBoundingClientRect().top > window.innerHeight * 0.6) window.scrollTo({ top, behavior: "smooth" })
      }
    },
    [d.id],
  )
  const onPolicy = useCallback((n: number) => {
    setTab("policy", true)
    setFocus({ kind: "policy", n, at: Date.now() })
  }, [setTab])
  const onNote = useCallback((id: string) => {
    setTab("chart", true)
    setFocus({ kind: "note", id, at: Date.now() })
  }, [setTab])
  const onRule = useCallback((id: string) => {
    setTab("rules", true)
    setFocus({ kind: "rule", id, at: Date.now() })
  }, [setTab])
  const goto = useCallback((t: Target) => (t.kind === "policy" ? onPolicy(t.n) : onNote(t.id)), [onPolicy, onNote])
  // Phone: bring the action bar to the top and focus its primary (Export on an appeal).
  const jumpToAction = useCallback(() => {
    // The appeal's bar sticks to the bottom of the screen while the letter is in view, so the panel's top is enough.
    const top = anchor.current ? anchor.current.getBoundingClientRect().top + window.scrollY - 8 : 0
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" })
    const btn = document.querySelector<HTMLElement>("#case-panel .ap-ex button, #case-panel .act-go, #case-panel .pill-ink")
    btn?.focus({ preventScroll: true })
  }, [])

  const windowDays = Math.max(1, daysBetween(den.notice_date, d.deadline.due))
  const runway = Math.max(0, Math.min(1, d.deadline.days_left / windowDays))
  const tabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return
    e.preventDefault()
    const i = keys.indexOf(tab)
    const n = e.key === "Home" ? 0 : e.key === "End" ? keys.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length
    setTab(keys[n])
    document.getElementById(`tab-${keys[n]}`)?.focus()
  }

  return (
    <article className="cd" aria-label={`Denial for ${d.patient}`}>
      <motion.header className="cd-head" {...enter(0)}>
        <div className="cd-who">
          <h2>{d.patient}</h2>
          <p className="cd-meta mono">
            <span>{shortPayer(den.payer_name)}</span>
            <span>{PLAN[den.plan_type] ?? den.plan_type}</span>
            <span>CPT {den.cpt}</span>
            <span>DOS {fmtDate(den.dos)}</span>
          </p>
        </div>
        <div className="cd-acts">
          <WorkMenu caseId={d.id} />
          <AnimatePresence initial={false} mode="popLayout">
            {phone && tab === "act" && (
              <motion.span key="here" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }} transition={{ duration: 0.22, ease: EASE_OUT }}>
                <Press className="pill pill-ink pill-sm" onClick={jumpToAction}>
                  {act.here}
                </Press>
              </motion.span>
            )}
            {tab !== "act" && (
              <motion.span key="go" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }} transition={{ duration: 0.22, ease: EASE_OUT }}>
                <Press
                  className="pill pill-ink pill-sm"
                  onClick={() => {
                    setTab("act", true)
                    // The button leaves with this click; keep focus on the section it opened.
                    window.requestAnimationFrame(() => document.getElementById("tab-act")?.focus({ preventScroll: true }))
                  }}
                >
                  {act.go}
                </Press>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      <motion.div className="cd-band" {...enter(1)}>
      <section className={`cd-verdict tone-${v.tone}`} aria-label="Recommendation">
        <div className="cd-v-main">
          <Mark tone={v.tone} glyph={v.glyph} label={v.label} size={18} className="mark-lg" />
          <p>{v.line}</p>
        </div>
        <div className="cd-reason">
          <span className="lbl">Payer's reason{den.carc.length ? ` (code ${den.carc.join(", ")})` : ""}</span>
          <q>{den.reason_text}</q>
          {run.policy && (
            <a className="textlink cd-pol" href={run.policy.url} target="_blank" rel="noreferrer">
              {policyInForce(run.policy)} <ArrowUpRight size={13} strokeWidth={1.8} />
            </a>
          )}
        </div>
      </section>

      <dl className="cd-stakes">
        <div>
          <dt className="lbl">Billed, at stake</dt>
          <dd className="cd-fig num">
            <NumberFlow value={d.billed_usd} format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }} />
          </dd>
          <dd className="cd-sub">Synthetic claim</dd>
        </div>
        <div>
          <dt className="lbl">{run.verdict === "fix_checklist" ? "Window to act" : "Appeal deadline"}</dt>
          <dd className="cd-fig num">
            <NumberFlow value={d.deadline.days_left} /> <span className="cd-unit">days</span>
          </dd>
          <dd className="cd-run" aria-hidden="true">
            <motion.i className={runway < 0.25 ? "is-soon" : ""} initial={{ scaleX: 0 }} animate={{ scaleX: runway }} transition={{ duration: 1.2, ease: EASE_ENTER, delay: 0.2 }} />
          </dd>
          <dd className="cd-sub">
            <span title={`${RULE_NAME[d.deadline.rule_id] ?? "Appeal window"}, ${d.deadline.citation}`}>Due {fmtDate(d.deadline.due)} · {d.deadline.citation}</span>
          </dd>
        </div>
        <div>
          <dt className="lbl">Policy rules</dt>
          {dec.length ? (
            <>
              <dd className="cd-fig num">
                {dec.filter((m) => m.show === "met").length} <span className="cd-unit">of {dec.length} met</span>
              </dd>
              <dd className="cd-sub">{ruleSummary(dec.map((m) => m.show))}</dd>
            </>
          ) : (
            <>
              <dd className="cd-fig num t-quiet" aria-label="None">–</dd>
              <dd className="cd-sub">No policy review needed: {carcMeaning(d).toLowerCase() || "an administrative reason"}</dd>
            </>
          )}
        </div>
      </dl>
      </motion.div>

      <motion.div ref={anchor} className="tabs" role="tablist" aria-label="Case sections" onKeyDown={tabKey} {...enter(3)}>
        {tabs.map((t) => {
          const on = tab === t.key
          return (
            <button
              key={t.key}
              id={`tab-${t.key}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="case-panel"
              tabIndex={on ? 0 : -1}
              className={`tab ${on ? "is-on" : ""} ${t.key === "act" ? `tab-act t-${v.tone}` : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.glyph && <Glyph name={t.glyph} size={13} />}
              <span>{t.label}</span>
              {on && <motion.span layoutId={`tab-ul-${d.id}`} className="tab-ul" transition={{ type: "spring", stiffness: 480, damping: 40 }} />}
            </button>
          )
        })}
      </motion.div>

      <div id="case-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="cd-panel">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.42, ease: EASE_ENTER }}
          >
            {tab === "act" &&
              (run.verdict === "appeal" && run.appeal ? (
                <Appeal d={d} goto={goto} />
              ) : run.verdict === "doc_request" ? (
                <RequestPane d={d} ms={ms} onRule={onRule} />
              ) : run.verdict === "fix_checklist" ? (
                <FixPane d={d} />
              ) : run.verdict === "not_winnable" ? (
                <WhyPane d={d} />
              ) : (
                <HoldPane d={d} h={h} alt={alt} onRule={onRule} />
              ))}
            {tab === "rules" && <RulesPane d={d} ms={ms} alt={alt} onPolicy={onPolicy} onNote={onNote} focus={focus} />}
            {tab === "policy" && <PolicyPane d={d} ms={ms} focus={focus} />}
            {tab === "chart" && <ChartPane d={d} ms={ms} alt={alt} focus={focus} onPolicy={onPolicy} />}
            {tab === "notice" && <NoticePane d={d} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </article>
  )
}

function WorkMenu({ caseId }: { caseId: string }) {
  const w = useWork(caseId)
  const cur = WORK[w.status]
  const [pulse, setPulse] = useState(0)
  useEffect(() => setPulse((p) => p + 1), [w.status])
  const choose = (s: typeof w.status) => {
    const before = getWork(caseId).status
    if (s === before) return
    setWork(caseId, s)
    notify(`Moved to ${WORK[s].label}`, () => setWork(caseId, before))
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="work pill pill-ghost pill-sm" aria-label={`Work state: ${cur.label}. Change`}>
        <motion.span key={pulse} className={`work-g t-${cur.tone}`} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 520, damping: 26 }}>
          <Glyph name={cur.glyph} size={14} />
        </motion.span>
        <span>{cur.label}</span>
        <ChevronsUpDown size={14} strokeWidth={1.7} className="work-x" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="menu w-[240px]">
        <DropdownMenuLabel className="menu-l">Work state</DropdownMenuLabel>
        {WORK_ORDER.map((s) => (
          <DropdownMenuItem key={s} className="menu-i" onSelect={() => choose(s)}>
            <Glyph name={WORK[s].glyph} size={14} className={`t-${WORK[s].tone}`} />
            {WORK[s].label}
            {s === w.status && <span className="ml-auto mono work-cur">current</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="menu-note">Kept in this browser. Sent means you sent it; the tool never does.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ruleSummary(shows: string[]) {
  const n = (k: string) => shows.filter((s) => s === k).length
  const parts = [
    n("missing_documentation") && `${n("missing_documentation")} missing documentation`,
    n("not_met") && `${n("not_met")} not met`,
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : "Every deciding rule is met"
}
