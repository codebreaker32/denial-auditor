// Denial Auditor frontend. No framework: hash routes, one render per view.
const $main = document.getElementById("main");
const state = { cases: null, filter: "all", lastCase: null, passcode: "" };

const VERDICT = {
  appeal:        { label: "Appeal", line: "The chart meets the policy in effect on the date of service. Review the drafted letter and send it." },
  doc_request:   { label: "Ask the physician", line: "Winnable once the missing documentation is added to the chart." },
  dont_appeal:   { label: "Don't appeal yet", line: "The chart doesn't meet the policy yet. Appealing now would likely fail." },
  fix_checklist: { label: "Fix & resubmit", line: "Administrative denial: correct the claim. No clinical appeal is needed." },
  not_winnable:  { label: "Not winnable", line: "The plan excludes this service. Medical-necessity evidence won't change the outcome." },
};
const SWATCH = { appeal: "land", doc_request: "sun", dont_appeal: "coral", fix_checklist: "pond", not_winnable: "lilac" };
const ORDER = ["appeal", "doc_request", "fix_checklist", "dont_appeal", "not_winnable"];
const STATUS = {
  met: "Supports", not_met: "Blocks", missing_documentation: "Missing docs", not_applicable: "Not applicable",
};
const KIND = { indication: "Route to coverage", red_flag: "Red-flag route", duration: "Duration rule", documentation: "Documentation", exclusion: "Restriction" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const display = (s) => esc(s).replace(/&#39;/g, '<span class="apos">’</span>');
const fmtDate = (iso) => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };
const payerShort = (p) => p.replace(/ \((synthetic[^)]*)\)/i, "");
let NOTE_DATES = {};
const noteShort = (id) => id.split("-").pop();
const noteAddr = (id) => `note ${noteShort(id)}${NOTE_DATES[id] ? " · " + fmtDate(NOTE_DATES[id]) : ""}`;
const gotoFor = (addr) => { const m = /S(\d+)/.exec(addr || ""); return m ? `policy:${m[1]}` : null; };
const icon = {
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5l10 6.5-10 6.5z"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
};

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok) {
    let msg = `${r.status}`;
    try { msg = (await r.json()).detail || msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

function setNav(name) {
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

function mark(kind, label) { return `<span class="mark ${kind}">${esc(label)}</span>`; }

// The verdict field's coastline: one path seeded by the case (and tab), so every case has its own coast.
function coastPath(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const pts = Array.from({ length: 5 }, (_, i) => [i * 300, 4 + rnd() * 62]);
  const f = (n) => n.toFixed(1);
  let d = `M0 ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${f(p2[1])}`;
  }
  return d + " L1200 72 L0 72 Z";
}
// The field opens in the previous case's colour and coast, then morphs to this one's (settleBand).
function bandOpen(v, seed) {
  const from = state.band || { v, d: coastPath(seed) };
  return `<section class="case-band v-${from.v}" data-v="${v}" data-seed="${esc(seed)}">`;
}
function coastSvg() {
  const d = (state.band && state.band.d) || "M0 72 L1200 72 Z";
  return `<svg class="coast" viewBox="0 0 1200 72" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" style="d: path('${d}')"/></svg>`;
}
function settleBand(seed) {
  const band = $main.querySelector(".case-band[data-v]");
  if (!band) return;
  const v = band.dataset.v, d = coastPath(seed || band.dataset.seed);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    band.className = `case-band v-${v}`;
    const path = band.querySelector(".coast path");
    path.setAttribute("d", d); path.style.d = `path('${d}')`;
    state.band = { v, d };
  }));
}

// ---------------- Policy watch (drift report) ----------------
async function drift() {
  if (!state.drift) { try { state.drift = await api("/api/drift"); } catch { state.drift = { checked_at: null, items: [] }; } }
  return state.drift;
}
const watchedAt = (iso) => `${fmtDate(iso.slice(0, 10))} ${iso.slice(11, 16)} UTC`;
function watchLine(rep) {
  if (!rep.checked_at) return "";
  const hit = rep.items.filter((i) => i.affects_case);
  const ids = [...new Set(rep.items.map((i) => i.policy_id))].join(", ");
  return `<p class="watch${hit.length ? " flagged" : ""}"><span><b>Policy watch</b> checked ${watchedAt(rep.checked_at)} · ${
    hit.length ? `${hit.length} open item${hit.length > 1 ? "s" : ""} affected by a policy change` : `${esc(ids)}: no open item affected by a policy change`}</span></p>`;
}
function driftFlag(rep, id, kind) {
  const i = rep.items.find((x) => x.case_id === id && x.kind === kind);
  if (!i || i.status === "current" || i.status === "error") return "";
  const rules = i.changed_rules.length ? ` Changed wording: ${i.changed_rules.map((r) => esc(r.summary)).join("; ")}.` : "";
  return `<p class="watch${i.affects_case ? " flagged" : ""}"><span><b>Policy watch, ${watchedAt(rep.checked_at)}:</b> ${esc(i.policy_id)} ${esc(i.cited)} → ${esc(i.current)}. ${esc(i.note)}${rules}</span></p>`;
}

// ---------------- Worklist ----------------
async function worklist() {
  setNav("worklist");
  document.title = "Worklist · Denial Auditor";
  $main.innerHTML = `<div class="skeleton" style="width:40%;height:28px;margin-bottom:18px"></div><div class="skeleton" style="height:320px"></div>`;
  const data = state.cases || (state.cases = await api("/api/cases"));
  const rep = await drift();
  const rows = [...data.cases].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict) || (a.days_left ?? 999) - (b.days_left ?? 999));
  const count = (v) => rows.filter((r) => v === "all" || r.verdict === v).length;
  const shown = rows.filter((r) => state.filter === "all" || r.verdict === state.filter);
  // The board as land: one flat area per verdict, sized by its count; pressing one filters the table.
  const areas = ORDER.filter((v) => count(v))
    .map((v) => `<button type="button" class="area" data-f="${v}" style="--c: var(--${SWATCH[v]}); flex-grow: ${count(v)}" aria-pressed="${state.filter === v}"><b>${count(v)}</b><span>${VERDICT[v].label}</span></button>`).join("");

  $main.innerHTML = `
    <header class="page-head">
      <div>
        <h1 class="page-title">Denials to work</h1>
        <p class="lede">What to do with each denial, soonest deadline first.</p>
        ${watchLine(rep)}
      </div>
    </header>
    <div class="areas${state.filter === "all" ? "" : " filtered"}" role="group" aria-label="Filter by recommendation">${areas}</div>
    <div class="board-tools">
      <span class="muted" style="font-size:13px">${state.filter === "all" ? `${rows.length} denials` : `${shown.length} of ${rows.length} denials · ${esc(VERDICT[state.filter].label)}`} · deadlines as of ${fmtDate(data.as_of)} (synthetic review date)</span>
      ${state.filter === "all" ? "" : `<button type="button" class="btn ghost" data-f="all">Show all ${rows.length}</button>`}
    </div>
    <div class="board">
      ${shown.length ? `<table>
        <thead><tr><th scope="col">Due</th><th scope="col" class="hide-sm">Recommendation</th><th scope="col">Patient</th><th scope="col" class="hide-sm">Payer</th><th scope="col" class="hide-sm">Service date</th><th scope="col" class="reason">Denial reason</th><th scope="col" class="num hide-sm">Model cost</th></tr></thead>
        <tbody>${shown.map(rowHtml).join("")}</tbody>
      </table>` : `<p class="empty">No denials match this filter.</p>`}
    </div>`;
  $main.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { state.filter = b.dataset.f === state.filter ? "all" : b.dataset.f; worklist(); }));
}

