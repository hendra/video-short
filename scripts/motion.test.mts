import assert from "node:assert/strict";
import { describe, test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DARK_TECH, TECH_ICON_NAMES, TechIcon, type TechIconName } from "../src/engine/motion/icons.tsx";
import {
  CAPTION_SAFE_BOTTOM,
  NO_CAPTION_SAFE_BOTTOM,
  TRANSITION_DUR,
  countValue,
  parseAccentTokens,
  safeStageBottom,
  safeStageTop,
  stagger,
  transitionLayers,
  transitionStyles,
  typewriter,
  type TransitionKind,
} from "../src/engine/motion/math.ts";
import { shouldShowCaptions } from "../src/engine/overlays/Overlays.tsx";
import { BeatCallout, ComparisonSplit, IllustrationStage, MetricPanel, TerminalCard } from "../src/engine/motion/blocks.tsx";
import type { ShotSpan } from "../src/engine/types.ts";

describe("motion timing helpers", () => {
  test("stagger returns 0 before delay and hits 1 after dur", () => {
    assert.equal(stagger(0, 1.0, 2, 0.1, 0.4), 0);
    assert.equal(stagger(1.2, 1.0, 2, 0.1, 0.4), 0);
    assert.ok(stagger(1.3, 1.0, 2, 0.1, 0.4) > 0);
    assert.equal(stagger(1.6, 1.0, 2, 0.1, 0.4), 1);
    assert.equal(stagger(3.0, 1.0, 2, 0.1, 0.4), 1);
  });

  test("typewriter reveals characters proportionally from start", () => {
    assert.equal(typewriter("hello", 0, 1.0, 20), "");
    assert.equal(typewriter("hello", 1.0, 1.0, 20), "");
    assert.equal(typewriter("hello", 1.1, 1.0, 20), "he");
    assert.equal(typewriter("hello", 1.15, 1.0, 20), "hel");
    assert.equal(typewriter("hello", 5, 1.0, 20), "hello");
  });

  test("countValue clamps outside [start, start + dur] and interpolates smoothly inside", () => {
    assert.equal(countValue(0, 100, 1, 2, 1), 0);
    assert.equal(countValue(0, 100, 2, 2, 1), 0);
    assert.equal(countValue(0, 100, 2.5, 2, 1), 50);
    const quarter = countValue(0, 100, 2.25, 2, 1);
    assert.ok(quarter > 0 && quarter < 50);
    assert.equal(countValue(0, 100, 3, 2, 1), 100);
    assert.equal(countValue(0, 100, 5, 2, 1), 100);
  });
});

describe("safeStageTop", () => {
  test("accounts for multiline titles and elements under header while staying above caption safe bottom", () => {
    assert.equal(CAPTION_SAFE_BOTTOM, 1230);
    const singleNull = safeStageTop("Satu baris", null);
    const singleCta = safeStageTop("Satu baris", "cta");
    const twoChip = safeStageTop("Baris satu\nBaris dua", "chip");

    assert.equal(singleNull, 333);
    assert.equal(singleCta, 421);
    assert.equal(twoChip, 528);
    assert.ok(singleNull < twoChip);
    assert.ok(twoChip < CAPTION_SAFE_BOTTOM);
  });

  test("estimates wrapped title lines across explicit newline segments", () => {
    assert.equal(safeStageTop("Satu Jembatan Semua Tool", "chip"), safeStageTop("Satu Jembatan\nSemua Tool", "chip"));
    assert.equal(safeStageTop("Template *Siap* Pakai", null), safeStageTop("Template *Siap*\nPakai", null) - 69);
  });
});

