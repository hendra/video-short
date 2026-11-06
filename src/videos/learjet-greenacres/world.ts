import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
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
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  Shape,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { Kit, setInstance } from "../../engine/kit";
import { clamp, rng, smooth } from "../../engine/math";
import type { Ctx, WorldApi } from "../../engine/types";
import { ALT0, ALT1, ALT_REQ, ALT_X, AUSTIN, CHART, ELEUTHERA, GX, JET, KM, SITE, geo, makeState, profile } from "./state";

const MK_ISL = 2;
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Flat polygon in the x–z plane (points [x, z]), extruded `h` upwards from y = 0. */
const slabXZ = (pts: [number, number][], h: number) => {
  const s = new Shape();
  pts.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  g.rotateX(Math.PI / 2); // shape y -> world z, depth -> -y
  g.translate(0, h, 0);
  return g;
};

/** Flat polygon in the x–y plane (points [x, y]), `d` thick, centred on z = 0. */
const slabXY = (pts: [number, number][], d: number) => {
  const s = new Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
};

const mirrorZ = (pts: [number, number][]) => pts.map(([x, z]) => [x, -z] as [number, number]).reverse();

/** Low-poly Learjet 60: nose +x, right wing +z, length ≈ 6.2. Returns parts that animate. */
const makeJet = (k: Kit) => {
  const g = new Group();
  const white = k.mat("#f3f4f2", { roughness: 0.55 });
  const grey = k.mat("#a9b1b8", { roughness: 0.5 });
  const stripe = k.mat("#2f5d8a", { roughness: 0.6 });
  const glass = k.mat("#26313b", { roughness: 0.25 });
  const body = k.add(new Mesh(new CylinderGeometry(0.4, 0.4, 4.2, 18), white), g);
  body.rotation.z = Math.PI / 2;
  body.position.x = 0.1;
  const nose = k.add(new Mesh(new ConeGeometry(0.4, 1.1, 18), white), g);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 2.75;
  nose.scale.set(1, 1, 0.92);
  const tail = k.add(new Mesh(new CylinderGeometry(0.4, 0.12, 1.4, 18), white), g);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-2.7, 0.12, 0);
  // cheatline + windows + windshield
  k.add(new Mesh(new CylinderGeometry(0.405, 0.405, 4.0, 18, 1, true, Math.PI * 0.42, Math.PI * 0.16), stripe), g).rotation.z = Math.PI / 2;
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) k.box(-0.9 + i * 0.42, -0.72 + i * 0.42, 0.08, 0.24, s * 0.395 - 0.012, s * 0.395 + 0.012, glass, g);
  const ws = k.add(new Mesh(new BoxGeometry(0.42, 0.18, 0.7), glass), g);
  ws.position.set(2.18, 0.26, 0);
  ws.rotation.z = -0.55;
  // wings (low, swept) + winglets
  const wingR: [number, number][] = [[0.75, 0.3], [-0.55, 3.45], [-1.1, 3.45], [-1.0, 0.3]];
  for (const pts of [wingR, mirrorZ(wingR)]) {
    const w = k.add(new Mesh(slabXZ(pts, 0.08), white), g);
    w.position.y = -0.3;
  }
  for (const s of [-1, 1]) {
    const wl = k.add(new Mesh(slabXY([[-0.5, 0], [-1.1, 0], [-1.15, 0.45], [-0.85, 0.45]], 0.05), white), g);
    wl.position.set(0, -0.24, s * 3.45);
  }
  // ice on the leading edges (grows)
  const iceMat = new MeshStandardMaterial({ color: "#e9f6ff", emissive: "#bfe6ff", emissiveIntensity: 0.35, roughness: 0.2, transparent: true, opacity: 0 });
  const iceR: [number, number][] = [[0.8, 0.3], [-0.5, 3.45], [-0.62, 3.45], [0.66, 0.3]];
  for (const pts of [iceR, mirrorZ(iceR)]) {
    const m = new Mesh(slabXZ(pts, 0.11), iceMat);
    m.position.y = -0.315;
    g.add(m);
  }
  // engines (rear-mounted) + pylons
  for (const s of [-1, 1]) {
    const n = k.add(new Mesh(new CylinderGeometry(0.27, 0.24, 1.25, 14), grey), g);
    n.rotation.z = Math.PI / 2;
    n.position.set(-1.65, 0.38, s * 0.78);
    k.add(new Mesh(new CylinderGeometry(0.2, 0.2, 0.02, 14), k.mat("#30363c")), g).position.set(-1.02, 0.38, s * 0.78);
    k.box(-2.0, -1.4, 0.32, 0.42, s * 0.35, s * 0.55, grey, g);
  }
  // T-tail: fin + horizontal stabiliser + elevators
  k.add(new Mesh(slabXY([[-2.05, 0.3], [-3.1, 0.3], [-3.25, 1.6], [-2.75, 1.6]], 0.09), white), g);
  k.add(new Mesh(slabXY([[-2.7, 1.25], [-3.25, 1.25], [-3.3, 1.6], [-2.95, 1.6]], 0.1), stripe), g);
  const stab: [number, number][] = [[-2.65, 0.05], [-3.0, 1.4], [-3.24, 1.4], [-3.12, 0.05]];
  const elev: [number, number][] = [[-3.12, 0.05], [-3.24, 1.4], [-3.44, 1.4], [-3.34, 0.05]];
  for (const pts of [stab, mirrorZ(stab)]) k.add(new Mesh(slabXZ(pts, 0.07), white), g).position.y = 1.56;
  const elevR = k.add(new Mesh(slabXZ(elev, 0.06), white), g);
  elevR.position.y = 1.565;
  const elevLMat = new MeshStandardMaterial({ color: "#f3f4f2", roughness: 0.55, flatShading: true, emissive: "#e8622c", emissiveIntensity: 0 });
  const elevL = k.add(new Mesh(slabXZ(mirrorZ(elev), 0.06), elevLMat), g);
  elevL.position.y = 1.565;
  return { g, iceMat, elevL, elevLMat };
};

