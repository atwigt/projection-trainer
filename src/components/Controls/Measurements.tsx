import { offsetShort, symmetryVerdict } from "../../geometry/measurementText";
import { body, useStore } from "../../state/store";
import { useImage } from "../../state/useImage";
import { Card } from "./Controls";

const SYMMETRY_TOL = 0.3; // cm

const SC_PAIR = {
  right: "rSC-mid",
  left: "lSC-mid",
  noun: "SC joints",
  from: "the spinous processes",
};

export function Measurements() {
  const bodyId = useStore((s) => s.bodyId);
  const img = useImage();
  const b = body(bodyId);

  const verdict = img.position.isLateral
    ? "SC-joint symmetry is judged on AP/PA (and oblique) images, not laterals."
    : symmetryVerdict(img.measurements, SC_PAIR, SYMMETRY_TOL);

  return (
    <Card title="Measurements">
      <table className="measure">
        <tbody>
          {b.measurements.map((m) => {
            const color = b.landmarks.find((x) => x.id === m.point)?.color;
            const v = img.measurements[m.id];
            return (
              <tr key={m.id}>
                <td>
                  <span className="dot" style={{ background: color }} />
                  {m.label}
                </td>
                <td className={v?.crossed ? "num crossed" : "num"}>
                  {v === undefined ? "–" : offsetShort(v)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {verdict && <p className="verdict">{verdict}</p>}
      <details className="legend">
        <summary>Landmarks: OID & magnification</summary>
        <table className="measure">
          <thead>
            <tr>
              <th>Landmark</th>
              <th className="num">OID</th>
              <th className="num">Mag.</th>
            </tr>
          </thead>
          <tbody>
            {b.landmarks
              .filter((lm) => !lm.hidden)
              .map((lm) => {
                const p = img.landmarks[lm.id];
                return (
                  <tr key={lm.id}>
                    <td>
                      <span className="dot" style={{ background: lm.color }} />
                      {lm.label}
                    </td>
                    <td className="num">{p.oidCm.toFixed(1)} cm</td>
                    <td className="num">{p.magnification.toFixed(3)}×</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </details>
    </Card>
  );
}
