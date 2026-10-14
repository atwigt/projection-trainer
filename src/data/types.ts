/**
 * Data model for body parts, landmarks, presets and scenarios.
 *
 * Body coordinates (all in cm), patient in anatomical position:
 *   +x = patient's LEFT, +y = SUPERIOR, +z = ANTERIOR.
 * The origin is the point the central ray is centred on (for the chest: the
 * midsagittal / midcoronal intersection at about T7). The patient rotates
 * about this point.
 */
import type { Vec3 } from "../geometry/vec";

interface PrimitiveBase {
  id: string;
  name: string;
  /** Colour in the 3D view. */
  color: string;
  /** 3D opacity (default 1). */
  opacity?: number;
  /**
   * How the structure is drawn on the radiograph:
   * soft = body outline, air = lungs (dark), organ = heart, bone = bright.
   */
  layer: "soft" | "air" | "organ" | "bone";
  /** Relative radiographic density within its layer (default 1). */
  density?: number;
}

/** Convex solid defined by its corner points (vertebral body, sternum, scapula…). */
export interface HullPrimitive extends PrimitiveBase {
  kind: "hull";
  points: Vec3[];
}

/** Ellipsoid (heart, lungs, soft-tissue envelope). */
export interface EllipsoidPrimitive extends PrimitiveBase {
  kind: "ellipsoid";
  center: Vec3;
  radii: Vec3;
  /** Euler rotation in degrees, applied X then Y then Z (R = Rz·Ry·Rx). */
  rotationDeg?: Vec3;
}

/** Tube along a smooth curve through `points` (ribs, clavicles). */
export interface TubePrimitive extends PrimitiveBase {
  kind: "tube";
  points: Vec3[];
  radius: number;
}

export type Primitive = HullPrimitive | EllipsoidPrimitive | TubePrimitive;

export interface Landmark {
  id: string;
  /** Full label, e.g. "Right SC joint". */
  label: string;
  /** Short label drawn next to the point, e.g. "R SC". */
  short: string;
  color: string;
  position: Vec3;
  /** Hidden landmarks are used for measurements but drawn small and unlabeled. */
  hidden?: boolean;
  /** Where the label sits on the image (default: away from the midline). */
  labelSide?: "left" | "right" | "above" | "below";
}

/**
 * Horizontal (image left-right) distance from a landmark to a line through
 * other landmarks, evaluated at the landmark's height on the image.
 * Used for "SC joint to spinous-process midline".
 */
export interface PointToLineMeasurement {
  id: string;
  label: string;
  kind: "pointToLine";
  point: string;
  line: string[];
}

export type MeasurementDef = PointToLineMeasurement;

export interface Preset {
  id: string;
  name: string;
  /**
   * Rotation about the patient's long axis, degrees. 0 = AP (back to IR),
   * +90 = left lateral (left side to IR), 180 = PA, -90 = right lateral.
   * Positive values turn the patient's right side anteriorly.
   */
  yaw: number;
  description: string;
}

export interface BodyPart {
  id: string;
  name: string;
  primitives: Primitive[];
  landmarks: Landmark[];
  measurements: MeasurementDef[];
  /** Landmarks whose rays are drawn in 3D when no scenario is active. */
  rayLandmarks: string[];
  presets: Preset[];
  defaults: {
    presetId: string;
    sidCm: number;
    gapCm: number;
  };
  /** Image receptor size (portrait), cm. */
  ir: { widthCm: number; heightCm: number };
}

/** Everything that determines the image. */
export interface PositioningState {
  presetId: string;
  /** Added to the preset's yaw. + = patient's right side rotated anteriorly. */
  yawOffset: number;
  /** + = upper body leans back (superior end moves posteriorly), degrees. */
  lordotic: number;
  /** + = superior end of the body tilts toward the patient's right, degrees. */
  tilt: number;
  /** Central-ray angle, + = cephalic, - = caudal, degrees. */
  crAngle: number;
  /** Source-to-image distance along the central ray, cm. */
  sidCm: number;
  /** Air gap between the body surface nearest the IR and the IR, cm. */
  gapCm: number;
  beam: "divergent" | "parallel";
}
