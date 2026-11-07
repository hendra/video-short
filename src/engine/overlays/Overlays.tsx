import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT } from "../fonts";
import { clamp } from "../math";
import type { CamPose, ShotDef, Timeline, VideoDef } from "../types";
import { makeProjector } from "../math";

const INK = "#1d2328";
const CREAM = "#f4f1ea";
const GREEN = "#1f9e6e";
const MINT = "#7fe3c4";


/** "Pintu air *ditutup*\nbaris dua" -> spans with highlighted words. */
const Title: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split("\n").map((line, i) => (
      <div key={i}>
        {line.split(/(\*[^*]+\*)/).map((seg, j) =>
          seg.startsWith("*") ? (
            <span key={j} style={{ color: GREEN }}>
              {seg.slice(1, -1)}
            </span>
          ) : (
            <span key={j}>{seg}</span>
          ),
        )}
      </div>
    ))}
  </>
);

const Header: React.FC<{ shot: ShotDef; local: number; titleLines: number }> = ({ shot, local }) => {
  const k = clamp(local / 0.35);
  return (
    <div style={{ position: "absolute", left: 72, right: 300, top: 178, opacity: k, transform: `translateY(${(1 - k) * 24}px)` }}>
      <div style={{ font: `600 30px ${FONT.mono}`, letterSpacing: 5, color: "#5c6670", textTransform: "uppercase" }}>{shot.label}</div>
      <div style={{ font: `800 66px/1.05 ${FONT.display}`, letterSpacing: -1.5, color: INK, marginTop: 10 }}>
        <Title text={shot.title} />
      </div>
    </div>
  );
};

/** Header height in px (top of the chip / CTA goes below it). */
const headerBottom = (title: string) => 178 + 40 + 69 * title.split("\n").length + 22;
const CHIP_H = 40 + 86; // key tab + value block
const CTA_H = 84;
/** Top of the free zone for callout labels: below the header and whatever sits under it. */
const labelTop = (title: string, under: "chip" | "cta" | null) => headerBottom(title) + (under === "chip" ? CHIP_H : under === "cta" ? CTA_H + 4 : 0) + 24;

const Chip: React.FC<{ shot: ShotDef; t: number }> = ({ shot, t }) => {
  const c = shot.chip?.(t);
  if (!c) return null;
  const color = c.red ? "#c8352b" : INK;
  return (
    <div style={{ position: "absolute", left: 72, top: headerBottom(shot.title) }}>
      <span style={{ display: "inline-block", padding: "8px 14px", border: `2px solid ${color}`, borderBottom: "none", borderRadius: "8px 8px 0 0", background: CREAM, font: `400 22px ${FONT.mono}`, letterSpacing: 3, color }}>
        {c.key}
      </span>
      <span style={{ display: "block", padding: "12px 20px", borderRadius: "0 12px 12px 12px", background: color, color: "#fff", font: `800 52px ${FONT.display}`, whiteSpace: "nowrap" }}>
        {c.value}
        {c.unit ? <small style={{ font: `600 26px ${FONT.ui}`, color: c.red ? "#ffd9d4" : "#9fb0bd", marginLeft: 8 }}>{c.unit}</small> : null}
      </span>
    </div>
  );
};

/* ---------- callout layout: no label may overlap another label, the header/chip/CTA or the captions ---------- */

const LABEL_FONT = `700 32px ${FONT.ui}`;
const LABEL_PAD_X = 20 + 3; // padding + border
const LABEL_H = 32 * 1.25 + 2 * 10 + 6; // line + padding + border
const GAP = 16; // minimum gap between label boxes
const EDGE = 36; // keep labels this far from the frame edge
const CAPTION_TOP = 1270;
const CAPTION_CLEAR = CAPTION_TOP - 28; // labels, leader lines and dots stay above this

let measureCtx: CanvasRenderingContext2D | null = null;
const textWidth = (text: string) => {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * 17;
  measureCtx.font = LABEL_FONT;
  return measureCtx.measureText(text).width;
};

type Placed = { ax: number; ay: number; x: number; y: number; w: number; h: number; e: number; idx: number; edge: boolean };

