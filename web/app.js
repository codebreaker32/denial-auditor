// Denial Auditor frontend. No framework: hash routes, one render per view.
const $main = document.getElementById("main");
const state = { cases: null, filter: "all", lastCase: null, passcode: "", drift: null, board: null };

// Glyphs: one stroke set (24px grid). Each status carries a glyph and a word, never colour alone.
const GLYPH = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cross: '<path d="M7 7l10 10M17 7L7 17"/>',
  half: '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a7.5 7.5 0 0 0 0 15z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 6.5v11M15 6.5v11"/>',
  return: '<path d="M10 7l-5 5 5 5M5 12h9.5a4.5 4.5 0 0 0 0-9H12"/>',
  slash: '<circle cx="12" cy="12" r="7.5"/><path d="M6.7 17.3L17.3 6.7"/>',
  dash: '<path d="M7 12h10"/>',
  tick: '<circle class="cc" cx="12" cy="12" r="10"/><path class="ck" d="M7.6 12.4l3 3 5.8-6.2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  play: '<path d="M8 5.5l10 6.5-10 6.5z"/>',
  person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 19.5a7 7 0 0 1 14 0"/>',
  // A split vote: one stem, two diverging branches (the two Super votes went different ways).
  fork: '<path d="M12 20.5v-7.5M12 13L6.5 5.5M12 13l5.5-7.5M6.5 9.5v-4h4M13.5 5.5h4v4"/>',
  // A model step (How it works): a chip outline.
  chip: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3"/>',
  // A policy whose text changed since it was cited.
  alert: '<circle cx="12" cy="12" r="7.5"/><path d="M12 8v4.5M12 15.8v.2"/>',
};
const g = (name) => `<span class="glyph" aria-hidden="true"><svg viewBox="0 0 24 24">${GLYPH[name]}</svg></span>`;
// A small inline glyph for running text (the "who decides" tags on How it works).
const gi = (name) => `<span class="glyph" aria-hidden="true" style="width:12px;height:12px;vertical-align:-1px"><svg viewBox="0 0 24 24">${GLYPH[name]}</svg></span>`;
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPH[name]}</svg>`;

const VERDICT = {
  appeal:        { label: "Appeal", tone: "pos", glyph: "check", line: "The chart meets the policy in effect on the date of service. Review the drafted letter and send it." },
  doc_request:   { label: "Ask the physician", tone: "warn", glyph: "half", line: "Winnable once the missing documentation is added to the chart." },
  dont_appeal:   { label: "Don't appeal yet", tone: "warn", glyph: "pause", line: "The chart doesn't meet the policy yet. Appealing now would likely fail." },
  fix_checklist: { label: "Fix & resubmit", tone: "fill", glyph: "return", line: "Administrative denial: correct the claim, or dispute it with proof. No medical-necessity appeal is needed." },
  not_winnable:  { label: "Not winnable", tone: "quiet", glyph: "slash", line: "The plan excludes this service. Medical-necessity evidence won't change the outcome." },
};
// A held denial whose service came before the policy's waits ended can't be won on this chart at all: a new order
// can. Same fixed-rule verdict (dont_appeal), shown in words that don't promise waiting helps.
const REORDER = { label: "Reorder, don't appeal", tone: "warn", glyph: "pause", line: "No chart note can change this service date. Don't appeal; a new order can qualify." };
const verdictOf = (v, early) => (v === "dont_appeal" && early ? { ...VERDICT[v], ...REORDER } : VERDICT[v]);
// The worklist filter covers both held labels.
const FILTER_LABEL = { dont_appeal: "Don't appeal" };
const filterLabel = (v) => FILTER_LABEL[v] || VERDICT[v].label;
const ORDER = ["appeal", "doc_request", "fix_checklist", "dont_appeal", "not_winnable"];
const ACTIONABLE = new Set(["appeal", "doc_request", "fix_checklist"]);
const NEXT = { appeal: "Review appeal", dont_appeal: "See what's missing", fix_checklist: "Open fix checklist", not_winnable: "See why", doc_request: "See the request" };
const STATUS = {
  met: { tone: "pos", glyph: "check", label: "Supports" },
  not_met: { tone: "neg", glyph: "cross", label: "Blocks" },
  missing_documentation: { tone: "warn", glyph: "half", label: "Missing docs" },
  not_applicable: { tone: "quiet", glyph: "dash", label: "Doesn't apply" },
  // A route rule that isn't the one deciding reads the same on a denial and on a prior-auth check: "Other route".
  // route: another route is met, so this one isn't needed. alt: a denial where no route is met; the one route
  // closest to coverage blocks and the other unmet routes are alternatives.
  route: { tone: "quiet", glyph: "dash", label: "Other route" },
  alt: { tone: "quiet", glyph: "dash", label: "Other route" },
  // A prior-auth check whose waiting period is reached by the planned date once the care is charted.
  pending: { tone: "warn", glyph: "half", label: "Met once charted" },
};
// Highlight class for a shown status (a route not used reads quiet, a pending wait reads like missing docs).
const HL = { route: "not_applicable", alt: "not_applicable", pending: "missing_documentation" };
// A route that isn't the one deciding: not used (another route is met) or an alternative that isn't met either.
const offRoute = (m) => m.show === "route" || m.show === "alt";
const hlOf = (show) => HL[show] || show;
const EMPTY = {
  appeal: "No denials are ready to appeal.", doc_request: "No denials are waiting on the physician.",
  fix_checklist: "No denials need a claim fix.", dont_appeal: "No denials are on hold.", not_winnable: "No denials are closed as not winnable.",
};
function emptyHtml(f) {
  const t = esc(EMPTY[f] || "No denials.");
  const n = state.noteCase;
  return f === "doc_request" && n ? `${t} See one inside a held denial: <a class="link" href="#/case/${esc(n.id)}?tab=next">${esc(n.patient)}'s note to the physician →</a>` : t;
}
// The held denial whose Next step carries a note to the physician: the first loaded run with a blocker that
// a dated chart note could meet (not a waiting period the service date fell short of). Worked out from the runs.
async function noteCase() {
  if (state.noteCase !== undefined) return state.noteCase;
  let found = null;
  try {
    const held = (await loadCases()).cases.filter((r) => r.verdict === "dont_appeal");
    const checks = await loadChecks();
    for (const r of held) {
      const c = await api(`/api/cases/${encodeURIComponent(r.id)}`);
      const saved = BOARD;
      BOARD = { thresholds: c.thresholds || [], facts: c.run.facts || null, dos: c.run.denial.dos, alt: null };
      const ctx = { run: c.run, c, chk: checks.find((x) => x.id === c.id) };
      const blockers = prepMatches(c.run, c, false).filter((m) => m.status === "not_met" && !offRoute(m));
      const ok = documentable(ctx, blockers).length > 0;
      BOARD = saved;
      if (ok) { found = { id: r.id, patient: r.patient }; break; }
    }
  } catch { found = null; }
  return (state.noteCase = found);
}
const CONF = {
  agreed: "2 of 2 Nemotron Super votes agree",
  escalated: "Super votes split; Nemotron Ultra decided",
  single: "One Nemotron judgment",
  rule: "Decided by a fixed rule, no model",
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtDate = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.slice(0, 10).split("-"); return `${m}/${d}/${y}`; }; // taste-skill-ignore: empty-value dash
const id = (s) => `<span class="id">${esc(s)}</span>`;
const AV = 6;
const avatar = (name) => { const ini = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join(""); let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `<span class="av av${h % AV}" aria-hidden="true">${esc(ini)}</span>`; };
const payerShort = (p) => p.replace(/ \((synthetic[^)]*)\)/i, "").replace(/\bMedicare Advantage\b/, "MA").replace(/\s+(Health )?Plan$/, "");
const PLAN = { MA: "MA", MEDICARE_FFS: "Medicare", COMMERCIAL_ACA: "Commercial (ACA)", COMMERCIAL_ERISA: "Commercial (ERISA)", MEDICAID: "Medicaid", UNKNOWN: "Plan type unknown" };
const payerPlan = (payer, plan) => { const p = payerShort(payer), t = PLAN[plan] || plan; return p.endsWith(t) ? p : `${p} · ${t}`; };
const policyId = (p) => (p.version_basis === "api-versioned" ? `${p.policy_id} v${p.version}` : p.policy_id.replace(/^Aetna /, ""));
const noteShort = (nid) => nid.split("-").pop();
const sAddr = (addr) => (addr || "").replace(/^.*·\s*/, "");
const gotoFor = (addr) => { const m = /S(\d+)/.exec(addr || ""); return m ? `policy:${m[1]}` : null; };
// The ids in words: "S47" is a sentence in the payer's policy, "n1" a chart note.
const sWords = (addr) => { const m = /S(\d+)(?:\s*[–-]\s*S?(\d+))?/.exec(addr || ""); return m ? (m[2] ? `Policy sentences ${m[1]} to ${m[2]}` : `Policy sentence ${m[1]}`) : String(addr || ""); };
const nWords = (nid, date) => `Chart note ${String(nid).replace(/^n/, "")}${date ? `, ${date}` : ""}`;
const named = (label) => `title="${esc(label)}" aria-label="${esc(label)}"`;
const days = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
let NOTE_DATES = {};
// The open board's waiting-period thresholds and code-computed facts, for the "Counted in code" line on a rule.
// alt: the same chart's prior-auth check (its verified facts), used when this run didn't extract a date.
let BOARD = { thresholds: [], facts: null, dos: null, alt: null };
const DUR = /\b\d+\s*(weeks?|months?|days?)\b/i;
const sRange = (addr) => { const m = /S(\d+)(?:\s*[–-]\s*S?(\d+))?/.exec(addr || ""); return m ? [Number(m[1]), Number(m[2] || m[1])] : null; };
const thresholdFor = (addr) => { const r = sRange(addr); return r ? BOARD.thresholds.find((t) => t.sentence >= r[0] && t.sentence <= r[1]) || null : null; };
const capFirst = (t) => String(t || "").replace(/^\w/, (x) => x.toUpperCase());
// The onset date and days of symptoms: this run's own, or, when it didn't extract the onset, the verified onset
// on this chart's prior-auth check, counted in code to this case's service date.
function onsetFacts() {
  const f = BOARD.facts;
  if (f && f.onset && f.symptom_days != null) return { onset: f.onset, n: f.symptom_days, from: null };
  const a = BOARD.alt;
  if (a && a.facts && a.facts.onset && BOARD.dos) return { onset: a.facts.onset, n: days(a.facts.onset, BOARD.dos), from: a };
  return null;
}
// Days counted in code from the chart's own dates (never the model's estimate), for a rule that states a wait.
function counted(addr) {
  const t = thresholdFor(addr), f = BOARD.facts;
  if (!t || !f) return null;
  if (t.from === "onset") {
    const o = onsetFacts();
    if (!o) return null;
    return { t, n: o.n, from: o.from, text: `${o.n} days of symptoms from ${fmtDate(o.onset)} (policy: ${t.days})` };
  }
  const n = f.conservative_days;
  if (n == null) return null;
  const tx = (f.treatments || []).filter((k) => k.start && k.end).map((k) => `${capFirst(k.kind)} ${fmtDate(k.start)}–${fmtDate(k.end)}`).join(" · ");
  return { t, n, from: null, text: `${n} days of conservative care (policy: ${t.days})${tx ? ` · ${tx}` : ""}` };
}
// The one onset date in a rule's own verified quotes ("onset of low back pain on 07/02/2026"), as ISO, or null
// when the quotes name no onset date or more than one date.
const MDY = /\b(\d{2})\/(\d{2})\/(\d{4})\b/g;
function quotedOnset(m) {
  const qs = ((m && m.evidence) || []).filter((e) => e.verified).map((e) => e.quote);
  const all = new Set(qs.flatMap((q) => [...q.matchAll(MDY)].map((x) => `${x[3]}-${x[1]}-${x[2]}`)));
  if (all.size !== 1) return null;
  return qs.some((q) => /\b(onset|began|begun|started)\b/i.test(q) && /\b\d{2}\/\d{2}\/\d{4}\b/.test(q)) ? [...all][0] : null;
}
// A rule with a waiting period whose days no source could count: say so, so a model's estimate is never the only number.
// m (optional): the rule's match, whose verified quote may carry the onset date.
// The glyph and words come from the comparison itself: a check when the count reaches the policy's wait, a cross
// and the shortfall when it doesn't, so the line always agrees with the coverage path ("Not met: 38 of 42 days").
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const verdictOfCount = (n, need) => (n >= need ? { tone: "pos", glyph: "check", word: "meets the wait" } : { tone: "neg", glyph: "cross", word: `short by ${plural(need - n, "day")}` });
const countedHtml = (addr, m) => {
  const k = counted(addr);
  // A wait the prior-auth check reaches once the care is charted: the count is still short as charted today.
  const once = m && m.show === "pending" && BOARD.earliest ? ` · reached ${fmtDate(BOARD.earliest)} once the care is charted` : "";
  if (k) {
    const r = verdictOfCount(k.n, k.t.days);
    const lead = k.from ? "Counted in code on this chart's prior-auth check:" : "Counted in code:";
    return `<p class="counted ${r.tone}">${g(r.glyph)}<span><b>${lead}</b> ${esc(k.text)} · <b class="cv">${esc(r.word)}</b>${r.tone === "neg" ? esc(once) : ""}${k.from ? ` · <a class="link" href="#/check/${esc(k.from.id)}">Open the check</a>` : ""}</span></p>`;
  }
  const t = thresholdFor(addr);
  if (!t || !BOARD.facts) return "";
  const dos = BOARD.dos, when = dos ? ` Service date ${fmtDate(dos)}.` : "";
  const q = t.from === "onset" ? quotedOnset(m) : null;
  if (q && dos) {
    const n = days(q, dos), r = verdictOfCount(n, t.days);
    return `<p class="counted ${r.tone}">${g(r.glyph)}<span><b>From the quoted date:</b> ${n} calendar days from ${fmtDate(q)} to the ${fmtDate(dos)} service date (policy: ${t.days}) · <b class="cv">${esc(r.word)}</b>. Worked out on this page from the verified quote; the pipeline didn't count it.</span></p>`;
  }
  const onsetQuoted = t.from === "onset" && m && m.evidence.some((e) => e.verified && /\bonset\b/i.test(e.quote));
  const what = t.from === "onset" ? `onset date ${onsetQuoted ? "is quoted from the chart but wasn't" : "wasn't"}` : "treatment start and end dates weren't";
  return `<p class="counted quiet">${g("dash")}<span><b>Not counted in code:</b> the ${what} captured as a structured fact in this run, so code didn't verify the ${t.days}-day wait.${when}</span></p>`;
};

function mark(tone, glyph, label) { return `<span class="mark ${tone}">${glyph ? g(glyph) : ""}${esc(label)}</span>`; }
const statusMark = (key) => { const s = STATUS[key]; return mark(s.tone, s.glyph, s.label); };
const verdictMark = (v, early) => { const x = verdictOf(v, early); return mark(x.tone, x.glyph, x.label); };

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok) {
    let msg = `${r.status}`;
    try { msg = (await r.json()).detail || msg; } catch {}
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// A case belongs to the worklist; a prior-auth check to Prior-auth checks.
function setNav(name) {
  const current = name === "case" ? "worklist" : name;
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === current) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

// ---------------- Shell: open-denial count and the policy watch stamp ----------------
async function loadCases() { return state.cases || (state.cases = await api("/api/cases")); }
async function loadChecks() {
  if (!state.checks) { try { state.checks = (await api("/api/checks")).checks; } catch { return []; } }
  return state.checks;
}
async function drift() {
  if (!state.drift) { try { state.drift = await api("/api/drift"); } catch { state.drift = { checked_at: null, items: [] }; } }
  return state.drift;
}
const watchedAt = (iso) => `${fmtDate(iso.slice(0, 10))} ${iso.slice(11, 16)} UTC`;
// What a watch item compared: "v40, unchanged" (CMS), or whether the Aetna page's text moved since the cited snapshot.
const isoDay = (v) => /^\d{4}-\d{2}-\d{2}/.test(v || "");
function citedWords(i) {
  const same = i.status === "current";
  if (isoDay(i.cited)) return i.cited.slice(0, 10) === String(i.current || "").slice(0, 10) ? `text ${same ? "unchanged" : "changed"}` : `text ${same ? "unchanged" : "changed"} since the ${fmtDate(i.cited)} snapshot`;
  return i.cited === i.current ? `v${i.cited}, unchanged` : `cited v${i.cited} → live v${i.current}${same ? ", unchanged" : ""}`;
}
function watchHtml(rep) {
  if (!rep.checked_at) return "";
  const hit = rep.items.filter((i) => i.affects_case).length;
  return `<button type="button" class="watch-btn" popovertarget="watch-pop" aria-haspopup="dialog">Policy watch checked ${watchedAt(rep.checked_at)} · ${hit
    ? `<span class="warn">${hit} open case${hit > 1 ? "s" : ""} affected</span> by a policy change`
    : "no open case affected"}${svg("chevron")}</button>`;
}
// The watch's own list: every cited policy it compared with the live source last night.
function watchSheet(rep) {
  let pop = document.getElementById("watch-pop");
  if (!pop) {
    pop = document.createElement("div");
    pop.id = "watch-pop"; pop.className = "watch-pop"; pop.setAttribute("popover", ""); pop.setAttribute("role", "dialog"); pop.setAttribute("aria-labelledby", "watch-pop-h");
    document.body.append(pop);
  }
  // The list is built as the sheet opens and cleared when it closes, so a closed sheet adds nothing to the page.
  if (!pop.dataset.wired) {
    pop.dataset.wired = "1";
    pop.addEventListener("beforetoggle", (e) => { if (e.newState === "open") fillWatch(pop, state.drift || { items: [] }); });
    pop.addEventListener("toggle", (e) => { if (e.newState === "closed") pop.replaceChildren(); });
  }
  if (!rep.checked_at) pop.replaceChildren();
}
async function fillWatch(pop, rep) {
  if (!rep.checked_at) return;
  let cases = [], checks = [];
  try { cases = (await loadCases()).cases; } catch {}
  checks = await loadChecks();
  const who = (i) => ((i.kind === "prior_auth" ? checks : cases).find((x) => x.id === i.case_id) || {}).patient || i.case_id;
  const href = (i) => (i.kind === "prior_auth" ? `#/check/${i.case_id}` : `#/case/${i.case_id}`);
  const st = (i) => (i.status === "current" ? mark("pos", "check", "Current") : i.status === "error" ? mark("neg", "cross", "Couldn't check") : mark("warn", "alert", "Changed"));
  pop.innerHTML = `<div class="wp-head"><h2 id="watch-pop-h">Policy watch</h2><button type="button" class="btn text" popovertarget="watch-pop" popovertargetaction="hide">Close</button></div>
    <p class="wp-say">Checked ${watchedAt(rep.checked_at)}. Each night it compares the policy every open case cites with the live source, with no model. ${rep.items.length} citations checked.</p>
    <ul class="wp-list">${rep.items.map((i) => `<li><a class="link" href="${href(i)}">${esc(who(i))}</a><span class="wp-kind">${i.kind === "prior_auth" ? "Prior-auth check" : "Denial"} · service ${fmtDate(i.service_date)}</span><span class="wp-pol">${id(i.policy_id.replace(/^Aetna /, ""))} <span>${esc(citedWords(i))}</span></span>${st(i)}</li>`).join("")}</ul>`;
  pop.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { try { pop.hidePopover(); } catch {} }));
}
async function fillShell() {
  try {
    const data = await loadCases();
    const n = document.querySelector("[data-count]");
    if (n) n.textContent = data.cases.length;
    // The one demo clock every deadline is counted from, named once in the shell.
    const sub = document.querySelector(".brand-text small");
    if (sub && data.as_of) sub.textContent = `Review date ${fmtDate(data.as_of)} (demo calendar)`;
  } catch {}
  const w = document.querySelector("[data-watch]");
  const rep = await drift();
  if (w) w.innerHTML = watchHtml(rep);
  watchSheet(rep);
}

