import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Primitive } from "../../data/types";
import { projectWorld, type Setup } from "../../geometry/projection";
import { ellipsoidMatrix, smoothCurve } from "../../geometry/shapes";
import type { Mat3, Vec3 } from "../../geometry/vec";
import { type CameraView, body, useStore } from "../../state/store";
import { useImage } from "../../state/useImage";

const v3 = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

function matrix4(R: Mat3, t: Vec3 = [0, 0, 0]): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.set(
    R[0][0], R[0][1], R[0][2], t[0],
    R[1][0], R[1][1], R[1][2], t[1],
    R[2][0], R[2][1], R[2][2], t[2],
    0, 0, 0, 1,
  );
  return m;
}

function usePrimitiveGeometry(p: Primitive): THREE.BufferGeometry {
  return useMemo(() => {
    switch (p.kind) {
      case "hull":
        return new ConvexGeometry(p.points.map(v3));
      case "ellipsoid": {
        const g = new THREE.SphereGeometry(1, 32, 20);
        g.scale(p.radii[0], p.radii[1], p.radii[2]);
        g.applyMatrix4(matrix4(ellipsoidMatrix(p), p.center));
        return g;
      }
      case "tube": {
        const curve = new THREE.CatmullRomCurve3(smoothCurve(p.points).map(v3));
        return new THREE.TubeGeometry(curve, 48, p.radius, 8, false);
      }
    }
  }, [p]);
}

