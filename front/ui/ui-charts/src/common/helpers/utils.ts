// ============= Canvas ==============

import { PICKING, RENDERING } from "../consts";
import { ContextKey, LayerEntry } from "../types";

/**
 * This function returns the picking layers scaling ratio. We basically take the min of the screen
 * pixels and the "HTML pixels", and divide it by two.
 *
 * This allows having a smaller picking stage to fill (so it's faster), while keeping a "good enough
 * precision".
 */
export function getPickingScalingRatio(): number {
  const pickingDownscalingRatio = 0.5;
  const dpr = window.devicePixelRatio || 1;

  // When devicePixelRatio is over 1 (like for Retina displays), we downscale based on the "HTML
  // pixels":
  if (dpr > 1) return pickingDownscalingRatio;

  // When devicePixelRatio is under or equal to 1 (like when the user zooms out for instance), we
  // downscale based on the actual "screen pixels" (to avoid having a too large scene to fill):
  return pickingDownscalingRatio * dpr;
}

export const makeContextKey = ({ type, layer }: LayerEntry): ContextKey => {
  switch (type) {
    case RENDERING:
      return `${RENDERING}-${layer}`;
    case PICKING:
      return `${PICKING}-${layer}`;
  }
}
