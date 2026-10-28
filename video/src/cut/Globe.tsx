import React, { useMemo } from "react";
import { C } from "./theme";

// The landing's policy globe, redrawn for video: a dotted sphere (one dot cell per policy sentence in spirit),
// rotating; "lit" dots are rules checked against the chart and glow verified blue.
type P = { x: number; y: number; z: number; lit: number };

function sphere(n: number): P[] {
  const pts: P[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, lit: rnd() });
  }
  return pts;
}

export const Globe: React.FC<{
  frame: number; cx: number; cy: number; r: number; n?: number; spin?: number; lit?: number; dot?: number; opacity?: number;
}> = ({ frame, cx, cy, r, n = 1500, spin = 0.0035, lit = 0, dot = 2.4, opacity = 1 }) => {
  const pts = useMemo(() => sphere(n), [n]);
  const a = frame * spin + 0.6;
  const tilt = 0.32;
  const ca = Math.cos(a), sa = Math.sin(a), ct = Math.cos(tilt), st = Math.sin(tilt);
  const dots: React.ReactNode[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const x1 = p.x * ca + p.z * sa;
    const z1 = -p.x * sa + p.z * ca;
    const y2 = p.y * ct - z1 * st;
    const z2 = p.y * st + z1 * ct;
    if (z2 < -0.15) continue;
    const depth = (z2 + 0.15) / 1.15;
    const isLit = p.lit < lit;
    const rr = dot * (0.55 + 0.6 * depth) * (isLit ? 1.35 : 1);
    dots.push(
      <circle key={i} cx={cx + x1 * r} cy={cy - y2 * r} r={rr} fill={isLit ? C.verifiedNight : C.onNight}
        opacity={(isLit ? 0.95 : 0.16 + 0.5 * depth) * opacity} />,
    );
  }
  return <g>{dots}</g>;
};
