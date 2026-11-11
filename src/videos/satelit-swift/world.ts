import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Line,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { BufferGeometry, BufferAttribute } from "three";
import { Kit, setInstance } from "../../engine/kit";
import { clamp, lerp, ramp, rng } from "../../engine/math";
import type { Ctx, WorldApi } from "../../engine/types";
import { EARTH_CY, ER, MX, OR, ORBIT_C, TILT, makeState } from "./state";

const SPACE = new Color("#060a1c");
const SPACE_WARM = new Color("#221219");
const SUN_WARM = new Color("#ffb46a");
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
const BURST = V(-8.6, 7.2, -9.5); // gamma-ray burst flash location (deep space)
const SUN_POS = V(48, 30, -70);

export const createWorld = (ctx: Ctx): WorldApi => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);

  // ---------- lights
  const hemi = new HemisphereLight("#46558a", "#04060d", 0.85);
  root.add(hemi);
  const key = new DirectionalLight("#fff1d6", 1.7);
  key.position.copy(SUN_POS);
  root.add(key);
  const fill = new DirectionalLight("#87a8e8", 0.45);
  fill.position.set(-22, 8, 28);
  root.add(fill);

  // ---------- stars (static far sphere, deterministic)
  {
    const r = rng(42);
    const pts: number[] = [];
    for (let i = 0; i < 420; i++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u), rad = 120 + r() * 30;
      pts.push(rad * s * Math.cos(a), rad * u, rad * s * Math.sin(a));
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
    const stars = new Points(g, new PointsMaterial({ color: "#dce8ff", size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }));
    stars.frustumCulled = false;
    root.add(stars);
  }

  // ---------- the Sun + glow + flare streak (flare active in line 6)
  const sun = new Group(); sun.position.copy(SUN_POS); root.add(sun);
  sun.add(new Mesh(new SphereGeometry(4.6, 24, 16), new MeshBasicMaterial({ color: "#fff7da" })));
  const sunGlow1 = new Mesh(new SphereGeometry(6.3, 18, 12), new MeshBasicMaterial({ color: "#ffe9a8", transparent: true, opacity: 0.32, blending: 2, depthWrite: false }));
  const sunGlow2 = new Mesh(new SphereGeometry(8.6, 18, 12), new MeshBasicMaterial({ color: "#ffcf7d", transparent: true, opacity: 0.12, blending: 2, depthWrite: false }));
  sun.add(sunGlow1, sunGlow2);
  const flare = new Group(); sun.add(flare);
  const flareCone = new Mesh(new ConeGeometry(1.5, 9, 10, 1, true), new MeshBasicMaterial({ color: "#ffb84d", transparent: true, opacity: 0.0, blending: 2, depthWrite: false, side: 2 }));
  flareCone.position.set(-8.5, -5.6, 8.2);
  flareCone.lookAt(0, 0, 0);
  flareCone.rotateX(Math.PI / 2);
  flare.add(flareCone);
  const flareArc = new Mesh(new TorusGeometry(4.9, 0.3, 6, 20, 1.15), new MeshBasicMaterial({ color: "#ffc46a", transparent: true, opacity: 0, blending: 2, depthWrite: false }));
  flareArc.rotation.set(0.4, 0.7, 2.2);
  flare.add(flareArc);

  // ---------- Earth (stylised low-poly) + land + island + city lights
  const earthMat = new MeshStandardMaterial({ color: "#2c5e9e", roughness: 0.82, flatShading: true });
  const earth = new Mesh(new SphereGeometry(ER, 44, 28), earthMat);
  earth.position.set(0, EARTH_CY, 0);
  earth.receiveShadow = true;
  root.add(earth);
  const landCols = ["#2e5a3e", "#274b34", "#6b5a3e"];
  {
    const r = rng(11);
    for (let i = 0; i < 20; i++) {
      const az = (r() * 2 - 1) * 1.28;
      const e = r() * 0.34;
      const u = V(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e)).normalize();
      const blob = new Mesh(new IcosahedronGeometry(1.1 + r() * 2.1, 0), k.mat(landCols[i % 3], { roughness: 0.95 }));
      blob.position.copy(u).multiplyScalar(ER + 0.02).add(V(0, EARTH_CY, 0));
      blob.lookAt(0, EARTH_CY, 0);
      blob.scale.set(1.4 + r() * 1.4, 0.85 + r() * 0.8, 0.22);
      blob.rotation.z = r() * Math.PI;
      root.add(blob);
    }
  }
  // "Sumatra" landmass on the near limb + city lights for the reentry beat
  const island = new Group();
  root.add(island);
  {
    const r = rng(23);
    for (let i = 0; i < 6; i++) {
      const blob = new Mesh(new IcosahedronGeometry(1.5 + r() * 1.9, 0), k.mat("#182a1f", { roughness: 1 }));
      blob.position.set(-6.4 + i * 2.35 + r() * 0.8, -0.72, 3.2 + r() * 2.6);
      blob.scale.set(1.5, 0.34, 1.05);
      island.add(blob);
    }
  }
  const cityLights = new InstancedMesh(new BoxGeometry(0.11, 0.06, 0.11), new MeshBasicMaterial({ color: "#ffd88a" }), 70);
  cityLights.frustumCulled = false;
  root.add(cityLights);
  {
    const r = rng(31);
    for (let i = 0; i < 70; i++) setInstance(cityLights, i, -6.6 + r() * 12.4, -0.56, 3.4 + r() * 3.1, 1);
    cityLights.instanceMatrix.needsUpdate = true;
  }

  // ---------- atmosphere shells (scale pulses with the Sun in line 6)
  const shellMat = new MeshStandardMaterial({ color: "#4f8fd0", transparent: true, opacity: 0.16, roughness: 0.4, depthWrite: false, emissive: "#1c3a5e", emissiveIntensity: 0.6 });
  const shell = new Mesh(new SphereGeometry(ER + 0.55, 36, 22), shellMat);
  shell.position.set(0, EARTH_CY, 0);
  root.add(shell);
  const limbMat = new MeshBasicMaterial({ color: "#5fa8e0", transparent: true, opacity: 0.55, side: 1, blending: 2, depthWrite: false }); // BackSide
  const limb = new Mesh(new SphereGeometry(ER + 1.35, 36, 22), limbMat);
  limb.position.set(0, EARTH_CY, 0);
  root.add(limb);

  // ---------- main orbit ring + spiral decay rings
  const ringMainMat = new MeshBasicMaterial({ color: "#6ee7ff", transparent: true, opacity: 0.4, blending: 2, depthWrite: false });
  const ringMain = new Mesh(new TorusGeometry(OR, 0.016, 6, 128), ringMainMat);
  ringMain.position.set(ORBIT_C[0], ORBIT_C[1], ORBIT_C[2]);
  ringMain.rotation.x = Math.PI / 2 - TILT;
  root.add(ringMain);
  const SPIRAL_R = [OR, 4.62, 4.04, 3.62, 3.25, 2.86];
  const spiralRings = SPIRAL_R.slice(1).map((r) => {
    const m = new MeshBasicMaterial({ color: "#8de3ff", transparent: true, opacity: 0, blending: 2, depthWrite: false });
    const ring = new Mesh(new TorusGeometry(r, 0.012, 6, 110), m);
    ring.position.set(ORBIT_C[0], ORBIT_C[1], ORBIT_C[2]);
    ring.rotation.x = Math.PI / 2 - TILT;
    root.add(ring);
    return m;
  });

  // ---------- Swift satellite
  const swift = new Group();
  root.add(swift);
  {
    const gold = k.mat("#d9a94f", { metalness: 0.7, roughness: 0.36, emissive: "#241a05", emissiveIntensity: 0.35 });
    const silver = k.mat("#cfd6dd", { metalness: 0.6, roughness: 0.3 });
    const bus = new Mesh(new CylinderGeometry(0.34, 0.34, 1.15, 18), gold);
    bus.rotation.z = Math.PI / 2;
    bus.castShadow = true;
    swift.add(bus);
    for (const sx of [-0.62, 0.62]) {
      const cap = new Mesh(new CylinderGeometry(0.345, 0.345, 0.1, 18), silver);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = sx;
      swift.add(cap);
    }
    const band = new Mesh(new CylinderGeometry(0.345, 0.345, 0.18, 18), k.mat("#14171c"));
    band.rotation.z = Math.PI / 2;
    band.position.x = 0.17;
    swift.add(band);
    const tube = new Mesh(new CylinderGeometry(0.13, 0.13, 0.62, 12), k.mat("#e9e6da", { roughness: 0.5 }));
    tube.position.set(0.12, 0.5, 0);
    tube.castShadow = true;
    swift.add(tube);
    const tubeCap = new Mesh(new CylinderGeometry(0.135, 0.135, 0.06, 12), k.mat("#14171c"));
    tubeCap.position.set(0.12, 0.82, 0);
    swift.add(tubeCap);
    const dish = new Mesh(new ConeGeometry(0.17, 0.22, 12), k.mat("#dcd8cc", { roughness: 0.55 }));
    dish.position.set(-0.28, -0.44, 0);
    dish.rotation.x = Math.PI;
    swift.add(dish);
    for (const sz of [-1, 1]) {
      const wing = new Mesh(new BoxGeometry(0.8, 0.05, 1.42), k.mat("#1b2a55", { metalness: 0.4, roughness: 0.5 }));
      wing.position.set(0, 0, sz * 1.06);
      wing.castShadow = true;
      swift.add(wing);
      for (const dz of [-0.47, 0, 0.47]) {
        const rib = new Mesh(new BoxGeometry(0.82, 0.055, 0.06), k.mat("#31437c", { metalness: 0.5 }));
        rib.position.set(0, 0, sz * 1.06 + dz);
        swift.add(rib);
      }
    }
    const beacon = new Mesh(new SphereGeometry(0.06, 8, 6), new MeshStandardMaterial({ color: "#ff4040", emissive: "#ff2020", emissiveIntensity: 1.4 }));
    beacon.name = "beacon";
    beacon.position.set(0, 0.24, 0.33);
    swift.add(beacon);
  }

  // ---------- fireball streak (shot A)
  const streakG = new Group();
  root.add(streakG);
  const streakCore = new Mesh(new SphereGeometry(0.17, 10, 8), new MeshBasicMaterial({ color: "#fff3c0", blending: 2, transparent: true, depthWrite: false }));
  const streakGlow = new Mesh(new SphereGeometry(0.5, 10, 8), new MeshBasicMaterial({ color: "#ff9a3c", blending: 2, transparent: true, opacity: 0.75, depthWrite: false }));
  const streakTail = new Mesh(new ConeGeometry(0.24, 3.1, 8, 1, true), new MeshBasicMaterial({ color: "#ffb84d", blending: 2, transparent: true, opacity: 0.55, side: 2, depthWrite: false }));
  streakTail.rotation.z = Math.PI / 2.35;
  streakG.add(streakCore, streakGlow, streakTail);
  const streakTrail = k.particles(26, "#ffca7a", 0.06);
  streakTrail.frustumCulled = false;

  // ---------- gamma-ray burst (shots I & K)
  const burstG = new Group();
  burstG.position.copy(BURST);
  root.add(burstG);
  const burstCore = new Mesh(new SphereGeometry(0.34, 10, 8), new MeshBasicMaterial({ color: "#ffffff", blending: 2, transparent: true, depthWrite: false }));
  const burstGlow = new Mesh(new SphereGeometry(1.15, 12, 8), new MeshBasicMaterial({ color: "#8ec9ff", blending: 2, transparent: true, opacity: 0.6, depthWrite: false }));
  const burstRing = new Mesh(new TorusGeometry(1.0, 0.045, 6, 48), new MeshBasicMaterial({ color: "#cfeaff", blending: 2, transparent: true, opacity: 0.5, depthWrite: false }));
  burstRing.rotation.x = 0.6;
  burstG.add(burstCore, burstGlow, burstRing);
  const spikeMat = new MeshBasicMaterial({ color: "#ffffff", blending: 2, transparent: true, opacity: 0.7, depthWrite: false });
  const spike1 = new Mesh(new BoxGeometry(4.4, 0.05, 0.05), spikeMat);
  const spike2 = new Mesh(new BoxGeometry(0.05, 4.4, 0.05), spikeMat);
  burstG.add(spike1, spike2);
  // instrument beam: cone from Swift toward the burst (shot I)
  const beam = new Mesh(new ConeGeometry(0.55, 1, 12, 1, true), new MeshBasicMaterial({ color: "#fdfdf2", blending: 2, transparent: true, opacity: 0.0, side: 2, depthWrite: false }));
  root.add(beam);

  // ---------- LINK rescue craft (shot H)
  const link = new Group();
  root.add(link);
  {
    const body = new Mesh(new BoxGeometry(0.44, 0.44, 0.44), k.mat("#dfe3e8", { metalness: 0.5, roughness: 0.35 }));
    body.castShadow = true;
    link.add(body);
    for (const sx of [-0.42, 0.42]) {
      const p = new Mesh(new BoxGeometry(0.5, 0.05, 0.62), k.mat("#2b3a6e", { metalness: 0.5 }));
      p.position.x = sx;
      link.add(p);
    }
    const beacon = new Mesh(new SphereGeometry(0.05, 8, 6), new MeshStandardMaterial({ color: "#4da6ff", emissive: "#2a86ff", emissiveIntensity: 1.5 }));
    beacon.name = "linkBeacon";
    beacon.position.set(0, 0.27, 0);
    link.add(beacon);
  }
  // dashed approach path (visible during the approach)
  const approachGeo = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]);
  const approachMat = new LineDashedMaterial({ color: "#ffffff", dashSize: 0.22, gapSize: 0.16, transparent: true, opacity: 0.7 });
  const approach = new Line(approachGeo, approachMat);
  approach.frustumCulled = false;
  root.add(approach);
  // spark burst at the failure moment
  const sparks = k.particles(26, "#ffb066", 0.055);
  const sparkVel = (() => { const r = rng(63); return Array.from({ length: 26 }, () => V((r() - 0.5) * 2.2, r() * 1.6 + 0.4, (r() - 0.5) * 2.2)); })();

  // ---------- reentry plasma + trail + end flash
  const plasma = new Mesh(new SphereGeometry(0.52, 12, 10), new MeshBasicMaterial({ color: "#ff9a3c", blending: 2, transparent: true, opacity: 0, depthWrite: false }));
  root.add(plasma);
  const fireLight = new DirectionalLight("#ff8a3c", 0);
  fireLight.position.set(0, 4, 6);
  root.add(fireLight);
  const fire = k.particles(70, "#ff8a3c", 0.075);
  const flashCore = new Mesh(new SphereGeometry(0.8, 14, 10), new MeshBasicMaterial({ color: "#ffffff", blending: 2, transparent: true, opacity: 0, depthWrite: false }));
  const flashRing = new Mesh(new TorusGeometry(1.0, 0.06, 6, 48), new MeshBasicMaterial({ color: "#ffe9c0", blending: 2, transparent: true, opacity: 0, depthWrite: false }));
  root.add(flashCore, flashRing);

  // ---------- Newton's cannonball diorama (shot J) at x = MX
  const newton = new Group();
  newton.position.set(MX, 0, 0);
  root.add(newton);
  const domeMat = k.mat("#274b63", { roughness: 0.9 });
  const dome = new Mesh(new SphereGeometry(8, 28, 14, 0, Math.PI * 2, 0, 0.36), domeMat);
  dome.position.y = -8.32;
  newton.add(dome);
  const domeY = (dx: number) => -8.32 + Math.sqrt(Math.max(0, 64 - dx * dx));
  {
    // cannon on the dome's left shoulder
    const cy = domeY(-2.6);
    const cannon = new Group();
    cannon.position.set(-2.6, cy + 0.14, 0);
    cannon.rotation.z = 0.22;
    newton.add(cannon);
    const barrel = new Mesh(new CylinderGeometry(0.17, 0.2, 0.95, 12), k.mat("#2f3540", { metalness: 0.55, roughness: 0.4 }));
    barrel.rotation.z = Math.PI / 2 - 0.28;
    cannon.add(barrel);
    const base = new Mesh(new BoxGeometry(0.42, 0.24, 0.42), k.mat("#1d2328"));
    base.position.y = -0.16;
    cannon.add(base);
    // dashed ballistic arcs (short / medium)
    const mkArc = (len: number, h: number, col: string) => {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 36; i++) {
        const u = i / 36;
        pts.push(V(-1.75 + u * len, cy + 0.42 + h * Math.sin(u * Math.PI) - u * u * (h * 0.55), 0));
      }
      const g = new BufferGeometry().setFromPoints(pts);
      const l = new Line(g, new LineDashedMaterial({ color: col, dashSize: 0.28, gapSize: 0.2, transparent: true, opacity: 0.85 }));
      l.computeLineDistances();
      newton.add(l);
    };
    mkArc(2.6, 1.15, "#ffd88a");
    mkArc(5.2, 1.9, "#ffe9b0");
    // long arc: wraps around the planet (the "orbit")
    const pts: Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = Math.PI / 2 + 1.02 - (i / 64) * 2.15;
      pts.push(V(Math.cos(a) * 8.55, -8.32 + Math.sin(a) * 8.55, 0));
    }
    const g = new BufferGeometry().setFromPoints(pts);
    const orbitArc = new Line(g, new LineDashedMaterial({ color: "#6ee7ff", dashSize: 0.34, gapSize: 0.22, transparent: true, opacity: 0.95 }));
    orbitArc.computeLineDistances();
    newton.add(orbitArc);
  }
  const ball = new Mesh(new SphereGeometry(0.15, 10, 8), new MeshStandardMaterial({ color: "#ff8a3c", emissive: "#ff5a1a", emissiveIntensity: 0.7 }));
  newton.add(ball);

  // ---------- helpers
  const satQ = new Quaternion();
  const tangentAt = (t: number) => {
    const p = S.phi(t);
    return V(-Math.sin(p), 0, Math.cos(p)).normalize();
  };

  // ---------- tangent (velocity) + gravity arrows for shot D
  const tangArrow = new Group();
  {
    const c = new Mesh(new CylinderGeometry(0.05, 0.05, 1.05, 8), new MeshBasicMaterial({ color: "#6ee7ff" }));
    c.position.y = 0.525;
    const tip = new Mesh(new ConeGeometry(0.14, 0.36, 8), new MeshBasicMaterial({ color: "#6ee7ff" }));
    tip.position.y = 1.22;
    tangArrow.add(c, tip);
  }
  const gravArrow = new Group();
  {
    const c = new Mesh(new CylinderGeometry(0.06, 0.06, 0.95, 8), new MeshBasicMaterial({ color: "#e8622c" }));
    c.position.y = -0.475;
    const tip = new Mesh(new ConeGeometry(0.16, 0.4, 8), new MeshBasicMaterial({ color: "#e8622c" }));
    tip.position.y = -1.15;
    tip.rotation.x = Math.PI;
    gravArrow.add(c, tip);
  }
  root.add(tangArrow, gravArrow);

  // ---------- relative-airflow particles (shot E)
  const windParticles = k.particles(44, "#9fd4ff", 0.05);
  windParticles.visible = false;

  return {
    root,
    update: (t, shotId, pose, scene) => {
      const warm = S.warm(t);
      const bg = SPACE.clone().lerp(SPACE_WARM, warm);
      scene.background = bg;
      key.color.set("#fff1d6").lerp(SUN_WARM, warm);
      hemi.intensity = 0.85 + warm * 0.35;

      // ===== satellite
      const sp = S.satPos(t);
      const intact = S.intact(t);
      swift.visible = intact > 0.01;
      swift.position.set(sp[0], sp[1], sp[2]);
      swift.rotation.set(0.08 * Math.sin(t * 0.7), -S.phi(t) + 0.6, 0.06 * Math.sin(t * 0.5));
      swift.scale.setScalar(lerp(0.35, 1, intact));
      const beacon = swift.getObjectByName("beacon") as Mesh | undefined;
      if (beacon) (beacon.material as MeshStandardMaterial).emissiveIntensity = 0.6 + 1.3 * Math.max(0, Math.sin(t * 5.5));

      // ===== fireball streak (shot A)
      const st = S.streak(t);
      streakG.visible = st.on;
      if (st.on) {
        const y = 4.6 - st.u * 2.4, z = -2.0 - st.u * 1.1;
        streakG.position.set(st.pos, y, z);
        const pulse = Math.sin(clamp(st.u) * Math.PI);
        streakCore.scale.setScalar(0.7 + pulse * 0.9);
        streakGlow.scale.setScalar(0.7 + pulse * 1.15);
        streakGlow.material.opacity = 0.75 * (1 - st.u * 0.55);
        for (let i = 0; i < 26; i++) {
          const u = clamp(st.u - i * 0.028);
          setInstance(streakTrail, i, lerp(-9, 9, u), 4.6 - u * 2.4 + Math.sin(i * 1.7) * 0.14, -2.0 - u * 1.1 + Math.cos(i * 2.3) * 0.14, 0.4 + u * 0.8);
        }
        streakTrail.instanceMatrix.needsUpdate = true;
      }
      streakTrail.visible = st.on;

      // ===== city lights + island presence
      cityLights.visible = shotId === "L" || shotId === "M";

      // ===== atmosphere shells
      const swell = shotId === "F" ? S.swell(t) : 1;
      shell.scale.setScalar(swell);
      limb.scale.setScalar(swell);
      shellMat.opacity = 0.16 + (shotId === "F" ? 0.10 * Math.max(0, Math.sin(t * 5.2)) : 0);

      // ===== sun flare burst (shot F)
      const flareOn = shotId === "F" ? S.flare(t) : 0;
      flareCone.material.opacity = 0.42 * flareOn;
      flareCone.scale.set(1, 0.7 + flareOn * 1.5, 1);
      flareArc.material.opacity = 0.55 * flareOn;
      sunGlow1.material.opacity = 0.32 + (shotId === "F" ? 0.18 * flareOn : 0);

      // ===== spiral rings (shot G)
      spiralRings.forEach((m, i) => {
        m.opacity = shotId === "G" || shotId === "H" || shotId === "I" ? 0.15 + 0.55 * S.ringLevel(t, i) : 0;
      });
      ringMainMat.opacity = shotId === "M" || shotId === "N" ? 0.14 : 0.38;

      // ===== E-wind streak particles (shot E)
      const windOn = shotId === "E";
      if (windOn) {
        const tan = tangentAt(t);
        const jit = (i: number) => Math.sin(i * 12.9898) * 0.5;
        for (let i = 0; i < 44; i++) {
          const u = (t * 1.15 + i / 44) % 1;
          const d = (1 - u) * 2.1;
          setInstance(
            windParticles, i,
            sp[0] + tan.x * d + jit(i) * 0.55,
            sp[1] + jit(i + 50) * 0.5,
            sp[2] + tan.z * d + jit(i + 120) * 0.55,
            0.35 + u * 0.85,
          );
        }
        windParticles.instanceMatrix.needsUpdate = true;
      }
      windParticles.visible = windOn;

      // ===== gamma-ray burst (shots I & K)
      const grb = S.grb(t);
      burstG.visible = grb > 0.02;
      if (burstG.visible) {
        burstCore.scale.setScalar(0.75 + grb * 0.9);
        burstGlow.material.opacity = 0.62 * grb;
        burstRing.material.opacity = 0.55 * grb;
        burstRing.scale.setScalar(0.7 + (1 - grb) * 2.3);
        spike1.material.opacity = spike2.material.opacity = 0.72 * grb;
        burstG.rotation.z = t * 0.18;
      }
      // instrument beam Swift -> burst (shot I, after the flash kicks off)
      const beamOn = shotId === "I" && t > L(9).s + 1.35;
      beam.visible = beamOn;
      if (beamOn) {
        const a = V(sp[0], sp[1], sp[2]), b = BURST.clone();
        const mid = a.clone().lerp(b, 0.5);
        const len = a.distanceTo(b);
        beam.position.copy(mid);
        beam.scale.set(1, len, 1);
        beam.quaternion.copy(satQ.setFromUnitVectors(V(0, 1, 0), b.sub(a).normalize()));
        beam.material.opacity = 0.16 + 0.1 * Math.sin(t * 9);
      }

      // ===== LINK rescue craft (shot H)
      const linkOn = shotId === "H";
      link.visible = linkOn;
      approach.visible = linkOn;
      if (linkOn) {
        const lp = S.linkPos(t);
        link.position.set(lp[0], lp[1], lp[2]);
        link.rotation.set(S.linkTumble(t) * 0.8, S.linkTumble(t) * 1.3, S.linkTumble(t));
        const failT = L(8).e - 0.4;
        approachGeo.setFromPoints([V(sp[0], sp[1], sp[2]), V(lp[0], lp[1], lp[2])]);
        approach.computeLineDistances();
        approachMat.opacity = clamp(ramp(t, shot("H").s + 0.4, failT)) * (1 - ramp(t, failT, failT + 0.8));
        // sparks at the failure moment
        const u = ramp(t, failT, failT + 1.6);
        if (t >= failT && u < 1) {
          for (let i = 0; i < 26; i++) {
            setInstance(sparks, i, lp[0] + sparkVel[i].x * u, lp[1] + sparkVel[i].y * u - 1.1 * u * u, lp[2] + sparkVel[i].z * u, (1 - u) * 1.1);
          }
          sparks.instanceMatrix.needsUpdate = true;
        } else for (let i = 0; i < 26; i++) setInstance(sparks, i, 0, -100, 0, 0.001);
        sparks.instanceMatrix.needsUpdate = true;
      }
      sparks.visible = linkOn;

      // ===== reentry plasma (shot L)
      const burn = S.burn(t);
      plasma.visible = burn > 0.02;
      if (plasma.visible) {
        plasma.position.set(sp[0], sp[1], sp[2]);
        plasma.scale.setScalar(0.6 + burn * 1.05 + 0.08 * Math.sin(t * 17));
        plasma.material.opacity = 0.85 * burn;
        fireLight.intensity = burn * 2.4;
        fireLight.position.set(sp[0] + 2.5, sp[1] + 3.5, sp[2] + 5);
      } else fireLight.intensity = 0;
      if (shotId === "L") {
        for (let i = 0; i < 70; i++) {
          const u = (t * 1.45 + i / 70) % 1;
          setInstance(
            fire, i,
            sp[0] + Math.sin(i * 91.7) * 0.34 * (0.5 + u),
            sp[1] + u * 1.9 + Math.cos(i * 47.3) * 0.12,
            sp[2] + Math.cos(i * 63.1) * 0.34 * (0.5 + u),
            (1 - u) * (0.35 + burn * 0.9),
          );
        }
        fire.instanceMatrix.needsUpdate = true;
      }
      fire.visible = shotId === "L";

      // ===== end-of-burn flash
      const fl = S.flash(t);
      const fpos = S.satPos(L(12).e);
      flashCore.visible = fl > 0.02;
      flashRing.visible = fl > 0.02;
      flashCore.position.set(fpos[0], fpos[1], fpos[2]);
      flashCore.scale.setScalar(0.8 + fl * 3.1);
      flashCore.material.opacity = fl;
      flashRing.position.copy(flashCore.position);
      flashRing.scale.setScalar(0.6 + fl * 4.2);
      flashRing.material.opacity = fl * 0.8;
      flashRing.lookAt(pose.position[0], pose.position[1], pose.position[2]);

      // ===== orbit tangent/gravity arrows (shot D)
      const arrowOn = shotId === "D";
      tangArrow.visible = gravArrow.visible = arrowOn;
      if (arrowOn) {
        const grow = ramp(t, L(4).s + 0.9, L(4).s + 2.1);
        const tan = tangentAt(t);
        // tangent arrow: along orbit direction
        tangArrow.position.set(sp[0] + tan.x * 0.55, sp[1], sp[2] + tan.z * 0.55);
        tangArrow.quaternion.copy(satQ.setFromUnitVectors(V(0, 1, 0), tan));
        tangArrow.scale.set(1, Math.max(0.01, 1.35 * grow), 1);
        // gravity arrow: straight down
        gravArrow.position.set(sp[0], sp[1] - 0.85, sp[2]);
        gravArrow.scale.set(1, Math.max(0.01, 1.2 * grow), 1);
      }

      // ===== Newton diorama (shot J)
      newton.visible = shotId === "J";
      if (newton.visible) {
        const u = ramp(t, L(10).s + 2.0, L(10).e);
        const a = Math.PI / 2 + 1.02 - u * 1.5;
        ball.position.set(Math.cos(a) * 8.55, -8.32 + Math.sin(a) * 8.55, 0);
        ball.visible = u > 0.02 && u < 0.995;
      }
    },
  };
};
