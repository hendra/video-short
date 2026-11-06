import {
  AmbientLight,
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { Kit, setInstance } from "../../engine/kit";
import { clamp, lerp, rng, smooth } from "../../engine/math";
import type { Ctx, WorldApi } from "../../engine/types";
import { BOT, GALON_COLS, GALON_N, GATE_OPEN, GATE_SHUT, GX, MX, Z0, Z1, galonPos, makeState } from "./state";

const SKY = new Color("#dfe9ec");
const SKY_WARM = new Color("#f2d7bd");
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
const curve = (pts: [number, number, number][]) => new CatmullRomCurve3(pts.map((p) => V(...p)));

export const createWorld = (ctx: Ctx): WorldApi => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);

  // ---------- lights
  root.add(new HemisphereLight("#ffffff", "#7d8c6b", 1.15));
  root.add(new AmbientLight("#ffffff", 0.05));
  const sun = new DirectionalLight("#fff3df", 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  root.add(sun, sun.target);

  const WATER = new MeshStandardMaterial({ color: "#3d93b8", roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.62, flatShading: true });
  const WATER_SEA = new MeshStandardMaterial({ color: "#357fa3", roughness: 0.3, transparent: true, opacity: 0.9 });
  const SOIL = "#8a6446", SOIL2 = "#6f4f37", GRASS = "#93b86c", STONE = "#a39d90", CONC = "#bdb7aa";

  // ---------- terrain cross-section
  k.box(-12, 1, BOT, -0.12, Z0, Z1, SOIL); k.box(-12, 1, -0.12, 0, Z0, Z1, GRASS);
  k.box(1, 3, BOT, -1.6, -2, Z1, SOIL); k.box(1, 3, -1.6, -1.5, -2, Z1, CONC);
  k.box(1, 3, BOT, -0.12, Z0, -2, SOIL); k.box(1, 3, -0.12, 0, Z0, -2, GRASS);
  k.box(1, 3, -1.6, 0, -2.15, -2, CONC);
  k.box(3, 4.2, BOT, 1.85, Z0, Z1, STONE); k.box(3, 4.2, 1.85, 2.0, Z0, Z1, "#8c8679");
  k.box(4.2, 10, BOT, -2.2, Z0, Z1, SOIL); k.box(4.2, 10, -2.2, -2.1, Z0, Z1, "#7c6a52");
  k.box(10, 12, BOT, 1.85, Z0, Z1, STONE); k.box(10, 12, 1.85, 2.0, Z0, Z1, GRASS);
  for (const [y, c, h] of [[-1.0, SOIL2, 0.12], [-2.6, "#7b5a40", 0.2], [-4.2, SOIL2, 0.35], [-6.0, "#5e432f", 0.6], [-7.6, "#54402f", 0.5]] as [number, string, number][]) {
    k.box(-12, 1, y - h, y + h, Z1, Z1 + 0.02, c);
    if (y < -2.3) { k.box(1, 3, y - h, y + h, Z1, Z1 + 0.02, c); k.box(4.2, 10, y - h, y + h, Z1, Z1 + 0.02, c); k.box(10, 12, y - h, y + h, Z1, Z1 + 0.02, c); }
  }
  // culvert + pintu air
  k.box(3, 4.2, -1.45, -0.55, Z1 - 0.9, Z1 + 0.02, "#2a2f33");
  k.box(4.2, 4.34, -1.6, 2.55, Z1 - 1.0, Z1 - 0.9, "#3d4650"); k.box(4.2, 4.34, -1.6, 2.55, Z1, Z1 + 0.1, "#3d4650");
  k.box(4.2, 4.34, 2.45, 2.6, Z1 - 1.0, Z1 + 0.1, "#3d4650");
  const hoist = k.add(new Mesh(new TorusGeometry(0.32, 0.06, 6, 14), k.mat("#c8352b")));
  hoist.position.set(4.27, 2.95, Z1 - 0.45); hoist.rotation.y = Math.PI / 2;
  const gate = k.box(4.23, 4.31, 0, 1, Z1 - 0.9, Z1, k.mat("#e8622c", { roughness: 0.5, metalness: 0.2 }));
  // raised drainage channel + trash rack
  k.box(-8, 1, 0, 0.06, 0.4, 1.4, CONC); k.box(-8, 1, 0, 0.5, 0.3, 0.42, CONC); k.box(-8, 1, 0, 0.5, 1.38, 1.5, CONC);
  k.box(-8, 1.0, 0.06, 0.3, 0.42, 1.38, WATER).castShadow = false;
  for (let z = 0.48; z < 1.36; z += 0.1) k.add(new Mesh(new CylinderGeometry(0.02, 0.02, 1.4, 5), k.mat("#3d4650"))).position.set(1.04, -0.25, z);
  k.box(1, 1.1, 0.45, 0.55, 0.35, 1.45, "#3d4650");
  k.box(-12, 1, 0, 0.02, -0.75, -0.15, "#6d7075"); // road
  // papan duga (water-level gauge)
  for (let i = 0; i < 11; i++) k.box(8.7, 8.95, -2.1 + i * 0.5, -1.6 + i * 0.5, Z1 - 0.6, Z1 - 0.35, i % 2 ? "#f4f1ea" : "#d23a2e");
  k.box(8.68, 8.97, 3.4, 3.5, Z1 - 0.62, Z1 - 0.33, "#1d2328");

  // ---------- kampung
  {
    const r = rng(11);
    for (let x = -11.3; x < -0.4; x += 1.45)
      for (let z = -9.6; z < -1; z += 1.6) {
        if (r() < 0.12) { k.tree(x + r() * 0.4, z + r() * 0.4, 0.9 + r() * 0.4); continue; }
        k.house(x + (r() - 0.5) * 0.35, z + (r() - 0.5) * 0.3, 0.85 + r() * 0.3, (r() - 0.5) * 0.25);
      }
    for (let x = -11.5; x < -8.4; x += 1.1) k.house(x, 2.6 + r() * 0.4, 0.8 + r() * 0.2, 0);
    for (let i = 0; i < 9; i++) k.tree(10.4 + r() * 1.3, -11 + i * 1.6 + r() * 0.5, 0.9 + r() * 0.5);
    for (let i = 0; i < 3; i++) k.tree(-11.4 + i * 1.2 + r() * 0.3, 3.2 + r() * 0.5, 0.8 + r() * 0.3);
    const m = new Group(); m.position.set(-5.2, 0, -4.4);
    k.add(new Mesh(new BoxGeometry(1.3, 0.8, 1.3), k.mat("#f4f0e6")), m).position.y = 0.4;
    k.add(new Mesh(new SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), k.mat("#2f9a62")), m).position.y = 0.8;
    k.add(new Mesh(new CylinderGeometry(0.08, 0.1, 2, 6), k.mat("#f4f0e6")), m).position.set(0.7, 1, 0.7);
    root.add(m);
    const h = rng(5);
    for (let i = 0; i < 9; i++) k.add(new Mesh(new ConeGeometry(9 + h() * 7, 7 + h() * 6, 6), k.mat("#b9c9c4")), root, false).position.set(-40 + i * 12 + h() * 6, 0, -70 - h() * 15);
  }

  // ---------- rumah pompa + pipe
  k.box(1.15, 2.9, 0, 1.55, -4.7, -2.45, "#ece5d3"); k.box(1.0, 3.05, 1.55, 1.7, -4.85, -2.3, "#3f6f8f");
  k.box(1.7, 2.2, 0, 0.95, -2.47, -2.4, "#4b3d33");
  for (const x of [1.4, 2.5]) k.box(x - 0.14, x + 0.14, 0.9, 1.2, -2.47, -2.42, "#a9d3e6");
  const lampMat = new MeshStandardMaterial({ color: "#2fd27a", emissive: "#2fd27a", emissiveIntensity: 1.4 });
  k.add(new Mesh(new SphereGeometry(0.13, 10, 8), lampMat)).position.set(2.0, 1.85, -2.45);
  const pipeCurve = curve([[2.0, -1.35, -1.1], [2.0, 0.4, -1.1], [2.1, 2.3, -1.25], [2.8, 2.95, -1.35], [3.7, 3.0, -1.35], [4.7, 2.5, -1.35], [5.15, 1.3, -1.35]]);
  const pipeMat = new MeshStandardMaterial({ color: "#7c8a94", roughness: 0.5, metalness: 0.3, transparent: true, opacity: 0.45 });
  k.add(new Mesh(new TubeGeometry(pipeCurve, 80, 0.24, 12), pipeMat), root, false);
  k.add(new Mesh(new CylinderGeometry(0.34, 0.28, 0.18, 12), k.mat("#55626b"))).position.set(2.0, -1.35, -1.1);
  const workers = [k.worker(1.5, -1.85, Math.PI * 0.85), k.worker(2.6, -1.95, Math.PI * 1.1)];

  // ---------- water
  const river = k.level(4.2, 10, -2.2, Z0, Z1 - 0.01, WATER);
  const sea = k.level(-40, 60, -4, -80, Z0, WATER_SEA);
  const pond = k.level(1.0, 3, -1.5, -2, Z1 - 0.01, WATER);
  const flood = k.level(-12, 1, 0, Z0, Z1 - 0.01, WATER);
  k.box(-40, 60, -4.2, -4, -80, Z0, "#6f8a8f");
  const pipeP = k.particles(140, "#8fd3f4", 0.1);
  const backP = k.particles(90, "#8fd3f4", 0.09);
  const RAIN_N = 900;
  const rain = new InstancedMesh(new BoxGeometry(0.025, 0.45, 0.025), new MeshBasicMaterial({ color: "#9ec3d8", transparent: true, opacity: 0.8 }), RAIN_N);
  rain.frustumCulled = false; root.add(rain);
  const rainSeed = (() => { const r = rng(21); return Array.from({ length: RAIN_N }, () => [r() * 26 - 13, r() * 16 - 12, r(), 0.8 + r() * 0.4]); })();

  // ---------- trash
  const trash: { m: Mesh; delay: number; z: number; ry: number; stack: number }[] = [];
  {
    const r = rng(9), cols = ["#e04f3e", "#f2f2f2", "#3a7bd5", "#f2c230", "#2e9b5b", "#e8622c"];
    for (let i = 0; i < 30; i++) {
      const g = i % 3 === 0 ? new CylinderGeometry(0.08, 0.08, 0.34, 7) : new IcosahedronGeometry(0.13 + r() * 0.06, 0);
      const m = k.add(new Mesh(g, k.mat(cols[i % cols.length])));
      trash.push({ m, delay: i * 0.11 + r() * 0.1, z: 0.5 + r() * 0.8, ry: r() * 6, stack: i });
    }
  }

  // ---------- galon diorama
  k.box(GX - 8, GX + 8, -0.4, 0, -9, 9, "#ded7c7"); k.box(GX - 30, GX + 30, -0.6, -0.4, -30, 30, "#cdd6c6");
  const galBody = new InstancedMesh(new CylinderGeometry(0.14, 0.14, 0.4, 10), new MeshStandardMaterial({ color: "#6fb6e0", roughness: 0.2, transparent: true, opacity: 0.85 }), GALON_N);
  const galCap = new InstancedMesh(new CylinderGeometry(0.05, 0.07, 0.08, 8), k.mat("#1f5fa0"), GALON_N);
  galBody.castShadow = galBody.receiveShadow = true;
  galBody.frustumCulled = galCap.frustumCulled = false;
  root.add(galBody, galCap);
  const galWorker = k.worker(GX + 7.3, 6.5, -0.6);
  void GALON_COLS;

  // ---------- map diorama (schematic, labelled ILUSTRASI)
  const oldCurve = curve([[MX - 3, 0.5, 4.6], [MX + 1.5, 0.5, 4.8], [MX + 5.5, 0.5, 2], [MX + 6.2, 0.5, -3], [MX + 5.5, 0.5, -7.2]]);
  const oldPts = oldCurve.getSpacedPoints(60);
  k.box(MX - 9, MX + 9, -0.4, 0, -14, 14, "#d4d9cc");
  {
    const r = rng(33);
    for (let x = MX - 8.2; x < MX + 8.4; x += 1.05)
      for (let z = -13.2; z < 13.4; z += 1.05) {
        if (z < -6.8 && z > -10.2) continue;
        if (Math.abs(x + 0.4 - (MX - 3)) < 0.8 && z > -7 && z < 6) continue;
        if (oldPts.some((q) => Math.hypot(q.x - x - 0.4, q.z - z - 0.4) < 0.9)) continue;
        const h = 0.12 + r() * 0.3;
        k.box(x, x + 0.8, 0, h, z, z + 0.8, r() < 0.5 ? "#eee7d8" : "#e2ddd2");
      }
  }
  const jagir = k.add(new Mesh(new TubeGeometry(curve([[MX - 10, 0, -7.6], [MX - 4, 0, -8.8], [MX + 2, 0, -7.4], [MX + 10, 0, -9.2]]), 60, 1.25, 8), WATER), root, false);
  jagir.scale.y = 0.12;
  k.add(new Mesh(new TubeGeometry(oldCurve, 80, 0.2, 6), k.mat("#9aa6b2")), root, false);
  const newCurve = curve([[MX - 3, 0.35, 4.0], [MX - 3, 0.35, 0], [MX - 3.2, 0.35, -4], [MX - 3.4, 0.35, -7.6]]);
  const newGeo = new TubeGeometry(newCurve, 80, 0.26, 8);
  const newPath = k.add(new Mesh(newGeo, new MeshStandardMaterial({ color: "#ffd23f", emissive: "#ffb800", emissiveIntensity: 0.6 })), root, false);
  const NEW_IDX = newGeo.index ? newGeo.index.count : 0;
  k.box(MX - 3.7, MX - 2.3, 0, 0.7, 4.9, 5.9, "#ece5d3"); k.box(MX - 3.8, MX - 2.2, 0.7, 0.82, 4.8, 6.0, "#3f6f8f");
  const mapP = k.particles(40, "#8fd3f4", 0.14);
  const oldP = k.particles(40, "#8fd3f4", 0.12);

  // pump-flow phase, integrated so slowing down never makes particles jump
  const flowPhase = (t: number) => {
    let p = 0;
    for (let x = 0; x < t; x += 1 / 30) p += (S.pumpFlow(x) * 0.35) / 30;
    return p;
  };

  const tmpM = new Matrix4(), tmpQ = new Quaternion(), tmpS = new Vector3(), tmpP = new Vector3();
  const warmSun = new Color("#ffb06a"), baseSun = new Color("#fff3df");

  return {
    root,
    update: (t, shotId, pose, scene) => {
      const I = shot(shotId);
      const lt = t - I.s;

      // scene-wide look
      const warm = shotId === "I" ? smooth(lt / 3) : 0;
      const bg = SKY.clone().lerp(SKY_WARM, warm);
      scene.background = bg;
      scene.fog = new Fog(bg, 45, 140);
      sun.color.copy(baseSun).lerp(warmSun, warm);
      sun.intensity = lerp(2.3, 2.0, warm);
      sun.position.set(pose.target[0] + 12, pose.target[1] + 22, pose.target[2] + 10);
      sun.target.position.set(...pose.target);
      sun.target.updateMatrixWorld();

      // water + gate
      river.set(S.riverLevel(t)); sea.set(S.seaLevel(t)); pond.set(S.pondLevel(t)); flood.set(S.floodLevel(t));
      gate.scale.y = 0.9;
      gate.position.y = lerp(GATE_OPEN, GATE_SHUT, S.gateClose(t)) + 0.45;
      hoist.rotation.x = S.gateClose(t) * 6;
      pipeMat.opacity = shotId === "B" || shotId === "C" ? 0.12 : 0.45;

      // backflow through the culvert
      const bf = S.backflowOn(t) ? 1 : 0;
      for (let i = 0; i < 90; i++) {
        const u = (t * 0.45 + i / 90) % 1;
        const x = lerp(5.4, 1.6, u);
        const y = -1.0 + Math.sin(i * 7.1) * 0.25 + (x < 3 ? (3 - x) * 0.25 : 0);
        setInstance(backP, i, x, y, Z1 - 0.45 + Math.sin(i * 3.3) * 0.35, bf * (i % 3 ? 0.9 : 0.6));
      }
      backP.instanceMatrix.needsUpdate = true;

      // rain
      const ra = S.rain(t);
      rain.visible = ra > 0.01;
      for (let i = 0; i < RAIN_N; i++) {
        const [x, z, o, sp] = rainSeed[i];
        tmpP.set(x, 13 - ((t * 16 * sp + o * 15) % 15), z + 2);
        tmpQ.identity(); tmpS.setScalar(i / RAIN_N < ra ? 1 : 0);
        tmpM.compose(tmpP, tmpQ, tmpS); rain.setMatrixAt(i, tmpM);
      }
      rain.instanceMatrix.needsUpdate = true;

      // pump flow through the pipe
      const pf = S.pumpFlow(t);
      const phase = pf > 0.01 ? flowPhase(t) : 0;
      pipeP.visible = pf > 0.01;
      for (let i = 0; i < 140; i++) {
        const u = (((phase + i / 140) % 1) + 1) % 1;
        let x: number, y: number, z: number;
        if (u < 0.82) { const p = pipeCurve.getPointAt(u / 0.82); x = p.x; y = p.y; z = p.z; }
        else { const q = (u - 0.82) / 0.18; const e = pipeCurve.getPointAt(1); x = e.x + q * 0.5; y = e.y - q * q * 2.6; z = e.z; }
        setInstance(pipeP, i, x + Math.sin(i * 12.9) * 0.09, y + Math.cos(i * 4.1) * 0.09, z + Math.sin(i * 5.3) * 0.09, 1);
      }
      pipeP.instanceMatrix.needsUpdate = true;

      // status lamp
      let lc = "#2fd27a";
      if (shotId === "F") lc = Math.floor(t * 3) % 2 ? "#ff9a2a" : "#7a4a1a";
      if (shotId === "H" && pf < 0.5) lc = "#ff3b30";
      if (pf < 0.01 && shotId !== "H") lc = "#9aa3ad";
      lampMat.color.set(lc); lampMat.emissive.set(lc);
      workers.forEach((w) => (w.visible = shotId === "A" || shotId === "D" || shotId === "F"));

      // trash piling up at the screen
      for (const it of trash) {
        it.m.visible = shotId === "H";
        if (!it.m.visible) continue;
        const u = clamp((lt - 0.2 - it.delay * 0.8) / 2.2);
        const xEnd = 0.9 - Math.floor(it.stack / 5) * 0.2;
        const settled = u >= 1 ? (it.stack % 5) * 0.05 + Math.floor(it.stack / 5) * 0.03 : Math.sin(t * 3 + it.stack) * 0.02;
        it.m.position.set(lerp(-6, xEnd, u), 0.36 + settled, lerp(it.z, 0.5 + (it.stack % 5) * 0.2, u));
        it.m.rotation.set(it.ry + t * (1 - u), it.ry, 0.3);
      }

      // galon wave
      const gOn = shotId === "E";
      galBody.visible = galCap.visible = galWorker.visible = gOn;
      if (gOn) {
        const gs = L(10).s + 0.4, ge = L(10).s + 4.6;
        for (let i = 0; i < GALON_N; i++) {
          const [x, z] = galonPos(GALON_N - 1 - i);
          const q = clamp((t - (gs + ((ge - gs) * i) / GALON_N)) / 0.25);
          const s = q < 1 ? smooth(q) * (1 + 0.25 * Math.sin(q * Math.PI)) : 1;
          setInstance(galBody, i, x, 0.2 * s, z, s);
          setInstance(galCap, i, x, 0.44 * s, z, s);
        }
        galBody.instanceMatrix.needsUpdate = galCap.instanceMatrix.needsUpdate = true;
      }

      // map: old long route vs new shortcut
      const mOn = shotId === "G";
      const draw = clamp((t - (L(13).s + 2.0)) / 1.6);
      newPath.visible = mOn && draw > 0;
      newGeo.setDrawRange(0, Math.floor((NEW_IDX * smooth(draw)) / 6) * 6);
      mapP.visible = oldP.visible = mOn;
      for (let i = 0; i < 40; i++) {
        const p1 = oldCurve.getPointAt((t * 0.09 + i / 40) % 1);
        setInstance(oldP, i, p1.x, p1.y + 0.15, p1.z, 0.9);
        const p2 = newCurve.getPointAt((t * 0.32 + i / 40) % 1);
        setInstance(mapP, i, p2.x, p2.y + 0.2, p2.z, draw >= 1 ? 1 : 0);
      }
      oldP.instanceMatrix.needsUpdate = mapP.instanceMatrix.needsUpdate = true;
    },
  };
};