describe("captions toggle and safeStageBottom", () => {
  test("NO_CAPTION_SAFE_BOTTOM is 1480 and safeStageBottom switches on captions === false", () => {
    assert.equal(CAPTION_SAFE_BOTTOM, 1230);
    assert.equal(NO_CAPTION_SAFE_BOTTOM, 1480);
    assert.equal(safeStageBottom(undefined), 1230);
    assert.equal(safeStageBottom(true), 1230);
    assert.equal(safeStageBottom(false), 1480);
  });

  test("shouldShowCaptions defaults to true and returns false only when captions === false", () => {
    assert.equal(shouldShowCaptions(undefined), true);
    assert.equal(shouldShowCaptions(true), true);
    assert.equal(shouldShowCaptions(false), false);
  });
});

describe("parseAccentTokens", () => {
  test("keeps punctuation attached to *accent* word tokens", () => {
    assert.deepEqual(parseAccentTokens("*AI*, cepat"), [
      [
        { text: "AI", accent: true },
        { text: ",", accent: false },
      ],
      [{ text: "cepat", accent: false }],
    ]);
    assert.deepEqual(parseAccentTokens("*AI Agents*, cepat"), [
      [{ text: "AI", accent: true }],
      [
        { text: "Agents", accent: true },
        { text: ",", accent: false },
      ],
      [{ text: "cepat", accent: false }],
    ]);
  });
});

describe("transitionLayers", () => {
  const shots: ShotSpan[] = [
    { id: "s1", s: 0, e: 4 },
    { id: "s2", s: 4, e: 8 },
    { id: "s3", s: 8, e: 12 },
  ];

  test("first shot at t = 0 has no previous layer and progress 1", () => {
    assert.deepEqual(transitionLayers(shots, 0), { activeIdx: 0, prevIdx: null, progress: 1 });
    assert.deepEqual(transitionLayers(shots, -1), { activeIdx: 0, prevIdx: null, progress: 1 });
  });

  test("mid-transition at shot[1].s + 0.18 yields activeIdx 1, prevIdx 0, progress ~0.5", () => {
    assert.equal(TRANSITION_DUR, 0.36);
    const mid = transitionLayers(shots, shots[1].s + 0.18);
    assert.equal(mid.activeIdx, 1);
    assert.equal(mid.prevIdx, 0);
    assert.ok(Math.abs(mid.progress - 0.5) < 1e-12);
  });

  test("after transition window finishes, prevIdx becomes null and progress is 1", () => {
    assert.deepEqual(transitionLayers(shots, shots[1].s + TRANSITION_DUR), {
      activeIdx: 1,
      prevIdx: null,
      progress: 1,
    });
  });

  test("short shot (< TRANSITION_DUR) clamps window cleanly without NaN", () => {
    const shortShots: ShotSpan[] = [
      { id: "s1", s: 0, e: 4 },
      { id: "s2", s: 4, e: 4.2 },
      { id: "s3", s: 4.2, e: 8 },
    ];
    const mid = transitionLayers(shortShots, 4.1);
    assert.equal(mid.activeIdx, 1);
    assert.equal(mid.prevIdx, 0);
    assert.equal(Number.isFinite(mid.progress), true);
    assert.ok(Math.abs(mid.progress - 0.5) < 1e-9);

    const atEnd = transitionLayers(
      [
        { id: "s1", s: 0, e: 4 },
        { id: "s2", s: 4, e: 4.2 },
      ],
      4.2,
    );
    assert.deepEqual(atEnd, { activeIdx: 1, prevIdx: null, progress: 1 });
  });

  test("t >= lastShot.e clamps to lastIdx with prevIdx null and progress 1", () => {
    assert.deepEqual(transitionLayers(shots, 12), { activeIdx: 2, prevIdx: null, progress: 1 });
    assert.deepEqual(transitionLayers(shots, 99), { activeIdx: 2, prevIdx: null, progress: 1 });
  });
});

