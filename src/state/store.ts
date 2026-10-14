import { create } from "zustand";
import { bodyParts, defaultBodyPartId } from "../data/bodyParts";
import type { BodyPart, PositioningState } from "../data/types";
import type { Scenario } from "../data/scenarios/types";
import { yawOf } from "../geometry/image";
import { type ScenarioRun, runScenario } from "../learning/runScenario";

export type Mode = "explore" | "learn";
export type CameraView = "overview" | "patient" | "side";

export interface ScenarioSession {
  id: string;
  phase: "predict" | "animating" | "result";
  choice: string | null;
  run: ScenarioRun;
}

interface AppState {
  bodyId: string;
  pos: PositioningState;
  mode: Mode;
  /** Ghost/trail reference state, or null when trail mode is off. */
  reference: PositioningState | null;
  showLabels: boolean;
  showMeasurements: boolean;
  showRays: boolean;
  /** Landmarks emphasised by the current scenario. */
  focus: string[] | null;
  session: ScenarioSession | null;
  /** Camera preset for the 3D view; the key bumps on every request. */
  camera: { view: CameraView; key: number };

  setPos: (p: Partial<PositioningState>) => void;
  applyPreset: (presetId: string) => void;
  resetPositioning: () => void;
  setCameraView: (view: CameraView) => void;
  setMode: (m: Mode) => void;
  setTrail: (on: boolean) => void;
  setReferenceToCurrent: () => void;
  toggle: (key: "showLabels" | "showMeasurements" | "showRays") => void;
  openScenario: (id: string) => void;
  choose: (choiceId: string) => void;
  submit: () => void;
  replay: () => void;
  closeScenario: () => void;
}

export const body = (id: string): BodyPart => bodyParts[id].body;
export const scenariosFor = (id: string): Scenario[] => bodyParts[id].scenarios;

function defaultPos(b: BodyPart): PositioningState {
  return {
    presetId: b.defaults.presetId,
    yawOffset: 0,
    lordotic: 0,
    tilt: 0,
    crAngle: 0,
    sidCm: b.defaults.sidCm,
    gapCm: b.defaults.gapCm,
    beam: "divergent",
  };
}

// ------------------------------------------------------------- animation
let animToken = 0;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Interpolates every numeric positioning parameter (absolute yaw included). */
function lerpState(b: BodyPart, from: PositioningState, to: PositioningState, t: number): PositioningState {
  const l = (x: number, y: number) => x + (y - x) * t;
  const endPreset = b.presets.find((p) => p.id === to.presetId) ?? b.presets[0];
  const yaw = l(yawOf(b, from), yawOf(b, to));
  return {
    presetId: endPreset.id,
    yawOffset: yaw - endPreset.yaw,
    lordotic: l(from.lordotic, to.lordotic),
    tilt: l(from.tilt, to.tilt),
    crAngle: l(from.crAngle, to.crAngle),
    sidCm: l(from.sidCm, to.sidCm),
    gapCm: l(from.gapCm, to.gapCm),
    beam: t < 1 ? from.beam : to.beam,
  };
}

function animate(
  b: BodyPart,
  from: PositioningState,
  to: PositioningState,
  ms: number,
  onFrame: (s: PositioningState) => void,
  onDone: () => void,
) {
  const token = ++animToken;
  const t0 = performance.now();
  const step = (now: number) => {
    if (token !== animToken) return;
    const t = Math.min(1, (now - t0) / ms);
    onFrame(lerpState(b, from, to, ease(t)));
    if (t < 1) requestAnimationFrame(step);
    else onDone();
  };
  requestAnimationFrame(step);
}

const stopAnimation = () => {
  animToken++;
};

// ------------------------------------------------------------- store
export const useStore = create<AppState>((set, get) => {
  const initialBody = body(defaultBodyPartId);
  return {
    bodyId: defaultBodyPartId,
    pos: defaultPos(initialBody),
    mode: "explore",
    reference: null,
    showLabels: true,
    showMeasurements: true,
    showRays: true,
    focus: null,
    session: null,
    camera: { view: "overview", key: 0 },

    setPos: (p) => {
      if (get().session?.phase === "animating") return;
      set((s) => ({ pos: { ...s.pos, ...p } }));
    },
    applyPreset: (presetId) =>
      set((s) => ({ pos: { ...s.pos, presetId, yawOffset: 0, lordotic: 0, tilt: 0 } })),
    resetPositioning: () => {
      stopAnimation();
      set((s) => ({ pos: defaultPos(body(s.bodyId)), reference: null }));
    },
    setCameraView: (view) => set((s) => ({ camera: { view, key: s.camera.key + 1 } })),
    setMode: (mode) => {
      if (mode === "explore") get().closeScenario();
      set({ mode });
    },
    setTrail: (on) => set((s) => ({ reference: on ? s.pos : null })),
    setReferenceToCurrent: () => set((s) => ({ reference: s.pos })),
    toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<AppState>),

    openScenario: (id) => {
      const s = get();
      const b = body(s.bodyId);
      const sc = scenariosFor(s.bodyId).find((x) => x.id === id);
      if (!sc) return;
      stopAnimation();
      set({
        mode: "learn",
        session: { id, phase: "predict", choice: null, run: runScenario(b, sc) },
        focus: sc.focus,
        reference: null,
      });
      // Glide from wherever we are to the scenario's starting position.
      animate(b, s.pos, sc.start, 700, (pos) => set({ pos }), () => set({ pos: sc.start }));
    },
    choose: (choiceId) =>
      set((s) => (s.session?.phase === "predict" ? { session: { ...s.session, choice: choiceId } } : {})),
    submit: () => {
      const s = get();
      if (!s.session || !s.session.choice) return;
      get().replay();
    },
    replay: () => {
      const s = get();
      const sess = s.session;
      if (!sess) return;
      const sc = scenariosFor(s.bodyId).find((x) => x.id === sess.id);
      if (!sc) return;
      const b = body(s.bodyId);
      set({ pos: sc.start, reference: sc.start, session: { ...sess, phase: "animating" } });
      animate(
        b,
        sc.start,
        sc.end,
        1800,
        (pos) => set({ pos }),
        () => set((st) => ({ pos: sc.end, session: st.session && { ...st.session, phase: "result" } })),
      );
    },
    closeScenario: () => {
      stopAnimation();
      set({ session: null, focus: null });
    },
  };
});
