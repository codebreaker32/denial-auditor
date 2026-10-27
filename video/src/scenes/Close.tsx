import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, DEMO_URL, REPO } from "../constants";
import { SANS } from "../fonts";
import { Top, useEnter } from "../components";

export const Close: React.FC = () => {
  const { durationInFrames: d } = useVideoConfig();
  const frame = useCurrentFrame();
  const a = useEnter(2);
  const b = useEnter(16);
  const bob = interpolate(frame, [0, d], [0, -16]);
  return (
    <AbsoluteFill style={{ background: COLORS.ground, fontFamily: SANS, color: COLORS.ink }}>
      <Top right="Road House · Aman Bihari, Bhawna" />
      <Img src={staticFile("img/mri-bubble.png")} style={{ position: "absolute", right: 80, top: 150 + bob, width: 760, height: 760 }} />
      <h1 style={{ ...a, position: "absolute", left: 72, top: 230, width: 980, margin: 0, fontWeight: 400, fontSize: 140, lineHeight: 0.98, letterSpacing: "-0.05em" }}>Try the synthetic cases.</h1>
      <div style={{ ...b, position: "absolute", left: 72, top: 600 }}>
        <span style={{ display: "inline-flex", alignItems: "center", height: 76, padding: "0 40px", borderRadius: 999, background: COLORS.ink, color: "#fff", fontSize: 28, fontWeight: 500 }}>Open the live demo</span>
        <p style={{ margin: "30px 0 0", fontSize: 24, lineHeight: 1.5, color: COLORS.muted }}>{DEMO_URL}<br />{REPO}</p>
        <p style={{ margin: "26px 0 0", fontSize: 20, color: COLORS.faint, maxWidth: 940 }}>NVIDIA Nemotron on Nebius Token Factory · Tavily · Synthetic data only · Decision support, not legal or medical advice</p>
      </div>
    </AbsoluteFill>
  );
};
