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
  tick: '<path d="M4 12.5l3.5 3.5L14 9.5M15.5 16h4.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  play: '<path d="M8 5.5l10 6.5-10 6.5z"/>',
};
const g = (name) => `<span class="glyph" aria-hidden="true"><svg viewBox="0 0 24 24">${GLYPH[name]}</svg></span>`;
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPH[name]}</svg>`;

const VERDICT = {
  appeal:        { label: "Appeal", tone: "pos", glyph: "check", line: "The chart meets the policy in effect on the date of service. Review the drafted letter and send it." },
  doc_request:   { label: "Ask the physician", tone: "warn", glyph: "half", line: "Winnable once the missing documentation is added to the chart." },
  dont_appeal:   { label: "Don't appeal yet", tone: "neg", glyph: "pause", line: "The chart doesn't meet the policy yet. Appealing now would likely fail." },
  fix_checklist: { label: "Fix & resubmit", tone: "fill", glyph: "return", line: "Administrative denial: correct the claim. No clinical appeal is needed." },
  not_winnable:  { label: "Not winnable", tone: "quiet", glyph: "slash", line: "The plan excludes this service. Medical-necessity evidence won't change the outcome." },
};
const ORDER = ["appeal", "doc_request", "fix_checklist", "dont_appeal", "not_winnable"];
const ACTIONABLE = new Set(["appeal", "doc_request", "fix_checklist"]);
const NEXT = { appeal: "Review appeal", dont_appeal: "See what's missing", fix_checklist: "Open the fix checklist", not_winnable: "See why", doc_request: "See the request" };
const STATUS = {
  met: { tone: "pos", glyph: "check", label: "Supports" },
  not_met: { tone: "neg", glyph: "cross", label: "Blocks" },
  missing_documentation: { tone: "warn", glyph: "half", label: "Missing docs" },
  not_applicable: { tone: "quiet", glyph: "dash", label: "Not applicable" },
  route: { tone: "quiet", glyph: "dash", label: "Route not used" },
};
const EMPTY = {
  appeal: "No denials are ready to appeal.", doc_request: "No denials are waiting on a physician's note.",
  fix_checklist: "No denials need a claim fix.", dont_appeal: "No denials are on hold.", not_winnable: "No denials are closed as not winnable.",
};
const CONF = {
  agreed: "2 of 2 Nemotron Super votes agree",
  escalated: "Super votes split; Nemotron Ultra decided",
  single: "One Nemotron judgment",
  rule: "Decided by a fixed rule, no model",
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtDate = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.slice(0, 10).split("-"); return `${m}/${d}/${y}`; };
const id = (s) => `<span class="id">${esc(s)}</span>`;
const payerShort = (p) => p.replace(/ \((synthetic[^)]*)\)/i, "").replace(/\bMedicare Advantage\b/, "MA").replace(/\s+(Health )?Plan$/, "");
const PLAN = { MA: "MA", MEDICARE_FFS: "Medicare", COMMERCIAL_ACA: "Commercial (ACA)", COMMERCIAL_ERISA: "Commercial (ERISA)", MEDICAID: "Medicaid", UNKNOWN: "Plan type unknown" };
const payerPlan = (payer, plan) => { const p = payerShort(payer), t = PLAN[plan] || plan; return p.endsWith(t) ? p : `${p} · ${t}`; };
const policyId = (p) => (p.version_basis === "api-versioned" ? `${p.policy_id} v${p.version}` : p.policy_id.replace(/^Aetna /, ""));
const noteShort = (nid) => nid.split("-").pop();
const sAddr = (addr) => (addr || "").replace(/^.*·\s*/, "");
const gotoFor = (addr) => { const m = /S(\d+)/.exec(addr || ""); return m ? `policy:${m[1]}` : null; };
const days = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
let NOTE_DATES = {};

function mark(tone, glyph, label) { return `<span class="mark ${tone}">${glyph ? g(glyph) : ""}${esc(label)}</span>`; }
const statusMark = (key) => { const s = STATUS[key]; return mark(s.tone, s.glyph, s.label); };
const verdictMark = (v) => mark(VERDICT[v].tone, VERDICT[v].glyph, VERDICT[v].label);

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok) {
    let msg = `${r.status}`;
    try { msg = (await r.json()).detail || msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

// A case belongs to the worklist; a prior-auth check to Before you submit.
function setNav(name) {
  const current = name === "case" ? "worklist" : name;
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === current) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

// ---------------- Shell: open-denial count and the policy watch stamp ----------------
async function loadCases() { return state.cases || (state.cases = await api("/api/cases")); }
async function drift() {
  if (!state.drift) { try { state.drift = await api("/api/drift"); } catch { state.drift = { checked_at: null, items: [] }; } }
  return state.drift;
}
const watchedAt = (iso) => `${fmtDate(iso.slice(0, 10))} ${iso.slice(11, 16)} UTC`;
function watchHtml(rep) {
  if (!rep.checked_at) return "";
  const hit = rep.items.filter((i) => i.affects_case).length;
  const ids = [...new Set(rep.items.map((i) => i.policy_id))].join(", ");
  return `<span title="${esc(ids)}">Policy watch ${watchedAt(rep.checked_at)}</span> · ${hit
    ? `<span class="warn">${hit} open item${hit > 1 ? "s" : ""} affected</span> by a policy change`
    : "no open item affected"}`;
}
async function fillShell() {
  try {
    const data = await loadCases();
    const n = document.querySelector("[data-count]");
    if (n) n.textContent = data.cases.length;
  } catch {}
  const w = document.querySelector("[data-watch]");
  if (w) w.innerHTML = watchHtml(await drift());
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
  const rows = [...data.cases].sort((a, b) => (a.days_left ?? Infinity) - (b.days_left ?? Infinity) || ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  const count = (v) => rows.filter((r) => v === "all" || r.verdict === v).length;
  const shown = rows.filter((r) => state.filter === "all" || r.verdict === state.filter);
  const tabs = ["all", ...ORDER].map((v) => `<button type="button" role="tab" data-f="${v}" aria-selected="${state.filter === v}">${v === "all" ? "All" : VERDICT[v].label}<span class="n">${count(v)}</span></button>`).join("");
  const countLine = state.filter === "all" ? `${rows.length} denials · sorted by days left` : `${shown.length} of ${rows.length} denials · ${esc(VERDICT[state.filter].label)}`;

  $main.innerHTML = `
    <h1 class="page-title">Denials to work</h1>
    <p class="finding">${finding(rows, data.as_of)}</p>
    <p class="phone-only">${watchHtml(rep)}</p>
    <div class="filters">
      <div class="tabs" role="tablist" aria-label="Filter by recommendation">${tabs}</div>
      <span class="count">${countLine}</span>
    </div>
    <table class="list">
      <thead><tr>
        <th scope="col" class="r" style="width:10%">Due</th>
        <th scope="col" style="width:33%">Patient</th>
        <th scope="col" style="width:16%">Recommendation</th>
        <th scope="col" class="r dos" style="width:10%">Service date</th>
        <th scope="col" class="reason" style="width:31%">Payer's reason</th>
      </tr></thead>
      <tbody>${shown.length ? shown.map(rowHtml).join("") : `<tr><td colspan="5" class="empty">${esc(EMPTY[state.filter] || "No denials.")}</td></tr>`}</tbody>
    </table>`;
  $main.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { state.filter = b.dataset.f; worklist(); }));
}

// The worklist's one sentence: the finding, computed from the rows.
function finding(rows, asOf) {
  const soonest = (v) => rows.find((r) => r.verdict === v && r.days_left != null);
  const tail = (r) => r.days_left < 0
    ? `was due ${fmtDate(r.due)}, ${-r.days_left} days before the ${fmtDate(asOf)} review date`
    : `is due ${fmtDate(r.due)}, ${r.days_left} days after the ${fmtDate(asOf)} review date`;
  const appeal = soonest("appeal"), ask = soonest("doc_request");
  if (appeal) return `${rows.filter((r) => r.verdict === "appeal").length} ready to appeal. The soonest, ${esc(appeal.patient)}, ${tail(appeal)}.`;
  if (ask) return `${rows.filter((r) => r.verdict === "doc_request").length} waiting on the physician. The soonest, ${esc(ask.patient)}, ${tail(ask)}.`;
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
function rowHtml(r) {
  const st = dueState(r.verdict, r.days_left);
  const fig = r.days_left == null ? `<span class="l2 muted">Check the notice</span>`
    : `<span class="fig"><b>${r.days_left < 0 ? "−" + -r.days_left : r.days_left}</b> <small>days</small></span>
       <span class="l2">${r.days_left < 0 ? "overdue · " : st === "soon" ? "due soon · " : ""}${fmtDate(r.due)}</span>`;
  return `<tr>
    <td class="due r ${st}">${fig}</td>
    <td class="who"><a class="l1" href="#/case/${r.id}">${esc(r.patient)}</a>
      <span class="l2">${esc(payerShort(r.payer))} · ${id("CPT " + r.cpt)}<span class="tablet-only"> · DOS ${fmtDate(r.dos)}</span>${r.live ? " · live run" : ""}</span></td>
    <td class="rec">${verdictMark(r.verdict)}</td>
    <td class="dos r">${fmtDate(r.dos)}</td>
    <td class="reason" title="${esc(r.reason)}">${esc(r.reason)}</td>
    <td class="stack">DOS ${fmtDate(r.dos)} · ${esc(r.reason)}</td>
  </tr>`;
}

// ---------------- Case ----------------
async function caseView(caseId) {
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
  NOTE_DATES = Object.fromEntries(c.notes.map((n) => [n.note_id, n.date]));
  const matches = prepMatches(run, c, run.verdict === "appeal");
  const primary = run.doc_request
    ? `<button type="button" class="btn primary" data-primary data-copy-docreq>${svg("copy")}<span>Copy documentation request</span></button>`
    : `<button type="button" class="btn primary" data-primary data-tab-go="next">${NEXT[run.verdict]}</button>`;

  $main.innerHTML = `
    <nav class="crumb" aria-label="Breadcrumb"><a class="link" href="#/worklist">Worklist</a><span class="sep">/</span><h1>${esc(c.patient)}</h1>${id(c.id.replace("case_", "Case "))}</nav>
    <section class="vline" aria-label="Recommendation and deadline">
      <p class="answer v-${run.verdict}"><span class="sr">Recommendation: </span>${g(v.glyph)}${esc(v.label)}</p>
      ${deadlineCell(run.verdict, c.deadline, d.notice_date, c.as_of)}
      <div class="actions">${primary}</div>
    </section>
    <p class="why-line">${esc(v.line)}</p>
    <p class="meta">${esc(payerPlan(d.payer_name, d.plan_type))} · Lumbar MRI · ${id("CPT " + d.cpt)} · Service ${fmtDate(d.dos)}</p>
    ${driftFlag(rep, c.id, "denial")}
    ${coverageHtml(run, matches)}
    <div class="workspace">
      <aside class="ledger" aria-label="Policy rules for this case">
        <dl class="kv">
          <div><dt>Payer's reason</dt><dd>${esc(d.reason_text)}${d.carc.length ? ` ${id("CARC " + d.carc.join(", "))}` : ""}</dd></div>
          ${run.policy ? `<div><dt>Policy on ${fmtDate(d.dos)}</dt><dd>${esc(shortTitle(run.policy))} · ${id(policyId(run.policy))} · <a class="link" href="${esc(run.policy.url)}" target="_blank" rel="noopener">source</a></dd></div>` : ""}
        </dl>
        ${run.verdict === "fix_checklist" && run.triage.checklist.length ? `<h2 class="sec">What to fix</h2><ol class="fixlist">${run.triage.checklist.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>` : ""}
        ${rulesHtml(matches, "case")}
      </aside>
      <section aria-label="Documents">
        <div class="tabs" role="tablist" aria-label="Documents">
          ${run.policy ? `<button type="button" role="tab" data-tab="policy" aria-selected="true">Policy</button>` : ""}
          <button type="button" role="tab" data-tab="chart" aria-selected="${run.policy ? "false" : "true"}">Chart notes</button>
          <button type="button" role="tab" data-tab="letter" aria-selected="false">Denial letter</button>
          <button type="button" role="tab" data-tab="next" aria-selected="false">${run.appeal ? "Appeal letter" : run.doc_request ? "Documentation request" : "Next step"}</button>
        </div>
        <div data-pane></div>
      </section>
    </div>
    ${auditHtml(run, matches)}`;

  wireWorkspace({ c, run, matches, selected: null, mriLabel: "MRI" }, { policy: policyPane, chart: chartPane, letter: letterPane, next: nextPane });
}

function caseSkeleton() {
  return `${sk(240, 16)}<div class="vline">${sk(180, 28)}${sk(64, 28)}${sk(360, 4)}<span class="actions">${sk(140, 36, true)}</span></div>
    <div style="height:12px"></div>${sk(520, 14)}<div class="coverage">${sk(480, 14)}</div>
    <div class="workspace"><div>${sk(400, 96)}<div style="height:24px"></div>${sk(400, 72)}</div><div>${sk(720, 480)}</div></div>`;
}

// Matches with their criterion, address and the status they show (an unused route reads "Route not used").
function prepMatches(run, c, routeMet) {
  const byId = Object.fromEntries(run.criteria.map((x) => [x.criterion_id, x]));
  const seen = {};
  run.criteria.forEach((x) => { seen[x.summary] = (seen[x.summary] || 0) + 1; });
  const firstSentence = (t) => { const m = /^[\s\S]{20,220}?[.;:](\s|$)/.exec(t.trim()); return (m ? m[0] : t.slice(0, 200)).trim(); };
  return run.matches.map((m) => {
    const crit = byId[m.criterion_id];
    const show = m.status === "not_met" && crit.kind === "indication" && routeMet ? "route" : m.status;
    const summary = seen[crit.summary] > 1 ? firstSentence(crit.verbatim_span) : crit.summary;
    return { ...m, crit, summary, addr: c.addresses[m.criterion_id], show };
  });
}

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
    <div class="runway" role="img" aria-label="Appeal window: ${used} of ${total} days used, ${Math.max(left, 0)} left"><i style="width:${share.toFixed(1)}%"></i>${left < 0 ? '<span class="late-tick"></span>' : ""}</div>
    <p class="rowc"><span>Notice ${fmtDate(notice)}</span><span>Due ${fmtDate(dl.due)}</span></p>
    <p class="rowd"><span>${esc(dl.citation)} ·</span> <span>fixed deadline table ·</span> <span>as of ${fmtDate(asOf)}${dl.verified ? "" : " ·"}</span>${dl.verified ? "" : " <span>unverified</span>"}</p>
  </div>`;
}

