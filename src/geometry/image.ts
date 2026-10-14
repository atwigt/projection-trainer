/**
 * computeImage(): the single pure function that turns a body part + a
 * positioning state into everything both views need. The 3D scene uses
 * `setup`; the radiograph uses the projected shapes, landmarks and markers.
 */
import type { BodyPart, PositioningState, Primitive } from "../data/types";
import { describePosition, type PositionInfo } from "./positionName";
import {
  type Setup,
  buildSetup,
  magnificationAt,
  poseMatrix,
  projectWorld,
  toWorld,
} from "./projection";
import { convexHull, primitiveSamples } from "./shapes";
import { type Vec2, type Vec3, applyMat } from "./vec";

export interface ProjectedLandmark {
  id: string;
  /** Position on the displayed image, cm; +x = viewer's right, +y = up. */
  display: Vec2;
  world: Vec3;
  magnification: number;
  /** Object-to-image distance (perpendicular to the IR), cm. */
  oidCm: number;
}

export interface Shape2D {
  id: string;
  layer: Primitive["layer"];
  density: number;
  kind: "polygon" | "polyline";
  points: Vec2[];
  /** Stroke width for polylines (cm on the image). */
  width: number;
}

export interface MeasurementResult {
  id: string;
  label: string;
  /** Unsigned horizontal distance, cm on the image. */
  distance: number;
}

export interface ImageResult {
  setup: Setup;
  position: PositionInfo;
  /** True when the IR image is mirrored for display (e.g. PA positions). */
  flipped: boolean;
  convention: string;
  /**
   * Orientation labels at the viewer's left / right edge of the image
   * (R/L for AP/PA/obliques, A/P for laterals) plus, for laterals, the
   * lead marker of the side against the IR.
   */
  markers: { left: string; right: string; lateralSide?: "R" | "L" };
  landmarks: Record<string, ProjectedLandmark>;
  shapes: Shape2D[];
  measurements: Record<string, MeasurementResult>;
}

export function yawOf(body: BodyPart, s: PositioningState): number {
  const preset = body.presets.find((p) => p.id === s.presetId) ?? body.presets[0];
  return preset.yaw + s.yawOffset;
}

/** Body origin depth: the body is placed so its nearest point is `gapCm` from the IR. */
function centerDepth(body: BodyPart, R: Setup["R"], gapCm: number): number {
  let minZ = Infinity;
  for (const prim of body.primitives) {
    for (const p of primitiveSamples(prim)) minZ = Math.min(minZ, applyMat(R, p)[2]);
  }
  return gapCm - minZ;
}

export function computeImage(body: BodyPart, s: PositioningState): ImageResult {
  const yaw = yawOf(body, s);
  const R = poseMatrix({ yaw, lordotic: s.lordotic, tilt: s.tilt });
  const setup = buildSetup({
    R,
    centerZ: centerDepth(body, R, s.gapCm),
    sidCm: s.sidCm,
    crAngle: s.crAngle,
    beam: s.beam,
  });
  const position = describePosition(yaw, s.lordotic, s.tilt, s.crAngle);

  // Display convention. AP/PA/obliques: anatomical position, as if the
  // viewer faces the patient (patient's right on viewer's left). In IR
  // coordinates seen from the tube, the patient's left points along world
  // +X for AP-type positions; when it points along -X (PA-type) we mirror.
  // Laterals are displayed as seen from the tube side (no mirroring).
  const leftWorld = applyMat(R, [1, 0, 0]);
  const flipped = !position.isLateral && leftWorld[0] < 0;
  const toDisplay = (uv: Vec2): Vec2 => (flipped ? [-uv[0], uv[1]] : uv);

  let markers: ImageResult["markers"];
  let convention: string;
  if (position.isLateral) {
    const sideNearIR = leftWorld[2] < 0 ? "L" : "R";
    const anteriorRight = applyMat(R, [0, 0, 1])[0] > 0;
    markers = anteriorRight
      ? { left: "P", right: "A", lateralSide: sideNearIR }
      : { left: "A", right: "P", lateralSide: sideNearIR };
    convention = `Lateral: viewed from the tube side; ${sideNearIR === "L" ? "left" : "right"} side against IR`;
  } else {
    markers = { left: "R", right: "L" };
    convention = "Anatomical position: patient's right on viewer's left";
  }

  const landmarks: Record<string, ProjectedLandmark> = {};
  for (const lm of body.landmarks) {
    const w = toWorld(setup, lm.position);
    landmarks[lm.id] = {
      id: lm.id,
      display: toDisplay(projectWorld(setup, w)),
      world: w,
      magnification: magnificationAt(setup, w),
      oidCm: w[2],
    };
  }

  const shapes: Shape2D[] = body.primitives.map((prim) => {
    const world = primitiveSamples(prim).map((p) => toWorld(setup, p));
    const pts = world.map((w) => toDisplay(projectWorld(setup, w)));
    if (prim.kind === "tube") {
      const mag = world.reduce((acc, w) => acc + magnificationAt(setup, w), 0) / world.length;
      return { id: prim.id, layer: prim.layer, density: prim.density ?? 1, kind: "polyline", points: pts, width: 2 * prim.radius * mag };
    }
    return { id: prim.id, layer: prim.layer, density: prim.density ?? 1, kind: "polygon", points: convexHull(pts), width: 0 };
  });

  const measurements: Record<string, MeasurementResult> = {};
  for (const m of body.measurements) {
    const p = landmarks[m.point]?.display;
    const line = m.line.map((id) => landmarks[id]?.display).filter((v): v is Vec2 => !!v);
    if (!p || line.length < 2) continue;
    measurements[m.id] = { id: m.id, label: m.label, distance: Math.abs(p[0] - lineXAt(line, p[1])) };
  }

  return { setup, position, flipped, convention, markers, landmarks, shapes, measurements };
}

/** x of the polyline through `pts` at height y (linear, extrapolated at ends). */
export function lineXAt(pts: readonly Vec2[], y: number): number {
  const sorted = [...pts].sort((a, b) => a[1] - b[1]);
  let i = 0;
  while (i < sorted.length - 2 && y > sorted[i + 1][1]) i++;
  const [a, b] = [sorted[i], sorted[i + 1]];
  if (Math.abs(b[1] - a[1]) < 1e-9) return (a[0] + b[0]) / 2;
  return a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
}

/** Width / height of a projected shape on the image, cm. */
export function shapeExtent(img: ImageResult, id: string): { width: number; height: number } {
  const s = img.shapes.find((x) => x.id === id);
  if (!s) return { width: 0, height: 0 };
  const xs = s.points.map((p) => p[0]);
  const ys = s.points.map((p) => p[1]);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
