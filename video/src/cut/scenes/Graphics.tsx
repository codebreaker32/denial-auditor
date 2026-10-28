import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Globe } from "../Globe";
import { SANS } from "../fonts";
import { C, DEMO_URL, H, W } from "../theme";
import { clamp, easeIO, easeOut } from "../timeline";
import { Count, Glyph, LogoMark, out } from "../ui";

const sec = (s: number) => Math.round(s * 30);

// stakes (14.9 s): KFF, Jan 2026. 80.7% of appealed MA prior-auth denials were overturned (2024) — yet only
// 11.5% were appealed. 200 dots stand for denials: 23 get appealed, and of those the overturned ones go solid.
export const Stakes: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const drift = interpolate(f, [0, dur], [1, 1.035]);
  const a = interpolate(f, [sec(0.4), sec(1.2)], [0, 1], { ...clamp, easing: easeOut });
  const b = interpolate(f, [sec(7.3), sec(8.1)], [0, 1], { ...clamp, easing: easeOut });
  const c = interpolate(f, [sec(10.5), sec(11.3)], [0, 1], { ...clamp, easing: easeOut });
  // numbers pop when they land
  const pop = (at: number) => interpolate(f, [at, at + 4, at + 12], [1, 1.12, 1], clamp);
  const drainW = interpolate(f, [sec(7.6), sec(9.6)], [100, 11.5], { ...clamp, easing: easeIO });
  const cols = 20, rows = 10, gap = 34;
  const N = cols * rows;
  const appealedN = 23; // 11.5% of 200
  const wonN = 19; // 80.7% of 23 ≈ 18.6
  const appealP = interpolate(f, [sec(7.6), sec(9.6)], [0, appealedN], clamp);
  const wonP = interpolate(f, [sec(1.2), sec(4.6)], [0, wonN], clamp);
  // the appealed denials are scattered across the field (fixed order)
  const order = Array.from({ length: N }, (_, i) => (i * 73 + 11) % N);
  const appealedSet = new Map(order.slice(0, appealedN).map((d, i) => [d, i]));
  return (
    <AbsoluteFill style={{ background: C.ground, fontFamily: SANS, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${drift})`, transformOrigin: "30% 50%" }}>
        <div style={{ position: "absolute", left: 120, top: 120, color: C.ink3, fontSize: 32, fontWeight: 450, opacity: a }}>
          Medicare Advantage prior-auth denials, 2024
        </div>
        {/* 80.7% */}
        <div style={{ position: "absolute", left: 112, top: 200, opacity: a * (1 - 0.55 * b), transform: `translateY(${(1 - a) * 24}px)` }}>
          <div style={{ fontSize: 210, fontWeight: 300, letterSpacing: "-0.055em", lineHeight: 1, color: C.ink, transform: `scale(${pop(sec(4.4))})`, transformOrigin: "0% 80%" }}>
            <Count to={80.7} a={sec(0.6)} b={sec(4.4)} decimals={1} suffix="%" />
          </div>
          <div style={{ fontSize: 44, fontWeight: 450, color: C.ink2, marginTop: 14, letterSpacing: "-0.02em" }}>of appealed denials overturned</div>
        </div>
        {/* 11.5% */}
        <div style={{ position: "absolute", left: 112, top: 540, opacity: b, transform: `translateY(${(1 - b) * 24}px)` }}>
          <div style={{ fontSize: 210, fontWeight: 300, letterSpacing: "-0.055em", lineHeight: 1, color: C.ink, transform: `scale(${pop(sec(9.6))})`, transformOrigin: "0% 80%" }}>
            <Count to={11.5} a={sec(7.4)} b={sec(9.6)} decimals={1} suffix="%" />
          </div>
          <div style={{ fontSize: 44, fontWeight: 450, color: C.ink2, marginTop: 14, letterSpacing: "-0.02em" }}>were ever appealed</div>
          <svg width={760} height={28} style={{ display: "block", marginTop: 26 }}>
            <rect x={0} y={4} width={760} height={20} rx={10} fill={C.sunk} />
            <rect x={0} y={4} width={760 * drainW / 100} height={20} rx={10} fill={C.highlight} />
          </svg>
        </div>
        {/* the dot field */}
        <svg width={cols * gap} height={rows * gap} style={{ position: "absolute", left: 1080, top: 300, overflow: "visible", opacity: a }}>
          {Array.from({ length: N }, (_, i) => {
            const x = (i % cols) * gap + gap / 2, y = Math.floor(i / cols) * gap + gap / 2;
            const ai = appealedSet.get(i);
            const appealed = ai !== undefined && (f < sec(7.3) || ai < appealP);
            const won = ai !== undefined && ai < wonP && ai < wonN;
            // before the 11.5% beat, only the appealed denials show; after it, the unappealed ones fill in
            const ghost = interpolate(f, [sec(7.2), sec(8.6)], [0.12, 1], clamp);
            const dimRest = interpolate(f, [sec(10.6), sec(11.6)], [1, 0.45], clamp);
            if (ai === undefined) return <circle key={i} cx={x} cy={y} r={9} fill="none" stroke={C.ink3} strokeWidth={2} opacity={ghost * dimRest} />;
            return (
              <circle key={i} cx={x} cy={y} r={appealed ? 11 : 9} fill={won ? C.ink : C.surface}
                stroke={C.ink} strokeWidth={2.4} opacity={1} />
            );
          })}
        </svg>
        <div style={{ position: "absolute", left: 1080, top: 668, display: "flex", gap: 36, fontSize: 28, color: C.ink2, opacity: a }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}><svg width={22} height={22}><circle cx={11} cy={11} r={9} fill={C.ink} /></svg>Overturned on appeal</span>
          <span style={{ display: "flex", alignItems: "center", gap: 10, opacity: b }}><svg width={22} height={22}><circle cx={11} cy={11} r={8} fill="none" stroke={C.ink3} strokeWidth={2} /></svg>Never appealed</span>
        </div>
        {/* the cost */}
        <div style={{ position: "absolute", left: 1080, top: 780, fontSize: 52, fontWeight: 450, letterSpacing: "-0.03em", color: C.ink, opacity: c, transform: `translateY(${(1 - c) * 18}px)` }}>
          Winning takes hours of reading.
        </div>
      </div>
      <div style={{ position: "absolute", left: 120, bottom: 64, color: C.ink3, fontSize: 26, opacity: a }}>
        Source: KFF, Jan 2026 · Medicare Advantage prior authorization, 2024 data
      </div>
    </AbsoluteFill>
  );
};

// pitch (8.6 s): the mark builds into the wordmark, then one line draws itself: Denial → Policy → Appeal,
// and "with proof" underlines it in verified blue.
export const Pitch: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const draw = interpolate(f, [4, 34], [0, 1], { ...clamp, easing: easeOut });
  const word = interpolate(f, [14, 34], [0, 1], { ...clamp, easing: easeOut });
  const rise = interpolate(f, [sec(1.9), sec(2.6)], [0, 1], { ...clamp, easing: easeIO });
  const w = [sec(2.5), sec(3.6), sec(5.2)].map((s) => interpolate(f, [s, s + 16], [0, 1], { ...clamp, easing: easeOut }));
  const ar = [sec(3.0), sec(4.6)].map((s) => interpolate(f, [s, s + 18], [0, 1], { ...clamp, easing: easeOut }));
  const proof = interpolate(f, [sec(6.6), sec(7.4)], [0, 1], { ...clamp, easing: easeOut });
  const push = interpolate(f, [0, dur], [1, 1.05]);
  const Word: React.FC<{ p: number; children: React.ReactNode; color?: string }> = ({ p, children, color = C.ink }) => (
    <span style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)`, display: "inline-flex", alignItems: "center", gap: 18, color }}>{children}</span>
  );
  const Arrow: React.FC<{ p: number }> = ({ p }) => (
    <svg width={120} height={40} viewBox="0 0 120 40" style={{ margin: "0 22px" }}>
      <path d="M6 20 H104 M90 8 L106 20 L90 32" fill="none" stroke={C.ink3} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
    </svg>
  );
  return (
    <AbsoluteFill style={{ background: C.ground, fontFamily: SANS, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${push})` }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 410 - rise * 210, display: "flex", justifyContent: "center", alignItems: "center", gap: 36 * (1 - rise * 0.3),
          transform: `scale(${1 - rise * 0.35})` }}>
          <LogoMark size={150} draw={draw} />
          <span style={{ fontSize: 140, fontWeight: 500, letterSpacing: "-0.045em", color: C.ink, opacity: word, clipPath: `inset(0 ${(1 - word) * 100}% 0 0)` }}>Denial Auditor</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 520, display: "flex", justifyContent: "center", alignItems: "center", fontSize: 104, fontWeight: 400, letterSpacing: "-0.045em" }}>
          <Word p={w[0]}>Denial</Word>
          <span style={{ opacity: ar[0] }}><Arrow p={ar[0]} /></span>
          <Word p={w[1]}>Policy</Word>
          <span style={{ opacity: ar[1] }}><Arrow p={ar[1]} /></span>
          <Word p={w[2]} color={C.pos}><Glyph name="check" size={80} color={C.pos} draw={w[2]} />Appeal</Word>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 690, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
            <svg width={1180} height={10}><rect x={0} y={2} height={6} rx={3} width={1180 * proof} fill={C.verified} /></svg>
            <span style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 52, fontWeight: 500, color: C.verified, opacity: proof, letterSpacing: "-0.02em" }}>
              <Glyph name="check" size={46} color={C.verified} draw={proof} /> With proof
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// proof (14.7 s): 30 synthetic cases fill in, then 138 rule statuses, then cost per case.
export const Proof: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [sec(0.3), sec(1.0)], [0, 1], { ...clamp, easing: easeOut });
  const casesP = interpolate(f, [sec(1.0), sec(4.0)], [0, 30], clamp);
  const b = interpolate(f, [sec(4.2), sec(4.9)], [0, 1], { ...clamp, easing: easeOut });
  const rulesP = interpolate(f, [sec(4.4), sec(7.0)], [0, 138], clamp);
  const c = interpolate(f, [sec(7.2), sec(7.9)], [0, 1], { ...clamp, easing: easeOut });
  const caveat = interpolate(f, [sec(9.9), sec(10.7)], [0, 1], { ...clamp, easing: easeOut });
  const push = interpolate(f, [0, dur], [1, 1.04]);
  const col = (left: number, p: number, viz: React.ReactNode, fig: React.ReactNode, label: string) => (
    <div style={{ position: "absolute", left, top: 300, width: 520, opacity: p * (1 - caveat * 0.35), transform: `translateY(${(1 - p) * 24}px)` }}>
      <div style={{ height: 210, display: "flex", alignItems: "flex-end" }}>{viz}</div>
      <div style={{ fontSize: 150, fontWeight: 300, letterSpacing: "-0.05em", lineHeight: 1, marginTop: 36, color: C.ink }}>{fig}</div>
      <div style={{ fontSize: 40, fontWeight: 450, color: C.ink2, marginTop: 12 }}>{label}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.ground, fontFamily: SANS, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${push})` }}>
        <div style={{ position: "absolute", left: 140, top: 130, fontSize: 36, fontWeight: 500, color: C.ink, opacity: a, display: "flex", alignItems: "center", gap: 16 }}>
          30 synthetic test cases <span style={{ color: C.ink3, fontWeight: 400 }}>· written by us, with ground truth</span>
        </div>
        {col(140, a,
          <svg width={420} height={200}>
            {Array.from({ length: 30 }, (_, i) => {
              const on = i < casesP;
              const x = (i % 10) * 42, y = Math.floor(i / 10) * 66 + 20;
              return <g key={i}><rect x={x} y={y} width={34} height={46} rx={7} fill={on ? C.ink : "none"} stroke={C.ink3} strokeWidth={on ? 0 : 2} />
                {on && <path d={`M${x + 10} ${y + 24} l5 5 9-10`} fill="none" stroke={C.onNight} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}</g>;
            })}
          </svg>,
          <><Count to={30} a={sec(1.0)} b={sec(4.0)} /><span style={{ color: C.ink3 }}>/30</span></>, "recommendations right")}
        {col(740, b,
          <svg width={460} height={200}>
            {Array.from({ length: 138 }, (_, i) => {
              const on = i < rulesP;
              const x = (i % 23) * 20 + 8, y = Math.floor(i / 23) * 30 + 30;
              return <circle key={i} cx={x} cy={y} r={on ? 7 : 6} fill={on ? C.ink : "none"} stroke={C.ink3} strokeWidth={on ? 0 : 1.6} />;
            })}
          </svg>,
          <><Count to={138} a={sec(4.4)} b={sec(7.0)} /><span style={{ color: C.ink3 }}>/138</span></>, "rule statuses right")}
        {col(1340, c,
          <svg width={420} height={200}>
            <rect x={0} y={150} width={420} height={14} rx={7} fill={C.sunk} />
            <rect x={0} y={150} width={420 * 0.05 * c * 4} height={14} rx={7} fill={C.ink} />
          </svg>,
          <><span style={{ color: C.ink3 }}>~</span><Count to={0.05} a={sec(7.3)} b={sec(8.6)} decimals={2} prefix="$" /></>, "per case, in model calls")}
        <div style={{ position: "absolute", left: 140, top: 860, fontSize: 46, fontWeight: 450, color: C.ink, letterSpacing: "-0.02em", opacity: caveat, transform: `translateY(${(1 - caveat) * 16}px)` }}>
          The pipeline as designed. <span style={{ color: C.ink3 }}>Not accuracy on real charts.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// close (12.3 s): back to night. The globe turns at the right edge with more rules lit; worth filing → the demo