function driftFlag(rep, caseId, kind) {
  const i = rep.items.find((x) => x.case_id === caseId && x.kind === kind);
  if (!i || i.status === "current" || i.status === "error") return "";
  const rules = i.changed_rules.length ? ` Changed wording: ${i.changed_rules.map((r) => esc(r.summary)).join("; ")}.` : "";
  return `<p class="flag">${mark("warn", "half", "Policy changed")}<span>${esc(i.policy_id)} ${esc(i.cited)} → ${esc(i.current)}. ${esc(i.note)}${rules}</span></p>`;
}

const shortTitle = (p) => (p.title.length <= 40 ? p.title : p.title.replace(/\s*\([^)]*\)/g, ""));

// ---------- The coverage path: the payer's decision order, one ruled row ----------
const STAGES = [
  { key: "routes", title: "Route to coverage", kinds: ["indication", "red_flag"] },
  { key: "waits", title: "Waiting periods", kinds: ["duration"] },
  { key: "limits", title: "Restrictions", kinds: ["exclusion"] },
  { key: "docs", title: "Documentation", kinds: ["documentation"] },
];
function stageState(st, ms) {
  const has = (s) => ms.some((m) => m.status === s);
  if (st.key === "routes") return has("met") ? ["ok", "Qualifies"] : has("not_met") ? ["bad", "No route met"] : ["warn", "Not shown"];
  if (st.key === "waits") return has("not_met") ? ["bad", "Not met"] : has("missing_documentation") ? ["warn", "Undocumented"] : has("met") ? ["ok", "Met"] : ["mute", "Waived or not relevant"];
  if (st.key === "limits") return has("not_met") ? ["bad", "Applies"] : ["ok", "None apply"];
  return has("missing_documentation") ? ["warn", "Gaps"] : ["ok", "Complete"];
}
function coverageHtml(run, matches) {
  const head = `<div class="coverage-head"><span>Coverage path</span><span>${run.triage.route === "clinical_review" ? "Decided by a fixed rule, not a model" : "Decided by the reason-code table, not a model"}</span></div>`;
  if (run.triage.route !== "clinical_review") {
    const to = run.triage.route === "fix_checklist" ? "Fix the claim" : "Not covered by the plan";
    return `<section class="coverage" aria-label="Coverage path">${head}<ol class="coverage-steps single">
      <li class="single-l">Reason code ${id("CARC " + (run.denial.carc.join(", ") || "—"))} → ${to}</li></ol></section>`;
  }
  const cells = STAGES.map((st) => {
    const all = matches.filter((m) => st.kinds.includes(m.crit.kind));
    const live = all.filter((m) => m.status !== "not_applicable" && m.show !== "route");
    const [k, word] = stageState(st, all.filter((m) => m.show !== "route"));
    const res = k === "ok" ? `<span class="res ok">${g("check")}<span>${esc(word)}</span></span>`
      : k === "bad" ? `<span class="res">${mark("neg", "cross", word)}</span>`
      : k === "warn" ? `<span class="res">${mark("warn", "half", word)}</span>`
      : `<span class="res mute">${g("dash")}<span>${esc(word)}</span></span>`;
    const quiet = all.length - live.length;
    const refs = live.map((m) => `<button type="button" class="link id" title="${esc(m.summary)}" data-chip="${m.criterion_id}">${esc(m.addr || m.criterion_id)}</button>`).join('<span aria-hidden="true">·</span>');
    return `<li><span class="lab">${st.title}</span>${res}<span class="refs">${refs || (quiet ? "" : "—")}${quiet ? `<span>+${quiet} don't apply</span>` : ""}</span></li>`;
  }).join("");
  return `<section class="coverage" aria-label="Coverage path">${head}<ol class="coverage-steps">${cells}</ol></section>`;
}