const sk = (w, h, pill) => `<span class="sk${pill ? " pill" : ""}" style="width:${w}px;max-width:100%;height:${h}px"></span>`;
function errorBlock(message, retry) {
  return `<div class="err-block">${mark("neg", "cross", "Couldn't load")}<span>${esc(message)}</span>${retry ? `<button type="button" class="btn text" data-retry>Retry</button>` : ""}</div>`;
}
function wireRetry() { $main.querySelector("[data-retry]")?.addEventListener("click", () => { state.cases = null; route(); }); }

// ---------------- Worklist ----------------
async function worklist() {
  setNav("worklist");
  document.title = "Worklist · Denial Auditor";
  $main.innerHTML = `${sk(260, 24)}<div style="height:8px"></div>${sk(480, 14)}<div style="height:24px"></div>${sk(520, 14)}
    <div class="sk-rows">${Array.from({ length: 7 }, () => `<div>${sk(56, 16)}${sk(180, 14)}${sk(120, 22, true)}${sk(80, 14)}${sk(260, 14)}</div>`).join("")}</div>`;
  let data;
  try { data = await loadCases(); }
  catch (e) { $main.innerHTML = `<h1 class="page-title">Denials to work</h1>${errorBlock(`Couldn't load the worklist: ${e.message}.`, true)}`; wireRetry(); return; }
  const rep = await drift();
  // A held row's label and next step depend on its case (a reorder or a note): worked out before the rows draw.
  await Promise.all(data.cases.filter((r) => r.verdict === "dont_appeal").map((r) => holdFor(r.id)));
  state.asOf = data.as_of;
  const byDue = (a, b) => (a.days_left ?? Infinity) - (b.days_left ?? Infinity);
  const dueRows = [...data.cases].sort((a, b) => byDue(a, b) || ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  // "Ready to act first": the fixed recommendation order (appeal, physician note, claim fix, on hold, closed), then days left.
  const sortBy = sortGet();
  const rows = sortBy === "ready" ? [...data.cases].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict) || byDue(a, b)) : dueRows;
  const count = (v) => rows.filter((r) => v === "all" || r.verdict === v).length;
  const shown = rows.filter((r) => state.filter === "all" || r.verdict === state.filter);
  // Only recommendations with denials get a filter (All always shows); How it works lists all five outcomes.
  if (state.filter !== "all" && !count(state.filter)) state.filter = "all";
  const tabs = ["all", ...ORDER].filter((v) => v === "all" || count(v) > 0).map((v) =>
    `<button type="button" role="tab" data-f="${v}" aria-selected="${state.filter === v}">${v === "all" ? "All" : filterLabel(v)}<span class="n">${count(v)}</span></button>`).join("");
  // The row the headline names ("Start with …") is marked where the biller's eye lands.
  state.startId = startRow(dueRows);
  const sortWords = sortBy === "ready" ? "sorted by ready to act, then days left" : "sorted by days left";
  const countLine = (state.filter === "all" ? `${rows.length} denials · ${sortWords}` : `${shown.length} of ${rows.length} denials · ${esc(filterLabel(state.filter))} · ${sortWords}`);
  const sortBtn = (k, label) => `<button type="button" data-sort="${k}" aria-pressed="${sortBy === k}">${label}</button>`;

  $main.innerHTML = `
    <h1 class="page-title">Denials to work</h1>
    <p class="finding">${finding(dueRows, data.as_of)}</p>
    ${orientHtml(rows)}
    <p class="phone-only">${watchHtml(rep)}</p>
    <div class="filters">
      <div class="tabs" role="tablist" aria-label="Filter by recommendation">${tabs}</div>
      <div class="sort" role="group" aria-label="Sort the worklist"><span class="sort-l">Sort</span>${sortBtn("due", "Deadline")}${sortBtn("ready", "Ready to act first")}</div>
      <span class="count">${countLine}</span>
    </div>
    <table class="list">
      <thead><tr>
        <th scope="col" class="r" style="width:10%">Due</th>
        <th scope="col" style="width:33%">Patient</th>
        <th scope="col" style="width:16%">Recommendation</th>
        <th scope="col" class="nx" style="width:18%">Next step</th>
        <th scope="col" class="reason" style="width:23%">Payer's reason</th>
      </tr></thead>
      <tbody>${shown.length ? shown.map(rowHtml).join("") : `<tr><td colspan="5" class="empty">${emptyHtml(state.filter)}</td></tr>`}</tbody>
    </table>`;
  $main.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { state.filter = b.dataset.f; worklist(); }));
  $main.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => { sortSet(b.dataset.sort); worklist(); }));
  fillFixSteps(shown);
}

// Worklist sort, per viewer (this browser only). "Ready to act first" is the default, so the first row is the one
// the headline names; Deadline is one click away, and a viewer's choice is remembered.
const SORT_KEY = "denial-auditor.sort.v1";
function sortGet() { if (state.sort) return state.sort; try { return localStorage.getItem(SORT_KEY) === "due" ? "due" : "ready"; } catch { return "ready"; } }
function sortSet(k) { state.sort = k === "ready" ? "ready" : "due"; try { localStorage.setItem(SORT_KEY, state.sort); } catch { /* storage blocked: the sort is kept for this visit only */ } }

// One quiet orientation sentence for a first visit, pointing at the showcase case.
const SHOWCASE = "case_015";
function orientHtml(rows) {
  const r = rows.find((x) => x.id === SHOWCASE);
  return `<p class="orient">Each denial is checked rule by rule against the payer's policy on the service date.${r ? ` <a class="link" href="#/case/${r.id}">Open ${esc(r.patient)}'s case →</a>` : ""}</p>`;
}

// The worklist's next-step column: what the biller does on this row.
const STEP = { appeal: "Review the letter", doc_request: "Copy the request to the physician", fix_checklist: "Fix the claim", dont_appeal: "See what's missing", not_winnable: "Close: plan exclusion" };
const firstStep = (item) => item.replace(/\s*\([^)]*\)/g, "").replace(/[.;:]\s*$/, "").trim();
// A fix row names the first item of its claim checklist, read from the case.
function fillFixSteps(rows) {
  state.fixStep ||= {};
  rows.filter((r) => r.verdict === "fix_checklist").forEach(async (r) => {
    if (!(r.id in state.fixStep)) {
      try { const c = await api(`/api/cases/${encodeURIComponent(r.id)}`); state.fixStep[r.id] = c.run.triage.checklist[0] ? firstStep(c.run.triage.checklist[0]) : ""; }
      catch { state.fixStep[r.id] = ""; }
    }
    const el = $main.querySelector(`[data-nx="${CSS.escape(r.id)}"] span`);
    if (el && state.fixStep[r.id]) el.textContent = state.fixStep[r.id];
  });
}

// A held denial, read from its case and its prior-auth check: the reorder date when the service came too early for
// the policy's waits (no note can win it), or whether a dated chart note could meet a blocking rule. Cached per case.
async function holdFor(caseId) {
  state.hold ||= {};
  if (caseId in state.hold) return state.hold[caseId];
  let out = { early: null, note: false };
  try {
    const [c, checks] = await Promise.all([api(`/api/cases/${encodeURIComponent(caseId)}`), loadChecks()]);
    if (c.run.verdict === "dont_appeal") {
      const saved = BOARD;
      BOARD = { thresholds: c.thresholds || [], facts: c.run.facts || null, dos: c.run.denial.dos, alt: null };
      const ctx = { run: c.run, c, chk: checks.find((x) => x.id === c.id) };
      const ms = prepMatches(c.run, c, false);
      const early = tooEarly(ctx, ms);
      out = { early, note: !early && documentable(ctx, ms.filter((m) => m.status === "not_met" && !offRoute(m))).length > 0 };
      BOARD = saved;
    }
  } catch { /* the row keeps its plain label */ }
  return (state.hold[caseId] = out);
}
const holdNow = (caseId) => (state.hold || {})[caseId] || { early: null, note: false };
// The reorder step, said against the board's review date: a date already reached reads "now".
const reorderStep = (early, asOf) => (asOf && early <= asOf ? `Reorder now: qualifies since ${fmtDate(early)}` : `Reorder from ${fmtDate(early)}`);

// The denial the headline starts with: the soonest appeal, else the soonest wait on the physician.
function startRow(rows) {
  const r = rows.find((x) => x.verdict === "appeal" && x.days_left != null) || rows.find((x) => x.verdict === "doc_request" && x.days_left != null);
  return r ? r.id : null;
}
// The worklist's one sentence: the finding, computed from the rows.
function finding(rows, asOf) {
  const soonest = (v) => rows.find((r) => r.verdict === v && r.days_left != null);
  const days = (n) => `${n} ${n === 1 ? "day" : "days"}`;
  const tail = (r) => r.days_left < 0
    ? `was due ${fmtDate(r.due)}, ${days(-r.days_left)} ago`
    : `due ${fmtDate(r.due)}, ${days(r.days_left)} left`;
  const appeal = soonest("appeal"), ask = soonest("doc_request");
  if (appeal) return `${rows.filter((r) => r.verdict === "appeal").length} ready to appeal. Start with ${esc(appeal.patient)}: ${tail(appeal)}.`;
  if (ask) return `${rows.filter((r) => r.verdict === "doc_request").length} waiting on the physician. Start with ${esc(ask.patient)}: ${tail(ask)}.`;
  const next = rows.find((r) => r.days_left != null);
  return next ? `Nothing is ready to appeal yet. The next deadline is ${esc(next.patient)}'s, due ${fmtDate(next.due)}.` : "Nothing is ready to appeal yet.";
}

// Urgency colour only on verdicts someone still has to act on.
function dueState(verdict, left) {
  if (left == null) return "";
  if (verdict === "not_winnable") return "closed";
  if (!ACTIONABLE.has(verdict)) return "";
  return left < 0 ? "late" : left < 21 ? "soon" : "";
}
// Work status, per viewer (this browser only): what the biller has done with an appeal letter.
// The tool never submits; "Sent by you" is the biller's own note that they sent it.
const WORK_KEY = "denial-auditor.work.v1";
function workAll() { try { const w = JSON.parse(localStorage.getItem(WORK_KEY) || "{}"); return w && typeof w === "object" ? w : {}; } catch { return {}; } }
function workSet(caseId, status) {
  try { const w = workAll(); if (status) w[caseId] = { status, at: new Date().toISOString().slice(0, 10) }; else delete w[caseId]; localStorage.setItem(WORK_KEY, JSON.stringify(w)); } catch { /* storage blocked: status just isn't kept */ }
}
const workWord = (w) => (w.status === "sent" ? `Sent by you on ${fmtDate(w.at)}` : "Exported · send it yourself");

function rowHtml(r) {
  const st = dueState(r.verdict, r.days_left);
  const w = r.verdict === "appeal" ? workAll()[r.id] : null;
  const hold = r.verdict === "dont_appeal" ? holdNow(r.id) : { early: null, note: false };
  const fig = r.days_left == null ? `<span class="l2 muted">Check the notice</span>`
    : `<span class="fig"><b>${r.days_left < 0 ? "−" + -r.days_left : r.days_left}</b> <span class="u">days</span></span>
       <span class="l2">${r.days_left < 0 ? "overdue · " : st === "soon" ? "due soon · " : ""}${fmtDate(r.due)}</span>`;
  return `<tr>
    <td class="due r ${st}">${fig}</td>
    <td class="who">${avatar(r.patient)}<a class="l1" href="#/case/${r.id}">${esc(r.patient)}</a>
      <span class="l2">${esc(payerShort(r.payer))} · ${id("CPT " + r.cpt)}<span class="l2-dos"> · DOS ${fmtDate(r.dos)}</span>${r.live ? " · live run" : ""}</span></td>
    <td class="rec">${verdictMark(r.verdict, hold.early)}</td>
    <td class="nx">${r.id === state.startId && !w ? '<span class="start-here">Start here</span>' : ""}${w ? `<a class="nx-link work-${w.status}" href="#/case/${r.id}?tab=next">${g("check")}<span>${esc(workWord(w))}</span>${svg("chevron")}</a>`
      : `<a class="nx-link" href="#/case/${r.id}?tab=next" data-nx="${esc(r.id)}"><span>${esc((state.fixStep || {})[r.id] || (hold.early ? reorderStep(hold.early, state.asOf) : hold.note ? "Read the note to the physician" : STEP[r.verdict]))}</span>${svg("chevron")}</a>`}</td>
    <td class="reason" title="${esc(r.reason)}">${esc(r.reason)}</td>
    <td class="stack">DOS ${fmtDate(r.dos)} · ${esc(r.reason)}</td>
  </tr>`;
}

