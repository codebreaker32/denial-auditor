import React from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile, useVideoConfig } from "remotion";
import { COLORS } from "../constants";
import { Headline, Top, useEnter } from "../components";
import clips from "../clips.json";

// A real recording of the app on a white card, under one headline, as on the deck.
// The clip plays at timing.json's rate (1–1.5×) so it fits its scene; if narration outlasts it, the last frame holds.
const VW = 1440, VH = Math.round((VW * 1080) / 1920);

export const Rec: React.FC<{ clip: keyof typeof clips; from: number; rate: number; label?: string; caption: string }> = ({ clip, from, rate, label, caption }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const start = Math.round(from * fps);
  const playable = Math.floor((clips[clip] - start - 1) / rate);
  const head = useEnter(0);
  const shot = useEnter(6);
  const video = (
    <OffthreadVideo src={staticFile(`rec/${clip}.mp4`)} startFrom={start} playbackRate={rate} muted style={{ width: VW, height: VH, display: "block" }} />
  );
  return (
    <AbsoluteFill style={{ background: COLORS.ground }}>
      <Top right={label ?? "Recorded in the app · synthetic data"} />
      <div style={head}><Headline text={caption} size={60} /></div>
      <div style={{ position: "absolute", left: (1920 - VW - 32) / 2, top: 250, width: VW + 32, height: 1080 - 250 + 40, background: COLORS.card,
        borderRadius: 40, padding: 16, ...shot }}>
        <div style={{ width: VW, height: VH, overflow: "hidden", borderRadius: 26 }}>
          <Sequence durationInFrames={Math.min(playable, durationInFrames)} layout="none">{video}</Sequence>
          {durationInFrames > playable && (
            <Sequence from={playable} layout="none"><Freeze frame={playable - 1}>{video}</Freeze></Sequence>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
