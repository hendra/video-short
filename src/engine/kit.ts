/**
 * Building blocks for explainer dioramas. Everything is created once; per-frame animation only mutates
 * transforms / materials. Shapes are bevelled and smooth-shaded and materials are physically based with a
 * subtle surface grain (see surface.ts), so objects read as real things rather than flat CG.
 *
 * Deliberately NOT used: environment maps (IBL) and bump maps. On the CPU renderer used in CI an environment
 * map alone tripled render time, and bump maps alias into noise on faces seen at a grazing angle.
 */
import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
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
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { bevelBoxGeometry, grainTexture, worldUV } from "./surface";
import { clamp, lerp, rng } from "./math";
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

/** Options for `Kit.figure` — a wooden-toy person. */
export type FigureOpts = {
  /** "anak" is smaller, "lansia" slightly smaller with grey hair in a bun. Default "dewasa". */
  age?: "anak" | "dewasa" | "lansia";
  /** Colour of the shirt (and of the kerudung, when worn). */
  top?: string;
  /** Colour of the kain / skirt. */
  bottom?: string;
  skin?: string;
  hair?: string;
  headwear?: "none" | "caping" | "mahkota" | "ikat" | "kerudung";
  /** Extra costume trim: "selempang" (sash), "rompi" (open vest) or "none". */
  costume?: "none" | "selempang" | "rompi";
  /** Trim colour for the sash / vest edge / crown band. Defaults to warm gold. */
  trim?: string;
};

