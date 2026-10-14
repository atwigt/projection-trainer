import { useMemo } from "react";
import type { Landmark } from "../../data/types";
import { geometryWarning } from "../../geometry/geometryWarningText";
import { type ImageResult, type Shape2D, lineXAt } from "../../geometry/image";
import { offsetShort } from "../../geometry/measurementText";
import type { Vec2 } from "../../geometry/vec";
import { body, useStore } from "../../state/store";
import { useImage, useReferenceImage } from "../../state/useImage";

/** SVG y runs downward; image coordinates run upward. */
const pt = (p: Vec2) => `${p[0].toFixed(3)},${(-p[1]).toFixed(3)}`;
const path = (pts: Vec2[]) => pts.map(pt).join(" ");

const LAYER_STYLE: Record<Shape2D["layer"], { fill: string; opacity: number; stroke?: string }> = {
  soft: { fill: "#4b4b4b", opacity: 1 },
  air: { fill: "#0d0d0d", opacity: 0.85 },
  organ: { fill: "#5a5a5a", opacity: 0.9 },
  bone: { fill: "#f2f2f2", opacity: 0.38, stroke: "#f2f2f2" },
};

function ShapeView({ s }: { s: Shape2D }) {
  const st = LAYER_STYLE[s.layer];
  if (s.kind === "polyline")
    return (
      <polyline
        points={path(s.points)}
        fill="none"
        stroke={st.fill}
        strokeOpacity={(st.opacity + 0.12) * s.density}
        strokeWidth={s.width}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ mixBlendMode: "screen" }}
      />
    );
  return (
    <polygon
      points={path(s.points)}
      fill={st.fill}
      fillOpacity={st.opacity * s.density}
      style={s.layer === "bone" ? { mixBlendMode: "screen" } : undefined}
    />
  );
}

/**
 * Layout of the degenerate-geometry banner, in image cm from the top edge of
 * the receptor. Kept together so the panel can be sized from the baselines.
 */
const BANNER = { offsetTop: 4.6, titleGap: 2.5, firstLineGap: 4.3, lineHeight: 1.25, padBottom: 0.6 };

function Arrow({ from, to, color }: { from: Vec2; to: Vec2; color: string }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 0.25) return null;
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(0.9, len * 0.45);
  const base: Vec2 = [to[0] - ux * h, to[1] - uy * h];
  const left: Vec2 = [base[0] - uy * h * 0.45, base[1] + ux * h * 0.45];
  const right: Vec2 = [base[0] + uy * h * 0.45, base[1] - ux * h * 0.45];
  return (
    <g>
      <line x1={from[0]} y1={-from[1]} x2={base[0]} y2={-base[1]} stroke={color} strokeWidth={0.16} />
      <polygon points={path([to, left, right])} fill={color} />
    </g>
  );
}

function LandmarkDot({
  lm,
  img,
  dim,
  showLabel,
}: {
  lm: Landmark;
  img: ImageResult;
  dim: boolean;
  showLabel: boolean;
}) {
  const p = img.landmarks[lm.id].display;
  const r = lm.hidden ? 0.22 : 0.45;
  const side = lm.labelSide ?? (p[0] < 0 ? "left" : "right");
  const [dx, dy, anchor] =
    side === "left" ? [-0.8, 0.35, "end"]
    : side === "right" ? [0.8, 0.35, "start"]
    : side === "above" ? [0, -0.9, "middle"]
    : [0, 1.6, "middle"];
  return (
    <g opacity={dim ? 0.3 : 1}>
      <circle cx={p[0]} cy={-p[1]} r={r} fill={lm.color} stroke="#fff" strokeWidth={lm.hidden ? 0.05 : 0.1} />
      {showLabel && !lm.hidden && (
        <text
          x={p[0] + dx}
          y={-p[1] + dy}
          fontSize={1.0}
          textAnchor={anchor}
          fill={lm.color}
          stroke="#000"
          strokeWidth={0.25}
          paintOrder="stroke"
          fontWeight={600}
        >
          {lm.short}
        </text>
      )}
    </g>
  );
}

