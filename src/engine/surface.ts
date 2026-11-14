/**
 * Surface detail shared by every video: bevelled box geometry and a procedural grain texture.
 * Built once per render tab, fully deterministic (no image files, no network).
 */
import { BufferAttribute, BufferGeometry, DataTexture, LinearFilter, LinearMipmapNearestFilter, RepeatWrapping } from "three";
import { rng } from "./math";

let grain: DataTexture | null = null;
/**
 * Tileable value-noise texture (3 soft octaves, 0.82–1.0). Used as albedo/roughness modulation so large flat
 * faces read as a real surface (concrete, soil, painted metal) instead of a perfectly uniform CG colour.
 */
export const grainTexture = (): DataTexture => {
  if (grain) return grain;
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  const acc = new Float32Array(N * N);
  let amp = 1, total = 0;
  for (const cells of [6, 20, 56]) {
    const r = rng(cells * 7919);
    const lattice = Float32Array.from({ length: cells * cells }, () => r());
    const at = (x: number, y: number) => lattice[(y % cells) * cells + (x % cells)];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const fx = (x / N) * cells, fy = (y / N) * cells;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const u = fx - x0, v = fy - y0;
        const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * su;
        const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * su;
        acc[y * N + x] += (top + (bot - top) * sv) * amp;
      }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < acc.length; i++) {
    const v = Math.round(255 * (0.82 + 0.18 * (acc[i] / total)));
    data.set([v, v, v, 255], i * 4);
  }
  grain = new DataTexture(data, N, N);
  grain.wrapS = grain.wrapT = RepeatWrapping;
  grain.magFilter = LinearFilter;
  grain.minFilter = LinearMipmapNearestFilter;
  grain.generateMipmaps = true;
  grain.needsUpdate = true;
  return grain;
};

/**
 * Box with chamfered edges whose faces stay perfectly flat: every vertex carries its face's exact normal, so
 * the flat sides shade evenly and only the thin edge strips blend between two faces (reads as a rounded edge
 * that catches the light). 24 vertices / 44 triangles. three's RoundedBoxGeometry is not used because its
 * normals are spherical, which shades large flat faces as if they were domed.
 */
export const bevelBoxGeometry = (w: number, h: number, d: number, r: number): BufferGeometry => {
  const half = [w / 2, h / 2, d / 2];
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => [c & 1 ? 1 : -1, c & 2 ? 1 : -1, c & 4 ? 1 : -1]);
  // vertex id = corner * 3 + face axis
  for (const c of corners)
    for (let a = 0; a < 3; a++) {
      pos.push(...c.map((s, k) => s * (k === a ? half[k] : half[k] - r)));
      nor.push(...c.map((s, k) => (k === a ? s : 0)));
    }
  const P = (i: number) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  /** Add a triangle, flipping it if it faces the box centre. */
  const tri = (i: number, j: number, k: number) => {
    const [A, B, C] = [P(i), P(j), P(k)];
    const u = B.map((v, n) => v - A[n]), v = C.map((x, n) => x - A[n]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[0] * (A[0] + B[0] + C[0]) + n[1] * (A[1] + B[1] + C[1]) + n[2] * (A[2] + B[2] + C[2]) >= 0) idx.push(i, j, k);
    else idx.push(i, k, j);
  };
  const quad = (i: number, j: number, k: number, l: number) => { tri(i, j, k); tri(i, k, l); };
  for (let a = 0; a < 3; a++) {
    const [u, v] = [(a + 1) % 3, (a + 2) % 3];
    const bit = (k: number) => 1 << k;
    for (const s of [0, 1]) {
      // flat face: the 4 corners on this side of axis a
      const base = s * bit(a);
      quad(...([0, bit(u), bit(u) | bit(v), bit(v)].map((o) => (base | o) * 3 + a) as [number, number, number, number]));
    }
    // edge strips running along axis a: join the two faces that meet there
    for (const o of [0, bit(u), bit(v), bit(u) | bit(v)]) {
      const [c1, c2] = [o, o | bit(a)];
      quad(c1 * 3 + u, c2 * 3 + u, c2 * 3 + v, c1 * 3 + v);
    }
  }
  for (let c = 0; c < 8; c++) tri(c * 3, c * 3 + 1, c * 3 + 2);
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("normal", new BufferAttribute(new Float32Array(nor), 3));
  geo.setIndex(idx);
  return geo;
};

/**
 * Re-project UVs from world-scale positions (dominant normal axis picks the plane) so the grain keeps the same
 * physical size on every face of every object, however the geometry is scaled.
 */
export const worldUV = <T extends BufferGeometry>(geo: T, density = 0.35): T => {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [a, b] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = a * density;
    uv[i * 2 + 1] = b * density;
  }
  geo.setAttribute("uv", new BufferAttribute(uv, 2));
  return geo;
};