// ---------- Rules ledger ----------
const RANK = { not_met: 0, missing_documentation: 1, met: 2, route: 3, not_applicable: 4 };
function rulesHtml(matches, scope) {
  const live = matches.filter((m) => m.status !== "not_applicable").sort((a, b) => RANK[a.show] - RANK[b.show]);
  const na = matches.filter((m) => m.status === "not_applicable");
  if (!matches.length) return "";
  return `<h2 class="sec">Rules that decide this ${scope === "check" ? "request" : "case"}<span>${live.length} deciding · ${na.length} don't apply</span></h2>
    <div class="rules">${live.map(ruleHtml).join("")}</div>
    ${na.length ? `<button type="button" class="na-toggle" data-na aria-expanded="false">${na.length} rules don't apply · Show</button><div class="rules" data-na-list hidden>${na.map(ruleHtml).join("")}</div>` : ""}`;
}
function ruleHtml(m) {
  const ev = m.evidence.filter((e) => e.verified);
  const conf = m.confidence || "single";
  const evHtml = (e) => `<p class="ev">${g("tick")}<span class="q">“${esc(e.quote)}”</span><a class="id link" href="#" data-goto="note:${esc(e.note_id)}">${esc(noteShort(e.note_id))}</a></p>`;
  return `<article class="rule" data-rule="${m.criterion_id}">
    <button type="button" class="rule-toggle" data-rule="${m.criterion_id}" aria-pressed="false" aria-expanded="false" aria-controls="more-${m.criterion_id}">
      ${statusMark(m.show)}
      <span class="rule-sum">${esc(m.summary)}</span>
    </button>
    ${m.addr ? `<a class="id link rule-addr" href="#" data-goto="${gotoFor(m.addr)}">${esc(m.addr)}</a>` : ""}
    ${ev.length ? evHtml(ev[0]) : m.status === "missing_documentation" ? `<p class="ev none">No chart note documents this.</p>` : ""}
    <div class="rule-more" id="more-${m.criterion_id}" hidden>
      <p class="why">${esc(m.rationale)}</p>
      ${ev.slice(1).map(evHtml).join("")}
      <p class="conf">${esc(CONF[conf])}${m.votes && m.votes.length ? " · " + esc(m.votes.join(", ")) : ""}</p>
    </div>
  </article>`;
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
  const primary = $main.querySelector("[data-primary]");
  ctx.expanded = new Set();
  const show = (name) => {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    ctx.tab = name;
    $main.querySelector(".workspace").classList.toggle("letter-focus", name === "next" && !!run.appeal);
    if (primary) primary.hidden = name === "next";
    pane.innerHTML = panes[name](ctx);
    if (name === "next") wireNext(ctx, pane);
  };
  const select = (ruleId, scroll) => {
    ctx.selected = ctx.selected === ruleId ? null : ruleId;
    $main.querySelectorAll("article.rule").forEach((a) => {
      const on = a.dataset.rule === ctx.selected;
      a.classList.toggle("on", on);
      const t = a.querySelector(".rule-toggle");
      t.setAttribute("aria-pressed", String(on)); t.setAttribute("aria-expanded", String(on));
      a.querySelector(".rule-more").hidden = !on;
    });
    if (!ctx.selected) { if (ctx.tab === "policy" || ctx.tab === "chart") show(ctx.tab); return; }
    const m = matches.find((x) => x.criterion_id === ruleId);
    const wantChart = ctx.tab === "chart" && m.evidence.some((e) => e.verified);
    show(run.policy && !wantChart ? "policy" : "chart");
    if (scroll) {
      const el = [...pane.querySelectorAll("[data-crit]")].find((x) => x.dataset.crit.split(" ").includes(ruleId));
      el?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    }
  };
  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab)));
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
      const naList = row?.closest("[data-na-list]"); if (naList) naList.hidden = false;
      if (ctx.selected !== chip.dataset.chip) select(chip.dataset.chip, true);
      row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    const toggle = e.target.closest(".rule-toggle");
    if (toggle) { select(toggle.dataset.rule, true); return; }
    const fold = e.target.closest("[data-fold]");
    if (fold) { ctx.expanded.add(fold.dataset.fold); show(ctx.tab); return; }
    const naBtn = e.target.closest("[data-na]");
    if (naBtn) {
      const l = $main.querySelector("[data-na-list]"); l.hidden = !l.hidden;
      naBtn.setAttribute("aria-expanded", String(!l.hidden));
      naBtn.textContent = l.hidden ? `${l.children.length} rules don't apply · Show` : `Hide the ${l.children.length} that don't apply`;
      return;
    }
    const go = e.target.closest("[data-tab-go]");
    if (go) { show(go.dataset.tabGo); return; }
    const copy = e.target.closest("[data-copy-docreq]");
    if (copy) {
      await navigator.clipboard?.writeText(run.doc_request || "");
      const label = copy.querySelector("span:last-child") || copy;
      const was = label.textContent; label.textContent = "Copied";
      setTimeout(() => { label.textContent = was; }, 2000);
      return;
    }
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
  show(run.policy ? "policy" : "chart");
}