function rowHtml(r) {
  const soon = r.days_left != null && r.days_left < 21;
  const due = r.days_left == null ? `<small>Check notice</small>` : `<b>${r.days_left}</b><small>days left<br>${fmtDate(r.due)}</small>`;
  return `<tr>
    <td class="due-cell"><span class="due${soon ? " soon" : ""}" style="--c: var(--${SWATCH[r.verdict]})">${due}</span></td>
    <td class="hide-sm">${mark("v-" + r.verdict, VERDICT[r.verdict].label)}${r.live ? ' <span class="addr">live run</span>' : ""}</td>
    <td class="who"><a href="#/case/${r.id}">${esc(r.patient)}</a><div class="addr">${esc(r.id.replace("case_", "Case "))} · CPT ${esc(r.cpt)}</div><div class="stack-sm">${mark("v-" + r.verdict, VERDICT[r.verdict].label)}</div></td>
    <td class="hide-sm">${esc(payerShort(r.payer))}</td>
    <td class="hide-sm">${fmtDate(r.dos)}</td>
    <td class="reason">${esc(r.reason)}</td>
    <td class="num hide-sm">$${r.cost_usd.toFixed(3)}</td>
  </tr>`;
}

// ---------------- Case ----------------
async function caseView(id) {
  setNav("case");
  if (!id) {
    const data = state.cases || (state.cases = await api("/api/cases"));
    id = state.lastCase || (data.cases[0] && data.cases[0].id);
    if (!id) { $main.innerHTML = `<p class="empty">No cases yet.</p>`; return; }
    history.replaceState(null, "", `#/case/${id}`);
  }
  state.lastCase = id;
  $main.innerHTML = `<div class="skeleton" style="width:55%;height:34px;margin-bottom:22px"></div><div class="skeleton" style="height:480px"></div>`;
  let c;
  try { c = await api(`/api/cases/${encodeURIComponent(id)}`); }
  catch (e) { $main.innerHTML = `<p class="empty">${esc(e.message)}</p>`; return; }
  const run = c.run, d = run.denial, v = VERDICT[run.verdict];
  const rep = await drift();
  document.title = `${c.patient} · Denial Auditor`;
  const byId = Object.fromEntries(run.criteria.map((x) => [x.criterion_id, x]));
  const matches = run.matches.map((m) => ({ ...m, crit: byId[m.criterion_id], addr: c.addresses[m.criterion_id] }));
  const label = (m) => (m.status === "not_met" && m.crit.kind === "indication" && run.verdict === "appeal") ? ["route", "Route not used"] : [m.status, STATUS[m.status]];
  const rank = { not_met: 0, missing_documentation: 1, met: 2, route: 3, not_applicable: 4 };
  matches.forEach((m) => { m.show = label(m)[0]; });
  const live = matches.filter((m) => m.status !== "not_applicable").sort((a, b) => rank[a.show] - rank[b.show]);
  const na = matches.filter((m) => m.status === "not_applicable");
  const dl = c.deadline;
  NOTE_DATES = Object.fromEntries(c.notes.map((n) => [n.note_id, n.date]));
  const soon = dl && dl.days_left != null && dl.days_left < 21;
  const policyAddr = run.policy ? run.policy.policy_id : "";
  const NEXT = { appeal: "Review appeal", dont_appeal: "See what's missing", fix_checklist: "Open the fix checklist", not_winnable: "See why", doc_request: "See the request" };
  const primary = run.doc_request ? `<button class="btn" data-copy-docreq>${icon.copy}Copy documentation request</button>`
    : `<button class="btn" data-tab-go="next">${NEXT[run.verdict]}</button>`;

  $main.innerHTML = `
    ${bandOpen(run.verdict, c.id)}
      <div>
        <div class="case-who"><span><b>${esc(c.patient)}</b> (synthetic)</span><span>${esc(payerShort(d.payer_name))} · ${esc(d.plan_type.replace(/_/g, " "))}</span><span>Lumbar MRI · CPT ${esc(d.cpt)}</span><span>Service ${fmtDate(d.dos)} · Notice ${fmtDate(d.notice_date)}</span></div>
        <div class="decision">
          <h1>${display(v.label)}</h1>
          ${dl && dl.due ? `<span class="deadline${soon ? " soon" : ""}"><b>${dl.days_left}</b> days left · due ${fmtDate(dl.due)} <span class="muted">(as of ${fmtDate(c.as_of)})</span></span>` : `<span class="deadline">Deadline: check the notice</span>`}
        </div>
        <p class="decision-why">${esc(v.line)} ${dl ? `<span class="muted">${esc(dl.citation)}${dl.verified ? "" : " · unverified"}.</span>` : ""}</p>
        ${driftFlag(rep, c.id, "denial")}
      </div>
      <div class="band-actions">${primary}<a class="btn ghost" href="#/worklist">${icon.back}Worklist</a></div>
      ${coastSvg()}
    </section>
    ${overviewHtml(c, run, matches)}
    <div class="workspace">
      <aside class="ledger" aria-label="Policy rules for this case">
        <div class="facts">
          <dl style="margin:0">
            <dt>Denial reason</dt><dd>${esc(d.reason_text)}${d.carc.length ? ` <span class="addr">reason code ${esc(d.carc.join(", "))}</span>` : ""}</dd>
            <dt>Triage</dt><dd>${esc(run.triage.explanation || run.triage.reason_class)} <span class="addr">${run.triage.method === "carc_table" ? "reason-code table, no model" : "Nemotron Nano"}</span></dd>
            ${run.policy ? `<dt>Policy in effect on ${fmtDate(d.dos)}</dt><dd>${esc(run.policy.title)} <span class="addr">${esc(c.policy_citation)}</span></dd>` : ""}
          </dl>
        </div>
        ${run.triage.checklist.length ? `<div class="facts"><dt>Fix checklist</dt>${run.triage.checklist.map((i) => `<dd>· ${esc(i)}</dd>`).join("")}</div>` : ""}
        ${matches.length ? `<h2>Rules that decide this case</h2>` : ""}
        ${live.map((m) => ruleHtml(m, label(m), policyAddr)).join("")}
        ${na.length ? `<button class="na-toggle" type="button" data-na>${na.length} more rules don't apply to this case</button><div data-na-list hidden>${na.map((m) => ruleHtml(m, label(m), policyAddr)).join("")}</div>` : ""}
      </aside>
      <section aria-label="Documents">
        <div class="tabs" role="tablist">
          ${run.policy ? `<button role="tab" data-tab="policy" aria-selected="true">Policy</button>` : ""}
          <button role="tab" data-tab="chart" aria-selected="${run.policy ? "false" : "true"}">Chart notes</button>
          <button role="tab" data-tab="letter" aria-selected="false">Denial letter</button>
          <button role="tab" data-tab="next" aria-selected="false">${run.appeal ? "Appeal letter" : run.doc_request ? "Documentation request" : "Next step"}</button>
        </div>
        <div data-pane></div>
      </section>
    </div>
    ${auditHtml(run, matches)}`;

  wireWorkspace({ c, run, matches, selected: null }, { policy: policyPane, chart: chartPane, letter: letterPane, next: nextPane });
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
  const show = (name) => {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    ctx.tab = name;
    $main.querySelector(".workspace").classList.toggle("letter-focus", name === "next" && !!run.appeal);
    pane.innerHTML = panes[name](ctx);
    settleBand(`${ctx.c.id}:${name}`);
    if (name === "next") wireAppeal(ctx, pane);
    if (ctx.selected) focusRule(ctx, ctx.selected, false);
  };
  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab)));
  ctx.expanded = new Set();
  $main.querySelectorAll("[data-chip]").forEach((chip) => chip.addEventListener("click", () => {
    const t = $main.querySelector(`.rule-toggle[data-rule="${chip.dataset.chip}"]`);
    if (!t) return;
    const naList = t.closest("[data-na-list]"); if (naList) naList.hidden = false;
    t.closest(".rule").scrollIntoView({ behavior: "smooth", block: "nearest" });
    t.click();
  }));
  $main.querySelectorAll("[data-why]").forEach((b) => b.addEventListener("click", () => {
    const box = b.closest(".rule").querySelector(".rule-more");
    box.hidden = !box.hidden; b.setAttribute("aria-expanded", String(!box.hidden));
    b.textContent = box.hidden ? "Why?" : "Hide why";
  }));
  // Linked hover: a rule card, its chips, its policy sentence and its chart quotes light up together.
  const hot = (id, on) => {
    $main.querySelectorAll(`[data-crit~="${id}"], .rule[data-rule="${id}"], [data-chip="${id}"]`).forEach((el) => el.classList.toggle("hot", on));
  };
  $main.addEventListener("mouseover", (e) => {
    const el = e.target.closest(".rule[data-rule], [data-crit], [data-chip]");
    const id = el && (el.dataset.rule || el.dataset.chip || el.dataset.crit.split(" ")[0]);
    if (id !== ctx.hotId) { if (ctx.hotId) hot(ctx.hotId, false); ctx.hotId = id; if (id) hot(id, true); }
  }, { signal });
  $main.addEventListener("click", (e) => {
    const fold = e.target.closest("[data-fold]");
    if (fold) { ctx.expanded.add(fold.dataset.fold); show(ctx.tab); return; }
    const g = e.target.closest("[data-goto]");
    if (!g || g.dataset.goto === "null") return;
    e.preventDefault();
    const [kind, ref] = g.dataset.goto.split(":");
    if (kind === "policy" && run.policy) {
      const n = Number(ref);
      const k = [...(ctx.foldIndex || [])].find(([, lo, hi]) => n >= lo && n <= hi);
      if (k) ctx.expanded.add(k[0]);
      show("policy");
      const el = pane.querySelector(`[data-s="${n}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector(".hl")?.classList.add("sweep");
    } else if (kind === "note") {
      show("chart");
      pane.querySelector(`[data-note="${CSS.escape(ref)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, { signal });
  $main.querySelectorAll("[data-tab-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.tabGo)));
  $main.querySelector("[data-copy-docreq]")?.addEventListener("click", async (e) => {
    await navigator.clipboard?.writeText(run.doc_request); e.currentTarget.lastChild.textContent = "Copied"; });
  $main.querySelector("[data-na]")?.addEventListener("click", (e) => {
    const l = $main.querySelector("[data-na-list]"); l.hidden = !l.hidden;
    e.currentTarget.textContent = l.hidden ? `${l.children.length} more rules don't apply to this case` : "Hide rules that don't apply"; });
  $main.querySelectorAll(".rule-toggle").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.dataset.rule;
      ctx.selected = ctx.selected === id ? null : id;
      $main.querySelectorAll(".rule-toggle").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.rule === ctx.selected)));
      if (ctx.selected) {
        const m = matches.find((x) => x.criterion_id === id);
        if (ctx.tab !== "policy" && ctx.tab !== "chart") show(run.policy ? "policy" : "chart");
        else if (ctx.tab === "chart" && !m.evidence.some((e) => e.verified) && run.policy) show("policy");
        focusRule(ctx, id, true);
      } else show(ctx.tab);
    });
  });
  show(run.policy ? "policy" : "chart");
}

