import React from "react";
import { interpolate, Sequence, useCurrentFrame } from "remotion";
import { Recording } from "../Recording";
import { SANS } from "../fonts";
import { C } from "../theme";
import { clamp, easeOut } from "../timeline";
import { Glyph } from "../ui";

// App scenes. Camera keys and callouts are in scene seconds (aligned to the narration) and point at recording
// coordinates (1920x1080). Beats per clip come from scripts/record.py; after re-recording, check stills and nudge
// `from`/`rate` first, keys second.
const sec = (s: number) => Math.round(s * 30);
type P = { dur: number };

// worklist (10.3 s): the tail of the homepage tour: login at speed, then the worklist; effects start once signed in.
// TOUR_LOGIN is the tour-clip second where the worklist has appeared (see scripts/record.py `tour`).
export const TOUR_PITCH_RATE = 1.5;
const TOUR_LOGIN = 17.8;
export const Worklist: React.FC<P> = ({ dur }) => {
  const join = 10.0; // tour second where the pitch scene leaves off (≈ 6.7 s of pitch footage at TOUR_PITCH_RATE)
  const fastRate = 2.6;
  const fastDur = sec(Math.max(0, (TOUR_LOGIN - join) / fastRate));
  return (
    <>
      <Sequence durationInFrames={fastDur} layout="none">
        <Recording clip="tour" dur={fastDur} from={join} rate={fastRate} cam={[{ t: 0, x: 960, y: 540, s: 1.0 }]} />
      </Sequence>
      <Sequence from={fastDur} layout="none">
        <Recording clip="tour" dur={dur - fastDur} from={TOUR_LOGIN} rate={1.0}
          cam={[
            { t: 0, x: 960, y: 540, s: 1.0 },
            { t: 1.0, x: 470, y: 520, s: 1.6, d: 0.9 },
            { t: 3.2, x: 1130, y: 400, s: 2.0, d: 0.7 },
          ]}
          callouts={[
            { t0: 0.9, t1: 2.6, box: [548, 280, 630, 850], label: "Days left", tone: "hi", below: false },
            { t0: 3.3, t1: 10, box: [998, 350, 1272, 448], label: "From a rules table, not the model", tone: "hi", below: true },
          ]} />
      </Sequence>
    </>
  );
};

// case (11.3 s): open Drew Exemplar; the payer's reason; the fax, read; reason code 50 routes it
export const Case: React.FC<P> = ({ dur }) => (
  <Recording clip="case" dur={dur} from={3.5} rate={1.1}
    cam={[
      { t: 0, x: 470, y: 320, s: 1.7 },
      { t: 2.3, x: 1352, y: 240, s: 2.05, d: 0.6 },
      { t: 6.8, x: 930, y: 760, s: 1.45, d: 0.6 },
      { t: 8.9, x: 1380, y: 840, s: 2.0, d: 0.6 },
    ]}
    callouts={[
      { t0: 0.4, t1: 1.6, box: [278, 268, 634, 336], tone: "ink", dim: false },
      { t0: 2.5, t1: 5.2, box: [1150, 162, 1556, 304], label: "No x-ray first?", tone: "neg" },
      { t0: 6.9, t1: 8.5, box: [700, 570, 1140, 945], label: "Nemotron reads the fax", tone: "ink" },
      { t0: 9.0, t1: 11.3, box: [1180, 838, 1582, 878], label: "Code 50 → clinical review", tone: "hi", below: true },
    ]}>
  </Recording>
);

// rules (14.8 s): the policy in force on the service date; the stage summary; one rule opened in the payer's own
// words with the chart quotes code found; then all five deciding rules, none of them an x-ray.
export const Rules: React.FC<P> = ({ dur }) => (
  <Recording clip="rules" dur={dur} rate={1.3}
    cam={[
      { t: 0, x: 1340, y: 270, s: 2.0 },
      { t: 3.2, x: 960, y: 600, s: 1.55, d: 0.6 },
      { t: 5.1, x: 1190, y: 810, s: 1.7, d: 0.6 },
      { t: 8.9, x: 1200, y: 760, s: 1.65, d: 0.6 },
      { t: 11.7, x: 1130, y: 700, s: 1.3, d: 0.7 },
    ]}
    sweeps={[{ t0: 5.3, t1: 8.3, lines: [[842, 795, 1552, 818], [842, 818, 1550, 841], [842, 841, 1494, 864], [842, 864, 1368, 887]] }]}
    callouts={[
      { t0: 0.4, t1: 2.9, box: [1160, 256, 1546, 294], label: "In force on the service date", tone: "hi", below: true },
      { t0: 3.3, t1: 4.9, box: [700, 556, 1222, 592], label: "Every stage checked", tone: "pos", below: true },
      { t0: 5.3, t1: 8.3, box: [840, 792, 1556, 890], label: "The payer's own words", tone: "hi" },
      { t0: 9.1, t1: 11.4, box: [850, 740, 1562, 882], label: "Found word for word", tone: "verified" },
      { t0: 11.9, t1: 14.8, box: [686, 662, 1584, 916], label: "No rule asks for an x-ray", tone: "ink" },
    ]}>
  </Recording>
);

