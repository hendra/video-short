import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Group, Mesh, Object3D } from "three";
import { Kit, poseFigure } from "../src/engine/kit.ts";
import { flowPhase } from "../src/engine/math.ts";

// Duck-typed: tsx can load two copies of `three` (src/ vs scripts/ resolution), so `instanceof Mesh` is unreliable here.
const isMesh = (o: Object3D): boolean => (o as { isMesh?: boolean }).isMesh === true;
const isGroup = (o: Object3D): boolean => (o as { isGroup?: boolean }).isGroup === true;

const countMeshes = (o: Object3D): number => {
  let n = isMesh(o) ? 1 : 0;
  o.children.forEach((c) => (n += countMeshes(c)));
  return n;
};

describe("Kit mechanical builders", () => {
  test("tube builds a curved mesh and samples points along it", () => {
    const kit = new Kit(new Group());
    const t = kit.tube([[0, 0, 0], [1, 1, 0], [2, 0, 0]], 0.1, "#888");
    assert.ok(countMeshes(t.mesh) >= 1);
    const a = t.at(0), b = t.at(1);
    assert.ok(Math.abs(a[0]) < 1e-6 && Math.abs(b[0] - 2) < 1e-3, `${a} ${b}`);
  });

  test("ring, coil, gear, fan and arrow all build geometry with no NaN transforms", () => {
    const root = new Group();
    const kit = new Kit(root);
    kit.ring(0, 0, 0, 0.4, 0.05, "#999");
    kit.coil(0, 0, 0, { turns: 4 });
    const gear = kit.gear(0, 0, 0, { teeth: 8 });
    const fan = kit.fan(0, 0, 0, { blades: 4 });
    const arrow = kit.arrow([0, 0, 0], [0, 2, 0], "#f00");
    assert.ok(isGroup(gear.rotor) && isGroup(fan.rotor));
    assert.ok(countMeshes(root) >= 12, `only ${countMeshes(root)} meshes`);
    root.traverse((o) => {
      assert.ok(Number.isFinite(o.position.x + o.position.y + o.position.z));
      assert.ok(Number.isFinite(o.rotation.x + o.rotation.y + o.rotation.z));
    });
    arrow.setProgress(0.5);
    assert.ok(Number.isFinite(arrow.root.scale.y));
  });

  test("gear teeth count matches the requested teeth", () => {
    const kit = new Kit(new Group());
    const { rotor } = kit.gear(0, 0, 0, { teeth: 10 });
    assert.equal(rotor.children.length, 10);
  });

  test("a full mechanism stays inside the CPU render triangle budget", () => {
    const root = new Group();
    const kit = new Kit(root);
    kit.tube([[0, 0, 0], [1, 1, 0], [2, 0, 0]], 0.1, "#888");
    kit.coil(0, 0, 0, { turns: 4 });
    kit.gear(0, 0, 0, { teeth: 10 });
    kit.fan(0, 0, 0, { blades: 4 });
    let tris = 0;
    root.traverse((o) => {
      const g = (o as Mesh).geometry as { index?: { count: number } | null; attributes?: { position?: { count: number } } } | undefined;
      if (!g?.attributes?.position) return;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    assert.ok(tris < 20000, `mechanism uses ${tris} triangles, budget is 20000`);
  });
});

describe("Kit flow, cutaway and glow", () => {
  test("flowDots advances along the curve and never reverses", () => {
    const kit = new Kit(new Group());
    const dots = kit.flowDots([[0, 0, 0], [1, 0, 0], [2, 0, 0]], 6, "#7fe3c4", { speed: 0.5 });
    const snap = () => Array.from(dots.instanceMatrix.array.slice(0, 16));
    const before = snap();
    dots.update(0.5);
    assert.notDeepEqual(snap(), before);
    for (const v of snap()) assert.ok(Number.isFinite(v));
  });

  test("a line-boosted flow keeps moving forward at every frame, never flicking back", () => {
    const kit = new Kit(new Group());
    const dots = kit.flowDots([[0, 0, 0], [1, 0, 0], [2, 0, 0]], 6, "#7fe3c4", { speed: 0.35 });
    const line = { n: 5, s: 30, e: 33, text: "x" };
    const firstX = () => dots.instanceMatrix.array[12];
    let prev = -1;
    let moves = 0;
    // walk the whole lead window at 30 fps: the dot must advance monotonically, never jump back
    for (let f = 0; f <= 30; f++) {
      const t = 29.8 + f / 30;
      dots.update(flowPhase(t, line));
      const x = firstX();
      if (prev >= 0) {
        const d = ((x - prev) % 2 + 2) % 2; // wrap-safe forward distance along the 0..2 tube
        assert.ok(d < 1, `dot jumped ${d.toFixed(2)} of the tube at t=${t.toFixed(3)} — flow reversed or teleported`);
        if (d > 0) moves++;
      }
      prev = x;
    }
    assert.ok(moves > 20, `flow barely moved (${moves} advancing frames)`);
  });

  test("cutaway slides parts open, hides them fully open, and returns to base when reopened", () => {
    const kit = new Kit(new Group());
    const shell = kit.box(0, 1, 0, 1, 0, 1, "#ccc");
    kit.cutaway([shell], 0, [2, 0, 0]);
    assert.equal(shell.position.x, 0.5);
    assert.equal(shell.visible, true);
    kit.cutaway([shell], 1, [2, 0, 0]);
    assert.equal(shell.position.x, 2.5);
    assert.equal(shell.visible, false);
    kit.cutaway([shell], 0, [2, 0, 0]);
    assert.equal(shell.position.x, 0.5, "reopening returns to the captured base position");
    assert.equal(shell.visible, true);
  });

  test("glowMat returns a fresh material each call and never touches the cache", () => {
    const kit = new Kit(new Group());
    const a = kit.glowMat("#888", "#20C9C3");
    const b = kit.glowMat("#888", "#20C9C3");
    assert.notEqual(a, b);
    a.emissiveIntensity = 0.9;
    assert.notEqual(b.emissiveIntensity, 0.9);
    assert.notEqual(kit.mat("#888"), a);
  });
});

describe("Kit diorama life", () => {
  test("figure exposes torso and blink groups and keeps the original parts", () => {
    const kit = new Kit(new Group());
    const f = kit.figure(0, 0, 0, { age: "anak" });
    assert.ok(isGroup(f.torso) && isGroup(f.blink));
    assert.ok(f.blink.children.length >= 4);
    for (const k of ["root", "head", "armL", "armR", "legL", "legR"] as const) assert.ok(f[k], `missing ${k}`);
  });

  test("poseFigure writes finite poses and differs per mode", () => {
    const kit = new Kit(new Group());
    const f = kit.figure(0, 0, 0);
    const snap = () => [f.armR.rotation.z, f.head.rotation.y, f.legL.rotation.x];
    poseFigure(f, 2, "talk", 1);
    const talk = snap();
    poseFigure(f, 2, "walk", 1);
    const walk = snap();
    for (const v of [...talk, ...walk]) assert.ok(Number.isFinite(v));
    assert.notDeepEqual(talk, walk);
  });

  test("poseFigure stays a pure function of t", () => {
    const kit = new Kit(new Group());
    const f = kit.figure(0, 0, 0);
    for (const mode of ["idle", "talk", "walk", "wave", "sad", "point"] as const) {
      poseFigure(f, 3, mode, 7);
      const a = [f.armR.rotation.z, f.head.rotation.x, f.torso.rotation.x, f.blink.scale.y];
      poseFigure(f, 3, mode, 7);
      const b = [f.armR.rotation.z, f.head.rotation.x, f.torso.rotation.x, f.blink.scale.y];
      assert.deepEqual(a, b, `${mode} is not deterministic`);
    }
  });

  test("cloud, ripple and every prop build visible geometry", () => {
    const root = new Group();
    const kit = new Kit(root);
    kit.cloud(0, 6, -4, 1.4);
    const rp = kit.ripple(0, 0, 1.2);
    for (const kind of ["lantern", "crate", "pot", "torch", "scroll", "rock", "flower"] as const) kit.prop(kind, 0, 0, 0);
    rp.setPhase(0.5);
    assert.ok(countMeshes(root) >= 20, `only ${countMeshes(root)} meshes`);
  });

  test("ripple setPhase is deterministic and visible", () => {
    const kit = new Kit(new Group());
    const rp = kit.ripple(0, 0, 1.2);
    rp.setPhase(0.5);
    const a = rp.root.children.map((c) => c.scale.x);
    rp.setPhase(0.5);
    const b = rp.root.children.map((c) => c.scale.x);
    assert.deepEqual(a, b);
    rp.setPhase(0.9);
    assert.notDeepEqual(a, rp.root.children.map((c) => c.scale.x));
  });
});

describe("poseFigure keeps the built arm splay", () => {
  test("arms keep their outward z-splay in every mode that does not override it", () => {
    const kit = new Kit(new Group());
    const f = kit.figure(0, 0, 0);
    // Kit.figure builds the arms with rotation.z = ±0.22; poseFigure must reset onto the same axis
    for (const mode of ["talk", "wave", "point", "sad"] as const) {
      poseFigure(f, 1, mode, 1);
      assert.ok(Math.abs(f.armL.rotation.y) < 1e-9, `${mode}: left arm yawed to ${f.armL.rotation.y}`);
      assert.ok(Math.abs(f.armR.rotation.y) < 1e-9, `${mode}: right arm yawed to ${f.armR.rotation.y}`);
    }
    poseFigure(f, 1, "sad", 1);
    assert.ok(f.armL.rotation.z < 0, `sad: left arm lost its outward splay (z=${f.armL.rotation.z})`);
    assert.ok(f.armR.rotation.z > 0, `sad: right arm lost its outward splay (z=${f.armR.rotation.z})`);
  });
});
