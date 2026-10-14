import type { BodyPart } from "../data/types";
import type { Evaluation, Scenario } from "../data/scenarios/types";
import { computeImage, type ImageResult } from "../geometry/image";

export interface ScenarioRun {
  before: ImageResult;
  after: ImageResult;
  evaluation: Evaluation;
}

/** Projects the scenario's start and end states and evaluates the outcome. */
export function runScenario(body: BodyPart, scenario: Scenario): ScenarioRun {
  const compute = (s: Parameters<typeof computeImage>[1]) => computeImage(body, s);
  const before = compute(scenario.start);
  const after = compute(scenario.end);
  const evaluation = scenario.evaluate({
    before,
    after,
    start: scenario.start,
    end: scenario.end,
    compute,
  });
  return { before, after, evaluation };
}
