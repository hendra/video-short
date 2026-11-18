import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { blueprintTitleRight, captionBoxStyle, themeOf } from "../src/engine/overlays/Overlays.tsx";
import type { VideoDef } from "../src/engine/types";

const base3d = { id: "x", brand: { prefix: "A", accent: "B" }, voice: "x/vo.mp3", fov: 40 } as unknown as VideoDef;
const baseMotion = { ...base3d, mode: "motion" } as unknown as VideoDef;

describe("themeOf", () => {
  test("keeps the existing defaults: 3D cream, motion dark-tech", () => {
    assert.equal(themeOf(base3d), "cream");
    assert.equal(themeOf(baseMotion), "dark-tech");
  });
  test("honours an explicit blueprint theme on a 3D video", () => {
    assert.equal(themeOf({ ...base3d, theme: "blueprint" } as VideoDef), "blueprint");
  });
});

describe("blueprintTitleRight", () => {
  test("reserves space for shot.tag when present so wide titles cannot overlap it", () => {
    assert.ok(blueprintTitleRight("ILUSTRASI") >= 260);
    assert.equal(blueprintTitleRight(undefined), 160);
  });
});

describe("captionBoxStyle", () => {
  test("every theme uses a single inline-block card with lineHeight 1.32 and no boxDecorationBreak", () => {
    for (const theme of ["cream", "dark-tech", "blueprint"] as const) {
      const s = captionBoxStyle(theme);
      assert.equal(s.display, "inline-block", theme);
      assert.equal(s.lineHeight, 1.32, theme);
      assert.equal(s.padding, "14px 26px", theme);
      assert.equal("boxDecorationBreak" in s, false, theme);
    }
  });
});