function auditHtml(run, matches) {
  const t = run.trace || [];
  if (!t.length) return "";
  const model = (m) => m.split("/").pop();
  const esc2 = matches.filter((m) => m.confidence === "escalated").length;
  const agreed = matches.filter((m) => m.confidence === "agreed").length;
  return `<details class="audit">
    <summary>${g("chevron")}Model calls and cost <span class="faint">· ${t.length} ${t.length === 1 ? "call" : "calls"} · $${run.cost_usd.toFixed(4)}${agreed + esc2 ? ` · ${agreed} rules agreed, ${esc2} escalated to Ultra` : ""}</span></summary>
    <table class="list">
      <thead><tr><th scope="col" style="width:34%">Step</th><th scope="col" style="width:22%">Model</th><th scope="col" class="r">Tokens in</th><th scope="col" class="r">Tokens out</th><th scope="col" class="r">Seconds</th><th scope="col" class="r">Cost</th></tr></thead>
      <tbody>${t.map((s) => `<tr><td>${esc(s.step)}</td><td>${esc(model(s.model))}</td><td class="r">${s.prompt_tokens.toLocaleString()}</td><td class="r">${s.completion_tokens.toLocaleString()}</td><td class="r">${s.latency_s}</td><td class="r">$${s.cost_usd.toFixed(4)}</td></tr>`).join("")}
        <tr><td colspan="5">Total for this case · NVIDIA Nemotron on Nebius Token Factory</td><td class="r">$${run.cost_usd.toFixed(4)}</td></tr></tbody>
    </table>
  </details>`;
}

// ---------- Policy: one row per sentence, its address and decision in the gutter ----------
function policyPane(ctx) {
  const { run, c, matches } = ctx;
  const status = Object.fromEntries(matches.map((m) => [m.criterion_id, m.show === "route" ? "not_applicable" : m.status]));
  const sel = ctx.selected;
  const text = run.policy.text;
  const isHeading = (t) => !/[.:;)”"]$/.test(t.trim()) && t.length < 70 && !t.startsWith("•");
  const crits = (s) => s.criteria.filter((cid) => status[cid] && (status[cid] !== "not_applicable" || cid === sel));
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
    const cs = crits(s);
    const pick = cs.includes(sel) ? sel : cs[0];
    const st = pick ? STATUS[status[pick]] : null;
    const body = pick ? `<span class="hl ${status[pick]}${pick === sel ? " on" : " rest"}" data-crit="${s.criteria.join(" ")}">${esc(t)}</span>` : esc(t);
    html += `<p class="sent${pick ? " rule-s" : ""}${/\n\s*\n/.test(gap) ? " para" : ""}" data-s="${s.n}"><span class="gut">${id("S" + s.n)}${st ? `<span class="w ${st.tone}">${st.label}</span>` : ""}</span><span>${body}</span></p>`;
  }
  const p = run.policy;
  const long = p.title.length > 40;
  return `<article class="sheet">
    <header class="sheet-head">
      <h2>${esc(long ? p.policy_id : p.title)}</h2>
      ${long ? `<p class="full">${esc(p.title)}</p>` : ""}
      <p class="smeta">${id(policyId(p))} · effective ${fmtDate(p.effective_from)} · fetched ${fmtDate(p.fetched_at)} · ${S.length} sentences · <a class="link" href="${esc(p.url)}" target="_blank" rel="noopener">source</a></p>
    </header>
    ${html}
  </article>`;
}

