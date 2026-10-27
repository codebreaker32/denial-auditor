import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "./constants";
import { SANS } from "./fonts";

// Entrance used everywhere: quick fade, a short settle, no bounce.
export const useEnter = (delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200, stiffness: 120 } });
  return { opacity: p, transform: `translateY(${(1 - p) * 14}px)` };
};

// The product mark: a black disc with a white check.
export const Logo: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "none" }}>
    <rect width={24} height={24} rx={12} fill={COLORS.ink} />
    <path d="M7 12.4l3.4 3.4L17.2 9" fill="none" stroke="#fff" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// The top line on every scene, as on the deck: wordmark left, one quiet fact right.
export const Top: React.FC<{ right?: string }> = ({ right }) => (
  <div style={{ position: "absolute", left: 72, right: 72, top: 52, display: "flex", justifyContent: "space-between", alignItems: "center",
    fontFamily: SANS, fontSize: 22, color: COLORS.muted }}>
    <span style={{ display: "flex", alignItems: "center", gap: 14, color: COLORS.ink, fontWeight: 500, fontSize: 26, letterSpacing: "-0.02em" }}><Logo />Denial Auditor</span>
    <span>{right ?? ""}</span>
  </div>
);

// One large, light headline per scene.
export const Headline: React.FC<{ text: React.ReactNode; top?: number; size?: number; width?: number }> = ({ text, top = 120, size = 72, width = 1400 }) => (
  <h2 style={{ position: "absolute", left: 72, top, width, margin: 0, fontFamily: SANS, fontWeight: 400, fontSize: size, lineHeight: 1.02,
    letterSpacing: "-0.04em", color: COLORS.ink, textWrap: "balance" } as React.CSSProperties}>{text}</h2>
);

// A card: a tone step from the ground, large radius, no outline and no shadow.
export const Card: React.FC<{ bg?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ bg = COLORS.card, style, children }) => (
  <div style={{ background: bg, borderRadius: 40, padding: "30px 34px", overflow: "hidden", fontFamily: SANS, ...style }}>{children}</div>
);
