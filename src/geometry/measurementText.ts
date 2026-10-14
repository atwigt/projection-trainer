/**
 * Words for a point-to-line measurement.
 *
 * It sits beside the geometry rather than in a component because every place
 * that shows one of these numbers — the measurements table, the readout drawn
 * on the image, and the scenario explanations — has to say the same thing, and
 * the thing it has to say is a property of the measurement, not of the view.
 *
 * The rule all of it exists to enforce: a reader must never be able to picture
 * the point on the wrong side of the line it is measured from. A bare "1.2 cm
 * from the midline" is read as 1.2 cm short of the midline when the point is
 * 1.2 cm past it, so every form below names the side, and every form says so
 * when the point has crossed. Where the wording could go either way it goes
 * toward "it has crossed": a reader who wrongly believes it crossed will look
 * again, and one who wrongly believes it did not, will not.
 */
import type { MeasurementResult } from "./image";

const f1 = (v: number) => Math.abs(v).toFixed(1);

const sideWord = (side: "R" | "L") => (side === "R" ? "right" : "left");

/**
 * Compact form for a table cell or the readout drawn on the image, where the
 * row or caption beside it already names the line. Laterals have no left/right
 * axis, so there the magnitude is all there is.
 */
export function offsetShort(m: MeasurementResult): string {
  if (m.side === null) return `${f1(m.distance)} cm`;
  // Non-breaking space before the side letter: the table cell wraps, and a
  // lone "L" orphaned onto the next line is the one character this readout
  // exists to deliver.
  const on = `on pt's\u00A0${m.side}`;
  return m.crossed ? `${f1(m.distance)} cm PAST, ${on}` : `${f1(m.distance)} cm ${on}`;
}

/**
 * Prose fragment, for a sentence that has already named the line. `lineNoun`
 * is how that sentence refers to it, e.g. "the midline".
 */
export function offsetPhrase(m: MeasurementResult, lineNoun: string): string {
  if (m.side === null) return `${f1(m.distance)} cm from ${lineNoun}`;
  if (m.crossed)
    return `${f1(m.distance)} cm past ${lineNoun}, on the patient's ${sideWord(m.side)}`;
  return `${f1(m.distance)} cm to the patient's ${sideWord(m.side)} of ${lineNoun}`;
}

/** A pair of measurements that are mirror images of each other in the body. */
export interface SymmetryPair {
  /** Measurement id for the point on the patient's right. */
  right: string;
  /** Measurement id for the point on the patient's left. */
  left: string;
  /** Plural noun for the pair, e.g. "SC joints". */
  noun: string;
  /** What they are measured from, e.g. "the spinous processes". */
  from: string;
}

/**
 * Verdict on whether a mirrored pair is still symmetric about its line.
 *
 * The asymmetry is the SUM of the two signed offsets, which is zero exactly
 * when the pair is symmetric and keeps growing with rotation. The difference
 * of the two unsigned distances does not: once the near point crosses the
 * line, that difference stops growing and folds back toward zero, so a bigger
 * rotation reads as a smaller one.
 *
 * Returns null when the image has no left/right axis to judge against.
 */
export function symmetryVerdict(
  measurements: Record<string, MeasurementResult>,
  pair: SymmetryPair,
  tolCm = 0.3,
): string | null {
  const r = measurements[pair.right];
  const l = measurements[pair.left];
  if (!r || !l || r.offset === null || l.offset === null) return null;

  const asym = r.offset + l.offset;
  const crossed = [r, l].filter((m) => m.crossed);
  if (Math.abs(asym) < tolCm && crossed.length === 0)
    return `${pair.noun} equidistant from ${pair.from}: no rotation evident.`;

  const toward = asym > 0 ? "left" : "right";
  const head =
    `Rotation present: the midpoint of the ${pair.noun} sits ${f1(asym / 2)} cm` +
    ` toward the patient's ${toward} of ${pair.from}.`;
  if (crossed.length === 0) return head;

  const which = crossed
    .map((m) => {
      const name = m === r ? "right" : "left";
      // m.side is non-null here: `crossed` can only be true when it is.
      const to = m.side === null ? "the other side" : `the patient's ${sideWord(m.side)}`;
      return `the ${name} has crossed and now projects ${f1(m.distance)} cm onto ${to}`;
    })
    .join(", and ");
  return `${head} Of the two, ${which}.`;
}