export function Radiograph2D() {
  const bodyId = useStore((s) => s.bodyId);
  const showLabels = useStore((s) => s.showLabels);
  const showMeasurements = useStore((s) => s.showMeasurements);
  const focus = useStore((s) => s.focus);
  const img = useImage();
  const ref = useReferenceImage();
  const b = body(bodyId);
  const W = b.ir.widthCm;
  const H = b.ir.heightCm;
  const pad = 1.5;

  const measureLines = useMemo(
    () =>
      b.measurements.map((m) => {
        const p = img.landmarks[m.point].display;
        const line = m.line.map((id) => img.landmarks[id].display);
        const color = b.landmarks.find((l) => l.id === m.point)?.color ?? "#fff";
        const value = img.measurements[m.id];
        return {
          id: m.id,
          p,
          x: lineXAt(line, p[1]),
          line,
          color,
          text: value ? offsetShort(value) : "–",
          crossed: value?.crossed ?? false,
        };
      }),
    [b, img],
  );
  const warning = geometryWarning(img.geometryCheck);
  const banner = {
    top: -H / 2 + BANNER.offsetTop,
    titleY: -H / 2 + BANNER.offsetTop + BANNER.titleGap,
    firstLineY: -H / 2 + BANNER.offsetTop + BANNER.firstLineGap,
    lineHeight: BANNER.lineHeight,
  };
  const bannerHeight = (lines: number) =>
    BANNER.firstLineGap + BANNER.lineHeight * (lines - 1) + BANNER.padBottom;
  const midlinePts = measureLines[0]?.line ?? [];
  // SC-joint symmetry is an AP/PA criterion; hide it on laterals.
  const measure = showMeasurements && !img.position.isLateral;
  const isFocus = (id: string) => !focus || focus.includes(id) || id.startsWith("spT");

  return (
    <div className="radiograph">
      <svg
        viewBox={`${-W / 2 - pad} ${-H / 2 - pad} ${W + 2 * pad} ${H + 2 * pad}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Simulated radiograph"
      >
        <defs>
          <clipPath id="ir-clip">
            <rect x={-W / 2} y={-H / 2} width={W} height={H} />
          </clipPath>
          <filter id="soften" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="0.12" />
          </filter>
        </defs>

        <rect x={-W / 2} y={-H / 2} width={W} height={H} fill="#040404" />
        <g clipPath="url(#ir-clip)">
          <g filter="url(#soften)">
            {img.shapes.map((s) => (
              <ShapeView key={s.id} s={s} />
            ))}
          </g>

          {/* central-ray crosshair */}
          <g stroke="#e9c46a" strokeWidth={0.08} opacity={0.6}>
            <line x1={-0.8} y1={0} x2={0.8} y2={0} />
            <line x1={0} y1={-0.8} x2={0} y2={0.8} />
          </g>

          {measure && midlinePts.length > 1 && (
            <g>
              <polyline
                points={path([...midlinePts].sort((a, c) => a[1] - c[1]))}
                fill="none"
                stroke="#17a589"
                strokeWidth={0.1}
                strokeDasharray="0.4 0.3"
              />
              {measureLines.map((m) => (
                <g key={m.id}>
                  <line x1={m.p[0]} y1={-m.p[1]} x2={m.x} y2={-m.p[1]} stroke={m.color} strokeWidth={0.14} />
                  <line x1={m.x} y1={-m.p[1] - 0.4} x2={m.x} y2={-m.p[1] + 0.4} stroke={m.color} strokeWidth={0.1} />
                </g>
              ))}
            </g>
          )}

          {ref &&
            b.landmarks
              .filter((lm) => !lm.hidden && isFocus(lm.id))
              .map((lm) => {
                const g = ref.landmarks[lm.id].display;
                const c = img.landmarks[lm.id].display;
                return (
                  <g key={`ghost-${lm.id}`}>
                    <circle
                      cx={g[0]}
                      cy={-g[1]}
                      r={0.45}
                      fill="none"
                      stroke={lm.color}
                      strokeWidth={0.1}
                      strokeDasharray="0.25 0.18"
                    />
                    <Arrow from={g} to={c} color={lm.color} />
                  </g>
                );
              })}

          {b.landmarks.map((lm) => (
            <LandmarkDot key={lm.id} lm={lm} img={img} dim={!isFocus(lm.id)} showLabel={showLabels} />
          ))}
        </g>

        {/* orientation markers */}
        <g fontWeight={700} fontSize={2.2} fontFamily="Helvetica, Arial, sans-serif">
          <text x={-W / 2 + 1.2} y={-H / 2 + 3} fill="#f5f5f5">
            {img.markers.left}
          </text>
          <text x={W / 2 - 1.2} y={-H / 2 + 3} fill="#f5f5f5" textAnchor="end">
            {img.markers.right}
          </text>
          {img.markers.lateralSide && (
            <g>
              <rect x={-1.6} y={-H / 2 + 0.8} width={3.2} height={3} rx={0.3} fill="none" stroke="#f5f5f5" strokeWidth={0.15} />
              <text x={0} y={-H / 2 + 3.1} fill="#f5f5f5" textAnchor="middle">
                {img.markers.lateralSide}
              </text>
            </g>
          )}
        </g>

        {measure && (
          <g fontSize={0.95}>
            <rect x={-W / 2 + 0.6} y={H / 2 - 1.2 - 1.4 * measureLines.length} width={24} height={1.4 * measureLines.length + 0.5} rx={0.3} fill="#000" fillOpacity={0.55} />
            {measureLines.map((m, i) => (
              <text
                key={m.id}
                x={-W / 2 + 1.1}
                y={H / 2 - 1.4 * (measureLines.length - i) + 0.2}
                fill={m.color}
                fontWeight={m.crossed ? 700 : 400}
              >
                {b.measurements[i].label}: {m.text}
              </text>
            ))}
          </g>
        )}

        {/* Degenerate geometry. Drawn over the image, not beside it: the
            shapes underneath are the thing being disowned. */}
        {warning && (
          <g>
            {/* The panel is sized from the text baselines rather than from a
                constant, so adding a line cannot push it outside the box. */}
            <rect
              x={-W / 2 + 1}
              y={banner.top}
              width={W - 2}
              height={bannerHeight(warning.lines.length)}
              rx={0.4}
              fill="#7a0d0d"
              fillOpacity={0.92}
              stroke="#ffb3b3"
              strokeWidth={0.18}
            />
            <text
              x={0}
              y={banner.titleY}
              textAnchor="middle"
              fontSize={1.5}
              fontWeight={700}
              fill="#fff"
              fontFamily="Helvetica, Arial, sans-serif"
            >
              {warning.title}
            </text>
            {warning.lines.map((line, i) => (
              <text
                key={line}
                x={0}
                y={banner.firstLineY + banner.lineHeight * i}
                textAnchor="middle"
                fontSize={1.05}
                fill="#ffe3e3"
                fontFamily="Helvetica, Arial, sans-serif"
              >
                {line}
              </text>
            ))}
          </g>
        )}

        {/* 5 cm scale bar */}
        <g stroke="#bbb" strokeWidth={0.12}>
          <line x1={W / 2 - 6.2} y1={H / 2 - 1.2} x2={W / 2 - 1.2} y2={H / 2 - 1.2} />
          <line x1={W / 2 - 6.2} y1={H / 2 - 1.6} x2={W / 2 - 6.2} y2={H / 2 - 0.8} />
          <line x1={W / 2 - 1.2} y1={H / 2 - 1.6} x2={W / 2 - 1.2} y2={H / 2 - 0.8} />
        </g>
        <text x={W / 2 - 3.7} y={H / 2 - 1.7} fontSize={0.8} fill="#bbb" textAnchor="middle">
          5 cm at IR
        </text>
      </svg>
      <div className="radiograph-caption">{img.convention}</div>
    </div>
  );
}
