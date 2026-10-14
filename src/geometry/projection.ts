/**
 * The X-ray geometry. Everything on the radiograph is derived from here.
 *
 * World (room) coordinates, cm:
 *   The image receptor (IR) is the plane Z = 0. +Z points from the IR toward
 *   the tube. +Y is up (toward the patient's head). +X completes a
 *   right-handed frame (it is the viewer's right when standing at the tube
 *   looking at the IR).
 *
 * With every rotation at zero, body axes coincide with world axes, which is an
 * AP position: the patient's back is against the IR and they face the tube.
 */
import {
  DEG,
  type Mat3,
  type Vec2,
  type Vec3,
  add,
  applyMat,
  mulMat,
  rotX,
  rotY,
  rotZ,
  scale,
  sub,
} from "./vec";

export interface PoseAngles {
  /** Rotation about the long axis, deg (0 AP, 90 left lateral, 180 PA). */
  yaw: number;
  lordotic: number;
  tilt: number;
}

/**
 * Body → world rotation. Tilt is about the body's AP axis, lordotic about the
 * body's transverse axis, then the whole body turns about the vertical.
 */
export function poseMatrix({ yaw, lordotic, tilt }: PoseAngles): Mat3 {
  return mulMat(rotY(yaw * DEG), mulMat(rotX(-lordotic * DEG), rotZ(tilt * DEG)));
}

export interface Setup {
  /** Body → world rotation. */
  R: Mat3;
  /** World position of the body origin (the centring point). */
  center: Vec3;
  /** X-ray focal spot. */
  source: Vec3;
  /** Unit vector along the central ray, from source toward the IR. */
  crDir: Vec3;
  /** Where the central ray strikes the IR; the image is centred here. */
  irCenter: Vec3;
  sidCm: number;
  crAngle: number;
  beam: "divergent" | "parallel";
}

export interface SetupInput {
  R: Mat3;
  /** World Z of the body origin. */
  centerZ: number;
  sidCm: number;
  crAngle: number;
  beam: "divergent" | "parallel";
}

/**
 * Builds the tube/IR geometry. The central ray always passes through the
 * body origin; the IR stays in the plane Z = 0 and slides to stay centred on
 * the central ray (so CR angulation elongates the image, as in practice).
 * SID is measured along the central ray.
 */
export function buildSetup({ R, centerZ, sidCm, crAngle, beam }: SetupInput): Setup {
  const a = crAngle * DEG;
  // Cephalic (+) angulation tilts the ray toward the head (+Y).
  const crDir: Vec3 = [0, Math.sin(a), -Math.cos(a)];
  const center: Vec3 = [0, 0, centerZ];
  const irCenter = add(center, scale(crDir, centerZ / Math.cos(a)));
  const source = sub(irCenter, scale(crDir, sidCm));
  return { R, center, source, crDir, irCenter, sidCm, crAngle, beam };
}

/** Body-space point → world space. */
export function toWorld(setup: Setup, p: Vec3): Vec3 {
  return add(applyMat(setup.R, p), setup.center);
}

/**
 * Projects a world-space point onto the IR plane (Z = 0).
 * Divergent: the ray from the focal spot through the point.
 * Parallel: a ray parallel to the central ray (no magnification).
 * Returns IR coordinates relative to the CR entry point: [x, y] in cm with
 * the same orientation as world X / Y (i.e. as seen from the tube side).
 */
export function projectWorld(setup: Setup, p: Vec3): Vec2 {
  let q: Vec3;
  if (setup.beam === "divergent") {
    const s = setup.source;
    const t = s[2] / (s[2] - p[2]);
    q = add(s, scale(sub(p, s), t));
  } else {
    const d = setup.crDir;
    q = add(p, scale(d, -p[2] / d[2]));
  }
  return [q[0] - setup.irCenter[0], q[1] - setup.irCenter[1]];
}

/**
 * Linear magnification of a point: SID / SOD, measured perpendicular to the
 * IR (SOD = source-to-object distance). 1 for a parallel beam.
 */
export function magnificationAt(setup: Setup, p: Vec3): number {
  if (setup.beam === "parallel") return 1;
  const s = setup.source;
  return s[2] / (s[2] - p[2]);
}