// ---------- Chart notes: the timeline, then each note with its verified spans ----------
function chartPane(ctx) {
  const { c, run, matches } = ctx;
  const sel = ctx.selected;
  const notes = c.notes.map((n) => {
    const marks = [];
    matches.forEach((m) => m.evidence.forEach((e) => {
      if (e.verified && e.note_id === n.note_id && e.start != null && (m.status !== "not_applicable" || m.criterion_id === sel)) {
        const key = m.show === "route" ? "route" : m.status;
        marks.push({ a: e.start, b: e.end, cls: (key === "route" ? "not_applicable" : m.status) + (m.criterion_id === sel ? " on" : " rest"), rule: m.criterion_id, st: STATUS[key], addr: m.addr });
      }
    }));
    marks.sort((x, y) => x.a - y.a || (y.rule === sel) - (x.rule === sel));
    let out = "", at = 0;
    for (const mk of marks) {
      if (mk.a < at) continue;
      out += esc(n.text.slice(at, mk.a)) + `<span class="hl ${mk.cls}" data-crit="${mk.rule}">${esc(n.text.slice(mk.a, mk.b))}</span>`
        + `<a class="hl-tag ${mk.st.tone}" href="#" data-goto="${gotoFor(mk.addr)}">${mk.st.label}${mk.addr ? ` · ${id(mk.addr)}` : ""}</a>`;
      at = mk.b;
    }
    out += esc(n.text.slice(at));
    const cap = (s) => s.replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());
    return `<section class="note" data-note="${n.note_id}">
      <p class="note-h">${fmtDate(n.date)} · ${esc(cap(n.note_type))} · ${esc(cap(n.author_role))} ${id(noteShort(n.note_id))}</p>
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
  const f = run.facts;
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
    return `<li>${m}<span>${esc(l.label)}</span><a class="id link" href="#" data-goto="policy:${l.sentence}">${esc(sAddr(l.address))}</a></li>`;
  }).join("");
  return `<section class="tl" aria-label="Chart timeline">
    <div class="tl-head"><h2>Chart timeline</h2><span>${f.symptom_days != null ? `Onset to ${esc(mriLabel)} ${f.symptom_days} days · ` : ""}conservative care ${f.conservative_days ?? 0} days</span></div>
    <div class="tl-track" style="height:${height}px">
      ${lines.map((l) => `<span class="tl-line ${l.state}${pct(l.at) > 62 ? " flip" : ""}" style="left:${x(l.at)};--lr:${l.row}"><span class="tl-line-l">${esc(l.label)}</span></span>`).join("")}
      ${rows.map((t, i) => `<span class="tl-bar" style="left:${x(toMs(t.start))};width:calc(${x(toMs(t.end))} - ${x(toMs(t.start))});top:${56 + i * 36}px"><span>${esc(cap(t.kind))}${t.sessions ? ` · ${t.sessions} sessions` : ""} · ${days(t.start, t.end)} days${t.response ? " · " + esc(t.response.replace(/_/g, " ")) : ""}</span></span>`).join("")}
      <span class="tl-axis"></span>
      ${months.map((ms, i) => `<span class="tl-tick" style="left:${x(ms)}"></span><span class="tl-month${i === 0 && pct(ms) < 8 ? " first" : ""}${pct(ms) > 92 ? " last" : ""}" style="left:${x(ms)}">${mName(ms, i === 0)}</span>`).join("")}
      ${flags.map(([on, fl]) => `<span class="tl-flag" style="left:${x(toMs(on))}" title="${esc(fl.join(", "))}"></span><span class="tl-flag-l" style="left:${x(toMs(on))}">Red flag${fl.length > 1 ? "s" : ""}: ${esc(fl.join(", "))}</span>`).join("")}
      ${onset ? `<span class="tl-pt${pct(onset) < 14 ? " start" : ""}" style="left:${x(onset)}"><b>Onset</b> ${fmtDate(f.onset)}</span>` : `<span class="tl-pt start" style="left:0"><b>Onset</b> not verified</span>`}
      <span class="tl-pt${pct(dos) > 86 ? " end" : ""}" style="left:${x(dos)}"><b>${esc(mriLabel)}</b> ${fmtDate(run.denial.dos)}</span>
    </div>
    ${legend ? `<ul class="tl-legend">${legend}</ul>` : ""}
  </section>`;
}

function letterPane(ctx) {
  const d = ctx.run.denial;
  return `<figure style="margin:0"><img class="letter-img" src="/api/cases/${ctx.c.id}/letter" alt="Synthetic faxed denial notice for ${esc(ctx.c.patient)}">
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
        <article class="sheet letter" data-letter aria-live="polite"></article>
        <label class="sr" for="letter">Letter text</label>
        <textarea id="letter" class="editor" spellcheck="true" hidden>${esc(run.appeal.rendered)}</textarea>
        ${run.appeal.critique.length ? `<details class="critique"><summary>${g("chevron")}Payer-reviewer critique addressed in revision ${run.appeal.revision}</summary><ul>${run.appeal.critique.map((x) => `<li><b>${esc(x.severity)}</b>: ${esc(x.issue)} → ${esc(x.suggestion)}</li>`).join("")}</ul></details>` : ""}
      </div>
      <aside class="gate" aria-live="polite" data-gate></aside>
    </div>`;
  }
  if (run.doc_request) return docRequestPane(run.doc_request);
  const blockers = matches.filter((m) => m.status === "not_met" && m.show !== "route");
  const v = VERDICT[run.verdict];
  return `<article class="sheet plain">
    <header class="sheet-head"><h2>${esc(v.label)}</h2></header>
    <p>${esc(v.line)}</p>
    ${blockersHtml(blockers)}
    ${run.triage.checklist.length ? `<h3 class="sub">Checklist</h3><ol>${run.triage.checklist.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>` : ""}
  </article>`;
}
const blockersHtml = (blockers) => (blockers.length ? `<h3 class="sub">What the chart doesn't meet yet</h3>${blockers.map((m) => `<p class="blk"><span class="hl not_met">${esc(m.crit.verbatim_span.slice(0, 260))}</span><span class="why">${esc(m.rationale)} ${m.addr ? `<a class="id link" href="#" data-goto="${gotoFor(m.addr)}">${esc(m.addr)}</a>` : ""}</span></p>`).join("")}` : "");
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
    return `<a class="id link" href="#" data-goto="note:${esc(c.source_id || "")}">${esc(nid || a)}</a>${date ? ` · ${esc(date)}` : ""}`;
  }
  return `<a class="id link" href="#" data-goto="${gotoFor(a) || "null"}">${esc(a)}</a>`;
}

