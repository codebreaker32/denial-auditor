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
