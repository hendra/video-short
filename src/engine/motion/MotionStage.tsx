import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import type { Ctx, MotionFrameCtx, ShotSpan, VideoDefMotion } from "../types";
import {
  CAPTION_SAFE_BOTTOM,
  clamp,
  safeStageTop,
  sway,
  transitionLayers,
  transitionStyles,
  type TransitionTransform,
} from "./math";

const makeFrame = (span: ShotSpan, t: number): MotionFrameCtx => {
  const dur = Math.max(1e-6, span.e - span.s);
  const local = t - span.s;
  return { t, local, dur, progress: clamp(local / dur) };
};

const layerStyle = (tr: TransitionTransform): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  opacity: tr.opacity,
  transform: `translate3d(${tr.translateX}px, ${tr.translateY}px, 0) scale(${tr.scale})`,
  clipPath: tr.clipInsetRight > 0 ? `inset(0 ${tr.clipInsetRight}% 0 0)` : undefined,
});

export const MotionStage: React.FC<{ video: VideoDefMotion; ctx: Ctx; t: number }> = ({ video, ctx, t }) => {
  const shots = useMemo(() => video.shots(ctx), [video, ctx]);
  const spans = video.timeline.shots;
  const { activeIdx, prevIdx, progress } = transitionLayers(spans, t);

  const activeSpan = spans[activeIdx];
  if (!activeSpan) throw new Error("Timeline has no shots");
  const activeShot = shots[activeSpan.id];
  if (!activeShot) throw new Error(`No MotionShotDef for shot "${activeSpan.id}"`);

  const prevSpan = prevIdx !== null ? spans[prevIdx] : null;
  const prevShot = prevSpan ? shots[prevSpan.id] : null;

  const ctaLine = video.cta ? video.timeline.lines[video.cta.fromLine - 1] : undefined;
  const ctaOn = Boolean(ctaLine && t > ctaLine.s - 0.1);
  const stageTop = safeStageTop(activeShot.title, ctaOn ? "cta" : activeShot.chip?.(t) ? "chip" : null);

  const tr = transitionStyles(activeShot.transition ?? "zoom-cross", progress);
  const blob1X = 160 + sway(t, 1) * 140;
  const blob1Y = 360 + sway(t, 2) * 100;
  const blob2X = 320 - sway(t, 2) * 150;
  const blob2Y = 920 + sway(t, 1) * 120;

  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 120% 75% at 50% 35%, #132238 0%, #0b0f17 75%)" }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(56, 189, 248, 0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.055) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: blob1X,
          top: blob1Y,
          width: 760,
          height: 760,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(56, 189, 248, 0.16) 0%, rgba(56, 189, 248, 0) 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: blob2X,
          top: blob2Y,
          width: 820,
          height: 820,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(127, 227, 196, 0.13) 0%, rgba(127, 227, 196, 0) 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: stageTop,
          bottom: 1920 - CAPTION_SAFE_BOTTOM,
          left: 64,
          right: 64,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {prevSpan && prevShot ? (
          <div key={prevSpan.id} style={layerStyle(tr.outgoing)}>
            {prevShot.render(makeFrame(prevSpan, t))}
          </div>
        ) : null}
        <div key={activeSpan.id} style={layerStyle(tr.incoming)}>
          {activeShot.render(makeFrame(activeSpan, t))}
        </div>
        {tr.incoming.wipeGlowOpacity > 0 ? (
          <div
            style={{
              position: "absolute",
              left: `${100 - tr.incoming.clipInsetRight}%`,
              top: 0,
              bottom: 0,
              width: 4,
              transform: "translateX(-2px)",
              background:
                "linear-gradient(to bottom, rgba(56,189,248,0), rgba(127,227,196,0.95) 20%, #38bdf8 50%, rgba(127,227,196,0.95) 80%, rgba(56,189,248,0))",
              boxShadow: "0 0 24px 6px rgba(56, 189, 248, 0.75)",
              opacity: tr.incoming.wipeGlowOpacity,
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
