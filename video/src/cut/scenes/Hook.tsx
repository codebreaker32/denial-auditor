import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Globe } from "../Globe";
import { SANS } from "../fonts";
import { C, H, W } from "../theme";
import { clamp, easeIO, easeOut } from "../timeline";
import { LogoMark, out } from "../ui";

const sec = (s: number) => Math.round(s * 30);

// greet (7.3 s): night ground, the policy globe turning; the mark builds itself for "team Road House",
// then lifts away and the morning sets the scene.
export const Greet: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const push = interpolate(f, [0, dur], [1, 1.14], { easing: easeIO });
  const draw = interpolate(f, [8, 44], [0, 1], { ...clamp, easing: easeOut });
  const team = interpolate(f, [26, 46], [0, 1], { ...clamp, easing: easeOut });
  const lift = interpolate(f, [74, 96], [0, 1], { ...clamp, easing: easeIO });
  const morn = interpolate(f, [92, 114], [0, 1], { ...clamp, easing: easeOut });
  const globeDim = interpolate(f, [0, 20, 70, 100], [0, 0.45, 0.45, 1], clamp);
  return (
    <AbsoluteFill style={{ background: C.night, fontFamily: SANS, overflow: "hidden" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, transform: `scale(${push})`, transformOrigin: "50% 55%" }}>
        <Globe frame={f} cx={960 + lift * 340} cy={560} r={420 + lift * 60} lit={interpolate(f, [100, dur], [0, 0.05], clamp)} opacity={globeDim} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", flexDirection: "column", alignItems: "center", gap: 40,
        opacity: 1 - lift, transform: `translateY(${-lift * 80}px)` }}>
        <div style={{ filter: "drop-shadow(0 0 60px rgba(11,12,10,0.9))" }}><LogoMark size={168} onNight draw={draw} /></div>
        <div style={{ color: C.onNight, fontSize: 76, fontWeight: 500, letterSpacing: "-0.035em", opacity: team, transform: `translateY(${(1 - team) * 16}px)` }}>
          Team Road House
        </div>
      </div>
      <div style={{ position: "absolute", left: 150, top: 380, opacity: morn * out(f, dur + 6, 14), transform: `translateY(${(1 - morn) * 24}px)` }}>
        <div style={{ color: C.onNight3, fontSize: 34, fontWeight: 450, marginBottom: 18 }}>A three-doctor practice</div>
        <div style={{ color: C.onNight, fontSize: 132, fontWeight: 300, letterSpacing: "-0.045em", lineHeight: 1 }}>
          Monday, <span style={{ fontVariantNumeric: "tabular-nums" }}>8:0{f < 150 ? 1 : 2}</span> am
        </div>
      </div>
    </AbsoluteFill>
  );
};

// biller (7.4 s): "Oh, no." — the synthetic denial fax slams onto the night desk and a red DENIED stamp hits
// it with a shake; the camera then slides down to the 60-day appeal line, highlighter sweeps it, and the
// appeal clock starts draining.
const LW = 980; // letter width on screen
const k = LW / 1700; // letter.png is 1700x2200
export const STAMP_AT = 13; // frame the stamp lands (sound cue in Main)
export const Biller: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const land = interpolate(f, [0, 12], [0, 1], { ...clamp, easing: easeOut });
  const stampIn = interpolate(f, [STAMP_AT - 5, STAMP_AT], [0, 1], clamp);
  const shake = f >= STAMP_AT && f < STAMP_AT + 10 ? Math.sin((f - STAMP_AT) * 2.6) * (10 - (f - STAMP_AT)) * 1.6 : 0;
  // camera on the letter: whole page → the 60-day line
  const z2 = interpolate(f, [sec(3.6), sec(4.7)], [0, 1], { ...clamp, easing: easeIO });
  const fx = 700 * k + (640 * k - 700 * k) * z2;
  const fy = 900 * k + (1250 * k - 900 * k) * z2;
  const sc = 0.92 + 0.62 * z2 + interpolate(f, [0, dur], [0, 0.07]);
  const cx = 1180 - 220 * z2;
  const lx = cx - fx * sc;
  const ly = H / 2 - fy * sc + (1 - land) * 700;
  const oh = interpolate(f, [4, 12], [0, 1], { ...clamp, easing: easeOut });
  const ohOut = interpolate(f, [sec(3.4), sec(3.9)], [1, 0], clamp);
  const swipe = interpolate(f, [sec(4.6), sec(5.2)], [0, 1], { ...clamp, easing: easeOut });
  const clock = interpolate(f, [sec(4.9), sec(5.5)], [0, 1], { ...clamp, easing: easeOut });
  const drain = interpolate(f, [sec(5.2), dur + 18], [0, 0.14], clamp);
  const days = 60 - Math.floor(interpolate(f, [sec(5.4), dur + 18], [0, 3], clamp));
  return (
    <AbsoluteFill style={{ background: C.night, fontFamily: SANS, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
        <div style={{ position: "absolute", left: lx, top: ly, width: LW, transformOrigin: "0 0",
          transform: `scale(${sc}) rotate(${-6 + land * 4}deg)`, opacity: land }}>
          <Img src={staticFile("img/letter015.png")} style={{ width: LW, display: "block", borderRadius: 4, boxShadow: "0 40px 120px rgba(0,0,0,0.55)" }} />
          <svg width={LW} height={2200 * k} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <rect x={470 * k} y={1228 * k} width={262 * k * swipe} height={48 * k} fill={C.highlight} opacity={0.55} />
          </svg>
          {/* the stamp */}
          <div style={{ position: "absolute", left: 640 * k, top: 820 * k, transformOrigin: "50% 50%",
            transform: `rotate(-11deg) scale(${2.4 - 1.4 * stampIn})`, opacity: stampIn,
            border: `${14 * 1}px solid ${C.neg}`, borderRadius: 18, padding: "10px 38px 8px", color: C.neg,
            fontSize: 150, fontWeight: 800, letterSpacing: "0.04em", lineHeight: 1, mixBlendMode: "multiply" }}>
            DENIED
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 120, top: 380, color: C.onNight, fontSize: 180, fontWeight: 600, letterSpacing: "-0.05em",
        opacity: oh * ohOut, transform: `scale(${0.8 + 0.2 * oh}) rotate(${(1 - oh) * -6}deg)`, transformOrigin: "0% 50%" }}>
        Oh, no.
      </div>
      {/* the appeal clock */}
      <div style={{ position: "absolute", left: 1220, top: 640, display: "flex", alignItems: "center", gap: 28, padding: "24px 40px 24px 26px",
        borderRadius: 999, background: C.highlight, opacity: clock, transform: `translateY(${(1 - clock) * 30}px) scale(${0.9 + 0.1 * clock})` }}>
        <svg width={96} height={96} viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(14,15,12,0.18)" strokeWidth="4" />
          <circle cx="20" cy="20" r="16" fill="none" stroke={C.ink} strokeWidth="4" strokeLinecap="round" pathLength={1}
            strokeDasharray={1} strokeDashoffset={drain} transform="rotate(-90 20 20)" />
          <line x1="20" y1="20" x2="20" y2="9" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${f * 12} 20 20)`} />
        </svg>
        <div>
          <div style={{ color: C.ink2, fontSize: 30, fontWeight: 500 }}>Appeal window</div>
          <div style={{ color: C.ink, fontSize: 68, fontWeight: 500, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{days} days</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 72, bottom: 56, color: C.onNight3, fontSize: 24, opacity: land }}>Synthetic data · no real patients</div>
    </AbsoluteFill>
  );
};
