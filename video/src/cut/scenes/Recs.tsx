import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Recording } from "../Recording";
import { SANS } from "../fonts";
import { C } from "../theme";
import { clamp, easeOut } from "../timeline";
import { Caption, Glyph } from "../ui";

// App scenes. Camera keys and callouts are in scene seconds (aligned to the narration) and point at recording
// coordinates (1920x1080). Beats per clip come from scripts/record.py; after re-recording, check stills and nudge
// `from`/`rate` first, keys second.
const sec = (s: number) => Math.round(s * 30);
type P = { dur: number };

// worklist (10.3 s): "every denial, ranked by what to do and when it's due … deadlines from a rules table"
export const Worklist: React.FC<P> = ({ dur }) => (
  <Recording clip="worklist" dur={dur} rate={1.2}
    cam={[
      { t: 0, x: 960, y: 540, s: 1.0 },
      { t: 1.4, x: 470, y: 520, s: 1.6, d: 1.0 },
      { t: 3.6, x: 520, y: 560, s: 1.75, d: 1.6 },
      { t: 5.9, x: 1130, y: 400, s: 2.05, d: 0.7 },
    ]}
    callouts={[
      { t0: 1.6, t1: 3.4, box: [330, 300, 470, 850], label: "What to do", tone: "ink", dim: false },
      { t0: 3.5, t1: 5.5, box: [548, 280, 630, 850], label: "Days left", tone: "hi" },
      { t0: 6.3, t1: 10.3, box: [998, 350, 1272, 448], label: "From a rules table, not the model", tone: "hi", below: true },
    ]}>
    <Caption text="Every denial, ranked." end={dur + 8} />
  </Recording>
);

// case (11.3 s): open Drew Exemplar; the payer's reason; the fax, read; reason code 50 routes it
export const Case: React.FC<P> = ({ dur }) => (
  <Recording clip="case" dur={dur} from={3.5} rate={1.2}
    cam={[
      { t: 0, x: 470, y: 320, s: 1.7 },
      { t: 2.3, x: 1352, y: 240, s: 2.05, d: 0.6 },
      { t: 5.6, x: 930, y: 760, s: 1.45, d: 0.6 },
      { t: 8.0, x: 1380, y: 840, s: 2.0, d: 0.7 },
    ]}
    callouts={[
      { t0: 0.4, t1: 1.6, box: [278, 268, 634, 336], tone: "ink", dim: false },
      { t0: 2.5, t1: 5.2, box: [1150, 162, 1556, 304], label: "No x-ray first?", tone: "neg" },
      { t0: 6.0, t1: 7.6, box: [700, 570, 1140, 945], label: "Nemotron reads the fax", tone: "ink" },
      { t0: 8.3, t1: 11.3, box: [1180, 838, 1582, 878], label: "Code 50 → clinical review", tone: "hi", below: true },
    ]}>
    <Caption text="It reads the fax." end={dur + 8} />
  </Recording>
);

// rules (14.8 s): the policy in force on the service date; rules in the payer's words; quotes found by code
export const Rules: React.FC<P> = ({ dur }) => (
  <Recording clip="rules" dur={dur} rate={1.3}
    cam={[
      { t: 0, x: 1340, y: 270, s: 2.1 },
      { t: 3.0, x: 1130, y: 520, s: 1.35, d: 0.7 },
      { t: 5.4, x: 1150, y: 670, s: 1.9, d: 0.7 },
      { t: 9.4, x: 1000, y: 490, s: 1.95, d: 0.6 },
      { t: 11.9, x: 1130, y: 560, s: 1.2, d: 0.8 },
    ]}
    sweeps={[{ t0: 5.6, t1: 9.0, lines: [[738, 625, 1525, 648], [738, 648, 1545, 671], [738, 671, 1565, 694], [738, 694, 915, 717]] }]}
    callouts={[
      { t0: 0.4, t1: 2.6, box: [1160, 256, 1546, 294], label: "In force on the service date", tone: "hi", below: true },
      { t0: 5.4, t1: 9.0, box: [736, 620, 1568, 720], label: "The payer's own words", tone: "hi" },
      { t0: 9.5, t1: 11.4, box: [750, 395, 1540, 535], label: "Found word for word", tone: "verified" },
      { t0: 12.0, t1: 14.8, box: [690, 90, 1580, 880], label: "No rule asks for an x-ray", tone: "ink", dim: false },
    ]}>
    <Caption text="The payer's policy, rule by rule." end={dur + 8} />
  </Recording>
);