// URL → the mark, the name and the team; credits and "synthetic data only".
export const Close: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const l1 = interpolate(f, [sec(0.3), sec(1.1)], [0, 1], { ...clamp, easing: easeOut });
  const l2 = interpolate(f, [sec(2.4), sec(3.2)], [0, 1], { ...clamp, easing: easeOut });
  const gone = interpolate(f, [sec(4.7), sec(5.2)], [0, 1], clamp);
  const url = interpolate(f, [sec(5.0), sec(5.8)], [0, 1], { ...clamp, easing: easeOut });
  const brand = interpolate(f, [sec(7.2), sec(8.0)], [0, 1], { ...clamp, easing: easeOut });
  const draw = interpolate(f, [sec(7.2), sec(8.4)], [0, 1], { ...clamp, easing: easeOut });
  const team = interpolate(f, [sec(8.4), sec(9.0)], [0, 1], { ...clamp, easing: easeOut });
  const fin = out(f, dur - 16, 16);
  return (
    <AbsoluteFill style={{ background: C.night, fontFamily: SANS, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, opacity: fin }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <Globe frame={f + 400} cx={1640} cy={560} r={560} lit={interpolate(f, [0, dur], [0.04, 0.22], clamp)} opacity={0.95} />
        </svg>
        <div style={{ position: "absolute", left: 140, top: 330, opacity: 1 - gone }}>
          <div style={{ fontSize: 120, fontWeight: 400, letterSpacing: "-0.045em", lineHeight: 1.04, color: C.onNight, opacity: l1, transform: `translateY(${(1 - l1) * 20}px)` }}>Worth filing.</div>
          <div style={{ fontSize: 120, fontWeight: 300, letterSpacing: "-0.045em", lineHeight: 1.04, color: C.onNight2, opacity: l2, transform: `translateY(${(1 - l2) * 20}px)` }}>Now there's time.</div>
        </div>
        <div style={{ position: "absolute", left: 140, top: 250, opacity: brand, transform: `translateY(${(1 - brand) * 20}px)`, display: "flex", alignItems: "center", gap: 30 }}>
          <LogoMark size={118} onNight draw={draw} />
          <span style={{ fontSize: 112, fontWeight: 500, letterSpacing: "-0.045em", color: C.onNight }}>Denial Auditor</span>
        </div>
        <div style={{ position: "absolute", left: 140, top: 400, fontSize: 44, color: C.onNight2, opacity: team }}>by Team Road House</div>
        <div style={{ position: "absolute", left: 140, top: 560 - (1 - brand) * 0, opacity: url, transform: `translateY(${(1 - url) * 20 - (1 - brand) * 150}px)` }}>
          <div style={{ fontSize: 32, color: C.onNight3, marginBottom: 14 }}>Try the live demo</div>
          <div style={{ fontSize: 40, fontWeight: 450, color: C.onNight, letterSpacing: "-0.01em" }}>{DEMO_URL.replace(/^https:\/\//, "")}</div>
          <svg width={1000} height={8} style={{ display: "block", marginTop: 12 }}><rect x={0} y={2} height={4} rx={2} width={1000 * url} fill={C.verifiedNight} /></svg>
        </div>
        <div style={{ position: "absolute", left: 140, bottom: 70, display: "flex", gap: 40, fontSize: 28, color: C.onNight2, opacity: team }}>
          <span>NVIDIA Nemotron on Nebius Token Factory · Tavily</span>
          <span style={{ color: C.onNight3 }}>Synthetic data only</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
