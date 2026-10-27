import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../constants";
import { SANS } from "../fonts";
import { Card, Top, useEnter } from "../components";

// The gap, in two figures on cards, with the scanner floating in its bubble.
export const Hook: React.FC = () => {
  const { durationInFrames: d } = useVideoConfig();
  const frame = useCurrentFrame();
  const head = useEnter(2);
  const a = useEnter(Math.round(d * 0.2));
  const b = useEnter(Math.round(d * 0.47));
  const bob = interpolate(frame, [0, d], [0, -18]);
  const fig: React.CSSProperties = { fontWeight: 500, fontSize: 150, lineHeight: 0.92, letterSpacing: "-0.055em" };
  return (
    <AbsoluteFill style={{ background: COLORS.ground, fontFamily: SANS, color: COLORS.ink }}>
      <Top right="Medicare Advantage, 2024" />
      <Img src={staticFile("img/mri-bubble.png")} style={{ position: "absolute", right: 60, top: 120 + bob, width: 720, height: 720 }} />
      <h2 style={{ ...head, position: "absolute", left: 72, top: 150, width: 1080, margin: 0, fontWeight: 400, fontSize: 84, lineHeight: 1.0, letterSpacing: "-0.045em" }}>
        Most appealed denials are overturned. Almost none are appealed.
      </h2>
      <div style={{ position: "absolute", left: 72, top: 560, width: 1060, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 18 }}>
        <div style={a}><Card bg={COLORS.yellow} style={{ height: 400, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={fig}>80.7%</div><p style={{ margin: 0, fontSize: 26, lineHeight: 1.35, color: "#3B2A00" }}>of appealed Medicare Advantage prior-auth denials were overturned, partly or fully</p></Card></div>
        <div style={b}><Card style={{ height: 400, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={fig}>11.5%</div><p style={{ margin: 0, fontSize: 26, lineHeight: 1.35, color: COLORS.muted }}>of those denials were ever appealed</p></Card></div>
      </div>
      <p style={{ position: "absolute", left: 72, bottom: 34, margin: 0, fontSize: 18, color: COLORS.faint }}>KFF, Jan 28, 2026. MRI scanner modelled with img2threejs from a CC BY 3.0 photo (Jan Ainali, Wikimedia Commons).</p>
    </AbsoluteFill>
  );
};