// appeal (10.9 s): a fixed rule says appeal; the draft; the citation gate
export const Appeal: React.FC<P> = ({ dur }) => (
  <Recording clip="appeal" dur={dur} rate={1.27}
    cam={[
      { t: 0, x: 900, y: 200, s: 2.1 },
      { t: 2.6, x: 1130, y: 700, s: 1.35, d: 0.6 },
      { t: 4.7, x: 1100, y: 510, s: 1.7, d: 0.6 },
      { t: 7.1, x: 1130, y: 480, s: 1.3, d: 0.6 },
    ]}
    callouts={[
      { t0: 0.3, t1: 2.1, box: [706, 158, 1090, 240], label: "A fixed rule: appeal", tone: "pos", below: true },
      { t0: 2.6, t1: 4.2, box: [702, 566, 995, 592], label: "Checking every quote", tone: "verified", below: true, dim: false },
      { t0: 4.8, t1: 6.8, box: [728, 360, 1476, 662], label: "Each quote, against its source", tone: "verified" },
      { t0: 7.0, t1: 10.2, box: [700, 70, 995, 98], label: "12 of 12 match", tone: "verified", below: true },
      { t0: 7.0, t1: 10.2, box: [1458, 905, 1580, 933], tone: "verified", dim: false },
    ]}>
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
    <div style={{ position: "absolute", right: 72, top: 64, display: "flex", alignItems: "center", gap: 22, padding: "18px 34px 18px 22px",
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
  <Recording clip="tamper" dur={dur} from={0.6} rate={1.6}
    cam={[
      { t: 0, x: 1340, y: 580, s: 2.0 },
      { t: 1.2, x: 1000, y: 560, s: 1.7, d: 0.4 },
      { t: 3.8, x: 1130, y: 580, s: 1.9, d: 0.45 },
      { t: 6.6, x: 1110, y: 520, s: 1.5, d: 0.5 },
      { t: 10.0, x: 1130, y: 400, s: 1.25, d: 0.7 },
    ]}
    callouts={[
      { t0: 3.9, t1: 6.2, box: [700, 566, 1025, 592], label: "One word changed", tone: "neg", below: true },
      { t0: 6.6, t1: 8.2, box: [742, 440, 1480, 552], label: "This quote isn't in the policy", tone: "neg" },
      { t0: 8.2, t1: 9.8, box: [742, 572, 1480, 702], label: "What the policy says", tone: "verified", below: true },
    ]}>
    <Lock lockAt={sec(7.6)} openAt={sec(11.0)} />
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
  <Recording clip="physician" dur={dur} rate={1.1}
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
  </Recording>
);

// 38 of 42 days of therapy, ticked off, then the earliest date pops.
const Days: React.FC<{ at: number; popAt: number }> = ({ at, popAt }) => {
  const f = useCurrentFrame();
  const show = interpolate(f, [at, at + 12], [0, 1], { ...clamp, easing: easeOut });
  const n = interpolate(f, [at + 6, at + 50], [0, 38], clamp);
  const pop = interpolate(f, [popAt, popAt + 5, popAt + 12], [0, 1.12, 1], clamp);
  return (
    <div style={{ position: "absolute", left: 72, top: 96, width: 620, padding: "30px 34px", borderRadius: 24, background: C.surface,
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
      <div style={{ marginTop: 12, fontSize: 30, color: C.ink3, opacity: pop > 0 ? 1 : 0 }}>Planned for Aug 3</div>
    </div>
  );
};

// check (12.4 s): prior-auth check for Emerson Specimen (Aetna); 38 of 42 days; earliest date from code
export const Check: React.FC<P> = ({ dur }) => (
  <Recording clip="check" dur={dur} from={0.5} rate={1.0}
    cam={[
      { t: 0, x: 770, y: 380, s: 1.5 },
      { t: 1.9, x: 640, y: 270, s: 1.65, d: 0.5 },
      { t: 4.2, x: 680, y: 360, s: 1.6, d: 0.6 },
      { t: 8.4, x: 880, y: 330, s: 1.8, d: 0.7 },
    ]}
    callouts={[
      { t0: 0.3, t1: 1.5, box: [286, 365, 1258, 410], tone: "ink", dim: false },
      { t0: 1.9, t1: 3.7, box: [304, 252, 690, 358], label: "Qualifies if charted", tone: "warn", below: true },
      { t0: 4.4, t1: 8.2, box: [288, 450, 1058, 472], label: "38 of 42 days charted", tone: "warn", below: true },
      { t0: 8.6, t1: 12.4, box: [954, 318, 1108, 368], label: "Earliest Jul 31, planned Aug 3", tone: "hi", below: true },
    ]}>
    <Days at={sec(5.0)} popAt={sec(9.0)} />
  </Recording>
);

// how (14.9 s): the How it works page scrolls on the left; a night band wipes in on the right and says who does what:
// the models read and match, code decides.
const Band: React.FC = () => {
  const f = useCurrentFrame();
  const open = interpolate(f, [sec(0.4), sec(1.0)], [0, 1], { ...clamp, easing: easeOut });
  const l = (a: number) => interpolate(f, [sec(a), sec(a) + 12], [0, 1], { ...clamp, easing: easeOut });
  const code = l(9.6);
  return (
    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 520, background: C.night, clipPath: `inset(0 0 0 ${(1 - open) * 100}%)`,
      fontFamily: SANS, padding: "110px 52px 150px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 54 }}>
      <div style={{ opacity: l(0.9), transform: `translateX(${(1 - l(0.9)) * 40}px)` }}>
        <div style={{ color: C.onNight, fontSize: 56, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.05 }}>NVIDIA Nemotron</div>
        <div style={{ color: C.onNight2, fontSize: 34, marginTop: 10 }}>on Nebius Token Factory reads the letter and matches the rules</div>
      </div>
      <div style={{ opacity: l(4.9), transform: `translateX(${(1 - l(4.9)) * 40}px)` }}>
        <div style={{ color: C.onNight, fontSize: 56, fontWeight: 600, letterSpacing: "-0.035em" }}>Tavily</div>
        <div style={{ color: C.onNight2, fontSize: 34, marginTop: 10 }}>finds Aetna's current policy, live</div>
      </div>
      <div style={{ marginTop: "auto", opacity: code, transform: `translateY(${(1 - code) * 30}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, color: C.onNight, fontSize: 62, fontWeight: 650, letterSpacing: "-0.05em", whiteSpace: "nowrap" }}>
          <Glyph name="check" size={56} color={C.verifiedNight} draw={code} /> Code decides
        </div>
        <div style={{ color: C.onNight2, fontSize: 34, marginTop: 14 }}>verdicts, deadlines, and whether a quote is real</div>
      </div>
    </div>
  );
};
// The live run is a real run on the deployed site (scripts/record.py `live`, marks in public/rec/live.json):
// one time-lapse per phase, each with its honest speed tag; slow for the rule tally and the summary card.
type Seg = { at: number; len: number; from: number; rate: number; cam: { x: number; y: number; s: number }; tag: string };
const SEGS: Seg[] = [
  { at: 0, len: 1.6, from: 3.6, rate: 1.5, cam: { x: 960, y: 540, s: 1.0 }, tag: "Real run, case 015" },
  { at: 1.6, len: 3.6, from: 6.0, rate: 28, cam: { x: 990, y: 440, s: 1.35 }, tag: "Sped up ×28" },
  { at: 5.2, len: 4.8, from: 108, rate: 10, cam: { x: 990, y: 760, s: 1.35 }, tag: "Sped up ×10" },
  { at: 10.0, len: 1.6, from: 156, rate: 10, cam: { x: 990, y: 760, s: 1.3 }, tag: "Sped up ×10" },
  { at: 11.6, len: 3.4, from: 172, rate: 1.9, cam: { x: 990, y: 800, s: 1.3 }, tag: "Sped up ×2" },
];
const Tag: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", left: 72, bottom: 130, display: "flex", alignItems: "center", gap: 12, padding: "10px 22px 12px 16px", borderRadius: 999,
    background: C.ink, color: C.onNight, fontFamily: SANS, fontSize: 30, fontWeight: 560, letterSpacing: "-0.01em" }}>
    <svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 6l7 6-7 6zM13 6l7 6-7 6z" fill={C.highlight} /></svg>
    {text}
  </div>
);
export const How: React.FC<P> = ({ dur }) => (
  <>
    {SEGS.map((g, i) => {
      const len = i === SEGS.length - 1 ? dur - sec(g.at) : sec(g.len);
      return (
        <Sequence key={i} from={sec(g.at)} durationInFrames={len} layout="none">
          <Recording clip="live" dur={len} from={g.from} rate={g.rate} cam={[{ t: 0, ...g.cam }]}
            callouts={
              i === 2 ? [{ t0: 0.4, t1: 4.8, box: [728, 738, 1290, 796], label: "Every rule, one by one", tone: "hi", below: false }]
              : i === 4 ? [{ t0: 1.0, t1: 3.4, box: [676, 826, 1302, 1024], label: "Appeal, every quote matched", tone: "pos", below: false }]
              : []}>
            {i === 0 && <div style={{ position: "absolute", left: 280, top: 410, width: 336, height: 54, borderRadius: 10, backdropFilter: "blur(14px)", background: "rgba(255,255,255,0.4)" }} />}
            <Tag text={g.tag} />
          </Recording>
        </Sequence>
      );
    })}
    <Band />
  </>
);
