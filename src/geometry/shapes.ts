/**
 * Turns data primitives into sample points (body space). The same points are
 * used to build the 3D meshes and, after projection, the 2D image, so both
 * views always show the same structure.
 */
import type { EllipsoidPrimitive, Primitive } from "../data/types";
import { DEG, type Mat3, type Vec2, type Vec3, add, applyMat, mulMat, rotX, rotY, rotZ } from "./vec";

export function ellipsoidMatrix(p: EllipsoidPrimitive): Mat3 {
  const [rx, ry, rz] = p.rotationDeg ?? [0, 0, 0];
  return mulMat(rotZ(rz * DEG), mulMat(rotY(ry * DEG), rotX(rx * DEG)));
}

/** Uniform Catmull-Rom curve through `pts`, `perSegment` samples per span. */
export function smoothCurve(pts: readonly Vec3[], perSegment = 6): Vec3[] {
  if (pts.length < 3) return [...pts];
  const out: Vec3[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < perSegment; k++) {
      const t = k / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (j: 0 | 1 | 2) =>
        0.5 *
        (2 * p1[j] +
          (-p0[j] + p2[j]) * t +
          (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 +
          (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([c(0), c(1), c(2)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Points on an ellipsoid surface (latitude/longitude grid). */
export function ellipsoidSamples(p: EllipsoidPrimitive, lat = 10, lon = 20): Vec3[] {
  const m = ellipsoidMatrix(p);
  const out: Vec3[] = [];
  for (let i = 0; i <= lat; i++) {
    const th = (i / lat) * Math.PI;
    for (let j = 0; j < lon; j++) {
      const ph = (j / lon) * 2 * Math.PI;
      const local: Vec3 = [
        p.radii[0] * Math.sin(th) * Math.cos(ph),
        p.radii[1] * Math.cos(th),
        p.radii[2] * Math.sin(th) * Math.sin(ph),
      ];
      out.push(add(applyMat(m, local), p.center));
    }
  }
  return out;
}

const sampleCache = new WeakMap<Primitive, Vec3[]>();

/** Body-space sample points for a primitive (cached). */
export function primitiveSamples(p: Primitive): Vec3[] {
  const hit = sampleCache.get(p);
  if (hit) return hit;
  let pts: Vec3[];
  switch (p.kind) {
    case "hull":
      pts = [...p.points];
      break;
    case "ellipsoid":
      pts = ellipsoidSamples(p);
      break;
    case "tube":
      pts = smoothCurve(p.points);
      break;
  }
  sampleCache.set(p, pts);
  return pts;
}

/** 2D convex hull (Andrew's monotone chain), counter-clockwise. */
export function convexHull(points: readonly Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 2) return pts;
  const cross = (o: Vec2, a: Vec2, b: Vec2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
