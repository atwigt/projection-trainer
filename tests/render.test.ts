import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Measurements } from "../src/components/Controls/Measurements";
import { Radiograph2D } from "../src/components/Radiograph2D/Radiograph2D";
import { useStore } from "../src/state/store";

/**
 * The components, actually rendered.
 *
 * Everything else here tests the pure functions behind the readouts, which
 * leaves the question nobody was asking: does what they return reach the
 * screen? react-dom/server renders them to static markup with no DOM and no
 * new dependency, so these are assertions about output rather than about
 * source text.
 *
 * MEASURED LIMIT, and it is why tests/readoutSites.test.ts still exists:
 * under renderToStaticMarkup the zustand hook returns the store's INITIAL
 * state no matter what useStore.setState has been called with, so every
 * render below is the default PA chest. A crossed landmark and the
 * degenerate-geometry banner cannot be reached from here at all. Driving
 * those needs a client render, which needs jsdom, which is a dependency this
 * round did not add. Layout — clipping, overlap, running off the receptor —
 * is invisible to all of it, and was checked by driving the built app in a
 * browser and looking at the rendered image.
 */
const radiograph = () => renderToStaticMarkup(createElement(Radiograph2D));
const card = () => renderToStaticMarkup(createElement(Measurements));

/** Markup as a reader sees it: tags dropped, entities decoded, runs collapsed. */
const text = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#xA0;| /g, " ")
    .replace(/\s+/g, " ")
    .trim();

describe("rendered readouts (default PA chest)", () => {
  it("renders the state these assertions assume", () => {
    // The premise. If the default ever stops being a square PA chest, these
    // numbers change and this says so instead of the others failing obscurely.
    const pos = useStore.getState().pos;
    expect(pos.presetId).toBe("PA");
    expect(pos.yawOffset).toBe(0);
  });

  it("names the side in both places, rather than a bare distance", () => {
    // This is the defect reaching the screen or not. The pure function is
    // tested elsewhere; what is tested here is that its result is what gets
    // written out, and not `distance` formatted alongside it.
    for (const [where, markup] of [
      ["measurements card", card()],
      ["radiograph", radiograph()],
    ] as const) {
      const t = text(markup);
      expect(t, where).toContain("2.5 cm on pt's R");
      expect(t, where).toContain("2.5 cm on pt's L");
      // A bare "2.5 cm" with no side after the label is the old output.
      expect(t, where).not.toMatch(/spine midline:? 2\.5 cm(?! on)/);
    }
  });

  it("states the rotation verdict in the card", () => {
    expect(text(card())).toContain("SC joints equidistant from the spinous processes");
    expect(text(card())).not.toContain("closer to the spine");
  });

  it("marks nothing as crossed on a square chest", () => {
    expect(card()).not.toContain("crossed");
    expect(text(card())).not.toContain("PAST");
    expect(text(radiograph())).not.toContain("PAST");
  });

  it("draws no geometry warning over an ordinary projection", () => {
    // Only the negative half of the banner is reachable from here, for the
    // reason in the header: the default state is the only one that renders.
    // It is still worth pinning — a warning that fires on a textbook PA chest
    // would be worse than no warning at all.
    const t = text(radiograph());
    expect(t).not.toContain("IMPOSSIBLE GEOMETRY");
    expect(t).not.toContain("EXTREME MAGNIFICATION");
  });
});
