/** Layout constants and the satellite's motion as pure functions of time (tied to script lines). */
import { clamp, lerp, ramp } from "../../engine/math";
import type { Ctx, Vec3 } from "../../engine/types";

// Stylised near-Earth diorama: Earth fills the bottom of the frame; the orbit is a
// diagram ring around ORBIT_C (not geocentric — it reads better on screen).
export const ER = 26;
export const EARTH_CY = -26.55;
export const ORBIT_C: Vec3 = [0, 2.2, 0];
export const OR = 5.2; // stylized altitude of Swift (≈ 600 km class orbit)
export const OR_LOW = 3.25; // stylised last altitude (≈ 275 km)
export const TILT = 0.32; // orbit plane tilt (rad)
export const MX = 150; // Newton's cannonball diorama sits at this x offset

export const makeState = ({ L, shot }: Ctx) => {
  /** Swift's orbit angle: nearly frozen for the inspection beat, then accelerates through the decay story. */
  const phi = (t: number) => 1.15 + 0.045 * t + 2.15 * ramp(t, L(7).s, L(13).e);
  /** Orbit radius: spirals inward during line 7, then dives toward the atmosphere in line 12. */
  const radius = (t: number) =>
    OR - (OR - OR_LOW) * ramp(t, L(7).s + 0.5, L(8).e) - (OR_LOW - 0.55) * ramp(t, L(12).s + 0.6, L(12).e + 0.4);
  /** Extra downward sink during the reentry dive (y of the satellite). */
  const sink = (t: number) => -2.35 * ramp(t, L(12).s + 0.6, L(12).e + 0.4);
  /** 1 while the satellite is still aloft; fades to 0 as it burns up. */
  const intact = (t: number) => 1 - ramp(t, L(12).s + 2.2, L(12).e + 0.4);
  /** Reentry plasma intensity 0..1. */
  const burn = (t: number) =>
    ramp(t, L(12).s + 0.8, L(12).s + 2.0) * (1 - ramp(t, L(12).e - 0.4, L(12).e + 0.9));
  /** Flash at the end of the burn (the "event"). */
  const flash = (t: number) => {
    const p = ramp(t, L(12).e - 0.2, L(12).e + 0.7);
    return Math.sin(clamp(p) * Math.PI);
  };
  /** Gamma-ray burst bloom for the "last observation" shot (line 9) and the legacy shot (line 11). */
  const grb = (t: number) => {
    const a = shot("I").s + 1.3;
    const b = shot("K").s + 1.0;
    return (
      ramp(t, a, a + 1.1) * (1 - ramp(t, a + 1.7, a + 3.4)) +
      0.55 * ramp(t, b, b + 0.9) * (1 - ramp(t, b + 1.2, b + 2.6))
    );
  };
  const satPos = (t: number): Vec3 => {
    const p = phi(t), r = radius(t);
    return [r * Math.cos(p), ORBIT_C[1] + r * Math.sin(p) * Math.sin(TILT) + sink(t), r * Math.sin(p) * Math.cos(TILT)];
  };
  /** LINK rescue attempt (line 8): approaches from behind during the shot, fails, drifts tumbling away. */
  const linkPos = (t: number): Vec3 => {
    const sp = satPos(t);
    const p = phi(t);
    const u1 = ramp(t, shot("H").s + 0.3, L(8).e - 0.4); // approach
    const u2 = ramp(t, L(8).e - 0.4, shot("H").e + 1.6); // drift away after failure
    const along = lerp(3.6, 1.05, u1) + u2 * 1.8;
    // tangent of the orbit at angle p is (-sin p, 0, cos p); LINK trails behind Swift
    return [sp[0] + Math.sin(p) * along, sp[1] + 0.4 - u2 * 0.9, sp[2] - Math.cos(p) * along];
  };
  /** Tumble angle of the failed LINK craft. */
  const linkTumble = (t: number) => ramp(t, L(8).e - 0.6, shot("H").e + 1.5) * 2.6;
  /** Fireball streak for the news-open shot (line 1): crosses the sky left->right. */
  const streak = (t: number) => {
    const a = L(1).s + 1.15;
    const u = ramp(t, a, a + 2.1);
    return { u, on: t >= a && t < a + 2.6, pos: lerp(-9, 9, u) as number };
  };
  /** Atmosphere shell "breathing" while the Sun is active (line 6). */
  const swell = (t: number) => 1 + 0.030 * ramp(t, L(6).s + 0.5, L(6).s + 1.6) * (0.6 + 0.4 * Math.sin(t * 5.2));
  /** 0 → 1 sun-flare intensity across line 6. */
  const flare = (t: number) => 0.55 + 0.45 * Math.sin(t * 3.1) * ramp(t, L(6).s, L(6).e);
  /** Spiral rings revealed one after another during line 7. */
  const ringLevel = (t: number, i: number) => ramp(t, L(7).s + 0.35 + i * 0.62, L(7).s + 0.95 + i * 0.62);
  /** Warm look for the closing shots. */
  const warm = (t: number) => ramp(t, L(13).s - 0.4, L(13).s + 2.2);

  return {
    phi,
    radius,
    sink,
    intact,
    burn,
    flash,
    grb,
    satPos,
    linkPos,
    linkTumble,
    streak,
    swell,
    flare,
    ringLevel,
    warm,
  };
};
export type State = ReturnType<typeof makeState>;