// Typeset the letter: headings, verified quotes on the blue-pencil block with their address,
// tampered quotes VOID and struck, with what the source really says beside them.
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
  const strike = (h) => {
    checks.filter((c) => c.status !== "verified" && !c.text.includes("\n")).forEach((c) => {
      const e = esc(c.text);
      if (h.includes(e)) h = h.replace(e, `<span class="void">VOID</span><span class="struck">${e}</span>`);
    });
    return h;
  };
  const inline = (q) => {
    const c = find(q);
    if (c && c.status !== "verified") return `<span class="void">VOID</span><span class="struck">${esc(squash(q))}</span>`;
    return `“<span class="iq">${esc(squash(q))}</span>”${c ? `<span class="iq-ref">${g("tick")}${checkAddr(c)}</span>` : ""}`;
  };
  return merged.map((b) => {
    if (b.t === "h") return `<h3>${esc(b.s)}</h3>`;
    if (b.t === "p") return `<p>${b.parts.map((pt) => (pt.q !== undefined ? inline(pt.q) : strike(esc(pt.s)))).join("")}</p>`;
    const c = find(b.s);
    if (!c) return `<figure class="lq"><blockquote>${esc(squash(b.s))}</blockquote><figcaption>${esc(b.cite)}</figcaption></figure>`;
    if (c.status === "verified") return `<figure class="lq"><blockquote>${esc(squash(b.s))}</blockquote><figcaption>${g("tick")}<b>Verified</b><span>· matches</span>${checkAddr(c)}</figcaption></figure>`;
    let h = `<figure class="lq bad"><blockquote><span class="void">VOID</span><span class="struck">${esc(squash(b.s))}</span></blockquote>
      <figcaption>Not found in any fetched source${b.cite ? ` · claimed ${id(b.cite.split(",")[0])}` : ""}</figcaption></figure>`;
    if (c.closest) h += `<figure class="lq says"><p class="says-l">Source says</p><blockquote>${esc(c.closest.text)}</blockquote><figcaption>${g("tick")}<b>Verified</b><span>·</span>${checkAddr(c.closest)}</figcaption></figure>`;
    return h;
  }).join("");
}

