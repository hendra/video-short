import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { BufferGeometry, BufferAttribute } from "three";
import { Kit, setInstance } from "../../engine/kit";
import { clamp, lerp, rng, smooth } from "../../engine/math";
import type { Ctx, WorldApi } from "../../engine/types";
import { CRATER, CRATER_R, MX, makeState, terrainHeight } from "./state";

const SPACE = new Color("#05070f");
const SPACE_WARM = new Color("#190f08");
const SUN_WARM = new Color("#ffcf9a");
export const createWorld = (ctx: Ctx): WorldApi => {
  const { L } = ctx;
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);

  // ---------- lights
  const hemi = new HemisphereLight("#2c3554", "#1b1512", 0.95);
  root.add(hemi);
  const sun = new DirectionalLight("#ffe3c2", 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 120 });
  sun.shadow.bias = -0.0006;
  root.add(sun, sun.target);
  const earthFill = new DirectionalLight("#5d7ec0", 0.35);
  earthFill.position.set(-30, 14, 20);
  root.add(earthFill);

  // ---------- stars
  {
    const r = rng(42);
    const pts: number[] = [];
    for (let i = 0; i < 460; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u), rad = 125 + r() * 30;
      pts.push(rad * s * Math.cos(a), Math.abs(rad * u) * 0.7 - 8, rad * s * Math.sin(a));
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
    const stars = new Points(g, new PointsMaterial({ color: "#dce8ff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }));
    stars.frustumCulled = false;
    root.add(stars);
  }

  // ---------- Earth in the black sky (upper left)
  const earth = new Group();
  earth.position.set(13.5, 4.6, -27);
  root.add(earth);
  const ER = 3.9;
  earth.add(new Mesh(new SphereGeometry(ER, 32, 20), new MeshBasicMaterial({ color: "#35608e" })));
  {
    const r = rng(11);
    const landCols = ["#2e5a3e", "#3f6b46", "#6b5a3e"];
    for (let i = 0; i < 16; i++) {
      const az = (r() * 2 - 1) * 2.4, e = (r() * 2 - 1) * 1.1;
      const dir = { x: Math.sin(az) * Math.cos(e), y: Math.sin(e), z: Math.cos(az) * Math.cos(e) };
      const blob = new Mesh(new IcosahedronGeometry(0.7 + r() * 1.15, 0), new MeshBasicMaterial({ color: landCols[i % 3] }));
      blob.position.set(dir.x * (ER + 0.03), dir.y * (ER + 0.03), dir.z * (ER + 0.03));
      blob.scale.set(1.3 + r() * 1.3, 0.8 + r() * 0.7, 0.28);
      blob.lookAt(0, 0, 0);
      earth.add(blob);
    }
    // polar cap
    const cap = new Mesh(new SphereGeometry(ER * 0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3.1), new MeshBasicMaterial({ color: "#dfe8ec" }));
    cap.position.y = ER * 0.82;
    earth.add(cap);
  }
  const earthShell = new Mesh(new SphereGeometry(ER + 0.5, 24, 16), new MeshBasicMaterial({ color: "#4f8fd0", transparent: true, opacity: 0.18, blending: 2, depthWrite: false, side: 1 }));
  earth.add(earthShell);

  // ---------- the Sun: low on the horizon, blinding at grazing angle
  const sunBall = new Group();
  sunBall.position.set(46, 2.6, -34);
  root.add(sunBall);
  sunBall.add(new Mesh(new SphereGeometry(2.6, 20, 14), new MeshBasicMaterial({ color: "#fff8dc" })));
  const glow1 = new Mesh(new SphereGeometry(3.6, 16, 12), new MeshBasicMaterial({ color: "#ffedb0", transparent: true, opacity: 0.4, blending: 2, depthWrite: false }));
  const glow2 = new Mesh(new SphereGeometry(5.2, 16, 12), new MeshBasicMaterial({ color: "#ffd98a", transparent: true, opacity: 0.16, blending: 2, depthWrite: false }));
  sunBall.add(glow1, glow2);

  // ---------- terrain (displaced plane, crater bowl carved in)
  const terrainGeo = new PlaneGeometry(110, 70, 100, 64);
  terrainGeo.rotateX(-Math.PI / 2);
  {
    const p = terrainGeo.attributes.position as BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i)));
    terrainGeo.computeVertexNormals();
  }
  const terrain = new Mesh(terrainGeo, new MeshStandardMaterial({ color: "#9d9ca5", roughness: 0.97, flatShading: true }));
  terrain.receiveShadow = true;
  root.add(terrain);
  // far ridge silhouettes (cone mountains on the horizon)
  {
    const r = rng(23);
    const cols = ["#3a3944", "#45444e", "#33323c"];
    for (let i = 0; i < 11; i++) {
      const h = 4.5 + r() * 6.5, rad = 3.5 + r() * 4.5;
      const cone = new Mesh(new ConeGeometry(rad, h, 5), k.mat(cols[i % 3], { roughness: 1 }));
      cone.position.set(-52 + i * 10.5 + (r() - 0.5) * 5, h / 2 - 0.4, -26 - r() * 7);
      cone.rotation.y = r() * Math.PI;
      root.add(cone);
    }
  }
  // crater rim rocks
  {
    const r = rng(7);
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const d = CRATER_R + (r() - 0.5) * 0.9;
      const rock = new Mesh(new IcosahedronGeometry(0.14 + r() * 0.22, 0), k.mat("#6e6d78", { roughness: 1 }));
      rock.position.set(CRATER[0] + Math.cos(a) * d, terrainHeight(CRATER[0] + Math.cos(a) * d, CRATER[2] + Math.sin(a) * d) + 0.08, CRATER[2] + Math.sin(a) * d);
      rock.rotation.set(r() * 3, r() * 3, r() * 3);
      root.add(rock);
    }
  }
  // permanent-shadow disc at the bottom of the bowl (the never-lit zone)
  const bowlY = terrainHeight(CRATER[0], CRATER[2]);
  const shadowDisc = new Mesh(new CircleGeometry(CRATER_R - 0.7, 36), new MeshStandardMaterial({ color: "#04060c", roughness: 1 }));
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.set(CRATER[0], bowlY + 0.07, CRATER[2]);
  root.add(shadowDisc);
  // cold uplight from the shadowed ice
  const iceLight = new PointLight("#79c4ff", 0, 9);
  iceLight.position.set(CRATER[0], bowlY + 0.9, CRATER[2]);
  root.add(iceLight);

  // ---------- ice crystals (glow in lines 8–9)
  const iceMat = new MeshStandardMaterial({ color: "#bfe8ff", emissive: "#7ecbff", emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.1, flatShading: true });
  const ices: Mesh[] = [];
  {
    const r = rng(31);
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, d = r() * (CRATER_R - 1.6);
      const x = CRATER[0] + Math.cos(a) * d, z = CRATER[2] + Math.sin(a) * d;
      const y = terrainHeight(x, z) + 0.16 + r() * 0.28;
      const s = 0.075 + r() * 0.11;
      const m = new Mesh(new OctahedronGeometry(s), iceMat);
      m.position.set(x, y, z);
      m.rotation.set(r() * 3, r() * 3, r() * 3);
      m.scale.y = 1.35 + r() * 0.5;
      root.add(m);
      ices.push(m);
    }
  }
  // frost motes drifting inside the bowl
  const frost = k.particles(70, "#cfe6ff", 0.045);
  const frostSeed = (() => { const r = rng(53); return Array.from({ length: 70 }, () => [CRATER[0] + (r() * 2 - 1) * (CRATER_R - 1.2), bowlY + r() * 2.4, CRATER[2] + (r() * 2 - 1) * (CRATER_R - 1.2), r() * 2]); })();

  // ---------- PROMISE rover (origin at terrain height, faces +x)
  const rover = new Group();
  root.add(rover);
  {
    const white = k.mat("#e8e6e0", { roughness: 0.5, metalness: 0.15 });
    const gold = k.mat("#d9a94f", { metalness: 0.65, roughness: 0.38 });
    const dark = k.mat("#23262c", { roughness: 0.6, metalness: 0.35 });
    // chassis
    const body = new Mesh(new BoxGeometry(1.55, 0.4, 1.08), white);
    body.position.y = 0.78; body.castShadow = true; rover.add(body);
    const belly = new Mesh(new BoxGeometry(1.2, 0.14, 0.9), gold);
    belly.position.y = 0.54; rover.add(belly);
    const stripe = new Mesh(new BoxGeometry(1.56, 0.07, 1.09), k.mat("#e8622c", { roughness: 0.5 }));
    stripe.position.y = 0.78; rover.add(stripe);
    // rocker arms + 6 wheels
    const wheelGeo = new CylinderGeometry(0.27, 0.27, 0.17, 14);
    wheelGeo.rotateX(Math.PI / 2);
    for (const sx of [-0.55, 0, 0.55]) {
      for (const sz of [-0.62, 0.62]) {
        const arm = new Mesh(new BoxGeometry(0.34, 0.07, 0.07), dark);
        arm.position.set(sx * 0.9, 0.45, sz * 0.72);
        arm.rotation.z = sx === 0 ? 0 : sx > 0 ? 0.35 : -0.35;
        rover.add(arm);
        const wheel = new Mesh(wheelGeo, k.mat("#2b2f33", { roughness: 0.85 }));
        wheel.position.set(sx, 0.27, sz);
        wheel.name = `wheel_${sx}_${sz}`;
        wheel.castShadow = true;
        rover.add(wheel);
        const hub = new Mesh(new CylinderGeometry(0.09, 0.09, 0.18, 8), k.mat("#c8cacf", { metalness: 0.6, roughness: 0.4 }));
        hub.geometry.rotateX(Math.PI / 2);
        hub.position.set(sx, 0.27, sz);
        rover.add(hub);
      }
    }
    // RTG at the rear: cylinder + radial fins (glows hot)
    const rtgGroup = new Group();
    rtgGroup.position.set(-0.92, 0.72, 0);
    rover.add(rtgGroup);
    const rtgBody = new Mesh(new CylinderGeometry(0.15, 0.15, 0.52, 12), k.mat("#8f939c", { metalness: 0.55, roughness: 0.4 }));
    rtgBody.rotation.z = Math.PI / 2;
    rtgGroup.add(rtgBody);
    const finMat = new MeshStandardMaterial({ color: "#b8481f", emissive: "#ff6a1a", emissiveIntensity: 1.0, roughness: 0.5, flatShading: true });
    rtgGroup.name = "rtg";
    const finGeo = new BoxGeometry(0.5, 0.035, 0.16);
    for (let i = 0; i < 8; i++) {
      const fin = new Mesh(finGeo, finMat);
      const a = (i * Math.PI) / 4;
      fin.position.set(0, Math.cos(a) * 0.2, Math.sin(a) * 0.2);
      fin.rotation.x = -a;
      fin.name = "rtgFin";
      rtgGroup.add(fin);
    }
    rtgGroup.userData.finMat = finMat;
    // mast + navcam head
    const mast = new Mesh(new CylinderGeometry(0.045, 0.05, 0.92, 8), white);
    mast.position.set(0.35, 1.42, -0.25);
    rover.add(mast);
    const head = new Mesh(new BoxGeometry(0.16, 0.14, 0.36), dark);
    head.position.set(0.35, 1.9, -0.25);
    head.name = "navcam";
    rover.add(head);
    for (const sz of [-0.36, -0.14]) {
      const eye = new Mesh(new CylinderGeometry(0.035, 0.035, 0.03, 8), k.mat("#0b0d10", { roughness: 0.2, metalness: 0.6 }));
      eye.geometry.rotateZ(Math.PI / 2);
      eye.position.set(0.44, 1.9, sz);
      rover.add(eye);
    }
    // high-gain dish + whip antenna
    const dish = new Mesh(new ConeGeometry(0.19, 0.16, 12), k.mat("#dcd8cc", { roughness: 0.55, side: DoubleSide }));
    dish.position.set(-0.25, 1.12, 0.32);
    dish.rotation.x = -0.7;
    rover.add(dish);
    const whip = new Mesh(new CylinderGeometry(0.012, 0.012, 0.55, 6), dark);
    whip.position.set(-0.62, 1.2, -0.35);
    whip.rotation.z = 0.28;
    rover.add(whip);
  }
  // drill rig at the front (slider moves down during line 6)
  const drillRig = new Group();
  drillRig.position.set(0.78, 0, 0.24);
  rover.add(drillRig);
  const rigMast = new Mesh(new CylinderGeometry(0.055, 0.065, 1.05, 8), k.mat("#c8cacf", { metalness: 0.4, roughness: 0.45 }));
  rigMast.position.y = 0.95;
  drillRig.add(rigMast);
  const slider = new Group();
  drillRig.add(slider);
  const sliderBlock = new Mesh(new BoxGeometry(0.2, 0.14, 0.2), k.mat("#e8622c", { roughness: 0.5 }));
  slider.add(sliderBlock);
  const bit = new Mesh(new CylinderGeometry(0.055, 0.075, 0.62, 8), k.mat("#9aa0a8", { metalness: 0.7, roughness: 0.3 }));
  bit.position.y = -0.36;
  slider.add(bit);
  const bitTip = new Mesh(new ConeGeometry(0.075, 0.16, 8), k.mat("#5d646b", { metalness: 0.7, roughness: 0.3 }));
  bitTip.position.y = -0.74;
  bitTip.rotation.x = Math.PI;
  slider.add(bitTip);
  // regolith chips flung while drilling
  const chips = k.particles(50, "#a08b6f", 0.05);
  const chipSeed = (() => { const r = rng(61); return Array.from({ length: 50 }, () => [r() * Math.PI * 2, 0.3 + r() * 0.8, 0.4 + r() * 0.5]); })();
  // drill contact point on the ground (world space, updated per frame)
  // spectrometer sweep beam from the navcam to the ground
  const beam = new Mesh(new ConeGeometry(0.55, 1, 14, 1, true), new MeshBasicMaterial({ color: "#aef0ff", blending: 2, transparent: true, opacity: 0, depthWrite: false, side: 2 }));
  beam.frustumCulled = false;
  root.add(beam);

  // ---------- "spares from Mars" schematic diorama (shot I, schematic) at MX
  const map = new Group();
  map.position.set(MX, 0, 0);
  root.add(map);
  {
    const base = new Mesh(new BoxGeometry(5.6, 0.35, 3.0), k.mat("#20242e", { roughness: 0.7 }));
    base.position.y = -0.18;
    map.add(base);
    // stylised red Mars disc on the horizon of the diorama
    const mars = new Mesh(new CircleGeometry(1.6, 32), new MeshBasicMaterial({ color: "#b5482e" }));
    mars.position.set(0, 1.5, -3.05);
    map.add(mars);
    const marsGlow = new Mesh(new CircleGeometry(2.0, 32), new MeshBasicMaterial({ color: "#d4694a", transparent: true, opacity: 0.35, blending: 2, depthWrite: false }));
    marsGlow.position.set(0, 1.5, -3.1);
    map.add(marsGlow);
    const cols = ["#c8c8c8", "#d8cfc0", "#e8e6e0"];
    for (let i = 0; i < 3; i++) {
      const mini = new Group();
      mini.position.set(-1.75 + i * 1.75, 0, 0);
      map.add(mini);
      const body = new Mesh(new BoxGeometry(1.25, 0.34, 0.85), k.mat(cols[i], { roughness: 0.55, metalness: 0.2 }));
      body.position.y = 0.42;
      mini.add(body);
      // rocker arms + 6 wheels (matching PROMISE's six-wheel layout)
      const wg = new CylinderGeometry(0.14, 0.14, 0.1, 10);
      wg.rotateX(Math.PI / 2);
      for (const sx of [-0.42, 0, 0.42]) for (const sz of [-0.48, 0.48]) {
        const w = new Mesh(wg, k.mat("#2b2f33", { roughness: 0.85 }));
        w.position.set(sx, 0.14, sz);
        mini.add(w);
      }
      const mast = new Mesh(new CylinderGeometry(0.035, 0.035, 0.6, 6), k.mat(cols[i], { roughness: 0.5 }));
      mast.position.set(0.3, 0.85, -0.18);
      mini.add(mast);
      const head = new Mesh(new BoxGeometry(0.12, 0.1, 0.26), k.mat("#23262c", { roughness: 0.4 }));
      head.position.set(0.3, 1.16, -0.18);
      mini.add(head);
    }
  }

  const heading = -Math.atan2(0.6 - 2.6, 1.4 - -4.6); // faces travel direction (home → end)
  // scratch objects reused per frame
  const iceBaseY = ices.map((m) => m.position.y);

  return {
    root,
    update: (t, shotId, pose, scene) => {
      const warm = S.warm(t);
      const bg = SPACE.clone().lerp(SPACE_WARM, warm);
      scene.background = bg;
      scene.fog = null;
      sun.color.set("#ffe3c2").lerp(SUN_WARM, warm);
      sun.intensity = 2.6 + warm * 0.5;
      hemi.intensity = 0.95 + warm * 0.15;
      sun.position.set(pose.target[0] + 34, pose.target[1] + 10.5, pose.target[2] - 19);
      sun.target.position.set(pose.target[0], pose.target[1], pose.target[2]);
      sun.target.updateMatrixWorld();
      earthShell.rotation.y = t * 0.03;

      // ===== rover placement (pure function of t)
      const rp = S.roverPos(t);
      rover.position.set(rp[0], rp[1], rp[2]);
      rover.rotation.y = heading;
      const spin = S.wheelSpin(t);
      rover.traverse((o) => {
        if (o.name.startsWith("wheel_")) o.rotation.z = -spin;
      });

      // ===== drill rig (line 6)
      const d = S.drill(t);
      slider.position.y = lerp(1.12, 0.3, d);
      bit.scale.y = lerp(0.55, 1.15, d);
      bitTip.position.y = -0.36 - 0.31 * bit.scale.y - 0.08;
      drillRig.visible = shotId !== "I" && shotId !== "L";
      // regolith chips while boring
      chips.visible = d > 0.45;
      if (chips.visible) {
        for (let i = 0; i < 50; i++) {
          const [a0, sp, rr] = chipSeed[i];
          const u = (t * 0.9 + i / 50) % 1;
          const ang = a0 + t * 0.8;
          const rad = rr * (0.4 + u * 0.9);
          const x = rp[0] + Math.cos(heading) * 0.78 - Math.sin(heading) * 0.24 + Math.cos(ang) * rad;
          const z = rp[2] + Math.sin(heading) * 0.78 + Math.cos(heading) * 0.24 + Math.sin(ang) * rad;
          const h = terrainHeight(x, z);
          setInstance(chips, i, x, h + 0.05 + (1 - u) * sp * 0.55, z, 0.7 * (1 - u * 0.6));
        }
        chips.instanceMatrix.needsUpdate = true;
      }

      // ===== scanner beam (line 7)
      const sc = S.scan(t);
      beam.visible = sc > 0.02;
      if (beam.visible) {
        const a = L(7).s + 0.8, b = L(7).e - 0.4;
        const u = clamp((t - a) / Math.max(0.1, b - a));
        const sweep = lerp(-0.9, 0.9, smooth(u));
        // navcam head in world space (local offset rotated by heading)
        const ch = Math.cos(heading), sh = Math.sin(heading);
        const headPos = {
          x: rp[0] + ch * 0.35 - sh * -0.25,
          y: rp[1] + 1.9,
          z: rp[2] + sh * 0.35 + ch * -0.25,
        };
        const ang = heading + sweep * 0.75;
        const dist = 2.3;
        const tip = { x: headPos.x + Math.cos(ang) * dist, y: terrainHeight(headPos.x + Math.cos(ang) * dist, headPos.z + Math.sin(ang) * dist) + 0.04, z: headPos.z + Math.sin(ang) * dist };
        const dir = new Vector3(tip.x - headPos.x, tip.y - headPos.y, tip.z - headPos.z);
        const len = dir.length();
        dir.normalize();
        beam.scale.set(1, len, 1);
        beam.position.set((headPos.x + tip.x) / 2, (headPos.y + tip.y) / 2, (headPos.z + tip.z) / 2);
        beam.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), dir);
        beam.material.opacity = 0.42 * sc;
      }

      // ===== RTG heat glow (line 5, idle afterwards)
      const finMat = (root.getObjectByName("rtg")?.userData.finMat ?? null) as MeshStandardMaterial | null;
      if (finMat) finMat.emissiveIntensity = S.rtg(t) * 1.7;

      // ===== ice crystals: brighter through lines 8–9, gentle bob
      iceMat.emissiveIntensity = 0.5 + 1.9 * S.ice(t);
      for (let i = 0; i < ices.length; i++) {
        ices[i].position.y = iceBaseY[i] + 0.05 * Math.sin(t * 1.1 + i * 0.9);
      }
      iceLight.intensity = 0.5 + 2.4 * S.ice(t);

      // ===== frost motes drifting down inside the bowl (from line 8)
      const fo = S.frost(t);
      frost.visible = fo > 0.03;
      if (frost.visible) {
        for (let i = 0; i < 70; i++) {
          const [x, y0, z, ph] = frostSeed[i];
          const y = y0 - ((t * 0.35 + ph) % 2.4);
          const yy = Math.max(bowlY + 0.15, y);
          setInstance(frost, i, x + Math.sin(t * 0.7 + ph * 3) * 0.18, yy, z + Math.cos(t * 0.6 + ph * 2) * 0.18, 0.8 * fo);
        }
        frost.instanceMatrix.needsUpdate = true;
      }

      // ===== schematic "Mars spares" diorama only in shot I
      map.visible = shotId === "I";

      // ===== chips flung near the drill only while boring
      chips.visible = chips.visible && shotId === "E";
    },
  };
};
