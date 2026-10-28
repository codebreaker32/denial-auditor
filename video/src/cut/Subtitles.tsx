import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import subs from "./subs.json";
import { SANS } from "./fonts";
import { FPS } from "./theme";
import { clamp, SCENES } from "./timeline";

// Burned-in subtitles: one line (two at most) on a soft ink band at the bottom, sentence by sentence, timed from
// the voiceover's own pauses (scripts/subtitles.py writes subs.json). Reads on the night band and on light stone.
type Cue = { t0: number; t1: number; text: string };
const CUES = SCENES.flatMap((s) =>
  ((subs as Record<string, Cue[]>)[s.id] ?? []).map((c) => ({
    a: s.from + Math.round((s.lead + c.t0) * FPS), b: s.from + Math.round((s.lead + c.t1) * FPS) + 4, text: c.text,
  })),
);

export const Subtitles: React.FC = () => {
  const f = useCurrentFrame();
  const cue = CUES.find((c) => f >= c.a && f < c.b);
  if (!cue) return null;
  const o = interpolate(f, [cue.a, cue.a + 4, cue.b - 4, cue.b], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ maxWidth: 1320, padding: "10px 26px 12px", borderRadius: 14, background: "rgba(14,13,11,0.78)", color: "#f4efe6",
        fontFamily: SANS, fontSize: 33, fontWeight: 450, lineHeight: 1.3, letterSpacing: "-0.005em", textAlign: "center", opacity: o,
        textWrap: "balance" } as React.CSSProperties}>
        {cue.text}
      </div>
    </div>
  );
};