/**
 * Deterministic overlap removal (pure function of the inputs -> stable across frames/renders).
 * 1. clamp each label inside [EDGE..1080-EDGE] x [top..CAPTION_CLEAR]
 * 2. relax pairwise overlaps, mostly vertically (labels sit beside 3D objects), sideways when stuck on a bound
 */
export const layoutLabels = (items: Placed[], top: number): Placed[] => {
  const bx = (p: Placed) => [EDGE + p.w / 2, 1080 - EDGE - p.w / 2] as const;
  const by = (p: Placed) => [top + p.h / 2, CAPTION_CLEAR - p.h / 2] as const;
  const fit = (p: Placed) => {
    const [x0, x1] = bx(p);
    const [y0, y1] = by(p);
    p.x = clamp(p.x, x0, x1);
    p.y = clamp(p.y, y0, y1);
  };
  items.forEach(fit);
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const ox = (a.w + b.w) / 2 + GAP - Math.abs(a.x - b.x);
        const oy = (a.h + b.h) / 2 + GAP - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // push along the axis that needs the smaller move; prefer vertical
        if (oy <= ox * 1.5) {
          const s = a.y < b.y || (a.y === b.y && i < j) ? -1 : 1;
          a.y += (s * oy) / 2 + s * 0.5;
          b.y -= (s * oy) / 2 + s * 0.5;
        } else {
          const s = a.x < b.x || (a.x === b.x && i < j) ? -1 : 1;
          a.x += (s * ox) / 2 + s * 0.5;
          b.x -= (s * ox) / 2 + s * 0.5;
        }
        fit(a);
        fit(b);
      }
    }
    if (!moved) break;
  }
  return items;
};

const overlaps = (a: Placed, b: Placed) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 2;

const Callouts: React.FC<{ shot: ShotDef; t: number; pose: CamPose; fov: number; top: number }> = ({ shot, t, pose, fov, top }) => {
  const project = makeProjector(pose, fov, 1080, 1920);
  const defs = (shot.callouts ?? []).filter((c) => t >= c.at && (c.until === undefined || t <= c.until));
  const raw: Placed[] = [];
  defs.forEach((c, idx) => {
    const a = project(c.anchor(t));
    if (a.behind) return;
    // anchor outside the visible zone (off-frame, under the header, behind the captions): pin it to the zone edge,
    // draw the leader line towards it without the dot -> nothing is ever drawn over the header or the captions
    const ax = clamp(a.x, 12, 1068);
    const ay = clamp(a.y, top - 40, CAPTION_CLEAR);
    const edge = ax !== a.x || ay !== a.y;
    const e = clamp((t - c.at) / 0.3);
    raw.push({ ax, ay, x: a.x + c.dx, y: a.y + c.dy * e, w: textWidth(c.text) + 2 * LABEL_PAD_X, h: LABEL_H, e, idx, edge });
  });
  // layout with entry scale ignored (full size) so boxes never collide mid-animation
  const placed = layoutLabels(raw, top);
  // last resort: if a label is still overlapping an earlier one (too many for the space), hide it
  const shown = placed.filter((p, k) => !placed.slice(0, k).some((q) => overlaps(p, q)));
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {shown.map((p) => (
          <g key={p.idx} opacity={p.e}>
            <line x1={p.ax} y1={p.ay} x2={p.x} y2={p.y} stroke={INK} strokeWidth={3} />
            {p.edge ? null : <circle cx={p.ax} cy={p.ay} r={9} fill="#fff" stroke={INK} strokeWidth={3} />}
          </g>
        ))}
      </svg>
      {shown.map((p) => {
        const c = defs[p.idx];
        const bg = c.variant === "orange" ? "#e8622c" : c.variant === "red" ? "#c8352b" : "#fff";
        return (
          <div
            key={p.idx}
            style={{
              position: "absolute", left: p.x, top: p.y, opacity: p.e,
              transform: `translate(-50%,-50%) scale(${0.7 + 0.3 * p.e})`,
              padding: "10px 20px", borderRadius: 14, background: bg,
              border: `3px solid ${c.variant ? bg : INK}`, color: c.variant ? "#fff" : INK,
              font: LABEL_FONT, lineHeight: 1.25, whiteSpace: "nowrap",
            }}
          >
            {c.text}
          </div>
        );
      })}
    </>
  );
};

