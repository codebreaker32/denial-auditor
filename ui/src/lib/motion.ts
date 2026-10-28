import { useEffect, useRef, useState } from "react"
// Measured easings (docs/research/top-sites-patterns.md section 4), as framer-motion cubic-bezier arrays.
export const EASE_OUT = [0.25, 1, 0.5, 1] as const
export const EASE_ENTER = [0.16, 1, 0.3, 1] as const
export const EASE_PANEL = [0.32, 0.72, 0, 1] as const
export const EASE_EXIT = [0.4, 0, 1, 1] as const
export const PRESS_SPRING = { type: "spring", stiffness: 520, damping: 32, mass: 0.6 } as const

// Enter from 12px below; stagger 50ms, at most 6 steps.
export const enter = (i = 0, base = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.64, ease: EASE_ENTER, delay: base + Math.min(i, 6) * 0.05 },
})

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

// ---------- scroll reveals that never leave a blank ----------
// A block reveals (rises into place, never hidden) as it nears the viewport. It settles at once, with no animation, when IntersectionObserver is
// missing, when it is already above the viewport (restored scroll), or when the viewport suddenly grows to page
// height (a full-page capture or print), so a screenshot of the whole page is never caught mid-fade.

const BASE_H = typeof window !== "undefined" ? window.innerHeight : 0
let capture = false
if (typeof window !== "undefined") {
  window.addEventListener("beforeprint", () => (capture = true))
  window.addEventListener("resize", () => {
    if (window.innerHeight > Math.max(1400, BASE_H * 1.6)) capture = true
  })
}
const flat = () => capture || prefersReducedMotion()

export function useReveal<T extends Element>(margin = "0px 0px 15% 0px") {
  const ref = useRef<T>(null)
  const [state, setState] = useState<{ shown: boolean; instant: boolean }>(() =>
    typeof IntersectionObserver === "undefined" ? { shown: true, instant: true } : { shown: false, instant: false },
  )
  useEffect(() => {
    const el = ref.current
    if (!el || state.shown) return
    if (el.getBoundingClientRect().bottom < 0 || capture) return setState({ shown: true, instant: true })
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        setState({ shown: true, instant: flat() })
        io.disconnect()
      },
      { rootMargin: margin },
    )
    io.observe(el)
    const onGrow = () => capture && setState({ shown: true, instant: true })
    window.addEventListener("resize", onGrow)
    return () => {
      io.disconnect()
      window.removeEventListener("resize", onGrow)
    }
  }, [state.shown, margin])
  return { ref, ...state }
}
