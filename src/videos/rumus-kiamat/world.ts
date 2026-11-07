import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  Curve,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { Kit, setInstance } from "../../engine/kit";
import { clamp, smooth } from "../../engine/math";
import type { Ctx, WorldApi } from "../../engine/types";
import {
  DOUBLINGS, DX, KEXP, K, LY, L_CLIP, MX, MY, M_CLIP, POINTS, PROJ, QX, U, formula, lp, lx, makeState, mp, mx, realAt,
} from "./state";

/** A curve whose parameter is used as-is (no arc-length re-parametrisation), so drawRange ∝ our own u. */
class FnCurve extends Curve<Vector3> {
  constructor(private f: (u: number) => [number, number, number]) {
    super();
  }
  getPoint(u: number, target = new Vector3()) {
    const p = this.f(u);
    return target.set(p[0], p[1], p[2]);
  }
  getPointAt(u: number, target = new Vector3()) {
    return this.getPoint(u, target);
  }
}

/** Flat text label as a textured plane (canvas). h = world height; width follows the text. */
const textPlane = (lines: string[], h: number, o: { color?: string; bg?: string; weight?: number; align?: CanvasTextAlign; pad?: number } = {}) => {
  const fs = 120, lh = fs * 1.15, pad = o.pad ?? 30;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = `${o.weight ?? 800} ${fs}px "DejaVu Sans", sans-serif`;
  const w = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width))) + pad * 2;
  c.width = w;
  c.height = Math.ceil(lh * lines.length + pad * 2);
  const g = c.getContext("2d")!;
  if (o.bg) {
    g.fillStyle = o.bg;
    g.fillRect(0, 0, c.width, c.height);
  }
  g.font = `${o.weight ?? 800} ${fs}px "DejaVu Sans", sans-serif`;
  g.fillStyle = o.color ?? "#1d2328";
  g.textBaseline = "middle";
  g.textAlign = o.align ?? "center";
  const x = g.textAlign === "left" ? pad : g.textAlign === "right" ? c.width - pad : c.width / 2;
  lines.forEach((l, i) => g.fillText(l, x, pad + lh * (i + 0.5)));
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  const H = h * (c.height / (lh * lines.length));
  const m = new Mesh(new PlaneGeometry((H * c.width) / c.height, H), new MeshBasicMaterial({ map: tex, transparent: !o.bg, toneMapped: false }));
  return m;
};

