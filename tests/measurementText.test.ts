import { describe, expect, it } from "vitest";
import { chest } from "../src/data/bodyParts/chest";
import type { PositioningState } from "../src/data/types";
import { computeImage } from "../src/geometry/image";
import { offsetPhrase, offsetShort, symmetryVerdict } from "../src/geometry/measurementText";

const base: PositioningState = {
  presetId: "AP",
  yawOffset: 0,
  lordotic: 0,
  tilt: 0,
  crAngle: 0,
  sidCm: 72 * 2.54,
  gapCm: 3,
  beam: "divergent",
};

const at = (o: Partial<PositioningState>) => computeImage(chest, { ...base, ...o });
const SC_PAIR = {
  right: "rSC-mid",
  left: "lSC-mid",
  noun: "SC joints",
  from: "the spinous processes",
};

/**
 * The defect these tests exist for: the near SC joint crosses the spinous-
 * process line at about 10° of rotation, so at the 15° the flagship scenario
 * uses, an unsigned "1.2 cm from the midline" describes a joint that is 1.2 cm
 * PAST the midline, on the other side of the patient.
 */
describe("signed midline offsets", () => {
  it("a square AP chest puts each SC joint on its own side of the midline", () => {
    const m = at({}).measurements;
    expect(m["rSC-mid"].side).toBe("R");
    expect(m["lSC-mid"].side).toBe("L");
    expect(m["rSC-mid"].crossed).toBe(false);
    expect(m["lSC-mid"].crossed).toBe(false);
    // Signed offsets cancel: that is what symmetry means here.
    expect(m["rSC-mid"].offset! + m["lSC-mid"].offset!).toBeCloseTo(0, 6);
    expect(m["rSC-mid"].offset).toBeLessThan(0);
    expect(m["lSC-mid"].offset).toBeGreaterThan(0);
  });

  it("the near SC joint crosses the midline between 8° and 12° of rotation in AP", () => {
    expect(at({ yawOffset: 8 }).measurements["rSC-mid"].crossed).toBe(false);
    expect(at({ yawOffset: 12 }).measurements["rSC-mid"].crossed).toBe(true);
    // The far joint never crosses: it moves away from the line, not across it.
    expect(at({ yawOffset: 12 }).measurements["lSC-mid"].crossed).toBe(false);
  });

  it("the unsigned distance is non-monotonic over 0–40° but the signed offset is not", () => {
    const yaws = [0, 5, 10, 15, 20, 25, 30, 35, 40];
    const dist = yaws.map((y) => at({ yawOffset: y }).measurements["rSC-mid"].distance);
    const off = yaws.map((y) => at({ yawOffset: y }).measurements["rSC-mid"].offset!);

    // The distance falls, then rises: it is the same number before and after
    // the crossing, which is why it cannot be shown on its own.
    expect(Math.min(...dist)).toBeLessThan(dist[0]);
    expect(dist[dist.length - 1]).toBeGreaterThan(dist[0]);
    const distFell = dist.some((v, i) => i > 0 && v < dist[i - 1]);
    const distRose = dist.some((v, i) => i > 0 && v > dist[i - 1]);
    expect(distFell && distRose).toBe(true);

    // The signed offset only ever increases.
    for (let i = 1; i < off.length; i++) expect(off[i]).toBeGreaterThan(off[i - 1]);
  });

  it("every readout of a crossed landmark says so, in both lengths", () => {
    // The short form holds the side letter with a non-breaking space; these
    // assertions are about the words, so they normalise it away first. The
    // space itself is pinned separately below.
    const words = (s: string) => s.replace(/\u00A0/g, " ");

    const m = at({ yawOffset: 15 }).measurements["rSC-mid"];
    expect(m.crossed).toBe(true);
    expect(words(offsetShort(m))).toBe("1.2 cm PAST, on pt's L");
    expect(offsetPhrase(m, "the midline")).toBe("1.2 cm past the midline, on the patient's left");

    const square = at({}).measurements["rSC-mid"];
    expect(words(offsetShort(square))).toBe("2.7 cm on pt's R");
    expect(offsetShort(square)).not.toMatch(/PAST/);
    expect(offsetPhrase(square, "the midline")).toBe(
      "2.7 cm to the patient's right of the midline",
    );
  });

  it("the side letter cannot be orphaned onto its own line", () => {
    // The measurements cell wraps, and the side letter is the one character
    // the readout exists to deliver, so it is tied to the words before it.
    for (const yawOffset of [0, 15]) {
      const s = offsetShort(at({ yawOffset }).measurements["rSC-mid"]);
      expect(s).toMatch(/pt's\u00A0[RL]$/);
      expect(s).not.toMatch(/pt's [RL]/);
    }
  });

  it("laterals carry no side, so no readout claims one", () => {
    for (const presetId of ["LLAT", "RLAT"]) {
      const m = at({ presetId }).measurements["rSC-mid"];
      expect(m.offset).toBeNull();
      expect(m.side).toBeNull();
      expect(m.crossed).toBe(false);
      expect(offsetShort(m)).toMatch(/^\d+\.\d cm$/);
      expect(offsetShort(m)).not.toMatch(/pt's|PAST/);
      expect(symmetryVerdict(at({ presetId }).measurements, SC_PAIR)).toBeNull();
    }
  });

  it("a midline landmark can never be reported as crossed", () => {
    // The jugular notch sits at body x = 0, so it has no side to cross from.
    const probe = {
      ...chest,
      measurements: [
        { id: "jn-mid", label: "JN → spine midline", kind: "pointToLine" as const, point: "jn", line: ["spT1", "spT2", "spT3"] },
      ],
    };
    for (const yawOffset of [0, 15, -40, 55]) {
      const m = computeImage(probe, { ...base, yawOffset }).measurements["jn-mid"];
      expect(m.crossed).toBe(false);
      expect(m.side).not.toBeNull();
    }
  });
});

describe("rotation verdict", () => {
  it("calls a square chest symmetric and names no rotation", () => {
    expect(symmetryVerdict(at({}).measurements, SC_PAIR)).toBe(
      "SC joints equidistant from the spinous processes: no rotation evident.",
    );
  });

  it("keeps growing past the crossing instead of folding back toward zero", () => {
    // The quantity the old verdict used, |right| − |left|, peaks at ~12° and
    // then shrinks, so 40° of rotation read as less than 15° of it.
    const magnitude = (v: string) => Number(v.match(/([\d.]+) cm/)![1]);
    const yaws = [5, 10, 15, 20, 30, 40];
    const said = yaws.map((y) => magnitude(symmetryVerdict(at({ yawOffset: y }).measurements, SC_PAIR)!));
    for (let i = 1; i < said.length; i++) expect(said[i]).toBeGreaterThan(said[i - 1]);

    const oldQuantity = yaws.map((y) => {
      const m = at({ yawOffset: y }).measurements;
      return Math.abs(m["rSC-mid"].distance - m["lSC-mid"].distance);
    });
    const oldShrank = oldQuantity.some((v, i) => i > 0 && v < oldQuantity[i - 1]);
    expect(oldShrank).toBe(true);
  });

  it("names the crossing and which way the pair has moved", () => {
    const v = symmetryVerdict(at({ yawOffset: 15 }).measurements, SC_PAIR)!;
    expect(v).toContain("Rotation present");
    expect(v).toContain("toward the patient's left");
    expect(v).toContain("the right has crossed");
    expect(v).toContain("onto the patient's left");
    // Rotating the other way must name the other side and the other joint.
    const w = symmetryVerdict(at({ yawOffset: -15 }).measurements, SC_PAIR)!;
    expect(w).toContain("toward the patient's right");
    expect(w).toContain("the left has crossed");
    expect(w).toContain("onto the patient's right");
  });
});
