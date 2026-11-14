import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, getRemotionEnvironment, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { NeutralToneMapping, PCFSoftShadowMap, PerspectiveCamera } from "three";
import { loadFonts } from "./fonts";
import { applyPose, makeCtx, shotAt } from "./math";
import { Overlays } from "./overlays/Overlays";
import { VIDEOS } from "../videos/registry";
import type { CamPose, Ctx, VideoDef } from "./types";

loadFonts();

const getVideo = (id: string): VideoDef => {
  const v = VIDEOS[id];
  if (!v) throw new Error(`Unknown video "${id}" — add it to src/videos/registry.ts`);
  return v;
};

/** Lives inside <ThreeCanvas>: owns the imperative world and drives it from the frame time. */
const World: React.FC<{ video: VideoDef; ctx: Ctx; t: number; shotId: string; pose: CamPose }> = ({ video, ctx, t, shotId, pose }) => {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const world = useMemo(() => video.createWorld(ctx), [video, ctx]);

  useLayoutEffect(() => {
    scene.add(world.root);
    return () => {
      scene.remove(world.root);
    };
  }, [scene, world]);

  // Deterministic per-frame update: everything is a pure function of t.
  useLayoutEffect(() => {
    applyPose(camera, pose, video.fov, size.width / size.height);
    world.update(t, shotId, pose, scene);
  });
  return null;
};

// `--scale=2` renders the page at devicePixelRatio 2: follow it so the 3D layer is as sharp as the text
// overlays (2160x3840). Studio stays at 1 to keep the preview fast on HiDPI screens.
const canvasDpr = () => (getRemotionEnvironment().isRendering && typeof window !== "undefined" ? window.devicePixelRatio : 1);

/**
 * `audioOnly` (CI: `--props='{"videoId":"<id>","audioOnly":true}'` with a .wav output) renders just the sound
 * mix. Remotion still visits every frame for an audio render, so skipping the 3D scene makes it take seconds
 * instead of as long as the full video.
 */
export const Explainer: React.FC<{ videoId: string; audioOnly?: boolean }> = ({ videoId, audioOnly }) => {
  const video = getVideo(videoId);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const ctx = useMemo(() => makeCtx(video.timeline), [video]);
  const shots = useMemo(() => video.shots(ctx), [video, ctx]);
  const span = shotAt(video.timeline, t);
  const shot = shots[span.id];
  if (!shot) throw new Error(`No ShotDef for shot "${span.id}"`);
  const pose = shot.camera(t);

  const audio = (
    <>
      <Audio src={staticFile(video.voice)} />
      {video.music ? <Audio src={staticFile(video.music.src)} volume={video.music.volume} /> : null}
    </>
  );
  if (audioOnly) return audio;

  return (
    <AbsoluteFill style={{ backgroundColor: "#dfe9ec" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={canvasDpr()}
        shadows={{ type: PCFSoftShadowMap }}
        // Neutral tone mapping keeps palette colours true while rolling off highlights from the sun.
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: NeutralToneMapping }}
      >
        <World video={video} ctx={ctx} t={t} shotId={span.id} pose={pose} />
      </ThreeCanvas>
      <Overlays video={video} shot={shot} shotStart={span.s} t={t} pose={pose} />
      {audio}
    </AbsoluteFill>
  );
};