// appeal (10.9 s): a fixed rule says appeal; the draft; the citation gate
export const Appeal: React.FC<P> = ({ dur }) => (
  <Recording clip="appeal" dur={dur} rate={1.35}
    cam={[
      { t: 0, x: 900, y: 200, s: 2.1 },
      { t: 2.6, x: 1130, y: 720, s: 1.35, d: 0.6 },
      { t: 4.8, x: 1100, y: 520, s: 1.7, d: 0.6 },
      { t: 7.4, x: 1130, y: 600, s: 1.25, d: 0.7 },
    ]}
    callouts={[
      { t0: 0.3, t1: 2.3, box: [706, 158, 1090, 240], label: "A fixed rule: appeal", tone: "pos", below: true },
      { t0: 5.0, t1: 7.2, box: [728, 395, 1474, 662], label: "Every quote checked", tone: "verified" },
      { t0: 7.7, t1: 10.9, box: [690, 70, 1135, 98], label: "All match", tone: "verified", below: true },
      { t0: 7.7, t1: 10.9, box: [1458, 905, 1580, 933], tone: "verified", dim: false },
    ]}>
    <Caption text="Every quote, checked against its source." end={dur + 8} />
  </Recording>
);

// The export lock: snaps shut with a shake, springs open green when the quote is fixed.
const Lock: React.FC<{ lockAt: number; openAt: number }> = ({ lockAt, openAt }) => {
  const f = useCurrentFrame();
  const show = interpolate(f, [lockAt - 8, lockAt], [0, 1], { ...clamp, easing: easeOut });
  const snap = interpolate(f, [lockAt - 3, lockAt], [0, 1], clamp);
  const open = interpolate(f, [openAt, openAt + 6], [0, 1], { ...clamp, easing: easeOut });
  const shake = f >= lockAt && f < lockAt + 9 ? Math.sin((f - lockAt) * 3) * (9 - (f - lockAt)) * 1.8 : 0;
  const bounce = f >= openAt ? interpolate(f, [openAt, openAt + 5, openAt + 10, openAt + 16], [1, 1.16, 0.96, 1], clamp) : 1;
  const col = open > 0.5 ? C.pos : C.neg;
  const lift = (1 - snap) * -3 + open * -3.2;
  return (
    <div style={{ position: "absolute", right: 72, bottom: 64, display: "flex", alignItems: "center", gap: 22, padding: "18px 34px 18px 22px",
      borderRadius: 999, background: C.surface, boxShadow: "0 12px 40px rgba(14,15,12,0.18)", opacity: show,
      transform: `translateX(${shake}px) scale(${bounce})`, fontFamily: SANS }}>
      <svg width={66} height={66} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="12" fill={col} />
        <g transform={`translate(0 ${lift})`}>
          <path d={open > 0.5 ? "M8.4 10.8V8.6a3.6 3.6 0 0 1 7.2 0V9.2" : "M8.4 11V8.6a3.6 3.6 0 0 1 7.2 0V11"} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <rect x="6.6" y="10.6" width="10.8" height="7.6" rx="1.8" fill="#fff" />
      </svg>
      <span style={{ fontSize: 44, fontWeight: 560, color: col, letterSpacing: "-0.02em" }}>{open > 0.5 ? "Export open" : "Export locked"}</span>
    </div>
  );
};

