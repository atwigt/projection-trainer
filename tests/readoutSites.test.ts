import { describe, expect, it } from "vitest";

/**
 * A text scan, and worth exactly that.
 *
 * Two of the four places an SC-joint offset is shown are React components —
 * the measurements table and the readout drawn on the image — and this repo
 * has no component test harness, so no behavioural test can reach them.
 * Measured with the mutation harness: reverting either one to a bare
 * `.distance.toFixed(1)` leaves the rest of the suite green. This is the only
 * guard that goes red on that, so it scans for the defect's shape rather than
 * for its behaviour, and it must not be read as coverage of the rendering.
 *
 * The rule: a component must not read `.distance` off a measurement. The
 * unsigned magnitude on its own is the defect — it reads as a distance on the
 * landmark's own side of the line when the landmark is that far past it.
 * Components go through `offsetShort`, which always names the side.
 *
 * The file set comes from Vite's glob rather than a hand-written list, so a
 * new component is scanned without anyone remembering to add it, and from an
 * unfiltered `**\/*` rather than an extension allowlist, because a narrowed
 * sweep reports no survivors and reads exactly like a clean bill of health.
 */
const SOURCES = import.meta.glob("../src/components/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const MARKER = "allow-bare-distance";
const rel = (path: string) => path.replace("../src/components/", "");

describe("measurement readout sites", () => {
  it("reached the files it is meant to vouch for", () => {
    // A sweep that reached nothing has no survivors to report, which looks
    // identical to a clean result. Assert the premise instead of trusting it.
    const names = Object.keys(SOURCES).map(rel);
    expect(names).toContain("Controls/Measurements.tsx");
    expect(names).toContain("Radiograph2D/Radiograph2D.tsx");
    expect(names.length).toBeGreaterThanOrEqual(5);
  });

  it("no component reads the unsigned .distance off a measurement", () => {
    const offenders: string[] = [];
    for (const [path, text] of Object.entries(SOURCES))
      text.split("\n").forEach((line, i) => {
        if (/\.distance\b/.test(line) && !line.includes(MARKER))
          offenders.push(`${rel(path)}:${i + 1}: ${line.trim()}`);
      });
    expect(offenders, `use offsetShort(), or mark the line "${MARKER}" with a reason`).toEqual([]);
  });

  it("both readout sites go through offsetShort", () => {
    for (const name of ["Controls/Measurements.tsx", "Radiograph2D/Radiograph2D.tsx"]) {
      const entry = Object.entries(SOURCES).find(([p]) => rel(p) === name);
      expect(entry, name).toBeDefined();
      expect(entry![1], name).toContain("offsetShort");
    }
  });
});
