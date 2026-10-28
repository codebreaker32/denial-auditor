import { continueRender, delayRender, staticFile } from "remotion";

// Geist, the app's face (variable, 100–900), copied from ui/public/fonts. Rendering waits until it loads.
export const SANS = "Geist";
const face = new FontFace(SANS, `url(${staticFile("fonts/geist-var.woff2")}) format("woff2")`, { weight: "100 900" });
const handle = delayRender("Loading Geist");
face
  .load()
  .then((f) => {
    document.fonts.add(f);
    continueRender(handle);
  })
  .catch((e) => {
    console.error(e);
    continueRender(handle);
  });
