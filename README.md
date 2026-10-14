# Projection Trainer

A single-page teaching app for radiologic technology students. It shows a
simplified 3D thorax, the X-ray tube, the central ray and the image receptor
on the left. On the right is the live 2D radiograph produced by projecting
that model.

Nothing on the image is scripted. Every landmark is projected from the focal
spot onto the IR plane (point source, divergent beam), or along the central
ray in parallel-beam mode. The scenario answers come from measuring those
projections.

## Run it

Requires Node 18+.

```bash
cd radiography-trainer
npm install
npm run dev        # open the printed URL (http://localhost:5173)
npm test           # projection-math and scenario tests
npm run build      # static site in dist/ (can be opened from any web server)
```

## Hosting (Railway)

`railway.json` and `npm start` (a dependency-free static server, `server.mjs`)
are set up for Railway. In Railway:

1. New Project → Deploy from GitHub repo → pick this repository.
2. Service Settings → Root Directory: `/radiography-trainer`.
3. Networking → Generate Domain.

Railway builds with `npm run build`, starts with `npm start` and listens on its
`$PORT`.

## How the geometry works

| Frame | Axes |
|---|---|
| Body (data files) | +x patient's left, +y superior, +z anterior; cm; origin = centring point (≈ T7 for chest) |
| Room | IR is the plane Z = 0, tube on +Z, +Y up |

- **Pose:** rotation matrix = yaw (about the long axis) · lordotic lean · lateral tilt.
  - Yaw 0 = AP, +45 = LPO, +90 = left lateral, 180 = PA, −135 = RAO.
  - "+" on the rotation slider turns the patient's right side anteriorly.
- **Placement:** the body is positioned so its nearest surface is "Patient–IR gap" from the IR. The CR always passes through the centring point.
- **Central ray:** SID is measured along the CR. CR angulation tilts the tube while the IR stays flat and slides to stay centred.
- **Display:** AP, PA and obliques are shown in anatomical position (patient's right on the viewer's left). That means PA-type images are mirrored relative to the tube's view. Laterals are shown as seen from the tube side.

Code lives in `src/geometry/`. It does not depend on Three.js, so it can be
unit-tested on its own:

- `projection.ts`: pose, tube/IR setup, ray–plane projection, magnification
- `image.ts`: `computeImage()`, the one function both views use
- `positionName.ts`: names the position from the angles ("≈ 15° LPO")

## Adding a body part

1. Create `src/data/bodyParts/<part>.ts` exporting a `BodyPart`. It contains:
   - primitives: `hull`, `ellipsoid` or `tube`
   - landmarks
   - measurements
   - presets
   - IR size
2. Optionally add `src/data/scenarios/<part>.ts`. Each scenario's `evaluate()` receives the before/after images and returns the correct choice, the facts and the explanation.
3. Register it in `src/data/bodyParts/index.ts`.

The model's proportions are approximate teaching values built from simple
geometric shapes. They are not measured anatomy.
