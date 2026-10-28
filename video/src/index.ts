import React from "react";
import { Composition, registerRoot } from "remotion";
import { Main, TOTAL } from "./cut/Main";
import { FPS, H, W } from "./cut/theme";

// The cut built on video/script.json + video/timing.json (approved narration). The previous rejected cut's
// files (src/Main.tsx, src/scenes/*) are no longer registered.
const Root: React.FC = () =>
  React.createElement(Composition, { id: "Main", component: Main, durationInFrames: TOTAL, fps: FPS, width: W, height: H });

registerRoot(Root);
