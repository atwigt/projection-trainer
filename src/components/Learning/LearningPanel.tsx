import { scenariosFor, useStore } from "../../state/store";
import { Card } from "../Controls/Controls";

const fmt = (v: number, unit: string, signed = false) => {
  if (unit === "×") return `${v.toFixed(3)}×`;
  const sign = signed && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)} ${unit}`;
};

export function LearningPanel() {
  const bodyId = useStore((s) => s.bodyId);
  const session = useStore((s) => s.session);
  const { openScenario, choose, submit, replay, closeScenario, setMode } = useStore.getState();
  const scenarios = scenariosFor(bodyId);

  if (!session) {
    return (
      <Card title="Scenarios">
        <p className="muted">
          Predict the result, then watch the patient move. Every answer comes from projecting the 3D model,
          not from a lookup table.
        </p>
        <ol className="scenario-list">
          {scenarios.map((s) => (
            <li key={s.id}>
              <button className="scenario-item" onClick={() => openScenario(s.id)}>
                <span className="topic">{s.topic}</span>
                <span className="title">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </Card>
    );
  }

  const idx = scenarios.findIndex((s) => s.id === session.id);
  const sc = scenarios[idx];
  const next = scenarios[idx + 1];
  const ev = session.run.evaluation;
  const done = session.phase === "result";

  return (
    <Card
      title={`${idx + 1}. ${sc.title}`}
      actions={
        <button className="link" onClick={closeScenario}>
          All scenarios
        </button>
      }
    >
      <span className="topic">{sc.topic}</span>
      <p>{sc.prompt}</p>
      <p className="question">{sc.question}</p>
      <div className="choices" role="radiogroup">
        {sc.choices.map((c) => {
          const picked = session.choice === c.id;
          const state = !done ? "" : c.id === ev.correct ? "correct" : picked ? "wrong" : "";
          return (
            <button
              key={c.id}
              role="radio"
              aria-checked={picked}
              className={`choice ${picked ? "picked" : ""} ${state}`}
              disabled={session.phase !== "predict"}
              onClick={() => choose(c.id)}
            >
              {c.text}
            </button>
          );
        })}
      </div>

      {session.phase === "predict" && (
        <button className="btn primary" disabled={!session.choice} onClick={submit}>
          Check my prediction ▶
        </button>
      )}
      {session.phase === "animating" && <p className="muted">Rotating the patient…</p>}

      {done && (
        <div className="result">
          <p className={`badge ${session.choice === ev.correct ? "ok" : "no"}`}>
            {session.choice === ev.correct ? "Correct:" : "Not quite. The geometry says:"}{" "}
            {sc.choices.find((c) => c.id === ev.correct)?.text}
          </p>
          <table className="measure facts">
            <thead>
              <tr>
                <th />
                <th className="num">Before</th>
                <th className="num">After</th>
              </tr>
            </thead>
            <tbody>
              {ev.facts.map((f) => (
                <tr key={f.label}>
                  <td>{f.label}</td>
                  <td className="num">{fmt(f.before, f.unit, f.signed)}</td>
                  <td className="num">{fmt(f.after, f.unit, f.signed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ev.explanation.map((t, i) => (
            <p key={i} className="explain">
              {t}
            </p>
          ))}
          <div className="button-row">
            <button className="btn" onClick={replay}>
              Replay
            </button>
            <button
              className="btn"
              onClick={() => {
                closeScenario();
                setMode("explore");
              }}
            >
              Explore from here
            </button>
            {next && (
              <button className="btn primary" onClick={() => openScenario(next.id)}>
                Next scenario ▶
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
