import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  TorusGeometry,
  Vector3,
} from "three";
import { Kit, setInstance } from "../../engine/kit";
import { lerp, rng, smooth } from "../../engine/math";
import type { Ctx, Vec3, WorldApi } from "../../engine/types";
import { BAR, CITY, CX, HH, HL, HW, MEGA_CITY, MG, RACK_H, RACK_X, RACK_Z, ROOF_Z0, makeState } from "./state";

const SKY = new Color("#dfe9ec");
const SKY_WARM = new Color("#f2d7bd");
const LED_DIM = new Color("#243b33");
const LED_ON = new Color("#4dffa0");
const LED_HOT = new Color("#ff8a2a");
const P = (x: number, y: number, z: number): Vec3 => [x, y, z];

/** Polyline helper: position at fraction u (0..1) of its length. */
const polyline = (pts: Vec3[]) => {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
    seg.push(d);
    total += d;
  }
  return (u: number): Vec3 => {
    let s = Math.min(0.9999, Math.max(0, u)) * total;
    for (let i = 0; i < seg.length; i++) {
      if (s <= seg[i]) {
        const f = s / seg[i];
        return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f), lerp(pts[i][2], pts[i + 1][2], f)];
      }
      s -= seg[i];
    }
    return pts[pts.length - 1];
  };
};

const houseField = (k: Kit, root: Group, x0: number, z0: number, nx: number, nz: number, sp: number, seed: number, scale: number) => {
  const n = nx * nz;
  const body = new InstancedMesh(new BoxGeometry(0.7, 0.45, 0.6), new MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), n);
  const roof = new InstancedMesh(new ConeGeometry(0.55, 0.35, 4), new MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), n);
  body.castShadow = roof.castShadow = true;
  body.frustumCulled = roof.frustumCulled = false;
  const r = rng(seed);
  const walls = ["#f2ece0", "#efe6d2", "#e9efe9", "#f3e4d6"];
  const roofs = ["#c4473a", "#b5523c", "#a94434"];
  const cells = Array.from({ length: n }, (_, i) => {
    const x = x0 + (i % nx) * sp + (r() - 0.5) * 0.15;
    const z = z0 + Math.floor(i / nx) * sp + (r() - 0.5) * 0.15;
    body.setColorAt(i, new Color(walls[Math.floor(r() * 4)]));
    roof.setColorAt(i, new Color(roofs[Math.floor(r() * 3)]));
    return { x, z, rank: r() };
  });
  root.add(body, roof);
  k.box(x0 - 1, x0 + nx * sp, -0.12, -0.02, z0 - 1, z0 + nz * sp, "#bcc7b0");
  return {
    /** show fraction f (0..1) of the houses; each pops in with a small scale ramp. */
    set: (f: number) => {
      cells.forEach((c, i) => {
        const s = scale * smooth((f * 1.25 - c.rank * 0.25) * 4);
        const sc = Math.max(0, Math.min(1, s));
        setInstance(body, i, c.x, 0.225 * sc * scale, c.z, sc * scale);
        setInstance(roof, i, c.x, (0.45 + 0.17) * sc * scale, c.z, sc * scale);
      });
      body.instanceMatrix.needsUpdate = roof.instanceMatrix.needsUpdate = true;
    },
  };
};

