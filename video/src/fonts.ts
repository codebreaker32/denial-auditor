import { continueRender, delayRender, staticFile } from "remotion";

// The app's own self-hosted face, Switzer, for every word and figure. Rendering waits until it loads.
export const SANS = "Switzer";
export const MONO = "Switzer";

const faces = [400, 500, 600].map((w) =>
  new FontFace(SANS, `url(${staticFile(`fonts/switzer-${w}.woff2`)}) format("woff2")`, { weight: String(w) }));
const handle = delayRender("Loading fonts");
Promise.all(faces.map((f) => f.load()))
  .then((loaded) => { loaded.forEach((f) => document.fonts.add(f)); continueRender(handle); })
  .catch((e) => { console.error(e); continueRender(handle); });
