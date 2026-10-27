// The appeal letter as text. The draft is Markdown: headings, prose, and each quote as a block quote ending in an
// attribution line ("> — L34220 v40, ..."). Edit mode shows plain text instead: headings as plain lines and each
// quote in typographic quotes, without its attribution. toMd turns an edit back into the drafted markup by matching
// each quote's words; a quote whose words changed stays a plain quote, which the gate still checks (and fails).
// Ported from the classic app (web/app.js letterCodec / renderLetter).

export const squash = (t: string) => String(t ?? "").replace(/\s+/g, " ").trim()
const CITE_LINE = /^(—|--)/

export function letterCodec(md: string) {
  const quotes = new Map<string, { lines: string[]; cite: string }>()
  const heads = new Set<string>()
  let block: string[] = []
  const keep = (cite: string) => {
    const key = squash(block.filter(Boolean).join(" "))
    if (key && !quotes.has(key)) quotes.set(key, { lines: block.slice(), cite })
    block = []
  }
  for (const raw of md.split("\n")) {
    if (raw.startsWith(">")) {
      const body = raw.replace(/^>\s?/, "")
      if (CITE_LINE.test(body)) keep(body)
      else block.push(body)
      continue
    }
    if (block.length) keep("")
    const h = /^#{1,6}\s+(.*)$/.exec(raw)
    if (h) heads.add(h[1].trim())
  }
  if (block.length) keep("")

  const toPlain = (text: string) => {
    const out: string[] = []
    let blk: string[] = []
    const flush = () => {
      if (blk.length) {
        out.push(`“${squash(blk.filter(Boolean).join(" "))}”`)
        blk = []
      }
    }
    for (const raw of text.split("\n")) {
      if (raw.startsWith(">")) {
        const body = raw.replace(/^>\s?/, "")
        if (CITE_LINE.test(body)) flush()
        else blk.push(body)
        continue
      }
      flush()
      out.push(raw.replace(/^#{1,6}\s+/, ""))
    }
    flush()
    // A quote set inside a sentence ("... symptoms (" quote ") and ...") joins its sentence again.
    return (
      out
        .join("\n")
        .replace(/\(\s*\n“/g, "(“")
        .replace(/”\s*\n\s*,\s*\n“/g, "”, “")
        .replace(/”\s*\n(?=[),.;:])/g, "”")
        .replace(/\n{3,}/g, "\n\n")
        .trim() + "\n"
    )
  }

  const toMd = (plain: string) => {
    const keys = [...quotes.keys()].sort((a, b) => b.length - a.length)
    let t = plain
      .split("\n")
      .map((l, i, arr) => (heads.has(l.trim()) && (i === 0 || !arr[i - 1].trim()) ? `## ${l.trim()}` : l))
      .join("\n")
    for (const k of keys) {
      const { lines, cite } = quotes.get(k)!
      t = t.split(`“${k}”`).join(`\n${lines.map((l) => (l ? `> ${l}` : ">")).join("\n")}${cite ? `\n> ${cite}` : ""}\n`)
    }
    // A line that is only a quote stays a block quote, so the gate checks it however short it is.
    t = t
      .split("\n")
      .map((l) => {
        const m = /^\s*“([^”]+)”\s*$/.exec(l)
        return m ? `> ${m[1]}` : l
      })
      .join("\n")
    return t.replace(/\n{3,}/g, "\n\n")
  }
  return { toPlain, toMd }
}

// ---------- blocks for display ----------
export type Part = { s: string } | { q: string; cite: string }
export type Block = { t: "h"; s: string } | { t: "p"; parts: Part[]; open?: boolean } | { t: "q"; s: string; cite: string }

export function parseLetter(text: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  let quote: string[] = []
  let cite = ""
  const pushPara = () => {
    if (para.length) {
      blocks.push({ t: "p", parts: [{ s: para.join(" ") }] })
      para = []
    }
  }
  const pushQuote = () => {
    if (quote.length) {
      blocks.push({ t: "q", s: quote.join("\n"), cite })
      quote = []
      cite = ""
    }
  }
  for (const raw of text.split("\n")) {
    const l = raw.trimEnd()
    if (l.startsWith(">")) {
      pushPara()
      const body = l.replace(/^>\s?/, "")
      if (CITE_LINE.test(body)) {
        cite = body.replace(/^(—|--)\s*/, "")
        pushQuote()
      } else if (body) quote.push(body)
      continue
    }
    pushQuote()
    if (/^#{1,6}\s/.test(l)) {
      pushPara()
      blocks.push({ t: "h", s: l.replace(/^#+\s*/, "") })
    } else if (!l.trim()) pushPara()
    else para.push(l.trim())
  }
  pushQuote()
  pushPara()
  // "... one month of symptoms (" + quote + ") and only if ..." is one sentence: keep it one paragraph.
  const merged: Block[] = []
  for (const b of blocks) {
    const prev = merged[merged.length - 1]
    if (prev && prev.t === "p") {
      const tail = prev.parts[prev.parts.length - 1]
      if (b.t === "q" && (prev.open || ("s" in tail && /\(\s*$/.test(tail.s)))) {
        prev.parts.push({ q: b.s, cite: b.cite })
        prev.open = true
        continue
      }
      if (b.t === "p" && (prev.open || /^[),.;:]/.test((b.parts[0] as { s: string }).s))) {
        const s = (b.parts[0] as { s: string }).s
        prev.parts.push(b.parts[0])
        prev.open = !!prev.open && !/\)/.test(s)
        continue
      }
    }
    merged.push(b)
  }
  return merged
}

// Inline quotes inside prose ("..." or curly quotes, three words or more), as the gate extracts them.
const INLINE = /"([^"\n]+)"|“([^”\n]+)”/g
export function splitInline(s: string): ({ s: string } | { iq: string })[] {
  const out: ({ s: string } | { iq: string })[] = []
  let at = 0
  for (const m of s.matchAll(INLINE)) {
    const q = m[1] ?? m[2]
    if (q.split(/\s+/).length < 3) continue
    if (m.index! > at) out.push({ s: s.slice(at, m.index) })
    out.push({ iq: q })
    at = m.index! + m[0].length
  }
  if (at < s.length) out.push({ s: s.slice(at) })
  return out
}
