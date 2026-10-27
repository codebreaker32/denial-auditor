// Small shared pieces: drawn status glyphs, glyph+word marks, the pressable command, the cursor glow.
import { motion, type HTMLMotionProps } from "framer-motion"
import { useCallback, type PointerEvent, type ReactNode } from "react"
import { PRESS_SPRING } from "@/lib/motion"
import type { GlyphName, Tone } from "@/lib/data"

export function Glyph({ name, size = 14, className }: { name: GlyphName; size?: number; className?: string }) {
  const s = { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true, className, fill: "none" } as const
  const st = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const
  switch (name) {
    case "check":
      return (
        <svg {...s}>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M5 8.2l2 2 4-4.4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case "half":
      return (
        <svg {...s}>
          <circle cx="8" cy="8" r="6.2" {...st} />
          <path d="M8 1.8a6.2 6.2 0 0 1 0 12.4Z" fill="currentColor" />
        </svg>
      )
    case "ring":
      return (
        <svg {...s}>
          <circle cx="8" cy="8" r="5.6" {...st} strokeWidth={2} />
        </svg>
      )
    case "cross":
      return (
        <svg {...s}>
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      )
    case "dash":
      return (
        <svg {...s}>
          <circle cx="8" cy="8" r="6.2" {...st} strokeOpacity={0.55} />
          <path d="M5.4 8h5.2" {...st} />
        </svg>
      )
    case "pause":
      return (
        <svg {...s}>
          <circle cx="8" cy="8" r="6.2" {...st} />
          <path d="M6.6 5.6v4.8M9.4 5.6v4.8" {...st} />
        </svg>
      )
    case "return":
      return (
        <svg {...s}>
          <circle cx="8" cy="8" r="6.2" {...st} />
          <path d="M10.6 6.8H6.2m0 0 1.8-1.8M6.2 6.8 8 8.6M6.2 6.8v0" {...st} />
          <path d="M10.6 6.8v2.4a1.4 1.4 0 0 1-1.4 1.4H7" {...st} />
        </svg>
      )
    case "slash":
      return (
        <svg {...s}>
          <circle cx="8" cy="8" r="6.2" {...st} />
          <path d="M4 12 12 4" {...st} />
        </svg>
      )
  }
}

export function Mark({ tone, glyph, label, size = 14, className = "" }: { tone: Tone; glyph: GlyphName; label: string; size?: number; className?: string }) {
  return (
    <span className={`mark t-${tone} ${className}`}>
      <Glyph name={glyph} size={size} />
      <span>{label}</span>
    </span>
  )
}

// A command: presses to 0.97 in 80ms and springs back. Only for in-app commands, never for nav or rows.
export function Press({ children, className = "", ...rest }: HTMLMotionProps<"button"> & { children: ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97, transition: { duration: 0.08 } }}
      transition={PRESS_SPRING}
      className={className}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

// Feeds the pointer position to .glow surfaces.
export function useGlow() {
  return useCallback((e: PointerEvent<HTMLElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${e.clientX - r.left}px`)
    el.style.setProperty("--my", `${e.clientY - r.top}px`)
  }, [])
}

// The mark: an opening quote, then a check in the "verified" blue. A quote ships only once it matches its source.
export function LogoMark({ size = 26, onNight = false }: { size?: number; onNight?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="logomark">
      <rect width="24" height="24" rx="7" fill={onNight ? "var(--on-night)" : "var(--ink)"} />
      <path
        transform="rotate(180 7.9 12) translate(0 -.4)"
        d="M10.2 9.6a2.35 2.35 0 1 0-2.6 2.34c-.2 1.24-.94 2.2-2.1 2.86l.62.98c2.36-1.12 3.98-3.3 4.08-6.18Z"
        fill={onNight ? "var(--ink)" : "var(--on-night)"}
      />
      <path d="M11.6 13.2l2.5 2.6 5.1-6.4" fill="none" stroke={onNight ? "var(--verified-night)" : "var(--verified)"} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Wordmark({ onNight = false, size = 32 }: { onNight?: boolean; size?: number }) {
  return (
    <span className="wordmark" style={{ color: onNight ? "var(--on-night)" : "var(--ink)" }}>
      <LogoMark size={size} onNight={onNight} />
      <span>Denial Auditor</span>
    </span>
  )
}

// Skip link: hash routing owns the URL fragment, so focus the main landmark directly.
export function SkipLink() {
  return (
    <a
      className="skip"
      href="#main"
      onClick={(e) => {
        e.preventDefault()
        const m = document.getElementById("main")
        m?.focus()
        m?.scrollIntoView()
      }}
    >
      Skip to content
    </a>
  )
}
