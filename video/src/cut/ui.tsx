import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "./theme";
import { SANS } from "./fonts";
import { clamp, easeOut } from "./timeline";

// 0→1 over [start, start+len] frames with the app's enter curve.
export const useP = (start: number, len = 20) => {
  const f = useCurrentFrame();
  return interpolate(f, [start, start + len], [0, 1], { ...clamp, easing: easeOut });
};

// A spring entrance that never bounces: fade plus a short settle.
export const useEnter = (delay = 0, dy = 18) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: { damping: 200, stiffness: 110 } });
  return { opacity: p, transform: `translateY(${(1 - p) * dy}px)` } as React.CSSProperties;
};

// Fade out over [start, start+len].
export const out = (f: number, start: number, len = 12) => interpolate(f, [start, start + len], [1, 0], clamp);

// The product mark from ui/src/features/ui.tsx: ink rounded square, an opening quote, a blue check.
// draw: 0..1 builds it (square, then quote, then the check stroke).
export const LogoMark: React.FC<{ size?: number; onNight?: boolean; draw?: number }> = ({ size = 26, onNight = false, draw = 1 }) => {
  const sq = interpolate(draw, [0, 0.45], [0, 1], clamp);
  const q = interpolate(draw, [0.3, 0.65], [0, 1], clamp);
  const ck = interpolate(draw, [0.55, 1], [0, 1], clamp);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "none", overflow: "visible" }}>
      <g style={{ transformOrigin: "12px 12px", transform: `scale(${0.93 + 0.07 * sq})`, opacity: sq }}>
        <rect width="24" height="24" rx="7" fill={onNight ? C.onNight : C.ink} />
      </g>
      <path
        transform="rotate(180 7.9 12) translate(0 -.4)"
        d="M10.2 9.6a2.35 2.35 0 1 0-2.6 2.34c-.2 1.24-.94 2.2-2.1 2.86l.62.98c2.36-1.12 3.98-3.3 4.08-6.18Z"
        fill={onNight ? C.ink : C.onNight}
        opacity={q}
      />
      <path
        d="M11.6 13.2l2.5 2.6 5.1-6.4"
        fill="none"
        stroke={onNight ? C.verifiedNight : C.verified}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={12}
        strokeDashoffset={12 * (1 - ck)}
      />
    </svg>
  );
};

// Status glyphs, always shown with a word.
export type Tone = "pos" | "warn" | "neg" | "teal" | "clay" | "quiet" | "verified" | "ink";
export const TONE: Record<Tone, string> = {
  pos: C.pos, warn: C.warn, neg: C.neg, teal: C.teal, clay: C.clay, quiet: C.quiet, verified: C.verified, ink: C.ink,
};

export const Glyph: React.FC<{ name: "check" | "ring" | "half" | "x" | "lock"; size?: number; color: string; draw?: number }> = ({ name, size = 28, color, draw = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ flex: "none" }}>
    {name === "check" && (
      <>
        <circle cx="8" cy="8" r="7.2" fill={color} />
        <path d="M4.9 8.3l2.1 2.1 4.1-4.6" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={10} strokeDashoffset={10 * (1 - draw)} />
      </>
    )}
    {name === "ring" && <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="1.8" />}
    {name === "half" && (
      <>
        <circle cx="8" cy="8" r="6" fill="none" stroke={color} strokeWidth="1.8" />
        <path d="M8 2a6 6 0 0 1 0 12Z" fill={color} />
      </>
    )}
    {name === "x" && (
      <>
        <circle cx="8" cy="8" r="7.2" fill={color} />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      </>
    )}
    {name === "lock" && (
      <>
        <rect x="3" y="7" width="10" height="7.5" rx="1.8" fill={color} />
        <path d="M5.2 7V5.3a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke={color} strokeWidth="1.6" />
      </>
    )}
  </svg>
);

// Short on-screen caption over a recording: an ink pill, bottom left, large and legible.
export const Caption: React.FC<{ text: string; start?: number; end: number }> = ({ text, start = 10, end }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [start, start + 18], [0, 1], { ...clamp, easing: easeOut });
  const o = interpolate(f, [end - 10, end], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute", left: 72, bottom: 64, maxWidth: 1240, padding: "22px 36px 24px", borderRadius: 999,
        background: "rgba(11,12,10,0.92)", color: C.onNight, fontFamily: SANS, fontSize: 46, fontWeight: 500,
        letterSpacing: "-0.02em", lineHeight: 1.1, opacity: p * o, transform: `translateY(${(1 - p) * 24}px)`,
      }}
    >
      {text}
    </div>
  );
};

// A number that counts up between frames [a, b].
export const Count: React.FC<{ to: number; a: number; b: number; decimals?: number; prefix?: string; suffix?: string; style?: React.CSSProperties }> = ({ to, a, b, decimals = 0, prefix = "", suffix = "", style }) => {
  const f = useCurrentFrame();
  const v = interpolate(f, [a, b], [0, to], { ...clamp, easing: easeOut });
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
};