export const createWorld = (ctx: Ctx): WorldApi => {
  const { shot } = ctx;
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);

  // ---------- lights
  root.add(new HemisphereLight("#ffffff", "#7d8c6b", 1.25));
  const sun = new DirectionalLight("#fff3df", 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
  sun.shadow.bias = -0.0006;
  root.add(sun, sun.target);

  // ---------- ground
  k.box(-400, 600, -0.3, -0.1, -400, 400, "#c9cfc3");
  k.box(-16, 16, -0.1, 0, -24, 12, "#b7b3a8"); // campus pad
  k.box(-4, 4, -0.1, 0.01, 0, 40, "#55585c"); // access road

  // ---------- data hall (cut-away): floor, back wall, side walls, roof shelf
  k.box(-HW, HW, -0.1, 0.15, -HL, 0, "#d9d6cc"); // floor
  k.box(-HW, HW, 0.15, HH, -HL - 0.3, -HL, "#c3cdd3"); // back wall
  k.box(-HW - 0.3, -HW, 0, HH, -HL, 0, "#dfe4e6"); // left wall
  k.box(HW, HW + 0.3, 0, HH, -HL, 0, "#dfe4e6"); // right wall
  k.box(-HW - 0.3, HW + 0.3, HH, HH + 0.3, -HL - 0.3, ROOF_Z0, "#cfd6da"); // roof shelf
  k.box(-HW - 0.3, HW + 0.3, HH, HH + 0.15, ROOF_Z0, ROOF_Z0 + 0.0, "#cfd6da");
  k.box(-0.8, 0.8, 0.15, 0.17, -HL, 0, "#aeb8c0"); // aisle floor strip
  for (const x of [-HW - 0.3, HW + 0.3]) k.box(x - 0.05, x + 0.05, HH, HH + 0.3, ROOF_Z0, 0, "#cfd6da"); // wall caps

  // ---------- racks
  const rackMat = k.mat("#2b3340", { roughness: 0.55, metalness: 0.2 });
  const rackSpots: { x: number; z: number; side: number }[] = [];
  for (const side of [-1, 1]) for (const z of RACK_Z) rackSpots.push({ x: side * RACK_X, z, side });
  for (const r of rackSpots) {
    k.box(r.x - 0.6, r.x + 0.6, 0.15, 0.15 + RACK_H, r.z - 0.55, r.z + 0.55, rackMat);
    k.box(r.x - 0.1, r.x + 0.1, 0.15 + RACK_H, 4.2, r.z - 0.04, r.z + 0.04, "#e8b23a"); // power drop
  }
  // blinking LED strips on the aisle-facing side
  const LEDS_PER = 6;
  const ledCount = rackSpots.length * LEDS_PER;
  const led = new InstancedMesh(new BoxGeometry(0.04, 0.12, 0.8), new MeshBasicMaterial({ toneMapped: false }), ledCount);
  led.frustumCulled = false;
  const ledSeed = (() => { const r = rng(5); return Array.from({ length: ledCount }, () => ({ f: 2 + r() * 5, p: r() * 6.28 })); })();
  rackSpots.forEach((r, ri) => {
    for (let j = 0; j < LEDS_PER; j++) setInstance(led, ri * LEDS_PER + j, r.x - r.side * 0.62, 0.7 + j * 0.42, r.z, 1);
  });
  for (let i = 0; i < ledCount; i++) led.setColorAt(i, LED_DIM);
  root.add(led);
  // ceiling busbars + ties
  const BUS = k.mat("#e8b23a", { roughness: 0.4, metalness: 0.4 });
  for (const x of [-RACK_X, RACK_X]) k.box(x - 0.1, x + 0.1, 4.15, 4.25, -HL + 0.4, -0.8, BUS);
  k.box(-HW, -RACK_X, 4.15, 4.25, -6.1, -5.9, BUS); // left feed into the left busbar
  k.box(-HW - 0.1, HW + 0.1, 4.55, 4.65, -7.1, -6.9, BUS); // tie across the hall to the right busbar
  k.box(RACK_X - 0.1, RACK_X + 0.1, 4.15, 4.65, -7.1, -6.9, BUS);
  k.box(RACK_X, HW + 0.4, 4.05, 4.15, -8.1, -7.9, BUS); // generator feed

  // heat haze above the racks
  const hazeMat = new MeshBasicMaterial({ color: "#ff7a2a", transparent: true, opacity: 0, depthWrite: false });
  const haze = new InstancedMesh(new BoxGeometry(1.2, 1.3, 1.1), hazeMat, rackSpots.length);
  haze.frustumCulled = false;
  rackSpots.forEach((r, i) => setInstance(haze, i, r.x, 3.15 + 0.65, r.z, 1));
  root.add(haze);

  // ---------- substation (left) + generators (right), outside the cut hall
  const GREY = k.mat("#8e99a3", { roughness: 0.5, metalness: 0.3 });
  const trafos = [-6, -9];
  for (const z of trafos) {
    k.box(-12.6, -10.8, 0, 1.8, z - 0.8, z + 0.8, GREY);
    for (const dz of [-0.45, 0, 0.45]) {
      const b = k.add(new Mesh(new CylinderGeometry(0.1, 0.12, 0.7, 8), k.mat("#e8e2d2")));
      b.position.set(-11.7, 2.15, z + dz);
    }
    k.box(-11.8, -11.6, 2.5, 3.6 + (z === -6 ? -0.1 : 1.0), z - 0.03, z + 0.03, "#3c444c");
  }
  k.box(-11.8, -HW, 3.5, 3.56, -6.03, -5.97, "#3c444c"); // line 1 into the left wall
  k.box(-11.8, -HW, 4.6, 4.66, -9.03, -8.97, "#3c444c"); // line 2 along the left wall top…
  k.box(-HW - 0.1, -HW + 0.05, 4.6, 4.66, -9.0, -7.0, "#3c444c");
  for (const z of [-5, -7, -10, -12]) { // pylon posts
    k.box(-14.2, -14.05, 0, 3.6, z - 0.05, z + 0.05, "#5d646b");
  }
  const genMat = k.mat("#c8352b", { roughness: 0.5, metalness: 0.3 });
  for (const z of [-5, -10]) {
    k.box(HW + 0.6, HW + 3.2, 0, 1.6, z - 1.1, z + 1.1, genMat);
    k.box(HW + 2.7, HW + 2.9, 1.6, 2.8, z - 0.12, z + 0.12, "#3c444c"); // exhaust
  }
  k.box(HW + 0.4, HW + 0.9, 4.05, 4.15, -8.1, -7.9, "#3c444c");
  k.box(HW + 0.8, HW + 0.9, 1.6, 4.1, -8.1, -7.9, "#3c444c");
  const genLamp = new Mesh(new BoxGeometry(0.3, 0.3, 0.3), new MeshBasicMaterial({ color: "#3b3f44" }));
  genLamp.position.set(HW + 1.9, 1.9, -5); root.add(genLamp);
  const genLamp2 = genLamp.clone(); genLamp2.position.set(HW + 1.9, 1.9, -10); root.add(genLamp2);

  // ---------- chillers + fans on the roof shelf
  const fans: Group[] = [];
  const chillerSpots: Vec3[] = [P(-3.4, HH + 0.3, -12), P(3.4, HH + 0.3, -12), P(-3.4, HH + 0.3, -15.6), P(3.4, HH + 0.3, -15.6)];
  for (const c of chillerSpots) {
    k.box(c[0] - 1.7, c[0] + 1.7, c[1], c[1] + 1.5, c[2] - 1.4, c[2] + 1.4, "#e6ebee");
    const fan = new Group(); fan.position.set(c[0], c[1] + 1.55, c[2]); root.add(fan);
    const ring = k.add(new Mesh(new TorusGeometry(1.0, 0.07, 6, 24), k.mat("#5d646b")), fan); ring.rotation.x = Math.PI / 2;
    for (let b = 0; b < 3; b++) {
      const bl = k.add(new Mesh(new BoxGeometry(1.8, 0.04, 0.3), k.mat("#3c444c")), fan); bl.rotation.y = (b * Math.PI) / 3 * 2 + 0.3;
    }
    fans.push(fan);
  }

  // ---------- air + power particles
  const hot = k.particles(120, "#ff7a2a", 0.13);
  const cold = k.particles(70, "#59b8ff", 0.12);
  const pwr = k.particles(90, "#ffd23a", 0.12);
  const hotPaths = rackSpots.map((r) => polyline([P(r.x, 3.2, r.z), P(r.x + r.side * 1.1, 4.5, r.z), P(r.side * 3.4, 4.6, -11.5), P(r.side * 3.4, HH + 3.4, -13.6)]));
  const coldPath = polyline([P(0, 4.6, -HL + 0.6), P(0, 0.6, -HL + 0.6), P(0, 0.6, -1.2)]);
  const pwrPaths = [
    polyline([P(-11.7, 2.5, -6), P(-11.7, 3.53, -6), P(-RACK_X, 3.53, -6), P(-RACK_X, 4.2, -6), P(-RACK_X, 4.2, -1.6)]),
    polyline([P(-11.7, 2.5, -9), P(-11.7, 4.63, -9), P(-HW - 0.05, 4.63, -9), P(-HW - 0.05, 4.63, -7), P(RACK_X, 4.6, -7), P(RACK_X, 4.2, -7), P(RACK_X, 4.2, -1.6)]),
    polyline([P(HW + 0.85, 1.6, -8), P(HW + 0.85, 4.1, -8), P(RACK_X, 4.1, -8), P(RACK_X, 4.2, -8), P(RACK_X, 4.2, -14)]),
  ];

  // ---------- big chip (shots C / E): hovers in the aisle
  const chip = new Group(); chip.position.set(0, 2.3, -4.2); root.add(chip);
  k.add(new Mesh(new BoxGeometry(1.7, 0.14, 1.7), k.mat("#1f6b4a", { roughness: 0.5 })), chip);
  k.add(new Mesh(new BoxGeometry(1.1, 0.12, 1.1), k.mat("#2b3340", { metalness: 0.5, roughness: 0.3 })), chip).position.y = 0.12;
  const dieMat = new MeshStandardMaterial({ color: "#8fe6b6", emissive: "#4dffa0", emissiveIntensity: 0.8, roughness: 0.3 });
  k.add(new Mesh(new BoxGeometry(0.55, 0.06, 0.55), dieMat), chip).position.y = 0.21;
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) {
    k.add(new Mesh(new BoxGeometry(0.12, 0.05, 0.1), k.mat("#e8b23a", { metalness: 0.6 })), chip).position.set(-0.7 + i * 0.2, -0.05, s * 0.88);
    k.add(new Mesh(new BoxGeometry(0.1, 0.05, 0.12), k.mat("#e8b23a", { metalness: 0.6 })), chip).position.set(s * 0.88, -0.05, -0.7 + i * 0.2);
  }

  // ---------- stoves (shot F, line 8)
  const stoves: Group[] = [];
  const coilMat = new MeshStandardMaterial({ color: "#ff3b1f", emissive: "#ff3b1f", emissiveIntensity: 1.2 });
  for (let i = 0; i < 5; i++) {
    const g = new Group(); g.position.set(-3.4 + i * 1.7, 0, 3.4); root.add(g); stoves.push(g);
    k.add(new Mesh(new BoxGeometry(1.5, 0.7, 1.5), k.mat("#d9dde0", { roughness: 0.4, metalness: 0.3 })), g).position.y = 0.35;
    const coil = new Mesh(new TorusGeometry(0.5, 0.07, 6, 20), coilMat); coil.rotation.x = Math.PI / 2; coil.position.y = 0.75; g.add(coil);
    const coil2 = new Mesh(new TorusGeometry(0.25, 0.06, 6, 16), coilMat); coil2.rotation.x = Math.PI / 2; coil2.position.y = 0.75; g.add(coil2);
  }

  // ---------- city (symbolic) + big city
  const city = houseField(k, root, CITY.x, CITY.z, CITY.n, CITY.n, CITY.sp, 3, 1);
  const megaCity = houseField(k, root, MEGA_CITY.x, MEGA_CITY.z, MEGA_CITY.nx, MEGA_CITY.nz, MEGA_CITY.sp, 9, 0.85);
  for (let i = 0; i < 14; i++) k.tree(CITY.x - 2 + (i % 2) * 26.5, CITY.z + i * 1.8, 0.8);

  // ---------- bar chart
  k.box(CX - 8, CX + 8, -0.3, 0, -4, 4, "#d9d6cc");
  const bar24 = new Mesh(new BoxGeometry(1, 1, 1), k.mat("#3a8fd5", { roughness: 0.5 })); bar24.castShadow = true; root.add(bar24);
  const bar30 = new Mesh(new BoxGeometry(1, 1, 1), k.mat("#e8622c", { roughness: 0.5 })); bar30.castShadow = true; root.add(bar30);
  const japan = new Group(); root.add(japan);
  for (let i = 0; i < 12; i++) k.box(CX - 7.2 + i * 1.2, CX - 6.5 + i * 1.2, BAR.japan - 0.04, BAR.japan + 0.04, -0.02, 0.02, "#1d2328", japan);
  k.box(CX - 7.4, CX - 7.3, 0, BAR.japan, -0.03, 0.03, "#1d2328", japan);

  // ---------- mega campus: 20 halls
  const megaHalls = new InstancedMesh(new BoxGeometry(6, 3, 4), new MeshStandardMaterial({ flatShading: true, roughness: 0.7 }), MG.cols * MG.rows);
  const megaRoof = new InstancedMesh(new BoxGeometry(5, 0.7, 1.4), new MeshStandardMaterial({ color: "#e6ebee", flatShading: true }), MG.cols * MG.rows);
  megaHalls.castShadow = megaRoof.castShadow = true; megaHalls.frustumCulled = megaRoof.frustumCulled = false;
  const hallPos = Array.from({ length: MG.cols * MG.rows }, (_, i) => ({ x: MG.x + 4 + (i % MG.cols) * 8, z: -3 - Math.floor(i / MG.cols) * 6.2, rank: i === 0 ? 0 : 0.15 + (i / 20) * 0.85 }));
  hallPos.forEach((h, i) => megaHalls.setColorAt(i, new Color(i === 0 ? "#e8622c" : "#c3cdd3")));
  root.add(megaHalls, megaRoof);
  k.box(MG.x - 2, MG.x + 44, -0.1, 0, -29, 2, "#b7b3a8");

  const tmpV = new Vector3();
  return {
    root,
    update: (t, shotId, pose, scene) => {
      const I = shot(shotId), lt = t - I.s;
      const warm = shotId === "J" ? smooth(lt / 3) : 0;
      const bg = SKY.clone().lerp(SKY_WARM, warm);
      scene.background = bg; scene.fog = new Fog(bg, 120, 420);
      sun.color.set("#fff3df").lerp(new Color("#ffb06a"), warm);
      sun.position.set(pose.target[0] + 10, pose.target[1] + 24, pose.target[2] + 16);
      sun.target.position.set(...pose.target); sun.target.updateMatrixWorld();

      const load = S.load(t), heat = S.heat(t), cooling = S.cooling(t), power = S.power(t);

      // LEDs: blink with the load, drift from green to orange as the heat builds
      for (let i = 0; i < ledCount; i++) {
        const sd = ledSeed[i];
        const on = 0.5 + 0.5 * Math.sin(t * sd.f * (0.6 + load) + sd.p);
        const v = 0.25 + 0.75 * on * load;
        const c = tmpColor.copy(LED_DIM).lerp(LED_ON, v).lerp(LED_HOT, heat * (0.35 + 0.65 * v));
        led.setColorAt(i, c);
      }
      if (led.instanceColor) led.instanceColor.needsUpdate = true;
      hazeMat.opacity = 0.32 * heat * (1 - 0.45 * cooling);
      haze.visible = hazeMat.opacity > 0.01;

      // fans
      fans.forEach((f, i) => { f.rotation.y = t * (1.5 + 9 * cooling) * (i % 2 ? 1 : -1); });

      // chip
      const showChip = shotId === "C" || shotId === "E";
      chip.visible = showChip;
      chip.rotation.y = t * 0.8; chip.rotation.x = 0.35;
      chip.scale.setScalar(0.001 + S.chipPop(t) * (shotId === "E" ? 0.9 : 1.1));
      dieMat.emissive.set("#4dffa0").lerp(LED_HOT, heat); dieMat.emissiveIntensity = 0.5 + 0.8 * load;

      // power pulses
      const showPwr = power > 0.01 && shotId !== "A" && shotId !== "B" && shotId !== "I" && shotId !== "G" && shotId !== "H";
      pwr.visible = showPwr;
      if (showPwr) {
        const gen = S.gen(t);
        for (let i = 0; i < 90; i++) {
          const path = i < 30 ? 0 : i < 60 ? 1 : 2;
          const alive = path === 2 ? gen : power;
          const u = (t * 0.22 + (i % 30) / 30) % 1;
          const [x, y, z] = pwrPaths[path](u);
          setInstance(pwr, i, x, y, z, alive > 0.01 ? 0.8 + 0.2 * Math.sin(u * 20) : 0);
        }
        pwr.instanceMatrix.needsUpdate = true;
      }
      const gl = S.gen(t) > 0.5;
      (genLamp.material as MeshBasicMaterial).color.set(gl ? "#58e07a" : "#3b3f44");
      (genLamp2.material as MeshBasicMaterial).color.set(gl ? "#58e07a" : "#3b3f44");

      // hot air rising (and, once the chillers run, being carried out through the roof)
      const showAir = (shotId === "E" || shotId === "F" || shotId === "J") && heat > 0.02;
      hot.visible = showAir;
      cold.visible = showAir && cooling > 0.02;
      if (showAir) {
        for (let i = 0; i < 120; i++) {
          const ri = i % rackSpots.length;
          let u = (t * 0.2 + Math.floor(i / rackSpots.length) / 6 + (ri % 5) * 0.037) % 1;
          if (cooling < 0.01) u *= 0.38; else u = u * (0.38 + 0.62 * cooling);
          const [x, y, z] = hotPaths[ri](u);
          const fade = u > 0.92 ? 1 - (u - 0.92) / 0.08 : 1;
          setInstance(hot, i, x, y, z, heat * fade);
        }
        hot.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < 70; i++) {
          const u = (t * 0.18 + i / 70) % 1;
          const [x, y, z] = coldPath(u);
          setInstance(cold, i, x + ((i % 7) - 3) * 0.17, y, z, cooling * (u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1));
        }
        cold.instanceMatrix.needsUpdate = true;
      }

      // stoves
      const sv = S.stove(t);
      stoves.forEach((g, i) => { g.visible = shotId === "F" && sv > 0.01; g.scale.setScalar(Math.max(0.001, smooth(sv * 1.6 - i * 0.12))); });
      coilMat.emissiveIntensity = 0.9 + 0.5 * Math.sin(t * 5);

      // cities
      city.set(shotId === "A" ? S.houses1(t) : 1);
      megaCity.set(shotId === "I" ? S.megaCity(t) : shotId === "J" ? 0 : 0);

      // bar chart
      const b24 = S.bar24(t) * BAR.h24, b30 = S.bar30(t) * BAR.h30;
      bar24.scale.set(3, Math.max(0.001, b24), 3); bar24.position.set(CX - 3, b24 / 2, 0);
      bar30.visible = b30 > 0.02; bar30.scale.set(3, Math.max(0.001, b30), 3); bar30.position.set(CX + 3, b30 / 2, 0);
      japan.visible = S.japan(t) > 0.01 && shotId === "H";
      japan.position.y = 0; japan.scale.y = 1;

      // mega campus
      const mg = S.mega(t);
      hallPos.forEach((h, i) => {
        const s = shotId === "I" ? (i === 0 ? 1 : smooth(mg * 1.8 - h.rank * 0.8)) : 0;
        const sc = Math.max(0.001, Math.min(1, s));
        tmpV.set(h.x, 1.5 * sc, h.z);
        setInstance(megaHalls, i, tmpV.x, tmpV.y, tmpV.z, sc);
        setInstance(megaRoof, i, h.x, (3 + 0.35) * sc, h.z, sc);
      });
      megaHalls.instanceMatrix.needsUpdate = megaRoof.instanceMatrix.needsUpdate = true;
    },
  };
};

const tmpColor = new Color();
