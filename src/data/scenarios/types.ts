import type { ImageResult } from "../../geometry/image";
import type { PositioningState } from "../types";

export interface Fact {
  label: string;
  before: number;
  after: number;
  unit: string;
}

export interface Evaluation {
  /** The choice that matches what the geometry actually produced. */
  correct: string;
  facts: Fact[];
  /** Plain-language explanation built from the computed numbers. */
  explanation: string[];
}

export interface EvalContext {
  before: ImageResult;
  after: ImageResult;
  start: PositioningState;
  end: PositioningState;
  /** Re-run the projection for any other state (e.g. a parallel-beam check). */
  compute: (s: PositioningState) => ImageResult;
}

/**
 * A learning scenario. The correct answer is NOT stored: `evaluate` measures
 * the projected images and picks the choice that matches.
 */
export interface Scenario {
  id: string;
  title: string;
  topic: "Rotation" | "CR angulation" | "Magnification";
  prompt: string;
  question: string;
  choices: { id: string; text: string }[];
  start: PositioningState;
  end: PositioningState;
  /** Landmarks to emphasise (others are dimmed). */
  focus: string[];
  evaluate: (ctx: EvalContext) => Evaluation;
}
