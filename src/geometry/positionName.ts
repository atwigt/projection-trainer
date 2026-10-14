/**
 * Names the current position from the geometry (not from the preset that was
 * clicked), e.g. "≈ 15° LPO".
 */

/** Normalises an angle to (-180, 180]. */
export function normalizeDeg(a: number): number {
  let x = ((a % 360) + 360) % 360;
  if (x > 180) x -= 360;
  return x;
}

export interface PositionInfo {
  /** Main position, e.g. "AP", "≈ 15° LPO", "Left lateral". */
  name: string;
  /** Extra qualifiers: lordotic lean, tilt, CR angle. */
  details: string[];
  /** Laterals use the "viewed from the tube side" display convention. */
  isLateral: boolean;
  /** Angle between the body's coronal plane and the IR, 0–90°. */
  obliquity: number;
}

const TOL = 1.5;
const LATERAL_FROM = 70;

export function describePosition(
  yaw: number,
  lordotic = 0,
  tilt = 0,
  crAngle = 0,
): PositionInfo {
  const y = normalizeDeg(yaw);
  const abs = Math.abs(y);
  const obliquity = abs <= 90 ? abs : 180 - abs;
  const r = (v: number) => Math.round(v);
  let name: string;
  if (obliquity <= TOL) {
    name = abs <= 90 ? "AP" : "PA";
  } else if (Math.abs(abs - 90) <= TOL) {
    name = y > 0 ? "Left lateral" : "Right lateral";
  } else {
    // Which surface is against the IR.
    const side = y > 0 ? "L" : "R";
    const face = abs < 90 ? "PO" : "AO";
    name = `≈ ${r(obliquity)}° ${side}${face}`;
    if (obliquity >= LATERAL_FROM) name += ` (near ${side === "L" ? "left" : "right"} lateral)`;
  }

  const details: string[] = [];
  if (Math.abs(lordotic) > 0.5)
    details.push(
      lordotic > 0 ? `leaning back ${r(lordotic)}° (lordotic)` : `leaning forward ${r(-lordotic)}°`,
    );
  if (Math.abs(tilt) > 0.5)
    details.push(`tilted ${r(Math.abs(tilt))}° (head toward patient's ${tilt > 0 ? "right" : "left"})`);
  if (Math.abs(crAngle) > 0.5)
    details.push(`CR ${r(Math.abs(crAngle))}° ${crAngle > 0 ? "cephalic" : "caudal"}`);

  return { name, details, isLateral: obliquity >= LATERAL_FROM, obliquity };
}