function wireNext(ctx, pane) {
  const ta = pane.querySelector("#letter");
  if (!ta) return;
  const box = pane.querySelector("[data-gate]");
  const sheet = pane.querySelector("[data-letter]");
  const edit = pane.querySelector("[data-edit]");
  let timer, seq = 0, last = null;
  edit.addEventListener("click", () => {
    const editing = edit.getAttribute("aria-pressed") !== "true";
    edit.setAttribute("aria-pressed", String(editing));
    edit.textContent = editing ? "Show letter" : "Edit text";
    ta.hidden = !editing; sheet.hidden = editing;
    if (editing) ta.focus(); else sheet.innerHTML = renderLetter(ta.value, last);
  });
  const lockedExport = (why) => `<div class="export"><button type="button" class="btn" aria-disabled="true" aria-describedby="export-why" data-export>${svg("lock")}Export locked</button><p class="why-lock" id="export-why">${why}</p></div>`;
  const foot = `<p class="foot">A person reviews and sends this letter. Denial Auditor never submits anything.</p>`;
  const paint = (g2, pending, error) => {
    if (error) {
      box.innerHTML = `<div class="gate-head"><h3>Citation gate</h3>${mark("neg", "cross", "Check failed")}</div>
        <p class="say">Couldn't check quotes: ${esc(error)}. <button type="button" class="btn text" data-recheck>Retry</button></p>
        ${lockedExport("Export stays locked until the check runs.")}${foot}`;
      box.querySelector("[data-recheck]").addEventListener("click", run);
      return;
    }
    if (pending || !g2) {
      box.innerHTML = `<div class="gate-head"><h3>Citation gate</h3>${mark("quiet", null, "Checking quotes…")}</div>
        <p class="say">Every quoted line is checked against the text fetched for this case.</p>
        ${lockedExport("Export opens once every quote has been checked.")}${foot}`;
      return;
    }
    const bad = g2.checks.filter((x) => x.status !== "verified").length, n = g2.checks.length;
    const pill = g2.ok ? mark("ver", "tick", `${n} of ${n} match their source`) : mark("neg", "cross", `${bad} of ${n} ${bad === 1 ? "doesn't" : "don't"} match`);
    box.innerHTML = `<div class="gate-head"><h3>Citation gate</h3>${pill}</div>
      <p class="say">${g2.ok ? "Each quoted line matches text fetched for this case, word for word." : esc(g2.reason || "Fix or remove the quote marked VOID.")}</p>
      <ol>${g2.checks.map((x) => x.status === "verified"
        ? `<li><span class="row">${g("tick")}<span class="q">${esc(squash(x.text))}</span></span><span class="src">matches ${checkAddr(x)}</span></li>`
        : `<li class="bad"><span class="row"><span class="void">VOID</span><span class="q">${esc(squash(x.text))}</span></span><span class="src">not found in any fetched source${x.closest ? ` · closest ${checkAddr(x.closest)}` : ""}</span></li>`).join("")}</ol>
      ${g2.ok ? `<div class="export"><button type="button" class="btn primary" data-export>${svg("download")}Export letter</button></div>` : lockedExport(`Fix or remove the ${bad} quote${bad === 1 ? "" : "s"} marked VOID, then export opens.`)}
      ${foot}`;
    box.querySelector("[data-export]").addEventListener("click", (e) => {
      if (e.currentTarget.getAttribute("aria-disabled") === "true") return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([ta.value], { type: "text/markdown" }));
      a.download = `${ctx.c.id}_reconsideration.md`; a.click(); URL.revokeObjectURL(a.href);
    });
  };
  async function run() {
    const mine = ++seq;
    let g2;
    try { g2 = await api("/api/gate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: ctx.c.id, text: ta.value }) }); }
    catch (e) { if (mine === seq) paint(null, false, e.message); return; }
    if (mine !== seq) return;
    last = g2;
    if (!sheet.hidden) sheet.innerHTML = renderLetter(ta.value, g2);
    paint(g2, false);
  }
  sheet.innerHTML = renderLetter(ta.value, null);
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
        <div class="field"><label for="pc">Passcode</label><input id="pc" class="input" type="password" autocomplete="off" value="${esc(state.passcode)}" placeholder="From the Devpost testing instructions"></div>
        <div class="field"><label for="cs">Synthetic case</label><select id="cs" class="input">${data.available.map((x) => `<option value="${x}">${x.replace("case_", "Case ")}</option>`).join("")}</select></div>
        <dl class="kv" data-preview></dl>
        <button class="btn primary" type="submit" data-run ${on ? "" : 'aria-disabled="true"'}>${svg("play")}Run live</button>
        <p class="small">Limited to 30 live runs a day across all visitors; a spending cap stops any run that would exceed this demo's budget.</p>
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
    let job;
    try { job = (await api("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id, passcode: state.passcode }) })).job; }
    catch (err) { after.innerHTML = `<p class="flag">${mark("neg", "cross", "Stopped")}<span>${esc(err.message)}</span></p>`; btn.removeAttribute("aria-disabled"); return; }
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
      after.innerHTML = s.state === "done" ? `<a class="btn primary" href="#/case/${case_id}">Open the case</a>`
        : `<p class="flag">${mark("neg", "cross", "Stopped")}<span>${esc(s.error || "The run stopped.")}</span></p>`;
      btn.removeAttribute("aria-disabled");
      if (s.state === "done") btn.className = "btn secondary";
      state.cases = null;
    };
    poll();
  });
}

// ---------------- Before you submit (prevention) ----------------
// Readiness reuses the verdict colours and glyphs: ready = appeal, add docs = ask, not yet = don't appeal.
const READY = {
  ready:             { label: "Ready to submit", v: "appeal", line: "The chart meets the policy in effect on the planned date. Submit the prior-auth request.", next: "See next step" },
  add_documentation: { label: "Add documentation first", v: "doc_request", line: "A route to coverage is met, but something the policy asks for isn't in the chart yet. Ask the physician before submitting." },
  not_yet:           { label: "Not yet", v: "dont_appeal", line: "The chart, as documented, falls short of a waiting period in the policy. Submitting now would likely be denied.", next: "See the earliest date" },
  doesnt_qualify:    { label: "Doesn't qualify", v: "not_winnable", line: "The chart doesn't meet this policy, and waiting won't change that. Review the rules with the physician.", next: "See why" },
};
const readyMark = (r) => mark(VERDICT[READY[r].v].tone, VERDICT[READY[r].v].glyph, READY[r].label);

async function checksView() {
  setNav("check");
  document.title = "Before you submit · Denial Auditor";
  let data;
  try { data = await api("/api/checks"); }
  catch (e) { $main.innerHTML = `<h1 class="page-title">Before you submit</h1>${errorBlock(`Couldn't load the requests: ${e.message}.`, true)}`; wireRetry(); return; }
  const rows = [...data.checks].sort((a, b) => a.planned_dos.localeCompare(b.planned_dos));
  const n = (r) => rows.filter((x) => x.readiness === r).length;
  const notYet = rows.filter((x) => x.readiness === "not_yet" && x.earliest).sort((a, b) => a.earliest.localeCompare(b.earliest))[0];
  const findingText = rows.length
    ? `${n("ready")} of ${rows.length} requests are ready to submit.${n("not_yet") ? ` ${n("not_yet")} are not yet${notYet ? `; the earliest date for one is ${fmtDate(notYet.earliest)} (${esc(notYet.patient)})` : ""}.` : ""}${n("add_documentation") ? ` ${n("add_documentation")} need documentation first.` : ""}`
    : "No prior-auth checks yet.";
  const polId = (p) => (p || "").split(",")[0].replace(/^Aetna /, "").replace(/ snapshot.*/, "");
  $main.innerHTML = `
    <h1 class="page-title">Before you submit</h1>
    <p class="finding">${findingText}</p>
    <table class="list">
      <thead><tr>
        <th scope="col" class="r" style="width:14%">Planned MRI</th>
        <th scope="col" style="width:34%">Patient</th>
        <th scope="col" style="width:22%">Readiness</th>
        <th scope="col" class="r earl" style="width:14%">Earliest date</th>
        <th scope="col" class="pol" style="width:16%">Policy</th>
      </tr></thead>
      <tbody>${rows.length ? rows.map((r) => `<tr>
        <td class="due r"><span class="fig">${fmtDate(r.planned_dos)}</span></td>
        <td class="who"><a class="l1" href="#/check/${r.id}">${esc(r.patient)}</a><span class="l2">${esc(payerShort(r.payer))} · ${id("CPT " + r.cpt)}</span></td>
        <td class="rec">${readyMark(r.readiness)}</td>
        <td class="earl r">${r.earliest ? fmtDate(r.earliest) : '<span class="faint">—</span>'}</td>
        <td class="pol"><span class="faint">${r.policy ? id(polId(r.policy)) : ""}</span></td>
        <td class="stack">${r.earliest ? `Earliest ${fmtDate(r.earliest)} · ` : ""}${r.policy ? id(polId(r.policy)) : ""}</td>
      </tr>`).join("") : `<tr><td colspan="5" class="empty">No prior-auth checks yet.</td></tr>`}</tbody>
    </table>
    <h2 class="sec key-h">What each readiness means</h2>
    <dl class="key">
      <div><dt>${readyMark("ready")}</dt><dd>Every rule that matters is met by the chart on the planned date. Submit the request.</dd></div>
      <div><dt>${readyMark("add_documentation")}</dt><dd>A route to coverage is met, but a rule the policy asks for isn't in the chart. Copy the request to the physician.</dd></div>
      <div><dt>${readyMark("not_yet")}</dt><dd>A waiting period isn't met yet. The earliest date it is, worked out from the chart's own dates, is shown.</dd></div>
      <div><dt>${readyMark("doesnt_qualify")}</dt><dd>The chart doesn't meet the policy and waiting won't change that.</dd></div>
    </dl>`;
}

async function checkView(checkId) {
  setNav("check");
  $main.innerHTML = caseSkeleton();
  let c;
  try { c = await api(`/api/checks/${encodeURIComponent(checkId)}`); }
  catch (e) { $main.innerHTML = `<div class="err-block"><span>Couldn't load this request: ${esc(e.message)}.</span><a class="link" href="#/check">Back to Before you submit</a></div>`; return; }
  const ch = c.check, r = ch.request, rd = READY[ch.readiness];
  const rep = await drift();
  document.title = `${c.patient} · Before you submit · Denial Auditor`;
  // The board renderers take a run; a check is shaped like one with the planned date as the service date.
  const run = { ...ch, denial: { dos: r.planned_dos, carc: [] }, triage: { route: "clinical_review", checklist: [] }, appeal: null, verdict: rd.v };
  const matches = prepMatches(run, c, ch.readiness === "ready");
  NOTE_DATES = Object.fromEntries(c.notes.map((n) => [n.note_id, n.date]));
  const primary = ch.doc_request
    ? `<button type="button" class="btn primary" data-primary data-copy-docreq>${svg("copy")}<span>Copy documentation request</span></button>`
    : `<button type="button" class="btn primary" data-primary data-tab-go="next">${rd.next}</button>`;
  let dateCell;
  if (ch.earliest) {
    const gap = days(r.planned_dos, ch.earliest);
    const note = gap <= 0
      ? `${-gap} days before the planned ${fmtDate(r.planned_dos)}, if conservative care continues through it`
      : `${gap} days after the planned ${fmtDate(r.planned_dos)}: move the MRI to this date or later`;
    dateCell = `<div class="deadline"><p class="rowa"><span class="fig">${fmtDate(ch.earliest)}</span><small>earliest date</small></p><p class="rowc"><span>${note}</span></p><p class="rowd">Worked out in code from verified chart dates.</p></div>`;
  } else {
    dateCell = `<div class="deadline"><p class="rowa"><span class="fig">${fmtDate(r.planned_dos)}</span><small>planned MRI</small></p><p class="rowc"><span>${ch.policy ? `Meets ${id(policyId(ch.policy))}, the policy in effect on this date.` : ""}</span></p></div>`;
  }
  $main.innerHTML = `
    <nav class="crumb" aria-label="Breadcrumb"><a class="link" href="#/check">Before you submit</a><span class="sep">/</span><h1>${esc(c.patient)}</h1>${id(c.id.replace("case_", "Chart "))}</nav>
    <section class="vline" aria-label="Readiness">
      <p class="answer v-${rd.v}"><span class="sr">Readiness: </span>${g(VERDICT[rd.v].glyph)}${esc(rd.label)}</p>
      ${dateCell}
      <div class="actions">${primary}</div>
    </section>
    <p class="why-line">${esc(rd.line)}</p>
    <p class="meta">${esc(payerPlan(r.payer_name, r.plan_type))} · Lumbar MRI · ${id("CPT " + r.cpt)}</p>
    ${driftFlag(rep, c.id, "prior_auth")}
    ${coverageHtml(run, matches)}
    <div class="workspace">
      <aside class="ledger" aria-label="Policy rules for this request">
        ${ch.policy ? `<dl class="kv"><div><dt>Policy on ${fmtDate(r.planned_dos)}</dt><dd>${esc(shortTitle(ch.policy))} · ${id(policyId(ch.policy))} · <a class="link" href="${esc(ch.policy.url)}" target="_blank" rel="noopener">source</a></dd></div></dl>` : ""}
        ${rulesHtml(matches, "check")}
      </aside>
      <section aria-label="Documents">
        <div class="tabs" role="tablist" aria-label="Documents">
          <button type="button" role="tab" data-tab="policy" aria-selected="true">Policy</button>
          <button type="button" role="tab" data-tab="chart" aria-selected="false">Chart notes</button>
          <button type="button" role="tab" data-tab="next" aria-selected="false">${ch.doc_request ? "Documentation request" : "Next step"}</button>
        </div>
        <div data-pane></div>
      </section>
    </div>
    ${auditHtml(run, matches)}`;
  wireWorkspace({ c, run, matches, selected: null, mriLabel: "Planned MRI" }, { policy: policyPane, chart: chartPane, next: checkNextPane });
}

function checkNextPane(ctx) {
  const { run, matches } = ctx;
  const rd = READY[run.readiness];
  if (run.doc_request) return docRequestPane(run.doc_request);
  const blockers = matches.filter((m) => m.status === "not_met" && m.show !== "route");
  const before = run.earliest && run.earliest <= run.request.planned_dos;
  return `<article class="sheet plain">
    <header class="sheet-head"><h2>${esc(rd.label)}</h2></header>
    <p>${esc(rd.line)}</p>
    ${run.earliest ? `<p>Earliest date the chart can meet the policy: <b>${fmtDate(run.earliest)}</b>. ${before
      ? `That's on or before the planned date, so the date can stand if the chart documents conservative care through ${fmtDate(run.earliest)}.`
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
      <li><b>Find the policy in force on the date of service.</b> Medicare coverage policies come from the CMS Coverage API, which keeps every version with its effective dates. Commercial bulletins such as Aetna's are located at runtime with Tavily search.</li>
      <li><b>Split the policy into rules.</b> Code numbers every sentence of the fetched policy; Nemotron 3 Super only picks sentence numbers. Each rule is therefore the payer's own wording, cut from the source.</li>
      <li><b>Check each rule against the chart.</b> Two Nemotron 3 Super votes judge whether each rule supports coverage, blocks it, doesn't apply, or isn't documented, and quote the chart; Nemotron 3 Ultra decides when they split. Code verifies every quote and computes every duration from dates.</li>
      <li><b>Decide.</b> A fixed rule, not a model, turns those judgments into one recommendation: appeal, ask the physician, don't appeal yet, fix and resubmit, or not winnable.</li>
      <li><b>Write the appeal.</b> Nemotron 3 Ultra drafts the letter using only pre-verified quotes, Super critiques it as the payer's medical reviewer, and Ultra revises. The citation gate blocks export unless every quote matches its source word for word.</li>
    </ol>
    <h2>Before a request goes out</h2>
    <p><b>Before you submit</b> runs the same steps on a prior-auth request, using the policy version in effect on the planned date. If the chart falls short of a waiting period, such as four weeks of conservative care, code works out the earliest date it's met from the chart's own dates. No model guesses a date.</p>
    <h2>When a policy changes</h2>
    <p>The <b>policy watch</b> runs every night beside the app and calls no model. It compares each open case's cited policy with the live source: a newer CMS version, or changed text in the Aetna bulletin. It flags only the cases whose service date the change covers, and names the rules whose wording moved.</p>
    <h2>What it never does</h2>
    <p>It never submits anything; a person reviews and sends every letter. Deadlines come from a fixed table checked against federal regulations, never from a model. CPT codes are shown bare, without AMA descriptions. All patients and notices in this demo are synthetic.</p>
  </article>
  <aside class="sources" aria-label="Models and sources">
    <h2>Models and sources</h2>
    <dl class="kv">
      <div><dt>Read the letter</dt><dd>Nemotron 3.5 Super-VL</dd></div>
      <div><dt>Triage</dt><dd>Reason-code table, no model</dd></div>
      <div><dt>Medicare policy</dt><dd>CMS Coverage API, versioned by date</dd></div>
      <div><dt>Aetna policy</dt><dd>Tavily search, then aetna.com</dd></div>
      <div><dt>Split into rules</dt><dd>Nemotron 3 Super picks sentence ids</dd></div>
      <div><dt>Chart facts</dt><dd>Nemotron 3 Nano, quotes checked in code</dd></div>
      <div><dt>Rule vs chart</dt><dd>2 Nemotron 3 Super votes; Ultra on a split</dd></div>
      <div><dt>Recommendation</dt><dd>Fixed rule, no model</dd></div>
      <div><dt>Appeal letter</dt><dd>Ultra drafts, Super critiques, Ultra revises</dd></div>
      <div><dt>Citation gate</dt><dd>Exact match in code</dd></div>
      <div><dt>Deadlines</dt><dd>Fixed table from eCFR, no model</dd></div>
    </dl>
    <p class="cap">Every model runs on Nebius Token Factory; each case's calls and cost are listed under "Model calls and cost".</p>
  </aside></div>`;
}

// ---------------- Router ----------------
async function route() {
  const [, view, rid] = location.hash.split("/");
  state.board?.abort();
  try {
    if (view === "case") await caseView(rid);
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
}
addEventListener("hashchange", route);
route();
