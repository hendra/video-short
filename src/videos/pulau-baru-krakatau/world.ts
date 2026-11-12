import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Fog,
  Group,
  HemisphereLight,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  Vector3,
} from "three";
import { Kit, setInstance } from "../../engine/kit";
import { clamp, lerp, ramp, rng, smooth } from "../../engine/math";
import type { Ctx, WorldApi } from "../../engine/types";
import { AK, BOT, CH, MC, MX, NW, SE, SEAFLOOR, ZB, makeState } from "./state";

const SKY = new Color("#dfe9ec");
const SKY_WARM = new Color("#f2d7bd");
const V = (x: number, y: number, z: number) => new Vector3(x, y, z);


/** Cylinder spanning two points. */
const span = (a: Vector3, b: Vector3, r: number, mat: MeshStandardMaterial, seg = 14) => {
  const len = a.distanceTo(b);
  const g = new CylinderGeometry(r, r, len, seg);
  g.translate(0, len / 2, 0);
  const m = new Mesh(g, mat);
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  return m;
};

export const createWorld = (ctx: Ctx): WorldApi => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);

  // ---------- lights
  root.add(new HemisphereLight("#ffffff", "#3d5a66", 1.25));
  const sun = new DirectionalLight("#fff3df", 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 90 });
  sun.shadow.bias = -0.0006;
  root.add(sun, sun.target);
  const magmaGlow = new PointLight("#ff7a2a", 0, 6, 1.6);
  magmaGlow.position.set(CH.x, CH.y, CH.z + 0.8);
  root.add(magmaGlow);

  // ---------- rock slab (cut face at z = 0) + strata + water dots
  const ROCK = k.mat("#6b5540");
  k.box(-14.5, 14.5, BOT, SEAFLOOR, ZB, 0, ROCK);
  for (const [y, h, c] of [[-4.35, 0.16, "#5d4a37"], [-5.15, 0.28, "#75604a"], [-6.15, 0.2, "#5d4a37"]] as [number, number, string][])
    k.box(-14.5, 14.5, y - h, y + h, 0.005, 0.02, c);
  const dots = k.particles(130, "#7ec8ea", 0.045);
  { const r = rng(7); for (let i = 0; i < 130; i++) setInstance(dots, i, -13.5 + r() * 27, -3.45 + r() * 3.2, -0.3 - r() * 4.8, 1); dots.instanceMatrix.needsUpdate = true; }

  // ---------- sea: translucent water volume + bright surface film
  const waterMat = new MeshStandardMaterial({ color: "#2e6f8e", transparent: true, opacity: 0.55, roughness: 0.25, metalness: 0.05, depthWrite: false });
  const water = new Mesh(new BoxGeometry(29, -SEAFLOOR, -ZB), waterMat);
  water.position.set(0, SEAFLOOR / 2, ZB / 2);
  root.add(water);
  const filmMat = new MeshStandardMaterial({ color: "#8fd4ea", transparent: true, opacity: 0.5, roughness: 0.15, emissive: "#5fb6d6", emissiveIntensity: 0.2, depthWrite: false });
  k.box(-14.5, 14.5, -0.025, 0.008, ZB, 0, filmMat, root);

  // ---------- distant Krakatau siblings (aerial perspective silhouettes)
  for (const [x, z, r, h] of [[-6.8, -8.0, 1.15, 0.85], [4.9, -8.6, 1.6, 1.25], [7.9, -7.6, 0.8, 0.6]] as [number, number, number, number][]) {
    const c = k.add(new Mesh(new ConeGeometry(r, h, 12), k.mat("#9fb0b8", { roughness: 1 })), root, false);
    c.position.set(x, h / 2, z);
  }

  // ---------- Anak Krakatau edifice
  const underCone = k.add(new Mesh(new ConeGeometry(2.0, -SEAFLOOR, 28), k.mat("#54443a")), root);
  underCone.position.set(AK.x, SEAFLOOR + (-SEAFLOOR) / 2, -2.15);
  const cone = k.add(new Mesh(new ConeGeometry(1.72, 2.1, 26), k.mat("#5d4a3a")), root);
  cone.position.set(AK.x, 1.0, AK.z);
  const crater = k.add(new Mesh(new CylinderGeometry(0.62, 0.7, 0.22, 22), k.mat("#241d18")), root);
  crater.position.set(AK.x, 2.0, AK.z);
  const craterGlowMat = new MeshStandardMaterial({ color: "#3a1206", emissive: "#ff5a1f", emissiveIntensity: 0, roughness: 0.6 });
  const craterGlow = new Mesh(new CircleGeometry(0.5, 20), craterGlowMat);
  craterGlow.rotation.x = -Math.PI / 2; craterGlow.position.set(AK.x, 2.115, AK.z); root.add(craterGlow);
  // rim rocks
  { const r = rng(21); for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const rock = k.add(new Mesh(new SphereGeometry(0.09 + r() * 0.07, 6, 5), k.mat("#4a3a2e")), root); rock.position.set(AK.x + Math.cos(a) * 0.62, 2.12, AK.z + Math.sin(a) * 0.62); } }

  // ---------- submarine mounds + new islands (NW & SE)
  const moundMat = k.mat("#3f342c");
  const moundNW = k.add(new Mesh(new ConeGeometry(1.28, -SEAFLOOR, 20), moundMat), root);
  moundNW.position.set(NW.x, SEAFLOOR + (-SEAFLOOR) / 2, -1.3);
  const moundSE = k.add(new Mesh(new ConeGeometry(1.02, -SEAFLOOR, 20), moundMat), root);
  moundSE.position.set(SE.x, SEAFLOOR + (-SEAFLOOR) / 2, -1.15);
  // fresh-lava island cones, scaled by grow()
  const islandMat = new MeshStandardMaterial({ color: "#241f1b", emissive: "#e8622c", emissiveIntensity: 0.1, roughness: 0.9, flatShading: true });
  const islNW = new Mesh(new ConeGeometry(0.72, 0.42, 12), islandMat); islNW.castShadow = true; root.add(islNW);
  const islSE = new Mesh(new ConeGeometry(0.54, 0.32, 12), islandMat); islSE.castShadow = true; root.add(islSE);

  // ---------- magma plumbing (exposed in the cut face, z ≈ 0)
  const dikeMat = new MeshStandardMaterial({ color: "#c8431a", emissive: "#ff7a2a", emissiveIntensity: 1.0, roughness: 0.5, flatShading: true });
  const chamberMat = new MeshStandardMaterial({ color: "#7a2c10", emissive: "#ff7a2a", emissiveIntensity: 0.9, roughness: 0.55, flatShading: true });
  const chamber = new Mesh(new CylinderGeometry(0.85, 0.85, 0.5, 26), chamberMat);
  chamber.rotation.x = Math.PI / 2; chamber.position.set(CH.x, CH.y, -0.12); root.add(chamber);
  const conduit = span(V(0, CH.y, 0.02), V(0, 1.85, 0.02), 0.13, dikeMat, 14); root.add(conduit);
  const dikeNWm = span(V(S.dikeNW.a.x, S.dikeNW.a.y, S.dikeNW.a.z), V(S.dikeNW.b.x, S.dikeNW.b.y, S.dikeNW.b.z), 0.1, dikeMat, 12); root.add(dikeNWm);
  const dikeSEm = span(V(S.dikeSE.a.x, S.dikeSE.a.y, S.dikeSE.a.z), V(S.dikeSE.b.x, S.dikeSE.b.y, S.dikeSE.b.z), 0.09, dikeMat, 12); root.add(dikeSEm);
  // magma blob that climbs the NW dike during Langkah 1
  const blob = new Mesh(new SphereGeometry(0.3, 12, 10), new MeshStandardMaterial({ color: "#ff9a4a", emissive: "#ff6a1f", emissiveIntensity: 2.2, roughness: 0.35 }));
  root.add(blob);

  // ---------- fishing boat (scale + "don't enter" context)
  const boat = new Group(); root.add(boat);
  k.box(-0.75, 0.75, 0, 0.18, -0.22, 0.22, "#f2f2ee", boat);
  k.box(-0.3, 0.32, 0.18, 0.48, -0.18, 0.18, "#d8d8d2", boat);
  k.box(0.28, 0.34, 0.18, 0.95, -0.03, 0.03, "#8a6a44", boat);
  boat.position.set(NW.x - 2.6, 0.05, -2.6);

  // ---------- particles: crater ash, vent steam, lava spray
  const ash = k.particles(56, "#b8b2a8", 0.09);
  const steam = k.particles(44, "#eef2f3", 0.04);
  const lava = k.particles(38, "#ff8a3a", 0.048);
  const ashSeed = (() => { const r = rng(41); return Array.from({ length: 56 }, () => [r() * Math.PI * 2, 0.55 + r() * 0.75, r()]); })();
  const steamSeed = (() => { const r = rng(42); return Array.from({ length: 44 }, () => [r() * Math.PI * 2, r()]); })();
  const lavaSeed = (() => { const r = rng(43); return Array.from({ length: 38 }, () => [r() * Math.PI * 2, r()]); })();

  // ---------- ILUSTRASI schematic: crack-line diagram panel (shot H)
  const map = new Group(); map.position.set(MX, 0, 0); root.add(map);
  // dark panel facing the camera
  k.box(-2.6, 2.6, -0.25, 3.3, -0.16, -0.06, "#232b33", map);
  for (const y of [0.4, 0.95, 2.0, 2.55, 3.05]) k.box(-2.45, 2.45, y - 0.012, y + 0.012, -0.055, -0.05, "#2e3944", map); // faint grid lines
  const lineMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.4, emissive: "#ffffff", emissiveIntensity: 0.15 });
  const line = new Mesh(new BoxGeometry(4.7, 0.1, 0.02), lineMat); line.position.set(0, 1.5, -0.045); map.add(line);
  const mapDots: { mesh: Mesh; delay: number }[] = [];
  const dot = (x: number, r: number, color: string, delay: number, emissive = 0) => {
    const g = new CylinderGeometry(r, r, 0.05, 20); g.rotateX(Math.PI / 2);
    const m = new Mesh(g, new MeshStandardMaterial({ color, emissive: emissive ? "#e8622c" : "#000000", emissiveIntensity: emissive, roughness: 0.55, flatShading: true }));
    m.position.set(x, 1.5, -0.035); map.add(m); mapDots.push({ mesh: m, delay });
  };
  dot(-2.12, 0.34, "#6f6a5e", 0.05);   // Danan
  dot(-1.35, 0.25, "#6f6a5e", 0.3);    // Perbuatan
  dot(-0.68, 0.17, "#e8622c", 1.0, 0.7); // titik baru NW
  dot(0.02, 0.52, "#3d332b", 0.55);    // Anak Krakatau
  dot(0.78, 0.15, "#e8622c", 1.25, 0.7);  // titik baru SE
  dot(2.05, 0.42, "#6f6a5e", 0.42);    // Rakata
  // panel base + rim
  k.box(-2.6, 2.6, -0.42, -0.25, -0.16, -0.06, "#1a2129", map);
  k.box(-2.68, 2.68, 3.3, 3.42, -0.16, -0.06, "#39434f", map);

  // ---------- ILUSTRASI comparison: Krakatau 1883 vs Anak Krakatau (shot K)
  const cmp = new Group(); cmp.position.set(MC, 0, 0); root.add(cmp);
  k.box(-9.5, 9.5, -0.32, 0, -4.5, 4.5, "#d8dcd2", cmp);
  const bigCone = new Mesh(new ConeGeometry(2.0, 3.6, 18), k.mat("#8a8272", { roughness: 1 })); bigCone.position.set(-3.4, 1.8, 0); bigCone.castShadow = true; cmp.add(bigCone);
  const smallCone = new Mesh(new ConeGeometry(0.62, 0.78, 14), k.mat("#4a3d33", { roughness: 0.9 })); smallCone.position.set(3.0, 0.39, 0); smallCone.castShadow = true; cmp.add(smallCone);

  return {
    root,
    update: (t, shotId, pose, scene) => {
      const I = shot(shotId), lt = t - I.s;
      const warm = shotId === "L" ? smooth(lt / 2.6) : 0;
      const bg = SKY.clone().lerp(SKY_WARM, warm);
      scene.background = bg;
      scene.fog = new Fog(bg, 42, 150);
      sun.color.set("#fff3df").lerp(new Color("#ffb06a"), warm);
      sun.position.set(pose.target[0] + 10, pose.target[1] + 22, pose.target[2] + 15);
      sun.target.position.set(...pose.target); sun.target.updateMatrixWorld();

      // boat bobs on the swell (pure function of t)
      boat.position.y = 0.05 + Math.sin(t * 1.15) * 0.045;
      boat.rotation.z = Math.sin(t * 0.9 + 1) * 0.035;

      // ---- island growth (Langkah 3 → reveal)
      const g = lerp(0.12, 1, S.grow(t));
      islNW.scale.set(g, g, g);
      islSE.scale.set(g * 0.92, g * 0.92, g * 0.92);
      islNW.position.set(NW.x, 0.21 * g, NW.z);
      islSE.position.set(SE.x, 0.16 * g, SE.z);
      // cooling: fresh lava → black basalt; present-day (A/B) islands are already dark rock
      const cool = S.cool(t);
      islandMat.emissiveIntensity = t < L(4).s ? 0.1 : lerp(1.4, 0.02, cool);

      // ---- magma system (exposed only in the cutaway shots)
      const magmaOn = shotId === "D" || shotId === "E" || shotId === "F";
      chamber.visible = conduit.visible = dikeNWm.visible = dikeSEm.visible = magmaOn;
      const pulse = S.pulse(t);
      chamberMat.emissiveIntensity = 0.75 + 0.5 * pulse;
      dikeMat.emissiveIntensity = 0.65 + 0.65 * pulse;
      magmaGlow.intensity = magmaOn ? 5.5 * pulse * (shotId === "F" ? 1 - cool * 0.8 : 1) : 0;
      const rise = S.rise(t);
      blob.visible = (shotId === "D" || shotId === "E") && rise > 0.01 && rise < 0.995;
      if (blob.visible) {
        blob.position.set(
          lerp(S.dikeNW.a.x, S.dikeNW.b.x, rise),
          lerp(S.dikeNW.a.y, S.dikeNW.b.y, rise),
          0.38,
        );
        blob.scale.setScalar(0.55 + 0.35 * pulse);
      }

      // ---- ash column (September flashback) + crater glow
      const plume = S.plume(t);
      craterGlowMat.emissiveIntensity = plume * 1.7;
      ash.visible = plume > 0.02;
      if (ash.visible) for (let i = 0; i < 56; i++) {
        const [a, sp, off] = ashSeed[i];
        const u = (t * 0.34 * sp + off) % 1;
        const rad = 0.28 + u * 1.9;
        setInstance(ash, i, AK.x + Math.cos(a) * rad, 2.15 + u * 3.6, AK.z + Math.sin(a) * rad, (1 - u * 0.55) * plume);
      }
      ash.instanceMatrix.needsUpdate = true;

      // ---- steam over the new vents + lava spray
      const steamOn = shotId === "F" || shotId === "I" || shotId === "G";
      steam.visible = steamOn;
      if (steamOn) for (let i = 0; i < 44; i++) {
        const [a, off] = steamSeed[i];
        const side = i % 2 === 0 ? NW : SE;
        const u = (t * 0.55 + off) % 1;
        setInstance(steam, i, side.x + Math.cos(a) * (0.08 + u * 0.18), 0.05 + u * 1.05, side.z + Math.sin(a) * (0.08 + u * 0.18), (1 - u * 0.75) * (shotId === "F" ? 1 : 0.55));
      }
      steam.instanceMatrix.needsUpdate = true;
      const lavaOn = shotId === "F" || shotId === "I";
      lava.visible = lavaOn && cool < 0.95;
      if (lava.visible) for (let i = 0; i < 38; i++) {
        const [a, off] = lavaSeed[i];
        const u = (t * 0.75 + off) % 1;
        const up = Math.sin(u * Math.PI);
        setInstance(lava, i, NW.x + Math.cos(a) * (0.07 + up * 0.22), -0.5 + up * 0.6, NW.z + Math.sin(a) * (0.07 + up * 0.22), up * (1 - cool) + 0.01);
      }
      lava.instanceMatrix.needsUpdate = true;

      // ---- ILUSTRASI map (shot H)
      map.visible = shotId === "H";
      if (map.visible) {
        const u = S.mapU(t);
        line.scale.x = Math.max(0.001, u);
        line.position.x = -2.35 + (4.7 * u) / 2;
        for (const d of mapDots) {
          const du = smooth(ramp(t, shot("H").s + 0.3 + d.delay, shot("H").s + 0.95 + d.delay));
          d.mesh.scale.setScalar(Math.max(0.001, du));
        }
      }

      // ---- ILUSTRASI comparison (shot K)
      cmp.visible = shotId === "K";
      if (cmp.visible) {
        const u = S.cmpU(t);
        bigCone.scale.setScalar(Math.max(0.001, smooth(u)));
        smallCone.scale.setScalar(Math.max(0.001, smooth(clamp(u * 1.6 - 0.35))));
      }
    },
  };
};
