// Mock sign-in. There are no accounts: one click opens the demo workspace of synthetic patients.
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { useEffect, useState } from "react"
import { getJSON } from "@/lib/api"
import type { CasesResp } from "@/lib/data"
import { EASE_ENTER, enter } from "@/lib/motion"
import { go } from "@/lib/router"
import { DEMO, startSession } from "@/lib/session"
import { Glyph, Press, SkipLink, Wordmark } from "@/features/ui"
import "./app.css"

export function Login() {
  const [phase, setPhase] = useState<"idle" | "busy">("idle")
  const [steps, setSteps] = useState<string[]>([])
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    getJSON<CasesResp>("/api/cases").then((d) => setCount(d.cases.length), () => setCount(null))
  }, [])

  const enterDemo = () => {
    if (phase === "busy") return
    setPhase("busy")
    startSession()
    const n = count ?? 0
    const lines = ["Opening the demo workspace", n ? `Loading the worklist · ${n} denials` : "Loading the worklist", "Checking cited policy versions"]
    lines.forEach((l, i) => window.setTimeout(() => setSteps((s) => [...s, l]), 120 + i * 210))
    // warm the first case while the steps play
    getJSON<CasesResp>("/api/cases").then((d) => d.cases[0] && getJSON(`/api/cases/${d.cases[0].id}`)).catch(() => {})
    window.setTimeout(() => go("#/app"), 900)
  }

  return (
    <div className="login">
      <SkipLink />
      <header className="login-brand">
        <a href="#/" className="link" title="Back to the overview">
          <Wordmark />
        </a>
      </header>
      <motion.main className="login-card" id="main" tabIndex={-1} {...enter(0)} aria-labelledby="login-h">
        <h1 id="login-h">Sign in to your workspace</h1>
        <p className="login-sub">This is a demo. There is no password and nothing to sign up for.</p>

        <div className="login-ws" role="group" aria-label="Demo workspace">
          <span className="avatar t-ink" aria-hidden="true">SJ</span>
          <span className="login-ws-t">
            <b>{DEMO.workspace}</b>
            <span>Synthetic patients · {count ?? "…"} open denials</span>
          </span>
          <Glyph name="check" size={15} className="t-ink" />
        </div>
        <div className="login-user">
          <span className="lbl">Signed in as</span>
          <span>{DEMO.user}, {DEMO.role.toLowerCase()} (demo user)</span>
        </div>

        <Press className="pill pill-ink login-go" onClick={enterDemo} aria-busy={phase === "busy"} disabled={phase === "busy"}>
          <AnimatePresence mode="wait" initial={false}>
            {phase === "idle" ? (
              <motion.span key="a" className="login-go-t" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                Continue to the demo <ArrowRight size={16} strokeWidth={1.8} className="nudge" />
              </motion.span>
            ) : (
              <motion.span key="b" className="login-go-t" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" className="spin" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.8" />
                  <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Signing in
              </motion.span>
            )}
          </AnimatePresence>
        </Press>

        <ol className="login-steps" aria-live="polite">
          {steps.map((s) => (
            <motion.li key={s} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: EASE_ENTER }}>
              <Glyph name="check" size={12} /> {s}
            </motion.li>
          ))}
        </ol>
      </motion.main>
      <footer className="login-foot mono">Demo workspace · synthetic patient data only · no real sign-in</footer>
    </div>
  )
}