const CONF = {
  agreed: "2 of 2 Nemotron Super votes agree",
  escalated: "Super votes split; Nemotron Ultra decided",
  single: "One Nemotron judgment",
  rule: "Decided by a fixed rule, no model",
};
function ruleHtml(m, [kind, word], policyAddr) {
  const ev = m.evidence.filter((e) => e.verified);
  const a = `${policyAddr}${m.addr ? " · " + m.addr : ""}`;
  const conf = m.confidence || "single";
  const evHtml = (e) => `<span class="rule-ev"><span class="q">“${esc(e.quote)}”</span><a class="addr link" href="#" data-goto="note:${esc(e.note_id)}">${esc(noteAddr(e.note_id))}</a></span>`;
  return `<article class="rule" data-rule="${m.criterion_id}">
    <button type="button" class="rule-toggle" data-rule="${m.criterion_id}" aria-pressed="false">
      <span class="rule-top">${mark(kind, word)}${conf === "escalated" ? '<span class="conf">Ultra decided</span>' : ""}</span>
      <span class="rule-sum">${esc(m.crit.summary)}</span>
    </button>
    ${m.addr ? `<a class="addr link rule-addr" href="#" data-goto="${gotoFor(m.addr)}">${esc(a)}</a>` : `<span class="addr rule-addr">${esc(a)}</span>`}
    ${ev.slice(0, 1).map(evHtml).join("")}
    <button type="button" class="why" data-why aria-expanded="false">Why?</button>
    <div class="rule-more" hidden>
      <span class="rule-why">${esc(m.rationale)}</span>
      ${ev.slice(1).map(evHtml).join("")}
      <span class="addr">${esc(CONF[conf])}${m.votes && m.votes.length ? " · " + esc(m.votes.join(", ")) : ""}</span>
    </div>
  </article>`;
}

