/**
 * Body-part registry. To add a body part (hand, elbow, C-spine…), create a
 * data file exporting a `BodyPart` (and optionally scenarios) and add it
 * here.
 */
import type { Scenario } from "../scenarios/types";
import { chestScenarios } from "../scenarios/chest";
import type { BodyPart } from "../types";
import { chest } from "./chest";

export interface BodyPartEntry {
  body: BodyPart;
  scenarios: Scenario[];
}

export const bodyParts: Record<string, BodyPartEntry> = {
  chest: { body: chest, scenarios: chestScenarios },
};

export const defaultBodyPartId = "chest";