/** Options for `Kit.animal` — one generic four-legged animal. */
export type AnimalOpts = {
  s?: number;
  color?: string;
  ears?: "bulat" | "runcing" | "panjang";
  horns?: boolean;
  tail?: "pendek" | "panjang";
  stripes?: boolean;
};

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

  // ---------------------------------------------------------------------------------------------
  // Wooden-toy diorama prefabs (storytelling channels). Rounded toy-doll shapes, warm matte colours.
  // People get the full cartoon face (face()); animals, birds and swimmers keep the two-dot eyes().
  // The returned parts (head, arms, legs, wings, tail) are pivoted at the joint, so rotating them in
  // update(t) moves them the way the real limb would.
  // ---------------------------------------------------------------------------------------------

  /** Mesh from a raw geometry, placed inside `parent`. */
  private part(geo: BufferGeometry, m: string | Material, parent: Object3D, pos: Vec3, scale?: Vec3, rot?: Vec3) {
    const mesh = this.add(new Mesh(geo, this.resolve(m)), parent);
    mesh.position.set(...pos);
    if (scale) mesh.scale.set(...scale);
    if (rot) mesh.rotation.set(...rot);
    return mesh;
  }

  private pivot(parent: Object3D, pos: Vec3) {
    const g = new Group();
    g.position.set(...pos);
    parent.add(g);
    return g;
  }

  /** Two dot eyes on a head of radius `r` centred at `c`, looking down +z. */
  private eyes(parent: Object3D, c: Vec3, r: number) {
    for (const sx of [-1, 1]) {
      this.part(new SphereGeometry(r * 0.12, 16, 12), this.mat("#2f2620", "gloss"), parent, [c[0] + sx * r * 0.36, c[1] + r * 0.08, c[2] + r * 0.9]);
    }
  }

  /**
   * Cartoon face on a head of radius `r` centred at `c` (looking down +z): white eye + pupil + specular dot,
   * brows, a smile arc and optional blush. `blush` suits the toy-doll channels (Cerpenek).
   */
  private face(parent: Object3D, c: Vec3, r: number, o: { blush?: boolean; brows?: boolean } = {}) {
    const sclera = this.mat("#fdfbf7", "gloss");
    const pupil = this.mat("#241d19", "gloss");
    const dot = this.mat("#ffffff", "gloss");
    for (const sx of [-1, 1]) {
      const ex = c[0] + sx * r * 0.36;
      const ey = c[1] + r * 0.02;
      const ez = c[2] + r * 0.82;
      this.part(new SphereGeometry(r * 0.21, 14, 11), sclera, parent, [ex, ey, ez], [1, 1.18, 0.55]);
      this.part(new SphereGeometry(r * 0.125, 12, 10), pupil, parent, [ex + sx * r * 0.015, ey - r * 0.02, ez + r * 0.1], [1, 1.1, 0.6]);
      this.part(new SphereGeometry(r * 0.05, 8, 7), dot, parent, [ex + sx * r * 0.055, ey + r * 0.08, ez + r * 0.16]);
      if (o.brows) {
        const b = this.part(new BoxGeometry(r * 0.28, r * 0.05, r * 0.04), this.mat("#3a2a22"), parent, [ex, ey + r * 0.34, ez + r * 0.1]);
        b.rotation.z = -sx * 0.1;
      }
      if (o.blush) {
        this.part(new SphereGeometry(r * 0.12, 10, 8), this.mat("#e88a7a"), parent, [c[0] + sx * r * 0.62, c[1] - r * 0.26, c[2] + r * 0.68], [1, 0.7, 0.25]);
      }
    }
    // pushed forward onto the skin surface: at 0.86r the whole torus sat inside the head and was invisible
    this.part(new TorusGeometry(r * 0.24, r * 0.042, 12, 24, Math.PI), this.mat("#4a2e23"), parent, [c[0], c[1] - r * 0.12, c[2] + r * 0.97], undefined, [0, 0, Math.PI]);
  }

  /**
   * Wooden-toy person standing on the ground at x/z, facing +z when ry = 0. ~1 unit tall as an adult.
   * Body parts are separate meshes on pivots (`armL`, `armR`, `legL`, `legR`, `head`), so swinging a limb in
   * update(t) moves the way a real joint would; headwear and colours carry across shots unchanged.
   */
  figure(x: number, z: number, ry: number, o: FigureOpts = {}) {
    const { age = "dewasa", top = "#c2573f", bottom = "#7a4a33", skin = "#e3b48d", headwear = "none" } = o;
    const costume = o.costume ?? "none";
    const trim = o.trim ?? "#e2b23c";
    const hair = o.hair ?? (age === "lansia" ? "#dcd8d2" : "#2e2520");
    const root = new Group();
    root.position.set(x, 0, z);
    root.rotation.y = ry;
    root.scale.setScalar(age === "anak" ? 0.78 : age === "lansia" ? 0.95 : 1);

    // torso: a rounded barrel with a waist, not a straight cylinder
    this.part(new CylinderGeometry(0.165, 0.2, 0.34, 28), top, root, [0, 0.56, 0]);
    this.part(new SphereGeometry(0.185, 28, 20), top, root, [0, 0.5, 0], [1, 0.75, 0.92]);
    this.part(new TorusGeometry(0.145, 0.032, 12, 28), "#f7f1e4", root, [0, 0.71, 0], undefined, [Math.PI / 2, 0, 0]);
    this.part(new SphereGeometry(0.17, 26, 18), bottom, root, [0, 0.36, 0], [1, 0.6, 0.9]);
    if (costume === "selempang") {
      // sash across the chest: a thin rotated band with a gold edge
      const sash = this.part(new BoxGeometry(0.1, 0.42, 0.02), trim, root, [0.02, 0.58, 0.175]);
      sash.rotation.z = 0.62;
      this.part(new BoxGeometry(0.05, 0.2, 0.015), "#f4e7c8", root, [0.16, 0.38, 0.185]).rotation.z = 0.62;
    } else if (costume === "rompi") {
      // open vest: two panels leaving the shirt visible between them, gold edge on the opening
      for (const sx of [-1, 1]) {
        this.part(new BoxGeometry(0.085, 0.3, 0.03), bottom, root, [sx * 0.085, 0.56, 0.155]).rotation.z = -sx * 0.08;
        this.part(new BoxGeometry(0.012, 0.3, 0.032), trim, root, [sx * 0.045, 0.56, 0.157]).rotation.z = -sx * 0.08;
      }
    }

    const limb = (px: number, py: number, rTop: number, rBot: number, len: number, m: string) => {
      const g = this.pivot(root, [px, py, 0]);
      this.part(new CylinderGeometry(rTop, rBot, len, 18), m, g, [0, -len / 2, 0]);
      return g;
    };

    const legL = limb(-0.082, 0.34, 0.068, 0.06, 0.28, bottom);
    const legR = limb(0.082, 0.34, 0.068, 0.06, 0.28, bottom);
    for (const g of [legL, legR]) this.part(new BoxGeometry(0.115, 0.075, 0.17), "#3d3430", g, [0, -0.3025, 0.03]);

    const arm = (sx: number) => {
      const g = limb(sx * 0.2, 0.66, 0.05, 0.045, 0.24, top);
      g.rotation.z = sx * 0.22;
      this.part(new SphereGeometry(0.072, 20, 16), top, g, [0, 0, 0]);
      this.part(new SphereGeometry(0.062, 20, 16), skin, g, [0, -0.26, 0]);
      return g;
    };
    const armL = arm(-1), armR = arm(1);


    const head = this.pivot(root, [0, 0.86, 0]);
    const hc: Vec3 = [0, 0, 0];
    this.part(new SphereGeometry(0.215, 24, 18), skin, head, hc);
    this.face(head, hc, 0.215, { blush: age === "anak", brows: true });

    if (headwear === "kerudung") {
      this.part(new SphereGeometry(0.226, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.46), top, head, [0, 0.045, -0.035], undefined, [-0.85, 0, 0]);
      this.part(new CylinderGeometry(0.12, 0.185, 0.17, 24), top, head, [0, -0.09, -0.03]);
      for (const sx of [-1, 1]) this.part(new SphereGeometry(0.07, 20, 14), top, head, [sx * 0.192, -0.03, 0.0], [0.75, 1.3, 0.9]);
    } else {
      const lift = age === "lansia" ? 0.03 : 0;
      this.part(new SphereGeometry(0.228, 26, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), hair, head, [0, 0.012 + lift, -0.02], undefined, [-0.42, 0, 0]);
      this.part(new SphereGeometry(0.12, 20, 14), hair, head, [0, 0.163 + lift, 0.1], [1.18, 0.34, 0.45]);
      for (const sx of [-1, 1]) this.part(new SphereGeometry(0.075, 20, 14), hair, head, [sx * 0.185, 0.02 + lift, 0.03], [0.7, 1.25, 0.85]);
      if (age === "lansia") this.part(new SphereGeometry(0.095, 20, 16), hair, head, [0, 0.1 + lift, -0.21]);
    }

    if (headwear === "caping") {
      this.part(new ConeGeometry(0.28, 0.14, 24), "#d9b56c", head, [0, 0.288, 0]);
    } else if (headwear === "mahkota") {
      const gold = this.mat("#e2b23c", "gloss");
      this.part(new CylinderGeometry(0.13, 0.115, 0.085, 20), gold, head, [0, 0.258, 0]);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        this.part(new SphereGeometry(0.03, 12, 10), gold, head, [Math.sin(a) * 0.12, 0.313, Math.cos(a) * 0.12]);
      }
    } else if (headwear === "ikat") {
      // tied headband with a knot and two loose tails
      this.part(new CylinderGeometry(0.192, 0.198, 0.055, 24), "#b3352b", head, [0, 0.098, 0]);
      this.part(new SphereGeometry(0.045, 14, 10), "#c04336", head, [0, 0.098, -0.195]);
      for (const sx of [-1, 1]) this.part(new BoxGeometry(0.03, 0.12, 0.02), "#b3352b", head, [sx * 0.04, 0.04, -0.2], undefined, [0, 0, sx * 0.5]);
    }

    this.root.add(root);
    return { root, head, armL, armR, legL, legR };
  }

  /** Round diorama base: a disc of sand or grass on a thick soil rim. Top surface is y = 0. */
  island(x: number, z: number, r: number, ground: "pasir" | "rumput" = "rumput") {
    const g = new Group();
    g.position.set(x, 0, z);
    this.part(new CylinderGeometry(r, r * 0.94, 0.36, 64), "#a57c50", g, [0, -0.2, 0]);
    this.part(new CylinderGeometry(r * 1.005, r * 1.005, 0.05, 64), ground === "pasir" ? "#ecd9a6" : "#7fae5b", g, [0, -0.025, 0]);
    this.root.add(g);
    return g;
  }

  /**
   * Sunset sky dome: one inward-facing sphere with a vertical gradient (no IBL, no post-processing).
   * `top` is the zenith colour, `horizon` the warm band behind the mountains. One mesh per scene.
   */
  sky(top = "#8fb6d8", horizon = "#f7c98b", radius = 60) {
    const geo = new SphereGeometry(radius, 32, 20);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const a = new Color(top);
    const b = new Color(horizon);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      // 0 at the horizon, 1 at the zenith
      // the camera only ever sees a slice near the horizon: keep the warm band low and narrow so the
      // zenith blue does not blend into a grey band across the top of the frame
      const u = Math.max(0, Math.min(1, (pos.getY(i) / radius + 0.06) / 0.55));
      c.copy(b).lerp(a, Math.pow(u, 1.7));
      // vertex colours are consumed as linear; without this the sky renders washed out
      const lin = c.clone().convertSRGBToLinear();
      colors[i * 3] = lin.r;
      colors[i * 3 + 1] = lin.g;
      colors[i * 3 + 2] = lin.b;
    }
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    // Basic material: the sky must not be lit or shaded by the scene lights.
    const mesh = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, depthWrite: false, toneMapped: false }));
    mesh.frustumCulled = false;
    this.root.add(mesh);
    return mesh;
  }

  /**
   * Receding mountain range for depth: one call places `count` faceted cones on an arc behind the scene,
   * each paler and flatter with distance (aerial perspective without fog or an env map).
   */
  range(x: number, z: number, o: { count?: number; spread?: number; scale?: number; depth?: number; near?: string; far?: string } = {}) {
    const { count = 5, spread = 26, scale = 3.4, depth = 14, near = "#5d8a4f", far = "#a9b8a0" } = o;
    const g = new Group();
    g.position.set(x, 0, z);
    const a = new Color(near).convertSRGBToLinear();
    const b = new Color(far).convertSRGBToLinear();
    const c = new Color();
    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0 : i / (count - 1);
      const px = (u - 0.5) * spread + (i % 2 ? 1.6 : -1.2);
      const pz = -u * depth;
      const s = scale * (1 - u * 0.35);
      c.copy(a).lerp(b, u);
      const m = this.add(new Mesh(new ConeGeometry(s, s * 1.25, 7), new MeshStandardMaterial({ color: c.clone(), flatShading: true, roughness: 0.9 })));
      m.position.set(px, s * 0.62, pz);
      m.rotation.y = u * 2.1;
      g.add(m);
    }
    this.root.add(g);
    return g;
  }

  /**
   * Grass tufts, scattered deterministically inside a disc. One InstancedMesh per colour, so a hundred tufts
   * cost a handful of draw calls instead of a hundred meshes (the CPU renderer is fill-rate bound).
   */
  grass(x: number, z: number, r: number, o: { count?: number; seed?: number; color?: string; scale?: number } = {}) {
    const { count = 90, seed = 11, color = "#6f9f4c", scale = 1 } = o;
    const rnd = rng(seed);
    // a flattened cone reads as a blade of grass; a round one reads as a tiny fir tree
    const blade = new ConeGeometry(0.03, 0.15, 4);
    blade.scale(1, 1, 0.32);
    const mesh = new InstancedMesh(blade, this.mat(color, { flatShading: true }), count);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.castShadow = false; // hundreds of tiny shadow casters cost more than they add
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      const ang = rnd() * Math.PI * 2;
      const rad = Math.sqrt(rnd()) * r;
      const s = (0.55 + rnd() * 0.5) * scale;
      setInstance(mesh, i, x + Math.cos(ang) * rad, 0.04 * s, z + Math.sin(ang) * rad, s, new Euler(0, rnd() * Math.PI, (rnd() - 0.5) * 0.55));
    }
    this.root.add(mesh);
    return mesh;
  }

  /** Winding dirt path: a chain of overlapping flat discs laid on the ground from one point to another. */
  path(x0: number, z0: number, x1: number, z1: number, o: { width?: number; color?: string; steps?: number } = {}) {
    const { width = 0.5, color = "#b99468", steps = 24 } = o;
    const g = new Group();
    const m = this.mat(color);
    for (let i = 0; i < steps; i++) {
      const u = i / (steps - 1);
      const wobble = Math.sin(u * 4.5) * 0.4;
      const px = lerp(x0, x1, u) + wobble;
      const pz = lerp(z0, z1, u);
      // slightly wider at the near end so the path reads as receding, not as a row of coins
      const w = width * (0.78 + 0.3 * (1 - u));
      const disc = this.add(new Mesh(new CylinderGeometry(w, w, 0.02, 14), m));
      disc.position.set(px, 0.012, pz);
      disc.scale.z = 1.35;
      g.add(disc);
    }
    this.root.add(g);
    return g;
  }

  /** Low bush: three faceted clumps, cheaper than a tree and good for filling the middle distance. */
  bush(x: number, z: number, s = 1, color = "#4f8a4a") {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    for (const [dx, dz, cr] of [[0, 0, 0.34], [0.26, 0.1, 0.24], [-0.22, -0.12, 0.22]] as const) {
      const c = this.add(new Mesh(new IcosahedronGeometry(cr, 1), this.mat(color, { flatShading: true })), g);
      c.position.set(dx, cr * 0.72, dz);
      c.rotation.set(dx * 3, dz * 5, cr * 4);
    }
    this.root.add(g);
    return g;
  }

  /** Coconut palm with a leaning trunk. */
  palm(x: number, z: number, s: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    const r = rng(Math.round(x * 97 + z * 31));
    const lean = 0.1 + r() * 0.08;
    g.rotation.y = r() * Math.PI * 2;
    let px = 0, py = 0;
    for (let i = 0; i < 6; i++) {
      const a = lean * i * 0.5;
      this.part(new CylinderGeometry(0.05 - i * 0.004, 0.058 - i * 0.004, 0.24, 16), i % 2 ? "#8a6a48" : "#7a5c3e", g, [px, py + 0.11, 0], undefined, [0, 0, -a]);
      px += Math.sin(a) * 0.22;
      py += Math.cos(a) * 0.22;
    }
    const crown = this.pivot(g, [px, py, 0]);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + r() * 0.3;
      const leaf = this.pivot(crown, [0, 0, 0]);
      leaf.rotation.set(0, a, -0.42 - r() * 0.25);
      this.part(new SphereGeometry(0.3, 16, 10), this.mat(i % 2 ? "#4f9a55" : "#5fae62", { flatShading: true }), leaf, [0.3, 0, 0], [1, 0.1, 0.3]);
    }
    for (const [cx, cz] of [[0.06, 0.03], [-0.04, 0.05]] as const) this.ball(px + cx, py - 0.07, cz, 0.05, "#6b4a2c", g);
    this.root.add(g);
    return g;
  }

  /** Wooden boat floating at water level y = 0, bow toward +x when ry = 0. */
  boat(x: number, z: number, s: number, ry: number, sail = true) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    g.rotation.y = ry;
    this.part(new SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), "#9c5a2e", g, [0, 0.16, 0], [1, 0.42, 0.4]);
    this.part(new CylinderGeometry(0.8, 0.8, 0.04, 32), "#b97440", g, [0, 0.16, 0], [1, 1, 0.4]);
    this.cyl(0.05, 0.16, 0, 0.028, 0.95, "#6e3f1f", g);
    if (sail) {
      this.part(new ConeGeometry(0.44, 0.78, 4), this.mat("#fbf1dc", { flatShading: true }), g, [0.07, 0.72, 0], [1.2, 1, 0.05]);
    }
    this.root.add(g);
    return g;
  }

  /** Faceted mountain; `volcano` flattens the top and adds a glowing crater. */
  mountain(x: number, z: number, s: number, volcano = false) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    const r = rng(Math.round(x * 53 + z * 11));
    g.rotation.y = r() * Math.PI;
    if (volcano) {
      this.part(new CylinderGeometry(0.26, 1, 1.25, 8), this.mat("#6b5f55", { flatShading: true }), g, [0, 0.625, 0]);
      this.part(new CylinderGeometry(0.62, 1.02, 0.5, 8), this.mat("#5f8251", { flatShading: true }), g, [0, 0.25, 0]);
      this.part(new CylinderGeometry(0.2, 0.2, 0.03, 20), this.mat("#ef6a2c", "gloss"), g, [0, 1.25, 0]);
    } else {
      this.part(new ConeGeometry(1, 1.4, 8), this.mat("#6a8f58", { flatShading: true }), g, [0, 0.7, 0]);
      this.part(new ConeGeometry(0.62, 0.9, 7), this.mat("#587c4b", { flatShading: true }), g, [0.62, 0.45, 0.2]);
    }
    this.root.add(g);
    return g;
  }

  /** Small stilt house with a thatched roof; door faces +z when ry = 0. */
  hut(x: number, z: number, s: number, ry: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    g.rotation.y = ry;
    for (const sx of [-0.36, 0.36]) for (const sz of [-0.3, 0.3]) this.cyl(sx, 0, sz, 0.035, 0.28, "#6e4f33", g);
    this.box(-0.46, 0.46, 0.26, 0.32, -0.4, 0.4, "#8a6a48", g); // floor
    this.box(-0.4, 0.4, 0.32, 0.72, -0.34, 0.34, "#dcbb84", g); // woven walls
    this.box(-0.09, 0.09, 0.32, 0.6, 0.33, 0.352, "#5a4030", g); // door
    this.part(new ConeGeometry(0.74, 0.5, 4), this.mat("#8c6c3e", { flatShading: true }), g, [0, 0.96, 0], [1, 1, 0.86], [0, Math.PI / 4, 0]);
    this.box(-0.06, 0.06, 0, 0.3, 0.42, 0.46, "#6e4f33", g).rotation.x = -0.5; // ladder
    this.root.add(g);
    return g;
  }

  /**
   * Generic four-legged animal facing +z when ry = 0 (kerbau, rusa, kancil, harimau, anjing, kucing …):
   * pick colour, ears, horns, tail and stripes. `s` scales it (1 ≈ knee-high dog, 1.8 ≈ buffalo).
   */
  animal(x: number, z: number, ry: number, o: AnimalOpts = {}) {
    const { s = 1, color = "#a9764a", ears = "bulat", horns = false, tail = "pendek", stripes = false } = o;
    const root = new Group();
    root.position.set(x, 0, z);
    root.rotation.y = ry;
    root.scale.setScalar(s);
    this.part(new CapsuleGeometry(0.14, 0.4, 6, 16), color, root, [0, 0.33, 0], undefined, [Math.PI / 2, 0, 0]);
    for (const sx of [-0.08, 0.08]) for (const sz of [-0.2, 0.2]) this.cyl(sx, 0, sz, 0.04, 0.24, color, root, 0.048);
    if (stripes) {
      for (const sz of [-0.18, -0.06, 0.06, 0.18]) {
        this.part(new CylinderGeometry(0.144, 0.144, 0.035, 24), "#2f2620", root, [0, 0.33, sz], undefined, [Math.PI / 2, 0, 0]);
      }
    }
    const head = this.pivot(root, [0, 0.42, 0.3]);
    const hc: Vec3 = [0, 0.06, 0.05];
    this.ball(...hc, 0.105, color, head);
    this.part(new SphereGeometry(0.066, 20, 14), "#f1e4cf", head, [0, 0.03, 0.15], [0.9, 0.75, 1.25]); // muzzle
    this.ball(0, 0.045, 0.225, 0.02, "#2f2620", head); // nose
    this.eyes(head, hc, 0.105);
    for (const sx of [-1, 1]) {
      if (ears === "runcing") this.part(new ConeGeometry(0.035, 0.09, 16), color, head, [sx * 0.062, 0.175, 0.03]);
      else if (ears === "panjang") this.part(new CapsuleGeometry(0.024, 0.13, 4, 12), color, head, [sx * 0.055, 0.23, 0.02], undefined, [0, 0, -sx * 0.16]);
      else this.ball(sx * 0.085, 0.14, 0.03, 0.035, color, head);
      if (horns) this.part(new ConeGeometry(0.024, 0.17, 16), "#ece4d0", head, [sx * 0.12, 0.2, 0.0], undefined, [0, 0, -sx * 0.55]);
    }
    if (tail === "panjang") this.part(new CapsuleGeometry(0.02, 0.24, 4, 12), color, root, [0, 0.27, -0.42], undefined, [0.5, 0, 0]);
    else this.ball(0, 0.37, -0.36, 0.042, color, root);
    this.root.add(root);
    return { root, head };
  }

  /** Small bird at height y, facing +z. Rotate `wingL` / `wingR` around z to flap. */
  bird(x: number, y: number, z: number, ry: number, o: { s?: number; color?: string } = {}) {
    const { s = 1, color = "#e9e4d8" } = o;
    const root = new Group();
    root.position.set(x, y, z);
    root.rotation.y = ry;
    root.scale.setScalar(s);
    this.part(new SphereGeometry(0.12, 24, 16), color, root, [0, 0, 0], [0.85, 0.85, 1.25]);
    const hc: Vec3 = [0, 0.08, 0.13];
    this.ball(...hc, 0.075, color, root);
    this.eyes(root, hc, 0.075);
    this.part(new ConeGeometry(0.025, 0.08, 16), "#e8952f", root, [0, 0.07, 0.23], undefined, [Math.PI / 2, 0, 0]);
    this.part(new ConeGeometry(0.06, 0.16, 12), color, root, [0, 0.01, -0.2], [1, 1, 0.3], [-Math.PI / 2, 0, 0]);
    const wing = (sx: number) => {
      const w = this.pivot(root, [sx * 0.08, 0.03, 0]);
      this.part(new SphereGeometry(0.16, 20, 12), color, w, [sx * 0.15, 0, -0.01], [1, 0.12, 0.55]);
      return w;
    };
    const wingL = wing(-1), wingR = wing(1);
    this.root.add(root);
    return { root, wingL, wingR };
  }

  /** Water animal lying at the surface y = 0, facing +z: a round fish or a long crocodile. Rotate `tail` around y. */
  swimmer(x: number, z: number, ry: number, o: { s?: number; color?: string; kind?: "ikan" | "buaya" } = {}) {
    const { s = 1, kind = "ikan" } = o;
    const color = o.color ?? (kind === "buaya" ? "#5d7f4a" : "#e98a3a");
    const root = new Group();
    root.position.set(x, 0, z);
    root.rotation.y = ry;
    root.scale.setScalar(s);
    let tail: Group;
    if (kind === "buaya") {
      this.part(new CapsuleGeometry(0.11, 0.6, 6, 16), color, root, [0, 0.07, 0], [1.15, 1, 0.8], [Math.PI / 2, 0, 0]);
      this.part(new CapsuleGeometry(0.075, 0.24, 6, 16), color, root, [0, 0.08, 0.52], [1.2, 1, 0.6], [Math.PI / 2, 0, 0]); // snout
      this.eyes(root, [0, 0.13, 0.33], 0.1);
      for (let i = 0; i < 5; i++) this.part(new ConeGeometry(0.035, 0.06, 12), "#4b6a3c", root, [0, 0.18, 0.24 - i * 0.12]);
      for (const sx of [-1, 1]) for (const sz of [-0.2, 0.22]) this.ball(sx * 0.15, 0.03, sz, 0.05, color, root);
      tail = this.pivot(root, [0, 0.07, -0.38]);
      this.part(new ConeGeometry(0.1, 0.55, 16), color, tail, [0, 0, -0.27], [1, 1, 0.7], [-Math.PI / 2, 0, 0]);
    } else {
      const bc: Vec3 = [0, 0.12, 0];
      this.part(new SphereGeometry(0.2, 24, 16), color, root, bc, [0.5, 0.75, 1.25]);
      this.eyes(root, [0, 0.14, 0.12], 0.11);
      this.part(new ConeGeometry(0.06, 0.12, 12), color, root, [0, 0.29, -0.02], [0.3, 1, 1]); // dorsal fin
      tail = this.pivot(root, [0, 0.12, -0.22]);
      this.part(new ConeGeometry(0.13, 0.2, 12), color, tail, [0, 0, -0.09], [0.25, 1, 1], [Math.PI / 2, 0, 0]);
    }
    this.root.add(root);
    return { root, tail };
  }

  /** Instanced spheres for flowing water, bubbles, etc. */
  particles(n: number, color: string, r = 0.09) {    const m = new InstancedMesh(
      new SphereGeometry(r, 16, 12),
      new MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.25 }),
      n,
    );
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
    this.root.add(m);
    return m;
  }

  // ---------------------------------------------------------------------------------------------
  // Mechanical / explainer builders (Kali Aja, Sastra Mesin). Everything is a pure build step: the
  // returned pivots are what update(t) rotates or slides, never the meshes themselves.
  // ---------------------------------------------------------------------------------------------

  private curveOf(points: Vec3[]) {
    return new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  }

  /**
   * Smooth pipe / wire / river along a path. `at(u)` samples the same curve so flow particles and
   * arrows can travel along it. Segments stay low: the CPU renderer is fill-rate bound.
   */
  tube(points: Vec3[], r: number, m: string | Material, o: { tubularSegments?: number; radialSegments?: number; parent?: Object3D } = {}) {
    const { tubularSegments = 28, radialSegments = 10, parent } = o;
    const curve = this.curveOf(points);
    const mesh = new Mesh(worldUV(new TubeGeometry(curve, tubularSegments, r, radialSegments, false)), this.resolve(m));
    this.add(mesh, parent);
    return { mesh, at: (u: number) => curve.getPointAt(clamp(u, 0, 1)).toArray() as Vec3 };
  }

  /** Torus ring: pipe flange, seal, magnetic field, water ripple. */
  ring(x: number, y: number, z: number, r: number, tubeR: number, m: string | Material, o: { rot?: Vec3; parent?: Object3D } = {}) {
    const mesh = this.add(new Mesh(new TorusGeometry(r, tubeR, 10, 24), this.resolve(m)), o.parent, false);
    mesh.position.set(x, y, z);
    if (o.rot) mesh.rotation.set(...o.rot);
    return mesh;
  }

  /** Helical spring / heating coil / induction winding. Compress it with `root.scale.y`. */
  coil(x: number, y0: number, z: number, o: { r?: number; tubeR?: number; h?: number; turns?: number; color?: string | Material; parent?: Object3D } = {}) {
    const { r = 0.25, tubeR = 0.03, h = 0.8, turns = 5, color = "#9aa3ad", parent } = o;
    const steps = 40;
    const points: Vec3[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = u * turns * Math.PI * 2;
      points.push([x + Math.cos(a) * r, y0 + h * u, z + Math.sin(a) * r]);
    }
    const g = new Group();
    const t = this.tube(points, tubeR, color, { parent: g, tubularSegments: 60, radialSegments: 8 });
    t.mesh.castShadow = false;
    this.root.add(g);
    if (parent) parent.add(g);
    return g;
  }

  /** Toothed gear. Spin `rotor` around the chosen axis; `teeth` boxes sit on the rim. */
  gear(x: number, y: number, z: number, o: { r?: number; thickness?: number; teeth?: number; color?: string | Material; axis?: "x" | "y" | "z"; parent?: Object3D } = {}) {
    const { r = 0.45, thickness = 0.12, teeth = 10, color = "#9aa3ad", axis = "z", parent } = o;
    const root = new Group();
    root.position.set(x, y, z);
    if (axis === "x") root.rotation.y = Math.PI / 2;
    else if (axis === "y") root.rotation.x = Math.PI / 2;
    const rotor = new Group();
    root.add(rotor);
    // hub + rim sit along local +z (the spin axis). They are rotationally symmetric, so they live on
    // `root`: only the cogs need to spin, which keeps `rotor` == the teeth.
    const hub = this.add(new Mesh(worldUV(new CylinderGeometry(r * 0.28, r * 0.28, thickness * 1.4, 20)), this.resolve(color)), root);
    hub.rotation.x = Math.PI / 2;
    const rim = this.add(new Mesh(worldUV(new CylinderGeometry(r, r, thickness, 24)), this.resolve(color)), root);
    rim.rotation.x = Math.PI / 2;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const cog = this.add(new Mesh(worldUV(bevelBoxGeometry(r * 0.22, r * 0.22, thickness, 0.02)), this.resolve(color)), rotor);
      cog.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      cog.rotation.z = a;
    }
    this.root.add(root);
    if (parent) parent.add(root);
    return { root, rotor };
  }

  /** Fan / propeller / turbine. Spin `rotor` around the chosen axis. */
  fan(x: number, y: number, z: number, o: { r?: number; blades?: number; color?: string | Material; axis?: "x" | "y" | "z"; parent?: Object3D } = {}) {
    const { r = 0.5, blades = 4, color = "#c8ced6", axis = "z", parent } = o;
    const root = new Group();
    root.position.set(x, y, z);
    if (axis === "x") root.rotation.y = Math.PI / 2;
    else if (axis === "y") root.rotation.x = Math.PI / 2;
    const rotor = new Group();
    root.add(rotor);
    this.ball(0, 0, 0, r * 0.22, color, rotor);
    for (let i = 0; i < blades; i++) {
      const a = (i / blades) * Math.PI * 2;
      const blade = this.add(new Mesh(worldUV(bevelBoxGeometry(r * 0.9, r * 0.34, r * 0.06, 0.02)), this.resolve(color)), rotor);
      blade.position.set(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 0);
      blade.rotation.z = a;
      blade.rotation.x = 0.5; // pitch: catches the air instead of reading as a flat cross
    }
    this.root.add(root);
    if (parent) parent.add(root);
    return { root, rotor };
  }

  /** 3D vector arrow (force, heat, current, pressure). `setProgress(u)` grows it from `from` to `to`. */  arrow(from: Vec3, to: Vec3, m: string | Material, o: { r?: number; headR?: number; parent?: Object3D } = {}) {
    const { r = 0.03, headR = 0.09, parent } = o;
    const dir = new Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const len = Math.max(1e-4, dir.length());
    const root = new Group();
    root.position.set(...from);
    root.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    const shaft = this.add(new Mesh(worldUV(new CylinderGeometry(r, r, len, 12)), this.resolve(m)), root, false);
    shaft.position.y = len / 2;
    const head = this.add(new Mesh(new ConeGeometry(headR, headR * 2.2, 12), this.resolve(m)), root, false);
    head.position.y = len;
    this.root.add(root);
    if (parent) parent.add(root);
    return { root, setProgress: (u: number) => (root.scale.y = clamp(u, 0, 1)) };
  }

  /**
   * Particles flowing along a path (water, air, current, heat). `update(t, rate)` places them from the
   * phase `t * speed * rate`, so a caller ramping `rate` with `beat(t, L(n))` speeds the flow up
   * smoothly instead of jumping. One InstancedMesh: cheap on the CPU renderer.
   */
  flowDots(points: Vec3[], count: number, color: string, o: { r?: number; speed?: number; parent?: Object3D } = {}) {
    const { r = 0.045, speed = 0.35, parent } = o;
    const curve = this.curveOf(points);
    const mesh = new InstancedMesh(
      new SphereGeometry(r, 10, 8),
      new MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.35 }),
      count,
    );
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    this.root.add(mesh);
    if (parent) parent.add(mesh);
    const update = (t: number, rate = 1) => {
      for (let i = 0; i < count; i++) {
        const u = (i / count + t * speed * rate) % 1;
        const p = curve.getPointAt((u + 1) % 1);
        setInstance(mesh, i, p.x, p.y, p.z);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    update(0, 0);
    return Object.assign(mesh, { update });
  }

  /**
   * Slide outer casings aside to reveal the inside. The base position is captured on the first call, so
   * reopening (openU back to 0) returns every part exactly where it was built.
   */
  cutaway(parts: readonly Object3D[], openU: number, offset: Vec3) {
    const u = clamp(openU);
    for (const part of parts) {
      let base = this.cutawayBase.get(part);
      if (!base) {
        base = [part.position.x, part.position.y, part.position.z];
        this.cutawayBase.set(part, base);
      }
      part.position.set(base[0] + offset[0] * u, base[1] + offset[1] * u, base[2] + offset[2] * u);
      part.visible = u < 0.99;
    }
  }

  private cutawayBase = new WeakMap<Object3D, Vec3>();

  /**
   * Uncached emissive material for parts that light up while being explained. `mat()` caches by colour,
   * so a pulsing part must never share one: drive `emissiveIntensity` from `pulse(t, L(n))` here.
   */
  glowMat(color: string, emissive: string, o: Surface | MeshStandardMaterialParameters = "matte") {
    const { grain, ...preset } = typeof o === "string" ? SURFACES[o] : { ...SURFACES.matte, grain: false, ...o };
    const m = new MeshStandardMaterial({ color, emissive, emissiveIntensity: 0, ...preset });
    if (grain) m.map = grainTexture();
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
