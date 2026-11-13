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
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { Kit, setInstance } from "../../engine/kit";
import { clamp, rng, smooth } from "../../engine/math";
import type { Ctx, WorldApi } from "../../engine/types";
import {
  BOT,
  CX,
  FAULT_U,
  FX,
  MP,
  SEA_L,
  SEA_R,
  ZB,
  backupArc,
  cableCurve,
  cablePoint,
  cablePulse,
  fiberPulseX,
  makeState,
  mapArcs,
  shipBob,
  shipRoll,
  shipX,
  zigPath,
} from "./state";

const SKY = new Color("#cfe6ee");
const SKY_UW = new Color("#10333f");
const SKY_DARK = new Color("#0a161f");
const SKY_WARM = new Color("#f6d8b6");
const TOWER_DAY = new Color("#93a4ac");
const TOWER_DUSK = new Color("#41322c");
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Seafloor profile (front cut face), left -> right. Islands sit on y = 0. */
const PROF: [number, number][] = [
  [-20, 0], [-5.5, 0], [-4.7, -1.5], [-3.1, -3.2], [-1.2, -4.55], [0.6, -4.6],
  [2.3, -4.15], [4.0, -3.0], [5.1, -1.5], [5.5, 0], [20, 0],
];
const yTop = (x: number) => {
  for (let i = 0; i < PROF.length - 1; i++) {
    const [x0, y0] = PROF[i];
    const [x1, y1] = PROF[i + 1];
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return 0;
};

/** Solid seafloor slab (with island ground), extruded back to z = -ZB. Cut face at z = 0. */
const seafloorGeo = () => {
  const s = new Shape();
  s.moveTo(-20, BOT);
  s.lineTo(20, BOT);
  s.lineTo(20, 0);
  for (let i = PROF.length - 2; i >= 0; i--) s.lineTo(PROF[i][0], PROF[i][1]);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: ZB, bevelEnabled: false });
  g.translate(0, 0, -ZB);
  return g;
};

/** Translucent water slab filling the channel between the y = 0 surface and the seafloor profile. */
const waterGeo = () => {
  const s = new Shape();
  s.moveTo(SEA_L, 0);
  s.lineTo(SEA_R, 0);
  for (let i = PROF.length - 2; i >= 0; i--) {
    const [x, y] = PROF[i];
    if (x >= SEA_L && x <= SEA_R) s.lineTo(x, y);
  }
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: ZB, bevelEnabled: false });
  g.translate(0, 0, -ZB);
  return g;
};

const DARK_SHOTS = new Set(["C", "D", "E", "I"]);

