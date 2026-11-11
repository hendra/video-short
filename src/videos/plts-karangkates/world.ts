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
  Shape,
  TubeGeometry,
  Vector3,
} from "three";
import { Kit, setInstance } from "../../engine/kit";
import { rng } from "../../engine/math";
import type { Ctx, WorldApi } from "../../engine/types";
import {
  BOT, CABLE_POINTS, CREST_Y, DAM_X, GHOST, ISLANDS, ISPAN, SUBSTATION_X, WATER_Y, ZB,
  bedY, makeState,
} from "./state";

const SKY = new Color("#dcebf0");
const SKY_WARM = new Color("#f6d9b8");
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Lake bed: polygon in (x, y) extruded along z from ZB to 0 — the z = 0 face is the aquarium cut. */
const bedSlab = () => {
  const s = new Shape();
  s.moveTo(-28, WATER_Y + 0.001);
  s.lineTo(-28, BOT);
  s.lineTo(26.5, BOT);
  s.lineTo(DAM_X + 7, -5.1); // toe of the dam
  s.lineTo(DAM_X, -5.1);
  for (let x = DAM_X; x >= -28; x -= 0.5) s.lineTo(x, bedY(x));
  s.lineTo(-28, WATER_Y + 0.001);
  const g = new ExtrudeGeometry(s, { depth: -ZB, bevelEnabled: false });
  g.translate(0, 0, ZB);
  return g;
};

/** One PV island: floating pontoons + tilted panel array. Origin at waterline centre. */
const buildIsland = (k: Kit): Group => {
  const g = new Group();
  const [W, D] = ISPAN;
  // pontoons (two runners, half-submerged)
  for (const dz of [-D / 2 + 0.35, D / 2 - 0.35]) k.box(-W / 2, W / 2, -0.16, 0.1, dz - 0.28, dz + 0.28, "#3a4148", g);
  // walkway frame
  k.box(-W / 2, W / 2, 0.1, 0.2, -D / 2, D / 2, "#c9c9c0", g);
  // small inverter cabinet at the east end of each island
  k.box(W / 2 - 0.62, W / 2 - 0.08, 0.2, 0.62, -D / 2 + 0.1, -D / 2 + 0.55, "#4c565f", g);
  for (const vy of [0.3, 0.42]) k.box(W / 2 - 0.52, W / 2 - 0.18, vy, vy + 0.035, -D / 2 + 0.556, -D / 2 + 0.6, "#232a31", g);
  // panels: 6 × 3 tilted ~12°, facing up-toward-camera
  const panelMat = k.mat("#16283d", { roughness: 0.32, metalness: 0.6 });
  const legMat = k.mat("#8a8a82");
  const pw = W / 6, pd = D / 3;
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 3; j++) {
      const x = -W / 2 + pw / 2 + i * pw;
      const z = -D / 2 + pd / 2 + j * pd;
      const m = new Mesh(new BoxGeometry(pw - 0.08, 0.055, pd - 0.1), panelMat);
      m.position.set(x, 0.33, z);
      m.rotation.x = -0.21;
      m.castShadow = true;
      m.userData.panel = true;
      g.add(m);
      const leg = new Mesh(new BoxGeometry(0.05, 0.16, 0.05), legMat);
      leg.position.set(x, 0.24, z + 0.26);
      g.add(leg);
    }
  return g;
};