describe("transitionStyles", () => {
  const kinds: TransitionKind[] = ["zoom-cross", "slide-up", "slide-left", "wipe", "scale-fade"];

  test("returns finite transforms and valid bounds for all 5 kinds at progress 0, 0.5, 1", () => {
    for (const kind of kinds) {
      for (const p of [0, 0.5, 1]) {
        const { incoming, outgoing } = transitionStyles(kind, p);
        for (const layer of [incoming, outgoing]) {
          for (const v of Object.values(layer)) {
            assert.equal(Number.isFinite(v), true, `${kind} at ${p} has non-finite value`);
          }
          assert.ok(layer.opacity >= 0 && layer.opacity <= 1, `${kind} opacity out of bounds at ${p}`);
          assert.ok(layer.clipInsetRight >= 0 && layer.clipInsetRight <= 100, `${kind} clipInsetRight out of bounds at ${p}`);
          assert.ok(layer.wipeGlowOpacity >= 0 && layer.wipeGlowOpacity <= 1, `${kind} wipeGlowOpacity out of bounds at ${p}`);
        }
      }

      const end = transitionStyles(kind, 1);
      assert.deepEqual(end.incoming, {
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
        clipInsetRight: 0,
        wipeGlowOpacity: 0,
      });
      assert.equal(end.outgoing.opacity, 0);

      const start = transitionStyles(kind, 0);
      assert.deepEqual(start.outgoing, {
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
        clipInsetRight: 0,
        wipeGlowOpacity: 0,
      });
    }
  });
});

