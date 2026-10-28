import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Biller, Greet, Grind, STAMP_AT } from "./scenes/Hook";
import { Subtitles } from "./Subtitles";
import { Close, Pitch, Proof, Stakes } from "./scenes/Graphics";
import { Appeal, Case, Check, How, Physician, Rules, Tamper, Worklist } from "./scenes/Recs";
import { C, W } from "./theme";
import { clamp, easeIO, easeOut, SCENES, TOTAL } from "./timeline";
import "./fonts";

export { TOTAL };

// How each scene arrives. The outgoing scene keeps playing underneath for OV frames.
type In = "fade" | "zoom" | "rise" | "whip" | "punch";
const OV = 14;
const VIEW: Record<string, { C: React.FC<{ dur: number }>; in: In }> = {
  greet: { C: Greet, in: "fade" },
  biller: { C: Biller, in: "punch" },
  grind: { C: Grind, in: "rise" },
  stakes: { C: Stakes, in: "whip" },
  pitch: { C: Pitch, in: "punch" },
  worklist: { C: Worklist, in: "fade" },
  case: { C: Case, in: "whip" },
  rules: { C: Rules, in: "whip" },
  appeal: { C: Appeal, in: "whip" },
  tamper: { C: Tamper, in: "punch" },
  physician: { C: Physician, in: "whip" },
  check: { C: Check, in: "whip" },
  how: { C: How, in: "zoom" },
  proof: { C: Proof, in: "rise" },
  close: { C: Close, in: "fade" },
};

const Enter: React.FC<{ kind: In; dur: number; exitWhip: boolean; children: React.ReactNode }> = ({ kind, dur, exitWhip, children }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, kind === "whip" ? 10 : OV], [0, 1], { ...clamp, easing: kind === "whip" ? easeOut : easeIO });
  let style: React.CSSProperties = {};
  if (kind === "fade") style = { opacity: p };
  if (kind === "zoom") style = { opacity: p, transform: `scale(${1.22 - 0.22 * p})` };
  if (kind === "punch") style = { opacity: interpolate(f, [0, 3], [0, 1], clamp), transform: `scale(${1.06 - 0.06 * p})` };
  if (kind === "rise") style = { clipPath: `inset(${(1 - p) * 100}% 0 0 0 round ${(1 - p) * 60}px)` };
  if (kind === "whip") style = { transform: `translateX(${(1 - p) * W}px)`, filter: p < 1 ? `blur(${(1 - p) * 18}px)` : undefined };
  // leaving: when the next scene whips in, this one whips out to the left
  if (exitWhip && f >= dur) {
    const q = interpolate(f, [dur, dur + 10], [0, 1], { ...clamp, easing: easeOut });
    style = { ...style, transform: `${style.transform ?? ""} translateX(${-q * W * 0.6}px)`, filter: `blur(${q * 18}px)` };
  }
  return <AbsoluteFill style={style}>{children}</AbsoluteFill>;
};

// Sound: a quiet synthesized bed under the voice, and effects on the beats (scripts/sfx.py, CREDITS.md).
const at = (id: string, s: number) => SCENES.find((x) => x.id === id)!.from + Math.round(s * 30);
const SFX: [string, number, number][] = [
  ["thump", at("biller", STAMP_AT / 30), 0.55],
  ["tick", at("biller", 4.2), 0.25], ["tick", at("biller", 5.2), 0.25], ["pop", at("biller", 5.45), 0.3],
  ["pop", at("greet", 2.4), 0.3], ["pop", at("greet", 5.7), 0.25], ["pop", at("greet", 6.35), 0.25],
  ...Array.from({ length: 8 }, (_, i) => ["click", at("greet", 9.8) + i * 4 + 6, 0.35] as [string, number, number]),
  ["tick", at("grind", 1.6), 0.25], ["tick", at("grind", 3.65), 0.25], ["tick", at("grind", 5.05), 0.25], ["tick", at("grind", 5.95), 0.25],
  ["whoosh", at("grind", 6.6), 0.2], ["pop", at("grind", 11.45), 0.35],
  ["pop", at("stakes", 6.5), 0.35], ["pop", at("stakes", 10.4), 0.35], ["whoosh", at("stakes", 11.25), 0.3],
  ["pop", at("pitch", 0.1), 0.35], ["whoosh", at("pitch", 1.8), 0.3],
  ["pop", at("proof", 4.0), 0.3], ["pop", at("proof", 7.0), 0.3], ["pop", at("proof", 8.6), 0.3],
  ["click", at("tamper", 7.6), 0.6],
  ["chime", at("tamper", 11.0), 0.3],
  ["whoosh", at("physician", 5.5), 0.25],
  ["pop", at("check", 9.0), 0.3],
  ["chime", at("close", 7.6), 0.22],
  ...SCENES.filter((s) => VIEW[s.id].in === "whip").map((s) => ["whoosh", s.from - 3, 0.28] as [string, number, number]),
];

export const Main: React.FC = () => (
  <AbsoluteFill style={{ background: C.night }}>
    {SCENES.map((s, i) => {
      const v = VIEW[s.id];
      const next = SCENES[i + 1];
      const exitWhip = !!next && VIEW[next.id].in === "whip";
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={s.dur + (next ? OV : 0)} name={s.id}>
          <Enter kind={i === 0 ? "fade" : v.in} dur={s.dur} exitWhip={exitWhip}>
            <v.C dur={s.dur} />
          </Enter>
        </Sequence>
      );
    })}
    <Subtitles />
    {SCENES.map((s) => (
      <Sequence key={`a-${s.id}`} from={s.from + Math.round(s.lead * 30)} name={`vo ${s.id}`}>
        <Audio src={staticFile(s.audio)} />
      </Sequence>
    ))}
    {SFX.map(([name, from, vol], i) => (
      <Sequence key={`s${i}`} from={Math.max(0, from)} durationInFrames={45} name={`sfx ${name}`}>
        <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
      </Sequence>
    ))}
    {/* music bed: ducked well under the voice, a little up in the opening and the end card */}
    <Audio src={staticFile("sfx/bed.wav")} volume={(f) =>
      interpolate(f, [0, 20, 200, 240, TOTAL - 300, TOTAL - 200, TOTAL - 20, TOTAL], [0, 0.16, 0.16, 0.07, 0.07, 0.13, 0.13, 0], clamp)} />
  </AbsoluteFill>
);
