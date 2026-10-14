/**
 * Simplified adult thorax built from geometric primitives (no external
 * anatomy models). Coordinates in cm; see ../types.ts for the axes.
 * Origin ≈ midsagittal/midcoronal point at the level of T7 (PA chest
 * centring point).
 *
 * Proportions are approximate and chosen for teaching, not measured from a
 * specific atlas.
 */
import type { Vec3 } from "../../geometry/vec";
import type {
  BodyPart,
  EllipsoidPrimitive,
  HullPrimitive,
  Landmark,
  Primitive,
  TubePrimitive,
} from "../types";

const BONE = "#ddd5c4";
const BONE_DARK = "#c9bfaa";

/** Superior/inferior centre of thoracic vertebral body Tn (n = 1…12). */
export const vertebraY = (n: number) => 14 - (n - 1) * 2.4;
/** Spinous-process tip of Tn: thoracic spinous processes slope steeply down. */
export const spinousTip = (n: number): Vec3 => [0, vertebraY(n) - 1.6, -7.5];

function box(cx: number, cy: number, cz: number, w: number, h: number, d: number): Vec3[] {
  const pts: Vec3[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) pts.push([cx + (sx * w) / 2, cy + (sy * h) / 2, cz + (sz * d) / 2]);
  return pts;
}

const mirror = (p: Vec3, side: 1 | -1): Vec3 => [p[0] * side, p[1], p[2]];

// ---------------------------------------------------------------- spine
const spine: HullPrimitive[] = [];
for (let n = 1; n <= 12; n++) {
  const y = vertebraY(n);
  const w = 2.8 + 0.12 * (n - 1);
  const d = 2.4 + 0.08 * (n - 1);
  spine.push({
    id: `T${n}-body`,
    name: `T${n} vertebral body`,
    kind: "hull",
    layer: "bone",
    color: BONE,
    points: box(0, y, -2.0, w, 1.9, d),
  });
  // Pedicles/laminae + transverse processes as one arch.
  spine.push({
    id: `T${n}-arch`,
    name: `T${n} posterior arch`,
    kind: "hull",
    layer: "bone",
    color: BONE_DARK,
    points: [
      ...[-1, 1].flatMap((s) => [
        [s * 1.3, y + 0.5, -3.2],
        [s * 1.3, y - 0.5, -3.2],
        [s * 3.0, y + 0.3, -4.6],
        [s * 3.0, y - 0.4, -4.6],
      ] as Vec3[]),
      [0, y + 0.5, -4.6],
      [0, y - 0.5, -4.6],
    ],
  });
  const tip = spinousTip(n);
  spine.push({
    id: `T${n}-spinous`,
    name: `T${n} spinous process`,
    kind: "hull",
    layer: "bone",
    color: BONE_DARK,
    points: [
      ...box(0, y - 0.1, -4.4, 1.0, 1.0, 0.4),
      ...box(tip[0], tip[1], tip[2], 0.6, 0.6, 0.4),
    ],
  });
}

// ---------------------------------------------------------------- ribs
const RIB = {
  // half-width, posterior half-depth, anterior half-depth, anterior drop, end angle
  a: [5.5, 8.5, 10.5, 12, 13, 13.8, 14.3, 14.5, 14.3, 13.8, 12.8, 11],
  bP: [3.8, 5, 5.5, 6, 6.3, 6.5, 6.6, 6.7, 6.7, 6.6, 6.4, 6.2],
  bA: [5.6, 6.5, 7.2, 7.8, 8.3, 8.6, 8.8, 9, 9, 9, 8.8, 8.5],
  drop: [3, 5, 6.5, 7.5, 8, 8.5, 8.5, 8.5, 8, 7, 5, 3.5],
  end: [150, 145, 145, 145, 145, 145, 145, 140, 140, 135, 110, 90],
};

function ribPoints(n: number, side: 1 | -1): Vec3[] {
  const i = n - 1;
  const y0 = vertebraY(n);
  const pts: Vec3[] = [
    [side * 1.8, y0 + 0.3, -2.8], // head, on the vertebral body
    [side * 3.2, y0, -4.7], // tubercle, at the transverse process
  ];
  const start = 32;
  const end = RIB.end[i];
  for (let phi = start; phi <= end + 0.01; phi += (end - start) / 8) {
    const r = phi * (Math.PI / 180);
    const b = phi < 90 ? RIB.bP[i] : RIB.bA[i];
    const t = (phi - start) / (end - start);
    pts.push([side * RIB.a[i] * Math.sin(r), y0 - 0.3 - RIB.drop[i] * Math.pow(t, 1.6), -b * Math.cos(r)]);
  }
  return pts;
}

