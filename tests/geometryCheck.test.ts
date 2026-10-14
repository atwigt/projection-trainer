import { describe, expect, it } from "vitest";
import { chest } from "../src/data/bodyParts/chest";
import { chestScenarios } from "../src/data/scenarios/chest";
import type { PositioningState } from "../src/data/types";
import { geometryWarning } from "../src/geometry/geometryWarningText";
import { MAX_SANE_MAGNIFICATION, computeImage } from "../src/geometry/image";

const IN = 2.54;
const base: PositioningState = {
  presetId: "AP",
  yawOffset: 0,
  lordotic: 0,
  tilt: 0,
  crAngle: 0,
  sidCm: 72 * IN,
  gapCm: 3,
  beam: "divergent",
};
const check = (o: Partial<PositioningState>) =>
  computeImage(chest, { ...base, ...o }).geometryCheck;
const warn = (o: Partial<PositioningState>) => geometryWarning(check(o));

/**
 * The defect: the sliders reach settings that put drawn geometry at or behind
 * the focal spot, and the app projected those shapes inside out and said
 * nothing. The settings are deliberately still reachable — the fix is a
 * warning, not a narrower slider.
 */
describe("degenerate beam geometry", () => {
  it("says nothing about anything the app actually teaches", () => {
    // The premise the thresholds rest on. If a scenario ever drifts into the
    // warning, this fails and names it rather than the warning quietly
    // becoming normal.
    const taught: [string, Partial<PositioningState>][] = [
      ["chest defaults", { presetId: chest.defaults.presetId, sidCm: chest.defaults.sidCm, gapCm: chest.defaults.gapCm }],
      ...chest.presets.map((p): [string, Partial<PositioningState>] => [`preset ${p.id}`, { presetId: p.id }]),
      ...chestScenarios.flatMap((s): [string, Partial<PositioningState>][] => [
        [`${s.id} start`, s.start],
        [`${s.id} end`, s.end],
      ]),
    ];
    for (const [label, state] of taught) {
      const c = check(state);
      expect(c.inverted, label).toBe(false);
      expect(c.extreme, label).toBe(false);
      expect(warn(state), label).toBeNull();
      expect(c.maxMagnification, label).toBeLessThan(2);
    }
  });

  it("flags geometry that projects shapes inside out", () => {
    // Measured: LLAT at 30in SID with a 30 cm gap and a 40 degree CR puts the
    // nearest sample 9.6 cm BEHIND the focal spot.
    const state = { presetId: "LLAT", sidCm: 30 * IN, gapCm: 30, crAngle: 40 };
    const c = check(state);
    expect(c.minSodCm).toBeLessThan(0);
    expect(c.inverted).toBe(true);
    // Inversion outranks magnification: a point just in front of the focal
    // spot reports an enormous finite magnification, and reporting that
    // instead would describe the symptom and miss the cause.
    expect(c.extreme).toBe(false);
    expect(warn(state)!.title).toBe("IMPOSSIBLE GEOMETRY");
    expect(warn(state)!.lines.join(" ")).toContain("focal spot");
    expect(warn(state)!.lines.join(" ")).toContain("inside out");
  });

  it("needs CR angulation to invert: the worst perpendicular corner is intact", () => {
    // Measured over 406,224 states with the CR perpendicular: none invert.
    // This pins the two ends of that claim rather than re-running the sweep.
    const corner = { presetId: "LLAT", yawOffset: -20, sidCm: 30 * IN, gapCm: 30, lordotic: 40, tilt: -30 };
    const flat = check(corner);
    expect(flat.inverted).toBe(false);
    expect(flat.minSodCm).toBeGreaterThan(0);
    expect(flat.extreme).toBe(true); // it is absurd, just not impossible
    expect(check({ ...corner, crAngle: 40 }).inverted).toBe(true);
  });

  it("warns above 4x magnification, and not below it", () => {
    // Both sides of the boundary, so moving the threshold goes red and the
    // failure names the new number instead of only saying something changed.
    const under = { presetId: "LLAT", sidCm: 30 * IN, gapCm: 19 };
    const over = { presetId: "LLAT", sidCm: 30 * IN, gapCm: 20 };
    expect(check(under).maxMagnification).toBeCloseTo(3.969, 3);
    expect(check(over).maxMagnification).toBeCloseTo(4.187, 3);
    expect(check(under).maxMagnification).toBeLessThan(MAX_SANE_MAGNIFICATION);
    expect(check(over).maxMagnification).toBeGreaterThan(MAX_SANE_MAGNIFICATION);

    expect(check(under).extreme).toBe(false);
    expect(warn(under)).toBeNull();
    expect(check(over).extreme).toBe(true);
    expect(warn(over)!.title).toBe("EXTREME MAGNIFICATION");
    // The warning quotes the figure it is complaining about.
    expect(warn(over)!.lines.join(" ")).toContain("4.2x");
  });

  it("a parallel beam has no focal spot, so it can never warn", () => {
    for (const o of [
      { presetId: "LLAT", sidCm: 30 * IN, gapCm: 30, crAngle: 40 },
      { presetId: "AP", sidCm: 30 * IN, gapCm: 30, crAngle: -40, lordotic: 40 },
    ]) {
      // The same state is a warning with a divergent beam.
      expect(warn(o)).not.toBeNull();
      const c = check({ ...o, beam: "parallel" });
      expect(c.minSodCm).toBe(Infinity);
      expect(c.maxMagnification).toBe(1);
      expect(c.inverted).toBe(false);
      expect(c.extreme).toBe(false);
      expect(warn({ ...o, beam: "parallel" })).toBeNull();
    }
  });

  it("reads the shapes that are drawn, not only the landmarks", () => {
    // The landmarks sit inside the body; the torso's front surface reaches
    // further. A check over landmarks alone would miss the shapes that are
    // actually drawn inside out, which is the whole defect.
    const state = { presetId: "LLAT", sidCm: 30 * IN, gapCm: 30, crAngle: 40 };
    const img = computeImage(chest, { ...base, ...state });
    const landmarkMinSod = Math.min(
      ...Object.values(img.landmarks).map((l) => img.setup.source[2] - l.world[2]),
    );
    expect(img.geometryCheck.minSodCm).toBeLessThan(landmarkMinSod);
  });
});