// ---------- Overview: decision map + chart timeline ----------
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
function decisionMap(run, matches) {
  if (run.triage.route !== "clinical_review") {
    return `<ol class="strip short" aria-label="How the recommendation was reached">
      <li><span class="stage-h">Reason code ${esc(run.denial.carc.join(", ") || "—")}</span><span class="stage-s">${esc(run.triage.explanation.split(".")[0])}</span><span class="stage-n">Reason-code table, no model</span></li>
    </ol>`;
  }
  const cells = STAGES.map((st) => {
    const all = matches.filter((m) => st.kinds.includes(m.crit.kind));
    const shown = all.filter((m) => m.status !== "not_applicable" && m.show !== "route");
    const [k, word] = stageState(st, all.filter((m) => m.show !== "route"));
    const quiet = all.length - shown.length;
    return `<li>
      <span class="stage-h">${st.title}</span>
      <span class="stage-s">${mark({ ok: "met", bad: "not_met", warn: "missing_documentation", mute: "not_applicable" }[k], word)}</span>
      <span class="chips">${shown.map((m) => `<button type="button" class="chip ${m.status}" data-chip="${m.criterion_id}" title="${esc(m.crit.summary)}">${esc(m.addr || m.criterion_id)}</button>`).join("")}${quiet ? `<span class="chip-quiet">+${quiet} not relevant</span>` : ""}</span>
    </li>`;
  }).join("");
  return `<ol class="strip" aria-label="How the recommendation was reached">${cells}</ol>`;
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
    const waived = f.red_flags.length > 0;
    const met = t.from === "onset" ? dos >= at : (f.conservative_days || 0) >= t.days;
    return { ...t, at, state: waived ? "waived" : met ? "met" : "not_met" };
  }).filter(Boolean);
  const lo = Math.min(...[onset, ...tStarts, ...f.red_flags.map((r) => toMs(r.noted_on))].filter(Boolean), dos) - 4 * day;
  const hi = Math.max(dos, ...lines.map((l) => l.at)) + 6 * day;
  const pct = (ms) => ((ms - lo) / (hi - lo)) * 100;
  const x = (ms) => pct(ms).toFixed(2) + "%";
  // Lines that end close together put their labels on separate rows.
  [...lines].sort((a, b) => a.at - b.at).forEach((l, i, arr) => {
    l.row = i && pct(l.at) - pct(arr[i - 1].at) < 18 ? Math.min(arr[i - 1].row + 1, 2) : 0;
  });
  const rows = f.treatments.filter((t) => t.start && t.end);
  const label = (k) => k.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());
  const days = (a, b) => Math.round((toMs(b) - toMs(a)) / day);
  return `<section class="tl" aria-label="Chart timeline">
    <div class="tl-head"><h2>Chart timeline</h2><span class="addr">${f.symptom_days != null ? `symptom onset to MRI: ${f.symptom_days} days · ` : ""}conservative care: ${f.conservative_days ?? 0} days</span></div>
    <div class="tl-track" style="--rows:${rows.length}">
      ${lines.map((l) => `<span class="tl-line ${l.state}${pct(l.at) > 62 ? " flip" : ""}" style="left:${x(l.at)};--lr:${l.row}"><span class="tl-line-l">${esc(l.label)}</span></span>`).join("")}
      ${rows.map((t, i) => `<span class="tl-bar" style="left:${x(toMs(t.start))};width:calc(${x(toMs(t.end))} - ${x(toMs(t.start))});top:calc(54px + ${i} * 40px)"><span>${esc(label(t.kind))}${t.sessions ? ` · ${t.sessions} sessions` : ""} · ${days(t.start, t.end)} days${t.response ? " · " + esc(t.response.replace(/_/g, " ")) : ""}</span></span>`).join("")}
      ${Object.entries(f.red_flags.filter((r) => r.noted_on).reduce((g, r) => ((g[r.noted_on] ||= []).push(r.flag), g), {}))
          .map(([on, flags]) => `<span class="tl-flag" style="left:${x(toMs(on))}" title="${esc(flags.join(", "))}"><span>Red flag${flags.length > 1 ? "s" : ""}: ${esc(flags.join(", "))}</span></span>`).join("")}
      <span class="tl-axis"></span>
      ${onset ? `<span class="tl-pt${pct(onset) < 14 ? " start" : ""}" style="left:${x(onset)}"><b>Onset</b> ${fmtDate(f.onset)}</span>` : `<span class="tl-pt start" style="left:0"><b>Onset</b> not verified</span>`}
      <span class="tl-pt end" style="left:${x(dos)}"><b>${esc(mriLabel)}</b> ${fmtDate(run.denial.dos)}</span>
    </div>
    <ul class="tl-legend">${lines.map((l) => `<li>${mark(l.state === "met" ? "met" : l.state === "waived" ? "not_applicable" : "not_met", l.state === "met" ? "Met" : l.state === "waived" ? "Waived: red flags" : "Not met")} ${esc(l.label)} <a class="addr link" href="#" data-goto="policy:${l.sentence}">${esc(l.address)}</a></li>`).join("")}</ul>
  </section>`;
}
function overviewHtml(c, run, matches) {
  return decisionMap(run, matches);
}

function auditHtml(run, matches) {
  const t = run.trace;
  const model = (m) => m.split("/").pop();
  const esc2 = matches.filter((m) => m.confidence === "escalated").length;
  const agreed = matches.filter((m) => m.confidence === "agreed").length;
  return `<details class="audit">
    <summary>How this was decided <span class="muted">· ${t.length} model calls · $${run.cost_usd.toFixed(4)}${agreed + esc2 ? ` · ${agreed} rules agreed, ${esc2} escalated to Ultra` : ""}</span></summary>
    <div class="board"><table>
      <thead><tr><th>Step</th><th>Model</th><th class="num">Tokens in</th><th class="num">Tokens out</th><th class="num">Seconds</th><th class="num">Cost</th></tr></thead>
      <tbody>${t.map((s) => `<tr><td>${esc(s.step)}</td><td>${esc(model(s.model))}</td><td class="num">${s.prompt_tokens.toLocaleString()}</td><td class="num">${s.completion_tokens.toLocaleString()}</td><td class="num">${s.latency_s}</td><td class="num">$${s.cost_usd.toFixed(4)}</td></tr>`).join("")}
      <tr><td colspan="5"><b>Total for this case</b> <span class="muted">· NVIDIA Nemotron on Nebius Token Factory</span></td><td class="num"><b>$${run.cost_usd.toFixed(4)}</b></td></tr></tbody>
    </table></div>
  </details>`;
}

const trim = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

