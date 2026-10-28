import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Globe } from "../Globe";
import { SANS } from "../fonts";
import { C, H, W } from "../theme";
import { clamp, easeIO, easeOut } from "../timeline";
import { LogoMark } from "../ui";

// The opening story, on the night band. Times are scene seconds; the voiceover starts at 0.3 s.
// Beats follow video/script.json (greet, biller, grind) and src/cut/subs.json.
const sec = (s: number) => Math.round(s * 30);
const ease = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: easeOut });

// Maya (fictional): an authored flat portrait in the app's palette, headset on. `nod` adds a small lean.
export const Maya: React.FC<{ size?: number; nod?: number }> = ({ size = 320, nod = 0 }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" style={{ display: "block", overflow: "visible" }}>
    <circle cx="100" cy="100" r="100" fill="#e1e0db" />
    <g transform={`rotate(${nod * 6} 100 150)`}>
      <path d="M38 200c4-38 30-58 62-58s58 20 62 58Z" fill="#1e4bd7" opacity="0.92" />
      <path d="M86 132h28v18a14 14 0 0 1-28 0Z" fill="#c99872" />
      <ellipse cx="100" cy="96" rx="40" ry="46" fill="#d9a77f" />
      <path d="M58 96c-4-38 18-58 44-58 30 0 46 22 42 52-8-14-22-24-40-26-14 8-30 14-46 32Z" fill="#2a211c" />
      <path d="M140 90c8 12 8 40-4 58" fill="none" stroke="#2a211c" strokeWidth="10" strokeLinecap="round" />
      <circle cx="84" cy="100" r="4.2" fill="#2a211c" />
      <circle cx="116" cy="100" r="4.2" fill="#2a211c" />
      <path d="M88 118c7 7 17 7 24 0" fill="none" stroke="#2a211c" strokeWidth="4" strokeLinecap="round" />
      {/* headset */}
      <path d="M56 98a44 46 0 0 1 88 0" fill="none" stroke="#0e0f0c" strokeWidth="6" strokeLinecap="round" />
      <rect x="49" y="92" width="14" height="24" rx="6" fill="#0e0f0c" />
      <path d="M56 114c2 14 14 20 28 20" fill="none" stroke="#0e0f0c" strokeWidth="4" strokeLinecap="round" />
      <circle cx="86" cy="134" r="4" fill="#0e0f0c" />
    </g>
  </svg>
);

// A sheet in the denial pile: paper with a red DENIED mark.
const Sheet: React.FC<{ i: number; p: number }> = ({ i, p }) => {
  const y = (1 - p) * -520;
  const r = [-4, 3, -2, 5, -6, 2, -3, 4][i % 8];
  return (
    <div style={{ position: "absolute", left: 0, bottom: i * 15, width: 420, height: 112, background: "#fbfaf7", borderRadius: 6,
      boxShadow: "0 8px 22px rgba(0,0,0,0.35)", transform: `translateY(${y}px) rotate(${r * p + (1 - p) * r * 3}deg)`, opacity: p > 0 ? 1 : 0 }}>
      <div style={{ position: "absolute", left: 26, top: 24, width: 200, height: 10, borderRadius: 5, background: "#d8d6cf" }} />
      <div style={{ position: "absolute", left: 26, top: 46, width: 150, height: 10, borderRadius: 5, background: "#e4e2dc" }} />
      <div style={{ position: "absolute", right: 24, top: 30, transform: "rotate(-9deg)", border: `5px solid ${C.neg}`, borderRadius: 8,
        color: C.neg, fontSize: 34, fontWeight: 800, letterSpacing: "0.04em", padding: "2px 12px", fontFamily: SANS }}>DENIED</div>
    </div>
  );
};