// ---------------- Case ----------------
async function caseView(caseId, tab) {
  setNav("case");
  if (!caseId) {
    const data = await loadCases();
    caseId = state.lastCase || (data.cases[0] && data.cases[0].id);
    if (!caseId) { $main.innerHTML = `<p class="muted">No cases yet.</p>`; return; }
    history.replaceState(null, "", `#/case/${caseId}`);
  }
  state.lastCase = caseId;
  $main.innerHTML = caseSkeleton();
  let c;
  try { c = await api(`/api/cases/${encodeURIComponent(caseId)}`); }
  catch (e) { $main.innerHTML = `<div class="err-block"><span>Couldn't load this case: ${esc(e.message)}.</span><a class="link" href="#/worklist">Back to the worklist</a></div>`; return; }
  const run = c.run, d = run.denial, v = VERDICT[run.verdict];
  const rep = await drift();
  document.title = `${c.patient} · Denial Auditor`;
  // The same chart checked before the request went out, if there is a prior-auth check for it.
  const chk = (await loadChecks()).find((x) => x.id === c.id);
  const chkWord = chk && (chartOnly(chk.readiness, chk.earliest, chk.planned_dos) ? `through ${fmtDate(chk.earliest)}` : chk.readiness === "not_yet" && chk.earliest ? `earliest ${fmtDate(chk.earliest)}` : "");
  const linked = chk ? `${readyMark(chk.readiness, chk.earliest, chk.planned_dos)}${chkWord ? ` <span>${chkWord}</span>` : ""} · <a class="link" href="#/check/${esc(chk.id)}">Open the check</a>` : "";
  // The check's own verified facts (its onset date), for a rule this run couldn't count.
  const chkFull = chk ? await loadCheck(chk.id) : null;
  NOTE_DATES = Object.fromEntries(c.notes.map((n) => [n.note_id, n.date]));
  BOARD = { thresholds: c.thresholds || [], facts: run.facts || null, dos: d.dos, alt: chkFull ? { id: chk.id, facts: chkFull.check.facts } : null };
  const matches = prepMatches(run, c, run.verdict === "appeal");
  const early = tooEarly({ run, c, chk }, matches);
  // A held denial a dated chart note could win: its Next step is the note to the physician.
  const noteOk = run.verdict === "dont_appeal" && !early && documentable({ run, c, chk }, matches.filter((m) => m.status === "not_met" && !offRoute(m))).length > 0;
  const vv = verdictOf(run.verdict, early);
  const card = caseCard(run, c, chk, early, noteOk);
  const nextWord = run.appeal ? ["Appeal letter", "Appeal"] : run.doc_request ? ["Documentation request", "Request"] : noteOk ? ["Note to physician", "Note"]
    : run.verdict === "fix_checklist" && run.triage.checklist.length ? ["Fix checklist", "Fix"] : ["Next step", "Next"];
  const docTabs = [run.policy && ["policy", "Policy", "Policy"], ["chart", "Chart notes", "Chart"], ["letter", "Denial letter", "Notice"], ["next", ...nextWord]].filter(Boolean);
  const ledgerHtml = `${run.verdict === "fix_checklist" ? fixWhyHtml(run) : run.verdict === "not_winnable" ? notWinnableWhyHtml(run) : ""}${rulesHtml(matches, "case")}`;

  $main.innerHTML = `
    <nav class="crumb" aria-label="Breadcrumb"><a class="link" href="#/worklist">Worklist</a><span class="sep">/</span>${avatar(c.patient)}<h1>${esc(c.patient)}</h1>${id(c.id.replace("case_", "Case "))}</nav>
    <section class="vline" aria-label="Recommendation and deadline">
      <div class="box"><span class="fl" aria-hidden="true"><b>1</b>Recommendation</span><p class="answer v-${run.verdict}"><span class="sr">Recommendation: </span>${g(vv.glyph)}${esc(vv.label)}</p></div>
      <div class="box"><span class="fl" aria-hidden="true"><b>2</b>${windowWord(run.verdict)}</span>${deadlineCell(run.verdict, c.deadline, d.notice_date, c.as_of)}</div>
      <div class="box box-act" data-act><div class="actions" data-card>${card.before}</div></div>
    </section>
    <p class="why-line">${esc(early ? earlyLine(d.dos, early, c.as_of) : v.line)}</p>
    ${regionSwitch(docTabs, ledgerHtml.trim() ? (run.triage.route === "clinical_review" ? "Rules" : "Why") : "")}
    ${factsDl([
      ["Payer said", `“${esc(d.reason_text)}”`, true],
      ["Reason code", d.carc.length ? id("CARC " + d.carc.join(", ")) : `<span class="faint">Not given</span>`],
      policyFact(run.policy, d.dos),
      ["Plan · service", `${esc(payerPlan(d.payer_name, d.plan_type))} · Lumbar MRI · ${id("CPT " + d.cpt)} · Service ${fmtDate(d.dos)}`],
      chk && ["Prior-auth check", linked],
      ["Policy watch", driftWords(rep, c.id, "denial")],
      (run.trace || []).length && ["Model calls", `<a class="link" href="#audit" data-open-audit>Model calls and cost ↓</a>`],
    ])}
    ${coverageHtml(run, matches)}
    <div class="workspace">
      <aside class="ledger" aria-label="Policy rules for this case">
        ${ledgerHtml}
      </aside>
      <section aria-label="Documents">
        ${run.appeal ? rulesRail(matches) : ""}
        <div class="tabs" role="tablist" aria-label="Documents">
          ${docTabs.map(([k, long], i) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${i === 0}">${long}</button>`).join("")}
        </div>
        <div data-pane></div>
      </section>
    </div>
    ${historySection(historyHtml(c, run, chk, rep))}
    ${auditHtml(run, matches, c)}`;

  // A ledger with nothing in it gives its column to the documents.
  const led = $main.querySelector(".ledger");
  if (led && !led.textContent.trim()) $main.querySelector(".workspace").classList.add("solo");
  // An administrative or excluded denial opens on the payer's notice; the card's button opens the checklist or the why.
  const tab0 = tab || (run.verdict === "fix_checklist" || run.verdict === "not_winnable" ? "letter" : null);
  const plain = run.verdict === "not_winnable" ? () => notWinnablePlain(c, run) : null;
  wireWorkspace({ c, run, matches, selected: null, mriLabel: "MRI", tab0, chk, card, plain, region0: tab ? "docs" : null, hist: () => historyHtml(c, run, chk, rep) }, { policy: policyPane, chart: chartPane, letter: letterPane, next: nextPane });
}

// The recommendation card always holds exactly one primary action: before the Next step is open, the button that
// opens it; once it is open, the next real thing to do there (export, copy the note or checklist, reorder).
function caseCard(run, c, chk, early, noteOk) {
  const b = (attrs, label, icon) => `<button type="button" class="btn primary" data-primary ${attrs}>${icon ? svg(icon) : ""}<span>${esc(label)}</span></button>`;
  if (run.doc_request) { const x = b("data-copy-docreq", "Copy documentation request", "copy"); return { before: x, after: x }; }
  const v = run.verdict;
  if (v === "appeal") return { before: b('data-tab-go="next"', "Review appeal"), after: b('data-card-export aria-disabled="true"', "Export locked", "lock") };
  if (v === "fix_checklist" && run.triage.checklist.length) return { before: b('data-tab-go="next" data-focus-fix', "Open fix checklist"), after: b("data-card-copy-fix", "Copy checklist", "copy") };
  if (v === "dont_appeal" && noteOk) return { before: b('data-tab-go="next"', "See the note to the physician"), after: b("data-copy-note", "Copy note to physician", "copy") };
  if (v === "dont_appeal" && early && chk) return { before: b('data-tab-go="next"', "See when it can qualify"), after: `<a class="btn primary" data-primary href="#/check/${esc(chk.id)}"><span>Open the prior-auth check</span></a>` };
  if (v === "not_winnable") return { before: b('data-tab-go="next"', "See why"), after: b("data-copy-plain", "Copy explanation for the file", "copy") };
  return { before: b('data-tab-go="next"', NEXT[v]), after: `<a class="btn primary" data-primary href="#/worklist"><span>Back to the worklist</span></a>` };
}

// Phone only: one region at a time. The first segment is the rules (with the coverage path above them), the rest
// are the document tabs. Hidden on wider screens, where the rules and the documents sit side by side.
function regionSwitch(docTabs, rulesWord) {
  return `<div class="region-switch" role="tablist" aria-label="Case sections">${rulesWord ? `<button type="button" role="tab" data-region-go="rules" aria-selected="false">${rulesWord}</button>` : ""}${docTabs.map(([k, , short]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="false">${short}</button>`).join("")}</div>`;
}
// History: open on wider screens; on a phone it folds under its heading, one tap away.
function historySection(items, sub = "") {
  const n = (items.match(/<li>/g) || []).length;
  return `<section class="history" aria-labelledby="history-h" data-fold-wrap><h2 class="sec" id="history-h">History${sub ? `<span>${sub}</span>` : ""}</h2>
    <button type="button" class="fold-toggle" data-fold-toggle aria-expanded="false" aria-controls="hist-list">${g("chevron")}<span>Show ${n} ${n === 1 ? "event" : "events"}</span></button>
    <ol class="hist" id="hist-list" data-history>${items}</ol></section>`;
}

// Why an administrative denial gets no clinical appeal: the reason code's meaning from the fixed table, then where the fix is.
const carcMeaning = (run) => (run.triage.explanation || run.denial.reason_text || "").replace(/\.\s*$/, "");
const lc1 = (t) => t.replace(/^./, (ch) => ch.toLowerCase());
function fixWhyHtml(run) {
  const code = run.denial.carc.length ? `CARC ${run.denial.carc.join(", ")}` : "";
  const meaning = carcMeaning(run);
  const n = run.triage.checklist.length;
  const what = code ? `${id(code)}${meaning ? ` (${esc(lc1(meaning))})` : ""} is` : meaning ? `“${esc(meaning)}” is` : "This denial is";
  return `<h2 class="sec">Why no medical-necessity appeal</h2>
    <div class="fix-why">
      <p>${what} an administrative reason in the fixed reason-code table, not a judgment on the chart. Medical-necessity evidence won't change it; correcting the claim, or disputing it with proof, will.</p>
      ${n ? `<p><button type="button" class="link" data-tab-go="next">Open the fix checklist</button> <span class="faint">· ${n} ${n === 1 ? "step" : "steps"}</span></p>` : ""}
    </div>`;
}

// Why a plan exclusion gets no clinical appeal: the reason code's meaning from the fixed table, then where to go.
function notWinnableWhyHtml(run) {
  const code = run.denial.carc.length ? `CARC ${run.denial.carc.join(", ")}` : "";
  const first = carcMeaning(run).split(/(?<=\.)\s+/)[0].replace(/\.\s*$/, "");
  const what = code ? `${id(code)}${first ? ` (${esc(lc1(first))})` : ""} is` : first ? `“${esc(first)}” is` : "This denial is";
  return `<h2 class="sec">Why no clinical appeal</h2>
    <div class="fix-why">
      <p>${what} a plan exclusion in the fixed reason-code table, not a judgment on the chart. The plan doesn't cover this service, so no policy rules were checked and medical-necessity evidence won't change the outcome.</p>
      <p><button type="button" class="link" data-tab-go="next">Open next step</button></p>
    </div>`;
}

function caseSkeleton() {
  return `${sk(240, 16)}<div class="vline">${sk(180, 28)}${sk(64, 28)}${sk(360, 4)}<span class="actions">${sk(140, 36, true)}</span></div>
    <div style="height:12px"></div>${sk(520, 14)}<div class="coverage">${sk(480, 14)}</div>
    <div class="workspace"><div>${sk(400, 96)}<div style="height:24px"></div>${sk(400, 72)}</div><div>${sk(720, 480)}</div></div>`;
}

// While the appeal letter is open the rules column folds to this one line, in the rules' place, so the tabs stay put.
function rulesRail(matches) {
  const live = matches.filter((m) => m.status !== "not_applicable").length, nSplit = matches.filter(split).length;
  return `<p class="rules-rail"><span>${live} deciding ${live === 1 ? "rule" : "rules"}</span>${nSplit ? `<span class="rr-split">${g("fork")}${nSplit} split ${nSplit === 1 ? "vote" : "votes"}</span>` : ""}<button type="button" class="link" data-tab-go="policy">Show them</button></p>`;
}

const squashText = (t) => String(t || "").replace(/\s+/g, " ").trim();
const wordSet = (t) => new Set(String(t).toLowerCase().match(/[a-z0-9]+/g) || []);
// Long: past the three lines the rule card shows before it is opened. Compressed: at most 60% of the sentence's length,
// and saying something the card's visible lines don't already say (not mostly the words of the sentence's opening).
const LONG_SENTENCE = 170, CARD_HEAD = 140;
function compresses(summary, sentence) {
  if (!summary || sentence.length <= LONG_SENTENCE || summary.length > 0.6 * sentence.length) return false;
  const head = wordSet(sentence.slice(0, CARD_HEAD)), mw = [...wordSet(summary)];
  return mw.filter((w) => head.has(w)).length / Math.max(1, mw.length) < 0.6;
}
// Matches with their criterion, address and the status they show (a route that isn't deciding reads "Other route").
function prepMatches(run, c, routeMet) {
  const byId = Object.fromEntries(run.criteria.map((x) => [x.criterion_id, x]));
  const seen = {};
  run.criteria.forEach((x) => { seen[x.summary] = (seen[x.summary] || 0) + 1; });
  const firstSentence = (t) => { const m = /^[\s\S]{20,220}?[.;:](\s|$)/.exec(t.trim()); return (m ? m[0] : t.slice(0, 200)).trim(); };
  // A prior-auth check whose earliest date (worked out in code) is on or before the planned date: the rule that
  // holds that wait is met once the care is charted. It is the not-met rule on a threshold's own policy sentence,
  // or, failing that, the not-met route rule that states a duration.
  const pending = new Set();
  if (run.request && run.earliest && run.earliest <= run.request.planned_dos) {
    const waitS = new Set((c.thresholds || []).map((t) => t.sentence));
    const sNum = (cid) => { const x = /S(\d+)/.exec(c.addresses[cid] || ""); return x ? Number(x[1]) : null; };
    const blk = run.matches.filter((m) => m.status === "not_met" && ["indication", "duration"].includes(byId[m.criterion_id].kind));
    let hit = blk.filter((m) => waitS.has(sNum(m.criterion_id)));
    if (!hit.length) hit = blk.filter((m) => byId[m.criterion_id].kind === "indication" && /\b\d+\s*(weeks?|months?|days?)\b/i.test(byId[m.criterion_id].verbatim_span)).slice(0, 1);
    hit.forEach((m) => pending.add(m.criterion_id));
  }
  const out = run.matches.map((m) => {
    const crit = byId[m.criterion_id];
    const show = pending.has(m.criterion_id) ? "pending" : m.status === "not_met" && crit.kind === "indication" && routeMet ? "route" : m.status;
    const summary = seen[crit.summary] > 1 ? firstSentence(crit.verbatim_span) : crit.summary;
    // "In short" earns its line only when it compresses a long sentence (one the card clamps) to well under its length.
    // A summary that restates the sentence, or a short sentence that needs no summary, shows the sentence alone.
    const echo = !compresses(summary, squashText(crit.verbatim_span));
    return { ...m, crit, summary, echo, addr: c.addresses[m.criterion_id], show };
  });
  // A denial with no route met: only the route that states a wait keeps "Blocks"; the other unmet routes are
  // alternatives ("Other route"), so one red mark stands for one reason, as on the prior-auth check.
  const isRoute = (m) => m.crit.kind === "indication" || m.crit.kind === "red_flag";
  if (!run.request && !routeMet && !out.some((m) => isRoute(m) && m.status === "met")) {
    const w = waitRule(out, true);
    if (w) out.forEach((m) => { if (m !== w && m.status === "not_met" && m.crit.kind === "indication" && m.show === "not_met") m.show = "alt"; });
  }
  return out;
}

// An administrative denial needs no clinical appeal, so its fixed-table window is a window to act, not to appeal.
const windowWord = (verdict) => (verdict === "fix_checklist" ? "Window to act" : "Appeal window");
function deadlineCell(verdict, dl, notice, asOf) {
  if (!dl || !dl.due) {
    return `<div class="deadline"><p class="none">Check the notice</p><p class="rowd">No deadline for this payer in the fixed table.</p></div>`;
  }
  const left = dl.days_left, total = Math.max(1, days(notice, dl.due));
  const st = dueState(verdict, left);
  const share = Math.max(0, Math.min(100, (left / total) * 100));
  const used = Math.max(0, total - Math.max(left, 0));
  return `<div class="deadline ${st}">
    <p class="rowa"><span class="fig">${left < 0 ? "−" + -left : left}</span><small>${left < 0 ? "days overdue" : st === "soon" ? "days left · due soon" : "days left"}</small></p>
    <div class="runway" role="img" aria-label="${windowWord(verdict)}: ${used} of ${total} days used, ${Math.max(left, 0)} left"><i style="width:${share.toFixed(1)}%"></i>${left < 0 ? '<span class="late-tick"></span>' : ""}</div>
    <p class="rowc"><span>Notice ${fmtDate(notice)}</span><span>Due ${fmtDate(dl.due)}</span></p>
    <p class="rowd"><span>${esc(dl.citation)} ·</span> <span>fixed deadline table ·</span> <span>as of ${fmtDate(asOf)}${dl.verified ? "" : " ·"}</span>${dl.verified ? "" : " <span>unverified</span>"}</p>
  </div>`;
}


// "L34220 v40 · source", the version in force on the date that matters (the date is the row's label).
const policyLine = (p) => snap(p)
  ? `<span class="nw"><span title="${esc(p.title)}">${id(policyId(p))}</span></span> · <span class="nw">snapshot ${fmtDate(p.fetched_at.slice(0, 10))}</span> · <span class="nw">effective ${fmtDate(p.effective_from)}</span> · <a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">source</a>`
  : `<span class="nw"><span title="${esc(p.title)}">${id(policyId(p))}</span> · <a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">source</a></span>`;
// A CMS policy is versioned by date, so its row says "Policy on {date}"; a payer page is a snapshot taken at fetch time.
const snap = (p) => p.version_basis === "snapshot-at-fetch" && !!p.fetched_at;
const policyFact = (p, date) => p && [snap(p) ? "Policy (snapshot)" : `Policy on ${fmtDate(date)}`, policyLine(p)];
// The case or check header: one definition list at one size. A row with [label, html, wide]; falsy rows are skipped.
const factsDl = (rows) => `<dl class="facts">${rows.filter(Boolean).filter((r) => r[1]).map(([k, v, wide]) => `<div${wide ? ' class="wide"' : ""}><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
// The policy watch's result for this case, in the header's words: re-checked, or changed with the rules that moved.
function driftWords(rep, caseId, kind) {
  const i = rep.items.find((x) => x.case_id === caseId && x.kind === kind);
  if (!i) return rep.checked_at ? `<span class="faint">Not in last night's watch</span>` : "";
  if (i.status === "error") return `${mark("neg", "cross", "Couldn't check")}`;
  if (i.status === "current") return `<span class="dl-mark">${g("check")}<span>Checked ${fmtDate(rep.checked_at.slice(0, 10))}, ${esc(citedWords(i))}</span></span>`;
  const rules = i.changed_rules.length ? ` Changed wording: ${i.changed_rules.map((r) => esc(r.summary)).join("; ")}.` : "";
  return `${mark("warn", "alert", "Policy changed")} <span>${esc(i.policy_id.replace(/^Aetna /, ""))}: ${esc(citedWords(i))}. ${esc(i.note)}${rules}</span>`;
}
// Prior-auth check details (facts), one fetch per check.
async function loadCheck(cid) {
  state.checkFull ||= {};
  if (!(cid in state.checkFull)) { try { state.checkFull[cid] = await api(`/api/checks/${encodeURIComponent(cid)}`); } catch { state.checkFull[cid] = null; } }
  return state.checkFull[cid];
}
// The case's history, built only from what the page already loaded: the check before submission, the service,
// the notice, the policy fetch, last night's watch, and this browser's own export note. Oldest first.
function historyHtml(c, run, chk, rep) {
  const d = run.denial, ev = [];
  if (chk) ev.push([chk.planned_dos, 0, `${readyMark(chk.readiness, chk.earliest, chk.planned_dos)}`, `Prior-auth check before submission, as of the planned date. <a class="link" href="#/check/${esc(chk.id)}">Open the check</a>`]);
  if (d.dos) ev.push([d.dos, 1, mark("quiet", "dash", "Service"), `Lumbar MRI · ${id("CPT " + d.cpt)}`]);
  if (d.notice_date) ev.push([d.notice_date, 2, mark("neg", "cross", "Denied"), `Notice from ${esc(payerShort(d.payer_name))}${d.carc.length ? ` · ${id("CARC " + d.carc.join(", "))}` : ""} · read by ${esc((d.extracted_by || "").split("/").pop() || "a model")}`]);
  if (c.as_of) ev.push([c.as_of, 3, mark("quiet", "dash", "Review date"), `Demo calendar: every deadline on the board is counted from it${c.deadline && c.deadline.due ? `. ${windowWord(run.verdict)} closes ${fmtDate(c.deadline.due)} (${esc(c.deadline.citation)})` : ""}`]);
  if (run.policy && run.policy.fetched_at) ev.push([run.policy.fetched_at.slice(0, 10), 4, mark("quiet", "check", "Policy fetched"), `${id(policyId(run.policy))} from ${run.policy.version_basis === "api-versioned" ? "the CMS Coverage API" : "the payer's page"}`]);
  const w = rep.items.find((x) => x.case_id === c.id && x.kind === "denial");
  if (w && rep.checked_at) ev.push([rep.checked_at.slice(0, 10), 5, w.status === "current" ? mark("pos", "check", "Re-checked") : w.status === "error" ? mark("neg", "cross", "Couldn't check") : mark("warn", "alert", "Policy changed"), `Policy watch against the live source: ${esc(citedWords(w))}`]);
  const work = workAll()[c.id];
  if (work && work.at) ev.push([work.at, 6, mark("pos", "check", work.status === "sent" ? "Sent by you" : "Exported"), `${work.status === "sent" ? "You marked the letter as sent" : "Letter exported; Denial Auditor doesn't send it"} · kept in this browser only`]);
  ev.sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
  return ev.map(([at, , m, t]) => `<li><time datetime="${esc(at)}">${fmtDate(at)}</time>${m}<span>${t}</span></li>`).join("");
}

// ---------- The coverage path: the payer's decision order, one ruled row ----------
const STAGES = [
  { key: "routes", title: "Route to coverage", kinds: ["indication", "red_flag"] },
  { key: "waits", title: "Waiting periods", kinds: ["duration"] },
  { key: "limits", title: "Restrictions", kinds: ["exclusion"] },
  { key: "docs", title: "Documentation", kinds: ["documentation"] },
];
// A pending rule ("met once charted") counts as neither met nor blocking.
function stageState(st, ms, pendWord) {
  const has = (s) => ms.some((m) => (m.show === "pending" ? "pending" : m.status) === s);
  if (st.key === "routes") return has("met") ? ["ok", "Qualifies"] : has("not_met") ? ["bad", "No route met"] : has("pending") ? ["warn", pendWord] : ["warn", "Not shown"];
  if (st.key === "waits") return has("not_met") ? ["bad", "Not met"] : has("missing_documentation") || has("pending") ? ["warn", has("pending") ? pendWord : "Undocumented"] : has("met") ? ["ok", "Met"] : ["mute", "Waived or not relevant"];
  if (st.key === "limits") return has("not_met") ? ["bad", "Applies"] : ["ok", "None apply"];
  return has("missing_documentation") ? ["warn", "Gaps"] : ["ok", "Complete"];
}
function coverageHtml(run, matches) {
  const pathWord = run.verdict === "fix_checklist" ? "Triage path" : "Coverage path";
  const head = `<div class="coverage-head"><span>${pathWord}</span><span>${run.triage.route === "clinical_review" ? "Fixed rule, no model" : "Reason-code table, no model"}</span></div>`;
  if (run.triage.route !== "clinical_review") {
    const to = run.triage.route === "fix_checklist" ? "Fix or dispute the claim, no medical-necessity appeal" : "Not covered by the plan, no clinical appeal";
    // The plain meaning comes from the fixed CARC table (triage.explanation); without it, the payer's own reason.
    const meaning = (run.triage.explanation || run.denial.reason_text || "").split(/(?<=\.)\s+/)[0];
    const code = run.denial.carc.length ? id("CARC " + run.denial.carc.join(", ")) : "Reason code not given";
    return `<section class="coverage" aria-label="${pathWord}">${head}<p class="single-line">${code}${meaning ? `<span aria-hidden="true">·</span><span>${esc(meaning)}</span>` : ""}<span class="to">${svg("chevron")}${esc(to)}</span></p></section>`;
  }
  // The pending wait reads the same everywhere ("Met once charted", the rule's own mark), with its date when known.
  const pend = matches.find((m) => m.show === "pending");
  const charting = !!(run.earliest && run.request && run.earliest <= run.request.planned_dos);
  const pendWord = charting ? `${STATUS.pending.label} · ${fmtDate(run.earliest)}` : STATUS.pending.label;
  const cells = STAGES.map((st) => {
    const all = matches.filter((m) => st.kinds.includes(m.crit.kind));
    const live = all.filter((m) => m.status !== "not_applicable" && !offRoute(m));
    let [k, word] = stageState(st, all.filter((m) => !offRoute(m)), pendWord);
    // A prior-auth check with an earliest date: the wait may sit inside a route rule, so name the date and that rule here.
    if (st.key === "waits" && run.earliest) {
      [k, word] = charting ? ["warn", pendWord] : ["bad", `Not met until ${fmtDate(run.earliest)}`];
      const w = pend || waitRule(matches);
      if (w && !live.includes(w)) live.push(w);
    }
    // A denial whose wait sits inside a route rule ("6 weeks of conservative therapy"): name it, with the days
    // counted in code, instead of "waived".
    if (st.key === "waits" && !run.request && !all.length && run.verdict !== "appeal") {
      const w = waitRule(matches, true);
      if (w) {
        const k2 = counted(w.addr);
        [k, word] = ["bad", k2 ? `Not met: ${k2.n} of ${k2.t.days} days charted` : "Not met"];
        live.push(w);
      }
    }
    // One structure for every state: a glyph, then the word in the tone's ink.
    const [cls, gl] = { ok: ["ok", "check"], bad: ["bad", "cross"], warn: ["warn", "half"] }[k] || ["mute", "dash"];
    const res = `<span class="res ${cls}">${g(gl)}<span>${esc(word)}</span></span>`;
    const quiet = all.filter((m) => !live.includes(m)).length;
    const refs = live.map((m) => `<button type="button" class="link id" ${named(`${sWords(m.addr)}: ${m.summary}`)} data-chip="${m.criterion_id}">${esc(m.addr || m.criterion_id)}</button>`).join('<span aria-hidden="true">·</span>');
    return `<li><span class="lab">${st.title}</span><span class="line">${res}${refs || quiet ? `<span class="refs">${refs}${quiet ? `<span>+${quiet} ${st.key === "routes" ? "" : "more "}${st.key === "routes" ? (quiet > 1 ? "other routes" : "other route") : quiet > 1 ? "rules don't apply" : "rule doesn't apply"}</span>` : ""}</span>` : ""}</span></li>`;
  }).join("");
  return `<section class="coverage" aria-label="Coverage path">${head}<ol class="coverage-steps flat">${cells}</ol></section>`;
}

// The route rule that carries a waiting period ("no improvement after 6 weeks of ..."), if one blocks.
const waitRule = (matches, strict) => {
  const blk = matches.filter((m) => m.status === "not_met" && m.crit.kind === "indication" && m.show !== "alt");
  return blk.find((m) => DUR.test(m.crit.verbatim_span)) || (strict ? null : blk[0] || null);
};

// ---------- Rules ledger ----------
const RANK = { not_met: 0, missing_documentation: 1, pending: 1, met: 2, route: 3, alt: 3, not_applicable: 4 };
// Within one status, the rules where the two Super votes split (and Ultra decided) come first: those are worth a second look.
const split = (m) => m.confidence === "escalated";
const byRank = (a, b) => RANK[a.show] - RANK[b.show] || split(b) - split(a);
// more: the split votes ruled "doesn't apply" are listed above it, so this count is the rest of them.
function naLabel(n, more, open) {
  return open ? `Hide the ${n} that don't apply` : `${n} ${more ? "more" : n === 1 ? "rule" : "rules"} ${n === 1 && !more ? "doesn't" : "don't"} apply · Show`;
}
// The split votes Ultra ruled "doesn't apply": folded, one compact row each, under the same kind of toggle.
const splitLabel = (n, open) => `${g("fork")}<span>${open ? `Hide the ${n} split votes` : `${n} split votes ruled “doesn't apply” · Show`}</span>`;
function rulesHtml(matches, scope) {
  const live = matches.filter((m) => m.status !== "not_applicable").sort(byRank);
  // A rule the two Super votes split on stays in view even when Ultra ruled it doesn't apply: it is worth a second look.
  const splitNa = matches.filter((m) => m.status === "not_applicable" && split(m));
  const na = matches.filter((m) => m.status === "not_applicable" && !split(m)).sort(byRank);
  if (!matches.length) return "";
  return `<h2 class="sec">Rules that decide this ${scope === "check" ? "request" : "case"}<span>${live.length} deciding · ${na.length + splitNa.length} don't apply${splitNa.length ? ` (${splitNa.length} after a split vote, Ultra decided)` : ""}</span></h2>
    <div class="rules">${live.map((m) => ruleHtml(m)).join("")}</div>
    ${splitNa.length > 2 ? `<button type="button" class="na-toggle split-toggle" data-split-na aria-expanded="false" aria-controls="split-na-list">${splitLabel(splitNa.length, false)}</button><div class="rules compact" id="split-na-list" data-na-list hidden>${splitNa.map((m) => ruleHtml(m, true)).join("")}</div>`
      : splitNa.length ? `<h3 class="sec sub-sec">Votes split · Nemotron Ultra decided<span>${splitNa.length} ${splitNa.length === 1 ? "rule" : "rules"} · ruled “doesn't apply”</span></h3><div class="rules compact">${splitNa.map((m) => ruleHtml(m, true)).join("")}</div>` : ""}
    ${na.length ? `<button type="button" class="na-toggle" data-na data-split="${splitNa.length ? 1 : 0}" aria-expanded="false" aria-controls="na-list">${naLabel(na.length, splitNa.length > 0, false)}</button><div class="rules" id="na-list" data-na-list hidden>${na.map((m) => ruleHtml(m)).join("")}</div>` : ""}`;
}
// "super:met, super:not_applicable, ultra:not_applicable" in words: "Super vote 1: Supports · Super vote 2: Doesn't apply → Ultra: Doesn't apply".
function votesWords(votes) {
  let n = 0;
  const parts = (votes || []).map((v) => {
    const [who, st] = String(v).split(":");
    const word = (STATUS[st] || {}).label || String(st || "").replace(/_/g, " ");
    return /ultra/i.test(who) ? `→ Ultra: ${word}` : `${/nano/i.test(who) ? "Nano" : "Super"} vote ${++n}: ${word}`;
  });
  return parts.join(" · ").replace(/ · →/g, " →");
}
// The same votes, short, for a compact row: "Blocks / Doesn't apply → Ultra: Doesn't apply".
function votesShort(votes) {
  const word = (st) => (STATUS[st] || {}).label || String(st || "").replace(/_/g, " ");
  const vs = (votes || []).map((v) => String(v).split(":"));
  const first = vs.filter(([who]) => !/ultra/i.test(who)).map(([, st]) => word(st)).join(" / ");
  const ultra = vs.find(([who]) => /ultra/i.test(who));
  return `${first}${ultra ? ` → Ultra: ${word(ultra[1])}` : ""}`;
}
// A rule card leads with the payer's own sentence, cut from the source (clamped to three lines, all of it once
// selected). Nemotron's short summary sits under it, labelled "In short", unless it only restates the sentence.
const verbSum = (m) => `<span class="rule-sum verb">${esc(squash(m.crit.verbatim_span))}</span>`;
const inShort = (m) => (m.echo ? "" : `<span class="rule-short"><span class="lead">In short:</span> ${esc(m.summary)}</span>`);
// compact: a split vote folded under its toggle. One line of rule text, its address and the vote trail;
// the quote and the reasoning open with the row.
function ruleHtml(m, compact) {
  const ev = m.evidence.filter((e) => e.verified);
  const conf = m.confidence || "single";
  const evHtml = (e) => `<p class="ev">${g("tick")}<span class="vw">Verified</span><span class="q">“${esc(e.quote)}”</span><a class="id link" href="#" data-goto="note:${esc(e.note_id)}" ${named(nWords(noteShort(e.note_id), fmtDate(NOTE_DATES[e.note_id])))}>Note ${esc(noteShort(e.note_id))}${NOTE_DATES[e.note_id] ? ` · ${fmtDate(NOTE_DATES[e.note_id])}` : ""}</a></p>`;
  if (compact) return `<article class="rule compact" data-rule="${m.criterion_id}">
    <button type="button" class="rule-toggle" data-rule="${m.criterion_id}" aria-pressed="false" aria-expanded="false" aria-controls="more-${m.criterion_id}">
      ${verbSum(m)}
    </button>
    ${m.addr ? `<a class="id link rule-addr" href="#" data-goto="${gotoFor(m.addr)}" ${named(sWords(m.addr))}>Policy ${esc(m.addr)}</a>` : ""}
    <p class="conf-flag">${g("fork")}<span>${esc(votesShort(m.votes))}</span></p>
    <div class="rule-more" id="more-${m.criterion_id}" hidden>
      ${inShort(m)}
      ${ev.map(evHtml).join("")}
      <p class="why"><span class="lead">Nemotron's reasoning:</span> ${esc(m.rationale)}</p>
      <p class="conf">${esc(votesWords(m.votes))}</p>
    </div>
  </article>`;
  return `<article class="rule" data-rule="${m.criterion_id}">
    <button type="button" class="rule-toggle" data-rule="${m.criterion_id}" aria-pressed="false" aria-expanded="false" aria-controls="more-${m.criterion_id}">
      ${statusMark(m.show)}
      ${verbSum(m)}
      ${inShort(m)}
    </button>
    ${conf === "escalated" ? `<p class="conf-flag">${g("fork")}<span><b>Super votes split; Nemotron Ultra decided.</b> ${esc(votesWords(m.votes))}</span></p>` : ""}
    ${m.addr ? `<a class="id link rule-addr" href="#" data-goto="${gotoFor(m.addr)}" ${named(sWords(m.addr))}>Policy ${esc(m.addr)}</a>` : ""}
    ${ev.length ? evHtml(ev[0]) : m.status === "missing_documentation" ? `<p class="ev none">No chart note documents this.</p>` : ""}
    ${m.status !== "not_applicable" ? countedHtml(m.addr, m) : ""}
    <div class="rule-more" id="more-${m.criterion_id}" hidden>
      <p class="why"><span class="lead">Nemotron's reasoning:</span> ${esc(m.rationale)}</p>
      ${ev.slice(1).map(evHtml).join("")}
      <p class="conf">${esc(CONF[conf])}${m.votes && m.votes.length && conf !== "escalated" ? " · " + esc(votesWords(m.votes)) : ""}</p>
    </div>
  </article>`;
}

// Copy text, then say so on the button for two seconds.
async function copyWith(btn, text) {
  let ok = true;
  try { await navigator.clipboard.writeText(text); } catch { ok = false; }
  const label = btn.querySelector("span:last-child") || btn;
  const was = label.textContent; label.textContent = ok ? "Copied" : "Couldn't copy";
  setTimeout(() => { label.textContent = was; }, 2000);
}

// Tabs, rule selection, linked hover and policy/chart links for an evidence board.
function wireWorkspace(ctx, panes) {
  const { run, matches } = ctx;
  // $main outlives each view, so drop the previous board's delegated listeners.
  state.board?.abort();
  state.board = new AbortController();
  const signal = state.board.signal;
  const pane = $main.querySelector("[data-pane]");
  const tabs = [...$main.querySelectorAll("[data-tab]")];
  const cardSlot = $main.querySelector("[data-card]");
  const rulesSeg = $main.querySelector("[data-region-go]");
  const phone = matchMedia("(max-width: 640px)");
  ctx.expanded = new Set();
  // Phone: one region at a time, the rules (with the coverage path) or one document. Wider screens show both.
  const setRegion = (r) => {
    ctx.region = r;
    $main.dataset.region = r;
    if (rulesSeg) rulesSeg.setAttribute("aria-selected", String(r === "rules"));
    $main.querySelectorAll(".region-switch [data-tab]").forEach((t) => t.setAttribute("aria-selected", String(r === "docs" && t.dataset.tab === ctx.tab)));
  };
  // Switching region on a phone brings the switch back to the top of the screen, so the region starts in view.
  const toSwitch = () => {
    const sw = $main.querySelector(".region-switch");
    if (phone.matches && sw && sw.getBoundingClientRect().top < 56) sw.scrollIntoView({ block: "start" });
  };
  const show = (name, keepRegion) => {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    ctx.tab = name;
    $main.querySelector(".workspace").classList.toggle("letter-focus", name === "next" && !!run.appeal);
    // The card keeps one primary action: the button that opens Next step, then the next thing to do there.
    if (cardSlot && ctx.card) cardSlot.innerHTML = name === "next" ? ctx.card.after : ctx.card.before;
    pane.innerHTML = panes[name](ctx);
    if (name === "next") { wireNext(ctx, pane); wireFix(ctx, pane); wireNote(ctx, pane); }
    if (!keepRegion) setRegion("docs"); else setRegion(ctx.region || "rules");
  };
  const select = (ruleId, scroll) => {
    ctx.selected = ctx.selected === ruleId ? null : ruleId;
    $main.querySelectorAll("article.rule").forEach((a) => {
      const on = a.dataset.rule === ctx.selected;
      a.classList.toggle("on", on);
      const t = a.querySelector(".rule-toggle");
      t.setAttribute("aria-pressed", String(on)); t.setAttribute("aria-expanded", String(on));
      a.querySelector(".rule-more").hidden = !on;
      const sum = a.querySelector(".rule-sum[data-full]");
      if (sum) sum.textContent = on ? sum.dataset.full : sum.dataset.short;
    });
    // On a phone the rules region stays put while a rule opens in place; the documents follow behind it.
    const stay = phone.matches && ctx.region === "rules";
    if (!ctx.selected) { if (ctx.tab === "policy" || ctx.tab === "chart") show(ctx.tab, stay); return; }
    const m = matches.find((x) => x.criterion_id === ruleId);
    const wantChart = ctx.tab === "chart" && m.evidence.some((e) => e.verified);
    show(run.policy && !wantChart ? "policy" : "chart", stay);
    if (stay) return;
    if (scroll) {
      const el = [...pane.querySelectorAll("[data-crit]")].find((x) => x.dataset.crit.split(" ").includes(ruleId));
      el?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
  };
  tabs.forEach((t) => t.addEventListener("click", () => { const sw = !!t.closest(".region-switch"); show(t.dataset.tab); if (sw) toSwitch(); }));
  rulesSeg?.addEventListener("click", () => { setRegion("rules"); toSwitch(); });
  // Linked hover: a rule row, its address in the coverage path and its spans in the documents.
  const hot = (rid, on) => {
    $main.querySelectorAll(`[data-crit~="${rid}"], article.rule[data-rule="${rid}"], [data-chip="${rid}"]`).forEach((el) => el.classList.toggle("hot", on));
  };
  $main.addEventListener("mouseover", (e) => {
    const el = e.target.closest("article.rule[data-rule], [data-crit], [data-chip]");
    const rid = el && (el.dataset.rule || el.dataset.chip || el.dataset.crit.split(" ")[0]);
    if (rid !== ctx.hotId) { if (ctx.hotId) hot(ctx.hotId, false); ctx.hotId = rid; if (rid) hot(rid, true); }
  }, { signal });
  $main.addEventListener("click", async (e) => {
    const chip = e.target.closest("[data-chip]");
    if (chip) {
      const row = $main.querySelector(`article.rule[data-rule="${chip.dataset.chip}"]`);
      const naList = row?.closest("[data-na-list]");
      if (naList && naList.hidden) {
        const nb = $main.querySelector(`[aria-controls="${naList.id}"]`);
        if (nb) nb.click(); else naList.hidden = false;
      }
      if (ctx.selected !== chip.dataset.chip) select(chip.dataset.chip, true);
      row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    const toggle = e.target.closest(".rule-toggle");
    if (toggle) { select(toggle.dataset.rule, true); return; }
    const fold = e.target.closest("[data-fold]");
    if (fold) { ctx.expanded.add(fold.dataset.fold); show(ctx.tab); return; }
    const naBtn = e.target.closest("[data-na], [data-split-na]");
    if (naBtn) {
      const l = $main.querySelector(`#${naBtn.getAttribute("aria-controls")}`); l.hidden = !l.hidden;
      naBtn.setAttribute("aria-expanded", String(!l.hidden));
      if ("splitNa" in naBtn.dataset) naBtn.innerHTML = splitLabel(l.children.length, !l.hidden);
      else naBtn.textContent = naLabel(l.children.length, naBtn.dataset.split === "1", !l.hidden);
      return;
    }
    const go = e.target.closest("[data-tab-go]");
    if (go) {
      const focusFix = "focusFix" in go.dataset;
      show(go.dataset.tabGo); toSwitch();
      if (focusFix) pane.querySelector("[data-fix-i]")?.focus({ preventScroll: phone.matches });
      return;
    }
    const cardExport = e.target.closest("[data-card-export]");
    if (cardExport) { if (cardExport.getAttribute("aria-disabled") !== "true") ctx.exportLetter?.(); else pane.querySelector("[data-gate], [data-gate-bar]")?.scrollIntoView({ block: "nearest" }); return; }
    const cardFix = e.target.closest("[data-card-copy-fix]");
    if (cardFix) { copyWith(cardFix, fixPlain(ctx, [...pane.querySelectorAll("[data-fix-i]")])); return; }
    const plainBtn = e.target.closest("[data-copy-plain]");
    if (plainBtn && ctx.plain) { copyWith(plainBtn, ctx.plain()); return; }
    const foldBtn = e.target.closest("[data-fold-toggle]");
    if (foldBtn) {
      const wrap = foldBtn.closest("[data-fold-wrap]"), open = !wrap.classList.contains("open");
      wrap.classList.toggle("open", open); foldBtn.setAttribute("aria-expanded", String(open));
      const l = foldBtn.querySelector("span:last-child");
      if (l) { l.dataset.closed ||= l.textContent; l.textContent = open ? (foldBtn.dataset.openWord || "Hide") : l.dataset.closed; }
      return;
    }
    const copy = e.target.closest("[data-copy-docreq]");
    if (copy) { copyWith(copy, run.doc_request || ""); return; }
    const sha = e.target.closest("[data-copy-sha]");
    if (sha) { copyWith(sha, sha.dataset.copySha); return; }
    const rowsBtn = e.target.closest("[data-audit-rows]");
    if (rowsBtn) {
      const open = rowsBtn.getAttribute("aria-expanded") !== "true";
      $main.querySelectorAll(`[data-audit-row="${rowsBtn.dataset.auditRows}"]`).forEach((r) => { r.hidden = !open; });
      rowsBtn.setAttribute("aria-expanded", String(open)); rowsBtn.textContent = open ? "Hide calls" : "Show calls";
      return;
    }
    const toAudit = e.target.closest("[data-open-audit]");
    if (toAudit) {
      e.preventDefault();
      const d = $main.querySelector("#audit");
      if (d) { d.open = true; d.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); d.querySelector("summary")?.focus({ preventScroll: true }); }
      return;
    }
    const note = e.target.closest("[data-copy-note]");
    if (note) { copyWith(note, physicianNote(ctx, matches.filter((m) => m.status === "not_met" && !offRoute(m)))); return; }
    const goto = e.target.closest("[data-goto]");
    if (!goto || goto.dataset.goto === "null") return;
    e.preventDefault();
    const [kind, ref] = goto.dataset.goto.split(":");
    if (kind === "policy" && run.policy) {
      const n = Number(ref);
      const k = (ctx.foldIndex || []).find(([, lo, hi]) => n >= lo && n <= hi);
      if (k) ctx.expanded.add(k[0]);
      show("policy");
      pane.querySelector(`[data-s="${n}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (kind === "note") {
      show("chart");
      pane.querySelector(`[data-note="${CSS.escape(ref)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, { signal });
  const first = ctx.tab0 && panes[ctx.tab0] && (ctx.tab0 !== "policy" || run.policy) ? ctx.tab0 : run.policy ? "policy" : "chart";
  ctx.region = ctx.region0 || (rulesSeg ? "rules" : "docs");
  show(first, true);
}

// ---------- Model calls and cost: the run's trace in product words, grouped by stage ----------
const MODEL_NAME = [[/super-vl/i, "Nemotron 3.5 Super-VL"], [/nano/i, "Nemotron 3 Nano"], [/ultra/i, "Nemotron 3 Ultra"], [/super/i, "Nemotron 3 Super"]];
const modelName = (m) => (MODEL_NAME.find(([re]) => re.test(m)) || [null, String(m).split("/").pop()])[1];
const STEP_WORDS = { intake: "Read the denial", triage: "Triage the reason", criteria: "Split the policy into rules", facts: "Pull chart facts", appeal_draft: "Draft letter", appeal_critique: "Payer-reviewer critique", appeal_revise: "Revise letter" };
const MATCH_STEP = /^match:(C(\d+)):(?:v(\d+)|(referee))$/;
function stepWords(step, c) {
  const m = MATCH_STEP.exec(step);
  if (m) { const a = (c && c.addresses[m[1]]) || m[1]; return m[3] ? `Rule ${a} · Super vote ${m[3]}` : `Rule ${a} · Ultra referee`; }
  return STEP_WORDS[step] || step.replace(/_/g, " ");
}
const AUDIT_STAGES = [
  { key: "read", title: "Read the denial", test: (s) => /^(intake|triage)/.test(s) },
  { key: "facts", title: "Pull chart facts", test: (s) => s === "facts" },
  { key: "rules", title: "Check rules against the chart", test: (s) => /^(match|criteria)/.test(s) },
  { key: "letter", title: "Write the letter", test: (s) => /^appeal/.test(s) },
  { key: "other", title: "Other", test: () => true },
];
const secs = (n) => Number(n || 0).toFixed(1);
const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
const usd = (n) => `$${Number(n || 0).toFixed(4)}`;
// "34 Nemotron calls on Nebius Token Factory · 4 models · $0.0596"
function runtimeLine(run) {
  const t = run.trace || [];
  if (!t.length) return "";
  const models = new Set(t.map((s) => modelName(s.model))).size;
  return `${t.length} Nemotron ${t.length === 1 ? "call" : "calls"} on Nebius Token Factory · ${models} ${models === 1 ? "model" : "models"} · ${usd(run.cost_usd)}`;
}
function auditHtml(run, matches, c) {
  const t = run.trace || [];
  if (!t.length) return "";
  // Every rule is counted once, by who decided it: two agreeing Super votes, Ultra on a split, one model call, or code.
  const byCode = matches.filter((m) => m.confidence === "rule" || m.model === "rule").length;
  const esc2 = matches.filter((m) => m.confidence === "escalated").length;
  const agreed = matches.filter((m) => m.confidence === "agreed").length;
  const single = matches.length - byCode - esc2 - agreed;
  const decided = [
    agreed && `${agreed} ${agreed === 1 ? "rule" : "rules"} agreed by 2 Super votes`,
    esc2 && `${esc2} split, decided by Ultra`,
    single > 0 && `${single} decided by one model call`,
    byCode && `${byCode} decided by code`,
  ].filter(Boolean).join(" · ");
  const order = (s) => { const m = MATCH_STEP.exec(s.step); return m ? Number(m[2]) * 10 + (m[3] ? Number(m[3]) : 9) : 0; };
  const used = new Set();
  const groups = AUDIT_STAGES.map((st) => {
    const rows = t.filter((s) => !used.has(s) && st.test(s.step));
    rows.forEach((s) => used.add(s));
    if (st.key === "rules") rows.sort((a, b) => order(a) - order(b));
    return { ...st, rows };
  }).filter((x) => x.rows.length);
  const cells = (rows) => `<td class="r">${sum(rows, "prompt_tokens").toLocaleString()}</td><td class="r">${sum(rows, "completion_tokens").toLocaleString()}</td><td class="r">${secs(sum(rows, "latency_s"))}</td><td class="r">${usd(sum(rows, "cost_usd"))}</td>`;
  const callRow = (s, grp, hide) => `<tr class="a-call"${grp ? ` data-audit-row="${grp}"` : ""}${hide ? " hidden" : ""}><td>${/:referee$/.test(s.step) ? g("fork") : ""}${esc(stepWords(s.step, c))}</td><td>${esc(modelName(s.model))}</td>${cells([s])}</tr>`;
  const body = groups.map((grp) => {
    if (grp.rows.length === 1) return callRow(grp.rows[0]).replace('<tr class="a-call">', '<tr class="a-stage">');
    const models = [...new Set(grp.rows.map((s) => modelName(s.model).replace(/^Nemotron 3 /, "")))].join(", ");
    const fold = grp.key === "rules";
    const n = grp.rows.length;
    return `<tr class="a-stage"><td>${esc(grp.title)} <span class="faint">· ${n} calls</span>${fold ? ` <button type="button" class="link" data-audit-rows="${grp.key}" aria-expanded="false">Show calls</button>` : ""}</td><td>${esc(models.startsWith("Nemotron") ? models : `Nemotron 3 ${models}`)}</td>${cells(grp.rows)}</tr>
      ${grp.rows.map((s) => callRow(s, grp.key, fold)).join("")}`;
  }).join("");
  return `<details class="audit" id="audit">
    <summary>${g("chevron")}Model calls and cost <span class="faint">· ${runtimeLine(run)}${decided ? ` · ${decided}` : ""}</span></summary>
    <table class="list audit-t">
      <thead><tr><th scope="col" style="width:40%">Step</th><th scope="col" style="width:20%">Model</th><th scope="col" class="r">Tokens in</th><th scope="col" class="r">Tokens out</th><th scope="col" class="r">Call seconds</th><th scope="col" class="r">Cost</th></tr></thead>
      <tbody>${body}
        <tr class="a-total"><td colspan="2">Total for this case · ${t.length} calls · NVIDIA Nemotron on Nebius Token Factory</td>${cells(t)}</tr></tbody>
    </table>
    <p class="cap">Calls run in parallel, so call seconds add up to more than the case's wall-clock time. Cost is each call's tokens at Token Factory prices.</p>
  </details>`;
}

// ---------- Policy: one row per sentence, its address and decision in the gutter ----------
function policyPane(ctx) {
  const { run, c, matches } = ctx;
  // What each rule shows (a route not used, a wait met once charted), so the gutter says what the rule card says.
  const status = Object.fromEntries(matches.map((m) => [m.criterion_id, m.show]));
  const splitIds = new Set(matches.filter(split).map((m) => m.criterion_id));
  const sel = ctx.selected;
  const text = run.policy.text;
  const isHeading = (t) => !/[.:;)”"]$/.test(t.trim()) && t.length < 70 && !t.startsWith("•");
  const crits = (s) => s.criteria.filter((cid) => status[cid] && (status[cid] !== "not_applicable" || cid === sel || splitIds.has(cid)));
  const marked = (s) => crits(s).length > 0;
  let html = "", lastHeading = "";
  ctx.foldIndex = [];
  const S = c.sentences;
  for (let i = 0; i < S.length; i++) {
    const s = S[i], t = s.text;
    if (isHeading(t)) { if (t.trim() !== lastHeading) html += `<h3 class="hdg">${esc(t)}</h3>`; lastHeading = t.trim(); continue; }
    if (!marked(s)) {
      let j = i;
      while (j + 1 < S.length && !marked(S[j + 1]) && !isHeading(S[j + 1].text)) j++;
      const key = `f${s.n}`;
      ctx.foldIndex.push([key, s.n, S[j].n]);
      if (j - i >= 2 && !ctx.expanded.has(key)) {
        html += `<button type="button" class="fold" data-fold="${key}">${id(`S${s.n}–S${S[j].n}`)}<span>${j - i + 1} sentences of background, not a rule</span><b>Show</b></button>`;
        i = j; continue;
      }
    }
    const gap = i ? text.slice(S[i - 1].end, s.start) : "";
    const cs = crits(s).sort((a, b) => RANK[status[a]] - RANK[status[b]]);
    const pick = cs.includes(sel) ? sel : cs[0];
    const st = pick ? STATUS[status[pick]] : null;
    const body = pick ? `<span class="hl ${hlOf(status[pick])}${pick === sel ? " on" : " rest"}" data-crit="${s.criteria.join(" ")}">${esc(t)}</span>` : esc(t);
    // One status mark per sentence (glyph and word); a split vote is a half-disc beside the sentence id.
    const splitW = pick && splitIds.has(pick) ? `<span class="split" role="img" ${named("Super votes split; Nemotron Ultra decided")}>${g("fork")}</span>` : "";
    html += `<p class="sent${pick ? " rule-s" : ""}${/\n\s*\n/.test(gap) ? " para" : ""}" data-s="${s.n}"><span class="gut"><span class="id" title="Policy sentence ${s.n}">S${s.n}</span>${splitW}${st ? `<span class="w ${st.tone}">${g(st.glyph)}${st.label}</span>` : ""}</span><span>${body}</span></p>`;
  }
  const p = run.policy;
  const long = p.title.length > 40;
  return `<article class="sheet">
    <header class="sheet-head">
      <h2>${esc(long ? p.policy_id : p.title)}</h2>
      ${long ? `<p class="full">${esc(p.title)}</p>` : ""}
      <p class="smeta">${id(policyId(p))} · effective ${fmtDate(p.effective_from)} · fetched ${fmtDate(p.fetched_at)} · ${S.length} sentences · <a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">source</a></p>
      ${viaHtml(p)}
      <p class="smeta">${p.version_basis === "snapshot-at-fetch" && p.sha256
        ? `Snapshot of the payer's page at fetch time · <span class="id" title="sha256 ${esc(p.sha256)}">sha256 ${esc(p.sha256.slice(0, 8))}</span> <button type="button" class="link sha-copy" data-copy-sha="${esc(p.sha256)}"><span>Copy hash</span></button>`
        : p.version_basis === "api-versioned" ? `Version in force on the ${run.request ? "planned" : "service"} date, from the CMS Coverage API` : ""}</p>
    </header>
    ${html}
  </article>`;
}

// How the policy text reached this run, from the run's own record (fetched_via), never assumed.
function viaHtml(p) {
  let host = "";
  try { host = new URL(p.url).hostname.replace(/^www\./, ""); } catch { host = "the payer's site"; }
  const w = p.fetched_via === "http" ? `Fetched directly from ${esc(host)}. The bulletin's address comes from a Tavily search, cached after its first lookup, so a run can reuse it without a new search.`
    : p.fetched_via === "tavily-extract" ? `Located with Tavily search and fetched with Tavily extract from ${esc(host)}.` : "";
  return w ? `<p class="smeta">${w}</p>` : "";
}

// ---------- Chart notes: the timeline, then each note with its verified spans ----------
function chartPane(ctx) {
  const { c, run, matches } = ctx;
  const sel = ctx.selected;
  const notes = c.notes.map((n) => {
    const marks = [];
    matches.forEach((m) => m.evidence.forEach((e) => {
      if (e.verified && e.note_id === n.note_id && e.start != null && (m.status !== "not_applicable" || m.criterion_id === sel)) {
        marks.push({ a: e.start, b: e.end, cls: hlOf(m.show) + (m.criterion_id === sel ? " on" : " rest"), rule: m.criterion_id, st: STATUS[m.show], addr: m.addr });
      }
    }));
    marks.sort((x, y) => x.a - y.a || (y.rule === sel) - (x.rule === sel));
    let out = "", at = 0;
    for (const mk of marks) {
      if (mk.a < at) continue;
      out += esc(n.text.slice(at, mk.a)) + `<span class="hl ${mk.cls}" data-crit="${mk.rule}">${esc(n.text.slice(mk.a, mk.b))}</span>`
        + `<a class="hl-tag ${mk.st.tone}" href="#" data-goto="${gotoFor(mk.addr)}" ${named(`${mk.st.label}${mk.addr ? ", " + sWords(mk.addr) : ""}`)}>${mk.st.label}${mk.addr ? ` · ${id(mk.addr)}` : ""}</a>`;
      at = mk.b;
    }
    out += esc(n.text.slice(at));
    const cap = (s) => s.replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());
    return `<section class="note" data-note="${n.note_id}">
      <p class="note-h">${fmtDate(n.date)} · ${esc(cap(n.note_type))} · ${esc(cap(n.author_role))} <span class="id" title="${esc(nWords(noteShort(n.note_id)))}">${esc(noteShort(n.note_id))}</span></p>
      <div class="note-b">${out}</div></section>`;
  }).join("");
  return `${timelineHtml(c, run, ctx.mriLabel)}<article class="sheet notes">
    <header class="sheet-head"><h2>Chart notes</h2><p class="smeta">${c.notes.length} notes · synthetic patient</p></header>
    ${notes}
  </article>`;
}

const day = 864e5;
const toMs = (iso) => (iso ? Date.parse(iso + "T00:00:00Z") : null);
function timelineHtml(c, run, mriLabel = "MRI") {
  let f = run.facts;
  // No onset in this run: the verified onset on the same chart's prior-auth check, said where it is drawn.
  const o = f && !f.onset ? onsetFacts() : null;
  if (o && o.from) f = { ...f, onset: o.onset, symptom_days: o.n };
  if (!f || (!f.onset && !f.treatments.length && !f.red_flags.length)) return "";
  const dos = toMs(run.denial.dos), onset = toMs(f.onset);
  const tStarts = f.treatments.map((t) => toMs(t.start)).filter(Boolean);
  const firstTx = tStarts.length ? Math.min(...tStarts) : null;
  const lines = (c.thresholds || []).map((t) => {
    const base = t.from === "onset" ? onset : firstTx;  // no verified onset → that line isn't drawn
    if (!base) return null;
    const at = base + t.days * day;
    const met = t.from === "onset" ? dos >= at : (f.conservative_days || 0) >= t.days;
    return { ...t, at, state: f.red_flags.length ? "waived" : met ? "met" : "not_met" };
  }).filter(Boolean);
  const lo = Math.min(...[onset, ...tStarts, ...f.red_flags.map((r) => toMs(r.noted_on))].filter(Boolean), dos) - 4 * day;
  const hi = Math.max(dos, ...lines.map((l) => l.at)) + 6 * day;
  const pct = (ms) => ((ms - lo) / (hi - lo)) * 100;
  const x = (ms) => pct(ms).toFixed(2) + "%";
  // Threshold labels that land close together take separate rows.
  [...lines].sort((a, b) => a.at - b.at).forEach((l, i, arr) => {
    l.row = i && pct(l.at) - pct(arr[i - 1].at) < 22 ? Math.min(arr[i - 1].row + 1, 1) : 0;
  });
  const rows = f.treatments.filter((t) => t.start && t.end);
  const cap = (k) => k.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());
  const height = 56 + rows.length * 36 + 48;
  // Month starts between lo and hi.
  const months = [];
  const dt = new Date(lo); dt.setUTCDate(1); dt.setUTCMonth(dt.getUTCMonth() + 1);
  while (dt.getTime() < hi) { months.push(dt.getTime()); dt.setUTCMonth(dt.getUTCMonth() + 1); }
  const mName = (ms, full) => new Date(ms).toLocaleString("en-US", { month: "short", timeZone: "UTC", ...(full ? { year: "numeric" } : {}) });
  const flags = Object.entries(f.red_flags.filter((r) => r.noted_on).reduce((acc, r) => ((acc[r.noted_on] ||= []).push(r.flag), acc), {}));
  const legend = lines.map((l) => {
    const m = l.state === "met" ? mark("pos", "check", "Met") : l.state === "waived" ? mark("quiet", "dash", "Waived: red flags") : mark("neg", "cross", "Not met");
    return `<li>${m}<span>${esc(l.label)}</span><a class="id link" href="#" data-goto="policy:${l.sentence}" ${named(sWords(sAddr(l.address)))}>${esc(sAddr(l.address))}</a></li>`;
  }).join("");
  return `<section class="tl" aria-label="Chart timeline">
    <div class="tl-head"><h2>Chart timeline</h2><span>${f.symptom_days != null ? `Onset to ${esc(mriLabel)} ${f.symptom_days} days · ` : ""}conservative care ${f.conservative_days ?? 0} days</span></div>
    <div class="tl-track" style="height:${height}px">
      ${lines.map((l) => `<span class="tl-line ${l.state}${pct(l.at) > 62 ? " flip" : ""}" style="left:${x(l.at)};--lr:${l.row}"><span class="tl-line-l">${esc(l.label)}</span></span>`).join("")}
      ${rows.map((t, i) => `<span class="tl-bar" style="left:${x(toMs(t.start))};width:calc(${x(toMs(t.end))} - ${x(toMs(t.start))});top:${56 + i * 36}px"><span>${esc(cap(t.kind))}${t.sessions ? ` · ${t.sessions} sessions` : ""} · ${days(t.start, t.end)} days${t.response ? " · " + esc(t.response.replace(/_/g, " ")) : ""}</span></span>`).join("")}
      <span class="tl-axis"></span>
      ${months.map((ms, i) => `<span class="tl-tick" style="left:${x(ms)}"></span><span class="tl-month${i === 0 && pct(ms) < 8 ? " first" : ""}${pct(ms) > 92 ? " last" : ""}" style="left:${x(ms)}">${mName(ms, i === 0)}</span>`).join("")}
      ${flags.map(([on, fl]) => `<span class="tl-flag" style="left:${x(toMs(on))}" title="${esc(fl.join(", "))}"></span><span class="tl-flag-l" style="left:${x(toMs(on))}">Red flag${fl.length > 1 ? "s" : ""}: ${esc(fl.join(", "))}</span>`).join("")}
      ${onset ? `<span class="tl-pt${pct(onset) < 14 ? " start" : ""}" style="left:${x(onset)}"><b>Onset</b> ${fmtDate(f.onset)}${o && o.from ? " · from the check" : ""}</span>` : `<span class="tl-pt start" style="left:0"><b>Onset</b> not verified</span>`}
      <span class="tl-pt${pct(dos) > 86 ? " end" : ""}" style="left:${x(dos)}"><b>${esc(mriLabel)}</b> ${fmtDate(run.denial.dos)}</span>
    </div>
    ${legend ? `<ul class="tl-legend">${legend}</ul>` : ""}
  </section>`;
}