export const createWorld = (ctx: Ctx): WorldApi => {
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);

  // ---------- lights
  root.add(new HemisphereLight("#ffffff", "#6b7f8c", 1.4));
  const sun = new DirectionalLight("#fff4de", 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 28, bottom: -24, near: 1, far: 120 });
  sun.shadow.bias = -0.0006;
  root.add(sun, sun.target);

  // ---------- bed (cut by z = 0) + rock speckles on the face
  k.add(new Mesh(bedSlab(), k.mat("#7d6b52")));
  const speck = k.particles(140, "#54452f", 0.05);
  {
    const r = rng(21);
    for (let i = 0; i < 140; i++) {
      const x = -28 + r() * 54;
      const depth = -bedY(x) - 0.35 + r() * (-bedY(x) - 0.35 - (BOT + 0.3));
      setInstance(speck, i, x, bedY(x) - 0.35 - Math.abs(depth) * 0.5, 0.03, 1);
    }
    speck.instanceMatrix.needsUpdate = true;
  }

  // ---------- water: translucent box (aquarium) + brighter surface plane
  const water = new Mesh(
    new BoxGeometry(54.5, 6.9, -ZB),
    new MeshStandardMaterial({ color: "#4a94bd", transparent: true, opacity: 0.28, roughness: 0.15, depthWrite: false, side: DoubleSide }),
  );
  water.position.set(-0.75, -3.45, ZB / 2);
  root.add(water);
  const surf = new Mesh(
    new BoxGeometry(54.5, 0.06, -ZB),
    new MeshStandardMaterial({ color: "#5aa9cf", transparent: true, opacity: 0.72, roughness: 0.1, metalness: 0.15, depthWrite: false }),
  );
  surf.position.set(-0.75, WATER_Y + 0.03, ZB / 2);
  root.add(surf);

  // under-blocker: closes the void below the bed silhouette against the pale sky
  k.box(-75, 95, BOT - 8, BOT, -75, 0, "#33291f");
  // ---------- left bank (substation ground) + right dam
  k.box(-28, -16.9, -0.05, 0.22, ZB, 0, "#b3ac9c"); // left ground
  k.box(DAM_X, 24, -5.1, CREST_Y, ZB, 0, k.mat("#b9b4a6", { flatShading: true })); // dam body
  k.box(DAM_X, 24, CREST_Y, CREST_Y + 0.16, ZB, 0, "#8f8a7d"); // crest road
  k.box(DAM_X, 24, CREST_Y + 0.16, CREST_Y + 0.34, -1.15, -0.45, "#7d786c"); // parapet
  for (let i = 0; i < 5; i++) k.box(DAM_X + 0.4 + i * 1.35, DAM_X + 0.46 + i * 1.35, -5.0, CREST_Y, 0.002, 0.02, "#8f8a7d"); // joints
  k.box(DAM_X + 2.6, DAM_X + 4.6, -1.2, 1.6, 0.002, 0.05, "#5d5a52"); // spillway gate
  k.box(DAM_X, 21.5, -5.0, -3.2, -2.4, 0, "#a8a394"); // powerhouse
  for (const x of [DAM_X + 0.9, DAM_X + 2.3, DAM_X + 3.7]) {
    const arc = new Mesh(new CylinderGeometry(0.34, 0.34, 0.3, 16, 1, false, 0, Math.PI), k.mat("#3c3f45", { side: DoubleSide }));
    arc.rotation.z = Math.PI / 2;
    arc.position.set(x, -4.2, 0.02);
    root.add(arc);
  }
  for (const x of [DAM_X + 1.2, DAM_X + 3.4, DAM_X + 5.6]) {
    k.box(x - 0.03, x + 0.03, CREST_Y + 0.16, CREST_Y + 1.0, -0.75, -0.69, "#3f3f3a");
    const bulb = new Mesh(new ConeGeometry(0.09, 0.16, 6), k.mat("#fff6d8", { emissive: "#fff2c0", emissiveIntensity: 1.4 }));
    bulb.position.set(x, CREST_Y + 1.05, -0.72);
    root.add(bulb);
  }

  // ---------- back hills + far ground plane
  {
    const r = rng(31);
    for (let i = 0; i < 9; i++) {
      const x = -34 + i * 8.5 + (r() - 0.5) * 3;
      const h = 5.5 + r() * 5.5, rad = 4.5 + r() * 3.4;
      const hill = new Mesh(new ConeGeometry(rad, h, 7), k.mat(r() < 0.5 ? "#8ba47e" : "#9db18c", { flatShading: true }));
      hill.position.set(x, h / 2 - 0.4, ZB * 1.15 - r() * 4);
      root.add(hill);
    }
    k.box(-60, 80, -0.5, -0.05, -80, ZB, "#b9c4a8");
  }

  // ---------- the eight islands (indices 6 & 7 start ghosted)
  const islandGroups = ISLANDS.map((p) => {
    const g = buildIsland(k);
    g.position.set(p.x, 0, p.z);
    root.add(g);
    return g;
  });
  const ghostMats: MeshStandardMaterial[] = [];
  for (const idx of GHOST) {
    islandGroups[idx].traverse((o) => {
      if (o instanceof Mesh && o.userData.panel) {
        const m = (o.material as MeshStandardMaterial).clone();
        m.transparent = true;
        m.opacity = 0.12;
        m.depthWrite = false;
        o.material = m;
        ghostMats.push(m);
      }
    });
  }

  // ---------- anchoring: 4 mooring lines per island + blocks on the bed
  const lineMat = k.mat("#24292f", { roughness: 0.7 });
  for (let i = 0; i < ISLANDS.length; i++) {
    const p = ISLANDS[i];
    const [W, D] = ISPAN;
    const corners: [number, number][] = [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]];
    for (const [cx, cz] of corners) {
      const ax = p.x + cx * 1.15, az = p.z + cz * 1.15;
      const ay = bedY(ax) + 0.02;
      const from = V(p.x + cx, -0.05, p.z + cz), to = V(ax, ay, az);
      const dir = to.clone().sub(from);
      const len = dir.length();
      const line = new Mesh(new CylinderGeometry(0.024, 0.024, len, 6), lineMat);
      line.position.copy(from.clone().add(to).multiplyScalar(0.5));
      line.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
      root.add(line);
      const block = new Mesh(new BoxGeometry(0.3, 0.16, 0.3), k.mat("#4a4a44"));
      block.position.set(ax, ay + 0.06, az);
      root.add(block);
    }
  }

  // ---------- export cable along the bed, rising up the shore
  const cableCurve = new CatmullRomCurve3(CABLE_POINTS.map((p) => V(p[0], p[1], p[2])));
  root.add(new Mesh(new TubeGeometry(cableCurve, 64, 0.085, 8), k.mat("#454c55", { roughness: 0.55 })));

  // ---------- shore substation: transformers, control house, lattice tower + line
  const SX = SUBSTATION_X;
  for (const dx of [-1.5, 0.9]) {
    k.box(SX + dx - 0.62, SX + dx + 0.62, 0.22, 1.05, -1.15, 0.05, k.mat("#6d7681", { metalness: 0.35, roughness: 0.5 }));
    for (const bx of [-0.3, 0, 0.3]) {
      const bush = new Mesh(new CylinderGeometry(0.07, 0.09, 0.34, 8), k.mat("#d8d2c4", { roughness: 0.4 }));
      bush.position.set(SX + dx + bx, 1.22, -0.55);
      root.add(bush);
    }
  }
  k.box(SX + 1.9, SX + 3.3, 0.22, 1.0, -1.6, -0.3, "#ece5d3"); // control house
  k.box(SX + 1.85, SX + 3.35, 1.0, 1.12, -1.65, -0.25, "#2f9a62");
  {
    const t = new Group();
    t.position.set(SX - 3.4, 0.22, -1.4);
    root.add(t);
    const legG = new CylinderGeometry(0.05, 0.07, 3.4, 6);
    for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] as [number, number][]) {
      const leg = new Mesh(legG, lineMat);
      leg.position.set(lx * 0.7, 1.7, lz * 0.7);
      leg.rotation.z = lx * 0.09;
      leg.rotation.x = -lz * 0.09;
      t.add(leg);
    }
    k.box(-1.1, 1.1, 3.0, 3.18, -0.09, 0.09, "#3f3f3a", t);
    k.box(-0.8, 0.8, 2.35, 2.5, -0.08, 0.08, "#3f3f3a", t);
    const wire = new Mesh(
      new TubeGeometry(new CatmullRomCurve3([V(SX - 4.5, 3.4, -1.4), V(SX - 7.5, 2.3, -2.2), V(-33, 1.5, -4)]), 32, 0.02, 5),
      lineMat,
    );
    root.add(wire);
  }

  // ---------- a small fishing boat + three gulls
  const boat = new Group();
  {
    const hull = new Mesh(new ConeGeometry(0.42, 1.5, 6), k.mat("#3a7bd5", { flatShading: true }));
    hull.rotation.z = Math.PI / 2;
    hull.scale.set(0.55, 1, 1);
    hull.position.y = 0.12;
    boat.add(hull);
    const cabin = new Mesh(new BoxGeometry(0.42, 0.26, 0.34), k.mat("#f2efe6"));
    cabin.position.set(-0.08, 0.32, 0);
    boat.add(cabin);
  }
  boat.position.set(-16.2, 0, -0.9);
  root.add(boat);
  const gulls: Group[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new Group();
    for (const s of [-1, 1]) {
      const wing = new Mesh(new BoxGeometry(0.34, 0.02, 0.08), k.mat("#f2f2ee"));
      wing.position.x = s * 0.19;
      wing.rotation.z = s * 0.38;
      g.add(wing);
    }
    root.add(g);
    gulls.push(g);
  }

  // ---------- effects: underwater motes, surface glints, cable pulses, cool-water arrows
  const motes = k.particles(80, "#bfe3f2", 0.04);
  const moteSeed = (() => {
    const r = rng(41);
    return Array.from({ length: 80 }, () => [-27 + r() * 53, -0.5 - r() * 5.2, -12.5 + r() * 12.3, 0.12 + r() * 0.22, r() * Math.PI * 2]);
  })();
  const glints = k.particles(46, "#ffffff", 0.05);
  const glintSeed = (() => {
    const r = rng(53);
    return Array.from({ length: 46 }, () => [-27 + r() * 52, -12.5 + r() * 12.3, r() * Math.PI * 2, 0.6 + r() * 0.8]);
  })();
  const pulseGeo = new ConeGeometry(0.1, 0.3, 8);
  pulseGeo.rotateZ(-Math.PI / 2);
  const pulses = new InstancedMesh(pulseGeo, new MeshStandardMaterial({ color: "#ffd24a", emissive: "#ffc21e", emissiveIntensity: 2.0 }), 7);
  pulses.frustumCulled = false;
  root.add(pulses);
  const arrowGeo = new ConeGeometry(0.07, 0.26, 8);
  arrowGeo.rotateX(Math.PI);
  const coolArrows = new InstancedMesh(
    arrowGeo,
    new MeshStandardMaterial({ color: "#6fd3ff", emissive: "#35b6ff", emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }),
    12,
  );
  coolArrows.frustumCulled = false;
  root.add(coolArrows);
  const tmpE = new Euler();

  return {
    root,
    update: (t, shotId, pose, scene) => {
      const warm = S.warm(t);
      const bg = SKY.clone().lerp(SKY_WARM, warm);
      scene.background = bg;
      scene.fog = new Fog(bg, 55, 175);
      sun.color.set("#fff4de").lerp(new Color("#ffbf80"), warm);
      sun.position.set(pose.target[0] + 14, pose.target[1] + 22, pose.target[2] + 18);
      sun.target.position.set(...pose.target);
      sun.target.updateMatrixWorld();

      // islands bob; the two unfinished ones settle during shot I
      const g = S.ghost(t);
      for (let i = 0; i < islandGroups.length; i++) {
        const isGhost = GHOST.includes(i);
        islandGroups[i].position.y = S.bob(i, t) + (isGhost ? (1 - g) * 1.0 : 0);
      }
      for (const m of ghostMats) m.opacity = 0.12 + 0.88 * g;

      // pulses racing along the export cable (shot G only)
      pulses.visible = shotId === "G";
      if (pulses.visible) {
        for (let i = 0; i < 7; i++) {
          const u = S.pulse(t, i, 0.14);
          const p = cableCurve.getPoint(u);
          const tan = cableCurve.getTangent(u);
          tmpE.set(0, Math.atan2(tan.x, tan.z), 0);
          setInstance(pulses, i, p.x, p.y, p.z, 1, tmpE);
        }
        pulses.instanceMatrix.needsUpdate = true;
      }

      // cool-water arrows under island #2 (shot E only)
      coolArrows.visible = shotId === "E";
      if (coolArrows.visible) {
        const ip = ISLANDS[1];
        const str = S.cool(t);
        for (let i = 0; i < 12; i++) {
          const u = (t * 0.55 + i / 12) % 1;
          const x = ip.x - ISPAN[0] / 2 + (i % 6) * (ISPAN[0] / 5);
          const z = ip.z + (i < 6 ? -0.9 : 0.9);
          setInstance(coolArrows, i, x, -0.5 - u * 1.6, z, 0.6 + 0.5 * str * (1 - u));
        }
        coolArrows.instanceMatrix.needsUpdate = true;
      }

      // underwater motes drifting with the current
      for (let i = 0; i < 80; i++) {
        const [x0, y0, z0, sp, ph] = moteSeed[i];
        setInstance(motes, i, x0 + Math.sin(t * 0.3 + ph) * 0.15, y0 - ((t * sp + ph) % 2.4), z0, 1);
      }
      motes.instanceMatrix.needsUpdate = true;

      // sun glints dancing on the surface
      for (let i = 0; i < 46; i++) {
        const [x0, z0, ph, sp] = glintSeed[i];
        setInstance(glints, i, x0, WATER_Y + 0.07, z0, Math.max(0.05, Math.sin(t * sp + ph)) ** 2 * 1.15);
      }
      glints.instanceMatrix.needsUpdate = true;

      // boat drifts and bobs
      boat.position.x = -16.2 + S.boat(t);
      boat.position.y = Math.sin(t * 1.1) * 0.05;
      boat.rotation.z = Math.sin(t * 0.9 + 0.6) * 0.05;

      // gulls circle above the islands
      for (let i = 0; i < gulls.length; i++) {
        const a = t * 0.18 + (i * Math.PI * 2) / 3;
        gulls[i].position.set(-4 + Math.cos(a) * 9, 5.6 + Math.sin(t * 0.5 + i * 2) * 0.5 + i * 0.7, -6 + Math.sin(a) * 6.5);
        gulls[i].rotation.y = -a;
        gulls[i].rotation.z = Math.sin(t * 2 + i) * 0.06;
      }
    },
  };
};
