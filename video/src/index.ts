import React from "react";
import { Composition, registerRoot } from "remotion";
import { FPS, H, W } from "./constants";
import { Main, totalFrames } from "./Main";
import "./fonts";

const Root: React.FC = () =>
  React.createElement(Composition, { id: "DenialAuditor", component: Main, durationInFrames: totalFrames(), fps: FPS, width: W, height: H });

registerRoot(Root);
