/**
 * Chest scenarios. Each `evaluate` measures the projected images and derives
 * the correct choice and the explanation from those measurements. Nothing
 * here says "rotation X moves landmark Y"; that is left to the projection.
 */
import { type ImageResult, shapeExtent } from "../../geometry/image";
import type { PositioningState } from "../types";
import type { EvalContext, Evaluation, Fact, Scenario } from "./types";

const IN = 2.54;
const base: PositioningState = {
  presetId: "PA",
  yawOffset: 0,
  lordotic: 0,
  tilt: 0,
  crAngle: 0,
  sidCm: 72 * IN,
  gapCm: 3,
  beam: "divergent",
};
const state = (o: Partial<PositioningState>): PositioningState => ({ ...base, ...o });

const f1 = (v: number) => v.toFixed(1);
const TOL = 0.1; // cm on the image: smaller changes count as "no change"
const trend = (before: number, after: number) =>
  after - before > TOL ? "up" : before - after > TOL ? "down" : "same";

const sc = (img: ImageResult) => ({
  r: img.measurements["rSC-mid"].distance,
  l: img.measurements["lSC-mid"].distance,
  rOid: img.landmarks.rSC.oidCm,
  lOid: img.landmarks.lSC.oidCm,
});

/** Shared facts + explanation for the SC-joint rotation scenarios. */
function scExplanation(ctx: EvalContext): { facts: Fact[]; text: string[] } {
  const b = sc(ctx.before);
  const a = sc(ctx.after);
  const facts: Fact[] = [
    { label: "R SC joint → spine midline", before: b.r, after: a.r, unit: "cm" },
    { label: "L SC joint → spine midline", before: b.l, after: a.l, unit: "cm" },
    { label: "R SC joint OID", before: b.rOid, after: a.rOid, unit: "cm" },
    { label: "L SC joint OID", before: b.lOid, after: a.lOid, unit: "cm" },
  ];
  const closer = a.r < a.l ? "right" : "left";
  const closerOid = closer === "right" ? a.rOid : a.lOid;
  const otherOid = closer === "right" ? a.lOid : a.rOid;
  const nearFar = closerOid > otherOid ? "farther from" : "closer to";
  const lm = ctx.after.landmarks;
  // AP separation of the SC joints from the spinous processes, in the body.
  const sep = ctx.before.landmarks.rSC.world[2] - ctx.before.landmarks.spT2.world[2];
  const par = ctx.compute({ ...ctx.end, beam: "parallel" });
  const pr = sc(par);
  return {
    facts,
    text: [
      `The patient is now ${ctx.after.position.name}. Measured on the image, the right SC joint went from ${f1(b.r)} to ${f1(a.r)} cm from the spine midline and the left from ${f1(b.l)} to ${f1(a.l)} cm.`,
      `Why: the SC joints are on the front of the thorax and the spinous processes on the back, about ${f1(Math.abs(sep))} cm apart front-to-back. When the thorax turns about its long axis, front and back structures sweep sideways in opposite directions, so on the image the spine slides one way and the SC joints the other.`,
      `So the ${closer} SC joint now sits closer to the spine. It is the one ${nearFar} the IR (OID ${f1(closerOid)} cm vs ${f1(otherOid)} cm).`,
      `Check: with a parallel beam (no magnification) the distances are ${f1(pr.r)} cm (R) and ${f1(pr.l)} cm (L), nearly the same asymmetry. The effect comes from rotation, not from beam divergence. (Landmark positions: R SC ${lm.rSC.display.map(f1).join(", ")}, L SC ${lm.lSC.display.map(f1).join(", ")} cm from image centre.)`,
    ],
  };
}

const clavApex = (img: ImageResult) =>
  img.landmarks.rClavMid.display[1] - img.landmarks.rApex.display[1];

function clavicleEvaluation(ctx: EvalContext, cause: string): Evaluation {
  const b = clavApex(ctx.before);
  const a = clavApex(ctx.after);
  const t = trend(b, a);
  const correct = t === "up" ? "up" : t === "down" ? "down" : "same";
  const clavOid = ctx.after.landmarks.rClavMid.oidCm;
  const apexOid = ctx.after.landmarks.rApex.oidCm;
  const where = (v: number) => (v > 0 ? `${f1(v)} cm ABOVE` : `${f1(-v)} cm BELOW`);
  return {
    correct,
    facts: [
      { label: "R clavicle − R apex (vertical)", before: b, after: a, unit: "cm" },
      { label: "R clavicle OID", before: ctx.before.landmarks.rClavMid.oidCm, after: clavOid, unit: "cm" },
      { label: "R lung apex OID", before: ctx.before.landmarks.rApex.oidCm, after: apexOid, unit: "cm" },
    ],
    explanation: [
      `Before: the midshaft of the right clavicle projected ${where(b)} the lung apex. After: ${where(a)} it.`,
      `${cause} The clavicle is an anterior structure (OID ${f1(clavOid)} cm here) and the apex is posterior (OID ${f1(apexOid)} cm), so the clavicle is displaced more and moves ${a > b ? "up" : "down"} relative to the apex.`,
      a > 0
        ? "The clavicles now clear the apices, which is why lordotic / apical projections show the apices free of clavicle superimposition."
        : "The clavicles still overlap the apices. Try a larger angle to clear them.",
    ],
  };
}