describe("DARK_TECH and TechIcon", () => {
  const expectedIcons: TechIconName[] = [
    "sparkle",
    "terminal",
    "code",
    "brain",
    "bot",
    "folder",
    "file",
    "git",
    "plug",
    "shield",
    "lock",
    "image",
    "video",
    "clock",
    "bolt",
    "check",
    "x",
    "warning",
    "search",
    "copy",
    "sliders",
    "layers",
    "database",
    "globe",
  ];

  const expectedPaletteKeys = [
    "bg",
    "surface",
    "surfaceAlt",
    "border",
    "mint",
    "cyan",
    "violet",
    "amber",
    "red",
    "ink",
    "muted",
  ] as const;

  test("DARK_TECH has all required non-empty hex/rgba color tokens", () => {
    assert.deepEqual(Object.keys(DARK_TECH).sort(), [...expectedPaletteKeys].sort());
    for (const key of expectedPaletteKeys) {
      const value = DARK_TECH[key];
      assert.equal(typeof value, "string");
      assert.ok(value.length > 0, `DARK_TECH.${key} is empty`);
      assert.match(
        value,
        /^(#[0-9a-f]{6}|rgba?\([^)]+\))$/i,
        `DARK_TECH.${key} (${value}) must be hex or rgb/rgba`,
      );
    }
  });

  test("TECH_ICON_NAMES contains all 24 expected icon names without duplicates and TechIcon renders each", () => {
    assert.equal(TECH_ICON_NAMES.length, 24);
    assert.equal(new Set(TECH_ICON_NAMES).size, 24);
    assert.deepEqual([...TECH_ICON_NAMES].sort(), [...expectedIcons].sort());

    for (const name of TECH_ICON_NAMES) {
      const el = TechIcon({ name, size: 28, color: DARK_TECH.ink, accent: DARK_TECH.mint });
      assert.equal(React.isValidElement(el), true, `TechIcon("${name}") should return a valid React element`);
    }
  });
});

describe("BeatCallout and line spotlighting", () => {
  test("BeatCallout appears at its cue, shows the step number, and dims after until", () => {
    const el = BeatCallout({ t: 2, at: 2, step: 1, text: "Parse" });
    assert.equal(React.isValidElement(el), true);
    const html = renderToStaticMarkup(el as React.ReactElement);
    assert.match(html, /Parse/);
    assert.match(html, />1</);
    assert.match(html, /opacity:0/, "at the cue frame it is still popping in");

    const visible = renderToStaticMarkup(BeatCallout({ t: 2.6, at: 2, step: 1, text: "Parse" }) as React.ReactElement);
    assert.match(visible, /opacity:1/, "one spring later it is fully visible");

    const before = renderToStaticMarkup(BeatCallout({ t: 1, at: 2, step: 1, text: "Parse" }) as React.ReactElement);
    assert.match(before, /opacity:0/);

    const after = renderToStaticMarkup(BeatCallout({ t: 9, at: 2, until: 5, step: 2, text: "Validate" }) as React.ReactElement);
    assert.match(after, /opacity:0/);
  });

  test("TerminalCard dims lines that are not the one being narrated", () => {
    const lines = [
      { text: "npm run dev", kind: "cmd" as const, at: 0, activeAt: 0 },
      { text: "ready", kind: "ok" as const, at: 1, activeAt: 4 },
    ];
    const atFirst = renderToStaticMarkup(TerminalCard({ t: 1.5, lines }) as React.ReactElement);
    assert.match(atFirst, /opacity:0\.55/, "the later line must be dimmed while the first is narrated");
    const atSecond = renderToStaticMarkup(TerminalCard({ t: 5, lines }) as React.ReactElement);
    assert.match(atSecond, /opacity:1/, "the narrated line must be at full opacity");
  });

  test("MetricPanel bars accept activeAt and dim the inactive rows", () => {
    const bars = [
      { label: "gpt", value: 30, at: 0, activeAt: 0 },
      { label: "claude", value: 70, at: 0.4, activeAt: 3 },
    ];
    const html = renderToStaticMarkup(MetricPanel({ t: 1, bars }) as React.ReactElement);
    assert.match(html, /opacity:0\.55/);
    assert.match(html, /claude/);
  });
});

describe("ComparisonSplit line spotlighting", () => {
  test("pointsAt dims exactly one point at a time, only once a cue has passed", () => {
    const before = { label: "LAMA", title: "Cara lama", points: ["Poin A", "Poin B"], pointsAt: [2, 6], at: 0 };
    const after = { label: "BARU", title: "Cara baru", points: ["Poin C"], at: 0 };
    const dims = (t: number) =>
      (renderToStaticMarkup(ComparisonSplit({ t, before, after }) as React.ReactElement).match(/opacity:0\.55/g) ?? []).length;
    assert.equal(dims(1), 0, "no cue yet: nothing is dimmed");
    assert.equal(dims(3), 1, "first cue passed: the other point dims");
    assert.equal(dims(7), 1, "second cue passed: still exactly one spotlighted point");
  });

  test("a side without pointsAt is never dimmed", () => {
    const before = { label: "LAMA", title: "Cara lama", points: ["Poin A", "Poin B"], at: 0 };
    const after = { label: "BARU", title: "Cara baru", points: ["Poin C"], at: 0 };
    const html = renderToStaticMarkup(ComparisonSplit({ t: 9, before, after }) as React.ReactElement);
    assert.doesNotMatch(html, /opacity:0\.55/);
  });
});

describe("IllustrationStage presets", () => {
  test("each new variant renders an SVG and changes between timestamps", () => {
    for (const variant of ["agent-loop", "context-window", "code-diff"] as const) {
      const a = renderToStaticMarkup(React.createElement(IllustrationStage, { t: 1, at: 1, variant, activeStep: 0 }));
      const b = renderToStaticMarkup(React.createElement(IllustrationStage, { t: 3, at: 1, variant, activeStep: 2 }));
      assert.match(a, /<svg/, `${variant} must draw an SVG`);
      assert.notEqual(a.replace(/id="[^"]*"/g, ""), b.replace(/id="[^"]*"/g, ""), `${variant} did not change between timestamps`);
    }
  });

  test("activeStep highlights a different node as the narration advances", () => {
    const a = renderToStaticMarkup(React.createElement(IllustrationStage, { t: 4, at: 1, variant: "agent-loop", activeStep: 0 }));
    const b = renderToStaticMarkup(React.createElement(IllustrationStage, { t: 4, at: 1, variant: "agent-loop", activeStep: 3 }));
    assert.notEqual(a, b);
  });
});
