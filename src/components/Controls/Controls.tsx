import type { ReactNode } from "react";
import type { PositioningState } from "../../data/types";
import { body, useStore } from "../../state/store";

const IN = 2.54;

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  minLabel: string;
  maxLabel: string;
  readout: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function Slider({ label, value, min, max, step = 1, minLabel, maxLabel, readout, onChange, disabled }: SliderProps) {
  return (
    <label className="slider">
      <div className="slider-head">
        <span>{label}</span>
        <output>{readout}</output>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(0 >= min && 0 <= max ? 0 : value)}
      />
      <div className="slider-ends">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </label>
  );
}

export function Card({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      <header>
        <h2>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

const signed = (v: number, pos: string, neg: string, zero = "neutral") => {
  const r = Math.round(v);
  return r === 0 ? `0° (${zero})` : `${r > 0 ? "+" : ""}${r}° ${r > 0 ? pos : neg}`;
};

export function PositionControls() {
  const bodyId = useStore((s) => s.bodyId);
  const pos = useStore((s) => s.pos);
  const setPos = useStore((s) => s.setPos);
  const applyPreset = useStore((s) => s.applyPreset);
  const locked = useStore((s) => s.session?.phase === "animating");
  const b = body(bodyId);
  const set = (p: Partial<PositioningState>) => setPos(p);

  return (
    <Card title="Patient position">
      <div className="preset-grid" role="group" aria-label="Position presets">
        {b.presets.map((p) => (
          <button
            key={p.id}
            className={`chip ${pos.presetId === p.id ? "active" : ""}`}
            onClick={() => applyPreset(p.id)}
            title={p.description}
            disabled={locked}
          >
            {p.name}
          </button>
        ))}
      </div>
      <Slider
        label="Rotation about long axis"
        value={pos.yawOffset}
        min={-60}
        max={60}
        minLabel="◀ R side posterior"
        maxLabel="R side anterior ▶"
        readout={signed(pos.yawOffset, "R anterior", "R posterior", "preset")}
        onChange={(v) => set({ yawOffset: v })}
        disabled={locked}
      />
      <Slider
        label="Lordotic angle"
        value={pos.lordotic}
        min={-30}
        max={40}
        minLabel="◀ lean forward"
        maxLabel="lean back ▶"
        readout={signed(pos.lordotic, "back", "forward")}
        onChange={(v) => set({ lordotic: v })}
        disabled={locked}
      />
      <Slider
        label="Tilt (lateral lean)"
        value={pos.tilt}
        min={-30}
        max={30}
        minLabel="◀ head toward pt's L"
        maxLabel="head toward pt's R ▶"
        readout={signed(pos.tilt, "toward R", "toward L")}
        onChange={(v) => set({ tilt: v })}
        disabled={locked}
      />
    </Card>
  );
}

export function BeamControls() {
  const pos = useStore((s) => s.pos);
  const setPos = useStore((s) => s.setPos);
  const locked = useStore((s) => s.session?.phase === "animating");
  return (
    <Card title="Tube & receptor">
      <Slider
        label="Central ray angle"
        value={pos.crAngle}
        min={-40}
        max={40}
        minLabel="◀ caudal"
        maxLabel="cephalic ▶"
        readout={
          Math.round(pos.crAngle) === 0
            ? "0° (perpendicular)"
            : `${Math.abs(Math.round(pos.crAngle))}° ${pos.crAngle > 0 ? "cephalic" : "caudal"}`
        }
        onChange={(v) => setPos({ crAngle: v })}
        disabled={locked}
      />
      <Slider
        label="SID"
        value={Math.round(pos.sidCm / IN)}
        min={30}
        max={80}
        minLabel="30 in"
        maxLabel="80 in"
        readout={`${Math.round(pos.sidCm / IN)} in · ${Math.round(pos.sidCm)} cm`}
        onChange={(v) => setPos({ sidCm: v * IN })}
        disabled={locked}
      />
      <Slider
        label="Patient–IR gap"
        value={pos.gapCm}
        min={0}
        max={30}
        step={0.5}
        minLabel="against IR"
        maxLabel="30 cm"
        readout={`${pos.gapCm.toFixed(1)} cm`}
        onChange={(v) => setPos({ gapCm: v })}
        disabled={locked}
      />
      <div className="segmented" role="group" aria-label="Beam geometry">
        {(["divergent", "parallel"] as const).map((beam) => (
          <button
            key={beam}
            className={pos.beam === beam ? "active" : ""}
            onClick={() => setPos({ beam })}
            disabled={locked}
          >
            {beam === "divergent" ? "Divergent beam (real)" : "Parallel beam (no magnification)"}
          </button>
        ))}
      </div>
    </Card>
  );
}

export function DisplayControls() {
  const s = useStore();
  return (
    <Card title="Display">
      <div className="toggles">
        <Toggle on={s.reference !== null} onChange={(on) => s.setTrail(on)} label="Trail (ghost + arrows)" />
        <Toggle on={s.showLabels} onChange={() => s.toggle("showLabels")} label="Landmark labels" />
        <Toggle on={s.showMeasurements} onChange={() => s.toggle("showMeasurements")} label="Measurements on image" />
        <Toggle on={s.showRays} onChange={() => s.toggle("showRays")} label="Rays in 3D" />
      </div>
      <div className="button-row">
        <button className="btn" onClick={s.setReferenceToCurrent}>
          Set ghost here
        </button>
        <button className="btn" onClick={s.resetPositioning}>
          Reset position
        </button>
        <button className="btn" onClick={() => s.setCameraView("overview")}>
          Reset 3D view
        </button>
      </div>
    </Card>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
      {label}
    </label>
  );
}