const ribs: TubePrimitive[] = [];
for (let n = 1; n <= 12; n++) {
  for (const side of [-1, 1] as const) {
    ribs.push({
      id: `rib${n}${side < 0 ? "R" : "L"}`,
      name: `${side < 0 ? "Right" : "Left"} rib ${n}`,
      kind: "tube",
      layer: "bone",
      color: BONE,
      radius: 0.45,
      points: ribPoints(n, side),
    });
  }
}

// ---------------------------------------------------------------- sternum & clavicles
export const SC_JOINT: Vec3 = [2.4, 10.8, 6.2];

const sternum: HullPrimitive[] = [
  {
    id: "manubrium",
    name: "Manubrium",
    kind: "hull",
    layer: "bone",
    color: BONE,
    points: [
      [-2.6, 11.0, 5.6], [2.6, 11.0, 5.6], [-2.6, 11.0, 6.8], [2.6, 11.0, 6.8],
      [-1.4, 11.6, 5.7], [1.4, 11.6, 5.7], [-1.4, 11.6, 6.9], [1.4, 11.6, 6.9],
      [-1.6, 6.8, 6.6], [1.6, 6.8, 6.6], [-1.6, 6.8, 7.8], [1.6, 6.8, 7.8],
    ],
  },
  {
    id: "sternum-body",
    name: "Body of sternum + xiphoid",
    kind: "hull",
    layer: "bone",
    color: BONE,
    points: [
      [-1.5, 6.6, 6.7], [1.5, 6.6, 6.7], [-1.5, 6.6, 7.8], [1.5, 6.6, 7.8],
      [-1.8, 1.0, 7.4], [1.8, 1.0, 7.4], [-1.8, 1.0, 8.5], [1.8, 1.0, 8.5],
      [-1.2, -4.0, 7.9], [1.2, -4.0, 7.9], [-1.2, -4.0, 9.0], [1.2, -4.0, 9.0],
      [0, -6.5, 8.3], [0, -6.5, 8.9],
    ],
  },
];

const clavicle = (side: 1 | -1): TubePrimitive => ({
  id: `clavicle${side < 0 ? "R" : "L"}`,
  name: `${side < 0 ? "Right" : "Left"} clavicle`,
  kind: "tube",
  layer: "bone",
  color: BONE,
  radius: 0.65,
  points: (
    [
      SC_JOINT,
      [5.5, 11.3, 6.0],
      [9.5, 12.1, 4.6],
      [13.5, 13.0, 2.0],
      [16.2, 13.4, -0.8],
    ] as Vec3[]
  ).map((p) => mirror(p, side)),
});

const scapula = (side: 1 | -1): HullPrimitive => {
  const outline: Vec3[] = [
    [6.5, 12.5, -6.9], // superior angle
    [15.8, 13.6, -2.6], // acromion
    [13.6, 10.8, -3.8], // glenoid / lateral angle
    [12.0, 3.0, -6.4], // lateral border
    [9.5, -4.5, -7.6], // inferior angle
    [6.0, 4.0, -7.4], // medial border
  ];
  return {
    id: `scapula${side < 0 ? "R" : "L"}`,
    name: `${side < 0 ? "Right" : "Left"} scapula`,
    kind: "hull",
    layer: "bone",
    color: BONE_DARK,
    density: 0.45,
    points: outline.flatMap((p) => [mirror(p, side), mirror([p[0], p[1], p[2] - 0.7], side)]),
  };
};

// ---------------------------------------------------------------- soft tissue
const LUNG_TILT = -12; // apex leans posteriorly
const lung = (side: 1 | -1): EllipsoidPrimitive => ({
  id: `lung${side < 0 ? "R" : "L"}`,
  name: `${side < 0 ? "Right" : "Left"} lung`,
  kind: "ellipsoid",
  layer: "air",
  color: "#9fb8cc",
  opacity: 0.18,
  center: [side * 7.8, 1.5, -1.0],
  radii: [6.3, 12.5, 7.0],
  rotationDeg: [LUNG_TILT, 0, 0],
});

const lungApex = (side: 1 | -1): Vec3 => {
  const r = LUNG_TILT * (Math.PI / 180);
  return [side * 7.8, 1.5 + 12.5 * Math.cos(r), -1.0 + 12.5 * Math.sin(r)];
};

