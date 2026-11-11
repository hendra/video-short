/**
 * Cable-stayed bridge diorama (schematic, Suramadu-inspired) + a small
 * beam-girder bridge for the news hook (Sentong). Everything pure fn of t.
 */
import {
  BoxGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, Euler, Fog, Group,
  HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3,
} from "three";
import { Kit, setInstance } from "../../engine/kit";
import { lerp, smooth } from "../../engine/math";
import type { Ctx, WorldApi } from "../../engine/types";
import { APP, DECK_T, DECK_Y, HALF_W, SEA_Y, SMALL_X, SPAN, TOWER_TOP, makeState } from "./state";

const SKY_DAY = new Color("#cfe3ea");
const SKY_WARM = new Color("#f5cfa5");
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

export const createWorld = (ctx: Ctx): WorldApi => {
  const { shot } = ctx;
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);

  // ---------- lights
  root.add(new HemisphereLight("#ffffff", "#4d6a55", 1.35));
  const sun = new DirectionalLight("#fff3df", 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 30, bottom: -20, near: 1, far: 130 });
  sun.shadow.bias = -0.0006;
  root.add(sun, sun.target);

  // ---------- sea (two water planes) + distant land strip
  k.add(new Mesh(new BoxGeometry(400, 0.4, 300), k.mat("#2a5b74", { roughness: 0.35, metalness: 0.1 })), root, false).position.set(0, SEA_Y - 0.2, 0);
  k.add(new Mesh(new BoxGeometry(400, 0.1, 300), k.mat("#35698a", { roughness: 0.3 })), root, false).position.set(0, SEA_Y + 0.02, 0);
  // distant land on the north side (behind the bridge)
  k.add(new Mesh(new BoxGeometry(400, 2.2, 40), k.mat("#5c7050")), root, false).position.set(0, SEA_Y + 0.7, -55);

  // ---------- islands where the bridge lands (Surabaya / Bangkalan side, stylized)
  const island = (x: number, mirror: number) => {
    const g = new Group(); g.position.set(x, 0, 0); root.add(g);
    k.add(new Mesh(new BoxGeometry(38, 2.4, 24), k.mat("#7c8b62")), g, false).position.set(mirror * 6, SEA_Y + 0.6, 0);
    k.add(new Mesh(new BoxGeometry(30, 1.2, 18), k.mat("#8fa074")), g, false).position.set(mirror * 6, SEA_Y + 1.5, 0);
    return g;
  };
  island(-(SPAN + APP) - 2, -1);
  island(SPAN + APP + 2, 1);
  // low-poly buildings on both sides
  {
    const b = (x: number, z: number, h: number, c: string) => {
      k.add(new Mesh(new BoxGeometry(1.6 + h * 0.18, h, 1.6 + h * 0.14), k.mat(c)), root, true).position.set(x, SEA_Y + 1.2 + h / 2, z);
    };
    b(-31, -4, 3.6, "#b8c4cc"); b(-29, 2.4, 2.2, "#9fb6c4"); b(-28, -6.8, 1.6, "#cfc8b8"); b(-33.5, 1.8, 4.4, "#a7b7c2");
    b(31, 4, 2.6, "#b8c4cc"); b(29.5, -3.5, 1.8, "#cfc8b8"); b(34, 0.5, 3.4, "#9fb6c4");
  }

  // ---------- deck + edge girders (main spans + approach viaducts)
  const SPAN_X = SPAN + APP; // 31
  k.add(new Mesh(new BoxGeometry(SPAN_X * 2 + 2, DECK_T, HALF_W * 2), k.mat("#3b4550", { roughness: 0.6, metalness: 0.35 })), root).position.set(0, DECK_Y - DECK_T / 2, 0);
  k.add(new Mesh(new BoxGeometry(SPAN_X * 2 + 2, 0.28, 0.42), k.mat("#2e3841")), root).position.set(0, DECK_Y + 0.02, HALF_W - 0.12);
  k.add(new Mesh(new BoxGeometry(SPAN_X * 2 + 2, 0.28, 0.42), k.mat("#2e3841")), root).position.set(0, DECK_Y + 0.02, -HALF_W + 0.12);
  // road surface + lane markings
  k.add(new Mesh(new BoxGeometry(SPAN_X * 2 + 2, 0.06, HALF_W * 2 - 0.5), k.mat("#2b2f33")), root, false).position.set(0, DECK_Y + 0.03, 0);
  for (let x = -SPAN_X; x < SPAN_X; x += 1.7) k.add(new Mesh(new BoxGeometry(0.85, 0.02, 0.1), k.mat("#f4f1ea")), root, false).position.set(x + 0.45, DECK_Y + 0.065, 0);

  // ---------- approach viaduct piers (simple bent columns every 4 units)
  for (const sx of [-1, 1]) {
    for (let x = SPAN + 2; x < SPAN + APP; x += 4) {
      const px = sx * x;
      k.add(new Mesh(new CylinderGeometry(0.42, 0.5, DECK_Y - SEA_Y, 10), k.mat("#8f8b80")), root).position.set(px, (DECK_Y + SEA_Y) / 2, 0);
      k.add(new Mesh(new BoxGeometry(1.6, 0.5, 1.4), k.mat("#a3a094")), root).position.set(px, DECK_Y - DECK_T - 0.25, 0);
    }
  }

  // ---------- pylons (H-frame, twin columns from seabed to ~140 m)
  const pylonMat = new MeshStandardMaterial({ color: "#e9edf0", roughness: 0.55, metalness: 0.15, flatShading: true, emissive: "#e8622c", emissiveIntensity: 0 });
  for (const sx of [-1, 1]) {
    for (const z of [-1.05, 1.05]) {
      const col = new Mesh(new CylinderGeometry(0.5, 0.62, TOWER_TOP - SEA_Y + 1.6, 12), pylonMat);
      col.position.set(sx * SPAN, (TOWER_TOP + SEA_Y - 1.6) / 2, z);
      col.castShadow = true; root.add(col);
    }
    // crossbeams
    for (const y of [3.1, 7.2]) {
      const beam = new Mesh(new BoxGeometry(1.1, 0.75, 2.6), pylonMat);
      beam.position.set(sx * SPAN, y, 0);
      beam.castShadow = true; root.add(beam);
    }
    // pile cap below waterline
    k.add(new Mesh(new BoxGeometry(4.6, 1.3, 3.6), k.mat("#6f6a5f")), root).position.set(sx * SPAN, SEA_Y + 0.5, 0);
  }

  // ---------- cables (fan pattern), one material so we can pulse the emissive
  const cableMat = new MeshStandardMaterial({ color: "#dfe5ea", roughness: 0.4, metalness: 0.55, emissive: "#e8622c", emissiveIntensity: 0 });
  const cables: Mesh[] = [];
  const addCable = (px: number, pz: number, py: number, dx: number) => {
    const from = V(px, py, pz);
    const to = V(px + dx, DECK_Y + 0.02, pz);
    const dir = to.clone().sub(from);
    const len = dir.length();
    const geo = new CylinderGeometry(0.045, 0.045, len, 6);
    geo.translate(0, len / 2, 0);
    const m = new Mesh(geo, cableMat);
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    root.add(m);
    cables.push(m);
  };
  for (const sx of [-1, 1]) {
    for (const z of [-1.05, 1.05]) {
      // main-span side (toward centre) and approach side (outward)
      S.deckAnchorsMain.forEach((dx, i) => addCable(sx * SPAN, z, S.cableAnchors[i], -sx * dx));
      S.deckAnchorsApp.forEach((dx, i) => addCable(sx * SPAN, z, S.cableAnchors[i + 0], sx * dx * 1.0));
    }
  }

  // ---------- traffic (instanced trucks, two lanes)
  const TRUCKS = 16;
  const truckBody = new InstancedMesh(new BoxGeometry(0.85, 0.34, 0.34), new MeshStandardMaterial({ roughness: 0.55, flatShading: true }), TRUCKS);
  const truckBox = new InstancedMesh(new BoxGeometry(0.5, 0.3, 0.3), new MeshStandardMaterial({ color: "#e8e4da", roughness: 0.7 }), TRUCKS);
  truckBody.castShadow = truckBox.castShadow = true;
  truckBody.frustumCulled = truckBox.frustumCulled = false;
  {
    const cols = ["#e04f3e", "#3a7bd5", "#2e9b5b", "#f2c230", "#f2f2f2", "#1d2328"];
    for (let i = 0; i < TRUCKS; i++) truckBody.setColorAt(i, new Color(cols[i % cols.length]));
  }
  root.add(truckBody, truckBox);

  // ---------- ships (container vessels crossing under the main span)
  const ships = S.shipSeed.map(([speed, off, hull]) => {
    const g = new Group();
    k.add(new Mesh(new BoxGeometry(1.7, 0.55, 4.6), k.mat(hull, { roughness: 0.6 })), g).position.set(0, 0.32, 0);
    k.add(new Mesh(new BoxGeometry(0.9, 0.5, 0.9), k.mat("#d8d4c8")), g).position.set(0, 0.8, -1.5);
    for (const [cx, cz, cc] of [[-0.3, 0.8, "#c4473a"], [0.35, 0.2, "#3a7bd5"], [-0.25, -0.4, "#2e9b5b"], [0.3, -1.0, "#f2c230"]] as [number, number, string][])
      k.add(new Mesh(new BoxGeometry(0.62, 0.36, 0.8), k.mat(cc)), g).position.set(cx, 0.72, cz);
    g.position.set(0, SEA_Y + 0.02, off);
    root.add(g);
    return { g, speed, off };
  });

  // ---------- small bridge diorama (the news hook: Sentong)
  const small = new Group(); small.position.set(SMALL_X, 0, 10); root.add(small);
  k.add(new Mesh(new BoxGeometry(26, 2.2, 20), k.mat("#7c8b62")), small).position.set(0, SEA_Y + 0.5, 0);
  k.add(new Mesh(new BoxGeometry(7, 2.4, 20), k.mat("#2a5b74", { roughness: 0.35 })), small).position.set(0, SEA_Y + 1.1, 0); // river gap
  k.add(new Mesh(new BoxGeometry(26, 0.9, 3.4), k.mat("#4a443b")), small).position.set(0, DECK_Y + 0.1, 0); // deck
  for (const x of [-4.6, 0, 4.6]) k.add(new Mesh(new CylinderGeometry(0.34, 0.42, DECK_Y - SEA_Y, 10), k.mat("#8f8b80")), small).position.set(x, (DECK_Y + SEA_Y) / 2, 0);
  k.add(new Mesh(new BoxGeometry(3.2, 1.0, 2.6), k.mat("#cfc8b8")), small).position.set(-8, DECK_Y + 0.7, -4.5);
  k.add(new Mesh(new BoxGeometry(2.4, 0.8, 2.0), k.mat("#b5523c")), small).position.set(-8, DECK_Y + 1.5, -4.5);
  const stTruck = new InstancedMesh(new BoxGeometry(0.85, 0.4, 0.4), new MeshStandardMaterial({ color: "#f08a24", flatShading: true }), 3);
  stTruck.frustumCulled = false; small.add(stTruck);

  // ---------- arrows: cable tension (deck -> pylon) and pylon compression (down)
  const arrowGeo = new ConeGeometry(0.16, 0.42, 8); arrowGeo.translate(0, 0.21, 0);
  const cableArrows = new InstancedMesh(arrowGeo, new MeshStandardMaterial({ color: "#ffb03a", emissive: "#ffb03a", emissiveIntensity: 0.85 }), cables.length);
  const pylonArrows = new InstancedMesh(arrowGeo, new MeshStandardMaterial({ color: "#5ec9ff", emissive: "#5ec9ff", emissiveIntensity: 0.85 }), 12);
  cableArrows.frustumCulled = pylonArrows.frustumCulled = false;
  root.add(cableArrows, pylonArrows);
  const cableMeta = cables.map((m) => ({ pos: m.position.clone(), dir: new Vector3(0, 1, 0).applyQuaternion(m.quaternion), len: (m.geometry as CylinderGeometry).parameters.height as number }));
  const _m = new Matrix4(), _q = new Quaternion(), _p = new Vector3(), _s = new Vector3();

  return {
    root,
    update: (t, shotId, pose, scene) => {
      const lt = t - shot(shotId).s;
      const warm = shotId === "J" ? smooth(lt / 4) * 0.85 : 0;
      const bg = SKY_DAY.clone().lerp(SKY_WARM, warm);
      scene.background = bg; scene.fog = new Fog(bg, 60, 230);
      sun.color.set("#fff3df").lerp(new Color("#ffb06a"), warm);
      sun.position.set(pose.target[0] + 14, pose.target[1] + 26, pose.target[2] + 18);
      sun.target.position.set(...pose.target); sun.target.updateMatrixWorld();

      // Sentong diorama visible only in the news-hook shots
      small.visible = shotId === "A" || shotId === "B";
      for (let i = 0; i < 3; i++) {
        const x = -11 + ((((t * 3.4 + i * 8.2) % 22) + 22) % 22);
        setInstance(stTruck, i, x, DECK_Y + 0.75, i % 2 ? 0.62 : -0.62, 1.9);
      }
      stTruck.instanceMatrix.needsUpdate = true;

      // the big bridge is always in place; small diorama only in A/B

      const loadPull = S.loadPull(t);
      const towerPush = S.towerPush(t);
      cableMat.emissiveIntensity = loadPull * 0.75;
      pylonMat.emissiveIntensity = towerPush * 0.55;

      // trucks flow on the deck
      for (let i = 0; i < TRUCKS; i++) {
        const [lane, off, sp] = S.truckSeed[i];
        const dir = lane ? -1 : 1;
        const x = -SPAN_X - 1 + ((((off + dir * t * sp) % (SPAN_X * 2 + 2)) + (SPAN_X * 2 + 2)) % (SPAN_X * 2 + 2));
        const z = lane ? 0.68 : -0.68;
        setInstance(truckBody, i, x, DECK_Y + 0.26, z, 1);
        setInstance(truckBox, i, x - dir * 0.12, DECK_Y + 0.56, z, 1);
      }
      truckBody.instanceMatrix.needsUpdate = truckBox.instanceMatrix.needsUpdate = true;

      // ships cross under the main span (deterministic positions, wrapped)
      ships.forEach(({ g, speed, off }, i) => {
        const z = ((off + speed * t * 3.0) % 90 + 90) % 90 - 45;
        g.position.z = z;
        g.position.y = SEA_Y + 0.02 + Math.sin(t * 1.1 + i * 2.1) * 0.06;
      });

      // cable-tension arrows flowing deck -> pylon (visible in E and F)
      const cableArrowWant = shotId === "E" || shotId === "F" ? loadPull : 0;
      cableArrows.visible = cableArrowWant > 0.01;
      for (let i = 0; i < cableMeta.length; i++) {
        const m = cableMeta[i];
        const u = (t * 0.9 + i * 0.13) % 1;               // 0 at deck, 1 at pylon
        _p.copy(m.pos).addScaledVector(m.dir, (1 - u) * (m.len - 0.45));
        _q.setFromUnitVectors(V(0, 1, 0), m.dir.clone().negate());
        const fade = u < 0.12 ? u / 0.12 : u > 0.88 ? (1 - u) / 0.12 : 1;
        _s.setScalar(Math.max(0.01, fade));
        _m.compose(_p, _q, _s);
        cableArrows.setMatrixAt(i, _m);
      }
      cableArrows.instanceMatrix.needsUpdate = true;

      const pylonArrowWant = shotId === "F" ? towerPush : 0;
      pylonArrows.visible = pylonArrowWant > 0.01;
      if (pylonArrows.visible) {
        for (const sx of [-1, 1]) for (let j = 0; j < 6; j++) {
          const u = (t * 0.7 + j * 0.17) % 1;
          const y = lerp(TOWER_TOP - 1.2, SEA_Y + 1.2, u);
          setInstance(pylonArrows, (sx < 0 ? 0 : 6) + j, sx * SPAN, y, j % 2 ? 1.8 : -1.8, 1.15, new Euler(0, 0, Math.PI));
        }
        pylonArrows.instanceMatrix.needsUpdate = true;
      }

    },
  };
};
