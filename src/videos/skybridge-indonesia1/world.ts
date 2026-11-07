import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Euler,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from "three";
import { Kit, setInstance } from "../../engine/kit";
import { clamp, rng, smooth } from "../../engine/math";
import type { Ctx, WorldApi } from "../../engine/types";
import {
  ARM, GAP, JACK_Y, JX, LOWER_BRIDGE_Y, SPAN, STROKE, TOWER_H_N, TOWER_H_S, TOWER_W, TRUSS_H, TRUSS_W, TX, Y0, Y_TOP, makeState,
} from "./state";

// ---------- helpers
const textPlane = (lines: string[], h: number, color = "#1d2328", bg?: string) => {
  const fs = 120, lh = fs * 1.15, pad = 26;
  const c = document.createElement("canvas");
  const g0 = c.getContext("2d")!;
  g0.font = `800 ${fs}px "DejaVu Sans", sans-serif`;
  c.width = Math.ceil(Math.max(...lines.map((l) => g0.measureText(l).width))) + pad * 2;
  c.height = Math.ceil(lh * lines.length + pad * 2);
  const g = c.getContext("2d")!;
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.font = `800 ${fs}px "DejaVu Sans", sans-serif`;
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  lines.forEach((l, i) => g.fillText(l, c.width / 2, pad + lh * (i + 0.5)));
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  const H = h * (c.height / (lh * lines.length));
  return new Mesh(new PlaneGeometry((H * c.width) / c.height, H), new MeshBasicMaterial({ map: tex, transparent: !bg, toneMapped: false }));
};

/** Curtain-wall texture: floors (spandrels) + mullions + a few warm-lit windows. */
const facadeTexture = (floors: number, cols: number, seed: number, glass = "#a9cbe0") => {
  const W = 512, H = 1024;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, glass);
  grad.addColorStop(1, new Color(glass).multiplyScalar(0.86).getStyle());
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const r = rng(seed);
  const fh = H / floors, cw = W / cols;
  for (let f = 0; f < floors; f++)
    for (let k = 0; k < cols; k++) {
      const v = r();
      if (v < 0.07) g.fillStyle = "rgba(255,226,170,0.55)";
      else if (v < 0.3) g.fillStyle = "rgba(255,255,255,0.10)";
      else continue;
      g.fillRect(k * cw + 3, f * fh + 6, cw - 6, fh - 12);
    }
  g.fillStyle = "rgba(220,228,232,0.9)";
  for (let f = 0; f <= floors; f++) g.fillRect(0, f * fh - 4, W, 8);
  g.fillStyle = "rgba(200,210,216,0.75)";
  for (let k = 0; k <= cols; k++) g.fillRect(k * cw - 2, 0, 4, H);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
};

