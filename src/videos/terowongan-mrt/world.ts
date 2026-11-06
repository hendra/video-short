import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Euler,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { Kit, setInstance } from "../../engine/kit";
import { clamp, lerp, rng, smooth } from "../../engine/math";
import type { Ctx, WorldApi } from "../../engine/types";
import { BOT, BORE, MX, R, RING_IN, RING_OUT, SHIELD, TY, W, X0, XS, XS_W, ZB, makeState } from "./state";

const SKY = new Color("#dfe9ec");
const SKY_WARM = new Color("#f2d7bd");
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
const DEG = Math.PI / 180;

/**
 * Soil block in the (z, y) plane with a half-bore notch on its cut face (z = 0), extruded along +x.
 * Shape u = -z, v = y; after rotateY(90°) local +z (extrusion) becomes world +x.
 */
const notchedSlab = (x0: number, x1: number, notch: boolean) => {
  const s = new Shape();
  s.moveTo(0, 0);
  s.lineTo(-ZB, 0);
  s.lineTo(-ZB, BOT);
  s.lineTo(0, BOT);
  if (notch) {
    s.lineTo(0, TY - BORE);
    s.absarc(0, TY, BORE, -Math.PI / 2, Math.PI / 2, false);
  }
  s.lineTo(0, 0);
  const g = new ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return g;
};

/** Annular sector (tunnel segment) centred on shape angle 0, extruded along +x by `depth`. Angle a -> y = r·sin a, z = -r·cos a. */
const sectorGeo = (rIn: number, rOut: number, half: number, depth: number) => {
  const s = new Shape();
  s.moveTo(Math.cos(-half) * rOut, Math.sin(-half) * rOut);
  s.absarc(0, 0, rOut, -half, half, false);
  s.lineTo(Math.cos(half) * rIn, Math.sin(half) * rIn);
  s.absarc(0, 0, rIn, half, -half, true);
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
  g.rotateY(Math.PI / 2);
  return g;
};

/** Back half (z <= 0) of an open cylinder whose axis is the x axis. */
const halfShell = (r: number, len: number) => {
  const g = new CylinderGeometry(r, r, len, 40, 1, true, Math.PI / 2, Math.PI);
  g.rotateZ(Math.PI / 2);
  return g;
};