// Policy: the fetched text as a photocopied sheet. Rule sentences are highlighted; runs of
// background sentences fold into one line carrying their address range.
function policyPane(ctx) {
  const { run, c, matches } = ctx;
  const status = Object.fromEntries(matches.map((m) => [m.criterion_id, m.show === "route" ? "not_applicable" : m.status]));
  const sel = ctx.selected;
  const text = run.policy.text;
  const isHeading = (t) => !/[.:;)”"]$/.test(t.trim()) && t.length < 70 && !t.startsWith("•");
  const crits = (s) => s.criteria.filter((cid) => status[cid] && (status[cid] !== "not_applicable" || cid === sel));
  const marked = (s) => crits(s).length > 0;
  let html = "", para = [], lastHeading = "";
  ctx.foldIndex = [];
  const flush = () => { if (para.length) { html += `<p>${para.join(" ")}</p>`; para = []; } };
  const S = c.sentences;
  for (let i = 0; i < S.length; i++) {
    const s = S[i], t = s.text;
    if (isHeading(t)) { flush(); if (t.trim() !== lastHeading) html += `<div class="heading">${esc(t)}</div>`; lastHeading = t.trim(); continue; }
    if (!marked(s)) {
      let j = i;
      while (j + 1 < S.length && !marked(S[j + 1]) && !isHeading(S[j + 1].text)) j++;
      const key = `f${s.n}`;
      ctx.foldIndex.push([key, s.n, S[j].n]);
      if (j - i >= 2 && !ctx.expanded.has(key)) {
        flush();
        html += `<button type="button" class="fold" data-fold="${key}"><span class="addr">S${s.n}–S${S[j].n}</span> ${j - i + 1} sentences of background, not a rule <span class="fold-show">Show</span></button>`;
        i = j; continue;
      }
    }
    const gap = i ? text.slice(S[i - 1].end, s.start) : "";
    if (/\n\s*\n/.test(gap)) flush();
    const cs = crits(s);
    const pick = cs.includes(sel) ? sel : cs[0];
    const cls = pick ? `hl ${status[pick]}${pick === sel ? " sweep" : ""}` : "";
    const body = cls ? `<span class="${cls}" data-crit="${s.criteria.join(" ")}">${esc(t)}</span>` : esc(t);
    if (t.startsWith("•")) { flush(); html += `<p class="sent li" data-s="${s.n}"><span class="n">S${s.n}</span>${body}</p>`; }
    else para.push(`<span class="sent" data-s="${s.n}">${para.length ? `<sup class="ns">S${s.n}</sup>` : `<span class="n">S${s.n}</span>`}${body}</span>`);
  }
  flush();
  const fetched = (run.policy.fetched_at || "").slice(0, 10);
  return `<article class="sheet">
    <header class="sheet-head"><h2>${esc(run.policy.title)}</h2><span class="addr">${esc(c.policy_citation)} · fetched ${fmtDate(fetched)} · ${S.length} sentences · <a class="link" href="${esc(run.policy.url)}" target="_blank" rel="noopener">source</a></span></header>
    ${html}
  </article>`;
}

function chartPane(ctx) {
  const { c, matches } = ctx;
  const sel = ctx.selected;
  return `${timelineHtml(c, ctx.run, ctx.mriLabel)}<article class="sheet notes">
    <header class="sheet-head"><h2>Chart notes</h2><span class="addr">${c.notes.length} notes · synthetic patient</span></header>
    ${c.notes.map((n) => {
      const marks = [];
      matches.forEach((m) => m.evidence.forEach((e) => {
        if (e.verified && e.note_id === n.note_id && e.start != null && (m.status !== "not_applicable" || m.criterion_id === sel))
          marks.push({ a: e.start, b: e.end, cls: (m.show === "route" ? "not_applicable" : m.status) + (m.criterion_id === sel ? " sweep" : ""), rule: m.criterion_id });
      }));
      marks.sort((x, y) => x.a - y.a || (y.rule === sel) - (x.rule === sel));
      let out = "", at = 0;
      for (const mk of marks) { if (mk.a < at) continue; out += esc(n.text.slice(at, mk.a)) + `<span class="hl ${mk.cls}" data-crit="${mk.rule}">${esc(n.text.slice(mk.a, mk.b))}</span>`; at = mk.b; }
      out += esc(n.text.slice(at));
      return `<section class="note" data-note="${n.note_id}"><div class="note-h">${fmtDate(n.date)} · ${esc(n.note_type.replace(/_/g, " "))} · ${esc(n.author_role)} <span class="addr">${esc(noteAddr(n.note_id))}</span></div>${out}</section>`;
    }).join("")}
  </article>`;
}

function letterPane(ctx) {
  const d = ctx.run.denial;
  return `<figure style="margin:0"><img class="letter-img" src="/api/cases/${ctx.c.id}/letter" alt="Synthetic faxed denial notice for ${esc(ctx.c.patient)}">
    <figcaption class="addr" style="margin-top:8px;white-space:normal">Read by ${esc((d.extracted_by || "").split("/").pop() || "model")}. Fictional test notice, not issued by any insurer.</figcaption></figure>`;
}