function PrimitiveMesh({ p }: { p: Primitive }) {
  const geometry = usePrimitiveGeometry(p);
  const opacity = p.opacity ?? 1;
  const transparent = opacity < 1;
  return (
    <mesh geometry={geometry} renderOrder={transparent ? 2 : 0}>
      <meshStandardMaterial
        color={p.color}
        roughness={0.75}
        metalness={0}
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
        side={transparent ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}

function Patient({ setup }: { setup: Setup }) {
  const bodyId = useStore((s) => s.bodyId);
  const showLabels = useStore((s) => s.showLabels);
  const focus = useStore((s) => s.focus);
  const b = body(bodyId);
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    g.matrixAutoUpdate = false;
    g.matrix.copy(matrix4(setup.R, setup.center));
    g.matrixWorldNeedsUpdate = true;
  }, [setup]);

  return (
    <group ref={group}>
      {b.primitives.map((p) => (
        <PrimitiveMesh key={p.id} p={p} />
      ))}
      {b.landmarks.map((lm) => {
        const dim = focus && !focus.includes(lm.id) && !lm.id.startsWith("spT");
        return (
          <group key={lm.id} position={v3(lm.position)}>
            <mesh renderOrder={3}>
              <sphereGeometry args={[lm.hidden ? 0.35 : 0.7, 16, 12]} />
              <meshBasicMaterial color={lm.color} depthTest={false} transparent opacity={dim ? 0.35 : 1} />
            </mesh>
            {showLabels && !lm.hidden && (
              <Html center distanceFactor={70} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
                <div className="label3d" style={{ borderColor: lm.color, opacity: dim ? 0.4 : 1 }}>
                  {lm.short}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

function TubeAndReceptor({ setup }: { setup: Setup }) {
  const bodyId = useStore((s) => s.bodyId);
  const showRays = useStore((s) => s.showRays);
  const focus = useStore((s) => s.focus);
  const img = useImage();
  const b = body(bodyId);
  const W = b.ir.widthCm;
  const H = b.ir.heightCm;
  const ir = setup.irCenter;
  const corners: Vec3[] = [
    [ir[0] - W / 2, ir[1] - H / 2, 0],
    [ir[0] + W / 2, ir[1] - H / 2, 0],
    [ir[0] + W / 2, ir[1] + H / 2, 0],
    [ir[0] - W / 2, ir[1] + H / 2, 0],
  ];
  const tube = useRef<THREE.Group>(null);
  useEffect(() => {
    tube.current?.lookAt(v3(setup.irCenter));
  }, [setup]);

  const rayIds = focus ?? b.rayLandmarks;
  const rayLandmarks = b.landmarks.filter((lm) => rayIds.includes(lm.id));

  return (
    <group>
      {/* Image receptor */}
      <mesh position={[ir[0], ir[1], -0.6]}>
        <boxGeometry args={[W, H, 1.2]} />
        <meshStandardMaterial color="#2f3e4e" transparent opacity={0.85} />
      </mesh>
      <mesh position={[ir[0], ir[1], 0.02]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial color="#0e1318" />
      </mesh>
      <Html position={[ir[0] + W / 2 - 2, ir[1] + H / 2 + 3, 0]} center distanceFactor={220}>
        <div className="tag3d">IR</div>
      </Html>

      {/* X-ray tube */}
      <group ref={tube} position={v3(setup.source)}>
        <mesh position={[0, 0, -9]}>
          <boxGeometry args={[30, 13, 12]} />
          <meshStandardMaterial color="#c9ced4" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 1]}>
          <boxGeometry args={[11, 11, 8]} />
          <meshStandardMaterial color="#8d969f" roughness={0.6} />
        </mesh>
      </group>
      <Html position={[setup.source[0], setup.source[1] + 12, setup.source[2]]} center distanceFactor={220}>
        <div className="tag3d">Tube</div>
      </Html>

      {/* Central ray and beam edges */}
      <Line points={[v3(setup.source), v3(setup.irCenter)]} color="#d4a017" lineWidth={2} />
      {corners.map((c, i) => (
        <Line key={i} points={[v3(setup.source), v3(c)]} color="#d4a017" lineWidth={0.8} transparent opacity={0.35} />
      ))}
      <Line points={[...corners, corners[0]].map(v3)} color="#d4a017" lineWidth={1} transparent opacity={0.6} />

      {/* Projection of each landmark onto the IR, with its ray */}
      {rayLandmarks.map((lm) => {
        const w = img.landmarks[lm.id].world;
        const uv = projectWorld(setup, w);
        const hit: Vec3 = [ir[0] + uv[0], ir[1] + uv[1], 0.1];
        const start: Vec3 = setup.beam === "divergent" ? setup.source : w;
        return (
          <group key={lm.id}>
            {showRays && <Line points={[v3(start), v3(hit)]} color={lm.color} lineWidth={1} transparent opacity={0.55} />}
            <mesh position={v3(hit)}>
              <circleGeometry args={[0.6, 20]} />
              <meshBasicMaterial color={lm.color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

type V3 = [number, number, number];
const CAMERAS: Record<CameraView, { position: V3; target: V3; label: string }> = {
  overview: { position: [-80, 80, 255], target: [0, -5, 70], label: "Overview" },
  patient: { position: [-75, 40, 85], target: [0, 2, 15], label: "Patient" },
  side: { position: [-300, 10, 95], target: [0, 0, 95], label: "Side" },
};

function Controls() {
  const camera = useStore((s) => s.camera);
  const ref = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const v = CAMERAS[camera.view];
    c.object.position.set(...v.position);
    c.target.set(...v.target);
    c.update();
  }, [camera]);
  return <OrbitControls ref={ref} makeDefault minDistance={30} maxDistance={800} />;
}

function CameraButtons() {
  const view = useStore((s) => s.camera.view);
  const setCameraView = useStore((s) => s.setCameraView);
  return (
    <div className="camera-buttons" role="group" aria-label="Camera view">
      {(Object.keys(CAMERAS) as CameraView[]).map((k) => (
        <button key={k} className={view === k ? "active" : ""} onClick={() => setCameraView(k)}>
          {CAMERAS[k].label}
        </button>
      ))}
    </div>
  );
}

export function Scene3D() {
  const img = useImage();
  return (
    <div className="scene3d">
      <Canvas camera={{ position: CAMERAS.overview.position, fov: 40, near: 1, far: 4000 }} dpr={[1, 2]}>
        <color attach="background" args={["#eef1f4"]} />
        <hemisphereLight args={["#ffffff", "#9aa3ad", 0.9]} />
        <directionalLight position={[-100, 200, 150]} intensity={1.4} />
        <directionalLight position={[120, 60, -100]} intensity={0.5} />
        <Patient setup={img.setup} />
        <TubeAndReceptor setup={img.setup} />
        <gridHelper args={[400, 20, "#c6ccd3", "#dde1e6"]} position={[0, -60, 80]} />
        <Controls />
      </Canvas>
      <CameraButtons />
    </div>
  );
}