// tamper (13.3 s): change one word; the quote is void; export locks; fix it, it opens
export const Tamper: React.FC<P> = ({ dur }) => (
  <Recording clip="tamper" dur={dur} from={0.6} rate={1.3}
    cam={[
      { t: 0, x: 1340, y: 580, s: 2.0 },
      { t: 1.4, x: 1000, y: 560, s: 1.7, d: 0.4 },
      { t: 4.4, x: 1110, y: 760, s: 1.35, d: 0.5 },
      { t: 6.6, x: 1160, y: 580, s: 1.95, d: 0.45 },
      { t: 10.4, x: 1300, y: 580, s: 1.75, d: 0.8 },
    ]}
    callouts={[
      { t0: 4.6, t1: 6.3, box: [735, 540, 1480, 800], label: "Not in source", tone: "neg" },
      { t0: 6.8, t1: 10.0, box: [700, 566, 1032, 592], label: "1 quote doesn't match", tone: "neg", below: true },
    ]}>
    <Caption text="Change one word. Export locks." end={sec(10)} />
    <Caption text="A person always sends it." start={sec(10.2)} end={dur + 8} />
    <Lock lockAt={sec(7.6)} openAt={sec(11.8)} />
  </Recording>
);

// The documentation request slides across the desk like a note handed over.
const Note: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 16], [0, 1], { ...clamp, easing: easeOut });
  if (p <= 0) return null;
  return (
    <div style={{ position: "absolute", right: 90, top: 150, width: 640, padding: "34px 40px 38px", background: C.surface, borderRadius: 10,
      boxShadow: "0 30px 80px rgba(14,15,12,0.28)", transform: `translateX(${(1 - p) * 900}px) rotate(${2.5 - (1 - p) * 8}deg)`, fontFamily: SANS }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: C.warn, fontWeight: 560 }}>
        <Glyph name="ring" size={26} color={C.warnFill} /> To the physician
      </div>
      <div style={{ fontSize: 40, lineHeight: 1.25, color: C.ink, marginTop: 18, letterSpacing: "-0.015em" }}>
        “Please don't add anything that didn't happen; only document care that was actually provided.”
      </div>
    </div>
  );
};

// physician (9.1 s): Indigo Testdata — ask the physician, quoting the rule
export const Physician: React.FC<P> = ({ dur }) => (
  <Recording clip="physician" dur={dur} rate={1.2}
    cam={[
      { t: 0, x: 860, y: 200, s: 2.0 },
      { t: 3.6, x: 1130, y: 640, s: 1.6, d: 0.5 },
      { t: 6.0, x: 1000, y: 880, s: 1.5, d: 0.7 },
    ]}
    callouts={[
      { t0: 0.4, t1: 2.9, box: [706, 158, 1000, 192], label: "Ask the physician", tone: "warn", below: true },
      { t0: 3.8, t1: 5.8, box: [686, 628, 1582, 688], label: "The rule, quoted", tone: "warn" },
    ]}>
    <Note at={sec(5.6)} />
    <Caption text="Missing evidence? Ask, don't guess." end={dur + 8} />
  </Recording>
);