// greet: the mark builds for "team Road House"; Maya pops in; Monday, 8:01, coffee; then the pile lands.
export const Greet: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = ease(f, 2, 26);
  const team = ease(f, 10, 26);
  const lift = interpolate(f, [sec(2.05), sec(2.45)], [0, 1], { ...clamp, easing: easeIO });
  const maya = spring({ frame: f - sec(2.4), fps, config: { damping: 11, stiffness: 140, mass: 0.8 } });
  const tag = ease(f, sec(3.3), sec(3.7));
  const mon = ease(f, sec(5.7), sec(6.0));
  const time = ease(f, sec(6.35), sec(6.6));
  const coffee = ease(f, sec(7.65), sec(7.95));
  const sceneOut = interpolate(f, [sec(8.75), sec(9.05)], [0, 1], { ...clamp, easing: easeIO });
  const inbox = ease(f, sec(9.8), sec(10.0));
  const drops = Array.from({ length: 8 }, (_, i) => interpolate(f, [sec(9.8) + i * 4, sec(9.8) + i * 4 + 7], [0, 1], { ...clamp, easing: easeOut }));
  const count = drops.filter((p) => p >= 1).length;
  const push = interpolate(f, [0, dur], [1, 1.06]);
  return (
    <AbsoluteFill style={{ background: C.night, fontFamily: SANS, overflow: "hidden" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, transform: `scale(${push})` }}>
        <Globe frame={f} cx={960 + lift * 620} cy={560} r={420 + lift * 120} opacity={0.45 + 0.25 * lift} lit={interpolate(f, [0, dur], [0, 0.04])} />
      </svg>
      {/* team Road House */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", flexDirection: "column", alignItems: "center", gap: 36,
        opacity: 1 - lift, transform: `translateY(${-lift * 90}px) scale(${1 - lift * 0.06})` }}>
        <LogoMark size={164} onNight draw={draw} />
        <div style={{ color: C.onNight, fontSize: 80, fontWeight: 560, letterSpacing: "-0.04em", opacity: team, clipPath: `inset(0 ${(1 - team) * 100}% 0 0)` }}>
          Team Road House
        </div>
      </div>
      {/* Maya */}
      <div style={{ position: "absolute", left: 170, top: 250, opacity: maya > 0.02 ? 1 : 0, transform: `scale(${0.6 + 0.4 * maya})`, transformOrigin: "50% 80%" }}>
        <Maya size={380} nod={Math.sin(f / 9) * 0.3 * (1 - sceneOut)} />
        <div style={{ marginTop: 34, opacity: tag, transform: `translateY(${(1 - tag) * 14}px)` }}>
          <div style={{ color: C.onNight, fontSize: 64, fontWeight: 600, letterSpacing: "-0.035em" }}>Maya</div>
          <div style={{ color: C.onNight2, fontSize: 32, marginTop: 6 }}>Billing, small spine clinic. Fictional.</div>
        </div>
      </div>
      {/* Monday morning: three beats, each with its own move */}
      <div style={{ position: "absolute", left: 760, top: 250, opacity: 1 - sceneOut, transform: `translateY(${-sceneOut * 40}px)` }}>
        <div style={{ color: C.onNight, fontSize: 170, fontWeight: 650, letterSpacing: "-0.055em", lineHeight: 0.95,
          clipPath: `inset(${(1 - mon) * 100}% 0 0 0)`, transform: `translateY(${(1 - mon) * 60}px)` }}>Monday.</div>
        <div style={{ color: C.highlight, fontSize: 120, fontWeight: 400, letterSpacing: "-0.045em", marginTop: 18, fontVariantNumeric: "tabular-nums",
          opacity: time, transform: `scale(${0.85 + 0.15 * time})`, transformOrigin: "0 50%" }}>
          8:0{f < sec(6.9) ? 0 : 1} am
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 36, opacity: coffee, transform: `translateX(${(1 - coffee) * -40}px)` }}>
          <svg width="76" height="76" viewBox="0 0 40 40">
            {[0, 1, 2].map((k) => (
              <path key={k} d={`M${13 + k * 6} 13c-3-3 3-5 0-9`} fill="none" stroke={C.onNight2} strokeWidth="2" strokeLinecap="round"
                opacity={0.4 + 0.6 * Math.abs(Math.sin((f + k * 7) / 8))} transform={`translate(0 ${-((f + k * 6) % 18) / 6})`} />
            ))}
            <path d="M8 16h22v10a8 8 0 0 1-8 8h-6a8 8 0 0 1-8-8Z" fill={C.onNight} />
            <path d="M30 19h3a4 4 0 0 1 0 8h-3" fill="none" stroke={C.onNight} strokeWidth="3" />
          </svg>
          <span style={{ color: C.onNight, fontSize: 64, fontWeight: 450, letterSpacing: "-0.03em" }}>Coffee: hot.</span>
        </div>
      </div>
      {/* the pile */}
      <div style={{ position: "absolute", left: 760, top: 210, opacity: inbox }}>
        <div style={{ color: C.onNight, fontSize: 132, fontWeight: 650, letterSpacing: "-0.05em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {Math.max(1, count)} new <span style={{ color: "#e5674b" }}>denials</span>
        </div>
        <div style={{ position: "relative", marginTop: 60, marginLeft: 40, width: 440, height: 240 }}>
          {drops.map((p, i) => <Sheet key={i} i={i} p={p} />)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// biller (Maya): "Oh, come on!" — the fax slams in and DENIED stamps it with a shake; then the clock starts.
const LW = 940;
const k = LW / 1700; // letter.png is 1700x2200
export const STAMP_AT = 12; // frame the stamp lands (sound cue in Main)
export const Biller: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const land = ease(f, 0, 10);
  const stampIn = interpolate(f, [STAMP_AT - 5, STAMP_AT], [0, 1], clamp);
  const shake = f >= STAMP_AT && f < STAMP_AT + 10 ? Math.sin((f - STAMP_AT) * 2.6) * (10 - (f - STAMP_AT)) * 1.8 : 0;
  const z2 = interpolate(f, [sec(3.3), sec(4.2)], [0, 1], { ...clamp, easing: easeIO });
  const fx = 700 * k + (640 * k - 700 * k) * z2;
  const fy = 900 * k + (1250 * k - 900 * k) * z2;
  const sc = 0.95 + 0.6 * z2 + interpolate(f, [0, dur], [0, 0.06]);
  const cx = 1220 - 200 * z2;
  const lx = cx - fx * sc;
  const ly = H / 2 - fy * sc + (1 - land) * 700;
  const oh = spring({ frame: f - 3, fps, config: { damping: 10, stiffness: 180, mass: 0.7 } });
  const swipe = ease(f, sec(4.2), sec(4.7));
  const clock = spring({ frame: f - sec(3.9), fps, config: { damping: 12, stiffness: 160, mass: 0.8 } });
  const go = spring({ frame: f - sec(5.45), fps, config: { damping: 8, stiffness: 200, mass: 0.6 } });
  const drain = interpolate(f, [sec(4.0), dur + 18], [0, 0.12], clamp);
  const days = 60 - Math.floor(interpolate(f, [sec(4.2), dur + 18], [0, 2], clamp));
  return (
    <AbsoluteFill style={{ background: C.night, fontFamily: SANS, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
        <div style={{ position: "absolute", left: lx, top: ly, width: LW, transformOrigin: "0 0", transform: `scale(${sc}) rotate(${-6 + land * 4}deg)`, opacity: land }}>
          <Img src={staticFile("img/letter015.png")} style={{ width: LW, display: "block", borderRadius: 4, boxShadow: "0 40px 120px rgba(0,0,0,0.55)" }} />
          <svg width={LW} height={2200 * k} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <rect x={470 * k} y={1228 * k} width={262 * k * swipe} height={48 * k} fill={C.highlight} opacity={0.55} />
          </svg>
          <div style={{ position: "absolute", left: 600 * k, top: 820 * k, transformOrigin: "50% 50%", transform: `rotate(-11deg) scale(${2.4 - 1.4 * stampIn})`,
            opacity: stampIn, border: `14px solid ${C.neg}`, borderRadius: 18, padding: "10px 38px 8px", color: C.neg, fontSize: 150, fontWeight: 800,
            letterSpacing: "0.04em", lineHeight: 1, mixBlendMode: "multiply" }}>DENIED</div>
        </div>
      </div>
      {/* Maya reacts */}
      <div style={{ position: "absolute", left: 110, top: 300, display: "flex", alignItems: "flex-start", gap: 28,
        transform: `translateY(${(1 - Math.min(1, oh)) * 40}px)`, opacity: Math.min(1, oh * 1.5) }}>
        <div style={{ transform: `rotate(${(1 - Math.min(1, go)) * 0 + Math.sin(go * Math.PI) * -8}deg) translateY(${-Math.sin(Math.min(1, go) * Math.PI) * 16}px)` }}>
          <Maya size={190} nod={-0.6} />
        </div>
        <div style={{ position: "relative", background: C.onNight, color: C.ink, borderRadius: 34, padding: "22px 36px 26px", transform: `scale(${0.7 + 0.3 * oh})`,
          transformOrigin: "0% 50%", marginTop: 26 }}>
          <svg width="30" height="30" viewBox="0 0 30 30" style={{ position: "absolute", left: -18, top: 30 }}><path d="M30 0 L0 16 L30 30Z" fill={C.onNight} /></svg>
          <div style={{ fontSize: 96, fontWeight: 650, letterSpacing: "-0.045em", lineHeight: 1 }}>Oh, come on!</div>
        </div>
      </div>
      {/* the appeal clock */}
      <div style={{ position: "absolute", left: 1210, top: 690, display: "flex", alignItems: "center", gap: 26, padding: "22px 38px 22px 24px",
        borderRadius: 999, background: C.highlight, opacity: Math.min(1, clock * 1.4), transform: `scale(${0.8 + 0.2 * clock}) rotate(${(1 - Math.min(1, clock)) * -6}deg)` }}>
        <svg width={96} height={96} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(14,15,12,0.18)" strokeWidth="4" />
          <circle cx="20" cy="20" r="16" fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={drain} transform="rotate(-90 20 20)" />
          <line x1="20" y1="20" x2="20" y2="9" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${f * 14} 20 20)`} />
        </svg>
        <div>
          <div style={{ color: C.ink2, fontSize: 30, fontWeight: 500 }}>Appeal window</div>
          <div style={{ color: C.ink, fontSize: 68, fontWeight: 560, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{days} days</div>
        </div>
      </div>
      <div style={{ position: "absolute", right: 72, top: 52, color: C.onNight3, fontSize: 26, opacity: land }}>Synthetic notice, no real patient</div>
    </AbsoluteFill>
  );
};

// grind (light): the to-do list writes itself row by row while the hours spin up; then the question lands.
const TASKS = ["Dig up the payer's policy", "Read it, rule by rule", "Match each rule to the chart", "Write the letter"];
export const Grind: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const at = [0.5, 3.2, 4.6, 5.5];
  const rows = at.map((s) => ease(f, sec(s), sec(s) + 12));
  const ticks = at.map((s) => ease(f, sec(s) + 14, sec(s) + 22));
  const hrsIn = ease(f, sec(6.7), sec(7.05));
  const spin = interpolate(f, [sec(6.7), sec(8.7)], [0, 1], { ...clamp, easing: easeOut });
  const listOut = interpolate(f, [sec(9.15), sec(9.5)], [0, 1], { ...clamp, easing: easeIO });
  const payers = ease(f, sec(9.4), sec(9.8));
  const why = spring({ frame: f - sec(11.45), fps, config: { damping: 10, stiffness: 170, mass: 0.7 } });
  return (
    <AbsoluteFill style={{ background: C.ground, fontFamily: SANS, overflow: "hidden" }}>
      {/* the list, written on Maya's pad */}
      <div style={{ position: "absolute", left: 140, top: 190, width: 1120, opacity: 1 - listOut, transform: `translateX(${-listOut * 120}px)` }}>
        {TASKS.map((t, i) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 30, height: 140, opacity: rows[i], transform: `translateY(${(1 - rows[i]) * 26}px)` }}>
            <svg width="62" height="62" viewBox="0 0 24 24">
              <rect x="2" y="2" width="20" height="20" rx="6" fill="none" stroke={C.ink} strokeWidth="2.2" />
              <path d="M7 12.5l3.2 3.2L17.5 8" fill="none" stroke={C.ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ticks[i]} />
            </svg>
            <span style={{ fontSize: 70, fontWeight: 500, letterSpacing: "-0.04em", color: C.ink, whiteSpace: "nowrap" }}>{t}</span>
          </div>
        ))}
      </div>
      {/* the hours */}
      <div style={{ position: "absolute", left: 1290, top: 250, opacity: hrsIn * (1 - listOut), transform: `scale(${0.9 + 0.1 * hrsIn})` }}>
        <svg width={280} height={280} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="18" fill={C.surface} />
          <line x1="20" y1="20" x2="20" y2="9" stroke={C.ink} strokeWidth="2" strokeLinecap="round" transform={`rotate(${spin * 1080} 20 20)`} />
          <line x1="20" y1="20" x2="20" y2="12.5" stroke={C.ink} strokeWidth="2.8" strokeLinecap="round" transform={`rotate(${spin * 90} 20 20)`} />
          <circle cx="20" cy="20" r="1.8" fill={C.ink} />
        </svg>
        <div style={{ fontSize: 120, fontWeight: 400, letterSpacing: "-0.05em", color: C.ink, fontVariantNumeric: "tabular-nums", marginTop: 20 }}>
          Hours<span style={{ fontSize: 48, color: C.ink3, marginLeft: 18, letterSpacing: "-0.02em" }}>per denial</span>
        </div>
      </div>
      {/* payers check rule by rule; why can't Maya? */}
      <div style={{ position: "absolute", left: 140, top: 300, opacity: payers }}>
        <div style={{ fontSize: 110, fontWeight: 500, letterSpacing: "-0.05em", color: C.ink2, transform: `translateY(${(1 - payers) * 30}px)` }}>
          Payers check rule by rule.
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 32, marginTop: 40, padding: "18px 44px 22px 22px", borderRadius: 999, background: C.highlight,
          transform: `scale(${0.7 + 0.3 * why}) rotate(${(1 - Math.min(1, why)) * -4}deg)`, transformOrigin: "0% 50%", opacity: Math.min(1, why * 1.6) }}>
          <Maya size={130} nod={Math.sin(f / 6) * 0.4} />
          <span style={{ fontSize: 120, fontWeight: 650, letterSpacing: "-0.05em", color: C.ink }}>Why can't Maya?</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
