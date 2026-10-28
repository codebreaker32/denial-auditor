import React from "react";
import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import recs from "./recs.json";
import { C, FPS, H, W } from "./theme";
import { SANS } from "./fonts";
import { clamp, easeIO, easeOut } from "./timeline";

// A camera key: arrive at scene second t looking at recording point (x, y) at zoom s; the move takes d seconds.
export type Key = { t: number; x: number; y: number; s: number; d?: number };
// A callout drawn on the recording (1920x1080 recording coordinates), visible from t0 to t1 scene seconds.
export type Callout = {
  t0: number; t1: number; box: [number, number, number, number]; label?: string;
  tone?: "hi" | "verified" | "neg" | "warn" | "pos" | "ink"; dim?: boolean; below?: boolean;
};

const TONES = {
  hi: { ring: C.highlight, bg: C.highlight, fg: C.ink },
  verified: { ring: C.verified, bg: C.verified, fg: "#fff" },
  neg: { ring: C.neg, bg: C.neg, fg: "#fff" },
  warn: { ring: C.warnFill, bg: C.warnFill, fg: C.ink },
  pos: { ring: C.pos, bg: C.pos, fg: "#fff" },
  ink: { ring: C.ink, bg: C.ink, fg: C.onNight },
};

const AVAILABLE = recs as Record<string, number>;

export function camAt(keys: Key[], t: number) {
  let { x, y, s } = keys[0];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    const d = k.d ?? 1.1;
    const p = easeIO(Math.min(1, Math.max(0, (t - (k.t - d)) / d)));
    if (p <= 0) break;
    x += (k.x - x) * p;
    y += (k.y - y) * p;
    s += (k.s - s) * p;
  }
  return { x, y, s };
}

// The 1920x1080 frame a clip will fill: the real recording when public/rec/<clip>.mp4 exists (listed in recs.json by
// scripts/record.py), else a labelled placeholder of the same size so the camera and callouts can be timed.
const Footage: React.FC<{ clip: string; from: number; rate: number; dur: number }> = ({ clip, from, rate, dur }) => {
  const len = AVAILABLE[clip];
  if (!len) return <Placeholder clip={clip} />;
  const playable = Math.max(1, Math.floor(((len - from) * FPS) / rate) - 2);
  const v = (
    <OffthreadVideo src={staticFile(`rec/${clip}.mp4`)} startFrom={Math.round(from * FPS)} playbackRate={rate} muted style={{ width: W, height: H, display: "block" }} />
  );
  return (
    <>
      <Sequence durationInFrames={Math.min(playable, dur)} layout="none">{v}</Sequence>
      {dur > playable && (
        <Sequence from={playable} layout="none">
          <Freeze frame={playable - 1}>{v}</Freeze>
        </Sequence>
      )}
    </>
  );
};

const Placeholder: React.FC<{ clip: string }> = ({ clip }) => (
  <AbsoluteFill style={{ background: C.ground, fontFamily: SANS }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 250, height: H, background: C.sunk }} />
    <div style={{ position: "absolute", left: 276, top: 60, width: 360, height: 960, borderRadius: 16, background: C.surface }} />
    <div style={{ position: "absolute", left: 684, top: 60, width: 900, height: 420, borderRadius: 16, background: C.surface }} />
    <div style={{ position: "absolute", left: 684, top: 510, width: 900, height: 510, borderRadius: 16, background: C.surface, border: `2px dashed ${C.rule2}`,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 44, fontWeight: 500, color: C.ink }}>Recording: {clip}</div>
      <div style={{ fontSize: 26, color: C.ink3 }}>public/rec/{clip}.mp4 · run scripts/record.py</div>
    </div>
  </AbsoluteFill>
);

// A highlighter sweep over lines of text in the recording: each line box fills left to right in turn.
export type Sweep = { t0: number; t1: number; lines: [number, number, number, number][] };