function nextPane(ctx) {
  const { run, matches } = ctx;
  if (run.appeal) {
    return `<div class="appeal">
      <div>
        <div class="letter-tools">
          <div class="seg" role="group" aria-label="Letter view"><button type="button" data-mode="read" aria-pressed="true">Letter</button><button type="button" data-mode="edit" aria-pressed="false">Edit text</button></div>
          <span class="muted" style="font-size:13px">Reconsideration request · drafted by Nemotron 3 Ultra, reviewed by Super</span>
        </div>
        <p class="muted" style="font-size:13px;margin:0 0 10px">The rules and their evidence are on the Policy and Chart notes tabs.</p>
        <article class="sheet letter" data-letter aria-live="polite"></article>
        <label class="sr" for="letter">Letter text</label>
        <textarea id="letter" class="editor" spellcheck="true" hidden>${esc(run.appeal.rendered)}</textarea>
        ${run.appeal.critique.length ? `<details class="critique"><summary>Payer-reviewer critique addressed in revision ${run.appeal.revision}</summary><ul>${run.appeal.critique.map((x) => `<li><b>${esc(x.severity)}</b>: ${esc(x.issue)} <span class="muted">→ ${esc(x.suggestion)}</span></li>`).join("")}</ul></details>` : ""}
      </div>
      <aside class="gate" aria-live="polite" data-gate><p class="muted">Checking quotes…</p></aside>
    </div>`;
  }
  if (run.doc_request) return `<article class="sheet notes"><header class="sheet-head"><h2>Documentation request to the physician</h2><button class="btn ghost" data-copy2>${icon.copy}Copy</button></header><pre class="docreq">${esc(run.doc_request)}</pre></article>`;
  const blockers = matches.filter((m) => m.status === "not_met");
  return `<article class="sheet notes"><header class="sheet-head"><h2>${esc(VERDICT[run.verdict].label)}</h2></header>
    <p>${esc(VERDICT[run.verdict].line)}</p>
    ${blockers.length ? `<p class="heading">What the chart doesn't meet yet</p>${blockers.map((m) => `<p><span class="hl not_met">${esc(m.crit.verbatim_span.slice(0, 260))}</span><br><span class="muted">${esc(m.rationale)}</span></p>`).join("")}` : ""}
    ${run.triage.checklist.length ? `<p class="heading">Checklist</p>${run.triage.checklist.map((i) => `<p>· ${esc(i)}</p>`).join("")}` : ""}
  </article>`;
}

function focusRule(ctx, id, scroll) {
  const pane = $main.querySelector("[data-pane]");
  pane.innerHTML = ({ policy: policyPane, chart: chartPane })[ctx.tab]?.(ctx) ?? pane.innerHTML;
  if (!scroll) return;
  const el = [...pane.querySelectorAll("[data-crit]")].find((x) => x.dataset.crit.split(" ").includes(id));
  el?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
}

const squash = (t) => t.replace(/\s+/g, " ").trim();

// Typeset the letter: headings, quotes as highlighted blocks with their addresses,
// tampered quotes struck in pink with the source sentence beside them.
function renderLetter(text, gate) {
  const checks = gate ? gate.checks : [];
  const find = (q) => checks.find((c) => squash(c.text) === squash(q));
  const lines = text.split("\n");
  let out = "", para = [], quote = [], cite = "";
  const flushPara = () => {
    if (!para.length) return;
    let h = esc(para.join(" "));
    checks.filter((c) => c.status !== "verified" && !c.text.includes("\n")).forEach((c) => {
      const e = esc(c.text);
      if (h.includes(e)) h = h.replace(e, `<span class="struck">${e}</span>`);
    });
    out += `<p>${h}</p>`; para = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const q = quote.join("\n"), c = find(q);
    if (!c || c.status === "verified") {
      out += `<blockquote class="lq"><span class="hl quote">${esc(squash(q))}</span><cite>${esc(cite)}${c && c.address ? ` · <a class="link" href="#" data-goto="${gotoFor(c.address) || "note:" + esc(c.source_id || "")}">${esc(c.address)}</a>` : ""}</cite></blockquote>`;
    } else {
      out += `<blockquote class="lq bad"><span class="void">VOID</span><span class="struck">${esc(squash(q))}</span><cite>Not found in any fetched source${cite ? " · claimed: " + esc(cite) : ""}</cite>${c.closest ? `<span class="closest">Source says: <span class="hl quote">${esc(c.closest.text)}</span> <span class="addr">${esc(c.closest.address || "")}</span></span>` : ""}</blockquote>`;
    }
    quote = []; cite = "";
  };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (l.startsWith(">")) {
      flushPara();
      const body = l.replace(/^>\s?/, "");
      if (/^(—|--)/.test(body)) { cite = body.replace(/^(—|--)\s*/, ""); flushQuote(); }
      else if (body) quote.push(body);
      continue;
    }
    flushQuote();
    if (/^#{1,6}\s/.test(l)) { flushPara(); out += `<h3>${esc(l.replace(/^#+\s*/, ""))}</h3>`; }
    else if (!l.trim()) flushPara();
    else para.push(l.trim());
  }
  flushQuote(); flushPara();
  return out;
}

function wireAppeal(ctx, pane) {
  const ta = pane.querySelector("#letter");
  pane.querySelector("[data-copy2]")?.addEventListener("click", () => navigator.clipboard?.writeText(ctx.run.doc_request));
  if (!ta) return;
  const box = pane.querySelector("[data-gate]");
  const sheet = pane.querySelector("[data-letter]");
  let t, seq = 0, last = null;
  pane.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
    const edit = b.dataset.mode === "edit";
    pane.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    ta.hidden = !edit; sheet.hidden = edit;
    if (edit) ta.focus(); else sheet.innerHTML = renderLetter(ta.value, last);
  }));
  const run = async () => {
    const mine = ++seq;
    let g;
    try { g = await api("/api/gate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: ctx.c.id, text: ta.value }) }); }
    catch (e) { box.innerHTML = `<p class="err">Couldn't check quotes: ${esc(e.message)}</p>`; return; }
    if (mine !== seq) return;
    last = g;
    if (!sheet.hidden) sheet.innerHTML = renderLetter(ta.value, g);
    const bad = g.checks.filter((x) => x.status !== "verified").length;
    box.innerHTML = `
      <div class="gate-head"><h3>Citation gate</h3>${mark(g.ok ? "met" : "not_met", g.ok ? "Every quote verified" : bad === 1 ? "1 quote doesn't match" : `${bad} quotes don't match`)}</div>
      <p class="verdict-line">${g.ok ? "Each quoted line matches the policy fetched for this case or the chart, word for word." : esc(g.reason || "Fix the quotes marked below.")}</p>
      <ol>${g.checks.map((x) => `<li class="${x.status === "verified" ? "" : "bad"}">${x.status === "verified" ? "" : '<span class="void">VOID</span>'}<span class="q ${x.status === "verified" ? "hl quote" : ""}">${esc(squash(x.text))}</span>
        <span class="src">${x.status === "verified" ? `matches <a class="link" href="#" data-goto="${gotoFor(x.address) || "note:" + esc(x.source_id)}">${esc(x.address || x.source_id)}</a>` : "not found in any fetched source"}</span>
        ${x.closest ? `<span class="closest">Source says: <span class="hl quote">${esc(x.closest.text)}</span> <span class="addr">${esc(x.closest.address || "")}</span></span>` : ""}</li>`).join("")}</ol>
      <button class="btn" data-export ${g.ok ? "" : "disabled"}>${icon.download}Export letter</button>
      <p class="muted" style="font-size:12.5px;margin:0">A person reviews and sends this letter. Denial Auditor never submits anything.</p>`;
    box.querySelector("[data-export]").addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([ta.value], { type: "text/markdown" }));
      a.download = `${ctx.c.id}_reconsideration.md`; a.click(); URL.revokeObjectURL(a.href);
    });
  };
  sheet.innerHTML = renderLetter(ta.value, null);
  ta.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 350); });
  run();
}

// ---------------- Live ----------------
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
async function liveView() {
  setNav("live");
  document.title = "Run live · Denial Auditor";
  const data = state.cases || (state.cases = await api("/api/cases"));
  $main.innerHTML = `
    <header class="page-head"><div><h1 class="page-title">Run a case live</h1>
      <p class="lede">The whole pipeline on a synthetic case, live: Nemotron on Nebius Token Factory, Tavily for commercial policies. One to three minutes, a few cents.</p></div></header>
    <div class="live">
      <form class="panel" data-live>
        ${data.live_enabled ? "" : `<p class="err">Live runs are switched off on this deployment. The precomputed cases in the worklist are free to explore.</p>`}
        <div class="field"><label for="pc">Passcode</label><input id="pc" class="input" type="password" autocomplete="off" value="${esc(state.passcode)}" placeholder="From the Devpost testing instructions"></div>
        <div class="field"><label for="cs">Synthetic case</label><select id="cs" class="input">${data.available.map((id) => `<option value="${id}">${id.replace("case_", "Case ")}</option>`).join("")}</select></div>
        <button class="btn" type="submit" ${data.live_enabled ? "" : "disabled"}>${icon.play}Run live</button>
        <p class="muted" style="font-size:12.5px;margin:0">Limited to 30 live runs per day across all visitors; a spending cap stops any run that would exceed this demo's budget.</p>
      </form>
      <section class="panel" aria-live="polite" data-progress><p class="muted">Progress appears here, step by step.</p></section>
    </div>`;
  $main.querySelector("[data-live]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.currentTarget.querySelector("button[type=submit]");
    const prog = $main.querySelector("[data-progress]");
    state.passcode = $main.querySelector("#pc").value;
    const case_id = $main.querySelector("#cs").value;
    btn.disabled = true;
    let job;
    try { job = (await api("/api/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id, passcode: state.passcode }) })).job; }
    catch (err) { prog.innerHTML = `<p class="err">${esc(err.message)}</p>`; btn.disabled = false; return; }
    const t0 = Date.now();
    const poll = async () => {
      const s = await api(`/api/live/${job}`);
      // Map progress messages onto the fixed pipeline stages.
      const reached = LIVE_STAGES.map((st) => s.steps.findIndex((m) => m.startsWith(st.match)));
      const lastIdx = Math.max(-1, ...reached.map((r, i) => (r >= 0 ? i : -1)));
      const secs = Math.round((Date.now() - t0) / 1000);
      prog.innerHTML = `<div class="gate-head"><h2 class="side-h" style="margin:0">${s.state === "done" ? "Finished" : s.state === "error" ? "Stopped" : "Running"}</h2><span class="addr">${secs}s</span></div>
        <ol class="pipeline">${LIVE_STAGES.map((st, i) => {
          const msg = reached[i] >= 0 ? s.steps[reached[i]] : "";
          const cls = reached[i] < 0 ? (i < lastIdx ? "pl-skip" : "pl-todo") : (i === lastIdx && s.state === "running" ? "pl-now" : "pl-done");
          return `<li class="${cls}"><span class="pl-dot" aria-hidden="true"></span><span class="pl-t">${esc(st.title)}</span>${msg ? `<span class="pl-m">${esc(msg)}</span>` : cls === "pl-skip" ? `<span class="pl-m">Not needed for this denial</span>` : ""}</li>`;
        }).join("")}</ol>
        ${s.error ? `<p class="err">${esc(s.error)}</p>` : ""}
        ${s.state === "done" ? `<a class="btn" href="#/case/${case_id}">Open the evidence board</a>` : ""}`;
      if (s.state === "running") setTimeout(poll, 1000);
      else { btn.disabled = false; state.cases = null; }
    };
    poll();
  });
}

// ---------------- Before you submit (prevention) ----------------
// Readiness reuses the verdict colours: ready = appeal, add docs = ask, not yet = don't appeal.
const READY = {
  ready:             { label: "Ready to submit", v: "appeal", line: "The chart meets the policy in effect on the planned date. Submit the prior-auth request." },
  add_documentation: { label: "Add documentation first", v: "doc_request", line: "A route to coverage is met, but something the policy asks for isn't in the chart yet. Ask the physician before submitting." },
  not_yet:           { label: "Not yet", v: "dont_appeal", line: "The chart, as documented, falls short of a waiting period in the policy. Submitting now would likely be denied." },
  doesnt_qualify:    { label: "Doesn't qualify", v: "not_winnable", line: "The chart doesn't meet this policy, and waiting won't change that. Review the rules below with the physician." },
};

async function checksView() {
  setNav("check");
  document.title = "Before you submit · Denial Auditor";
  const data = await api("/api/checks");
  const rep = await drift();
  $main.innerHTML = `
    <header class="page-head"><div>
      <h1 class="page-title">Before you submit</h1>
      <p class="lede">Prior-auth requests checked against the payer's policy before they go out.</p>
      ${watchLine(rep)}
    </div></header>
    <div class="board">
      ${data.checks.length ? `<table>
        <thead><tr><th scope="col">Readiness</th><th scope="col">Patient</th><th scope="col" class="hide-sm">Payer</th><th scope="col">Planned MRI</th><th scope="col" class="hide-sm">Earliest date</th><th scope="col" class="hide-sm">Policy</th></tr></thead>
        <tbody>${data.checks.map((r) => `<tr>
          <td>${mark("v-" + READY[r.readiness].v, READY[r.readiness].label)}</td>
          <td class="who"><a href="#/check/${r.id}">${esc(r.patient)}</a><div class="addr">${esc(r.id.replace("case_", "Chart "))} · CPT ${esc(r.cpt)}</div></td>
          <td class="hide-sm">${esc(payerShort(r.payer))}</td>
          <td>${fmtDate(r.planned_dos)}</td>
          <td class="hide-sm">${r.earliest ? fmtDate(r.earliest) : `<span class="muted">—</span>`}</td>
          <td class="hide-sm"><span class="addr">${esc(r.policy || "")}</span></td>
        </tr>`).join("")}</tbody>
      </table>` : `<p class="empty">No prior-auth checks yet. Build them with <code>scripts/precompute.py --checks</code>.</p>`}
    </div>`;
}

async function checkView(id) {
  setNav("check");
  $main.innerHTML = `<div class="skeleton" style="width:55%;height:34px;margin-bottom:22px"></div><div class="skeleton" style="height:480px"></div>`;
  let c;
  try { c = await api(`/api/checks/${encodeURIComponent(id)}`); }
  catch (e) { $main.innerHTML = `<p class="empty">${esc(e.message)}</p>`; return; }
  const ch = c.check, r = ch.request, rd = READY[ch.readiness];
  const rep = await drift();
  document.title = `${c.patient} · Before you submit · Denial Auditor`;
  // The board renderers take a run; a check is shaped like one with the planned date as the service date.
  const run = { ...ch, denial: { dos: r.planned_dos }, triage: { route: "clinical_review" }, appeal: null, verdict: rd.v };
  const byId = Object.fromEntries(ch.criteria.map((x) => [x.criterion_id, x]));
  const matches = ch.matches.map((m) => ({ ...m, crit: byId[m.criterion_id], addr: c.addresses[m.criterion_id] }));
  const label = (m) => (m.status === "not_met" && m.crit.kind === "indication" && ch.readiness === "ready") ? ["route", "Route not used"] : [m.status, STATUS[m.status]];
  const rank = { not_met: 0, missing_documentation: 1, met: 2, route: 3, not_applicable: 4 };
  matches.forEach((m) => { m.show = label(m)[0]; });
  const shown = matches.filter((m) => m.status !== "not_applicable").sort((a, b) => rank[a.show] - rank[b.show]);
  const na = matches.filter((m) => m.status === "not_applicable");
  NOTE_DATES = Object.fromEntries(c.notes.map((n) => [n.note_id, n.date]));
  const policyAddr = ch.policy ? ch.policy.policy_id : "";

  $main.innerHTML = `
    ${bandOpen(rd.v, c.id)}
      <div>
        <div class="case-who"><span><b>${esc(c.patient)}</b> (synthetic)</span><span>${esc(payerShort(r.payer_name))} · ${esc(r.plan_type.replace(/_/g, " "))}</span><span>Lumbar MRI · CPT ${esc(r.cpt)}</span><span>Planned ${fmtDate(r.planned_dos)}</span></div>
        <div class="decision">
          <h1>${display(rd.label)}</h1>
          ${ch.earliest ? `<span class="deadline">Earliest date <b>${fmtDate(ch.earliest)}</b></span>` : ""}
        </div>
        <p class="decision-why">${esc(rd.line)}</p>
        ${driftFlag(rep, c.id, "prior_auth")}
      </div>
      <div class="band-actions">${ch.doc_request ? `<button class="btn" data-copy-docreq>${icon.copy}Copy documentation request</button>` : `<button class="btn" data-tab-go="next">${{ ready: "See next step", not_yet: "See the earliest date", doesnt_qualify: "See why" }[ch.readiness]}</button>`}<a class="btn ghost" href="#/check">${icon.back}All requests</a></div>
      ${coastSvg()}
    </section>
    ${overviewHtml(c, run, matches)}
    <div class="workspace">
      <aside class="ledger" aria-label="Policy rules for this request">
        <div class="facts"><dl style="margin:0">
          <dt>Policy in effect on ${fmtDate(r.planned_dos)}</dt><dd>${esc(ch.policy.title)} <span class="addr">${esc(c.policy_citation)}</span></dd>
          ${ch.earliest ? `<dt>How the earliest date is worked out</dt>${ch.earliest_basis.map((b) => `<dd>${esc(b)}</dd>`).join("")}<dd class="muted">Worked out in code from verified chart dates, assuming conservative care continues. Re-check the chart before submitting.</dd>` : ""}
        </dl></div>
        <h2>Rules that decide this request</h2>
        ${shown.map((m) => ruleHtml(m, label(m), policyAddr)).join("")}
        ${na.length ? `<button class="na-toggle" type="button" data-na>${na.length} more rules don't apply to this case</button><div data-na-list hidden>${na.map((m) => ruleHtml(m, label(m), policyAddr)).join("")}</div>` : ""}
      </aside>
      <section aria-label="Documents">
        <div class="tabs" role="tablist">
          <button role="tab" data-tab="policy" aria-selected="true">Policy</button>
          <button role="tab" data-tab="chart" aria-selected="false">Chart notes</button>
          <button role="tab" data-tab="next" aria-selected="false">${ch.doc_request ? "Documentation request" : "Next step"}</button>
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
  if (run.doc_request) return nextPane(ctx);
  const blockers = matches.filter((m) => m.status === "not_met" && m.show !== "route");
  return `<article class="sheet notes"><header class="sheet-head"><h2>${esc(rd.label)}</h2></header>
    <p>${esc(rd.line)}</p>
    ${run.earliest ? `<p>Earliest date the chart can meet the policy: <span class="hl quote">${fmtDate(run.earliest)}</span>. ${run.earliest <= run.request.planned_dos
      ? `That's on or before the planned date, so the date can stand if the chart documents conservative care through ${fmtDate(run.earliest)}.`
      : "Move the MRI to that date or later."} Re-check the chart before submitting.</p>` : ""}
    ${blockers.length ? `<p class="heading">What the chart doesn't meet yet</p>${blockers.map((m) => `<p><span class="hl not_met">${esc(m.crit.verbatim_span.slice(0, 260))}</span><br><span class="muted">${esc(m.rationale)}</span></p>`).join("")}` : ""}
    <p class="muted">Denial Auditor never submits anything. A person reviews and sends every request.</p>
  </article>`;
}

// ---------------- How it works ----------------
function howView() {
  setNav("how");
  document.title = "How it works · Denial Auditor";
  $main.innerHTML = `<article class="read">
    <h1 class="page-title">How Denial Auditor works</h1>
    <p class="lede">Payers check an MRI order criterion by criterion. Denial Auditor lets a three-doctor practice do the same, and shows its working.</p>
    <h2>From a faxed denial to a decision</h2>
    <ol>
      <li><b>Read the denial.</b> Nemotron 3.5 Super-VL reads the scanned notice into structured fields: payer, codes, dates, the stated reason.</li>
      <li><b>Triage.</b> Reason codes route administrative denials to a fix checklist and plan exclusions to “not winnable”, using a fixed table and no model.</li>
      <li><b>Find the policy in force on the date of service.</b> Medicare coverage policies come from the CMS Coverage API, which keeps every version with its effective dates. Commercial bulletins such as Aetna's are located at runtime with Tavily search.</li>
      <li><b>Split the policy into rules.</b> Code numbers every sentence of the fetched policy; Nemotron 3 Super only picks sentence numbers. Each rule is therefore the payer's own wording, cut from the source.</li>
      <li><b>Check each rule against the chart.</b> Nemotron judges whether each rule supports coverage, blocks it, doesn't apply, or isn't documented, and quotes the chart. Code verifies every quote and computes every duration from dates.</li>
      <li><b>Decide.</b> A fixed rule, not a model, turns those judgments into one recommendation: appeal, ask the physician, don't appeal yet, fix and resubmit, or not winnable.</li>
      <li><b>Write the appeal.</b> Nemotron 3 Ultra drafts the letter using only pre-verified quotes, Super critiques it as the payer's medical reviewer, and Ultra revises. The citation gate blocks export unless every quote matches its source word for word.</li>
    </ol>
    <h2>Before a request goes out</h2>
    <p><b>Before you submit</b> runs the same steps on a prior-auth request, using the policy version in effect on the planned date. If the chart falls short of a waiting period, such as four weeks of conservative care, code works out the earliest date it's met from the chart's own dates. No model guesses a date.</p>
    <h2>When a policy changes</h2>
    <p>The <b>policy watch</b> runs every night beside the app and calls no model. It compares each open case's cited policy with the live source: a newer CMS version, or changed text in the Aetna bulletin. It flags only the cases whose service date the change covers, and names the rules whose wording moved.</p>
    <h2>What it never does</h2>
    <p>It never submits anything; a person reviews and sends every letter. Deadlines come from a fixed table checked against federal regulations, never from a model. CPT codes are shown bare, without AMA descriptions. All patients and notices in this demo are synthetic.</p>
  </article>`;
}

// ---------------- Router ----------------
async function route() {
  const [, view, id] = location.hash.split("/");
  state.board?.abort();
  try {
    if (view === "case") await caseView(id);
    else if (view === "live") await liveView();
    else if (view === "check") await (id ? checkView(id) : checksView());
    else if (view === "how") howView();
    else await worklist();
  } catch (e) {
    $main.innerHTML = `<p class="empty err">Something went wrong loading this page: ${esc(e.message)}</p>`;
  }
  $main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
addEventListener("hashchange", route);
route();