export const createWorld = (ctx: Ctx): WorldApi => {
  const { shot } = ctx;
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);

  // ---------- lights
  const hemi = new HemisphereLight("#ffffff", "#33505e", 1.15);
  root.add(hemi);
  const sun = new DirectionalLight("#fff3df", 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 22, bottom: -22, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  root.add(sun, sun.target);

  // ---------- seafloor + water + strata on the cut face
  k.add(new Mesh(seafloorGeo(), k.mat("#8a6446")));
  const waterMat = new MeshStandardMaterial({ color: "#2c6a8c", roughness: 0.12, transparent: true, opacity: 0.52, depthWrite: false, side: DoubleSide });
  const water = new Mesh(waterGeo(), waterMat);
  water.receiveShadow = true;
  root.add(water);
  // wave glints on the surface
  const streakMat = new MeshStandardMaterial({ color: "#cfe8ee", transparent: true, opacity: 0.28, depthWrite: false, roughness: 0.4 });
  {
    const r = rng(14);
    for (let i = 0; i < 7; i++) {
      const x = -5 + r() * 10, z = -6.5 + r() * 6, w = 0.7 + r() * 1.6;
      const s = new Mesh(new BoxGeometry(w, 0.035, 0.09), streakMat);
      s.position.set(x, 0.025, z);
      root.add(s);
    }
  }
  // strata tinting on the cut face — clipped to the solid soil, never floating in the sea channel
  for (const [y, h, c] of [
    [-0.9, 0.12, "#7b5a40"],
    [-2.1, 0.22, "#6f4f37"],
    [-3.3, 0.15, "#7b5a40"],
  ] as [number, number, string][]) {
    let x0: number | null = null;
    for (let x = -20; x <= 20.001; x += 0.25) {
      const solid = y + h <= yTop(x) - 0.05;
      if (solid && x0 === null) x0 = x;
      if ((!solid || x >= 20) && x0 !== null) {
        if (x - x0 > 0.5) k.box(x0, x, y - h, y + h, 0.001, 0.02, c);
        x0 = null;
      }
    }
  }
  // groundwater specks on the face (only where the slab is solid)
  const dots = k.particles(140, "#7ec8ea", 0.045);
  {
    const r = rng(4);
    for (let i = 0; i < 140; i++) {
      const x = -20 + r() * 40;
      const y = -0.9 - r() * 7.6;
      setInstance(dots, i, x, y, 0.03, y < yTop(x) - 0.25 ? 1 : 0);
    }
    dots.instanceMatrix.needsUpdate = true;
  }

  // ---------- islands (two-tier silhouette) + beach
  const DIRT = "#8a6a4a";
  const GRASS = "#7d9158";
  const SAND = "#d9c795";
  // left island
  k.box(-20, -5.5, 0, 1.0, ZB, 0, DIRT);
  k.box(-20, -5.5, 1.0, 1.12, ZB, 0, GRASS);
  k.box(-19, -10.5, 1.0, 1.9, -6.5, 0, DIRT);
  k.box(-19, -10.5, 1.9, 2.0, -6.5, 0, GRASS);
  k.box(-9.3, -6.3, 1.0, 1.45, -5, 0, DIRT);
  k.box(-9.3, -6.3, 1.45, 1.56, -5, 0, GRASS);
  k.box(-6.7, -5.2, 0.02, 0.34, -3, 0, SAND);
  k.box(-7.0, -5.3, -0.02, 0.05, -6, 0, "#c2a86f");
  // right island
  k.box(5.5, 20, 0, 1.15, ZB, 0, DIRT);
  k.box(5.5, 20, 1.15, 1.27, ZB, 0, GRASS);
  k.box(6.3, 10.6, 1.15, 1.7, -6.5, 0, DIRT);
  k.box(6.3, 10.6, 1.7, 1.8, -6.5, 0, GRASS);
  k.box(5.2, 6.9, 0.02, 0.32, -3, 0, SAND);
  k.box(5.3, 7.1, -0.02, 0.05, -6, 0, "#c2a86f");
  // shore rocks
  {
    const rocks = [[-5.9, -2.3, 0.5], [5.8, -2.9, 0.62], [-6.25, -0.6, 0.34]];
    for (const [x, z, s] of rocks) {
      const rock = k.add(new Mesh(new SphereGeometry(s, 7, 5), k.mat("#7d7263")));
      rock.position.set(x, yTop(x) + s * 0.25, z);
      rock.scale.y = 0.62;
    }
  }
  // distant tower silhouettes (fill the skyline, fog handles the haze)
  const towerMat = new MeshStandardMaterial({ color: TOWER_DAY.clone(), roughness: 0.6, metalness: 0.1, flatShading: true });
  {
    const r = rng(23);
    for (let i = 0; i < 9; i++) {
      const h = 2.6 + r() * 4.2, w = 1.4 + r() * 1.2, x = -17 + i * 4.3 + r() * 2;
      const m = k.add(new Mesh(new BoxGeometry(w, h, w), towerMat), root, false);
      m.position.set(x, 1.05 + h / 2, -17 - r() * 6);
    }
  }
  // right island: city towers + wide data-center block
  const winMat = new MeshStandardMaterial({ color: "#241d12", emissive: "#ffd98a", emissiveIntensity: 0.4, roughness: 0.4 });
  const towers: [number, number, number, number][] = [
    [7.2, 4.2, 1.5, -5.2],
    [9.6, 5.4, 2.3, -5.4], // the data-center block
    [12.4, 3.4, 1.3, -4.6],
    [15.3, 5.8, 1.6, -5.8],
    [17.7, 2.6, 1.2, -4.2],
  ];
  for (const [x, h, w, z] of towers) {
    const m = k.add(new Mesh(new BoxGeometry(w, h, w), k.mat(x === 9.6 ? "#5d707c" : "#6d8794", { roughness: 0.35, metalness: 0.35 })));
    m.position.set(x, 1.27 + h / 2, z);
    const win = new Mesh(new BoxGeometry(w * 0.72, h * 0.55, 0.02), winMat);
    win.position.set(x, 1.27 + h * 0.52, z + w / 2 + 0.015);
    root.add(win);
  }
  // right island road + lane dashes + cars
  k.box(5.7, 19.7, 1.27, 1.31, -2.6, -1.3, "#3c4147");
  const dash = new InstancedMesh(new BoxGeometry(0.5, 0.02, 0.07), new MeshStandardMaterial({ color: "#f4f1ea" }), 9);
  dash.frustumCulled = false;
  for (let i = 0; i < 9; i++) setInstance(dash, i, 6.4 + i * 1.6, 1.32, -1.95, 1);
  dash.instanceMatrix.needsUpdate = true;
  root.add(dash);
  const CARS = 8;
  const carBody = new InstancedMesh(new BoxGeometry(0.58, 0.17, 0.27), new MeshStandardMaterial({ flatShading: true, roughness: 0.6 }), CARS);
  const carTop = new InstancedMesh(new BoxGeometry(0.3, 0.13, 0.23), new MeshStandardMaterial({ color: "#232a32", roughness: 0.35 }), CARS);
  carBody.castShadow = carTop.castShadow = true;
  carBody.frustumCulled = carTop.frustumCulled = false;
  {
    const cols = ["#e04f3e", "#f2f2f2", "#3a7bd5", "#f2c230", "#2e9b5b", "#1d2328"];
    for (let i = 0; i < CARS; i++) carBody.setColorAt(i, new Color(cols[i % cols.length]));
  }
  root.add(carBody, carTop);
  const carSeed = (() => {
    const r = rng(8);
    return Array.from({ length: CARS }, (_, i) => ({ lane: i % 2, off: r() * 14, sp: 1.1 + r() * 0.7 }));
  })();
  // ODP poles (titik akses) on both islands
  const pole = (x: number, y: number, z: number) => {
    const p = k.add(new Mesh(new CylinderGeometry(0.045, 0.055, 0.85, 8), k.mat("#4b3f2e")));
    p.position.set(x, y + 0.42, z);
    k.box(x - 0.085, x + 0.085, y + 0.78, y + 1.0, z - 0.085, z + 0.085, "#1d2328");
  };
  pole(-7.4, 1.45, -0.7);
  pole(8.3, 1.27, -0.75);
  pole(12.9, 1.27, -0.75);
  pole(17.0, 1.27, -0.75);
  // sagging drop wires between the right-island poles
  for (const [a, b] of [[8.3, 12.9], [12.9, 17.0]] as [number, number][]) {
    const wire = new Mesh(
      new TubeGeometry(new CatmullRomCurve3([V(a, 2.25, -0.75), V((a + b) / 2, 1.98, -0.75), V(b, 2.25, -0.75)]), 16, 0.014, 5),
      k.mat("#1d2328", { roughness: 0.6 }),
    );
    root.add(wire);
  }

  // ---------- left island: landing station + monopole + dish
  k.box(-13.6, -11.0, 1.0, 2.35, -3.3, -0.8, "#efe6d2");
  k.box(-13.6, -11.0, 1.0, 1.12, -3.3, -0.8, "#8a8474");
  { // pyramid roof
    const roof = k.add(new Mesh(new ConeGeometry(1.85, 0.68, 4), k.mat("#3d6a76")));
    roof.position.set(-12.3, 2.7, -2.05);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.35, 1, 0.75);
  }
  k.box(-12.62, -12.0, 1.0, 1.72, -0.82, -0.78, "#2b3540"); // door
  const stripeMat = new MeshStandardMaterial({ color: "#3a2f12", emissive: "#ffe9b0", emissiveIntensity: 0.55 });
  const stripe = new Mesh(new BoxGeometry(1.7, 0.3, 0.02), stripeMat);
  stripe.position.set(-12.3, 1.95, -0.79);
  root.add(stripe);
  { // satellite dish on the roof
    const dish = k.add(new Mesh(new SphereGeometry(0.52, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), k.mat("#eef2f4", { roughness: 0.35, metalness: 0.25, side: DoubleSide })));
    dish.position.set(-13.1, 3.1, -2.6);
    dish.rotation.x = -0.8;
    const feed = k.add(new Mesh(new CylinderGeometry(0.035, 0.035, 0.45, 6), k.mat("#c9ced4")));
    feed.position.set(-13.1, 3.35, -2.28);
    feed.rotation.x = -0.8 + Math.PI / 2;
  }
  // monopole mast with beacon
  const mono = k.add(new Mesh(new CylinderGeometry(0.065, 0.085, 1.9, 10), k.mat("#39434e")));
  mono.position.set(-9.3, 1.45 + 0.95, -3.3);
  for (const [y, a] of [[2.85, -0.5], [3.2, 0.35]] as [number, number][]) {
    const d = k.add(new Mesh(new ConeGeometry(0.16, 0.42, 8, 1, true), k.mat("#c9ced4", { side: DoubleSide })));
    d.position.set(-9.3, y, -3.15);
    d.rotation.x = Math.PI / 2.4 + a;
  }
  const beaconMat = new MeshStandardMaterial({ color: "#2a0603", emissive: "#ff2418", emissiveIntensity: 1.3 });
  const beacon = new Mesh(new SphereGeometry(0.085, 10, 8), beaconMat);
  beacon.position.set(-9.3, 3.5, -3.3);
  root.add(beacon);

  // ---------- the submarine cable + light packets
  const cableMat = new MeshStandardMaterial({ color: "#d97a35", roughness: 0.5, emissive: "#6b3308", emissiveIntensity: 0.75, flatShading: true });
  const cable = new Mesh(new TubeGeometry(cableCurve, 72, 0.14, 10), cableMat);
  cable.castShadow = true;
  root.add(cable);
  // sand mounds where the cable settles
  for (const x of [-3.1, -0.8, 1.6, 3.4]) {
    const m = k.add(new Mesh(new ConeGeometry(0.34, 0.2, 7), k.mat("#b9a06b")));
    m.position.set(x, yTop(x) + 0.06, -1.6);
  }
  const cablePulses = new InstancedMesh(
    new SphereGeometry(0.105, 8, 6),
    new MeshStandardMaterial({ color: "#ffe9a8", emissive: "#ffd76a", emissiveIntensity: 2.6 }),
    6,
  );
  cablePulses.frustumCulled = false;
  root.add(cablePulses);
  // backup corridor (shot H): monopole -> arc -> data-center tower
  const arcMat = new MeshStandardMaterial({ color: "#2a1a08", emissive: "#ff9a3c", emissiveIntensity: 1.8, transparent: true, opacity: 0, depthWrite: false });
  const backupMesh = new Mesh(new TubeGeometry(backupArc, 48, 0.14, 9), arcMat);
  backupMesh.visible = false;
  root.add(backupMesh);
  const arcPulses = new InstancedMesh(
    new SphereGeometry(0.13, 8, 6),
    new MeshStandardMaterial({ color: "#fff1d8", emissive: "#ffc36a", emissiveIntensity: 2.4 }),
    4,
  );
  arcPulses.frustumCulled = false;
  arcPulses.visible = false;
  root.add(arcPulses);
  // fault marker (shot H)
  const faultMat = new MeshStandardMaterial({ color: "#2a0705", emissive: "#ff4030", emissiveIntensity: 2.5 });
  const faultDot = new Mesh(new SphereGeometry(0.2, 10, 8), faultMat);
  const FAULT_POS = cablePoint(FAULT_U);
  faultDot.position.copy(FAULT_POS);
  faultDot.visible = false;
  root.add(faultDot);
  const faultLight = new PointLight("#ff2a1a", 0, 5, 2);
  faultLight.position.copy(FAULT_POS).add(new Vector3(0, 0.3, 0.3));
  root.add(faultLight);

  // ---------- sea buoy + gulls
  const buoy = new Group();
  buoy.position.set(1.4, 0, -3.4);
  root.add(buoy);
  const buoyBody = k.add(new Mesh(new CylinderGeometry(0.15, 0.19, 0.52, 10), k.mat("#c8352b")), buoy);
  buoyBody.position.y = 0.16;
  k.add(new Mesh(new CylinderGeometry(0.151, 0.151, 0.1, 10), k.mat("#f2f2f2")), buoy).position.y = 0.22;
  const buoyLampMat = new MeshStandardMaterial({ color: "#2a1806", emissive: "#ffb03a", emissiveIntensity: 2 });
  const buoyLamp = new Mesh(new SphereGeometry(0.075, 8, 6), buoyLampMat);
  buoyLamp.position.y = 0.47;
  buoy.add(buoyLamp);
  const gulls: Mesh[] = [];
  for (const [r, h, ph, dir] of [[4.6, 4.3, 0.6, 1], [6.2, 5.5, 3.4, -1]] as [number, number, number, number][]) {
    const g = k.add(new Mesh(new ConeGeometry(0.09, 0.62, 5), k.mat("#1d2328", { roughness: 0.5 })), root, false);
    g.rotation.z = Math.PI / 2;
    g.userData = { r, h, ph, dir };
    gulls.push(g);
  }

  // ---------- cable-laying ship
  const ship = new Group();
  ship.position.set(shipX(0), 0, -2.5);
  root.add(ship);
  const hull = k.add(new Mesh(new BoxGeometry(3.9, 0.6, 1.15), k.mat("#22333f", { roughness: 0.5, metalness: 0.3 })), ship);
  hull.position.y = 0.12;
  k.add(new Mesh(new BoxGeometry(1.15, 0.72, 0.95), k.mat("#e8e4da")), ship).position.set(-1.15, 0.78, 0);
  k.box(-1.55, -0.78, 0.98, 1.14, 0.49, 0.51, "#2b3540", ship); // bridge windows
  { // spool with coiled cable
    const spool = k.add(new Mesh(new CylinderGeometry(0.6, 0.6, 0.46, 18), k.mat("#8a6a3a", { roughness: 0.6 })), ship);
    spool.rotation.x = Math.PI / 2;
    spool.position.set(0.85, 0.72, 0);
    const hub = k.add(new Mesh(new CylinderGeometry(0.2, 0.2, 0.5, 12), k.mat("#4b3a22")), ship);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(0.85, 0.72, 0);
  }
  for (const [i, c] of ["#3a7bd5", "#2e9b5b", "#c8352b"].entries()) {
    k.box(-0.15 + i * 0.52 - 0.26, -0.15 + i * 0.52 + 0.26, 0.42, 0.78, -0.36, 0.36, c, ship);
  }
  { // crane mast + boom over the stern
    const mast = k.add(new Mesh(new CylinderGeometry(0.07, 0.09, 1.85, 8), k.mat("#d0762a")), ship);
    mast.position.set(1.62, 1.35, 0.28);
    const boom = k.add(new Mesh(new CylinderGeometry(0.05, 0.06, 1.7, 8), k.mat("#d0762a")), ship);
    boom.position.set(2.35, 1.75, 0.1);
    boom.rotation.z = 1.05;
    boom.rotation.y = 0.35;
  }
  { // cable running from the spool over the side into the water
    const lead = new Mesh(
      new TubeGeometry(new CatmullRomCurve3([V(0.85, 0.75, 0.35), V(1.9, 0.6, 0.62), V(3.0, -0.15, 0.7), V(4.2, -1.5, 0.75)]), 24, 0.05, 6),
      k.mat("#572b08"),
    );
    ship.add(lead);
  }

  // seaweed strands + rocks on the seabed (depth cues)
  {
    const r = rng(21);
    for (let i = 0; i < 7; i++) {
      const x = -4.5 + r() * 9;
      const sw = k.add(new Mesh(new ConeGeometry(0.09, 0.85 + r() * 0.5, 5), k.mat("#2e6b54", { emissive: "#123324", emissiveIntensity: 0.4 })));
      sw.position.set(x, yTop(x) + 0.42, -2.6 - r() * 2.5);
      sw.rotation.z = (r() - 0.5) * 0.4;
    }
    for (const [x, z, s] of [[-3.4, -2.2, 0.3], [3.6, -3.4, 0.42], [0.9, -3.1, 0.22]] as [number, number, number][]) {
      const rock = k.add(new Mesh(new SphereGeometry(s, 6, 5), k.mat("#6b5b4a")));
      rock.position.set(x, yTop(x) + s * 0.3, z);
      rock.scale.y = 0.6;
    }
  }
  // ---------- fish + bubbles (underwater life)
  const fish = new InstancedMesh(new ConeGeometry(0.09, 0.42, 5), new MeshStandardMaterial({ color: "#46a3a8", emissive: "#123f42", flatShading: true }), 9);
  fish.geometry.rotateZ(Math.PI / 2);
  fish.frustumCulled = false;
  root.add(fish);
  const fishSeed = (() => {
    const r = rng(12);
    return Array.from({ length: 9 }, () => ({ cx: -6 + r() * 12, cz: -4 + r() * 3.2, amp: 1.2 + r() * 1.6, sp: 0.25 + r() * 0.2, ph: r() * Math.PI * 2, y: -2.0 - r() * 2.2 }));
  })();
  const bubbles = k.particles(30, "#cfeaf4", 0.05);
  const bubbleSeed = (() => {
    const r = rng(31);
    return Array.from({ length: 30 }, () => ({ x: -4 + r() * 8, off: r(), z: -2.4 + r() * 1.6 }));
  })();

  // ---------- magnified fiber scene (FX) — shots C & D
  const FXGroup = new Group();
  FXGroup.visible = false;
  root.add(FXGroup);
  const fk = new Kit(FXGroup);
  fk.box(FX - 6.4, FX + 6.4, -3.4, 3.4, -1.35, -0.95, "#0f2432");
  for (const [sx, sy] of [[-6.0, 3.0], [6.0, 3.0], [-6.0, -3.0], [6.0, -3.0]] as [number, number][]) {
    fk.box(FX + sx - 0.07, FX + sx + 0.07, sy - 0.07, sy + 0.07, -0.94, -0.88, "#1e3a4c");
  }
  // laser source at the left end
  fk.box(FX - 5.1, FX - 4.35, -0.5, 0.5, -0.42, 0.42, "#182a38");
  const slitMat = new MeshStandardMaterial({ color: "#2a1503", emissive: "#ff7a1a", emissiveIntensity: 2.4 });
  const slit = new Mesh(new BoxGeometry(0.06, 0.42, 0.5), slitMat);
  slit.position.set(FX - 4.32, 0, 0);
  FXGroup.add(slit);
  { // glass tube + core + beam
    const tubeGeo = new CylinderGeometry(1.02, 1.02, 8.8, 40, 1, true);
    tubeGeo.rotateZ(Math.PI / 2);
    const tube = new Mesh(tubeGeo, new MeshStandardMaterial({ color: "#c4ecf6", transparent: true, opacity: 0.14, roughness: 0.08, side: DoubleSide, depthWrite: false }));
    tube.position.set(FX, 0, 0);
    FXGroup.add(tube);
    const coreGeo = new CylinderGeometry(0.42, 0.42, 9.05, 26, 1, true);
    coreGeo.rotateZ(Math.PI / 2);
    const core = new Mesh(coreGeo, new MeshStandardMaterial({ color: "#0a3742", emissive: "#17c3d6", emissiveIntensity: 1.1, transparent: true, opacity: 0.32, side: DoubleSide, depthWrite: false }));
    core.position.set(FX, 0, 0);
    FXGroup.add(core);
    const beamGeo = new CylinderGeometry(0.135, 0.135, 9.15, 16);
    beamGeo.rotateZ(Math.PI / 2);
    const beam = new Mesh(beamGeo, new MeshStandardMaterial({ color: "#eafcff", emissive: "#a5f6ff", emissiveIntensity: 1.9 }));
    beam.position.set(FX, 0, 0);
    FXGroup.add(beam);
    for (const e of [-4.4, 4.4]) {
      const ring = new Mesh(new TorusGeometry(1.02, 0.055, 8, 40), fk.mat("#2a4a5e", { emissive: "#16303e", emissiveIntensity: 0.8 }));
      ring.rotation.y = Math.PI / 2;
      ring.position.set(FX + e, 0, 0);
      FXGroup.add(ring);
    }
  }
  const exitGlow = new Mesh(new CircleGeometry(0.36, 20), new MeshStandardMaterial({ color: "#59e8ff", emissive: "#59e8ff", emissiveIntensity: 1.6, transparent: true, opacity: 0.9 }));
  exitGlow.position.set(FX + 4.55, 0, 0);
  exitGlow.rotation.y = Math.PI / 2;
  FXGroup.add(exitGlow);
  const laserDot = new Mesh(new SphereGeometry(0.26, 10, 8), new MeshStandardMaterial({ color: "#ff9a2a", emissive: "#ff8a1a", emissiveIntensity: 2.6 }));
  laserDot.position.set(FX - 4.25, 0, 0);
  FXGroup.add(laserDot);
  // straight packets (shot C)
  const smallPulses = new InstancedMesh(new SphereGeometry(0.17, 10, 8), new MeshStandardMaterial({ color: "#ffe9b0", emissive: "#ffc45a", emissiveIntensity: 2.5 }), 4);
  smallPulses.frustumCulled = false;
  FXGroup.add(smallPulses);
  // zigzag bounce path + hero packet (shot D)
  const zigPts: Vector3[] = [];
  for (let i = 0; i <= 90; i++) {
    const p = zigPath(i / 90);
    zigPts.push(new Vector3(p[0], p[1], p[2]));
  }
  const zigMat = new MeshStandardMaterial({ color: "#241103", emissive: "#ff9a2e", emissiveIntensity: 2.6, transparent: true, opacity: 0, depthWrite: false });
  const zigMesh = new Mesh(new TubeGeometry(new CatmullRomCurve3(zigPts), 120, 0.055, 6), zigMat);
  zigMesh.visible = false;
  FXGroup.add(zigMesh);
  const hero = new Mesh(new SphereGeometry(0.27, 14, 10), new MeshStandardMaterial({ color: "#ffd2a0", emissive: "#ffb45a", emissiveIntensity: 2.8 }));
  hero.visible = false;
  FXGroup.add(hero);

  // ---------- magnified submarine-cable cross-section (CX) — shot E
  const CXGroup = new Group();
  CXGroup.visible = false;
  root.add(CXGroup);
  const ck = new Kit(CXGroup);
  ck.box(CX - 4.6, CX + 4.6, -3.5, 3.5, -1.3, -0.95, "#0f2432");
  const cxLayer = (rOut: number, len: number, color: string, opts: object = {}) => {
    const g = new CylinderGeometry(rOut, rOut, len, 36);
    g.rotateX(Math.PI / 2);
    const m = new Mesh(g, ck.mat(color, opts as Parameters<Kit["mat"]>[1]));
    m.position.set(CX, 0, 0);
    CXGroup.add(m);
    return m;
  };
  cxLayer(1.72, 0.95, "#2b333c", { metalness: 0.35 });
  cxLayer(1.13, 0.97, "#171e26");
  cxLayer(0.82, 0.99, "#b87333", { metalness: 0.8, roughness: 0.28 });
  cxLayer(0.6, 1.0, "#12171e");
  cxLayer(0.145, 1.02, "#d7d7de", { metalness: 0.6 });
  { // stranded armor wires (cut ends)
    const wireGeo = new CylinderGeometry(0.185, 0.185, 0.98, 10);
    wireGeo.rotateX(Math.PI / 2);
    const wires = new InstancedMesh(wireGeo, new MeshStandardMaterial({ flatShading: true, roughness: 0.5, metalness: 0.3 }), 12);
    wires.frustumCulled = false;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      setInstance(wires, i, CX + Math.cos(a) * 1.38, Math.sin(a) * 1.38, 0, 1, new Euler(0, 0, 0));
    }
    wires.setColorAt(0, new Color("#39414b"));
    for (let i = 0; i < 12; i++) wires.setColorAt(i, new Color(i % 2 ? "#4a545f" : "#39414b"));
    wires.instanceMatrix.needsUpdate = true;
    if (wires.instanceColor) wires.instanceColor.needsUpdate = true;
    CXGroup.add(wires);
  }
  { // 8 optical fibers in the core
    const fibGeo = new CylinderGeometry(0.075, 0.075, 1.04, 8);
    fibGeo.rotateX(Math.PI / 2);
    const fCols = ["#f97316", "#38bdf8", "#22c55e", "#eab308", "#a78bfa", "#f43f5e", "#2dd4bf", "#e2e8f0"];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const f = new Mesh(fibGeo, ck.mat(fCols[i], { emissive: fCols[i], emissiveIntensity: 0.55 }));
      f.position.set(CX + Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0);
      CXGroup.add(f);
    }
  }
  { // three strands pulled out toward the camera
    for (const [dx, c] of [[-0.34, "#38bdf8"], [0.05, "#f97316"], [0.4, "#e2e8f0"]] as [number, string][]) {
      const g = new CylinderGeometry(0.04, 0.04, 0.8, 6);
      g.translate(0, 0.4, 0);
      const m = new Mesh(g, ck.mat(c, { emissive: c, emissiveIntensity: 1.5 }));
      m.position.set(CX + dx, 0, 0.45);
      m.rotation.x = Math.PI / 2.9;
      m.rotation.z = dx * 0.55;
      CXGroup.add(m);
      const tip = new Mesh(new SphereGeometry(0.05, 8, 6), ck.mat(c, { emissive: c, emissiveIntensity: 2.2 }));
      tip.position.set(CX + dx * 1.5, -0.62, 0.95);
      CXGroup.add(tip);
    }
  }

  // ---------- schematic map of the archipelago (MP) — shot I
  const mapGroup = new Group();
  mapGroup.position.set(MP, 0, 0);
  mapGroup.scale.setScalar(0.78);
  mapGroup.visible = false;
  root.add(mapGroup);
  const mk = new Kit(mapGroup);
  mk.box(-7.6, 7.6, -0.28, 0, -3.55, 3.55, "#10222e");
  mk.box(-7.3, 7.3, 0, 0.02, -3.25, 3.25, "#0c1b26");
  for (const [x0, x1, z0, z1] of [[-7.6, -7.35, -3.55, 3.55], [7.35, 7.6, -3.55, 3.55], [-7.6, 7.6, -3.55, -3.3], [-7.6, 7.6, 3.3, 3.55]] as [number, number, number, number][]) {
    mk.box(x0, x1, 0, 0.06, z0, z1, "#1e3a4c");
  }
  const islandMat = mk.mat("#41584c");
  const islandMat2 = mk.mat("#3d5245");
  const island = (x: number, z: number, w: number, h: number, d: number, ry: number, m: typeof islandMat) => {
    const b = mk.add(new Mesh(new BoxGeometry(w, h, d), m));
    b.position.set(x, h / 2, z);
    b.rotation.y = ry;
  };
  island(-5.5, 1.55, 2.6, 0.5, 0.8, -0.42, islandMat); // Sumatra
  island(-3.9, 2.5, 3.1, 0.4, 0.62, 0.06, islandMat2); // Jawa
  island(-1.1, -1.35, 2.5, 0.72, 1.9, 0, islandMat2); // Kalimantan
  island(1.55, -0.35, 0.72, 0.5, 2.3, 0.18, islandMat); // Sulawesi
  island(1.45, -1.5, 1.5, 0.44, 0.55, 0.7, islandMat); // Sulawesi lobe
  island(-0.85, 2.55, 1.5, 0.34, 0.36, 0.08, islandMat); // Bali–NTB chain
  island(4.6, -0.6, 2.5, 0.55, 1.25, 0.12, islandMat); // Papua
  { // tiny outer islets
    const r = rng(9);
    for (let i = 0; i < 6; i++) {
      const c = mk.add(new Mesh(new ConeGeometry(0.15, 0.3, 6), mk.mat("#3d5245")));
      c.position.set(-6.5 + r() * 12.5, 0.15, -2.8 + r() * 5.2);
    }
  }
  const arcMats = mapArcs.map(() => new MeshStandardMaterial({ color: "#062a30", emissive: "#2fd3e0", emissiveIntensity: 1.6, transparent: true, opacity: 0.9 }));
  const arcMeshes = mapArcs.map((a, i) => {
    const m = new Mesh(new TubeGeometry(a, 40, 0.055, 6), arcMats[i]);
    mapGroup.add(m);
    return m;
  });
  const mapPulses = new InstancedMesh(new SphereGeometry(0.085, 8, 6), new MeshStandardMaterial({ color: "#eafcff", emissive: "#a5f6ff", emissiveIntensity: 2.4 }), 9);
  mapPulses.frustumCulled = false;
  mapGroup.add(mapPulses);
  const odpDots = new InstancedMesh(new SphereGeometry(0.045, 6, 5), new MeshStandardMaterial({ color: "#ffd166", emissive: "#eab308", emissiveIntensity: 1.1 }), 120);
  odpDots.frustumCulled = false;
  mapGroup.add(odpDots);
  const odpSeed = (() => {
    const r = rng(17);
    return Array.from({ length: 120 }, () => [-7.1 + r() * 14.2, -3.2 + r() * 6.4]);
  })();

  // ---------- warm sun disk for the finale (K)
  const sunDisk = new Mesh(new CircleGeometry(2.2, 32), new MeshStandardMaterial({ color: "#ffb066", emissive: "#ff9d4a", emissiveIntensity: 2.2, transparent: true, opacity: 0, fog: false }));
  sunDisk.position.set(-16, 1.9, -36);
  root.add(sunDisk);

  const tmpA = new Vector3();

  return {
    root,
    update: (t, shotId, pose, scene) => {
      const I0 = shot(shotId);
      const lt = t - I0.s;
      const warm = S.warm(t);
      const dkIn = DARK_SHOTS.has(shotId) ? smooth(clamp(Math.min(lt / 0.8, (I0.e - t) / 0.8))) : 0;
      const uw = shotId === "B" ? smooth(clamp(Math.min(lt / 0.9, (I0.e - t) / 0.9))) : 0;

      // background + fog per mood
      const bg = SKY.clone();
      bg.lerp(SKY_UW, uw);
      bg.lerp(SKY_DARK, dkIn);
      bg.lerp(SKY_WARM, warm * 0.85);
      scene.background = bg;
      scene.fog = new Fog(bg, 46 - 12 * Math.max(uw, dkIn), 165);

      // lights
      const dk = Math.max(dkIn, warm * 0.62);
      hemi.intensity = 1.15 - 0.4 * dk;
      sun.intensity = 2.1 - 1.35 * dk;
      sun.color.set("#fff3df").lerp(new Color("#ffb066"), warm);
      sun.position.set(pose.target[0] + 13, pose.target[1] + 19, pose.target[2] + 12);
      sun.target.position.set(...pose.target);
      sun.target.updateMatrixWorld();
      towerMat.color.copy(TOWER_DAY).lerp(TOWER_DUSK, Math.max(warm, dkIn * 0.7));
      winMat.emissiveIntensity = 0.4 + warm * 1.5 + dkIn * 0.4;
      stripeMat.emissiveIntensity = 0.55 + warm * 1.3;
      sunDisk.material.opacity = warm;
      sunDisk.visible = warm > 0.04;

      // traffic on the right-island road
      for (let i = 0; i < CARS; i++) {
        const c = carSeed[i], dir = c.lane ? -1 : 1;
        const x = 5.7 + ((((c.off + dir * t * c.sp) % 14) + 14) % 14);
        const z = c.lane ? -2.25 : -1.6;
        setInstance(carBody, i, x, 1.4, z, 1);
        setInstance(carTop, i, x - 0.03 * dir, 1.55, z, 1);
      }
      carBody.instanceMatrix.needsUpdate = carTop.instanceMatrix.needsUpdate = true;

      // ship drifts and bobs; beacons blink
      ship.position.x = shipX(t);
      ship.position.y = shipBob(t);
      ship.rotation.z = shipRoll(t);
      beaconMat.emissiveIntensity = S.beacon(t) * 2.1;
      buoy.position.y = Math.sin(t * 1.05 + 2) * 0.075;
      buoy.rotation.x = Math.sin(t * 0.9 + 0.6) * 0.08;
      buoy.rotation.z = Math.cos(t * 0.8) * 0.09;
      buoyLampMat.emissiveIntensity = S.beacon(t + 0.8) * 2.2;

      // water shimmer
      waterMat.opacity = S.waterShimmer(t) + uw * 0.12;
      waterMat.emissive = new Color("#0a2a38");
      waterMat.emissiveIntensity = 0.3 + 0.18 * Math.sin(t * 1.3);

      // gulls glide above the strait
      for (const g of gulls) {
        const { r, h, ph, dir } = g.userData as { r: number; h: number; ph: number; dir: number };
        const a = ph + dir * t * 0.22;
        g.position.set(Math.cos(a) * r, h + Math.sin(t * 0.9 + ph) * 0.15, -1.5 + Math.sin(a) * r * 0.55);
        g.rotation.y = -a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      }

      // submarine cable: emissive dims as traffic reroutes (shot H)
      const cf = S.cableFade(t);
      cableMat.emissiveIntensity = 0.6 * cf + 0.1;
      const sw = S.switch(t);
      for (let i = 0; i < 6; i++) {
        const u = cablePulse(t, i, 6);
        tmpA.copy(cablePoint(u)).lerp(backupArc.getPoint(u), sw);
        setInstance(cablePulses, i, tmpA.x, tmpA.y, tmpA.z, 0.5 + 0.9 * cf);
      }
      cablePulses.instanceMatrix.needsUpdate = true;
      // backup corridor fades in
      const ag = S.arcGlow(t);
      backupMesh.visible = ag > 0.02;
      arcMat.opacity = ag * 0.9;
      arcPulses.visible = ag > 0.25;
      if (arcPulses.visible) {
        for (let i = 0; i < 4; i++) {
          const u = cablePulse(t * 1.15, i, 4);
          const p = backupArc.getPoint(u);
          setInstance(arcPulses, i, p.x, p.y, p.z, 1);
        }
        arcPulses.instanceMatrix.needsUpdate = true;
      }
      // fault flashes red
      const ft = S.fault(t);
      faultDot.visible = ft > 0.02;
      if (faultDot.visible) {
        faultDot.scale.setScalar(0.75 + ft * 0.75 + 0.25 * Math.sin(t * 17));
        faultMat.emissiveIntensity = 1.4 + ft * 2.2;
      }
      faultLight.intensity = ft * 7;

      // fish swim; bubbles rise (bubbles only when underwater)
      for (let i = 0; i < fishSeed.length; i++) {
        const f = fishSeed[i];
        const a = f.ph + t * f.sp;
        const x = f.cx + Math.sin(a) * f.amp;
        const z = f.cz + Math.cos(a * 0.8) * 0.9;
        const dx = Math.cos(a) * f.amp * f.sp;
        const dz = -Math.sin(a * 0.8) * 0.9 * 0.8 * f.sp;
        const rot = new Euler(0, Math.atan2(-dz, dx), 0);
        setInstance(fish, i, x, f.y + Math.sin(t * 1.6 + f.ph) * 0.08, z, 0.62, rot);
      }
      fish.instanceMatrix.needsUpdate = true;
      bubbles.visible = shotId === "B" || shotId === "G";
      if (bubbles.visible) {
        for (let i = 0; i < bubbleSeed.length; i++) {
          const b = bubbleSeed[i];
          const u = (t * 0.24 + b.off) % 1;
          const y = -4.35 + u * 4.15;
          setInstance(bubbles, i, b.x + Math.sin(y * 2.1 + i) * 0.18, y, b.z, 0.4 + u * 1.1);
        }
        bubbles.instanceMatrix.needsUpdate = true;
      }

      // magnified fiber scene (C & D)
      FXGroup.visible = shotId === "C" || shotId === "D";
      if (FXGroup.visible) {
        if (shotId === "C") {
          smallPulses.visible = true;
          for (let i = 0; i < 4; i++) setInstance(smallPulses, i, fiberPulseX(t, i), 0, 0, 1);
          smallPulses.instanceMatrix.needsUpdate = true;
          hero.visible = false;
          zigMesh.visible = false;
        } else {
          smallPulses.visible = false;
          const u = S.fiberU(t);
          const p = zigPath(u);
          hero.visible = true;
          hero.position.set(p[0], p[1], p[2]);
          const zg = S.zig(t);
          zigMesh.visible = zg > 0.02;
          zigMat.opacity = zg * 0.95;
        }
      }

      // magnified cable cross-section (E)
      CXGroup.visible = shotId === "E";

      // schematic map (I): panels, pulsing arcs, twinkling ODP dots
      mapGroup.visible = shotId === "I";
      if (mapGroup.visible) {
        arcMeshes.forEach((m, i) => {
          arcMats[i].emissiveIntensity = 1.2 + 0.9 * Math.sin(t * 2.2 + i * 2.1);
        });
        for (let i = 0; i < 9; i++) {
          const arc = i % 3, k3 = Math.floor(i / 3);
          const u = (t * 0.16 + k3 / 3 + arc * 0.17) % 1;
          const p = mapArcs[arc].getPoint(u);
          setInstance(mapPulses, i, p.x, p.y + 0.05, p.z, 1);
        }
        mapPulses.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < 120; i++) {
          const [x, z] = odpSeed[i];
          setInstance(odpDots, i, x, 0.04, z, 0.75 + 0.45 * Math.sin(t * 1.8 + i * 1.7));
        }
        odpDots.instanceMatrix.needsUpdate = true;
      }
    },
  };
};
