// The policy globe. Each dot cell is one sentence of the fetched LCD L34220 text, laid in reading order on a
// spherical spiral. The rules the pipeline cut from those sentences are the "cities". Saved showcase runs are
// replayed: each verified chart quote flies in as an arc and its rule locks blue; a rule the chart can't support
// yet gets an amber hollow ring. Canvas 2D, paused offscreen and in hidden tabs, one still frame under
// prefers-reduced-motion, fewer dots when frames run slow.
import { useEffect, useRef, useState } from "react"
import { shortRule, type CaseDetail, type Status, type Verdict } from "@/lib/data"

export interface GlobeCase {
  id: string
  patient: string
  verdict: Verdict
  detail: CaseDetail
}
export interface GlobePhase {
  caseId: string
  patient: string
  verdict: Verdict | null
  met: number
  missing: number
  quotes: number
}

type V3 = [number, number, number]
type RGB = [number, number, number]

const COL = {
  base: [242, 241, 236] as RGB,
  met: [92, 132, 255] as RGB, // verified blue, lifted for the night ground
  missing: [242, 169, 59] as RGB,
  notMet: [229, 103, 75] as RGB,
}
const AUTO_SPIN = 0.05 // rad/s, about two minutes per turn
const TILT = (8 * Math.PI) / 180
const CASE_MS = 15000
const STEP_MS = 1450
const ARC_MS = 1200

const easeEnter = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 4) // close to cubic-bezier(0.16,1,0.3,1)

function rand(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

interface Geometry {
  dots: Float32Array // x,y,z per dot
  owner: Int16Array // sentence index per dot
  bySentence: number[][] // dot indices per sentence
  centers: V3[]
}

function build(nSentences: number, nDots: number): Geometry {
  // sentence centres along a spherical spiral, so neighbouring sentences sit next to each other
  const k = Math.sqrt(nSentences * Math.PI)
  const centers: V3[] = []
  for (let i = 0; i < nSentences; i++) {
    const z = 1 - (2 * (i + 0.5)) / nSentences
    const phi = Math.acos(z)
    const th = k * phi
    centers.push([Math.sin(phi) * Math.cos(th), z, Math.sin(phi) * Math.sin(th)])
  }
  const dots: number[] = []
  const owner: number[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let j = 0; j < nDots; j++) {
    const y = 1 - (2 * (j + 0.5)) / nDots
    const r = Math.sqrt(1 - y * y)
    const th = golden * j
    const p: V3 = [Math.cos(th) * r, y, Math.sin(th) * r]
    let b = -2, b2 = -2, bi = 0
    for (let i = 0; i < nSentences; i++) {
      const c = centers[i]
      const d = p[0] * c[0] + p[1] * c[1] + p[2] * c[2]
      if (d > b) {
        b2 = b
        b = d
        bi = i
      } else if (d > b2) b2 = d
    }
    if (b - b2 < 0.01) continue // leave a seam between sentences
    dots.push(p[0], p[1], p[2])
    owner.push(bi)
  }
  const bySentence: number[][] = centers.map(() => [])
  owner.forEach((s, i) => bySentence[s].push(i))
  return { dots: new Float32Array(dots), owner: new Int16Array(owner), bySentence, centers }
}

const RANK: Record<string, number> = { missing_documentation: 4, not_met: 3, met: 2, not_applicable: 1 }

interface CaseScript {
  c: GlobeCase
  status: Record<string, Status>
  events: { crit: string; at: number; arcs: number; status: Status }[]
  naAt: number
  verdictAt: number
  quotes: number
}

function script(c: GlobeCase): CaseScript {
  const ms = c.detail.run.matches ?? []
  const status: Record<string, Status> = {}
  ms.forEach((m) => (status[m.criterion_id] = m.status))
  // Rules the chart supports land first, then the ones it can't support yet.
  const order: Status[] = ["met", "not_met", "missing_documentation"]
  const rel = ms.filter((m) => m.status !== "not_applicable").sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))
  const events = rel.map((m, i) => ({
    crit: m.criterion_id,
    at: 700 + i * STEP_MS,
    arcs: Math.max(1, Math.min(3, m.evidence.filter((e) => e.verified).length)),
    status: m.status,
  }))
  const end = 700 + rel.length * STEP_MS + ARC_MS
  const quotes = rel.reduce((s, m) => s + m.evidence.filter((e) => e.verified).length, 0)
  return { c, status, events, naAt: end - 300, verdictAt: end + 200, quotes }
}

