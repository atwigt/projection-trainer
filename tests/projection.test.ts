import { describe, expect, it } from "vitest";
import { chest } from "../src/data/bodyParts/chest";
import type { PositioningState } from "../src/data/types";
import { computeImage } from "../src/geometry/image";
import { describePosition } from "../src/geometry/positionName";
import { buildSetup, magnificationAt, poseMatrix, projectWorld } from "../src/geometry/projection";
import { IDENTITY } from "../src/geometry/vec";

const setup = (o: Partial<Parameters<typeof buildSetup>[0]> = {}) =>
  buildSetup({ R: IDENTITY, centerZ: 20, sidCm: 100, crAngle: 0, beam: "divergent", ...o });

describe("point-source projection", () => {
  it("places the source SID above the IR along the central ray", () => {
    const s = setup();
    expect(s.source).toEqual([0, 0, 100]);
    expect(s.irCenter[0]).toBeCloseTo(0);
    expect(s.irCenter[1]).toBeCloseTo(0);
  });

  it("magnifies a point halfway between source and IR by 2× (SID/SOD = 100/50)", () => {
    const s = setup();
    const [x, y] = projectWorld(s, [10, 5, 50]);
    expect(x).toBeCloseTo(20);
    expect(y).toBeCloseTo(10);
    expect(magnificationAt(s, [10, 5, 50])).toBeCloseTo(2);
  });

  it("uses SID/SOD for a realistic chest geometry (72″ SID, 18 cm OID)", () => {
    const sid = 72 * 2.54;
    const s = setup({ sidCm: sid });
    const [x] = projectWorld(s, [10, 0, 18]);
    expect(x).toBeCloseTo((10 * sid) / (sid - 18));
  });

  it("parallel beam does not magnify", () => {
    const s = setup({ beam: "parallel" });
    expect(projectWorld(s, [10, 5, 50])).toEqual([10, 5]);
    expect(magnificationAt(s, [10, 5, 50])).toBe(1);
  });

  it("a point lying on the IR projects onto itself in both modes", () => {
    for (const beam of ["divergent", "parallel"] as const) {
      const [x, y] = projectWorld(setup({ beam }), [7, -3, 0]);
      expect(x).toBeCloseTo(7);
      expect(y).toBeCloseTo(-3);
    }
  });

  it("the centring point always lands in the centre of the image", () => {
    for (const crAngle of [-30, -10, 0, 15, 30])
      for (const beam of ["divergent", "parallel"] as const) {
        const s = setup({ crAngle, beam });
        const [x, y] = projectWorld(s, s.center);
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(0);
      }
  });

  it("cephalic CR angle shifts objects by (OID difference) × tan(angle)", () => {
    // Centre at OID 20; a point 10 cm closer to the IR is projected 10·tan30
    // less cephalad than the centre, i.e. 5.77 cm below the image centre.
    const s = setup({ crAngle: 30, beam: "parallel" });
    const [x, y] = projectWorld(s, [0, 0, 10]);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(-10 * Math.tan(Math.PI / 6));
    // The source sits below the centre for a cephalic angle, aiming upward.
    expect(s.source[1]).toBeLessThan(0);
  });
});

describe("pose & position naming", () => {
  it("names positions from the yaw angle", () => {
    expect(describePosition(0).name).toBe("AP");
    expect(describePosition(180).name).toBe("PA");
    expect(describePosition(15).name).toBe("≈ 15° LPO");
    expect(describePosition(-20).name).toBe("≈ 20° RPO");
    expect(describePosition(190).name).toBe("≈ 10° RAO");
    expect(describePosition(135).name).toBe("≈ 45° LAO");
    expect(describePosition(90).name).toBe("Left lateral");
    expect(describePosition(-90).name).toBe("Right lateral");
  });

  it("positive yaw turns the patient's right side toward the tube in AP (→ LPO)", () => {
    // Patient's right is −x in the body. After a +yaw in AP it moves to +Z (away from IR).
    const R = poseMatrix({ yaw: 30, lordotic: 0, tilt: 0 });
    const rightZ = -R[2][0];
    expect(rightZ).toBeGreaterThan(0);
  });
});

const base: PositioningState = {
  presetId: "PA",
  yawOffset: 0,
  lordotic: 0,
  tilt: 0,
  crAngle: 0,
  sidCm: 72 * 2.54,
  gapCm: 3,
  beam: "divergent",
};

describe("display convention", () => {
  for (const presetId of ["AP", "PA", "LPO", "RAO"]) {
    it(`${presetId}: patient's right is on the viewer's left`, () => {
      const img = computeImage(chest, { ...base, presetId });
      expect(img.landmarks.rSC.display[0]).toBeLessThan(img.landmarks.lSC.display[0]);
      expect(img.markers.left).toBe("R");
    });
  }

  it("PA images are mirrored relative to the tube's view, AP images are not", () => {
    expect(computeImage(chest, { ...base, presetId: "PA" }).flipped).toBe(true);
    expect(computeImage(chest, { ...base, presetId: "AP" }).flipped).toBe(false);
  });

  it("a perfectly positioned PA chest has symmetric SC joints even with a divergent beam", () => {
    const img = computeImage(chest, base);
    expect(img.measurements["rSC-mid"].distance).toBeCloseTo(img.measurements["lSC-mid"].distance, 6);
  });

  it("keeps the nearest body surface at the requested gap from the IR", () => {
    const img = computeImage(chest, { ...base, gapCm: 5 });
    // The heart (anterior) is close to the IR in PA but far from it in AP.
    const ap = computeImage(chest, { ...base, presetId: "AP", gapCm: 5 });
    expect(img.landmarks.heartApex.oidCm).toBeLessThan(ap.landmarks.heartApex.oidCm);
    expect(img.setup.center[2]).toBeGreaterThan(5);
  });
});
