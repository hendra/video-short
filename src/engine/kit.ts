/**
 * Low-poly building blocks for explainer dioramas. Everything is created once;
 * per-frame animation only mutates transforms / materials.
 */
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  Euler,
  Group,
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

export class Kit {
  private cache = new Map<string, MeshStandardMaterial>();
  constructor(public root: Object3D) {}

  mat(color: string, o: MeshStandardMaterialParameters = {}) {
    const k = color + JSON.stringify(o);
    let m = this.cache.get(k);
    if (!m) {
      m = new MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, flatShading: true, ...o });
      this.cache.set(k, m);
    }
    return m;
  }

  add<T extends Mesh>(mesh: T, parent: Object3D = this.root, castShadow = true) {
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /** Axis-aligned box from min/max corners. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: string | Material, parent?: Object3D) {
    const b = new Mesh(new BoxGeometry(x1 - x0, y1 - y0, z1 - z0), typeof m === "string" ? this.mat(m) : m);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(b, parent);
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
    this.add(new Mesh(new BoxGeometry(0.9, 0.6, 0.8), this.mat(walls[k % 4])), g).position.y = 0.3;
    const roof = this.add(new Mesh(new ConeGeometry(0.78, 0.45, 4), this.mat(roofs[k % 3])), g);
    roof.position.y = 0.82;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.9);
    this.add(new Mesh(new BoxGeometry(0.18, 0.32, 0.02), this.mat("#5a4636")), g).position.set(0, 0.16, 0.41);
    this.root.add(g);
    return g;
  }

  tree(x: number, z: number, s: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    this.add(new Mesh(new CylinderGeometry(0.06, 0.08, 0.5, 5), this.mat("#7a5a3c")), g).position.y = 0.25;
    this.add(new Mesh(new IcosahedronGeometry(0.42, 0), this.mat("#4f8a4a")), g).position.y = 0.78;
    this.root.add(g);
    return g;
  }

  /** Worker in orange vest + yellow helmet. */
  worker(x: number, z: number, ry: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    this.add(new Mesh(new BoxGeometry(0.2, 0.32, 0.14), this.mat("#2e3a4d")), g).position.y = 0.16;
    this.add(new Mesh(new BoxGeometry(0.26, 0.3, 0.16), this.mat("#f08a24")), g).position.y = 0.47;
    this.add(new Mesh(new SphereGeometry(0.1, 8, 6), this.mat("#d9a37c")), g).position.y = 0.72;
    this.add(new Mesh(new SphereGeometry(0.115, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), this.mat("#f2c230")), g).position.y = 0.75;
    this.root.add(g);
    return g;
  }

  /** Instanced spheres for flowing water, bubbles, etc. */
  particles(n: number, color: string, r = 0.09) {
    const m = new InstancedMesh(
      new SphereGeometry(r, 8, 6),
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