export const createWorld = (ctx: Ctx): WorldApi => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);

  // ---------- lights
  const hemi = new HemisphereLight("#ffffff", "#7d8c6b", 1.25);
  root.add(hemi);
  const sun = new DirectionalLight("#fff3df", 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
  sun.shadow.bias = -0.0006;
  root.add(sun, sun.target);

  // ================= MAP (Gulf of Mexico → Florida → Bahamas) — schematic
  const map = new Group();
  root.add(map);
  const mk = new Kit(map);
  mk.box(-90, 100, -0.3, 0, -70, 70, k.mat("#9cc9d9", { roughness: 0.7 }));
  const coast: [number, number][] = [
    [19.2, -96.1], [21.2, -97.4], [24, -97.7], [25.9, -97.2], [27.8, -97.3], [28.8, -95.6], [29.4, -94.7], [29.6, -93.3], [29.5, -91.8], [29.1, -90.2], [29.0, -89.2],
    [30.2, -89.6], [30.4, -88.1], [30.3, -86.6], [29.7, -85.3], [30.0, -84.3], [29.2, -83.1], [28.1, -82.8], [27.6, -82.6], [26.6, -82.2], [26.0, -81.7], [25.2, -81.1],
    [25.15, -80.4], [25.8, -80.15], [26.7, -80.03], [27.5, -80.3], [28.5, -80.6], [29.9, -81.3], [31.0, -81.4], [32.1, -80.8], [33.0, -79.3], [34.5, -77.5],
    [40, -72], [48, -72], [48, -125], [14, -125], [16, -96], [19, -96],
  ];
  const land = mk.add(new Mesh(slabXZ(coast.map(([la, lo]) => [geo(la, lo)[0], geo(la, lo)[2]] as [number, number]), 0.35), k.mat("#e7dfc9")), map);
  land.receiveShadow = true;
  const cuba: [number, number][] = [[21.9, -84.9], [22.9, -83.0], [23.1, -81.0], [22.4, -78.5], [21.3, -76.0], [20.2, -74.2], [19.9, -75.5], [20.6, -77.5], [21.6, -80.5], [22.0, -82.6]];
  mk.add(new Mesh(slabXZ(cuba.map(([la, lo]) => [geo(la, lo)[0], geo(la, lo)[2]] as [number, number]), 0.3), k.mat("#e2d9c2")), map);
  for (const [la, lo, rx, rz, ry] of [[26.6, -78.4, 1.1, 0.3, 0.2], [26.4, -77.1, 0.35, 1.0, 0.3], [25.3, -76.3, 0.25, 1.3, -0.4], [24.3, -77.9, 0.8, 1.2, 0.1], [24.0, -75.9, 0.2, 0.7, 0]]) {
    const p = geo(la, lo);
    const isl = mk.add(new Mesh(new CylinderGeometry(1, 1, 0.25, 12), k.mat("#e2d9c2")), map);
    isl.scale.set(rx * MK_ISL, 1, rz * MK_ISL);
    isl.rotation.y = ry;
    isl.position.set(p[0], 0.12, p[2]);
  }
  // state borders (very faint) for orientation
  for (const [a, b] of [[[31.0, -94.0], [33.0, -94.0]], [[31.0, -88.4], [35.0, -88.4]], [[31.0, -85.0], [35, -85.0]], [[30.7, -87.6], [31.0, -85.0]]] as [number, number][][]) {
    const A = geo(a[0], a[1], 0.36), B = geo(b[0], b[1], 0.36);
    const len = Math.hypot(B[0] - A[0], B[2] - A[2]);
    const m = mk.add(new Mesh(new BoxGeometry(len, 0.02, 0.06), k.mat("#cfc5ad")), map, false);
    m.position.set((A[0] + B[0]) / 2, 0.36, (A[2] + B[2]) / 2);
    m.rotation.y = -Math.atan2(B[2] - A[2], B[0] - A[0]);
  }
  // pins
  const pin = (p: [number, number, number], color: string) => {
    const g = new Group();
    g.position.set(p[0], 0.35, p[2]);
    mk.add(new Mesh(new CylinderGeometry(0.05, 0.05, 1.4, 8), k.mat("#1d2328")), g).position.y = 0.7;
    mk.add(new Mesh(new SphereGeometry(0.3, 14, 10), k.mat(color, { roughness: 0.4 })), g).position.y = 1.5;
    mk.add(new Mesh(new CylinderGeometry(0.35, 0.35, 0.04, 20), k.mat(color)), g).position.y = 0.02;
    map.add(g);
    return g;
  };
  pin(AUSTIN, "#1f9e6e");
  const sitePin = pin(SITE, "#c8352b");
  const destPin = pin(ELEUTHERA, "#8a96a0");
  // route: Austin → Greenacres (flown), then dashed to the Bahamas (planned)
  const routeCurve = new CatmullRomCurve3([V(AUSTIN[0], 0.5, AUSTIN[2]), V(-4, 3.2, -4.5), V(10, 3.4, -2), V(SITE[0], 0.6, SITE[2])]);
  const routeGeo = new TubeGeometry(routeCurve, 160, 0.14, 8, false);
  const routeMat = new MeshStandardMaterial({ color: "#e8622c", emissive: "#e8622c", emissiveIntensity: 0.35, roughness: 0.5 });
  const route = new Mesh(routeGeo, routeMat);
  route.castShadow = true;
  map.add(route);
  const dashCurve = new CatmullRomCurve3([V(SITE[0], 0.6, SITE[2]), V((SITE[0] + ELEUTHERA[0]) / 2, 1.6, (SITE[2] + ELEUTHERA[2]) / 2), V(ELEUTHERA[0], 0.6, ELEUTHERA[2])]);
  const dashes = new Group();
  for (let i = 0; i < 9; i++) {
    const a = dashCurve.getPoint(i / 9), b = dashCurve.getPoint((i + 0.5) / 9);
    const d = new Mesh(new CylinderGeometry(0.08, 0.08, a.distanceTo(b), 6), k.mat("#8a96a0"));
    d.position.copy(a).add(b).multiplyScalar(0.5);
    d.lookAt(b);
    d.rotateX(Math.PI / 2);
    dashes.add(d);
  }
  map.add(dashes);
  const mini = makeJet(new Kit(new Group()));
  const miniJet = mini.g;
  miniJet.scale.setScalar(0.32);
  map.add(miniJet);

  // ================= SKY (jet in cloud, ice, turbulence, upset)
  const sky = new Group();
  root.add(sky);
  const jet = makeJet(new Kit(sky));
  const jetPitch = new Group();
  const jetRoll = new Group();
  jetPitch.position.set(...JET);
  jetPitch.add(jetRoll);
  jetRoll.add(jet.g);
  sky.add(jetPitch);
  const CLOUDS = 220;
  const cloud = new InstancedMesh(new IcosahedronGeometry(1, 1), new MeshStandardMaterial({ color: "#e4e8ec", roughness: 1, flatShading: true, transparent: true, opacity: 0.92 }), CLOUDS);
  cloud.frustumCulled = false;
  sky.add(cloud);
  const cloudSeed = (() => {
    const r = rng(31);
    return Array.from({ length: CLOUDS }, () => {
      // keep a clear tunnel around the jet and the camera side (+z)
      let x = 0, y = 0, z = 0;
      do {
        x = -60 + r() * 120;
        y = -30 + r() * 60;
        z = -50 + r() * 62;
      } while (Math.abs(y) < 5 && z > -9 && Math.abs(x) < 16);
      return { x, y, z, s: 2.2 + r() * 4.5 };
    });
  })();
  const RAIN = 260;
  const rain = new InstancedMesh(new BoxGeometry(0.9, 0.025, 0.025), new MeshStandardMaterial({ color: "#c9d6e0", transparent: true, opacity: 0.7 }), RAIN);
  rain.frustumCulled = false;
  sky.add(rain);
  const rainSeed = (() => {
    const r = rng(9);
    return Array.from({ length: RAIN }, () => ({ x: r() * 40, y: r() * 24, z: -10 + r() * 18, sp: 0.8 + r() * 0.4 }));
  })();
  // cockpit voice recorder (shot K)
  const cvr = new Group();
  {
    const orange = k.mat("#f06a1d", { roughness: 0.45 });
    const ck = new Kit(cvr);
    ck.add(new Mesh(new BoxGeometry(1.6, 0.9, 0.9), orange), cvr);
    ck.add(new Mesh(new CylinderGeometry(0.42, 0.42, 1.0, 18), orange), cvr).position.set(0.95, 0, 0);
    cvr.children[1].rotation.z = Math.PI / 2;
    for (const x of [-0.5, 0, 0.5]) ck.box(x - 0.08, x + 0.08, -0.46, 0.46, -0.455, 0.455, "#f4f1ea", cvr);
    ck.box(-0.9, 0.5, -0.5, -0.42, -0.5, 0.5, "#2b3036", cvr);
  }
  sky.add(cvr);

  // ================= ALTITUDE CHART (1 unit = 1 km)
  const chart = new Group();
  root.add(chart);
  const ck = new Kit(chart);
  ck.box(ALT_X - 8, ALT_X + 8, -0.3, 0, -2, 2, k.mat("#cfd8c4"));
  ck.box(ALT_X - 8, ALT_X + 8, -0.02, 0.03, -2, -1.4, "#8aa07a");
  const axisX = CHART.x0 - 0.6;
  ck.box(axisX - 0.06, axisX + 0.06, 0, 12.2, -0.06, 0.06, "#1d2328");
  for (let km = 0; km <= 12; km++) ck.box(axisX - (km % 2 ? 0.18 : 0.38), axisX, km - 0.035, km + 0.035, -0.05, 0.05, "#1d2328");
  for (let km = 2; km <= 12; km += 2) ck.box(axisX, CHART.x0 + 7.5, km - 0.012, km + 0.012, -0.6, -0.58, "#b9c3ca");
  // requested level (dashed)
  for (let x = CHART.x0; x < CHART.x0 + 7.4; x += 0.5) ck.box(x, x + 0.28, ALT_REQ - 0.03, ALT_REQ + 0.03, -0.03, 0.03, "#1f9e6e");
  const profPts: Vector3[] = [];
  for (let i = 0; i <= 200; i++) {
    const u = ((CHART.level + CHART.drop) * i) / 200;
    profPts.push(V(CHART.x0 + u, profile(u), 0));
  }
  const profCurve = new CatmullRomCurve3(profPts);
  const profGeo = new TubeGeometry(profCurve, 400, 0.08, 8, false);
  const profMat = new MeshStandardMaterial({ color: "#c8352b", emissive: "#c8352b", emissiveIntensity: 0.3 });
  const prof = new Mesh(profGeo, profMat);
  chart.add(prof);
  const chartJet = makeJet(new Kit(new Group())).g;
  chartJet.scale.setScalar(0.12);
  chart.add(chartJet);
  // altitude band reference (start / end)
  const endMark = ck.box(CHART.x0 + CHART.level + CHART.drop - 0.02, CHART.x0 + CHART.level + CHART.drop + 0.02, ALT1, ALT0, -0.02, 0.02, "#c8352b");

  // ================= GROUND (Greenacres; 1 unit = 50 m)
  const ground = new Group();
  root.add(ground);
  const gk = new Kit(ground);
  gk.add(new Mesh(new CircleGeometry(170, 48), k.mat("#c3cbb6")), ground, false).rotation.x = -Math.PI / 2;
  ground.children[ground.children.length - 1].position.set(GX, 0, 0);
  // Military Trail (N–S, along z) and 10th Ave N (E–W), plus a grid of local streets
  gk.box(GX - 0.7, GX + 0.7, 0, 0.04, -170, 170, "#5a5e63");
  for (let z = -168; z < 170; z += 3) gk.box(GX - 0.03, GX + 0.03, 0.04, 0.05, z, z + 1.5, "#f2e6a8");
  gk.box(GX - 170, GX + 170, 0, 0.035, 4.2, 5.0, "#6a6e73");
  for (let x = -160; x <= 160; x += 12) if (Math.abs(x) > 2) gk.box(GX + x - 0.3, GX + x + 0.3, 0, 0.03, -160, 160, "#8b8f93");
  for (let z = -160; z <= 160; z += 12) gk.box(GX - 160, GX + 160, 0, 0.03, z - 0.3, z + 0.3, "#8b8f93");
  // houses / buildings: instanced, dense near the site, sparse far away
  const HOUSES = 2400;
  const house = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), HOUSES);
  const roofs = new InstancedMesh(new ConeGeometry(0.75, 0.5, 4), new MeshStandardMaterial({ flatShading: true, roughness: 0.9 }), HOUSES);
  house.castShadow = roofs.castShadow = true;
  house.receiveShadow = true;
  {
    const r = rng(77);
    const walls = ["#f2ece0", "#efe6d2", "#e9efe9", "#f3e4d6", "#e7e0ee"];
    const tops = ["#c96f4f", "#b9b2a6", "#d39a6a", "#a7a39b"];
    let n = 0;
    while (n < HOUSES) {
      const rad = Math.pow(r(), 0.8) * 150;
      const a = r() * Math.PI * 2;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (Math.abs(x) < 2.0 || Math.abs(z - 4.6) < 1.4) continue; // roads near the site
      if (x > 2.5 && x < 11 && z > -10 && z < -2) continue; // ball fields
      if (rad < 2.8) continue; // the site itself
      // snap to a block grid (so they sit along streets)
      const sx = Math.round(x / 2.2) * 2.2, sz = Math.round(z / 2.2) * 2.2;
      const s = rad < 25 ? 1 : 1.3;
      const mobile = x < -2.5 && x > -12 && z > -12 && z < 3;
      // compose with non-uniform scale
      const m = new Group();
      m.position.set(GX + sx, mobile ? 0.25 : 0.32 * s, sz);
      m.scale.set(mobile ? 1.7 : 1.3 * s, mobile ? 0.5 : 0.64 * s, mobile ? 0.6 : 1.2 * s);
      m.updateMatrix();
      house.setMatrixAt(n, m.matrix);
      house.setColorAt(n, new Color(mobile ? "#e9edf0" : walls[n % walls.length]));
      const rm = new Group();
      rm.position.set(GX + sx, mobile ? 0.52 : 0.64 * s + 0.24 * s, sz);
      rm.rotation.y = Math.PI / 4;
      rm.scale.set(mobile ? 0.01 : 1.15 * s, mobile ? 0.01 : s, mobile ? 0.01 : 1.15 * s);
      rm.updateMatrix();
      roofs.setMatrixAt(n, rm.matrix);
      roofs.setColorAt(n, new Color(tops[n % tops.length]));
      n++;
    }
  }
  ground.add(house, roofs);
  // ball fields east of the road, trees
  for (const [x0, z0] of [[3, -9.5], [7, -9.5], [3, -5.5], [7, -5.5]]) {
    gk.box(GX + x0, GX + x0 + 3.6, 0, 0.05, z0, z0 + 3.6, "#7fae62");
    const d = gk.add(new Mesh(new BoxGeometry(1.4, 0.02, 1.4), k.mat("#c9a77c")), ground, false);
    d.position.set(GX + x0 + 1.0, 0.06, z0 + 2.6);
    d.rotation.y = Math.PI / 4;
  }
  { const r = rng(5); for (let i = 0; i < 60; i++) { const a = r() * 6.28, rad = 3 + r() * 22; const tr = k.tree(0, 0, 0.9); ground.add(tr); tr.position.set(GX + Math.cos(a) * rad, 0, Math.sin(a) * rad); if (Math.abs(Math.cos(a) * rad) < 1.6) tr.visible = false; } }
  // site marker: dark scar on the road + slim pin (no fire, no wreck)
  gk.add(new Mesh(new CircleGeometry(1.0, 24), k.mat("#3b3a38")), ground, false).rotation.x = -Math.PI / 2;
  ground.children[ground.children.length - 1].position.set(GX, 0.06, 0);
  const gPin = new Group();
  gPin.position.set(GX, 0, 0);
  gk.add(new Mesh(new CylinderGeometry(0.08, 0.08, 6, 8), k.mat("#1d2328")), gPin).position.y = 3;
  gk.add(new Mesh(new SphereGeometry(0.55, 16, 12), k.mat("#c8352b", { roughness: 0.4 })), gPin).position.y = 6.2;
  ground.add(gPin);
  // 2–6 km band where the left elevator pieces were found (direction not published -> whole ring)
  const bandMat = new MeshStandardMaterial({ color: "#e8622c", transparent: true, opacity: 0, side: DoubleSide, depthWrite: false });
  const band = new Mesh(new RingGeometry(2 * KM, 6 * KM, 96), bandMat);
  band.rotation.x = -Math.PI / 2;
  band.position.set(GX, 0.5, 0);
  ground.add(band);
  const edgeMat = new MeshStandardMaterial({ color: "#e8622c", emissive: "#e8622c", emissiveIntensity: 0.4, transparent: true, opacity: 0 });
  for (const rr of [2 * KM, 6 * KM]) {
    const e = new Mesh(new RingGeometry(rr - 1.6, rr + 1.6, 128), edgeMat);
    e.rotation.x = -Math.PI / 2;
    e.position.set(GX, 0.6, 0);
    ground.add(e);
  }

  const SKY_DAY = new Color("#dfe9ec");
  const SKY_GREY = new Color("#b9c2c9");
  const SKY_DUSK = new Color("#d9d3cc");
  const e = new Euler();

  return {
    root,
    update: (t, shotId, pose, scene) => {
      const I = shot(shotId), lt = t - I.s;
      const stage = ["A", "B", "C", "L", "M"].includes(shotId) ? "map" : ["D", "E", "F", "I", "K"].includes(shotId) ? "sky" : shotId === "G" ? "chart" : "ground";
      map.visible = stage === "map";
      sky.visible = stage === "sky";
      chart.visible = stage === "chart";
      ground.visible = stage === "ground";

      let bg = SKY_DAY.clone();
      if (stage === "sky") bg = SKY_GREY.clone().lerp(new Color("#9aa5ae"), shotId === "F" || shotId === "K" ? 0.6 : 0);
      if (shotId === "M") bg = SKY_DAY.clone().lerp(SKY_DUSK, smooth(lt / 3));
      scene.background = bg;
      scene.fog = stage === "sky" ? new Fog(bg, 18, 75) : stage === "ground" ? new Fog(bg, 120, 420) : new Fog(bg, 60, 220);
      hemi.intensity = stage === "sky" ? 1.5 : 1.25;
      sun.intensity = stage === "sky" ? 1.2 : 2.1;
      sun.position.set(pose.target[0] + 14, pose.target[1] + 30, pose.target[2] + 18);
      sun.target.position.set(...pose.target);
      sun.target.updateMatrixWorld();

      // ---- map
      if (stage === "map") {
        const r = S.route(t);
        const total = routeGeo.index ? routeGeo.index.count : 0;
        routeGeo.setDrawRange(0, Math.floor((total * r) / 6) * 6);
        route.visible = r > 0.001;
        routeMat.opacity = shotId === "L" || shotId === "M" ? 0.55 : 1;
        routeMat.transparent = routeMat.opacity < 1;
        dashes.visible = r >= 1 && shotId !== "M";
        destPin.visible = shotId !== "A";
        miniJet.visible = shotId === "C" && r > 0.001 && r < 0.999;
        if (miniJet.visible) {
          const p = routeCurve.getPointAt(r), q = routeCurve.getTangentAt(r);
          miniJet.position.copy(p).add(V(0, 0.25, 0));
          miniJet.rotation.set(0, -Math.atan2(q.z, q.x), Math.atan2(q.y, Math.hypot(q.x, q.z)) * 0.6);
        }
        const pulse = 1 + 0.12 * Math.sin(t * 4);
        sitePin.scale.setScalar(shotId === "A" ? pulse : 1);
      }

      // ---- sky
      if (stage === "sky") {
        const att = S.attitude(t);
        const tb = S.turb(t);
        const sh = (a: number, b: number) => Math.sin(t * a) * Math.sin(t * b + 1.3);
        const calm = shotId === "I"; // studio-like tail close-up
        const still = calm || shotId === "K";
        jetPitch.rotation.z = still ? 0 : att.pitch + tb * 0.05 * sh(5.1, 1.7);
        jetRoll.rotation.x = still ? 0 : att.bank + tb * 0.07 * sh(4.3, 2.2);
        jetPitch.position.set(JET[0], JET[1] + (calm ? 0 : tb * 0.35 * sh(3.7, 1.1)), JET[2]);
        jet.iceMat.opacity = calm ? 0 : 0.95 * S.ice(t);
        jet.elevLMat.emissiveIntensity = shotId === "I" ? 0.9 * S.elevator(t) : 0;
        jet.elevLMat.color.set(shotId === "I" && S.elevator(t) > 0.5 ? "#f7b08e" : "#f3f4f2");
        // clouds stream back (forward speed) and up (sink); hidden for the calm tail shot
        cloud.visible = !calm;
        rain.visible = !calm;
        const fwd = 9;
        let climb = 0; // integrate sink analytically enough: piecewise sample
        { const n = 24; for (let i = 0; i < n; i++) climb += S.sink(I.s + ((i + 0.5) / n) * lt) * (lt / n); }
        for (let i = 0; i < CLOUDS; i++) {
          const c = cloudSeed[i];
          const x = ((((c.x - lt * fwd) % 120) + 180) % 120) - 60;
          const y = ((((c.y + climb * (shotId === "F" ? 1 : 0.05)) % 60) + 90) % 60) - 30;
          e.set(c.x, c.y, 0);
          // keep a clear corridor between the jet and the camera (camera sits on the +z side)
          const toCam = pose.position[2] - JET[2];
          const inLane = c.z > -6 && c.z < toCam + 4 && Math.abs(y) < c.s + 4 && Math.abs(x) < c.s + 9;
          setInstance(cloud, i, JET[0] + x, JET[1] + y, JET[2] + c.z, inLane ? 0 : c.s, e);
        }
        cloud.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < RAIN; i++) {
          const d = rainSeed[i];
          const x = 20 - ((((d.x + lt * 30 * d.sp) % 40) + 40) % 40);
          const y = 12 - ((((d.y + lt * 6 + climb * (shotId === "F" ? 0.5 : 0)) % 24) + 24) % 24);
          e.set(0, 0, -0.2);
          setInstance(rain, i, JET[0] + x, JET[1] + y, JET[2] + d.z, 1, e);
        }
        rain.instanceMatrix.needsUpdate = true;
        cvr.visible = shotId === "K";
        if (cvr.visible) {
          const u = smooth(clamp((t - L(13).s - 1.6) / 1.2));
          cvr.position.set(JET[0] + 3.4, JET[1] - 0.4 + (1 - u) * -1.5, JET[2] + 3.8);
          cvr.rotation.set(0.25, -0.6 + lt * 0.35, 0.1);
          cvr.scale.setScalar(Math.max(0.001, u * 0.6));
        }
      }

      // ---- altitude chart
      if (stage === "chart") {
        const u = S.chartU(t);
        const frac = clamp(u / (CHART.level + CHART.drop));
        const total = profGeo.index ? profGeo.index.count : 0;
        profGeo.setDrawRange(0, Math.floor((total * frac) / 6) * 6);
        const p = profCurve.getPointAt(frac), q = profCurve.getTangentAt(frac);
        chartJet.position.set(p.x, p.y + 0.18, 0.25);
        chartJet.rotation.set(0, 0, Math.atan2(q.y, q.x));
        endMark.visible = frac > 0.999;
      }

      // ---- ground
      if (stage === "ground") {
        const b = shotId === "J" ? S.band(t) : 0;
        bandMat.opacity = 0.42 * b;
        edgeMat.opacity = b;
        gPin.scale.setScalar(shotId === "J" ? 6 : 1);
      }
    },
  };
};