export const createWorld = (ctx: Ctx): WorldApi => {
  const { L, shot } = ctx;
  const S = makeState(ctx);
  const root = new Group();
  const k = new Kit(root);
  const INK = "#1d2328";
  const RED = "#d8432f";
  const GREEN = "#1f9e6e";

  const hemi = new HemisphereLight("#ffffff", "#b9ae98", 1.35);
  root.add(hemi);
  const sun = new DirectionalLight("#fff3df", 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 160 });
  sun.shadow.bias = -0.0006;
  root.add(sun, sun.target);

  // ================= LONG CHART (year 0 → 2027)
  const long = new Group();
  root.add(long);
  const lk = new Kit(long);
  lk.box(-14.5, 15, -0.4, 0, -4, 4.5, k.mat("#e9e1cf"));
  lk.box(-13, 13.5, 0, 0.04, -0.08, 0.08, INK); // x axis
  lk.box(-12.12, -11.88, 0, 21, -0.12, 0.12, INK); // y axis
  for (let b = 2; b <= 10; b += 2) {
    lk.box(-12.5, -11.9, b * LY - 0.04, b * LY + 0.04, -0.06, 0.06, INK);
    lk.box(-11.9, 13, b * LY - 0.012, b * LY + 0.012, -0.9, -0.88, "#cfc6b2");
    const t = textPlane([`${b} M`], 0.55, { color: "#5b636a" });
    t.position.set(-13.4, b * LY, 0.2);
    long.add(t);
  }
  for (const y of [0, 500, 1000, 1500, 2000]) {
    lk.box(lx(y) - 0.04, lx(y) + 0.04, -0.02, 0.05, 0, 0.5, INK);
    const t = textPlane([`${y}`], 0.6, { color: "#5b636a" });
    t.rotation.x = -Math.PI / 2;
    t.position.set(lx(y), 0.06, 1.25);
    long.add(t);
  }
  // data points (24)
  const pts = POINTS.map(([y, n]) => {
    const g = new Group();
    g.position.set(lx(y), 0, 0);
    const h = n * LY;
    lk.add(new Mesh(new CylinderGeometry(0.035, 0.035, h, 6), k.mat("#c9a27a")), g).position.y = h / 2;
    lk.add(new Mesh(new SphereGeometry(0.2, 14, 10), k.mat("#e8622c", { roughness: 0.35, emissive: "#e8622c", emissiveIntensity: 0.2 })), g).position.y = h;
    long.add(g);
    return g;
  });
  // fitted curve
  const yClipL = U - Math.pow(K / 1e9 / (L_CLIP / LY), 1 / KEXP);
  const lyear = (u: number) => yClipL * (1 - Math.pow(1 - u, 2.2));
  const fitCurve = new FnCurve((u) => lp(lyear(u)));
  const fitGeo = new TubeGeometry(fitCurve, 900, 0.11, 8, false);
  const fitMat = new MeshStandardMaterial({ color: RED, emissive: RED, emissiveIntensity: 0.35, roughness: 0.45 });
  const fit = new Mesh(fitGeo, fitMat);
  fit.castShadow = true;
  long.add(fit);
  // asymptote wall at 2026.87
  const wallMat = new MeshStandardMaterial({ color: RED, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false });
  const wall = new Mesh(new PlaneGeometry(7, 80), wallMat);
  wall.rotation.y = Math.PI / 2;
  wall.position.set(lx(U) + 0.15, 40, 0);
  long.add(wall);
  // doubling brackets on the floor (z > 0, in front of the curve)
  const dbl = DOUBLINGS.map(([a, b], i) => {
    const g = new Group();
    const col = ["#2f6db3", "#3f86c9", "#5aa0dc", "#7dbbe9"][i];
    const w = lx(b) - lx(a);
    lk.add(new Mesh(new BoxGeometry(Math.max(0.05, w - 0.06), 0.18, 0.7), k.mat(col)), g).position.set(w / 2, 0.09, 0);
    g.position.set(lx(a), 0, 2.4);
    long.add(g);
    return g;
  });
  // climbing marker (G)
  const marker = new Mesh(new SphereGeometry(0.42, 18, 12), new MeshStandardMaterial({ color: "#ffd166", emissive: "#ffb000", emissiveIntensity: 0.8 }));
  long.add(marker);
  // equation plaque (F)
  const eq = new Group();
  {
    const bg = lk.add(new Mesh(new BoxGeometry(11.6, 2.6, 0.25), k.mat("#ffffff")), eq);
    bg.castShadow = true;
    const t = textPlane(["N = K ÷ (2026,87 − t)"], 1.15, { color: INK });
    t.position.z = 0.14;
    eq.add(t);
    const s = textPlane(["N = penduduk · t = tahun · K = konstanta"], 0.38, { color: "#6b737a", weight: 600 });
    s.position.set(0, -0.92, 0.14);
    eq.add(s);
  }
  eq.position.set(-1.5, 10.5, -1.2);
  long.add(eq);

  // ================= QUEUE ANALOGY
  const queue = new Group();
  root.add(queue);
  const qk = new Kit(queue);
  qk.box(QX - 30, QX + 14, -0.4, 0, -14, 8, k.mat("#e9e1cf"));
  // counter / gate
  qk.box(QX + 7, QX + 9.5, 0, 2.2, -1.4, 1.4, k.mat("#2f6db3"));
  qk.box(QX + 6.8, QX + 9.7, 2.2, 2.5, -1.6, 1.6, k.mat("#1d2328"));
  qk.box(QX + 5.2, QX + 5.4, 0, 1.1, -0.9, -0.7, "#9aa3aa");
  qk.box(QX + 5.2, QX + 5.4, 0, 1.1, 0.7, 0.9, "#9aa3aa");
  const QN = 160;
  const body = new InstancedMesh(new CylinderGeometry(0.17, 0.2, 0.62, 10), new MeshStandardMaterial({ roughness: 0.7 }), QN);
  const head = new InstancedMesh(new SphereGeometry(0.15, 12, 8), new MeshStandardMaterial({ color: "#d9a37c", roughness: 0.6 }), QN);
  body.castShadow = head.castShadow = true;
  body.frustumCulled = head.frustumCulled = false;
  const shirts = ["#e8622c", "#2f6db3", "#1f9e6e", "#f2c230", "#8a5cc2", "#d8432f", "#4a5560"];
  for (let i = 0; i < QN; i++) body.setColorAt(i, new Color(shirts[(i * 3) % shirts.length]));
  queue.add(body, head);
  /** Position of the i-th person in the snake queue (0 = at the gate). */
  const qpos = (i: number): [number, number] => {
    const row = Math.floor(i / 22), col = i % 22;
    const x = row % 2 === 0 ? QX + 4.6 - col * 0.62 : QX + 4.6 - 21 * 0.62 + col * 0.62;
    return [x, -row * 1.15];
  };

  // ================= MODERN CHART (1900 → 2100)
  const modern = new Group();
  root.add(modern);
  const mk = new Kit(modern);
  mk.box(MX - 14.5, MX + 14, -0.4, 0, -4, 4.5, k.mat("#e9e1cf"));
  mk.box(MX - 12.6, MX + 12.6, 0, 0.04, -0.08, 0.08, INK);
  mk.box(MX - 12.12, MX - 11.88, 0, 13, -0.12, 0.12, INK);
  for (let b = 2; b <= 12; b += 2) {
    mk.box(MX - 12.5, MX - 11.9, b * MY - 0.04, b * MY + 0.04, -0.06, 0.06, INK);
    mk.box(MX - 11.9, MX + 12.4, b * MY - 0.012, b * MY + 0.012, -0.9, -0.88, "#cfc6b2");
    const t = textPlane([`${b} M`], 0.5, { color: "#5b636a" });
    t.position.set(MX - 13.3, b * MY, 0.2);
    modern.add(t);
  }
  for (const y of [1900, 1950, 2000, 2050, 2100]) {
    mk.box(mx(y) - 0.04, mx(y) + 0.04, -0.02, 0.05, 0, 0.5, INK);
    const t = textPlane([`${y}`], 0.6, { color: "#5b636a" });
    t.rotation.x = -Math.PI / 2;
    t.position.set(mx(y), 0.06, 1.25);
    modern.add(t);
  }
  const realCurve = new FnCurve((u) => mp(1900 + u * (2024 - 1900), realAt(1900 + u * (2024 - 1900))));
  const realGeo = new TubeGeometry(realCurve, 400, 0.12, 8, false);
  const realMat = new MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 0.3 });
  const real = new Mesh(realGeo, realMat);
  real.castShadow = true;
  modern.add(real);
  const yClipM = U - Math.pow(K / 1e9 / (M_CLIP / MY), 1 / KEXP);
  const mfitCurve = new FnCurve((u) => {
    const y = 1900 + (yClipM - 1900) * u;
    return mp(y, formula(y));
  });
  const mfitGeo = new TubeGeometry(mfitCurve, 700, 0.1, 8, false);
  const mfitMat = new MeshStandardMaterial({ color: RED, emissive: RED, emissiveIntensity: 0.35, transparent: true, opacity: 1 });
  const mfit = new Mesh(mfitGeo, mfitMat);
  modern.add(mfit);
  const arrow = new Mesh(new ConeGeometry(0.45, 1.2, 14), mfitMat);
  arrow.position.set(mx(yClipM), M_CLIP * MY + 0.6, 0);
  modern.add(arrow);
  const mwallMat = new MeshStandardMaterial({ color: RED, transparent: true, opacity: 0.12, side: DoubleSide, depthWrite: false });
  const mwall = new Mesh(new PlaneGeometry(7, 40), mwallMat);
  mwall.rotation.y = Math.PI / 2;
  mwall.position.set(mx(U) + 0.08, 20, 0);
  modern.add(mwall);
  // projection (dashed)
  const projDash = new Group();
  {
    const pc = new FnCurve((u) => {
      const y = PROJ[0][0] + u * (2100 - PROJ[0][0]);
      return mp(y, realAt(y));
    });
    for (let i = 0; i < 22; i++) {
      const a = pc.getPoint(i / 22), b = pc.getPoint((i + 0.55) / 22);
      const d = new Mesh(new CylinderGeometry(0.09, 0.09, a.distanceTo(b), 8), new MeshStandardMaterial({ color: "#5cc79a", emissive: "#5cc79a", emissiveIntensity: 0.3 }));
      d.position.copy(a).add(b).multiplyScalar(0.5);
      d.lookAt(b);
      d.rotateX(Math.PI / 2);
      projDash.add(d);
    }
  }
  modern.add(projDash);
  const cross = new Mesh(new TorusGeometry(0.45, 0.07, 10, 28), new MeshStandardMaterial({ color: "#ffb000", emissive: "#ffb000", emissiveIntensity: 0.6 }));
  cross.position.set(...mp(1993, formula(1993)));
  modern.add(cross);
  const peak = new Mesh(new SphereGeometry(0.28, 14, 10), new MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 0.5 }));
  peak.position.set(...mp(2085, 10.3));
  modern.add(peak);
  const endDot = new Mesh(new SphereGeometry(0.3, 14, 10), new MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 0.5 }));
  endDot.position.set(...mp(2024, 8.16));
  modern.add(endDot);

  // ================= DESK (calendar, journal, cake)
  const desk = new Group();
  root.add(desk);
  const dk = new Kit(desk);
  dk.box(DX - 9, DX + 9, -0.6, 0, -6, 6, k.mat("#c9a27a", { roughness: 0.8 }));
  const cal = new Group();
  {
    dk.add(new Mesh(new BoxGeometry(4.2, 5.0, 0.5), k.mat("#ffffff")), cal).castShadow = true;
    dk.box(-2.1, 2.1, 1.6, 2.5, -0.26, 0.26, k.mat(RED), cal);
    for (const x of [-1.2, 1.2]) dk.add(new Mesh(new TorusGeometry(0.22, 0.06, 8, 18), k.mat("#9aa3aa")), cal).position.set(x, 2.5, 0);
    const top = textPlane(["JUMAT"], 0.5, { color: "#ffffff" });
    top.position.set(0, 2.05, 0.27);
    cal.add(top);
    const big = textPlane(["13"], 2.3, { color: INK, weight: 900 });
    big.position.set(0, 0.3, 0.27);
    cal.add(big);
    const mon = textPlane(["NOVEMBER 2026"], 0.45, { color: "#5b636a" });
    mon.position.set(0, -1.65, 0.27);
    cal.add(mon);
  }
  cal.position.set(DX, 2.5, 0);
  cal.rotation.x = -0.12;
  desk.add(cal);
  const journal = new Group();
  {
    dk.add(new Mesh(new BoxGeometry(3.0, 0.22, 3.9), k.mat("#f6f1e4")), journal).castShadow = true;
    dk.box(-1.5, 1.5, 0.11, 0.115, 1.2, 1.95, k.mat("#7b2d26"), journal);
    const t1 = textPlane(["SCIENCE · 1960"], 0.34, { color: "#ffffff" });
    t1.rotation.x = -Math.PI / 2;
    t1.position.set(0, 0.12, 1.57);
    journal.add(t1);
    const t2 = textPlane(["Doomsday:", "Friday, 13 November,", "A.D. 2026"], 0.3, { color: INK, weight: 700 });
    t2.rotation.x = -Math.PI / 2;
    t2.position.set(0, 0.12, 0.2);
    journal.add(t2);
    const t3 = textPlane(["von Foerster, Mora & Amiot"], 0.18, { color: "#5b636a", weight: 600 });
    t3.rotation.x = -Math.PI / 2;
    t3.position.set(0, 0.12, -1.25);
    journal.add(t3);
  }
  desk.add(journal);
  const cake = new Group();
  {
    dk.add(new Mesh(new CylinderGeometry(1.0, 1.0, 0.7, 28), k.mat("#f3d9c4")), cake).position.y = 0.35;
    dk.add(new Mesh(new CylinderGeometry(1.02, 1.02, 0.14, 28), k.mat("#e88aa0")), cake).position.y = 0.72;
    dk.add(new Mesh(new CylinderGeometry(0.05, 0.05, 0.5, 8), k.mat("#ffffff")), cake).position.y = 1.0;
    dk.add(new Mesh(new SphereGeometry(0.09, 10, 8), new MeshStandardMaterial({ color: "#ffcf4a", emissive: "#ffae00", emissiveIntensity: 1.2 })), cake).position.y = 1.32;
  }
  cake.position.set(DX + 3.4, 0, 1.6);
  desk.add(cake);

  const BG = new Color("#efe9dc");

  return {
    root,
    update: (t, shotId, pose, scene) => {
      const I = shot(shotId), lt = t - I.s;
      const stage = ["A", "B", "M"].includes(shotId) ? "desk" : ["C", "D", "E", "F", "G"].includes(shotId) ? "long" : shotId === "H" ? "queue" : "modern";
      long.visible = stage === "long";
      queue.visible = stage === "queue";
      modern.visible = stage === "modern";
      desk.visible = stage === "desk";
      scene.background = BG;
      scene.fog = new Fog(BG, 70, 260);
      sun.position.set(pose.target[0] + 16, pose.target[1] + 34, pose.target[2] + 22);
      sun.target.position.set(...pose.target);
      sun.target.updateMatrixWorld();

      if (stage === "desk") {
        const j = S.journal(t);
        journal.visible = shotId !== "A";
        journal.position.set(DX - 3.2 + (1 - smooth(j)) * -6, 0.11, 1.4);
        journal.rotation.y = 0.25 + (1 - j) * 0.6;
        cake.visible = shotId === "M";
        const c = smooth(clamp((t - L(13).s - 0.4) / 0.7));
        cake.scale.setScalar(Math.max(0.001, c));
        cal.rotation.y = shotId === "A" ? 0.18 * Math.sin(lt * 0.6) : 0;
      }

      if (stage === "long") {
        const np = S.points(t);
        pts.forEach((g, i) => {
          const s = smooth(clamp(np - i));
          g.scale.set(1, Math.max(0.001, s), 1);
          g.visible = s > 0.001 || shotId === "C";
          if (shotId === "C") g.scale.set(1, 1, 1);
        });
        const nd = shotId === "E" ? S.doublings(t) : shotId === "D" || shotId === "C" ? 0 : 4;
        dbl.forEach((g, i) => {
          const s = smooth(clamp(nd - i));
          g.scale.set(Math.max(0.001, s), 1, 1);
          g.visible = s > 0.001;
        });
        const f = shotId === "D" || shotId === "E" ? 0 : S.fit(t);
        const total = fitGeo.index ? fitGeo.index.count : 0;
        fitGeo.setDrawRange(0, Math.floor((total * f) / 6) * 6);
        fit.visible = f > 0.001;
        wallMat.opacity = shotId === "G" ? 0.22 * smooth(clamp((t - L(7).s - 0.3) / 1.2)) : shotId === "F" ? 0.1 * smooth(clamp((t - L(6).s - 3) / 1.5)) : 0;
        wall.visible = wallMat.opacity > 0.001;
        eq.visible = shotId === "F";
        if (eq.visible) {
          const a = smooth(clamp((t - L(6).s - 0.6) / 0.8));
          eq.scale.setScalar(Math.max(0.001, a));
          eq.position.y = 10.5 + Math.sin(lt * 1.2) * 0.15;
        }
        marker.visible = shotId === "G";
        if (marker.visible) {
          const y = S.gYear(t);
          const p = lp(y, Math.min(formula(y), L_CLIP / LY));
          marker.position.set(p[0], p[1], p[2] + 0.1);
        }
      }

      if (stage === "queue") {
        const n = S.queue(t);
        for (let i = 0; i < QN; i++) {
          const vis = i < n;
          const [x, z] = qpos(i);
          const bob = Math.abs(Math.sin(t * 6 + i)) * 0.03;
          setInstance(body, i, x, 0.31 + bob, z, vis ? 1 : 0);
          setInstance(head, i, x, 0.78 + bob, z, vis ? 1 : 0);
        }
        body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true;
      }

      if (stage === "modern") {
        const ry = S.realYear(t);
        const fy = S.fitYear(t);
        const rT = realGeo.index ? realGeo.index.count : 0;
        realGeo.setDrawRange(0, Math.floor((rT * clamp((ry - 1900) / (2024 - 1900))) / 6) * 6);
        const fT = mfitGeo.index ? mfitGeo.index.count : 0;
        mfitGeo.setDrawRange(0, Math.floor((fT * clamp((fy - 1900) / (yClipM - 1900))) / 6) * 6);
        arrow.visible = fy >= yClipM - 0.05;
        mfitMat.opacity = ["K", "L", "N"].includes(shotId) ? 0.35 : 1;
        cross.visible = shotId === "I" && fy >= 1992.5;
        cross.rotation.y = t * 1.5;
        projDash.visible = ["L", "N"].includes(shotId);
        if (projDash.visible) {
          const p = shotId === "L" ? S.proj(t) : 1;
          projDash.children.forEach((c, i) => (c.visible = i / projDash.children.length < p));
        }
        peak.visible = projDash.visible && (shotId === "N" || S.proj(t) > 0.75);
        endDot.visible = ry >= 2023.9;
        mwallMat.opacity = ["J"].includes(shotId) ? 0.16 : 0.08;
      }
    },
  };
};
