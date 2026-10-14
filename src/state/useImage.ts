import { useMemo } from "react";
import { computeImage, type ImageResult } from "../geometry/image";
import { body, useStore } from "./store";

/** Current projected image (recomputed whenever the positioning changes). */
export function useImage(): ImageResult {
  const bodyId = useStore((s) => s.bodyId);
  const pos = useStore((s) => s.pos);
  return useMemo(() => computeImage(body(bodyId), pos), [bodyId, pos]);
}

/** Image of the ghost/trail reference state, if trail mode is on. */
export function useReferenceImage(): ImageResult | null {
  const bodyId = useStore((s) => s.bodyId);
  const ref = useStore((s) => s.reference);
  return useMemo(() => (ref ? computeImage(body(bodyId), ref) : null), [bodyId, ref]);
}