export function PolicyGlobe({ cases, onPhase, compact }: { cases: GlobeCase[]; onPhase?: (p: GlobePhase) => void; compact: boolean }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const phaseCb = useRef(onPhase)
  phaseCb.current = onPhase

  useEffect(() => {
    const el = canvas.current, box = wrap.current, labelBox = labelsRef.current
    if (!el || !box || !labelBox || !cases.length) return
    const ctx = el.getContext("2d")
    if (!ctx) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const sentences = cases[0].detail.sentences
    const S = sentences.length
    // which rules each sentence carries (same policy text for every replayed case)
    const sentCrit: string[][] = sentences.map((s) => s.criteria)
    let want = compact ? 2600 : 6000
    let geo = build(S, want)

    // criterion -> sentence indices -> centroid, and a short label
    const crits = new Map<string, { sents: number[]; center: V3; label: string }>()
    const summaries = new Map<string, string>()
    cases.forEach((c) => (c.detail.run.criteria ?? []).forEach((k) => summaries.set(k.criterion_id, k.summary)))
    sentCrit.forEach((ids, si) =>
      ids.forEach((id) => {
        const e = crits.get(id) ?? { sents: [], center: [0, 0, 0] as V3, label: shortRule(summaries.get(id) ?? id) }
        e.sents.push(si)
        crits.set(id, e)
      }),
    )
    crits.forEach((e) => {
      const sum: V3 = [0, 0, 0]
      e.sents.forEach((si) => geo.centers[si].forEach((v, i) => (sum[i] += v)))
      e.center = norm(sum)
    })

    // label chips: one per distinct label, created once
    labelBox.textContent = ""
    const chips = new Map<string, HTMLDivElement>()
    crits.forEach((e, id) => {
      const d = document.createElement("div")
      d.className = "g-chip"
      d.dataset.crit = id
      d.innerHTML = `<i></i><span></span>`
      ;(d.lastChild as HTMLElement).textContent = e.label
      labelBox.appendChild(d)
      chips.set(id, d)
    })
    const widths = new Map<HTMLDivElement, number>()
    chips.forEach((d) => widths.set(d, d.offsetWidth || 140))

    const scripts = cases.map(script)

    // ---------- state ----------
    let W = 0, H = 0, dpr = 1, R = 0, cx = 0, cy = 0
    const first = scripts[0]
    const firstRel = first.events.map((e) => crits.get(e.crit)?.center).filter(Boolean) as V3[]
    const fc = norm(firstRel.reduce<V3>((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0.0001]))
    let yaw = -0.55 - Math.atan2(fc[0], fc[2])
    let vel = AUTO_SPIN
    let dragging = false, lastX = 0, lastMove = -1e9
    let clock = 0 // active milliseconds; pauses with the loop
    let caseIdx = 0
    let caseStart = 0
    let raf = 0, running = false, lastT = 0
    const frameTimes: number[] = []
    let degraded = false
    type SentCol = { from: [number, number, number, number]; to: [number, number, number, number]; t0: number }
    const sentCol: SentCol[] = sentences.map((_, i) => {
      const c: [number, number, number, number] = [...COL.base, sentCrit[i].length ? 0.92 : 0.58]
      return { from: c, to: c, t0: -1e9 }
    })
    const shown = new Map<string, { status: Status | "pending"; at: number }>()
    const arcs: { crit: string; t0: number; seed: number; status: Status }[] = []
    let lastPhaseKey = ""

    const resize = () => {
      const r = box.getBoundingClientRect()
      dpr = Math.min(2, window.devicePixelRatio || 1)
      W = r.width
      H = r.height
      el.width = Math.round(W * dpr)
      el.height = Math.round(H * dpr)
      el.style.width = `${W}px`
      el.style.height = `${H}px`
      R = Math.min(W, H) * 0.44
      cx = W * 0.5
      cy = H * 0.5
      if (!running) draw()
    }

    const project = (v: V3) => {
      const ca = Math.cos(yaw), sa = Math.sin(yaw)
      const x1 = v[0] * ca + v[2] * sa
      const z1 = -v[0] * sa + v[2] * ca
      const ct = Math.cos(TILT), st = Math.sin(TILT)
      const y2 = v[1] * ct - z1 * st
      const z2 = v[1] * st + z1 * ct
      return [cx + x1 * R, cy - y2 * R, z2] as const
    }

    const statusColour = (st: Status | "pending"): [number, number, number, number] => {
      if (st === "met") return [...COL.met, 1]
      if (st === "missing_documentation") return [...COL.missing, 1]
      if (st === "not_met") return [...COL.notMet, 1]
      if (st === "not_applicable") return [...COL.base, 0.26]
      return [...COL.base, 0.95]
    }
    const setSentences = (now: number) => {
      sentences.forEach((_, si) => {
        let best: Status | "pending" | null = null
        for (const id of sentCrit[si]) {
          const s = shown.get(id)
          if (!s) continue
          if (!best || (RANK[s.status] ?? 0) > (RANK[best] ?? 0)) best = s.status
        }
        const target: [number, number, number, number] = best ? statusColour(best) : [...COL.base, sentCrit[si].length ? 0.92 : 0.58]
        const sc = sentCol[si]
        if (sc.to.join() !== target.join()) {
          sc.from = colourAt(sc, now)
          sc.to = target
          sc.t0 = now
        }
      })
    }
    const colourAt = (sc: SentCol, now: number): [number, number, number, number] => {
      const t = Math.min(1, (now - sc.t0) / 520)
      return sc.from.map((v, i) => v + (sc.to[i] - v) * t) as [number, number, number, number]
    }

    const emit = (p: GlobePhase) => {
      const key = `${p.caseId}|${p.verdict}|${p.met}|${p.missing}`
      if (key !== lastPhaseKey) {
        lastPhaseKey = key
        phaseCb.current?.(p)
      }
    }

    // advance the replay script to `clock`
    const step = () => {
      let sc = scripts[caseIdx]
      if (clock - caseStart > CASE_MS) {
        caseIdx = (caseIdx + 1) % scripts.length
        caseStart = clock
        sc = scripts[caseIdx]
        shown.clear()
        arcs.length = 0
      }
      const t = clock - caseStart
      let met = 0, missing = 0
      for (const ev of sc.events) {
        if (t >= ev.at && !shown.has(ev.crit)) {
          shown.set(ev.crit, { status: "pending", at: clock })
          for (let a = 0; a < ev.arcs; a++) arcs.push({ crit: ev.crit, t0: clock + a * 170, seed: caseIdx * 97 + a * 13 + ev.crit.length * 7, status: ev.status })
        }
        const s = shown.get(ev.crit)
        if (s && s.status === "pending" && t >= ev.at + ARC_MS) shown.set(ev.crit, { status: ev.status, at: clock })
        const now = shown.get(ev.crit)
        if (now?.status === "met") met++
        if (now?.status === "missing_documentation") missing++
      }
      if (t >= sc.naAt) Object.entries(sc.status).forEach(([id, st]) => st === "not_applicable" && !shown.has(id) && shown.set(id, { status: st, at: clock }))
      emit({ caseId: sc.c.id, patient: sc.c.patient, verdict: t >= sc.verdictAt ? sc.c.verdict : null, met, missing, quotes: sc.quotes })
      setSentences(clock)
    }

    // the still frame: the first case fully resolved, arcs drawn in full
    const settle = () => {
      const sc = scripts[0]
      shown.clear()
      Object.entries(sc.status).forEach(([id, st]) => shown.set(id, { status: st, at: -1e9 }))
      arcs.length = 0
      sc.events.forEach((ev) => {
        for (let a = 0; a < ev.arcs; a++) arcs.push({ crit: ev.crit, t0: -1e9, seed: a * 13 + ev.crit.length * 7, status: ev.status })
      })
      sentences.forEach((_, si) => (sentCol[si].t0 = -1e9))
      setSentences(0)
      sentCol.forEach((c) => (c.from = c.to))
      const met = sc.events.filter((e) => e.status === "met").length
      const missing = sc.events.filter((e) => e.status === "missing_documentation").length
      emit({ caseId: sc.c.id, patient: sc.c.patient, verdict: sc.c.verdict, met, missing, quotes: sc.quotes })
    }

    const draw = () => {
      const now = reduced ? 0 : clock
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      // faint rim
      ctx.beginPath()
      ctx.arc(cx, cy, R + 0.5, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(242,241,236,0.07)"
      ctx.lineWidth = 1
      ctx.stroke()

      const { dots, bySentence } = geo
      const ca = Math.cos(yaw), sa = Math.sin(yaw), ct = Math.cos(TILT), st = Math.sin(TILT)
      const size = compact ? 1.7 : 1.9
      const buckets: number[][] = [[], [], [], [], []]
      for (let si = 0; si < bySentence.length; si++) {
        const col = colourAt(sentCol[si], now)
        for (const b of buckets) b.length = 0
        for (const di of bySentence[si]) {
          const x = dots[di * 3], y = dots[di * 3 + 1], z = dots[di * 3 + 2]
          const x1 = x * ca + z * sa
          const z1 = -x * sa + z * ca
          const y2 = y * ct - z1 * st
          const z2 = y * st + z1 * ct
          const bi = z2 < 0 ? 0 : 1 + Math.min(3, Math.floor(z2 * 4))
          buckets[bi].push(cx + x1 * R, cy - y2 * R)
        }
        ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`
        for (let bi = 0; bi < 5; bi++) {
          const b = buckets[bi]
          if (!b.length) continue
          ctx.globalAlpha = col[3] * (bi === 0 ? 0.11 : 0.36 + bi * 0.16)
          ctx.beginPath()
          const sz = bi === 0 ? size * 0.8 : size
          for (let i = 0; i < b.length; i += 2) ctx.rect(b[i] - sz / 2, b[i + 1] - sz / 2, sz, sz)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1

      // arcs: chart evidence flying in from outside the sphere
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i]
        const c = crits.get(a.crit)
        if (!c) continue
        const age = reduced ? ARC_MS : now - a.t0
        if (age < 0) continue
        const fade = reduced ? 0.35 : age > ARC_MS ? 1 - (age - ARC_MS) / 600 : 1
        if (fade <= 0) {
          arcs.splice(i, 1)
          continue
        }
        const [px, py, pz] = project(c.center)
        if (pz < 0.05) continue
        const rnd = rand(a.seed)
        const ang = -2.1 + rnd() * 1.7 // up-left .. up-right (canvas y points down)
        const len = R * (0.42 + rnd() * 0.22)
        const ox = px + Math.cos(ang) * len, oy = py + Math.sin(ang) * len
        const side = rnd() > 0.5 ? 1 : -1
        const qx = (ox + px) / 2 - Math.sin(ang) * len * 0.28 * side, qy = (oy + py) / 2 + Math.cos(ang) * len * 0.28 * side
        const p = easeEnter(age / ARC_MS)
        const rgb = a.status === "met" ? COL.met : a.status === "missing_documentation" ? COL.missing : COL.notMet
        ctx.beginPath()
        const N = 28
        for (let s = 0; s <= N; s++) {
          const t = (s / N) * p
          const x = (1 - t) * (1 - t) * ox + 2 * (1 - t) * t * qx + t * t * px
          const y = (1 - t) * (1 - t) * oy + 2 * (1 - t) * t * qy + t * t * py
          if (s === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.75 * fade * Math.min(1, pz * 2)})`
        ctx.lineWidth = 1.2
        ctx.stroke()
        if (p < 1) {
          const t = p
          const x = (1 - t) * (1 - t) * ox + 2 * (1 - t) * t * qx + t * t * px
          const y = (1 - t) * (1 - t) * oy + 2 * (1 - t) * t * qy + t * t * py
          ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.95)`
          ctx.beginPath()
          ctx.arc(x, y, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // city markers and labels
      const seen = new Set<string>()
      const placed: { chip: HTMLDivElement; x: number; y: number; w: number; a: number; status: string }[] = []
      chips.forEach((chip, id) => {
        const c = crits.get(id)!
        const s = shown.get(id)
        const [px, py, pz] = project(c.center)
        const front = pz > 0.12
        let visible = false
        if (s && front && (s.status === "met" || s.status === "missing_documentation" || s.status === "not_met" || s.status === "pending")) {
          const a = Math.min(1, (pz - 0.12) * 3)
          const age = now - s.at
          if (s.status === "met" || s.status === "not_met") {
            const rgb = s.status === "met" ? COL.met : COL.notMet
            ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.18 * a})`
            ctx.beginPath()
            ctx.arc(px, py, 9, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`
            ctx.beginPath()
            ctx.arc(px, py, 3.4, 0, Math.PI * 2)
            ctx.fill()
            if (!reduced && age < 900) {
              const k = age / 900
              ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(1 - k) * 0.8 * a})`
              ctx.lineWidth = 1.3
              ctx.beginPath()
              ctx.arc(px, py, 4 + 14 * easeEnter(k), 0, Math.PI * 2)
              ctx.stroke()
            }
          } else if (s.status === "missing_documentation") {
            const rgb = COL.missing
            ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`
            ctx.lineWidth = 1.8
            ctx.beginPath()
            ctx.arc(px, py, 5.5, 0, Math.PI * 2)
            ctx.stroke()
            const k = reduced ? 0.35 : (age % 2400) / 2400
            ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(1 - k) * 0.6 * a})`
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.arc(px, py, 5.5 + 11 * k, 0, Math.PI * 2)
            ctx.stroke()
          }
          if (!compact && !seen.has(c.label)) {
            seen.add(c.label)
            visible = true
            placed.push({ chip, x: px + 14, y: py - 11, w: widths.get(chip) ?? 140, a, status: s.status })
          }
        }
        if (!visible && chip.style.opacity !== "0") chip.style.opacity = "0"
      })
      // keep labels from overlapping: walk top to bottom and push a chip down past any it would cover
      placed.sort((p, q) => p.y - q.y)
      const boxes: { x: number; y: number; w: number }[] = []
      for (const pl of placed) {
        let y = pl.y
        for (let guard = 0; guard < 6; guard++) {
          const hit = boxes.find((b) => pl.x < b.x + b.w + 6 && b.x < pl.x + pl.w + 6 && Math.abs(b.y - y) < 23)
          if (!hit) break
          y = hit.y + 23
        }
        boxes.push({ x: pl.x, y, w: pl.w })
        pl.chip.style.transform = `translate3d(${pl.x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
        pl.chip.style.opacity = pl.a.toFixed(2)
        pl.chip.dataset.status = pl.status
      }
    }

    const frame = (t: number) => {
      if (!running) return
      const dt = Math.min(64, lastT ? t - lastT : 16)
      lastT = t
      clock += dt
      // frame budget: one downgrade if the average frame runs slow after warm-up
      const t0 = performance.now()
      step()
      draw()
      const cost = performance.now() - t0
      if (!degraded && clock > 1500) {
        frameTimes.push(cost)
        if (frameTimes.length >= 50) {
          const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
          frameTimes.length = 0
          if (avg > 10) {
            degraded = true
            want = Math.round(want / 2)
            geo = build(S, want)
          }
        }
      }
      if (!dragging) {
        const idle = performance.now() - lastMove > 2000
        vel = idle ? vel + (AUTO_SPIN - vel) * 0.02 : vel * 0.94
      }
      yaw += (vel * dt) / 1000
      raf = requestAnimationFrame(frame)
    }

    let inView = true
    const start = () => {
      if (reduced || running || !inView || document.hidden) return
      running = true
      lastT = 0
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    // drag to spin (with inertia); also works in the reduced-motion still frame
    const down = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastMove = performance.now()
      el.setPointerCapture(e.pointerId)
      box.dataset.drag = "1"
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - lastX
      lastX = e.clientX
      const d = dx / Math.max(120, R)
      yaw += d
      const nowT = performance.now()
      vel = (d / Math.max(8, nowT - lastMove)) * 1000 * 0.6
      lastMove = nowT
      if (!running) draw()
    }
    const up = () => {
      dragging = false
      lastMove = performance.now()
      delete box.dataset.drag
    }
    el.addEventListener("pointerdown", down)
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", up)

    const ro = new ResizeObserver(resize)
    ro.observe(box)
    const io = new IntersectionObserver(([en]) => {
      inView = en.isIntersecting
      box.dataset.running = inView ? "1" : "0"
      if (inView) start()
      else stop()
    })
    io.observe(box)
    const vis = () => (document.hidden ? stop() : start())
    document.addEventListener("visibilitychange", vis)

    resize()
    if (reduced) {
      settle()
      draw()
    } else {
      step()
      draw()
      start()
    }
    setReady(true)
    ;(box as HTMLDivElement & { __globe?: unknown }).__globe = { isRunning: () => running, dots: () => geo.owner.length, clock: () => clock }

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      document.removeEventListener("visibilitychange", vis)
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", up)
    }
  }, [cases, compact])

  return (
    <div ref={wrap} className={`globe ${ready ? "is-ready" : ""}`} data-testid="policy-globe">
      <canvas ref={canvas} aria-hidden="true" />
      <div ref={labelsRef} className="g-labels" aria-hidden="true" />
    </div>
  )
}
