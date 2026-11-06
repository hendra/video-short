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

// Safe area for vertical Shorts/Reels: keep labels between the header and the captions.
const SAFE = { left: 170, right: 910, top: 470, bottom: 1210 };

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

const Callouts: React.FC<{ shot: ShotDef; t: number; pose: CamPose; fov: number }> = ({ shot, t, pose, fov }) => {
  const project = makeProjector(pose, fov, 1080, 1920);
  const items = (shot.callouts ?? []).filter((c) => t >= c.at && (c.until === undefined || t <= c.until));
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {items.map((c, i) => {
          const a = project(c.anchor(t));
          if (a.behind) return null;
          const e = clamp((t - c.at) / 0.3);
          const lx = clamp(a.x + c.dx, SAFE.left, SAFE.right);
          const ly = clamp(a.y + c.dy * e, SAFE.top, SAFE.bottom);
          return (
            <g key={i} opacity={e}>
              <line x1={a.x} y1={a.y} x2={lx} y2={ly} stroke={INK} strokeWidth={3} />
              <circle cx={a.x} cy={a.y} r={9} fill="#fff" stroke={INK} strokeWidth={3} />
            </g>
          );
        })}
      </svg>
      {items.map((c, i) => {
        const a = project(c.anchor(t));
        if (a.behind) return null;
        const e = clamp((t - c.at) / 0.3);
        const lx = clamp(a.x + c.dx, SAFE.left, SAFE.right);
        const ly = clamp(a.y + c.dy * e, SAFE.top, SAFE.bottom);
        const bg = c.variant === "orange" ? "#e8622c" : c.variant === "red" ? "#c8352b" : "#fff";
        return (
          <div
            key={i}
            style={{
              position: "absolute", left: lx, top: ly, opacity: e,
              transform: `translate(-50%,-50%) scale(${0.7 + 0.3 * e})`,
              padding: "10px 20px", borderRadius: 14, background: bg,
              border: `3px solid ${c.variant ? bg : INK}`, color: c.variant ? "#fff" : INK,
              font: `700 32px ${FONT.ui}`, whiteSpace: "nowrap",
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
    <div style={{ position: "absolute", left: 90, right: 90, top: 1270, textAlign: "center" }}>
      <span style={{ display: "inline", padding: "6px 14px", lineHeight: 1.5, background: "rgba(24,30,34,.88)", borderRadius: 12, WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone", font: `800 60px ${FONT.ui}`, color: "#fff" }}>
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
  const ctaOn = video.cta && t > tl.lines[video.cta.fromLine - 1].s - 0.1;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 460, background: `linear-gradient(${CREAM} 0%, rgba(244,241,234,.95) 58%, rgba(244,241,234,0) 100%)` }} />
      <Callouts shot={shot} t={t} pose={pose} fov={video.fov} />
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