function letterPane(ctx) {
  const d = ctx.run.denial;
  return `<figure class="letter-fig"><div class="letter-scroll" tabindex="0" role="region" aria-label="Denial letter scan, scrolls"><img class="letter-img" src="/api/cases/${ctx.c.id}/letter" alt="Synthetic faxed denial notice for ${esc(ctx.c.patient)}"></div>
    <figcaption class="cap">Read by ${esc((d.extracted_by || "").split("/").pop() || "model")}. Fictional test notice, not issued by any insurer.</figcaption></figure>`;
}

// ---------- Next step: appeal letter + gate, documentation request, or what's missing ----------
function nextPane(ctx) {
  const { run, matches } = ctx;
  if (run.appeal) {
    return `<div class="appeal">
      <div>
        <div class="letter-tools">
          <button type="button" class="btn secondary" data-edit aria-pressed="false">Edit text</button>
          <span class="prov">Reconsideration request · drafted by Nemotron 3 Ultra, critiqued by Super</span>
        </div>
        <div class="gate-bar" data-gate-bar></div>
        <article class="sheet letter" data-letter aria-live="polite"></article>
        <p class="edit-help" id="letter-help" hidden>Quoted lines must stay word for word; the gate rechecks as you type.</p>
        <label class="sr" for="letter">Letter text</label>
        <textarea id="letter" class="editor" spellcheck="true" aria-describedby="letter-help" hidden>${esc(letterCodec(run.appeal.rendered).toPlain(run.appeal.rendered))}</textarea>
        ${run.appeal.critique.length ? `<details class="critique"><summary>${g("chevron")}Payer-reviewer critique addressed in revision ${run.appeal.revision}</summary><ul>${run.appeal.critique.map((x) => `<li><b>${esc(x.severity)}</b>: ${esc(x.issue)} → ${esc(x.suggestion)}</li>`).join("")}</ul></details>` : ""}
      </div>
      <aside class="gate" aria-live="polite" data-gate></aside>
    </div>`;
  }
  if (run.doc_request) return docRequestPane(run.doc_request);
  if (run.verdict === "fix_checklist" && run.triage.checklist.length) return fixPane(ctx);
  const blockers = matches.filter((m) => m.status === "not_met" && !offRoute(m));
  const early = tooEarly(ctx, matches);
  if (run.verdict === "dont_appeal" && !early && documentable(ctx, blockers).length) return notePane(ctx, blockers);
  const v = verdictOf(run.verdict, early);
  return `<article class="sheet plain">
    <header class="sheet-head"><h2>${esc(v.label)}</h2></header>
    <p>${esc(early ? earlyLine(run.denial.dos, early, ctx.c.as_of) : v.line)}</p>
    ${run.verdict === "not_winnable" ? notWinnableNext(run) : ""}
    ${blockersHtml(blockers)}
    ${run.verdict === "dont_appeal" && blockers.length ? (({ waitP, docP }) => `<h3 class="sub">What would change this</h3>${waitP}${docP}`)(changeHtml(ctx, blockers)) : ""}
    ${run.triage.checklist.length ? `<h3 class="sub">Checklist</h3><ol>${run.triage.checklist.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>` : ""}
  </article>`;
}
// Fix checklist ticks, per viewer (this browser only), keyed by case id. The tool never resubmits the claim.
const FIX_KEY = "denial-auditor.fix.v1";
function fixAll() { try { const f = JSON.parse(localStorage.getItem(FIX_KEY) || "{}"); return f && typeof f === "object" ? f : {}; } catch { return {}; } }
function fixSet(caseId, done) {
  try { const f = fixAll(); if (done.length) f[caseId] = done; else delete f[caseId]; localStorage.setItem(FIX_KEY, JSON.stringify(f)); } catch { /* storage blocked: ticks just aren't kept */ }
}
const fixCount = (done, n) => `${done} of ${n} done · ticks are kept in this browser only`;
function fixPane(ctx) {
  const { run, c } = ctx;
  const items = run.triage.checklist;
  const done = new Set((fixAll()[c.id] || []).filter((i) => Number.isInteger(i) && i < items.length));
  const code = run.denial.carc.length ? `CARC ${run.denial.carc.join(", ")}` : "";
  const meaning = carcMeaning(run);
  return `<article class="sheet plain fix">
    <header class="sheet-head split"><h2>Fix checklist</h2><button type="button" class="btn secondary" data-copy-fix>${svg("copy")}<span>Copy checklist</span></button></header>
    <p class="fix-flag">Flagged because ${code ? `${id(code)}: ` : ""}${esc(meaning ? lc1(meaning) : "an administrative reason")} (fixed reason-code table).</p>
    <ul class="fix-checks">${items.map((t, i) => `<li><label><input type="checkbox" data-fix-i="${i}"${done.has(i) ? " checked" : ""}><span>${esc(t)}</span></label></li>`).join("")}</ul>
    <p class="fix-count" data-fix-count aria-live="polite">${fixCount(done.size, items.length)}</p>
    <p class="last">Denial Auditor never resubmits anything. A person corrects the claim and sends it.</p>
  </article>`;
}
function wireFix(ctx, pane) {
  const boxes = [...pane.querySelectorAll("[data-fix-i]")];
  if (!boxes.length) return;
  const count = pane.querySelector("[data-fix-count]");
  boxes.forEach((b) => b.addEventListener("change", () => {
    const done = boxes.filter((x) => x.checked).map((x) => Number(x.dataset.fixI));
    fixSet(ctx.c.id, done);
    count.textContent = fixCount(done.length, boxes.length);
  }));
  pane.querySelector("[data-copy-fix]")?.addEventListener("click", (e) => copyWith(e.currentTarget, fixPlain(ctx, boxes)));
}
// The fix checklist as plain text, with this browser's ticks.
function fixPlain(ctx, boxes) {
  const run = ctx.run, code = run.denial.carc.length ? `CARC ${run.denial.carc.join(", ")}: ` : "";
  return [`Fix checklist · ${ctx.c.patient} · ${ctx.c.id}`, `Flagged because ${code}${lc1(carcMeaning(run))}.`,
    ...run.triage.checklist.map((t, i) => `${boxes[i]?.checked ? "[x]" : "[ ]"} ${i + 1}. ${t}`)].join("\n");
}
// Not winnable, for the patient's file: the code, its meaning from the fixed table, and what to do instead.
function notWinnablePlain(c, run) {
  const code = run.denial.carc.length ? `CARC ${run.denial.carc.join(", ")}` : "No reason code";
  return [`Not winnable · ${c.patient} · ${c.id.replace("case_", "Case ")}`, `${code}: ${squash(run.triage.explanation || run.denial.reason_text || "")}`,
    `Payer said: "${squash(run.denial.reason_text || "")}"`, "Plan exclusion in the fixed reason-code table: no clinical appeal. A person decides what to do next."].join("\n");
}
// Each unmet rule: the policy's words, the days counted in code (when the rule states a wait), then the model's reasoning.
const blockersHtml = (blockers) => (blockers.length ? `<h3 class="sub">What the chart doesn't meet yet</h3>${blockers.map((m) => `<div class="blk"><span class="hl not_met">${esc(squash(m.crit.verbatim_span))}</span>${countedHtml(m.addr, m)}<p class="why"><span class="lead">Nemotron's reasoning:</span> ${esc(m.rationale)} ${m.addr ? `<a class="id link" href="#" data-goto="${gotoFor(m.addr)}" ${named(sWords(m.addr))}>Policy ${esc(m.addr)}</a>` : ""}</p></div>`).join("")}` : "");

// "Don't appeal yet": what would change the answer, by when, and a plain-text note the biller can send the physician.
// Built in the browser from the rules the chart doesn't meet; the deadline is the fixed table's.
const addrList = (ms) => { const a = ms.map((m) => m.addr).filter(Boolean); return a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}` : a[0] || "the rules above"; };
// A rule that states a wait ("after 1 month of symptoms", "at least four weeks") is time-bound when the
// prior-auth check for the same chart worked out, in code, that the waits are met only after the service date.
// No note can make that time have passed, so it is never asked of the physician.
const WAIT_WORDS = /\b(\d+|one|two|three|four|five|six|seven|eight|ten|twelve|first)\s+(weeks?|months?|days?)\b/i;
const waitAfterDos = (ctx) => !!(ctx.chk && ctx.chk.earliest && ctx.chk.earliest > ctx.run.denial.dos);
const timeBound = (ctx, m) => waitAfterDos(ctx) && (!!thresholdFor(m.addr) || WAIT_WORDS.test(m.crit.verbatim_span));
const documentable = (ctx, blockers) => blockers.filter((m) => !timeBound(ctx, m));
// A held denial whose every blocking rule is a wait the service date fell short of: no note can win it, a new
// order can. Returns the check's earliest date (worked out in code), or null. Reads BOARD (thresholds).
function tooEarly(ctx, matches) {
  if (ctx.run.verdict !== "dont_appeal" || !waitAfterDos(ctx)) return null;
  const blockers = matches.filter((m) => m.status === "not_met" && !offRoute(m));
  return blockers.length && !documentable(ctx, blockers).length ? ctx.chk.earliest : null;
}
const earlyLine = (dos, earliest, asOf) => `The ${fmtDate(dos)} service came before the policy's waiting periods ended, so this denial can't be won on the chart. ${asOf && earliest <= asOf
  ? `A new order can qualify now: the waits were reached on ${fmtDate(earliest)}, before the ${fmtDate(asOf)} review date.`
  : `A new order from ${fmtDate(earliest)} can qualify.`}`;
function changeHtml(ctx, blockers) {
  const { run, c } = ctx, dl = c.deadline;
  const waits = blockers.filter((m) => timeBound(ctx, m)), docs = documentable(ctx, blockers);
  const by = dl && dl.due && dl.days_left >= 0 ? ` and re-run the case before the appeal window closes on <b>${fmtDate(dl.due)}</b>` : " and re-run the case";
  const waitP = waits.length ? `<p>${waits.length === 1 ? "The wait in" : "The waits in"} ${esc(addrList(waits))} had not passed by the ${fmtDate(run.denial.dos)} service date. The chart's own dates can't change that. The prior-auth check worked out, in code, that the earliest date ${waits.length === 1 ? "it" : "they"} can be met is <b>${fmtDate(ctx.chk.earliest)}</b>. A new order on or after that date, with the care charted as it happens, can qualify on ${waits.length === 1 ? "this rule" : "these rules"}. <a class="link" href="#/check/${esc(ctx.chk.id)}">Open the check</a></p>` : "";
  const docP = docs.length ? `<p>${waits.length ? "For the rest: chart" : "Chart"} notes dated on or before the ${fmtDate(run.denial.dos)} service date that show ${esc(addrList(docs))} ${docs.length === 1 ? "is" : "are"} met. If the physician has them, add them to the chart${by}. Only notes written at the time of care count.</p>` : "";
  return { waitP, docP };
}
// The note to the physician, in parts: the plain text the biller copies and the letter block on screen are the same words.
function noteParts(ctx, blockers) {
  const { run, c } = ctx, d = run.denial, dl = c.deadline, pid = run.policy ? policyId(run.policy) : "the payer's policy";
  return {
    title: `Documentation request · ${c.patient} · ${c.id.replace("case_", "Case ")}`,
    intro: [
      `Lumbar MRI, CPT ${d.cpt}, service date ${fmtDate(d.dos)}. ${payerShort(d.payer_name)} denied it: "${squash(d.reason_text)}"`,
      run.policy && snap(run.policy) ? `Policy: ${pid}, effective ${fmtDate(run.policy.effective_from)}, as published on the payer's site on ${fmtDate(run.policy.fetched_at.slice(0, 10))}.` : `Policy in force on the service date: ${pid}.`,
      `The chart we have doesn't show the rules below are met. If your notes dated on or before ${fmtDate(d.dos)} document them, please send those notes.`,
      "Send only notes written at the time of care; do not add or amend entries after the fact.",
    ],
    items: documentable(ctx, blockers).map((m) => { const k = counted(m.addr); return { pid, addr: m.addr || m.criterion_id, quote: squash(m.crit.verbatim_span), count: k ? `Counted from the chart: ${k.text} · ${verdictOfCount(k.n, k.t.days).word}.` : "" }; }),
    outro: [...(dl && dl.due ? [`Appeal window closes ${fmtDate(dl.due)} (${dl.citation}).`] : []), "Synthetic case. A person reviews and sends this note."],
  };
}
function physicianNote(ctx, blockers) {
  const p = noteParts(ctx, blockers);
  return [p.title, p.intro[0], p.intro[1], "", p.intro[2], p.intro[3], "",
    ...p.items.flatMap((it, i) => [`${i + 1}. ${it.pid} · ${it.addr}: "${it.quote}"`, ...(it.count ? [`   ${it.count}`] : []), ""]),
    ...p.outro].join("\n");
}
// A held denial a dated chart note could win: Next step leads with the note itself, read-only, then its one action.
// Each quoted policy line is checked by the same citation gate as an appeal (no model) and marked when it matches.
function notePane(ctx, blockers) {
  const { run } = ctx;
  const p = noteParts(ctx, blockers);
  const { waitP, docP } = changeHtml(ctx, blockers);
  return `<article class="sheet plain note-pane">
    <header class="sheet-head"><h2>Note to the physician</h2></header>
    <p>${esc(VERDICT[run.verdict].line)}</p>
    ${docP}
    <div class="note-tray"><div class="note-paper" aria-label="Note to the physician, as it will be copied" role="document">
      <p class="np-title">${esc(p.title)}</p>
      ${p.intro.map((t) => `<p>${esc(t)}</p>`).join("")}
      <ol class="np-list">${p.items.map((it, i) => `<li><p class="np-addr">${esc(it.pid)} · ${esc(it.addr)}</p><figure class="lq"><blockquote>${esc(it.quote)}</blockquote><figcaption data-nq="${i}"><span class="faint">Checking against the fetched policy…</span></figcaption></figure>${it.count ? `<p class="np-count">${esc(it.count)}</p>` : ""}</li>`).join("")}</ol>
      ${p.outro.map((t, i) => `<p${i === p.outro.length - 1 ? ' class="np-foot"' : ""}>${esc(t)}</p>`).join("")}
    </div></div>
    <div class="note-act"><button type="button" class="btn primary" data-copy-note>${svg("copy")}<span>Copy note to physician</span></button><span class="faint">Copies the note above as plain text. You send it; Denial Auditor never contacts anyone.</span></div>
    ${waitP}
    ${blockersHtml(blockers)}
  </article>`;
}
// Run the note's quoted policy lines through the citation gate and mark each one.
async function wireNote(ctx, pane) {
  const slots = [...pane.querySelectorAll("[data-nq]")];
  if (!slots.length) return;
  const items = noteParts(ctx, ctx.matches.filter((m) => m.status === "not_met" && !offRoute(m))).items;
  const text = items.map((it) => `> ${it.quote}\n> — ${it.pid} · ${it.addr}\n`).join("\n");
  let res = null;
  try { res = await api("/api/gate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: ctx.c.id, text }) }); } catch { res = null; }
  slots.forEach((el) => {
    if (!el.isConnected) return;
    const it = items[Number(el.dataset.nq)];
    const c = res && it && res.checks.find((x) => squash(x.text) === squash(it.quote));
    el.innerHTML = !c ? `${mark("quiet", "dash", "Not checked")}<span>Couldn't reach the citation gate</span>`
      : c.status === "verified" ? `${g("tick")}<b>Verified</b><span>· matches</span>${checkAddr(c)}`
      : `${mark("neg", "cross", "Not in source")}`;
  });
}
// Not winnable: what the biller does instead, from the fixed reason-code table's own wording.
function notWinnableNext(run) {
  const parts = (run.triage.explanation || "").split(/(?<=\.)\s+/).slice(1).filter((t) => !/won't change the outcome/i.test(t));
  return parts.length ? `<h3 class="sub">What to do instead</h3><p>${esc(parts.join(" "))}</p><p class="last">Denial Auditor never contacts the patient or the payer. A person does.</p>` : "";
}
function docRequestPane(text) {
  return `<article class="sheet notes">
    <header class="sheet-head split"><h2>Documentation request to the physician</h2><button type="button" class="btn primary" data-copy-docreq>${svg("copy")}<span>Copy documentation request</span></button></header>
    <pre class="docreq">${esc(text)}</pre>
  </article>`;
}

const squash = (t) => t.replace(/\s+/g, " ").trim();
// The address a gate check points at, as an id link: "L34220 · S47" or a chart note.
function checkAddr(c) {
  if (!c || !c.address) return "";
  const a = c.address;
  if (a.startsWith("note ")) {
    const [, nid, date] = /^note (\S+)(?: · (.*))?$/.exec(a) || [];
    return `<a class="id link" href="#" data-goto="note:${esc(c.source_id || "")}" ${named(nid ? nWords(nid, date) : a)}>${nid ? `Note ${esc(nid)}` : esc(a)}</a>${date ? ` · ${esc(date)}` : ""}`;
  }
  return `<a class="id link" href="#" data-goto="${gotoFor(a) || "null"}" ${named(a.replace(/S\d+(?:\s*[–-]\s*S?\d+)?/, (x) => sWords(x)))}>${/·/.test(a) ? esc(a) : `Policy ${esc(a)}`}</a>`;
}

// Edit mode shows the letter as plain text: headings as plain lines, each quote in typographic quotes without its
// attribution line. Leaving edit mode (and every gate check and export) turns it back into the drafted
// markup, re-attaching each quote's attribution by matching its text. A quote whose words changed stays a plain
// quote, which the gate still checks.
const CITE_LINE = /^(\u2014|--)/; // a quote's attribution line starts with an em dash or "--"
function letterCodec(md) {
  const quotes = new Map(), heads = new Set();
  let block = [];
  const keep = (cite) => { const key = squash(block.filter(Boolean).join(" ")); if (key && !quotes.has(key)) quotes.set(key, { lines: block.slice(), cite }); block = []; };
  for (const raw of md.split("\n")) {
    if (raw.startsWith(">")) {
      const body = raw.replace(/^>\s?/, "");
      if (CITE_LINE.test(body)) keep(body); else block.push(body);
      continue;
    }
    if (block.length) keep("");
    const h = /^#{1,6}\s+(.*)$/.exec(raw);
    if (h) heads.add(h[1].trim());
  }
  if (block.length) keep("");
  const toPlain = (text) => {
    const out = [];
    let blk = [];
    const flush = () => { if (blk.length) { out.push(`“${squash(blk.filter(Boolean).join(" "))}”`); blk = []; } };
    for (const raw of text.split("\n")) {
      if (raw.startsWith(">")) { const body = raw.replace(/^>\s?/, ""); if (CITE_LINE.test(body)) flush(); else blk.push(body); continue; }
      flush();
      out.push(raw.replace(/^#{1,6}\s+/, ""));
    }
    flush();
    // A quote set inside a sentence ("… symptoms (" quote ") and …") joins its sentence again.
    return out.join("\n").replace(/\(\s*\n“/g, "(“").replace(/”\s*\n\s*,\s*\n“/g, "”, “").replace(/”\s*\n(?=[),.;:])/g, "”").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  };
  const toMd = (plain) => {
    const keys = [...quotes.keys()].sort((a, b) => b.length - a.length);
    let t = plain.split("\n").map((l, i, arr) => (heads.has(l.trim()) && (i === 0 || !arr[i - 1].trim()) ? `## ${l.trim()}` : l)).join("\n");
    for (const k of keys) {
      const { lines, cite } = quotes.get(k);
      t = t.split(`“${k}”`).join(`\n${lines.map((l) => (l ? `> ${l}` : ">")).join("\n")}${cite ? `\n> ${cite}` : ""}\n`);
    }
    // A line that is only a quote stays a block quote, so the gate checks it however short it is.
    t = t.split("\n").map((l) => { const m = /^\s*“([^”]+)”\s*$/.exec(l); return m ? `> ${m[1]}` : l; }).join("\n");
    return t.replace(/\n{3,}/g, "\n\n");
  };
  return { toPlain, toMd };
}

// Typeset the letter: headings, verified quotes on the blue-pencil block with their address,
// tampered quotes marked "Not in source" and struck, with what the source really says beside them.
const LONG_QUOTE = 160;
// The failing-quote mark: the negative tone, a cross and plain words. On the red tile it sits at the top-left on white.
const notInSource = (onTile) => `<span class="mark neg"${onTile ? ' style="position:absolute;left:16px;top:12px;--mk-bg:var(--sheet)"' : ""}>${g("cross")}Not in source</span>`;
function renderLetter(text, gate) {
  const checks = gate ? gate.checks : [];
  const find = (q) => checks.find((c) => squash(c.text) === squash(q));
  const blocks = [];
  let para = [], quote = [], cite = "";
  const pushPara = () => { if (para.length) { blocks.push({ t: "p", parts: [{ s: para.join(" ") }] }); para = []; } };
  const pushQuote = () => { if (quote.length) { blocks.push({ t: "q", s: quote.join("\n"), cite }); quote = []; cite = ""; } };
  for (const raw of text.split("\n")) {
    const l = raw.trimEnd();
    if (l.startsWith(">")) {
      pushPara();
      const body = l.replace(/^>\s?/, "");
      if (/^(—|--)/.test(body)) { cite = body.replace(/^(—|--)\s*/, ""); pushQuote(); }
      else if (body) quote.push(body);
      continue;
    }
    pushQuote();
    if (/^#{1,6}\s/.test(l)) { pushPara(); blocks.push({ t: "h", s: l.replace(/^#+\s*/, "") }); }
    else if (!l.trim()) pushPara();
    else para.push(l.trim());
  }
  pushQuote(); pushPara();
  // "… one month of symptoms (" + quote + ") and only if …" is one sentence: keep it one paragraph.
  const merged = [];
  for (const b of blocks) {
    const prev = merged[merged.length - 1];
    const tail = prev && prev.t === "p" ? prev.parts[prev.parts.length - 1] : null;
    if (b.t === "q" && prev && prev.t === "p" && (prev.open || (tail.s !== undefined && /\(\s*$/.test(tail.s)))) { prev.parts.push({ q: b.s, cite: b.cite }); prev.open = true; continue; }
    if (b.t === "p" && prev && prev.t === "p" && (prev.open || /^[),.;:]/.test(b.parts[0].s))) { prev.parts.push(b.parts[0]); prev.open = prev.open && !/\)/.test(b.parts[0].s); continue; }
    merged.push(b);
  }
  // Display only: a block quote whose words are already shown, whole, in an earlier block quote is not shown again
  // (the drafted text keeps it; the gate and the export still check every quote as stored).
  const seenQ = [];
  const dup = new Set(merged.filter((b) => {
    if (b.t !== "q") return false;
    const t = squash(b.s), c = find(b.s);
    const hit = (!c || c.status === "verified") && seenQ.some((x) => x.includes(t));
    seenQ.push(t);
    return hit;
  }));
  const strike = (h) => {
    checks.filter((c) => c.status !== "verified" && !c.text.includes("\n")).forEach((c) => {
      const e = esc(c.text);
      if (h.includes(e)) h = h.replace(e, `${notInSource()} <span class="struck">${e}</span>`);
    });
    return h;
  };
  const inline = (q) => {
    const c = find(q);
    if (c && c.status !== "verified") return `${notInSource()} <span class="struck">${esc(squash(q))}</span>`;
    return `“<span class="iq">${esc(squash(q))}</span>”${c ? `<span class="iq-ref">${g("tick")}${checkAddr(c)}</span>` : ""}`;
  };
  return merged.filter((b) => !dup.has(b)).map((b) => {
    if (b.t === "h") return `<h3>${esc(b.s)}</h3>`;
    if (b.t === "p") return `<p>${b.parts.map((pt) => (pt.q !== undefined ? inline(pt.q) : strike(esc(pt.s)))).join("")}</p>`;
    const c = find(b.s);
    if (!c) return `<figure class="lq"><blockquote>${esc(squash(b.s))}</blockquote><figcaption>${esc(b.cite)}</figcaption></figure>`;
    // A long verified quote folds to three lines on a phone, the whole quote one tap away (wider screens show it all).
    const long = squash(b.s).length > LONG_QUOTE;
    if (c.status === "verified") return `<figure class="lq${long ? " long" : ""}"><blockquote>${esc(squash(b.s))}</blockquote><figcaption>${long ? `<button type="button" class="link lq-more" data-lq-more aria-expanded="false">Whole quote</button>` : ""}${g("tick")}<b>Verified</b><span>· matches</span>${checkAddr(c)}</figcaption></figure>`;
    let h = `<figure class="lq bad"><blockquote>${notInSource(true)}<span class="struck">${esc(squash(b.s))}</span></blockquote>
      <figcaption>Not found in any fetched source${b.cite ? ` · claimed ${id(b.cite.split(",")[0])}` : ""}</figcaption></figure>`;
    if (c.closest) h += `<figure class="lq says"><p class="says-l">Source says</p><blockquote>${esc(c.closest.text)}</blockquote><figcaption>${g("tick")}<b>Verified</b><span>·</span>${checkAddr(c.closest)}</figcaption></figure>`;
    return h;
  }).join("");
}

function wireNext(ctx, pane) {
  const ta = pane.querySelector("#letter");
  if (!ta) return;
  const box = pane.querySelector("[data-gate]");
  const bar = pane.querySelector("[data-gate-bar]");
  const sheet = pane.querySelector("[data-letter]");
  const edit = pane.querySelector("[data-edit]");
  const help = pane.querySelector("#letter-help");
  const codec = letterCodec(ctx.run.appeal.rendered);
  // The letter as drafted markup: what the gate checks, what the sheet shows and what export saves.
  const letterMd = () => codec.toMd(ta.value);
  let timer, seq = 0, last = null;
  // Beside the letter (wide screens) the quote list is always open; below it, it folds, since the letter shows each quote.
  const wide = matchMedia("(min-width: 1101px)");
  wide.addEventListener("change", () => { const d = box.querySelector("[data-gate-list]"); if (d && wide.matches) d.open = true; }, { signal: state.board?.signal });
  edit.addEventListener("click", () => {
    const editing = edit.getAttribute("aria-pressed") !== "true";
    edit.setAttribute("aria-pressed", String(editing));
    edit.textContent = editing ? "Show letter" : "Edit text";
    ta.hidden = !editing; sheet.hidden = editing; help.hidden = !editing;
    if (editing) { ta.focus({ preventScroll: true }); ta.setSelectionRange(0, 0); ta.scrollTop = 0; }
    else sheet.innerHTML = renderLetter(letterMd(), last);
  });
  const lockedExport = (why) => `<div class="export"><button type="button" class="btn" aria-disabled="true" aria-describedby="export-why" data-export>${svg("lock")}Export locked</button><p class="why-lock" id="export-why">${why}</p></div>`;
  const openExport = `<div class="export"><button type="button" class="btn primary" data-export>${svg("download")}Export letter</button></div>`;
  const foot = `<p class="foot">A person reviews and sends this letter. Denial Auditor never submits anything.</p>`;
  // The compact bar above the letter (narrow screens): the count, the export button and who sends it.
  const barHtml = (pill, ok) => `${pill}<button type="button" class="btn${ok ? " primary" : ""}" ${ok ? "" : 'aria-disabled="true" aria-describedby="export-why"'} data-export>${svg(ok ? "download" : "lock")}${ok ? "Export letter" : "Export locked"}</button><p class="bar-foot">A person reviews and sends this letter.</p>`;
  const doExport = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([letterMd()], { type: "text/markdown" }));
    a.download = `${ctx.c.id}_reconsideration.md`; a.click(); URL.revokeObjectURL(a.href);
    if ((workAll()[ctx.c.id] || {}).status !== "sent") workSet(ctx.c.id, "exported");
    paintWork();
  };
  // The recommendation card's button is the same export, locked by the same gate.
  ctx.exportLetter = () => { if (ctx.gateOk) doExport(); };
  const syncCard = (ok) => {
    ctx.gateOk = ok;
    const b = $main.querySelector("[data-card-export]");
    if (!b) return;
    if (ok) b.removeAttribute("aria-disabled"); else b.setAttribute("aria-disabled", "true");
    b.innerHTML = `${svg(ok ? "download" : "lock")}<span>${ok ? "Export letter" : "Export locked"}</span>`;
  };
  const wireExport = (ok) => {
    syncCard(ok);
    pane.querySelectorAll("[data-export]").forEach((b) => b.addEventListener("click", (e) => {
      if (!ok || e.currentTarget.getAttribute("aria-disabled") === "true") return;
      doExport();
    }));
  };
  // After export: who sends it, and a note the biller keeps for themselves. Nothing is submitted.
  const paintWork = () => pane.querySelectorAll("[data-work]").forEach((el) => {
    const w = workAll()[ctx.c.id];
    el.innerHTML = !w ? ""
      : w.status === "sent" ? `<div class="work-line">${mark("pos", "check", workWord(w))}<button type="button" class="btn text" data-work-clear>Undo</button></div>`
      : `<div class="work-line">${mark("pos", "check", `Exported ${fmtDate(w.at)}`)}<p>Denial Auditor doesn't send it. Once you have, <button type="button" class="btn text" data-work-sent>mark it as sent by you</button>.</p></div>`;
    el.querySelector("[data-work-sent]")?.addEventListener("click", () => { workSet(ctx.c.id, "sent"); paintWork(); });
    el.querySelector("[data-work-clear]")?.addEventListener("click", () => { workSet(ctx.c.id, "exported"); paintWork(); });
    const h = $main.querySelector("[data-history]");
    if (h && ctx.hist) h.innerHTML = ctx.hist();
  });
  const paint = (g2, pending, error) => {
    if (error) {
      const pill = mark("neg", "cross", "Check failed");
      box.innerHTML = `<div class="gate-head"><h3>Citation gate</h3>${pill}</div>
        ${lockedExport("Export stays locked until the check runs.")}
        <p class="say">Couldn't check quotes: ${esc(error)}. <button type="button" class="btn text" data-recheck>Retry</button></p>${foot}`;
      bar.innerHTML = barHtml(pill, false);
      syncCard(false);
      box.querySelector("[data-recheck]").addEventListener("click", run);
      return;
    }
    if (pending || !g2) {
      const pill = mark("quiet", null, "Checking quotes…");
      box.innerHTML = `<div class="gate-head"><h3>Citation gate</h3>${pill}</div>
        ${lockedExport("Export opens once every quote has been checked.")}
        <p class="say">Every quoted line is checked against the text fetched for this case.</p>${foot}`;
      bar.innerHTML = barHtml(pill, false);
      syncCard(false);
      return;
    }
    const bad = g2.checks.filter((x) => x.status !== "verified").length, n = g2.checks.length;
    const ok = g2.ok && bad === 0;
    // A quote the letter uses twice is one check row, "used 2×". Every count, passing or failing, counts quotes
    // (distinct quoted passages); uses are named apart.
    const groups = [];
    g2.checks.forEach((x) => {
      const key = `${x.status}|${squash(x.text)}|${x.address || ""}`;
      const hit = groups.find((k) => k.key === key);
      if (hit) hit.uses += 1; else groups.push({ key, x, uses: 1 });
    });
    const uniq = groups.length, badQ = groups.filter((k) => k.x.status !== "verified").length;
    const qs = (k) => `${k} ${k === 1 ? "quote" : "quotes"}`;
    const pill = ok ? mark("ver", "tick", uniq < n ? `${uniq} quotes, ${n} uses, all match` : `${n} of ${n} quotes match`)
      : mark("neg", "cross", bad ? `Export blocked: ${qs(badQ)} not in source` : "Export blocked");
    const used = (k) => (k.uses > 1 ? `<span class="used"> · used ${k.uses}×</span>` : "");
    box.innerHTML = `<div class="gate-head"><h3>Citation gate</h3>${pill}</div>
      ${ok ? openExport + '<div data-work></div>' : lockedExport(bad ? `Fix or remove the ${badQ === 1 ? "quote" : "quotes"} marked “Not in source”, then export opens.` : "Export opens once the letter quotes the policy.")}
      <p class="say">${ok ? "Each quote matches text fetched for this case, word for word." : bad ? `${badQ} of ${qs(uniq)} ${badQ === 1 ? "doesn't" : "don't"} match the text fetched for this case.` : esc(g2.reason || "The letter can't be verified yet.")}</p>
      ${foot}
      <details class="gate-list" data-gate-list${wide.matches || !ok ? " open" : ""}><summary>${g("chevron")}Show all ${uniq} checked ${uniq === 1 ? "quote" : "quotes"}</summary>
      <ol>${groups.map((k, i) => { const x = k.x; return x.status === "verified"
        ? `<li style="--i:${i}"><span class="row">${g("tick")}<span class="q">${esc(squash(x.text))}</span></span><span class="src">matches ${checkAddr(x)}${used(k)}</span></li>`
        : `<li class="bad"><span class="row">${notInSource()}<span class="q">${esc(squash(x.text))}</span></span><span class="src">not found in any fetched source${x.closest ? ` · closest ${checkAddr(x.closest)}` : ""}${used(k)}</span></li>`; }).join("")}</ol></details>`;
    bar.innerHTML = barHtml(pill, ok) + (ok ? '<div class="bar-work" data-work></div>' : "");
    wireExport(ok);
    paintWork();
  };
  async function run() {
    const mine = ++seq;
    let g2;
    const text = letterMd();
    try { g2 = await api("/api/gate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: ctx.c.id, text }) }); }
    catch (e) { if (mine === seq) paint(null, false, e.message); return; }
    if (mine !== seq) return;
    last = g2;
    if (!sheet.hidden) sheet.innerHTML = renderLetter(text, g2);
    paint(g2, false);
  }
  sheet.addEventListener("click", (e) => {
    const more = e.target.closest("[data-lq-more]");
    if (!more) return;
    const fig = more.closest("figure"), open = !fig.classList.contains("open");
    fig.classList.toggle("open", open); more.setAttribute("aria-expanded", String(open)); more.textContent = open ? "Fold quote" : "Whole quote";
  });
  sheet.innerHTML = renderLetter(letterMd(), null);
  paint(null, true);
  ta.addEventListener("input", () => { clearTimeout(timer); paint(last, true); timer = setTimeout(run, 350); });
  run();
}

// ---------------- Run live ----------------
const LIVE_STAGES = [
  { match: "Reading the denial", title: "Read the faxed denial" },
  { match: "Triage", title: "Triage by reason code" },
  { match: "Finding the policy", title: "Find the policy in force on the service date" },
  { match: "Splitting the policy", title: "Split the policy into rules" },
  { match: "Extracting chart facts", title: "Pull verified facts from the chart" },
  { match: "Checking", title: "Check every rule against the chart" },
  { match: "Drafting", title: "Draft, critique and verify the appeal" },
  { match: "Done", title: "Recommendation" },
];
function pipelineHtml(steps, running) {
  const reached = LIVE_STAGES.map((st) => steps.findIndex((m) => m.startsWith(st.match)));
  const lastIdx = Math.max(-1, ...reached.map((r, i) => (r >= 0 ? i : -1)));
  return `<ol class="pipeline">${LIVE_STAGES.map((st, i) => {
    const msg = reached[i] >= 0 ? steps[reached[i]] : "";
    const kind = reached[i] < 0 ? (i < lastIdx ? "skip" : "wait") : (i === lastIdx && running ? "now" : "done");
    const word = { done: "Done", now: "Running", wait: "Waiting", skip: "Skipped" }[kind];
    return `<li class="${kind}"><span class="st ${kind}">${word}</span><span class="t">${esc(st.title)}</span>${msg ? `<span class="m">${esc(msg)}</span>` : kind === "skip" ? `<span class="m">Not needed for this denial</span>` : ""}</li>`;
  }).join("")}</ol>`;
}
async function liveView() {
  setNav("live");
  document.title = "Run live · Denial Auditor";
  const data = await loadCases();
  const on = data.live_enabled;
  $main.innerHTML = `
    <h1 class="page-title">Run a case live</h1>
    <p class="finding">The full pipeline on a synthetic case: Nemotron on Nebius Token Factory, Tavily for commercial policies. One to three minutes, a few cents.</p>
    <div class="live">
      <form class="panel" data-live>
        ${on ? "" : `<p class="say">Live runs are off on this deployment. The precomputed cases in the worklist are free to explore.</p>`}
        <div class="field"><label for="pc">Passcode</label><input id="pc" class="input" type="password" autocomplete="off" value="${esc(state.passcode)}" placeholder="From the Devpost testing instructions"><p class="field-err" id="pc-err" aria-live="polite" hidden></p></div>
        <div class="field"><label for="cs">Synthetic case</label><select id="cs" class="input">${data.available.map((x) => `<option value="${x}">${x.replace("case_", "Case ")}</option>`).join("")}</select></div>
        <dl class="kv" data-preview></dl>
        <button class="btn primary" type="submit" data-run ${on ? "" : 'aria-disabled="true"'}>${svg("play")}Run live</button>
        <p class="field-err" id="run-err" aria-live="polite" hidden></p>
        <p class="small">This demo allows 10 live runs in total, about $0.06 each; a spending cap stops any run that would exceed its budget.</p>
      </form>
      <section class="panel" data-progress aria-live="off">
        <div class="panel-head"><h2>Progress</h2><span data-clock>Not started</span></div>
        ${pipelineHtml([], false)}
        <p class="sr" aria-live="polite" data-announce></p>
        <div data-after></div>
      </section>
    </div>`;
  const form = $main.querySelector("[data-live]");
  const preview = () => {
    const row = data.cases.find((x) => x.id === $main.querySelector("#cs").value);
    $main.querySelector("[data-preview]").innerHTML = row
      ? `<div><dt>Patient</dt><dd>${esc(row.patient)}</dd></div><div><dt>Payer</dt><dd>${esc(payerShort(row.payer))} · ${id("CPT " + row.cpt)}</dd></div><div><dt>Precomputed</dt><dd>${verdictMark(row.verdict)}</dd></div>`
      : `<div><dt>Precomputed</dt><dd class="muted">Not precomputed. This live run is its first.</dd></div>`;
  };
  $main.querySelector("#cs").addEventListener("change", preview);
  preview();
  const pc = $main.querySelector("#pc"), pcErr = $main.querySelector("#pc-err"), runErr = $main.querySelector("#run-err");
  // A refusal before the job starts (wrong passcode, live off, daily limit) is said on the form: nothing ran.
  const formError = (el, msg) => { el.innerHTML = msg ? `${g("cross")}<span>${esc(msg)}</span>` : ""; el.hidden = !msg; };
  const clearPc = () => { pc.removeAttribute("aria-invalid"); pc.removeAttribute("aria-describedby"); formError(pcErr, ""); };
  pc.addEventListener("input", clearPc);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("[data-run]");
    if (btn.getAttribute("aria-disabled") === "true") return;
    const prog = $main.querySelector("[data-progress]");
    const clock = prog.querySelector("[data-clock]"), announce = prog.querySelector("[data-announce]"), after = prog.querySelector("[data-after]");
    state.passcode = $main.querySelector("#pc").value;
    const case_id = $main.querySelector("#cs").value;
    btn.setAttribute("aria-disabled", "true"); btn.className = "btn primary";
    after.innerHTML = "";
    clearPc(); formError(runErr, "");
    let job;
    try { job = (await api("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id, passcode: state.passcode }) })).job; }
    catch (err) {
      btn.removeAttribute("aria-disabled");
      if (err.status === 401) {
        pc.setAttribute("aria-invalid", "true"); pc.setAttribute("aria-describedby", "pc-err");
        formError(pcErr, "That passcode isn't right. It's in the Devpost testing instructions.");
        pc.focus(); pc.select();
      } else formError(runErr, `Didn't start: ${err.message}`);
      return;
    }
    const t0 = Date.now();
    const tick = setInterval(() => { clock.textContent = `Running · ${Math.round((Date.now() - t0) / 1000)} s`; }, 1000);
    let lastStep = -1;
    const poll = async () => {
      let s;
      try { s = await api(`/api/live/${job}`); } catch (err) { s = { state: "error", steps: [], error: err.message }; }
      const running = s.state === "running";
      prog.querySelector(".pipeline").outerHTML = pipelineHtml(s.steps, running);
      const reached = LIVE_STAGES.map((st) => s.steps.findIndex((m) => m.startsWith(st.match)));
      const idx = Math.max(-1, ...reached.map((r, i) => (r >= 0 ? i : -1)));
      if (idx !== lastStep && idx >= 0) { lastStep = idx; announce.textContent = `Step ${idx + 1} of ${LIVE_STAGES.length}: ${LIVE_STAGES[idx].title}`; }
      if (running) { setTimeout(poll, 1000); return; }
      clearInterval(tick);
      const secs = Math.round((Date.now() - t0) / 1000);
      clock.textContent = s.state === "done" ? `Finished in ${secs} s` : `Stopped after ${secs} s`;
      clock.classList.toggle("stopped", s.state !== "done");
      after.innerHTML = s.state === "done" ? `<a class="btn primary" href="#/case/${case_id}">Open the case</a>`
        : `<p class="flag">${mark("neg", "cross", "Stopped")}<span>${esc(s.error || "The run stopped.")}</span></p>`;
      btn.removeAttribute("aria-disabled");
      if (s.state === "done") btn.className = "btn secondary";
      state.cases = null; state.hold = null;
    };
    poll();
  });
}

// ---------------- Prior-auth checks (prevention) ----------------
// Readiness reuses the verdict colours and glyphs: ready = appeal, add docs = ask, not yet = don't appeal.
const READY = {
  ready:             { label: "Ready to submit", v: "appeal", line: "The chart meets the policy in effect on the planned date. Submit the prior-auth request.", next: "See next step" },
  add_documentation: { label: "Add documentation first", v: "doc_request", line: "A route to coverage is met, but something the policy asks for isn't in the chart yet. Ask the physician before submitting." },
  not_yet:           { label: "Not yet", v: "dont_appeal", line: "The chart, as documented, falls short of a waiting period in the policy. Submitting now would likely be denied.", next: "See the earliest date" },
  doesnt_qualify:    { label: "Doesn't qualify", v: "not_winnable", line: "The chart doesn't meet this policy, and waiting won't change that. Review the rules with the physician.", next: "See why" },
};
// A "not yet" whose earliest date is on or before the planned date only needs charting: warn tone, not red.
const chartOnly = (r, earliest, planned) => r === "not_yet" && !!earliest && earliest <= planned;
const readyAs = (r, earliest, planned) => chartOnly(r, earliest, planned)
  ? { ...READY[r], label: "Qualifies if charted", v: "doc_request", next: "See what to chart" }
  : READY[r];
const readyMark = (r, earliest, planned) => { const rd = readyAs(r, earliest, planned); return mark(VERDICT[rd.v].tone, VERDICT[rd.v].glyph, rd.label); };

async function checksView() {
  setNav("check");
  document.title = "Prior-auth checks · Denial Auditor";
  let data;
  try { data = await api("/api/checks"); }
  catch (e) { $main.innerHTML = `<h1 class="page-title">Prior-auth checks</h1>${errorBlock(`Couldn't load the requests: ${e.message}.`, true)}`; wireRetry(); return; }
  const rows = [...data.checks].sort((a, b) => a.planned_dos.localeCompare(b.planned_dos));
  // A check whose chart's MRI was later denied links to that denial, which carries the same number.
  let denied = new Set();
  try { denied = new Set((await loadCases()).cases.map((x) => x.id)); } catch {}
  const laterHtml = (r) => (denied.has(r.id) ? ` · <a class="link" href="#/case/${esc(r.id)}">Denied&nbsp;later&nbsp;→ Case&nbsp;${esc(r.id.replace("case_", ""))}</a>` : "");
  // The finding and the key both read each row's label as shown (readyAs), so "Qualifies if charted" is never counted as "Not yet".
  const kindOf = (x) => chartOnly(x.readiness, x.earliest, x.planned_dos) ? "charted" : x.readiness;
  const of = (k) => rows.filter((x) => kindOf(x) === k).sort((a, b) => (a.earliest || "").localeCompare(b.earliest || ""));
  const firstOf = (list, one, many) => list.length === 1 ? one(list[0]) : many(list.length, list[0]);
  const parts = [];
  const chartRows = of("charted"), waitRows = of("not_yet"), docRows = of("add_documentation"), noRows = of("doesnt_qualify");
  if (chartRows.length) parts.push(firstOf(chartRows,
    (x) => `${esc(x.patient)} qualifies once care through ${fmtDate(x.earliest)} is charted.`,
    (k, x) => `${k} qualify once their care is charted; the first, ${esc(x.patient)}, through ${fmtDate(x.earliest)}.`));
  if (waitRows.length) parts.push(firstOf(waitRows,
    (x) => `${esc(x.patient)} is not yet ready${x.earliest ? `; earliest ${fmtDate(x.earliest)}` : ""}.`,
    (k, x) => `${k} are not yet ready${x.earliest ? `; the earliest, ${esc(x.patient)}, on ${fmtDate(x.earliest)}` : ""}.`));
  if (docRows.length) parts.push(`${docRows.length} ${docRows.length === 1 ? "needs" : "need"} documentation first.`);
  if (noRows.length) parts.push(`${noRows.length} ${noRows.length === 1 ? "doesn't" : "don't"} qualify.`);
  const findingText = rows.length
    ? [`${of("ready").length} of ${rows.length} requests are ready to submit.`, ...parts].join(" ")
    : "No prior-auth checks yet.";
  // The key lists only the labels on this list, in the order a biller acts on them.
  const KEY = [
    ["ready", "Every rule that matters is met by the chart on the planned date. Submit the request."],
    ["charted", "The waiting period is reached by the planned date, but the chart stops short of it. Once the care is charted through the date shown, the request qualifies. Its waiting-period rules read “Met once charted”."],
    ["add_documentation", "A route to coverage is met, but a rule the policy asks for isn't in the chart. Copy the request to the physician."],
    ["not_yet", "A waiting period isn't met by the planned date. The earliest date it is, worked out in code from the chart's own dates, is shown."],
    ["doesnt_qualify", "The chart doesn't meet the policy and waiting won't change that."],
  ].filter(([k]) => of(k).length);
  const keyMark = (k) => { const x = of(k)[0]; return readyMark(x.readiness, x.earliest, x.planned_dos); };
  const polId = (p) => (p || "").split(",")[0].replace(/^Aetna /, "").replace(/ snapshot.*/, "");
  $main.innerHTML = `
    <h1 class="page-title">Prior-auth checks</h1>
    <p class="finding">${findingText}</p>
    <table class="list">
      <thead><tr>
        <th scope="col" style="width:14%">Planned MRI</th>
        <th scope="col" style="width:34%">Patient</th>
        <th scope="col" style="width:22%">Readiness</th>
        <th scope="col" class="r earl" style="width:14%">Earliest date</th>
        <th scope="col" class="pol" style="width:16%">Policy</th>
      </tr></thead>
      <tbody>${rows.length ? rows.map((r) => `<tr>
        <td class="due"><span class="fig">${fmtDate(r.planned_dos)}</span></td>
        <td class="who">${avatar(r.patient)}<a class="l1" href="#/check/${r.id}">${esc(r.patient)}</a><span class="l2">${esc(payerShort(r.payer))} · ${id("CPT " + r.cpt)} · ${id(r.id.replace("case_", "Chart "))}${laterHtml(r)}</span></td>
        <td class="rec">${readyMark(r.readiness, r.earliest, r.planned_dos)}</td>
        <td class="earl r">${r.earliest ? fmtDate(r.earliest) : '<span class="faint">—</span>'}</td>
        <td class="pol"><span class="faint">${r.policy ? id(polId(r.policy)) : ""}</span></td>
        <td class="stack">${r.earliest ? `Earliest ${fmtDate(r.earliest)} · ` : ""}${r.policy ? id(polId(r.policy)) : ""}</td>
      </tr>`).join("") : `<tr><td colspan="5" class="empty">No prior-auth checks yet.</td></tr>`}</tbody>
    </table>
    ${KEY.length ? `<h2 class="sec key-h">What the readiness labels mean</h2>
    <dl class="key">${KEY.map(([k, d]) => `
      <div><dt>${keyMark(k)}</dt><dd>${d}</dd></div>`).join("")}
    </dl>` : ""}`;
}

// Why-line for a check. With an earliest date it says what the wait is and what to chart, from the code's own basis.
function checkLine(ch) {
  const rd = READY[ch.readiness];
  if (!ch.earliest) return rd.line;
  const b = (ch.earliest_basis || [])[0] || "";
  const need = (/^([^:]+):/.exec(b) || [])[1];
  const thru = (/continues from (\d{2}\/\d{2}\/\d{4})/.exec(b) || [])[1];
  const got = (/(\d+ of \d+ days) documented/.exec(b) || [])[1];
  const planned = fmtDate(ch.request.planned_dos), on = fmtDate(ch.earliest);
  const head = need ? `The policy needs ${need}${thru ? `; the chart documents care through ${thru}${got ? ` (${got})` : ""}` : ""}. ` : "The chart doesn't yet document the policy's waiting period. ";
  return ch.earliest <= ch.request.planned_dos
    ? `${head}If care continues and is charted through ${on}, the ${planned} request qualifies.`
    : `${head}The wait is reached on ${on}, after the planned ${planned}: move the MRI to that date or later.`;
}

async function checkView(checkId) {
  setNav("check");
  $main.innerHTML = caseSkeleton();
  let c;
  try { c = await api(`/api/checks/${encodeURIComponent(checkId)}`); }
  catch (e) { $main.innerHTML = `<div class="err-block"><span>Couldn't load this request: ${esc(e.message)}.</span><a class="link" href="#/check">Back to Prior-auth checks</a></div>`; return; }
  const ch = c.check, r = ch.request, rd = readyAs(ch.readiness, ch.earliest, r.planned_dos);
  const rep = await drift();
  document.title = `${c.patient} · Prior-auth checks · Denial Auditor`;
  // The same chart's denial, if the MRI went ahead and the claim was denied.
  let den = null;
  try { den = (await loadCases()).cases.find((x) => x.id === c.id) || null; } catch {}
  const denEarly = den && den.verdict === "dont_appeal" ? (await holdFor(den.id)).early : null;
  const linked = den ? `MRI done ${fmtDate(den.dos)}, claim denied · ${verdictMark(den.verdict, denEarly)} · <a class="link" href="#/case/${esc(den.id)}">Open the denial (${esc(den.id.replace("case_", "Case "))}, the same chart)</a>` : "";
  // The board renderers take a run; a check is shaped like one with the planned date as the service date.
  const run = { ...ch, denial: { dos: r.planned_dos, carc: [] }, triage: { route: "clinical_review", checklist: [] }, appeal: null, verdict: READY[ch.readiness].v };
  // Ready, or qualifies once the wait is charted: the other, unmet routes are alternatives, not blockers.
  const routeOk = ch.readiness === "ready" || chartOnly(ch.readiness, ch.earliest, r.planned_dos);
  BOARD = { thresholds: c.thresholds || [], facts: ch.facts || null, dos: r.planned_dos, alt: null, earliest: chartOnly(ch.readiness, ch.earliest, r.planned_dos) ? ch.earliest : null };
  const matches = prepMatches(run, c, routeOk);
  NOTE_DATES = Object.fromEntries(c.notes.map((n) => [n.note_id, n.date]));
  // One primary action at all times: open Next step, then copy it for the request file.
  const copyReq = `<button type="button" class="btn primary" data-primary data-copy-docreq>${svg("copy")}<span>Copy documentation request</span></button>`;
  const card = ch.doc_request ? { before: copyReq, after: copyReq }
    : { before: `<button type="button" class="btn primary" data-primary data-tab-go="next"><span>${esc(rd.next)}</span></button>`, after: `<button type="button" class="btn primary" data-primary data-copy-plain>${svg("copy")}<span>Copy next step</span></button>` };
  const docTabs = [["policy", "Policy", "Policy"], ["chart", "Chart notes", "Chart"], ["next", ch.doc_request ? "Documentation request" : "Next step", ch.doc_request ? "Request" : "Next"]];
  let dateCell;
  const before = ch.earliest && ch.earliest <= r.planned_dos;
  if (ch.earliest) {
    const gap = days(r.planned_dos, ch.earliest);
    const note = gap <= 0
      ? `Planned ${fmtDate(r.planned_dos)} · ${gap === 0 ? "no margin" : `${-gap} ${gap === -1 ? "day" : "days"} of margin`}`
      : `${gap} days after the planned ${fmtDate(r.planned_dos)}: move the MRI to this date or later`;
    dateCell = `<div class="deadline"><p class="rowa"><span class="fig">${fmtDate(ch.earliest)}</span><small>${before ? "chart the care through this date" : "earliest date"}</small></p><p class="rowc"><span>${note}</span></p><p class="rowd">Worked out in code from verified chart dates. Checked as of the planned date, before the request went out.</p></div>`;
  } else {
    dateCell = `<div class="deadline"><p class="rowa"><span class="fig">${fmtDate(r.planned_dos)}</span><small>planned MRI</small></p><p class="rowc"><span>${ch.policy ? `Meets ${id(policyId(ch.policy))}${snap(ch.policy) ? "" : ", the policy in effect on this date"}.` : ""}</span></p><p class="rowd">Checked as of the planned date, before the request went out.</p></div>`;
  }
  $main.innerHTML = `
    <nav class="crumb" aria-label="Breadcrumb"><a class="link" href="#/check">Prior-auth checks</a><span class="sep">/</span>${avatar(c.patient)}<h1>${esc(c.patient)}</h1>${id(c.id.replace("case_", "Chart "))}</nav>
    <section class="vline" aria-label="Readiness">
      <div class="box"><span class="fl" aria-hidden="true"><b>1</b>Readiness</span><p class="answer v-${rd.v}"><span class="sr">Readiness: </span>${g(VERDICT[rd.v].glyph)}${esc(rd.label)}</p></div>
      <div class="box"><span class="fl" aria-hidden="true"><b>2</b>${before ? "Qualifies on" : ch.earliest ? "Earliest date" : "Planned MRI"}</span>${dateCell}</div>
      <div class="box box-act" data-act><div class="actions" data-card>${card.before}</div></div>
    </section>
    <p class="why-line">${esc(checkLine(ch))}</p>
    ${regionSwitch(docTabs, "Rules")}
    ${factsDl([
      policyFact(ch.policy, r.planned_dos),
      ["Plan · request", `${esc(payerPlan(r.payer_name, r.plan_type))} · Lumbar MRI · ${id("CPT " + r.cpt)} · Planned ${fmtDate(r.planned_dos)}`],
      den && ["After this check", linked],
      ["Policy watch", driftWords(rep, c.id, "prior_auth")],
      (run.trace || []).length && ["Model calls", `<a class="link" href="#audit" data-open-audit>Model calls and cost ↓</a>`],
    ])}
    ${coverageHtml(run, matches)}
    <div class="workspace">
      <aside class="ledger" aria-label="Policy rules for this request">
        ${rulesHtml(matches, "check")}
      </aside>
      <section aria-label="Documents">
        <div class="tabs" role="tablist" aria-label="Documents">
          ${docTabs.map(([k, long], i) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${i === 0}">${long}</button>`).join("")}
        </div>
        <div data-pane></div>
      </section>
    </div>
    ${auditHtml(run, matches, c)}`;
  wireWorkspace({ c, run, matches, selected: null, mriLabel: "Planned MRI", card, plain: () => checkPlain(c, run, matches) }, { policy: policyPane, chart: chartPane, next: checkNextPane });
}

// The check's next step as plain text, for the request file: readiness, the line, the earliest date and each unmet rule.
function checkPlain(c, run, matches) {
  const r = run.request, rd = readyAs(run.readiness, run.earliest, r.planned_dos);
  const blockers = matches.filter((m) => m.status === "not_met" && !offRoute(m));
  return [`Prior-auth check · ${c.patient} · ${c.id.replace("case_", "Chart ")} · planned ${fmtDate(r.planned_dos)}`, `${rd.label}. ${checkLine(run)}`,
    ...(run.earliest ? [`Earliest date the chart can meet the policy: ${fmtDate(run.earliest)} (worked out in code from the chart's dates).`] : []),
    ...(run.earliest_basis || []),
    ...blockers.map((m) => `Not met · ${m.addr || m.criterion_id}: "${squash(m.crit.verbatim_span)}"`),
    "Synthetic case. A person reviews and sends every request."].join("\n");
}
function checkNextPane(ctx) {
  const { run, matches } = ctx;
  const rd = readyAs(run.readiness, run.earliest, run.request.planned_dos);
  if (run.doc_request) return docRequestPane(run.doc_request);
  const blockers = matches.filter((m) => m.status === "not_met" && !offRoute(m));
  const before = run.earliest && run.earliest <= run.request.planned_dos;
  return `<article class="sheet plain">
    <header class="sheet-head"><h2>${esc(rd.label)}</h2></header>
    <p>${esc(checkLine(run))}</p>
    ${run.earliest ? `<p>Earliest date the chart can meet the policy: <b>${fmtDate(run.earliest)}</b>. ${before
      ? `That's on or before the planned date. Keep the date, and chart the conservative care through ${fmtDate(run.earliest)}.`
      : "Move the MRI to that date or later."} Re-check the chart before submitting.</p>` : ""}
    ${run.earliest_basis && run.earliest_basis.length ? `<h3 class="sub">How the earliest date is worked out</h3>${run.earliest_basis.map((b) => `<p class="muted">${esc(b)}</p>`).join("")}` : ""}
    ${blockersHtml(blockers)}
    <p class="last">Denial Auditor never submits anything. A person reviews and sends every request.</p>
  </article>`;
}

// ---------------- How it works ----------------
function howView() {
  setNav("how");
  document.title = "How it works · Denial Auditor";
  $main.innerHTML = `<div class="how"><article class="read">
    <h1 class="page-title">How Denial Auditor works</h1>
    <p class="lede">Payers check an MRI order criterion by criterion. Denial Auditor lets a three-doctor practice do the same, and shows its working.</p>
    <h2>From a faxed denial to a decision</h2>
    <ol>
      <li><b>Read the denial.</b> Nemotron 3.5 Super-VL reads the scanned notice into structured fields: payer, codes, dates, the stated reason.</li>
      <li><b>Triage.</b> Reason codes route administrative denials to a fix checklist and plan exclusions to “not winnable”, using a fixed table and no model.</li>
      <li><b>Find the policy in force on the date of service.</b> Medicare coverage policies come from the CMS Coverage API, which keeps every version with its effective dates. Commercial bulletins such as Aetna's are located with a Tavily search at runtime when the bulletin's address isn't known yet (it is cached after the first lookup), then fetched from the payer's site.</li>
      <li><b>Split the policy into rules.</b> Code numbers every sentence of the fetched policy; Nemotron 3 Super only picks sentence numbers. So each rule card leads with the payer's own sentence, cut from the source, with its sentence number; the line under it marked “In short” is Nemotron's summary, and the sentence is the rule.</li>
      <li><b>Check each rule against the chart.</b> Two Nemotron 3 Super votes judge whether each rule supports coverage, blocks it, doesn't apply, or isn't documented, and quote the chart; Nemotron 3 Ultra decides when they split. Code verifies every quote and computes every duration from dates.</li>
      <li><b>Decide.</b> A fixed rule, not a model, turns those judgments into one recommendation: appeal, ask the physician, don't appeal yet, fix and resubmit, or not winnable. Where a dated chart note could change the answer, it drafts the note to the physician in the policy's own words. <span data-note-see><a class="link" data-note-link href="#/case/case_009?tab=next">Read Emerson Specimen's note to the physician →</a></span></li>
      <li><b>Write the appeal.</b> Nemotron 3 Ultra drafts the letter using only pre-verified quotes, Super critiques it as the payer's medical reviewer, and Ultra revises. The citation gate blocks export unless every quote matches its source word for word.</li>
    </ol>
    <h2>Measured on synthetic cases</h2>
    <ul>
      <li><b>30 of 30</b> recommendations match the ground truth, 24 of 24 on the clinical cases (synthetic cases, n = 30).</li>
      <li><b>7 of 7</b> gold rules found when splitting Medicare L34220, in 3 of 3 runs; <b>138 of 138</b> gold rule statuses right (synthetic cases, n = 30).</li>
      <li><b>$0.048</b> and <b>72 s</b> per case on average, every model call included (synthetic cases, n = 30).</li>
    </ul>
    <p>The cases and their ground truth are ours, so these figures show the pipeline is consistent on situations we designed, not how it does on real charts.</p>
    <h2>Before a request goes out</h2>
    <p><b>Prior-auth checks</b> run the same steps on a prior-auth request, using the policy version in effect on the planned date. If the chart falls short of a waiting period, such as four weeks of conservative care, code works out the earliest date it's met from the chart's own dates. No model guesses a date.</p>
    <h2>When a policy changes</h2>
    <p>The <b>policy watch</b> runs every night beside the app and calls no model. It compares each open case's cited policy with the live source: a newer CMS version, or changed text in the Aetna bulletin. It flags only the cases whose service date the change covers, and names the rules whose wording moved.</p>
    <h2>What it never does</h2>
    <p>It never submits anything; a person reviews and sends every letter. Deadlines come from a fixed table checked against federal regulations, never from a model. CPT codes are shown bare, without AMA descriptions. All patients and notices in this demo are synthetic.</p>
  </article>
  <aside class="sources" aria-label="Models and sources">
    <h2>Models and sources</h2>
    <p class="cap">Who decides each step: ${gi("check")} Code · ${gi("chip")} Model, then code or you · ${gi("person")} You</p>
    <dl class="kv">
      <div><dt>Read the letter</dt><dd>Nemotron 3.5 Super-VL<br><span class="faint">${gi("chip")} Model, then you</span></dd></div>
      <div><dt>Triage</dt><dd>Reason-code table, no model<br><span class="faint">${gi("check")} Code</span></dd></div>
      <div><dt>Medicare policy</dt><dd>CMS Coverage API, versioned by date<br><span class="faint">${gi("check")} Code</span></dd></div>
      <div><dt>Aetna policy</dt><dd>Tavily search for the address (cached), then aetna.com<br><span class="faint">${gi("check")} Code</span></dd></div>
      <div><dt>Split into rules</dt><dd>Nemotron 3 Super picks sentence ids<br><span class="faint">${gi("chip")} Model, then code</span></dd></div>
      <div><dt>Chart facts</dt><dd>Nemotron 3 Nano, quotes checked in code<br><span class="faint">${gi("chip")} Model, then code</span></dd></div>
      <div><dt>Rule vs chart</dt><dd>2 Nemotron 3 Super votes; Ultra on a split<br><span class="faint">${gi("chip")} Model, then code</span></dd></div>
      <div><dt>Recommendation</dt><dd>Fixed rule, no model<br><span class="faint">${gi("check")} Code</span></dd></div>
      <div><dt>Appeal letter</dt><dd>Ultra drafts, Super critiques, Ultra revises<br><span class="faint">${gi("chip")} Model, then code</span></dd></div>
      <div><dt>Citation gate</dt><dd>Exact match in code<br><span class="faint">${gi("check")} Code</span></dd></div>
      <div><dt>Send the appeal</dt><dd>A person, never the tool<br><span class="faint">${gi("person")} You</span></dd></div>
      <div><dt>Deadlines</dt><dd>Fixed table from eCFR, no model<br><span class="faint">${gi("check")} Code</span></dd></div>
    </dl>
    <p class="cap">Every model runs on Nebius Token Factory; each case's calls and cost are listed under "Model calls and cost".</p>
  </aside></div>`;
  // The note link points at whichever held denial actually carries one, worked out from the loaded runs.
  noteCase().then((n) => {
    const a = $main.querySelector("[data-note-link]");
    if (!a) return;
    if (!n) { $main.querySelector("[data-note-see]")?.remove(); return; }
    a.href = `#/case/${n.id}?tab=next`; a.textContent = `Read ${n.patient}'s note to the physician →`;
  });
}

// ---------------- Router ----------------
async function route() {
  const [path, query = ""] = location.hash.split("?");
  const [, view, rid] = path.split("/");
  const tab = new URLSearchParams(query).get("tab");
  state.board?.abort();
  delete $main.dataset.region;
  try {
    if (view === "case") await caseView(rid, tab);
    else if (view === "live") await liveView();
    else if (view === "how") howView();
    else if (view === "check") await (rid ? checkView(rid) : checksView());
    else await worklist();
  } catch (e) {
    $main.innerHTML = `<div class="err-block"><span>Something went wrong loading this page: ${esc(e.message)}.</span><button type="button" class="btn text" data-retry>Retry</button></div>`;
    wireRetry();
  }
  fillShell();
  $main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  // A worklist "Next step" link opens that tab; on one-column screens, bring the documents into view.
  if (view === "case" && tab && matchMedia("(max-width: 1100px)").matches) {
    const phone = matchMedia("(max-width: 640px)").matches;
    $main.querySelector(phone ? ".region-switch" : '[role="tablist"][aria-label="Documents"]')?.scrollIntoView({ block: "start" });
  }
}
addEventListener("hashchange", route);
route();
