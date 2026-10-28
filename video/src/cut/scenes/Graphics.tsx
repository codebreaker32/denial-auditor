import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Recording } from "../Recording";
import { Globe } from "../Globe";
import { SANS } from "../fonts";
import { C, DEMO_URL, H, W } from "../theme";
import { clamp, easeIO, easeOut } from "../timeline";
import { Count, Glyph, LogoMark, out } from "../ui";

const sec = (s: number) => Math.round(s * 30);
const ease = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: easeOut });

// stakes (the punchline): KFF, Jan 2026, Medicare Advantage prior auth, 2024 data (docs/facts.md): 80.7% of appealed
// denials were overturned; only 11.5% were appealed. 200 dots stand for denials; the appealed ones are scattered
// through the field and the overturned ones go solid. Then the turn: "What if checking took minutes?"
export const Stakes: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = interpolate(f, [0, dur], [1, 1.03]);
  const wild = ease(f, sec(0.3), sec(0.7));
  const a = ease(f, sec(4.3), sec(4.7));
  const b = ease(f, sec(8.7), sec(9.1));
  const turn = interpolate(f, [sec(11.3), sec(11.7)], [0, 1], { ...clamp, easing: easeIO });
  const q = spring({ frame: f - sec(11.5), fps, config: { damping: 12, stiffness: 150, mass: 0.8 } });
  const pop = (at: number) => interpolate(f, [at, at + 4, at + 12], [1, 1.1, 1], clamp);
  const drainW = interpolate(f, [sec(8.9), sec(10.6)], [100, 11.5], { ...clamp, easing: easeIO });
  const cols = 20, rows = 10, gap = 36, N = cols * rows, appealedN = 23, wonN = 19;
  const appealP = interpolate(f, [sec(8.9), sec(10.5)], [0, appealedN], clamp);
  const wonP = interpolate(f, [sec(4.5), sec(7.4)], [0, wonN], clamp);
  const order = Array.from({ length: N }, (_, i) => (i * 73 + 11) % N);
  const appealedSet = new Map(order.slice(0, appealedN).map((d, i) => [d, i]));
  const ghost = interpolate(f, [sec(8.7), sec(9.9)], [0.1, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.ground, fontFamily: SANS, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${drift}) translateX(${-turn * 260}px)`, transformOrigin: "30% 50%",
        opacity: 1 - turn * 0.85, filter: turn > 0 ? `blur(${turn * 10}px)` : undefined }}>
        {/* "Here's the wild part" */}
        <div style={{ position: "absolute", left: 120, top: 140, fontSize: 96, fontWeight: 650, letterSpacing: "-0.05em", color: C.ink,
          opacity: wild * (1 - a), transform: `translateY(${(1 - wild) * 40 - a * 40}px) rotate(${(1 - wild) * -3}deg)` }}>
          Here's the wild part.
        </div>
        <div style={{ position: "absolute", left: 112, top: 200, opacity: a * (1 - 0.55 * b), transform: `translateY(${(1 - a) * 24}px)` }}>
          <div style={{ fontSize: 220, fontWeight: 300, letterSpacing: "-0.055em", lineHeight: 1, color: C.ink, transform: `scale(${pop(sec(6.5))})`, transformOrigin: "0% 80%" }}>
            <Count to={80.7} a={sec(4.5)} b={sec(6.5)} decimals={1} suffix="%" />
          </div>
          <div style={{ fontSize: 46, fontWeight: 450, color: C.ink2, marginTop: 14, letterSpacing: "-0.02em" }}>of appealed denials were overturned</div>
        </div>
        <div style={{ position: "absolute", left: 112, top: 560, opacity: b, transform: `translateY(${(1 - b) * 24}px)` }}>
          <div style={{ fontSize: 220, fontWeight: 300, letterSpacing: "-0.055em", lineHeight: 1, color: C.ink, transform: `scale(${pop(sec(10.4))})`, transformOrigin: "0% 80%" }}>
            <Count to={11.5} a={sec(8.9)} b={sec(10.4)} decimals={1} suffix="%" />
          </div>
          <div style={{ fontSize: 46, fontWeight: 450, color: C.ink2, marginTop: 14, letterSpacing: "-0.02em" }}>were ever appealed</div>
          <svg width={780} height={30} style={{ display: "block", marginTop: 26 }}>
            <rect x={0} y={4} width={780} height={22} rx={11} fill={C.sunk} />
            <rect x={0} y={4} width={(780 * drainW) / 100} height={22} rx={11} fill={C.highlight} />
          </svg>
        </div>
        <svg width={cols * gap} height={rows * gap} style={{ position: "absolute", left: 1090, top: 290, overflow: "visible", opacity: a }}>
          {Array.from({ length: N }, (_, i) => {
            const x = (i % cols) * gap + gap / 2, y = Math.floor(i / cols) * gap + gap / 2;
            const ai = appealedSet.get(i);
            if (ai === undefined) return <circle key={i} cx={x} cy={y} r={10} fill="none" stroke={C.ink3} strokeWidth={2} opacity={ghost} />;
            const won = ai < wonP && ai < wonN;
            const shown = f < sec(8.7) || ai < appealP;
            return <circle key={i} cx={x} cy={y} r={shown ? 12 : 10} fill={won ? C.ink : C.surface} stroke={C.ink} strokeWidth={2.6} />;
          })}
        </svg>
        <div style={{ position: "absolute", left: 1090, top: 680, display: "flex", gap: 40, fontSize: 30, color: C.ink2, opacity: a }}>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}><svg width={24} height={24}><circle cx={12} cy={12} r={10} fill={C.ink} /></svg>Overturned on appeal</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12, opacity: b }}><svg width={24} height={24}><circle cx={12} cy={12} r={9} fill="none" stroke={C.ink3} strokeWidth={2} /></svg>Never appealed</span>
        </div>
        <div style={{ position: "absolute", right: 120, top: 150, color: C.ink3, fontSize: 28, textAlign: "right", opacity: a }}>
          Medicare Advantage prior authorization, 2024. Source: KFF, January 2026.
        </div>
      </div>
      {/* the turn */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center", opacity: Math.min(1, q * 1.4),
        transform: `scale(${0.75 + 0.25 * q}) translateX(${(1 - Math.min(1, q)) * 200}px)` }}>
        <div style={{ fontSize: 150, fontWeight: 650, letterSpacing: "-0.055em", lineHeight: 1.02, color: C.ink }}>
          What if checking<br />took <span style={{ background: C.highlight, borderRadius: 24, padding: "0 26px" }}>minutes?</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// pitch: "So we built Denial Auditor." The mark pops and the wordmark wipes in on the night band, then the camera
// dives through the mark into the real landing page (the tour recording) for the rest of the line.
export const Pitch: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: f - 2, fps, config: { damping: 11, stiffness: 170, mass: 0.7 } });
  const word = ease(f, 8, 22);
  const dive = interpolate(f, [sec(1.75), sec(2.35)], [0, 1], { ...clamp, easing: Easing.bezier(0.7, 0, 0.84, 0) });
  const reveal = interpolate(f, [sec(2.0), sec(2.5)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <Sequence from={sec(1.9)} layout="none">
        <AbsoluteFill style={{ opacity: reveal, transform: `scale(${1.25 - 0.25 * ease(f, sec(1.9), sec(2.9))})` }}>
          <Recording clip="tour" dur={dur - sec(1.9)} rate={1.5} cam={[{ t: 0, x: 960, y: 540, s: 1.0 }, { t: 5, x: 900, y: 560, s: 1.08, d: 4 }]} />
        </AbsoluteFill>
      </Sequence>
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, fontFamily: SANS, opacity: 1 - reveal,
        transform: `scale(${1 + dive * 7})`, transformOrigin: "37% 50%" }}>
        <div style={{ transform: `scale(${0.55 + 0.45 * pop}) rotate(${(1 - Math.min(1, pop)) * -12}deg)` }}><LogoMark size={190} onNight draw={Math.min(1, pop)} /></div>
        <span style={{ fontSize: 160, fontWeight: 600, letterSpacing: "-0.05em", color: C.onNight, clipPath: `inset(0 ${(1 - word) * 100}% 0 0)` }}>Denial Auditor</span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// proof: one figure at a time in the same place, each with its own move: the 30 case tiles fill, the 138 rule
// statuses flood the field, the cost counts. Then the honest caveat.
export const Proof: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const a = ease(f, sec(0.3), sec(0.8));
  const casesP = interpolate(f, [sec(1.0), sec(4.0)], [0, 30], clamp);
  const toB = interpolate(f, [sec(4.3), sec(4.7)], [0, 1], { ...clamp, easing: easeIO });
  const rulesP = interpolate(f, [sec(4.5), sec(7.0)], [0, 138], clamp);
  const toC = interpolate(f, [sec(7.2), sec(7.6)], [0, 1], { ...clamp, easing: easeIO });
  const caveat = ease(f, sec(9.5), sec(10.0));
  const push = interpolate(f, [0, dur], [1, 1.04]);
  const fig = (o: number, dy: number, n: React.ReactNode, label: string) => (
    <div style={{ position: "absolute", left: 1080, top: 330, opacity: o, transform: `translateY(${dy}px)` }}>
      <div style={{ fontSize: 210, fontWeight: 300, letterSpacing: "-0.055em", lineHeight: 1, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{n}</div>
      <div style={{ fontSize: 46, fontWeight: 450, color: C.ink2, marginTop: 14, letterSpacing: "-0.02em" }}>{label}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: C.ground, fontFamily: SANS, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${push})`, opacity: 1 - caveat * 0.6 }}>
        {/* 30 case tiles */}
        <svg width={800} height={520} style={{ position: "absolute", left: 140, top: 260, opacity: a * (1 - toB) }}>
          {Array.from({ length: 30 }, (_, i) => {
            const on = i < casesP;
            const x = (i % 6) * 124, y = Math.floor(i / 6) * 100;
            return (
              <g key={i}>
                <rect x={x} y={y} width={104} height={80} rx={14} fill={on ? C.ink : C.sunk} />
                {on && <path d={`M${x + 36} ${y + 41} l12 12 22-24`} fill="none" stroke={C.onNight} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />}
              </g>
            );
          })}
        </svg>
        {/* 138 rule statuses */}
        <svg width={820} height={520} style={{ position: "absolute", left: 140, top: 260, opacity: toB * (1 - toC * 0.7) }}>
          {Array.from({ length: 138 }, (_, i) => {
            const on = i < rulesP;
            const x = (i % 23) * 34 + 16, y = Math.floor(i / 23) * 70 + 40;
            return <circle key={i} cx={x} cy={y} r={on ? 13 : 11} fill={on ? C.ink : C.sunk} />;
          })}
        </svg>
        {fig(a * (1 - toB), -toB * 40, <><Count to={30} a={sec(1.0)} b={sec(4.0)} /><span style={{ color: C.ink3 }}> of 30</span></>, "recommendations right")}
        {fig(toB * (1 - toC), (1 - toB) * 40 - toC * 40, <><Count to={138} a={sec(4.5)} b={sec(7.0)} /><span style={{ color: C.ink3 }}> of 138</span></>, "rule statuses right")}
        {fig(toC, (1 - toC) * 40, <><span style={{ color: C.ink3 }}>~</span><Count to={0.05} a={sec(7.4)} b={sec(8.8)} decimals={2} prefix="$" /></>, "per case, in model calls")}
        <div style={{ position: "absolute", left: 140, top: 150, fontSize: 40, fontWeight: 500, color: C.ink, opacity: a }}>
          On 30 synthetic cases we wrote ourselves
        </div>
      </div>
      <div style={{ position: "absolute", left: 140, top: 860, fontSize: 52, fontWeight: 500, color: C.ink, letterSpacing: "-0.025em", opacity: caveat, transform: `translateY(${(1 - caveat) * 16}px)` }}>
        The pipeline as designed. <span style={{ color: C.ink3 }}>Not accuracy on real charts.</span>
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
          <div style={{ fontSize: 32, color: C.onNight2, marginBottom: 14 }}>Try the live demo at</div>
          <div style={{ fontSize: 40, fontWeight: 450, color: C.onNight, letterSpacing: "-0.01em" }}>{DEMO_URL.replace(/^https:\/\//, "")}</div>
          <svg width={1000} height={8} style={{ display: "block", marginTop: 12 }}><rect x={0} y={2} height={4} rx={2} width={1000 * url} fill={C.verifiedNight} /></svg>
        </div>
        <div style={{ position: "absolute", left: 140, bottom: 150, display: "flex", gap: 40, fontSize: 28, color: C.onNight2, opacity: team }}>
          <span>Built with NVIDIA Nemotron on Nebius Token Factory, and Tavily.</span>
          <span style={{ color: C.onNight3 }}>Synthetic data only.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