export const createWorld = (ctx: Ctx): WorldApi => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);

  // ---------- lights
  root.add(new HemisphereLight("#ffffff", "#7d8c6b", 1.2));
  const sun = new DirectionalLight("#fff3df", 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  root.add(sun, sun.target);

  // ---------- soil (cut-away) + surface
  const SOIL = k.mat("#8a6446");
  k.add(new Mesh(notchedSlab(-45, XS, true), SOIL));
  k.add(new Mesh(notchedSlab(XS + 9, 45, false), SOIL));
  for (const [y, h, c] of [[-1.2, 0.18, "#7b5a40"], [-3.0, 0.3, "#6f4f37"], [-4.8, 0.22, "#7b5a40"], [-9.6, 0.4, "#5e432f"], [-11.2, 0.3, "#54402f"]] as [number, number, string][]) {
    k.box(-45, XS, y - h, y + h, 0.001, 0.02, c);
    k.box(XS + 9, 45, y - h, y + h, 0.001, 0.02, c);
  }
  // groundwater dots on the face
  const water = k.particles(160, "#7ec8ea", 0.05);
  { const r = rng(4); for (let i = 0; i < 160; i++) { const y = -1.5 - r() * 10; const x = -45 + r() * 90; setInstance(water, i, x, y, 0.03, Math.abs(y - TY) < BORE + 0.15 || (x > XS && x < XS + 9) ? 0 : 1); } water.instanceMatrix.needsUpdate = true; }
  // soil still ahead of the cutterhead (fills the notch); can turn see-through for the mechanism shots
  const fillMat = new MeshStandardMaterial({ color: "#8a6446", roughness: 0.95, flatShading: true, transparent: true, opacity: 1 });
  const fill = new Mesh(new BoxGeometry(1, 1, 1), fillMat);
  fill.receiveShadow = true;
  root.add(fill);
  // ground surface
  k.box(-45, 45, -0.08, 0, ZB, 0, "#b7b3a8");
  k.box(-200, 260, -0.2, -0.1, -80, ZB, "#c9cfc3");
  k.box(-45, 45, 0, 0.03, -2.7, -0.7, "#55585c"); // road
  for (let x = -44; x < 45; x += 1.6) k.box(x, x + 0.8, 0.03, 0.04, -1.73, -1.67, "#f4f1ea");
  k.box(-45, 45, 0, 0.08, -0.7, 0, "#d9d4c8"); k.box(-45, 45, 0, 0.08, -3.3, -2.7, "#d9d4c8"); // sidewalks
  // old town (colonial) facades + newer towers behind
  {
    const r = rng(17);
    for (let x = -44; x < 44; x += 2.4) {
      if (x > XS - 1 && x < XS + 9.5) continue;
      const h = 1.1 + r() * 0.9, d = 2.6 + r() * 1.4, w = 2.0 + r() * 0.3;
      const g = new Group(); g.position.set(x + w / 2, 0, -3.6 - d / 2); root.add(g);
      k.add(new Mesh(new BoxGeometry(w, h, d), k.mat(r() < 0.6 ? "#f1ece1" : "#eadfca")), g).position.y = h / 2;
      const roof = k.add(new Mesh(new ConeGeometry(Math.max(w, d) * 0.72, 0.6, 4), k.mat(r() < 0.5 ? "#b5523c" : "#a94434")), g);
      roof.position.y = h + 0.3; roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
      for (let i = 0; i < 3; i++) for (let j = 0; j < Math.floor(h / 0.5); j++)
        k.box(-w / 2 + 0.35 + i * (w - 0.7) / 2 - 0.12, -w / 2 + 0.35 + i * (w - 0.7) / 2 + 0.12, 0.25 + j * 0.5, 0.6 + j * 0.5, d / 2, d / 2 + 0.02, "#4a5a66", g);
    }
    for (let i = 0; i < 16; i++) {
      const h = 5 + r() * 9;
      k.add(new Mesh(new BoxGeometry(3 + r() * 2, h, 3 + r() * 2), k.mat(r() < 0.5 ? "#9fb6c4" : "#b8c4cc", { roughness: 0.4, metalness: 0.2 })), root, true).position.set(-40 + i * 6 + r() * 3, h / 2, -16 - r() * 10);
    }
    for (let i = 0; i < 14; i++) k.tree(-44 + i * 6.4 + r(), -0.35, 0.7 + r() * 0.3);
  }
  // traffic
  const CARS = 18;
  const carBody = new InstancedMesh(new BoxGeometry(0.62, 0.18, 0.3), new MeshStandardMaterial({ flatShading: true, roughness: 0.6 }), CARS);
  const carTop = new InstancedMesh(new BoxGeometry(0.34, 0.14, 0.26), new MeshStandardMaterial({ color: "#2b3540", roughness: 0.3 }), CARS);
  carBody.castShadow = carTop.castShadow = true; carBody.frustumCulled = carTop.frustumCulled = false;
  { const cols = ["#e04f3e", "#f2f2f2", "#3a7bd5", "#f2c230", "#2e9b5b", "#1d2328"]; for (let i = 0; i < CARS; i++) carBody.setColorAt(i, new Color(cols[i % cols.length])); }
  root.add(carBody, carTop);
  const carSeed = (() => { const r = rng(8); return Array.from({ length: CARS }, (_, i) => ({ lane: i % 2, off: r() * 90, sp: 2.2 + r() * 1.2 })); })();

  // ---------- station (cut-away box)
  k.add(new Mesh(notchedSlab(XS, XS + XS_W, true), k.mat("#bdb7aa")));
  k.box(XS + 8.5, XS + 9, BOT, 0, ZB, 0, "#bdb7aa");
  k.box(XS, XS + 9, BOT, BOT + 0.6, ZB, 0, "#bdb7aa");
  k.box(XS, XS + 9, -0.6, 0, ZB, 0, "#bdb7aa");
  for (const y of [-2.9, -5.2]) k.box(XS + 0.5, XS + 8.5, y - 0.25, y, ZB, 0, "#c9c3b6");
  k.box(XS + 0.5, XS + 8.5, BOT + 0.6, -8.0, ZB, -1.2, "#cfc9bc"); // platform
  k.box(XS + 0.5, XS + 8.5, -8.0, -7.95, -1.35, -1.2, "#f2c230"); // platform edge
  k.box(XS, XS + 9, BOT, 0, ZB - 0.4, ZB, "#b3ad9f");
  k.box(XS + 2, XS + 6, 0, 0.9, -2.6, -0.8, k.mat("#7fb9c9", { roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.7 })); // entrance canopy
  k.box(XS + 1.8, XS + 6.2, 0.9, 1.0, -2.8, -0.6, "#2f9a62");
  // the plug inside the diaphragm wall: small blocks that burst out at breakthrough
  const plugCells: { y: number; z: number; v: Vector3; spin: number }[] = [];
  { const r = rng(12); for (let y = TY - BORE + 0.1; y < TY + BORE; y += 0.2) for (let z = -BORE + 0.1; z < 0; z += 0.2) if (Math.hypot(y - TY, z) < BORE - 0.05) plugCells.push({ y, z, v: V(1.5 + r() * 2.5, 0.6 + r() * 1.8, (r() - 0.6) * 1.4), spin: r() * 8 }); }
  const plug = new InstancedMesh(new BoxGeometry(0.19, 0.19, 0.19), k.mat("#bdb7aa"), plugCells.length);
  plug.castShadow = true; plug.frustumCulled = false; root.add(plug);

  // ---------- tunnel lining (rings), grout, rails
  const RMAX = Math.ceil((XS - X0) / W) + 2;
  const segGeo = sectorGeo(RING_IN, RING_OUT, 29 * DEG, W * 0.95);
  const segs = new InstancedMesh(segGeo, new MeshStandardMaterial({ roughness: 0.85, flatShading: true }), RMAX * 3);
  segs.castShadow = segs.receiveShadow = true; segs.frustumCulled = false; root.add(segs);
  for (let i = 0; i < RMAX * 3; i++) segs.setColorAt(i, new Color(Math.floor(i / 3) % 2 ? "#cfcac0" : "#c2bdb2"));
  const SEG_A = [-60 * DEG, 0, 60 * DEG];
  const groutMat = new MeshStandardMaterial({ color: "#8fa3b0", roughness: 0.7, side: DoubleSide });
  const grout = new Mesh(halfShell((RING_OUT + BORE) / 2, 1), groutMat); root.add(grout);
  const floorPlate = new Mesh(new BoxGeometry(1, 0.05, 0.62), k.mat("#9a958b")); floorPlate.receiveShadow = true; root.add(floorPlate);
  const rails = [new Mesh(new BoxGeometry(1, 0.04, 0.04), k.mat("#5d646b")), new Mesh(new BoxGeometry(1, 0.04, 0.04), k.mat("#5d646b"))];
  rails.forEach((m) => root.add(m));

  // ---------- TBM (group origin = front of the cutterhead)
  const tbm = new Group(); root.add(tbm);
  const YEL = k.mat("#e8b23a", { roughness: 0.45, metalness: 0.35, side: DoubleSide });
  k.add(new Mesh(halfShell(R, SHIELD - 0.1), YEL), tbm).position.set(-(SHIELD - 0.1) / 2 - 0.1, TY, 0);
  for (const x of [-0.6, -1.4, -2.1]) k.add(new Mesh(halfShell(R + 0.015, 0.06), k.mat("#c99520", { side: DoubleSide })), tbm).position.set(x, TY, 0);
  const bulk = new CylinderGeometry(R * 0.97, R * 0.97, 0.07, 40, 1, false, Math.PI / 2, Math.PI); bulk.rotateZ(Math.PI / 2);
  k.add(new Mesh(bulk, k.mat("#b98a22", { side: DoubleSide })), tbm).position.set(-0.6, TY, 0);
  // cutterhead
  const cutter = new Group(); cutter.position.set(0, TY, 0); tbm.add(cutter);
  const disc = new CylinderGeometry(R * 0.97, R * 0.97, 0.14, 40); disc.rotateZ(Math.PI / 2);
  k.add(new Mesh(disc, k.mat("#4b5058", { roughness: 0.5, metalness: 0.4 })), cutter).position.x = -0.05;
  for (let i = 0; i < 6; i++) {
    const a = (i * 60) * DEG;
    const spoke = k.add(new Mesh(new BoxGeometry(0.08, R * 0.92, 0.12), k.mat("#30343a", { metalness: 0.4 })), cutter);
    spoke.position.set(0.06, Math.sin(a) * R * 0.46, -Math.cos(a) * R * 0.46); spoke.rotation.x = a + Math.PI / 2;
    for (let j = 1; j <= 3; j++) {
      const tooth = new ConeGeometry(0.035, 0.12, 6); tooth.rotateZ(-Math.PI / 2);
      k.add(new Mesh(tooth, k.mat("#d6dade", { metalness: 0.6, roughness: 0.3 })), cutter).position.set(0.17, Math.sin(a) * R * 0.28 * j, -Math.cos(a) * R * 0.28 * j);
    }
  }
  const hub = new CylinderGeometry(0.13, 0.13, 0.2, 16); hub.rotateZ(Math.PI / 2);
  k.add(new Mesh(hub, k.mat("#c8352b")), cutter).position.x = 0.07;
  // chamber soil paste + pressure arrows
  const paste = k.particles(140, "#7a5536", 0.045); root.remove(paste); tbm.add(paste);
  const pasteSeed = (() => { const r = rng(31); return Array.from({ length: 140 }, () => [0.1 + r() * (R - 0.18), r() * Math.PI * 2, -0.12 - r() * 0.42]); })();
  const coneIn = new ConeGeometry(0.06, 0.24, 8); coneIn.rotateZ(-Math.PI / 2);
  const arrowsIn = new InstancedMesh(coneIn, new MeshStandardMaterial({ color: "#e8622c", emissive: "#e8622c", emissiveIntensity: 0.4 }), 5);
  const arrowsOut = new InstancedMesh(coneIn, new MeshStandardMaterial({ color: "#3a8fd5", emissive: "#3a8fd5", emissiveIntensity: 0.4 }), 5);
  arrowsIn.frustumCulled = arrowsOut.frustumCulled = false; tbm.add(arrowsIn, arrowsOut);
  // screw conveyor
  const scA = V(-0.62, TY - 0.55, -0.38), scB = V(-2.65, TY + 0.12, -0.38);
  const scLen = scA.distanceTo(scB);
  const screw = new Group(); screw.position.copy(scA);
  screw.quaternion.copy(new Quaternion().setFromUnitVectors(V(1, 0, 0), scB.clone().sub(scA).normalize()));
  tbm.add(screw);
  const scTube = new CylinderGeometry(0.14, 0.14, scLen, 20, 1, true); scTube.rotateZ(Math.PI / 2); scTube.translate(scLen / 2, 0, 0);
  screw.add(new Mesh(scTube, new MeshStandardMaterial({ color: "#9aa6b0", transparent: true, opacity: 0.35, side: DoubleSide, roughness: 0.4 })));
  const helixPts: Vector3[] = [];
  for (let i = 0; i <= 240; i++) { const x = (i / 240) * scLen, a = (x / 0.2) * Math.PI * 2; helixPts.push(V(x, Math.cos(a) * 0.1, Math.sin(a) * 0.1)); }
  const helix = new Group(); screw.add(helix);
  k.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(helixPts), 480, 0.022, 6), k.mat("#e8622c", { metalness: 0.3 })), helix);
  const shaftG = new CylinderGeometry(0.03, 0.03, scLen, 8); shaftG.rotateZ(Math.PI / 2); shaftG.translate(scLen / 2, 0, 0);
  k.add(new Mesh(shaftG, k.mat("#5d646b")), helix);
  const muck = k.particles(70, "#7a5536", 0.042); root.remove(muck); tbm.add(muck);
  // conveyor belt, gantries, muck car, workers
  k.box(-7.6, -2.6, TY + 0.06, TY + 0.1, -0.52, -0.24, "#2b2f33", tbm);
  for (const x of [-3.4, -4.9, -6.4]) {
    k.box(x - 0.05, x + 0.05, TY - RING_IN + 0.05, TY + 0.5, -0.62, -0.54, "#e8b23a", tbm);
    k.box(x - 0.05, x + 0.05, TY + 0.45, TY + 0.53, -0.62, -0.02, "#e8b23a", tbm);
  }
  const car = new Group(); car.position.set(-8.2, TY - RING_IN + 0.06, -0.38); tbm.add(car);
  k.box(-0.45, 0.45, 0.06, 0.38, -0.2, 0.2, "#c8352b", car);
  const heap = k.add(new Mesh(new SphereGeometry(0.32, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), k.mat("#7a5536")), car); heap.position.y = 0.38; heap.scale.set(1.3, 0.5, 0.6);
  const crew = [k.worker(0, 0, Math.PI / 2), k.worker(0, 0, Math.PI * 0.6)];
  crew.forEach((w, i) => { root.remove(w); tbm.add(w); w.scale.setScalar(0.5); w.position.set(-4.3 - i * 1.6, TY - RING_IN + 0.06, -0.3); });
  // erector
  const erector = new Group(); erector.position.set(0, TY, 0); tbm.add(erector);
  const ringFrame = new TorusGeometry(0.55, 0.035, 6, 32); ringFrame.rotateY(Math.PI / 2);
  k.add(new Mesh(ringFrame, k.mat("#3d4650", { metalness: 0.4 })), erector);
  const arm = k.add(new Mesh(new BoxGeometry(0.1, 0.12, 0.62), k.mat("#e8622c")), erector);
  arm.position.z = -0.31;
  const carried = new Mesh(segGeo, k.mat("#f2eee6")); carried.castShadow = true; root.add(carried);
  // thrust jacks (4, back half)
  const JACK_A = [-70 * DEG, -25 * DEG, 25 * DEG, 70 * DEG];
  const jackGeo = new CylinderGeometry(0.045, 0.045, 1, 10); jackGeo.rotateZ(Math.PI / 2);
  const rodGeo = new CylinderGeometry(0.025, 0.025, 1, 8); rodGeo.rotateZ(Math.PI / 2);
  const jacks = JACK_A.map(() => [new Mesh(jackGeo, k.mat("#c8352b")), new Mesh(rodGeo, k.mat("#d6dade", { metalness: 0.7, roughness: 0.25 }))]);
  jacks.forEach(([a, b]) => root.add(a, b));
  // grout nozzles + spray
  const groutP = k.particles(60, "#a9bcc8", 0.05);

  // ---------- depth dimension (shot A) + "risk" wedge (shot B) + diameter marker (shot C)
  const dimMat = new MeshStandardMaterial({ color: "#1d2328" });
  const dim = new Group(); root.add(dim);
  const dimLine = new Mesh(new BoxGeometry(0.04, 1, 0.04), dimMat); dim.add(dimLine);
  const dimCapA = new Mesh(new ConeGeometry(0.12, 0.3, 10), dimMat); dim.add(dimCapA);
  const dimCapB = new Mesh(new ConeGeometry(0.12, 0.3, 10), dimMat); dimCapB.rotation.z = Math.PI; dim.add(dimCapB);
  const riskShape = new Shape(); riskShape.moveTo(-0.6, TY + R); riskShape.lineTo(0.6, TY + R); riskShape.lineTo(2.2, 0); riskShape.lineTo(-2.2, 0); riskShape.lineTo(-0.6, TY + R);
  const riskGeo = new ExtrudeGeometry(riskShape, { depth: 2.4, bevelEnabled: false }); riskGeo.translate(0, 0, -2.4);
  const riskMat = new MeshStandardMaterial({ color: "#e04f3e", transparent: true, opacity: 0, depthWrite: false });
  const riskMesh = new Mesh(riskGeo, riskMat); root.add(riskMesh);

  // ---------- six-TBM diorama (schematic)
  // line runs along -z (away from the camera) so it fits a vertical frame: local x -> world -z
  const map = new Group(); map.position.set(MX, 0, 0); map.rotation.y = Math.PI / 2; root.add(map);
  k.box(-14, 14, -0.4, 0, -6, 6, "#d4d9cc", map);
  const STA = [-11, -3.5, 3.5, 11];
  for (const x of STA) {
    k.box(x - 1, x + 1, 0, 0.5, -1.6, 1.6, "#ece5d3", map);
    k.box(x - 1.1, x + 1.1, 0.5, 0.6, -1.7, 1.7, "#2f9a62", map);
  }
  const tubeMat = new MeshStandardMaterial({ color: "#9fb6c4", transparent: true, opacity: 0.55, roughness: 0.4 });
  const minis: Group[] = [];
  for (let s = 0; s < 3; s++) for (const z of [-0.7, 0.7]) {
    const x0 = STA[s] + 1, x1 = STA[s + 1] - 1;
    const tg = new CylinderGeometry(0.42, 0.42, x1 - x0, 20); tg.rotateZ(Math.PI / 2);
    k.add(new Mesh(tg, tubeMat), map, false).position.set((x0 + x1) / 2, 0.42, z);
    const m = new Group(); map.add(m); minis.push(m);
    const body = new CylinderGeometry(0.4, 0.4, 1.4, 20); body.rotateZ(Math.PI / 2);
    k.add(new Mesh(body, k.mat("#e8b23a", { metalness: 0.3 })), m).position.x = -0.7;
    const face = new CylinderGeometry(0.41, 0.41, 0.12, 20); face.rotateZ(Math.PI / 2);
    k.add(new Mesh(face, k.mat("#4b5058")), m).position.x = 0.02;
    m.userData = { x0: x0 + 1.4, x1, z, delay: s * 0.35 + (z > 0 ? 0.18 : 0) };
  }

  const tmpE = new Euler();
  const lampMat = new MeshStandardMaterial({ color: "#fff6d8", emissive: "#fff2c0", emissiveIntensity: 1.2 });
  const lamps = new InstancedMesh(new SphereGeometry(0.035, 6, 4), lampMat, 120); lamps.frustumCulled = false; root.add(lamps);

  return {
    root,
    update: (t, shotId, pose, scene) => {
      const I = shot(shotId), lt = t - I.s;
      const warm = shotId === "L" ? smooth(lt / 3) : 0;
      const bg = SKY.clone().lerp(SKY_WARM, warm);
      scene.background = bg; scene.fog = new Fog(bg, 50, 160);
      sun.color.set("#fff3df").lerp(new Color("#ffb06a"), warm);
      sun.position.set(pose.target[0] + 10, pose.target[1] + 24, pose.target[2] + 16);
      sun.target.position.set(...pose.target); sun.target.updateMatrixWorld();

      // traffic keeps flowing above — the whole point of the story
      for (let i = 0; i < CARS; i++) {
        const c = carSeed[i], dir = c.lane ? -1 : 1;
        const x = -45 + ((((c.off + dir * t * c.sp) % 90) + 90) % 90);
        const z = c.lane ? -2.2 : -1.2;
        setInstance(carBody, i, x, 0.15, z, 1); setInstance(carTop, i, x - 0.04 * dir, 0.31, z, 1);
      }
      carBody.instanceMatrix.needsUpdate = carTop.instanceMatrix.needsUpdate = true;

      const showTbm = shotId !== "K" && shotId !== "L";
      const m = S.tbm(t, shotId);
      tbm.visible = showTbm;
      tbm.position.x = m.front;
      // rings: all complete rings, plus segments of the ring being erected
      const ringsDone = showTbm ? m.rings : Math.floor((XS - X0) / W);
      let n = 0;
      for (let i = 0; i < RMAX; i++) for (let j = 0; j < 3; j++) {
        const placed = i < ringsDone || (showTbm && i === ringsDone && m.erect > 0 && j < Math.floor(m.erect * 3 + 1e-6));
        tmpE.set(SEG_A[j], 0, 0);
        setInstance(segs, n++, X0 + i * W, TY, 0, placed ? 1 : 0, tmpE);
      }
      segs.instanceMatrix.needsUpdate = true;
      // segment travelling on the erector
      const js = Math.min(2, Math.floor(m.erect * 3));
      const sj = m.erect * 3 - js;
      carried.visible = showTbm && m.erect > 0 && m.erect < 1 && sj < 0.999;
      if (carried.visible) {
        const ang = lerp(-Math.PI / 2, SEG_A[js], smooth(Math.min(1, sj / 0.6)));
        const rad = lerp(0.55, 1, smooth((sj - 0.55) / 0.45));
        carried.position.set(X0 + ringsDone * W, TY, 0);
        carried.rotation.set(ang, 0, 0);
        carried.scale.set(1, rad, rad);
        erector.rotation.x = ang;
      } else erector.rotation.x = t * 0.4;
      arm.scale.z = carried.visible ? lerp(0.6, 1, smooth((sj - 0.55) / 0.45)) : 1;
      // jacks: from inside the shield tail back to the last complete ring
      const ringEnd = X0 + ringsDone * W;
      const anchor = m.tail + 0.45;
      JACK_A.forEach((a, i) => {
        const y = TY + Math.sin(a) * 0.77, z = -Math.cos(a) * 0.77;
        const len = Math.max(0.05, anchor - ringEnd - (m.erect > 0 ? smooth(m.erect) * m.ext : 0));
        const [cyl, rod] = jacks[i];
        cyl.visible = rod.visible = showTbm;
        cyl.scale.x = 0.38; cyl.position.set(anchor - 0.19, y, z);
        rod.scale.x = Math.max(0.02, len - 0.38); rod.position.set(anchor - 0.38 - (len - 0.38) / 2, y, z);
      });
      // grout shell lags a couple of rings behind the tail
      const gFront = showTbm ? ringEnd - lerp(1.0, 0.15, S.grout(t)) : XS;
      grout.scale.set(Math.max(0.01, gFront - X0), 1, 1); grout.position.set((X0 + gFront) / 2, TY, 0);
      groutMat.color.set(shotId === "I" ? "#7fb0cf" : "#8fa3b0");
      groutP.visible = shotId === "I" && S.grout(t) > 0;
      for (let i = 0; i < 60; i++) {
        const u = (t * 1.6 + i / 60) % 1, a = (-80 + (i % 7) * 26) * DEG;
        const r = lerp(R - 0.05, (RING_OUT + BORE) / 2, u);
        setInstance(groutP, i, m.tail + 0.15 - u * 0.5, TY + Math.sin(a) * r, -Math.cos(a) * r, 1 - u * 0.5);
      }
      groutP.instanceMatrix.needsUpdate = true;
      // floor + rails up to the back-up train
      const railEnd = showTbm ? m.front - 2.6 : XS;
      floorPlate.scale.x = railEnd - X0; floorPlate.position.set((X0 + railEnd) / 2, TY - RING_IN + 0.03, -0.31);
      rails.forEach((r, i) => { r.scale.x = railEnd - X0; r.position.set((X0 + railEnd) / 2, TY - RING_IN + 0.08, -0.18 - i * 0.36); });
      for (let i = 0; i < 120; i++) { const x = X0 + i * 0.8; setInstance(lamps, i, x, TY + 0.6, -0.36, x < railEnd ? 1 : 0); }
      lamps.instanceMatrix.needsUpdate = true;

      // cutterhead + chamber
      const digging = shotId === "A" || shotId === "D" || shotId === "E" || shotId === "F" || (m.ext > 0 && m.erect === 0);
      cutter.rotation.x = t * (digging ? 1.4 : 0.35);
      for (let i = 0; i < 140; i++) {
        const [r, a0, x] = pasteSeed[i]; const a = a0 + t * 1.4;
        const z = -Math.cos(a) * r;
        setInstance(paste, i, x, TY + Math.sin(a) * r, z, z < -0.04 ? 1 : 0);
      }
      paste.instanceMatrix.needsUpdate = true;
      const pr = S.pressure(t) * (shotId === "E" ? 1 : 0);
      arrowsIn.visible = arrowsOut.visible = pr > 0.01;
      for (let i = 0; i < 5; i++) {
        const y = TY - 0.56 + i * 0.28;
        setInstance(arrowsIn, i, -0.12 + pr * 0.1, y, -0.25, pr);
        tmpE.set(0, Math.PI, 0);
        setInstance(arrowsOut, i, 0.62 - pr * 0.1, y, -0.25, pr, tmpE);
      }
      arrowsIn.instanceMatrix.needsUpdate = arrowsOut.instanceMatrix.needsUpdate = true;
      helix.rotation.x = t * (shotId === "F" ? 5 : 2.5);
      for (let i = 0; i < 70; i++) {
        const u = (t * (shotId === "F" ? 0.28 : 0.16) + i / 70) % 1;
        let x: number, y: number, z: number;
        if (u < 0.5) { const q = u / 0.5; const p = scA.clone().lerp(scB, q); x = p.x; y = p.y + Math.cos(q * 40) * 0.06; z = p.z + Math.sin(q * 40) * 0.06; }
        else { const q = (u - 0.5) / 0.5; x = lerp(-2.7, -7.8, q); y = TY + 0.16; z = -0.38; }
        setInstance(muck, i, x, y, z, 1);
      }
      muck.instanceMatrix.needsUpdate = true;
      muck.visible = shotId !== "G" && shotId !== "I";

      // soil ahead of the face; see-through while we look inside the machine
      const fillStart = shotId === "A" ? Math.min(m.front, XS) : m.front;
      const fillEnd = XS;
      fill.visible = fillEnd - fillStart > 0.01;
      fill.scale.set(Math.max(0.01, fillEnd - fillStart), 2 * BORE + 0.02, BORE + 0.02);
      fill.position.set((fillStart + fillEnd) / 2, TY, -(BORE + 0.02) / 2 + 0.004);
      fillMat.opacity = shotId === "D" || shotId === "E" ? 0.35 : 1;
      fillMat.depthWrite = fillMat.opacity >= 1;

      // breakthrough: plug blocks burst into the station
      const open = shotId === "K" || shotId === "L";
      plugCells.forEach((c, i) => {
        if (open) { setInstance(plug, i, 0, 0, 0, 0); return; }
        const dt = shotId === "A" ? t - m.tb : -1;
        if (dt < 0) { setInstance(plug, i, XS + XS_W / 2, c.y, c.z, 1); return; }
        const x = XS + XS_W / 2 + c.v.x * dt, y = Math.max(-7.9, c.y + c.v.y * dt - 4.9 * dt * dt), z = Math.min(-0.1, c.z + c.v.z * dt);
        tmpE.set(c.spin * dt, c.spin * dt * 0.7, 0);
        setInstance(plug, i, x, y, z, clamp(1.4 - dt * 0.35), tmpE);
      });
      plug.instanceMatrix.needsUpdate = true;

      // depth dimension (A, line 2)
      const dv = shotId === "A" ? smooth((t - L(2).s - 0.3) / 0.6) : 0;
      dim.visible = dv > 0.01;
      const top = 0, bottom = lerp(top, TY, dv);
      dim.position.set(XS - 2.2, 0, 0.3);
      dimLine.scale.y = Math.max(0.01, top - bottom); dimLine.position.y = (top + bottom) / 2;
      dimCapA.position.y = top - 0.15; dimCapA.rotation.z = 0; dimCapB.position.y = bottom + 0.15; dimCapB.rotation.z = Math.PI;
      // risk wedge (B → E)
      riskMesh.position.x = m.front;
      riskMat.opacity = 0.38 * S.risk(t) * (["B", "C", "D", "E"].includes(shotId) ? 1 : 0);
      riskMesh.visible = riskMat.opacity > 0.01;

      // six TBMs
      map.visible = shotId === "K";
      if (map.visible) for (const g of minis) {
        const d = g.userData as { x0: number; x1: number; z: number; delay: number };
        const u = smooth(clamp((lt - 0.4 - d.delay) / 3.2));
        g.position.set(lerp(d.x0, d.x1, u), 0.42, d.z);
      }
    },
  };
};