const HEART = { center: [1.8, -3.0, 3.5] as Vec3, rx: 6.2, rot: -28 };
const heart: EllipsoidPrimitive = {
  id: "heart",
  name: "Heart",
  kind: "ellipsoid",
  layer: "organ",
  color: "#b5534f",
  opacity: 0.55,
  center: HEART.center,
  radii: [HEART.rx, 5.0, 4.5],
  rotationDeg: [0, 0, HEART.rot],
};
const heartApex: Vec3 = [
  HEART.center[0] + HEART.rx * Math.cos(HEART.rot * (Math.PI / 180)),
  HEART.center[1] + HEART.rx * Math.sin(HEART.rot * (Math.PI / 180)),
  HEART.center[2],
];

const torso: EllipsoidPrimitive = {
  id: "torso",
  name: "Soft tissue (thorax)",
  kind: "ellipsoid",
  layer: "soft",
  color: "#c8b7a6",
  opacity: 0.1,
  center: [0, -1, -0.5],
  radii: [19, 24, 10.5],
};

const primitives: Primitive[] = [
  torso,
  lung(-1),
  lung(1),
  heart,
  ...spine,
  ...ribs,
  ...sternum,
  clavicle(-1),
  clavicle(1),
  scapula(-1),
  scapula(1),
];

// ---------------------------------------------------------------- landmarks
const SP_COLOR = "#17a589";
const landmarks: Landmark[] = [
  { id: "rSC", label: "Right SC joint", short: "R SC", color: "#e4572e", position: mirror(SC_JOINT, -1) },
  { id: "lSC", label: "Left SC joint", short: "L SC", color: "#3a7bd5", position: SC_JOINT },
  { id: "jn", label: "Jugular notch (manubrium)", short: "JN", color: "#d9a400", position: [0, 11.6, 6.3], labelSide: "above" },
  { id: "xiphoid", label: "Xiphoid tip", short: "Xiph", color: "#8e5cc2", position: [0, -6.5, 8.6] },
  { id: "rClavMid", label: "Right clavicle (midshaft)", short: "R clav", color: "#a0673a", position: [-9.5, 12.1, 4.6] },
  { id: "rApex", label: "Right lung apex", short: "R apex", color: "#d16ba5", position: lungApex(-1) },
  { id: "lApex", label: "Left lung apex", short: "L apex", color: "#4fb3d9", position: lungApex(1) },
  { id: "heartApex", label: "Cardiac apex", short: "Apex", color: "#c0392b", position: heartApex },
  ...Array.from({ length: 12 }, (_, i): Landmark => {
    const n = i + 1;
    const labelled = n === 2 || n === 7;
    return {
      id: `spT${n}`,
      label: `T${n} spinous process tip`,
      short: `T${n} SP`,
      color: SP_COLOR,
      position: spinousTip(n),
      hidden: !labelled,
      labelSide: n === 2 ? "below" : "right",
    };
  }),
];

const midline = ["spT1", "spT2", "spT3", "spT4", "spT5", "spT6"];

export const chest: BodyPart = {
  id: "chest",
  name: "Chest / thorax",
  primitives,
  landmarks,
  measurements: [
    { id: "rSC-mid", label: "R SC joint → spine midline", kind: "pointToLine", point: "rSC", line: midline },
    { id: "lSC-mid", label: "L SC joint → spine midline", kind: "pointToLine", point: "lSC", line: midline },
  ],
  rayLandmarks: ["rSC", "lSC", "spT2"],
  presets: [
    { id: "PA", name: "PA", yaw: 180, description: "Anterior chest against the IR" },
    { id: "AP", name: "AP", yaw: 0, description: "Posterior chest against the IR" },
    { id: "LLAT", name: "Left lateral", yaw: 90, description: "Left side against the IR" },
    { id: "RLAT", name: "Right lateral", yaw: -90, description: "Right side against the IR" },
    { id: "RAO", name: "RAO 45°", yaw: -135, description: "Right anterior chest against the IR, 45°" },
    { id: "LAO", name: "LAO 45°", yaw: 135, description: "Left anterior chest against the IR, 45°" },
    { id: "RPO", name: "RPO 45°", yaw: -45, description: "Right posterior chest against the IR, 45°" },
    { id: "LPO", name: "LPO 45°", yaw: 45, description: "Left posterior chest against the IR, 45°" },
  ],
  defaults: { presetId: "PA", sidCm: 72 * 2.54, gapCm: 3 },
  ir: { widthCm: 35, heightCm: 43 },
};
