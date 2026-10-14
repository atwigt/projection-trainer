/**
 * Words for the degenerate-geometry warning drawn on the image.
 *
 * Separate from the component for the same reason as measurementText.ts: this
 * repo has no component test harness, so anything left inside the SVG cannot
 * be tested at all. Here the wording is a pure function of the check and can
 * be asserted.
 */
import type { GeometryCheck } from "./image";

export interface GeometryWarning {
  /** Short heading, shown large. */
  title: string;
  /** Body lines, already broken to fit the receptor width. */
  lines: string[];
}

/**
 * Null when the drawn image is an ordinary projection.
 *
 * `inverted` is the one that matters: past the focal spot a ray reaches the IR
 * only after crossing the spot, so the shape is drawn inside out. The app drew
 * that silently, which is worse than refusing to draw it — a student has no
 * way to tell it from a real projection. The settings are deliberately not
 * restricted; a teaching app should let someone reach a broken geometry and
 * then tell them it is broken.
 */
export function geometryWarning(check: GeometryCheck): GeometryWarning | null {
  if (check.inverted)
    return {
      title: "IMPOSSIBLE GEOMETRY",
      lines: [
        "Part of the patient is at or behind the focal spot, so its",
        "rays cross before reaching the receptor and those shapes are",
        "drawn inside out. No real projection looks like this.",
      ],
    };
  if (check.extreme)
    return {
      title: "EXTREME MAGNIFICATION",
      lines: [
        `Up to ${check.maxMagnification.toFixed(1)}x. A diagnostic image is about 1.1-1.25x and`,
        "even deliberate magnification technique stops near 2x, so",
        "nothing here reads like a radiograph. Raise the SID, or",
        "reduce the patient-IR gap or the CR angle.",
      ],
    };
  return null;
}