/** A box member between two points. */
const member = (a: Vector3, b: Vector3, th: number, mat: Material) => {
  const len = a.distanceTo(b);
  const m = new Mesh(new BoxGeometry(th, len, th), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.lookAt(b);
  m.rotateX(Math.PI / 2);
  m.castShadow = true;
  return m;
};

/** Warren truss box: length along x (centred), height h (y from 0), width w (z centred). Members returned in build order. */
const makeTruss = (len: number, h: number, w: number, panels: number, mat: Material, th = 0.28) => {
  const g = new Group();
  const ms: Mesh[] = [];
  const x0 = -len / 2, dx = len / panels;
  const add = (m: Mesh) => {
    g.add(m);
    ms.push(m);
  };
  const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
  // bottom chords + floor beams first, then verticals/diagonals, then top chords
  for (const z of [-w / 2, w / 2]) add(member(V(x0, 0, z), V(-x0, 0, z), th * 1.3, mat));
  for (let i = 0; i <= panels; i++) add(member(V(x0 + i * dx, 0, -w / 2), V(x0 + i * dx, 0, w / 2), th, mat));
  for (let i = 0; i <= panels; i++)
    for (const z of [-w / 2, w / 2]) {
      add(member(V(x0 + i * dx, 0, z), V(x0 + i * dx, h, z), th, mat));
      if (i < panels) add(i % 2 ? member(V(x0 + i * dx, h, z), V(x0 + (i + 1) * dx, 0, z), th * 0.9, mat) : member(V(x0 + i * dx, 0, z), V(x0 + (i + 1) * dx, h, z), th * 0.9, mat));
    }
  for (const z of [-w / 2, w / 2]) add(member(V(x0, h, z), V(-x0, h, z), th * 1.3, mat));
  for (let i = 0; i <= panels; i++) add(member(V(x0 + i * dx, h, -w / 2), V(x0 + i * dx, h, w / 2), th, mat));
  return { g, ms };
};

export const createWorld = (ctx: Ctx): WorldApi => {
  const { shot } = ctx;
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);

  const hemi = new HemisphereLight("#eaf4ff", "#8a8270", 1.25);
  root.add(hemi);
  const sun = new DirectionalLight("#fff1dc", 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  root.add(sun, sun.target);

  // ================= CITY
  const city = new Group();
  root.add(city);
  const ck = new Kit(city);
  ck.box(-160, 160, -0.3, 0, -160, 160, k.mat("#b9bcb3"));
  // Jl. MH Thamrin in front (along x), sidewalks, median trees
  ck.box(-160, 160, 0, 0.05, 20, 34, "#4e5257");
  ck.box(-160, 160, 0.05, 0.08, 26.6, 27.4, "#8aa07a");
  for (let x = -158; x < 160; x += 4) {
    ck.box(x, x + 2, 0.05, 0.06, 23.2, 23.4, "#e9e4cf");
    ck.box(x, x + 2, 0.05, 0.06, 30.6, 30.8, "#e9e4cf");
  }
  ck.box(-160, 160, 0, 0.12, 17.5, 20, "#d6d1c4");
  ck.box(-160, 160, 0, 0.12, 34, 36.5, "#d6d1c4");
  for (let x = -150; x < 150; x += 7) {
    const tr = k.tree(0, 0, 1.6);
    tr.position.set(x, 0.08, 27);
    city.add(tr);
  }
  // plaza between/around the towers
  ck.box(-TX - 14, TX + 14, 0, 0.18, -16, 17.5, "#e2ddd2");
  // cars
  const CARS = 56;
  const cars = new InstancedMesh(new BoxGeometry(1.5, 0.55, 0.75), new MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }), CARS);
  cars.castShadow = true;
  const carCol = ["#f4f4f2", "#1d2328", "#b8bec4", "#c8352b", "#2f6db3", "#e2c044"];
  const carSeed = (() => {
    const r = rng(12);
    return Array.from({ length: CARS }, (_, i) => {
      cars.setColorAt(i, new Color(carCol[i % carCol.length]));
      const lane = [21.6, 25.0, 29.0, 32.4][i % 4];
      return { x: -160 + r() * 320, z: lane, v: (lane < 27 ? 1 : -1) * (7 + r() * 4) };
    });
  })();
  city.add(cars);
  // surrounding buildings (instanced), keep the view between the towers clear
  const BLD = 120;
  const bTex = facadeTexture(12, 6, 3, "#b7c3ca");
  bTex.repeat.set(1, 3);
  const blds = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ map: bTex, roughness: 0.6, metalness: 0.0 }), BLD);
  blds.castShadow = blds.receiveShadow = true;
  {
    const r = rng(44);
    const tints = ["#ffffff", "#e9e4d8", "#d9e2e8", "#f2e6d8", "#cfd6db"];
    const e = new Euler();
    let n = 0;
    while (n < BLD) {
      const x = -150 + r() * 300, z = -150 + r() * 300;
      if (z > 14 && z < 40) continue; // road
      if (Math.abs(x) < TX + 22 && z > -40) continue; // keep the towers' block and the camera side clear
      const w = 8 + r() * 12, d = 8 + r() * 12, h = 8 + Math.pow(r(), 1.6) * 60;
      const m = new Group();
      m.position.set(x, h / 2, z);
      m.scale.set(w, h, d);
      m.rotation.copy(e);
      m.updateMatrix();
      blds.setMatrixAt(n, m.matrix);
      blds.setColorAt(n, new Color(tints[n % tints.length]));
      n++;
    }
  }
  city.add(blds);

  // ================= TWIN TOWERS
  const towerMats = (h: number, seed: number) => {
    const t = facadeTexture(16, 8, seed);
    t.repeat.set(TOWER_W / 12, h / (16 * 1.4));
    const side = new MeshStandardMaterial({ map: t, roughness: 0.32, metalness: 0.12 });
    const top = k.mat("#5c6b74");
    return [side, side, top, top, side, side];
  };
  const tower = (x: number, h: number, seed: number) => {
    const g = new Group();
    const body = new Mesh(new BoxGeometry(TOWER_W, h, TOWER_W), towerMats(h, seed));
    body.position.y = h / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    // vertical fins on the corners
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) ck.box(sx * TOWER_W / 2 - 0.25, sx * TOWER_W / 2 + 0.25, 0, h + 1, sz * TOWER_W / 2 - 0.25, sz * TOWER_W / 2 + 0.25, k.mat("#d8dde0"), g);
    // crown + mast
    ck.box(-TOWER_W / 2 + 1.5, TOWER_W / 2 - 1.5, h, h + 4, -TOWER_W / 2 + 1.5, TOWER_W / 2 - 1.5, k.mat("#9fb3bf", { metalness: 0.5, roughness: 0.25 }), g);
    ck.box(-0.25, 0.25, h + 4, h + 14, -0.25, 0.25, "#d8dde0", g);
    // podium
    ck.box(-TOWER_W / 2 - 3, TOWER_W / 2 + 3, 0, 5, -TOWER_W / 2 - 3, TOWER_W / 2 + 3, k.mat("#c9c3b5"), g);
    g.position.x = x;
    city.add(g);
    return g;
  };
  tower(-TX, TOWER_H_N, 7);
  tower(TX, TOWER_H_S, 9);
  // existing lower skybridge (floors 3–5)
  const glass = new MeshStandardMaterial({ color: "#8fb3c9", roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.85 });
  ck.box(-GAP / 2, GAP / 2, LOWER_BRIDGE_Y - 3, LOWER_BRIDGE_Y, -TRUSS_W / 2, TRUSS_W / 2, glass);
  ck.box(-GAP / 2, GAP / 2, LOWER_BRIDGE_Y, LOWER_BRIDGE_Y + 0.25, -TRUSS_W / 2 - 0.2, TRUSS_W / 2 + 0.2, "#d8dde0");

  // cantilever arms at +117 m (steel, blue-grey) with a lifting beam on top at the tip
  const armMat = k.mat("#6d7f8c", { metalness: 0.4, roughness: 0.45 });
  const arms: Group[] = [];
  for (const s of [-1, 1]) {
    const { g } = makeTruss(ARM, TRUSS_H, TRUSS_W, 3, armMat, 0.3);
    g.position.set(s * (SPAN / 2 + ARM / 2), Y_TOP, 0);
    city.add(g);
    arms.push(g);
    const xa = s * (SPAN / 2 - 1.6), xb = s * (SPAN / 2 + 0.6);
    ck.box(Math.min(xa, xb), Math.max(xa, xb), Y_TOP + TRUSS_H, Y_TOP + TRUSS_H + 0.6, -TRUSS_W / 2 - 0.5, TRUSS_W / 2 + 0.5, armMat);
  }
  // final-position ghost
  const ghostMat = new MeshStandardMaterial({ color: "#e8622c", transparent: true, opacity: 0.0, depthWrite: false });
  const ghost = makeTruss(SPAN - 0.4, TRUSS_H, TRUSS_W, 6, ghostMat);
  ghost.g.position.set(0, Y_TOP, 0);
  city.add(ghost.g);

  // the lifted truss (red-oxide primer)
  const steel = k.mat("#b5482f", { roughness: 0.55, metalness: 0.25 });
  const truss = makeTruss(SPAN - 0.4, TRUSS_H, TRUSS_W, 6, steel);
  const trussG = new Group();
  trussG.add(truss.g);
  city.add(trussG);
  // lock plates (flash at the joints)
  const lockMat = new MeshStandardMaterial({ color: "#2bb673", emissive: "#2bb673", emissiveIntensity: 0 });
  const plates: Mesh[] = [];
  for (const s of [-1, 1])
    for (const z of [-TRUSS_W / 2, TRUSS_W / 2])
      for (const y of [0, TRUSS_H]) {
        const p = new Mesh(new BoxGeometry(0.5, 0.9, 0.5), lockMat);
        p.position.set(s * (SPAN / 2 - 0.1), Y_TOP + y, z);
        city.add(p);
        plates.push(p);
      }
  // workers on the lower bridge roof (scale)
  const crew = new Group();
  for (const [x, z, ry] of [[-6, 1.4, 0.3], [-2, -1.2, 2.1], [3, 1.6, -0.8], [7, -1.0, 1.4], [0.5, 0.2, 3.0]] as const) {
    const w = k.worker(x, z, ry);
    crew.add(w);
    w.scale.setScalar(1.6);
  }
  crew.position.y = LOWER_BRIDGE_Y + 0.25;
  city.add(crew);

  // 12 strand jacks (6 per side) on the lifting beams + strand bundles
  const jackMat = k.mat("#f2c230", { roughness: 0.35, metalness: 0.35 });
  const jackTop = k.mat("#2b3036");
  const jacks: Group[] = [];
  const strands: Mesh[] = [];
  const strandMat = k.mat("#30363c", { metalness: 0.6, roughness: 0.35 });
  for (const s of [-1, 1])
    for (const dx of [0.2, 0.95])
      for (const z of [-1.5, 0, 1.5]) {
        const x = s * (SPAN / 2 - 0.25 - dx);
        const j = new Group();
        const jk = new Kit(j);
        jk.add(new Mesh(new CylinderGeometry(0.32, 0.32, 1.0, 14), jackMat), j).position.y = 0.5;
        jk.add(new Mesh(new CylinderGeometry(0.36, 0.36, 0.22, 14), jackTop), j).position.y = 1.08;
        jk.add(new Mesh(new BoxGeometry(0.8, 0.12, 0.8), jackTop), j).position.y = 0.06;
        j.position.set(x, JACK_Y - 1.0, z);
        city.add(j);
        jacks.push(j);
        const st = new Mesh(new CylinderGeometry(0.07, 0.07, 1, 6), strandMat);
        st.position.set(x, 0, z);
        city.add(st);
        strands.push(st);
      }
  // height ruler on the plaza side (117 m)
  const ruler = new Group();
  {
    const rk = new Kit(ruler);
    rk.box(-0.08, 0.08, 0, Y_TOP, -0.08, 0.08, "#ffffff", ruler);
    for (let m = 0; m <= 117; m += 10) rk.box(-0.4, 0.4, m / 3 - 0.06, m / 3 + 0.06, -0.06, 0.06, "#ffffff", ruler);
    rk.box(-1.2, 1.2, Y_TOP - 0.12, Y_TOP + 0.12, -0.1, 0.1, "#e8622c", ruler);
    const lbl = textPlane(["117 m"], 1.6, "#ffffff", "#e8622c");
    lbl.position.set(0, Y_TOP + 1.6, 0.12);
    ruler.add(lbl);
  }
  ruler.position.set(0, 0, TRUSS_W / 2 + 3.5);
  city.add(ruler);

  // ================= STRAND JACK CLOSE-UP (cut-away)
  const cu = new Group();
  root.add(cu);
  const uk = new Kit(cu);
  uk.box(JX - 8, JX + 8, -0.3, 0, -6, 6, k.mat("#2a2f35"));
  uk.box(JX - 2.6, JX + 2.6, 0, 0.7, -1.6, 1.6, k.mat("#6d7f8c", { metalness: 0.4 })); // support beam
  const grip = "#2bb673", free = "#9aa3aa";
  const lowAnchor = new Group();
  uk.add(new Mesh(new CylinderGeometry(1.05, 1.05, 0.55, 28), k.mat("#3a4148", { metalness: 0.5 })), lowAnchor);
  const lowW = new MeshStandardMaterial({ color: free, emissive: grip, emissiveIntensity: 0 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const w = new Mesh(new BoxGeometry(0.22, 0.6, 0.22), lowW);
    w.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
    lowAnchor.add(w);
  }
  lowAnchor.position.set(JX, 0.98, 0);
  cu.add(lowAnchor);
  const shell = new Mesh(new CylinderGeometry(1.2, 1.2, 2.6, 32, 1, true, Math.PI * 0.05, Math.PI * 1.1), new MeshStandardMaterial({ color: "#f2c230", side: DoubleSide, metalness: 0.35, roughness: 0.35 }));
  shell.position.set(JX, 2.6, 0);
  shell.rotation.y = Math.PI * 0.9;
  cu.add(shell);
  const piston = new Mesh(new CylinderGeometry(0.85, 0.85, 2.3, 28), k.mat("#c9cfd4", { metalness: 0.8, roughness: 0.2 }));
  cu.add(piston);
  const upAnchor = new Group();
  uk.add(new Mesh(new CylinderGeometry(1.05, 1.05, 0.55, 28), k.mat("#3a4148", { metalness: 0.5 })), upAnchor);
  const upW = new MeshStandardMaterial({ color: free, emissive: grip, emissiveIntensity: 0 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const w = new Mesh(new BoxGeometry(0.22, 0.6, 0.22), upW);
    w.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
    upAnchor.add(w);
  }
  cu.add(upAnchor);
  // strands (7) with moving marks
  const SPOS: [number, number][] = [[0, 0], ...Array.from({ length: 6 }, (_, i) => [Math.cos((i / 6) * Math.PI * 2) * 0.38, Math.sin((i / 6) * Math.PI * 2) * 0.38] as [number, number])];
  for (const [x, z] of SPOS) uk.box(JX + x - 0.07, JX + x + 0.07, -2, 9, z - 0.07, z + 0.07, k.mat("#3a4046", { metalness: 0.7, roughness: 0.3 }));
  const MARKS = 7 * 16;
  const marks = new InstancedMesh(new BoxGeometry(0.17, 0.12, 0.17), new MeshStandardMaterial({ color: "#e8622c", emissive: "#e8622c", emissiveIntensity: 0.3 }), MARKS);
  marks.frustumCulled = false;
  cu.add(marks);
  const load = new Mesh(new ConeGeometry(0.6, 1.2, 16), k.mat("#e8622c"));
  load.rotation.x = Math.PI;
  load.position.set(JX, -1.0, 2.2);
  cu.add(load);

  const SKY = new Color("#cfe1ee");
  const DUSK = new Color("#f2c9a0");
  const e = new Euler();

  return {
    root,
    update: (t, shotId, pose, scene) => {
      const I = shot(shotId), lt = t - I.s;
      const close = shotId === "F";
      city.visible = !close;
      cu.visible = close;
      const d = S.dusk(t);
      const bg = close ? new Color("#1f2429") : SKY.clone().lerp(DUSK, d * 0.8);
      scene.background = bg;
      scene.fog = close ? new Fog(bg, 30, 80) : new Fog(bg, 140, 420);
      sun.color.set(new Color("#fff1dc").lerp(new Color("#ffb070"), d));
      hemi.intensity = close ? 1.6 : 1.25;
      sun.position.set(pose.target[0] + 40, pose.target[1] + 70, pose.target[2] + 50);
      sun.target.position.set(...pose.target);
      sun.target.updateMatrixWorld();
      const sc = sun.shadow.camera;
      Object.assign(sc, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 260 });
      sc.updateProjectionMatrix();

      if (!close) {
        // cars
        carSeed.forEach((c, i) => {
          const x = ((((c.x + c.v * t) % 320) + 480) % 320) - 160;
          e.set(0, c.v > 0 ? 0 : Math.PI, 0);
          setInstance(cars, i, x, 0.33, c.z, 1, e);
        });
        cars.instanceMatrix.needsUpdate = true;

        // truss build-up
        const b = S.build(t);
        const n = truss.ms.length;
        truss.ms.forEach((m, i) => {
          const s = smooth(clamp(b * n - i));
          m.visible = s > 0.001;
          m.scale.setScalar(Math.max(0.001, s));
        });
        const y = S.trussY(t);
        trussG.position.set(0, y, 0);
        trussG.rotation.z = shotId === "G" ? S.tilt(t) : 0;
        ghostMat.opacity = shotId === "B" || shotId === "C" ? 0.28 + 0.12 * Math.sin(t * 3) : 0;
        ghost.g.visible = ghostMat.opacity > 0.01;
        crew.visible = y < Y0 + 1.5;
        ruler.visible = ["B", "C", "H"].includes(shotId);

        // jacks + strands
        const jv = S.jacks(t);
        const rel = S.release(t);
        jacks.forEach((j, i) => {
          const s = smooth(clamp(jv * 12 - i * 0.6));
          j.visible = s > 0.001;
          j.scale.setScalar(Math.max(0.001, s));
        });
        strands.forEach((st, i) => {
          const s = smooth(clamp(jv * 12 - i * 0.6 - 1));
          const xi = st.position.x;
          const topY = JACK_Y - 1.0;
          const tilt = trussG.rotation.z;
          const bottom = y + TRUSS_H + Math.sin(tilt) * xi;
          const full = Math.max(0.05, topY - bottom);
          const drop = full * s * (1 - rel);
          st.visible = drop > 0.05;
          st.scale.set(1, drop, 1);
          st.position.y = rel > 0 ? topY - drop / 2 : topY - drop / 2;
        });
        // lock flash
        const lk = shotId === "I" || shotId === "J" || shotId === "K" ? S.lock(t) : 0;
        lockMat.emissiveIntensity = shotId === "I" ? lk * (0.6 + 0.4 * Math.sin(lt * 8)) : lk * 0.25;
        plates.forEach((p) => (p.visible = lk > 0.01));
      }

      if (close) {
        const c = S.cycle(t);
        const p = c % 1;
        const ext = p < 0.55 ? smooth(p / 0.55) * STROKE : p < 0.65 ? STROKE : STROKE * (1 - smooth((p - 0.65) / 0.35));
        const upGrip = p < 0.6;
        const lowGrip = p >= 0.55;
        piston.position.set(JX, 2.5 + ext, 0);
        upAnchor.position.set(JX, 3.95 + ext, 0);
        upW.color.set(upGrip ? grip : free);
        upW.emissiveIntensity = upGrip ? 0.5 : 0;
        lowW.color.set(lowGrip ? grip : free);
        lowW.emissiveIntensity = lowGrip ? 0.5 : 0;
        const off = Math.floor(c) * STROKE + (p < 0.55 ? ext : STROKE);
        let mi = 0;
        for (const [x, z] of SPOS)
          for (let q = 0; q < 16; q++) {
            const yy = -2 + ((((q * 0.7 + off) % 11.2) + 11.2) % 11.2);
            setInstance(marks, mi++, JX + x, yy, z, 1);
          }
        marks.instanceMatrix.needsUpdate = true;
        load.position.y = -1.0 + Math.sin(t * 2) * 0.05;
      }
    },
  };
};
