import { continueRender, delayRender, staticFile } from "remotion";

/** Bundled OFL fonts (public/fonts) so renders look identical on every machine, offline. */
const FACES: [family: string, file: string, weight: string][] = [
  ["Inter", "fonts/Inter-SemiBold.otf", "600"],
  ["Inter", "fonts/Inter-Bold.otf", "700"],
  ["Inter", "fonts/Inter-ExtraBold.otf", "800"],
  ["Inter Display", "fonts/InterDisplay-ExtraBold.otf", "800"],
  ["DejaVu Sans Mono", "fonts/DejaVuSansMono.ttf", "400"],
];

let started = false;
export const loadFonts = () => {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading fonts");
  Promise.all(
    FACES.map(([family, file, weight]) => {
      const f = new FontFace(family, `url(${staticFile(file)})`, { weight });
      return f.load().then((loaded) => document.fonts.add(loaded));
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error("Font loading failed", err);
      continueRender(handle);
    });
};

export const FONT = {
  ui: "'Inter', sans-serif",
  display: "'Inter Display', 'Inter', sans-serif",
  mono: "'DejaVu Sans Mono', monospace",
};