function heartWidthEvaluation(ctx: EvalContext): { correct: string; facts: Fact[]; b: number; a: number } {
  const b = shapeExtent(ctx.before, "heart").width;
  const a = shapeExtent(ctx.after, "heart").width;
  const t = trend(b, a);
  return {
    correct: t === "up" ? "wider" : t === "down" ? "narrower" : "same",
    b,
    a,
    facts: [
      { label: "Heart width on image", before: b, after: a, unit: "cm" },
      { label: "Magnification at cardiac apex", before: ctx.before.landmarks.heartApex.magnification, after: ctx.after.landmarks.heartApex.magnification, unit: "×" },
      { label: "Cardiac apex OID", before: ctx.before.landmarks.heartApex.oidCm, after: ctx.after.landmarks.heartApex.oidCm, unit: "cm" },
      { label: "SID", before: ctx.start.sidCm, after: ctx.end.sidCm, unit: "cm" },
    ],
  };
}

export const chestScenarios: Scenario[] = [
  {
    id: "ap-right-anterior",
    title: "AP chest: right side rotated anteriorly",
    topic: "Rotation",
    prompt:
      "Starting from a standard AP chest, the patient's right thorax is rotated 15° anteriorly (away from the IR).",
    question: "How do the SC joints move relative to the spine on the image?",
    choices: [
      { id: "rCloser", text: "Right SC joint moves closer to the spine; left moves farther away" },
      { id: "lCloser", text: "Left SC joint moves closer to the spine; right moves farther away" },
      { id: "same", text: "Both stay the same distance from the spine" },
      { id: "both", text: "Both move farther from the spine" },
    ],
    start: state({ presetId: "AP" }),
    end: state({ presetId: "AP", yawOffset: 15 }),
    focus: ["rSC", "lSC", "spT2"],
    evaluate(ctx) {
      const b = sc(ctx.before);
      const a = sc(ctx.after);
      const tr = trend(b.r, a.r);
      const tl = trend(b.l, a.l);
      const correct =
        tr === "down" && tl === "up" ? "rCloser"
        : tl === "down" && tr === "up" ? "lCloser"
        : tr === "up" && tl === "up" ? "both"
        : "same";
      const { facts, text } = scExplanation(ctx);
      return { correct, facts, explanation: text };
    },
  },
  {
    id: "pa-rao",
    title: "PA chest: slight RAO",
    topic: "Rotation",
    prompt:
      "A patient positioned for a PA chest turns slightly so the right anterior chest comes closer to the IR (≈ 10° RAO).",
    question: "Which SC joint will appear closer to the spine?",
    choices: [
      { id: "right", text: "The right SC joint" },
      { id: "left", text: "The left SC joint" },
      { id: "equal", text: "Neither, they stay equidistant" },
    ],
    start: state({ presetId: "PA" }),
    end: state({ presetId: "PA", yawOffset: 10 }),
    focus: ["rSC", "lSC", "spT2"],
    evaluate(ctx) {
      const a = sc(ctx.after);
      const correct = Math.abs(a.r - a.l) <= TOL ? "equal" : a.r < a.l ? "right" : "left";
      const { facts, text } = scExplanation(ctx);
      return { correct, facts, explanation: text };
    },
  },
  {
    id: "ap-lordotic",
    title: "AP lordotic: leaning back",
    topic: "Rotation",
    prompt:
      "From an AP chest, the patient leans back 20° so the shoulders rest against the IR. The CR stays horizontal (AP lordotic).",
    question: "Where do the clavicles project relative to the lung apices?",
    choices: [
      { id: "up", text: "Clavicles move up relative to the apices (toward clearing them)" },
      { id: "down", text: "Clavicles move down, further over the lung fields" },
      { id: "same", text: "No change in their relationship" },
    ],
    start: state({ presetId: "AP" }),
    end: state({ presetId: "AP", lordotic: 20 }),
    focus: ["rClavMid", "rApex", "lApex"],
    evaluate: (ctx) =>
      clavicleEvaluation(
        ctx,
        "Leaning back rotates the upper thorax about a transverse axis: anterior structures swing up and posterior structures swing down.",
      ),
  },
  {
    id: "ap-axial-cephalic",
    title: "AP axial: 20° cephalic CR",
    topic: "CR angulation",
    prompt:
      "The patient stays in a standard AP chest position. Instead of moving the patient, the CR is angled 20° cephalic (AP axial apical).",
    question: "Where do the clavicles project relative to the lung apices?",
    choices: [
      { id: "up", text: "Clavicles move up relative to the apices (toward clearing them)" },
      { id: "down", text: "Clavicles move down, further over the lung fields" },
      { id: "same", text: "No change, only the whole image shifts" },
    ],
    start: state({ presetId: "AP" }),
    end: state({ presetId: "AP", crAngle: 20 }),
    focus: ["rClavMid", "rApex", "lApex"],
    evaluate(ctx) {
      const ev = clavicleEvaluation(
        ctx,
        "An angled CR shifts every structure along the direction of the angle by roughly its OID × tan(angle): the farther a structure is from the IR, the more it is projected cephalad.",
      );
      const rb = shapeExtent(ctx.before, "rib1R").height;
      const ra = shapeExtent(ctx.after, "rib1R").height;
      ev.facts.push({ label: "R 1st rib, vertical extent", before: rb, after: ra, unit: "cm" });
      ev.explanation.push(
        `Shape changes come from depth. A flat structure parallel to the IR is only shifted, but the 1st rib runs from back to front, so its two ends shift by different amounts: its vertical extent goes from ${f1(rb)} to ${f1(ra)} cm.`,
      );
      return ev;
    },
  },
  {
    id: "pa-oid",
    title: "PA chest: patient away from the IR",
    topic: "Magnification",
    prompt:
      "A patient in a wheelchair cannot get close to the chest stand: the gap between the chest and the IR increases from 3 cm to 20 cm. SID stays 72″.",
    question: "What happens to the width of the heart on the image?",
    choices: [
      { id: "wider", text: "It gets wider (more magnification)" },
      { id: "narrower", text: "It gets narrower" },
      { id: "same", text: "No change, only SID affects size" },
    ],
    start: state({ presetId: "PA", gapCm: 3 }),
    end: state({ presetId: "PA", gapCm: 20 }),
    focus: ["heartApex", "rSC", "lSC"],
    evaluate(ctx) {
      const h = heartWidthEvaluation(ctx);
      const ma = ctx.after.landmarks.heartApex;
      return {
        correct: h.correct,
        facts: h.facts,
        explanation: [
          `The heart's shadow went from ${f1(h.b)} to ${f1(h.a)} cm wide (${f1(((h.a - h.b) / h.b) * 100)}%).`,
          `Magnification = SID ÷ SOD. Moving the patient away raises the OID, which lowers SOD. At the cardiac apex the factor is now ${ma.magnification.toFixed(3)}× (OID ${f1(ma.oidCm)} cm, SID ${f1(ctx.end.sidCm)} cm).`,
          "Switch the beam to parallel and the size difference disappears, which shows the change is magnification from the divergent beam.",
        ],
      };
    },
  },
  {
    id: "pa72-vs-ap40",
    title: "PA 72″ erect vs AP 40″ supine",
    topic: "Magnification",
    prompt:
      "Compare a PA erect chest at 72″ SID with an AP supine chest at 40″ SID (patient lying on the table, about 5 cm of table/grid between back and IR).",
    question: "How does the heart width compare on the AP 40″ image?",
    choices: [
      { id: "wider", text: "Wider on the AP 40″ image" },
      { id: "narrower", text: "Narrower on the AP 40″ image" },
      { id: "same", text: "About the same" },
    ],
    start: state({ presetId: "PA", sidCm: 72 * IN, gapCm: 3 }),
    end: state({ presetId: "AP", sidCm: 40 * IN, gapCm: 5 }),
    focus: ["heartApex"],
    evaluate(ctx) {
      const h = heartWidthEvaluation(ctx);
      const mb = ctx.before.landmarks.heartApex;
      const ma = ctx.after.landmarks.heartApex;
      return {
        correct: h.correct,
        facts: h.facts,
        explanation: [
          `Heart width: ${f1(h.b)} cm on the PA 72″ image vs ${f1(h.a)} cm on the AP 40″ image.`,
          `Two things add up. The heart lies anteriorly, so turning from PA to AP moves it away from the IR (apex OID ${f1(mb.oidCm)} → ${f1(ma.oidCm)} cm). And the shorter SID makes the beam more divergent. Magnification at the apex goes from ${mb.magnification.toFixed(3)}× to ${ma.magnification.toFixed(3)}×.`,
          "That is why the heart cannot be judged for size on an AP supine chest the way it is on a PA erect at 72″.",
        ],
      };
    },
  },
];
