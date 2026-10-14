import { describe, expect, it } from "vitest";
import { chest } from "../src/data/bodyParts/chest";
import { chestScenarios } from "../src/data/scenarios/chest";
import { runScenario } from "../src/learning/runScenario";

const byId = (id: string) => {
  const s = chestScenarios.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};

const table = (run: ReturnType<typeof runScenario>) =>
  run.evaluation.facts
    .map((f) => `  ${f.label.padEnd(34)} ${f.before.toFixed(2).padStart(7)} → ${f.after.toFixed(2).padStart(7)} ${f.unit}`)
    .join("\n");

describe("SC joint scenario: AP chest, right thorax rotated 15° anteriorly", () => {
  const run = runScenario(chest, byId("ap-right-anterior"));
  const before = run.before.measurements;
  const after = run.after.measurements;

  it("starts symmetric", () => {
    expect(before["rSC-mid"].distance).toBeCloseTo(before["lSC-mid"].distance, 6);
  });

  it("ends up as ≈ 15° LPO", () => {
    expect(run.after.position.name).toBe("≈ 15° LPO");
  });

  it("right SC joint (away from the IR) moves toward the spine; left moves away", () => {
    console.log(`\n${run.after.position.name}\n${table(run)}\n`);
    expect(after["rSC-mid"].distance).toBeLessThan(before["rSC-mid"].distance);
    expect(after["lSC-mid"].distance).toBeGreaterThan(before["lSC-mid"].distance);
    expect(run.after.landmarks.rSC.oidCm).toBeGreaterThan(run.after.landmarks.lSC.oidCm);
    expect(run.evaluation.correct).toBe("rCloser");
  });
});

describe("SC joint scenario: PA chest, ≈ 10° RAO", () => {
  const run = runScenario(chest, byId("pa-rao"));
  it("the right SC joint (nearer the IR) projects closer to the spine", () => {
    console.log(`\n${run.after.position.name}\n${table(run)}\n`);
    expect(run.after.position.name).toBe("≈ 10° RAO");
    expect(run.evaluation.correct).toBe("right");
  });
});

describe("all scenarios", () => {
  for (const s of chestScenarios) {
    it(`${s.id}: evaluates to one of its own choices`, () => {
      const run = runScenario(chest, s);
      console.log(`\n[${s.id}] → ${run.evaluation.correct}\n${table(run)}`);
      expect(s.choices.map((c) => c.id)).toContain(run.evaluation.correct);
      expect(run.evaluation.explanation.length).toBeGreaterThan(0);
    });
  }

  it("lordotic and cephalic-CR scenarios both lift the clavicles above the apices", () => {
    for (const id of ["ap-lordotic", "ap-axial-cephalic"]) {
      const run = runScenario(chest, byId(id));
      expect(run.evaluation.correct).toBe("up");
      expect(run.evaluation.facts[0].after).toBeGreaterThan(0);
    }
  });

  it("magnification scenarios: heart gets wider", () => {
    expect(runScenario(chest, byId("pa-oid")).evaluation.correct).toBe("wider");
    expect(runScenario(chest, byId("pa72-vs-ap40")).evaluation.correct).toBe("wider");
  });
});
