import React from "react";
import { Composition } from "remotion";
import { Explainer } from "./engine/Explainer";
import { VIDEOS } from "./videos/registry";

const FPS = 30;

export const RemotionRoot: React.FC = () => (
  <>
    {Object.values(VIDEOS).map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={Explainer}
        defaultProps={{ videoId: v.id }}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={Math.ceil(v.timeline.dur * FPS)}
      />
    ))}
  </>
);
