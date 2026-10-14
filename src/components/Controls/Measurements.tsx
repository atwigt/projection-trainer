import { body, useStore } from "../../state/store";
import { useImage } from "../../state/useImage";
import { Card } from "./Controls";

const SYMMETRY_TOL = 0.3; // cm

export function Measurements() {
  const bodyId = useStore((s) => s.bodyId);
  const img = useImage();
  const b = body(bodyId);
  const r = img.measurements["rSC-mid"]?.distance;
  const l = img.measurements["lSC-mid"]?.distance;

  let verdict: string | null = null;
  if (img.position.isLateral) {
    verdict = "SC-joint symmetry is judged on AP/PA (and oblique) images, not laterals.";
  } else if (r !== undefined && l !== undefined) {
    const diff = r - l;
    verdict =
      Math.abs(diff) < SYMMETRY_TOL
        ? "SC joints equidistant from the spine: no rotation evident."
        : `${diff < 0 ? "Right" : "Left"} SC joint is ${Math.abs(diff).toFixed(1)} cm closer to the spine: rotation present.`;
  }

  return (
    <Card title="Measurements">
      <table className="measure">
        <tbody>
          {b.measurements.map((m) => {
            const color = b.landmarks.find((x) => x.id === m.point)?.color;
            const v = img.measurements[m.id]?.distance;
            return (
              <tr key={m.id}>
                <td>
                  <span className="dot" style={{ background: color }} />
                  {m.label}
                </td>
                <td className="num">{v === undefined ? "–" : `${v.toFixed(1)} cm`}</td>
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