export const Recording: React.FC<{
  clip: string; dur: number; from?: number; rate?: number; cam: Key[]; callouts?: Callout[]; sweeps?: Sweep[]; children?: React.ReactNode;
}> = ({ clip, dur, from = 0, rate = 1, cam, callouts = [], sweeps = [], children }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const c = camAt(cam, t);
  // a slow continuous push keeps even held shots alive
  const s = c.s * (1 + 0.025 * Math.min(1, t / (dur / FPS)));
  let tx = W / 2 - c.x * s;
  let ty = H / 2 - c.y * s;
  tx = Math.min(0, Math.max(W - W * s, tx));
  ty = Math.min(0, Math.max(H - H * s, ty));
  const toScreen = (x: number, y: number) => [x * s + tx, y * s + ty];

  return (
    <AbsoluteFill style={{ background: C.ground, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
        <Footage clip={clip} from={from} rate={rate} dur={dur} />
        {sweeps.map((w, i) => {
          const z = interpolate(t, [w.t1 - 0.3, w.t1], [1, 0], clamp);
          return w.lines.map((b, j) => {
            const per = 0.35;
            const p = interpolate(t, [w.t0 + j * per, w.t0 + (j + 1) * per], [0, 1], { ...clamp, easing: easeOut });
            return <div key={`${i}-${j}`} style={{ position: "absolute", left: b[0], top: b[1], height: b[3] - b[1], width: (b[2] - b[0]) * p,
              background: C.highlight, opacity: 0.45 * z, mixBlendMode: "multiply", borderRadius: 3 }} />;
          });
        })}
      </div>
      {/* callouts are drawn in screen space from transformed boxes, so strokes stay crisp at any zoom */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          {callouts.map((k, i) => {
            const [x0, y0] = toScreen(k.box[0], k.box[1]);
            const [x1, y1] = toScreen(k.box[2], k.box[3]);
            return (
              <mask id={`m${i}`} key={i}>
                <rect width={W} height={H} fill="white" />
                <rect x={x0 - 10} y={y0 - 10} width={x1 - x0 + 20} height={y1 - y0 + 20} rx={16} fill="black" />
              </mask>
            );
          })}
        </defs>
        {callouts.map((k, i) => {
          const a = interpolate(t, [k.t0, k.t0 + 0.5], [0, 1], { ...clamp, easing: easeOut });
          const z = interpolate(t, [k.t1 - 0.3, k.t1], [1, 0], clamp);
          const o = a * z;
          if (o <= 0) return null;
          const [x0, y0] = toScreen(k.box[0], k.box[1]);
          const [x1, y1] = toScreen(k.box[2], k.box[3]);
          const w = x1 - x0 + 20, h = y1 - y0 + 20;
          const per = 2 * (w + h);
          const tone = TONES[k.tone ?? "hi"];
          return (
            <g key={i} opacity={z}>
              {k.dim !== false && <rect width={W} height={H} fill="rgba(14,15,12,0.34)" mask={`url(#m${i})`} opacity={a} />}
              <rect x={x0 - 10} y={y0 - 10} width={w} height={h} rx={16} fill="none" stroke={tone.ring} strokeWidth={5}
                strokeDasharray={per} strokeDashoffset={per * (1 - a)} />
            </g>
          );
        })}
      </svg>
      {callouts.map((k, i) => {
        if (!k.label) return null;
        const a = interpolate(t, [k.t0 + 0.25, k.t0 + 0.7], [0, 1], { ...clamp, easing: easeOut });
        const z = interpolate(t, [k.t1 - 0.3, k.t1], [1, 0], clamp);
        if (a * z <= 0) return null;
        const [x0, y0] = toScreen(k.box[0], k.box[1]);
        const [, y1] = toScreen(k.box[2], k.box[3]);
        const tone = TONES[k.tone ?? "hi"];
        const below = k.below ?? y0 < 150;
        const left = Math.max(40, Math.min(W - 760, x0 - 10));
        return (
          <div key={`l${i}`} style={{
            position: "absolute", left, top: below ? y1 + 24 : undefined, bottom: below ? undefined : H - y0 + 24,
            background: tone.bg, color: tone.fg, fontFamily: SANS, fontSize: 36, fontWeight: 560, letterSpacing: "-0.015em",
            padding: "12px 24px 14px", borderRadius: 14, whiteSpace: "nowrap", opacity: a * z,
            transform: `translateY(${(1 - a) * (below ? -10 : 10)}px)`,
          }}>{k.label}</div>
        );
      })}
      {children}
    </AbsoluteFill>
  );
};
