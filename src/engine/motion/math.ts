import type { ShotSpan } from "../types";

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
export const smooth = (x: number) => {
  const c = clamp(x);
  return c * c * (3 - 2 * c);
};
export const ramp = (t: number, s: number, e: number) => smooth((t - s) / Math.max(1e-6, e - s));
export const spring = (x: number) => {
  const c = clamp(x);
  return c >= 1 ? 1 : 1 - Math.exp(-6 * c) * Math.cos(12 * c);
};
export const sway = (t: number, seed = 0) =>
  (Math.sin(t * 1.13 + seed * 12.9898) + 0.6 * Math.sin(t * 2.37 + seed * 78.233) + 0.3 * Math.sin(t * 4.71 + seed * 37.719)) / 1.9;

export type TransitionKind = "zoom-cross" | "slide-up" | "slide-left" | "wipe" | "scale-fade";

export type TransitionTransform = {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  clipInsetRight: number;
  wipeGlowOpacity: number;
};

export const TRANSITION_DUR = 0.36;
export const CAPTION_SAFE_BOTTOM = 1230;
export const NO_CAPTION_SAFE_BOTTOM = 1480;
export const safeStageBottom = (captions?: boolean): number => (captions === false ? NO_CAPTION_SAFE_BOTTOM : CAPTION_SAFE_BOTTOM);

export const stagger = (t: number, start: number, index: number, gap = 0.08, dur = 0.35): number =>
  spring((t - (start + index * gap)) / Math.max(1e-6, dur));

export const typewriter = (text: string, t: number, start: number, cps = 24): string => {
  if (t <= start || cps <= 0) return "";
  const count = clamp(Math.floor((t - start) * cps + 1e-6), 0, text.length);
  return text.slice(0, count);
};

export type AccentSeg = { text: string; accent: boolean };

export const parseAccentTokens = (text: string): AccentSeg[][] => {
  // Expand multi-word *...* spans per word before splitting on whitespace so punctuation stays attached to its flex token.
  const expanded = text.replace(/\*([^*]+)\*/g, (_, inner: string) =>
    inner
      .split(/(\s+)/)
      .map((part) => (/\S/.test(part) ? `*${part}*` : part))
      .join(""),
  );
  return expanded
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) =>
      token
        .split(/(\*[^*]+\*)/g)
        .filter(Boolean)
        .map((seg) =>
          seg.startsWith("*") && seg.endsWith("*") && seg.length > 2
            ? { text: seg.slice(1, -1), accent: true }
            : { text: seg, accent: false },
        ),
    );
};

export const fmtID = (v: number, dec = 0) =>
  v.toLocaleString("id-ID", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const countValue = (from: number, to: number, t: number, start: number, dur = 0.8): number =>
  lerp(from, to, ramp(t, start, start + dur));

// Matches Overlays.tsx header (left: 72, right: 300 -> ~19 chars/line at 66px) + chip/cta clearance + 24px gap
export const safeStageTop = (title: string, under: "chip" | "cta" | null): number => {
  const lines = title.split("\n").reduce((sum, seg) => {
    const clean = seg.replace(/\*/g, "").trim();
    return sum + Math.max(1, Math.ceil(clean.length / 19));
  }, 0);
  return 178 + 40 + 69 * lines + 22 + (under === "chip" ? 126 : under === "cta" ? 88 : 0) + 24;
};

export const transitionLayers = (
  shots: readonly ShotSpan[],
  t: number,
): { activeIdx: number; prevIdx: number | null; progress: number } => {
  if (shots.length === 0) return { activeIdx: 0, prevIdx: null, progress: 1 };
  const lastIdx = shots.length - 1;
  if (t < shots[0].s) return { activeIdx: 0, prevIdx: null, progress: 1 };
  if (t >= shots[lastIdx].e) return { activeIdx: lastIdx, prevIdx: null, progress: 1 };

  const found = shots.findIndex((s) => t >= s.s && t < s.e);
  const activeIdx = found >= 0 ? found : lastIdx;
  if (activeIdx === 0) return { activeIdx: 0, prevIdx: null, progress: 1 };

  const shot = shots[activeIdx];
  const win = Math.min(TRANSITION_DUR, Math.max(1e-4, shot.e - shot.s));
  const raw = (t - shot.s) / win;
  if (raw < 1) return { activeIdx, prevIdx: activeIdx - 1, progress: smooth(raw) };
  return { activeIdx, prevIdx: null, progress: 1 };
};

const identityTransform = (opacity: number): TransitionTransform => ({
  opacity,
  translateX: 0,
  translateY: 0,
  scale: 1,
  clipInsetRight: 0,
  wipeGlowOpacity: 0,
});

export const transitionStyles = (
  kind: TransitionKind,
  progress: number,
): { incoming: TransitionTransform; outgoing: TransitionTransform } => {
  const p = clamp(progress);
  switch (kind) {
    case "zoom-cross":
      return {
        incoming: { ...identityTransform(p), scale: lerp(0.92, 1, p) },
        outgoing: { ...identityTransform(1 - p), scale: lerp(1, 1.06, p) },
      };
    case "slide-up":
      return {
        incoming: { ...identityTransform(clamp(p * 1.4)), translateY: lerp(180, 0, p) },
        outgoing: { ...identityTransform(1 - p), translateY: lerp(0, -120, p) },
      };
    case "slide-left":
      return {
        incoming: { ...identityTransform(clamp(p * 1.4)), translateX: lerp(240, 0, p) },
        outgoing: { ...identityTransform(1 - p), translateX: lerp(0, -240, p) },
      };
    case "wipe":
      return {
        incoming: {
          ...identityTransform(1),
          clipInsetRight: (1 - p) * 100,
          wipeGlowOpacity: p <= 0 || p >= 1 ? 0 : Math.sin(p * Math.PI),
        },
        outgoing: { ...identityTransform(1 - p * p), scale: lerp(1, 0.98, p) },
      };
    case "scale-fade":
      return {
        incoming: { ...identityTransform(p), scale: lerp(1.08, 1, p) },
        outgoing: { ...identityTransform(1 - p), scale: lerp(1, 0.94, p) },
      };
  }
};
