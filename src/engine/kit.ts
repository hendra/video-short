/**
 * Building blocks for explainer dioramas. Everything is created once; per-frame animation only mutates
 * transforms / materials. Shapes are bevelled and smooth-shaded and materials are physically based with a
 * subtle surface grain (see surface.ts), so objects read as real things rather than flat CG.
 *
 * Deliberately NOT used: environment maps (IBL) and bump maps. On the CPU renderer used in CI an environment
 * map alone tripled render time, and bump maps alias into noise on faces seen at a grazing angle.
 */
import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Euler,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { bevelBoxGeometry, grainTexture, worldUV } from "./surface";
import { rng } from "./math";
import type { Vec3 } from "./types";

/** Physically plausible looks. `grain` adds the shared surface texture (subtle albedo + roughness variation). */
const SURFACES = {
  /** Painted wall, soil, concrete, wood, fabric. */
  matte: { roughness: 0.82, metalness: 0, grain: true },
  /** Coated plastic, car paint, ceramic. */
  gloss: { roughness: 0.28, metalness: 0, grain: false },
  /** Steel, aluminium, pipes, machinery. */
  metal: { roughness: 0.36, metalness: 0.6, grain: true }, // < 1: there is no environment map to reflect
  /** Windows, solar panel faces, screens. */
  glass: { roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.45, grain: false },
  /** Water surfaces and volumes. */
  water: { roughness: 0.08, metalness: 0, transparent: true, opacity: 0.82, grain: false },
} as const;
export type Surface = keyof typeof SURFACES;

export class Kit {
  private cache = new Map<string, MeshStandardMaterial>();
  constructor(public root: Object3D) {}

  /**
   * Cached PBR material. Second argument is a surface preset ("matte" default, "gloss", "metal", "glass",
   * "water") or raw MeshStandardMaterial parameters (which start from "matte" without grain).
   */
  mat(color: string, o: Surface | MeshStandardMaterialParameters = "matte") {
    const k = color + JSON.stringify(o);
    let m = this.cache.get(k);
    if (!m) {
      const { grain, ...preset } = typeof o === "string" ? SURFACES[o] : { ...SURFACES.matte, grain: false, ...o };
      m = new MeshStandardMaterial({ color, ...preset });
      if (grain) {
        m.map = grainTexture();
      }
      this.cache.set(k, m);
    }
    return m;
  }

  private resolve(m: string | Material) {
    return typeof m === "string" ? this.mat(m) : m;
  }

  add<T extends Mesh>(mesh: T, parent: Object3D = this.root, castShadow = true) {
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /**
   * Standard outdoor light rig: sky/ground hemisphere + warm sun with soft shadows + cool rim fill.
   * Call once per world instead of hand-placing lights. `reach` = half-size of the area that must receive
   * shadows (keep it tight: a smaller area means sharper shadows).
   */
  lights({ sun = [9, 16, 12], reach = 16, intensity = 2.6 }: { sun?: Vec3; reach?: number; intensity?: number } = {}) {
    this.root.add(new HemisphereLight("#dbe9ff", "#a08a6c", 0.45));
    const key = new DirectionalLight("#ffe2bd", intensity);
    key.position.set(...sun);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const cam = key.shadow.camera;
    cam.left = cam.bottom = -reach;
    cam.right = cam.top = reach;
    cam.near = 0.5;
    cam.far = Math.hypot(...sun) + reach * 2;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.03;
    this.root.add(key);
    const rim = new DirectionalLight("#bcd2ff", 0.5);
    rim.position.set(-sun[0] * 1.3, sun[1] * 0.45, sun[2] * 0.6);
    this.root.add(rim);
    return key;
  }

  /** Axis-aligned box from min/max corners, with softly bevelled edges that catch the light. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: string | Material, parent?: Object3D) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const bevel = Math.min(0.035, Math.min(w, h, d) * 0.25);
    const b = new Mesh(worldUV(bevelBoxGeometry(w, h, d, bevel)), this.resolve(m));
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(b, parent);
  }

  /** Smooth upright cylinder (pipe, pole, tank, silo) centred at x/z, standing on y0. `rTop` tapers it. */
  cyl(x: number, y0: number, z: number, r: number, h: number, m: string | Material, parent?: Object3D, rTop = r) {
    const c = new Mesh(worldUV(new CylinderGeometry(rTop, r, h, 28)), this.resolve(m));
    c.position.set(x, y0 + h / 2, z);
    return this.add(c, parent);
  }

  /** Smooth sphere (tank dome, lamp, ball, head). */
  ball(x: number, y: number, z: number, r: number, m: string | Material, parent?: Object3D) {
    const s = new Mesh(new SphereGeometry(r, 28, 20), this.resolve(m));
    s.position.set(x, y, z);
    return this.add(s, parent);
  }

  /** Box whose top surface can move (water levels). Call .set(y1) every frame. */
  level(x0: number, x1: number, y0: number, z0: number, z1: number, m: Material) {
    const b = new Mesh(new BoxGeometry(1, 1, 1), m);
    b.receiveShadow = true;
    this.root.add(b);
    return Object.assign(b, {
      set: (y1: number) => {
        const h = Math.max(0.001, y1 - y0);
        b.scale.set(x1 - x0, h, z1 - z0);
        b.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
        b.visible = y1 > y0 + 0.005;
      },
    });
  }

  house(x: number, z: number, s: number, ry: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    g.rotation.y = ry;
    const walls = ["#f2ece0", "#efe6d2", "#e9efe9", "#f3e4d6"];
    const roofs = ["#c4473a", "#b5523c", "#a94434"];
    const k = Math.floor(Math.abs(x * 7 + z * 3));
    this.box(-0.45, 0.45, 0, 0.6, -0.4, 0.4, walls[k % 4], g);
    this.box(-0.48, 0.48, 0, 0.06, -0.43, 0.43, "#9a968c", g); // plinth
    const roof = this.add(new Mesh(new ConeGeometry(0.78, 0.45, 4), this.mat(roofs[k % 3], { flatShading: true })), g);
    roof.position.y = 0.82;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.9);
    this.box(-0.09, 0.09, 0, 0.32, 0.39, 0.415, "#5a4636", g); // door
    const pane = this.mat("#8fb6cf", { roughness: 0.08, metalness: 0.4 });
    for (const wx of [-0.29, 0.29]) {
      this.box(wx - 0.085, wx + 0.085, 0.27, 0.45, 0.395, 0.412, "#fbfaf6", g); // frame
      this.box(wx - 0.065, wx + 0.065, 0.29, 0.43, 0.4, 0.416, pane, g);
    }
    this.root.add(g);
    return g;
  }