/** Karaoke captions: one short phrase at a time, current word highlighted. */
const Captions: React.FC<{ tl: Timeline; t: number }> = ({ tl, t }) => {
  const i = tl.chunks.findIndex((c, k) => {
    const next = tl.chunks[k + 1];
    const end = next ? Math.min(next.s - 0.05, c.e + 0.6) : c.e + 0.6;
    return t >= c.s - 0.05 && t < end;
  });
  if (i < 0) return null;
  const ch = tl.chunks[i];
  return (
    <div style={{ position: "absolute", left: 90, right: 90, top: CAPTION_TOP, textAlign: "center" }}>
      <span style={{ display: "inline", padding: "6px 14px", lineHeight: 1.8, background: "rgba(24,30,34,.88)", borderRadius: 12, WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone", font: `800 60px ${FONT.ui}`, color: "#fff" }}>
        {ch.words.map((w, k) => {
          const on = t >= w.s && t < w.e + 0.02;
          return (
            <React.Fragment key={k}>
              <span style={on ? { color: MINT, textDecoration: "underline", textDecorationThickness: 5, textUnderlineOffset: 8 } : undefined}>{w.w}</span>
              {k < ch.words.length - 1 ? " " : ""}
            </React.Fragment>
          );
        })}
      </span>
    </div>
  );
};

export const Overlays: React.FC<{
  video: VideoDef;
  shot: ShotDef;
  shotStart: number;
  t: number;
  pose: CamPose;
}> = ({ video, shot, shotStart, t, pose }) => {
  const tl = video.timeline;
  const cuts = tl.shots.filter((s) => s.s > 0).map((s) => s.s);
  const flash = Math.max(0, ...cuts.map((c) => 1 - Math.abs(t - c) / 0.16));
  const ctaOn = Boolean(video.cta && t > tl.lines[video.cta.fromLine - 1].s - 0.1);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 460, background: `linear-gradient(${CREAM} 0%, rgba(244,241,234,.95) 58%, rgba(244,241,234,0) 100%)` }} />
      <Callouts shot={shot} t={t} pose={pose} fov={video.fov} top={labelTop(shot.title, ctaOn ? "cta" : shot.chip?.(t) ? "chip" : null)} />
      <Header shot={shot} local={t - shotStart} titleLines={shot.title.split("\n").length} />
      <div style={{ position: "absolute", right: 60, top: 178, padding: "10px 18px", borderRadius: 12, background: INK, color: "#fff", font: `700 26px ${FONT.ui}` }}>
        {video.brand.prefix}
        <span style={{ color: MINT }}>{video.brand.accent}</span>
      </div>
      {shot.tag ? (
        <div style={{ position: "absolute", right: 60, top: 250, padding: "6px 12px", borderRadius: 8, background: "rgba(29,35,40,.75)", color: "#fff", font: `400 20px ${FONT.mono}`, letterSpacing: 2 }}>{shot.tag}</div>
      ) : null}
      {ctaOn ? null : <Chip shot={shot} t={t} />}
      {ctaOn && video.cta ? (
        <div style={{ position: "absolute", left: 72, top: headerBottom(shot.title) + 4, padding: "16px 26px", borderRadius: 16, background: "#fff", border: `3px solid ${INK}`, font: `700 34px ${FONT.ui}`, color: INK }}>
          <svg width={34} height={34} viewBox="0 0 24 24" style={{ verticalAlign: -6, marginRight: 10 }}>
            <path d="M4 4h16v11H9l-5 4z" fill="none" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
          </svg>
          {video.cta.text}
        </div>
      ) : null}
      <Captions tl={tl} t={t} />
      <AbsoluteFill style={{ background: CREAM, opacity: clamp(flash) * 0.85 }} />
    </AbsoluteFill>
  );
};
