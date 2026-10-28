import { Easing } from "remotion";
import script from "../../script.json";
import timing from "../../timing.json";
import { FPS } from "./theme";

type T = { audio: string; seconds: number; lead: number };
const TM = timing as unknown as Record<string, T>;

export type SceneId = (typeof script.scenes)[number]["id"];

// Scene starts come from the measured narration (video/timing.json); cumulative rounding keeps audio in sync.
const TRIM = 0.25;
let acc = 0;
export const SCENES = script.scenes.map((s) => {
  const t = TM[s.id];
  const from = Math.round(acc * FPS);
  // scenes overlap by a transition, so all but the last give back part of their 0.6 s tail
  acc += s.id === "close" ? t.seconds : t.seconds - TRIM;
  const to = Math.round(acc * FPS);
  return { id: s.id as string, from, dur: to - from, audio: t.audio, lead: t.lead, seconds: t.seconds };
});
export const TOTAL = Math.round(acc * FPS);

export const easeIO = Easing.bezier(0.65, 0, 0.35, 1);
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