  tree(x: number, z: number, s: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    const r = rng(Math.round(x * 131 + z * 17));
    this.cyl(0, 0, 0, 0.085, 0.55, "#6f5238", g, 0.055);
    const greens = ["#4f8a4a", "#5d9a52", "#437a43"];
    // canopy = a few overlapping faceted clumps -> irregular silhouette instead of one ball
    for (const [dx, dy, dz, cr] of [[0, 0.82, 0, 0.36], [0.2, 0.7, 0.08, 0.26], [-0.18, 0.72, -0.1, 0.27], [0.02, 1.04, -0.04, 0.24]] as const) {
      const clump = this.add(new Mesh(new IcosahedronGeometry(cr, 1), this.mat(greens[Math.floor(r() * 3)], { flatShading: true })), g);
      clump.position.set(dx + (r() - 0.5) * 0.08, dy, dz + (r() - 0.5) * 0.08);
      clump.rotation.set(r() * 3, r() * 3, r() * 3);
    }
    this.root.add(g);
    return g;
  }

  /** Worker in orange vest + yellow helmet. */
  worker(x: number, z: number, ry: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const limb = (lx: number, y: number, r: number, len: number, color: string) => {
      const l = this.add(new Mesh(new CapsuleGeometry(r, len, 4, 12), this.mat(color)), g);
      l.position.set(lx, y, 0);
      return l;
    };
    for (const lx of [-0.055, 0.055]) limb(lx, 0.17, 0.045, 0.25, "#2e3a4d"); // legs
    limb(0, 0.47, 0.1, 0.13, "#f08a24").scale.set(1.15, 1, 0.75); // vest
    for (const lx of [-0.15, 0.15]) limb(lx, 0.45, 0.035, 0.2, "#f08a24"); // arms
    this.ball(0, 0.72, 0, 0.095, "#d9a37c", g);
    const helmet = this.add(new Mesh(new SphereGeometry(0.108, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.mat("#f2c230", "gloss")), g);
    helmet.position.y = 0.745;
    this.root.add(g);
    return g;
  }

  /** Instanced spheres for flowing water, bubbles, etc. */
  particles(n: number, color: string, r = 0.09) {
    const m = new InstancedMesh(
      new SphereGeometry(r, 16, 12),
      new MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.25 }),
      n,
    );
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
    this.root.add(m);
    return m;
  }
}

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
export const setInstance = (mesh: InstancedMesh, i: number, x: number, y: number, z: number, s = 1, rot?: Euler) => {
  _p.set(x, y, z);
  _s.setScalar(s);
  if (rot) _q.setFromEuler(rot);
  else _q.identity();
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
};