// 38 of 42 days of therapy, ticked off, then the earliest date pops.
const Days: React.FC<{ at: number; popAt: number }> = ({ at, popAt }) => {
  const f = useCurrentFrame();
  const show = interpolate(f, [at, at + 12], [0, 1], { ...clamp, easing: easeOut });
  const n = interpolate(f, [at + 6, at + 50], [0, 38], clamp);
  const pop = interpolate(f, [popAt, popAt + 5, popAt + 12], [0, 1.12, 1], clamp);
  return (
    <div style={{ position: "absolute", right: 72, bottom: 64, width: 560, padding: "30px 34px", borderRadius: 24, background: C.surface,
      boxShadow: "0 16px 50px rgba(14,15,12,0.16)", opacity: show, transform: `translateY(${(1 - show) * 20}px)`, fontFamily: SANS }}>
      <div style={{ fontSize: 28, color: C.ink3 }}>Conservative therapy</div>
      <div style={{ fontSize: 76, fontWeight: 400, letterSpacing: "-0.04em", color: C.ink, fontVariantNumeric: "tabular-nums" }}>
        {Math.round(n)} <span style={{ color: C.ink3, fontSize: 44 }}>of 42 days</span>
      </div>
      <svg width={492} height={34} style={{ display: "block", marginTop: 10 }}>
        {Array.from({ length: 42 }, (_, i) => (
          <rect key={i} x={i * 11.7} y={4} width={8} height={26} rx={2.5} fill={i < n ? C.ink : "none"} stroke={i < n ? "none" : C.warnFill} strokeWidth={1.6} />
        ))}
      </svg>
      <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 20px", borderRadius: 999, background: C.highlight,
        fontSize: 38, fontWeight: 560, color: C.ink, transform: `scale(${pop})`, transformOrigin: "0 50%", opacity: pop > 0 ? 1 : 0 }}>
        Earliest: Jul 31
      </div>
    </div>
  );
};

// check (12.4 s): prior-auth check for Emerson Specimen (Aetna); 38 of 42 days; earliest date from code
export const Check: React.FC<P> = ({ dur }) => (
  <Recording clip="check" dur={dur} from={0.5} rate={1.0}
    cam={[
      { t: 0, x: 770, y: 380, s: 1.5 },
      { t: 1.9, x: 730, y: 270, s: 1.7, d: 0.5 },
      { t: 4.2, x: 640, y: 300, s: 1.5, d: 0.6 },
      { t: 8.6, x: 1000, y: 330, s: 1.7, d: 0.7 },
    ]}
    callouts={[
      { t0: 0.3, t1: 1.6, box: [286, 342, 1258, 410], tone: "ink", dim: false },
      { t0: 4.6, t1: 8.2, box: [470, 140, 1160, 290], label: "Six weeks needed", tone: "warn", below: true },
    ]}>
    <Days at={sec(5.0)} popAt={sec(9.0)} />
    <Caption text="Not ready yet? Here's the date." end={dur + 8} />
  </Recording>
);

// how (14.9 s): the in-app How it works page scrolls by; three facts slide in on the right
const Fact: React.FC<{ at: number; top: number; title: string; sub: string; tone?: string; check?: boolean }> = ({ at, top, title, sub, tone = C.ink, check }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 14], [0, 1], { ...clamp, easing: easeOut });
  return (
    <div style={{ position: "absolute", right: 64, top, width: 560, padding: "26px 32px", borderRadius: 22, background: C.surface,
      boxShadow: "0 16px 50px rgba(14,15,12,0.14)", opacity: p, transform: `translateX(${(1 - p) * 120}px)`, fontFamily: SANS }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 40, fontWeight: 560, color: tone, letterSpacing: "-0.02em" }}>
        {check && <Glyph name="check" size={38} color={C.verified} draw={p} />}{title}
      </div>
      <div style={{ fontSize: 30, color: C.ink2, marginTop: 8 }}>{sub}</div>
    </div>
  );
};
export const How: React.FC<P> = ({ dur }) => (
  <Recording clip="how" dur={dur} rate={1.15}
    cam={[
      { t: 0, x: 960, y: 540, s: 1.0 },
      { t: 14, x: 960, y: 560, s: 1.06, d: 13 },
    ]}>
    <Fact at={sec(0.6)} top={180} title="NVIDIA Nemotron" sub="on Nebius Token Factory: reads, matches" />
    <Fact at={sec(4.6)} top={390} title="Tavily" sub="finds Aetna's current policy, live" />
    <Fact at={sec(9.6)} top={600} title="Code decides" sub="verdicts · deadlines · real quotes" tone={C.verified} check />
  </Recording>
);
