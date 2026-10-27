import React from "react";
import { AbsoluteFill, Audio, Sequence, Series, staticFile } from "remotion";
import { COLORS, FPS } from "./constants";
import script from "./script.json";
import timing from "./timing.json";
import { Hook } from "./scenes/Hook";
import { Rec } from "./scenes/Rec";
import { Eval } from "./scenes/Eval";
import { Close } from "./scenes/Close";
import clips from "./clips.json";

type Seg = (typeof script)[number] & { clip?: string; from?: number; step?: number; caption?: string };
type T = { seconds: number; audio: boolean; lead: number; rate: number };
const TIMING = timing as Record<string, T>;

// Scene lengths come from src/timing.json (scripts/voiceover.py), so the cut follows the narration.
export const sceneFrames = (id: string) => Math.round(TIMING[id].seconds * FPS);
export const totalFrames = () => (script as Seg[]).reduce((n, s) => n + sceneFrames(s.id), 0);

const LABEL: Record<string, string> = { worklist: "Worklist", check: "Before you submit", cost: "Model calls and cost" };

const Scene: React.FC<{ s: Seg }> = ({ s }) => {
  if (s.kind === "hook") return <Hook />;
  if (s.kind === "eval") return <Eval />;
  if (s.kind === "close") return <Close />;
  return <Rec clip={s.clip as keyof typeof clips} from={s.from ?? 0} rate={TIMING[s.id].rate} label={LABEL[s.id]} caption={s.caption ?? ""} />;
};

export const Main: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ground }}>
    <Series>
      {(script as Seg[]).map((s) => (
        <Series.Sequence key={s.id} durationInFrames={sceneFrames(s.id)}>
          <Scene s={s} />
          {TIMING[s.id].audio && (
            <Sequence from={Math.round(TIMING[s.id].lead * FPS)}>
              <Audio src={staticFile(`vo/${s.id}.mp3`)} />
            </Sequence>
          )}
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
