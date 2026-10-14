import { BeamControls, DisplayControls, PositionControls } from "./components/Controls/Controls";
import { Measurements } from "./components/Controls/Measurements";
import { LearningPanel } from "./components/Learning/LearningPanel";
import { Radiograph2D } from "./components/Radiograph2D/Radiograph2D";
import { Scene3D } from "./components/Scene3D/Scene3D";
import { body, useStore } from "./state/store";
import { useImage } from "./state/useImage";

function PositionBadge() {
  const img = useImage();
  return (
    <div className="position-badge" aria-live="polite">
      <strong>{img.position.name}</strong>
      {img.position.details.length > 0 && <span> · {img.position.details.join(" · ")}</span>}
      <span className="beam"> · {img.setup.beam === "divergent" ? "divergent" : "parallel"} beam</span>
    </div>
  );
}

export default function App() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const bodyId = useStore((s) => s.bodyId);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◐
          </span>
          Projection Trainer <span className="muted">· {body(bodyId).name}</span>
        </div>
        <PositionBadge />
        <nav className="segmented mode" aria-label="Mode">
          <button className={mode === "explore" ? "active" : ""} onClick={() => setMode("explore")}>
            Explore
          </button>
          <button className={mode === "learn" ? "active" : ""} onClick={() => setMode("learn")}>
            Learn
          </button>
        </nav>
      </header>

      <main className="layout">
        <section className="view view-3d" aria-label="3D positioning view">
          <div className="view-title">3D setup <span className="muted">drag to orbit · scroll to zoom</span></div>
          <Scene3D />
        </section>
        <section className="view view-2d" aria-label="Radiograph">
          <div className="view-title">Image <span className="muted">as displayed for viewing</span></div>
          <Radiograph2D />
        </section>
        <aside className="sidebar">
          {mode === "learn" ? (
            <>
              <LearningPanel />
              <Measurements />
            </>
          ) : (
            <>
              <PositionControls />
              <BeamControls />
              <Measurements />
              <DisplayControls />
            </>
          )}
        </aside>
      </main>
    </div>
  );
}
