import { useCallback } from 'react';

import { BLACK_ALPHA_50 } from '../../common/helpers/colors';
import { useDraw } from '../../common/hooks/useCanvas';
import { TOP_CAPTION_HEIGHT } from '../../common/layers/TimeCaptions';
import type { DrawingFunction } from '../../common/types';
import { SpaceTimeChartCanvasContext } from '../lib/context';
import type { SpaceTimeChartContextType } from '../lib/types';
import { useIntervalPositions } from './useIntervalPositions';

const MARKER_COLOR = BLACK_ALPHA_50;

const PIN_RADIUS = 3;
const PIN_STEM_WIDTH = 2;
const PIN_STEM_HEIGHT = 7;
// Gap between the circle bottom and the stem top
const PIN_CIRCLE_TO_STEM_GAP = 2;
const PIN_STEM_START = PIN_RADIUS + PIN_CIRCLE_TO_STEM_GAP;

/** Draws a pin with its circle centered at `circleY` and its stem starting at `stemTopY`. */
const drawPin = (ctx: CanvasRenderingContext2D, x: number, circleY: number, stemTopY: number) => {
  ctx.beginPath();
  ctx.arc(x, circleY, PIN_RADIUS, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillRect(x - PIN_STEM_WIDTH / 2, stemTopY, PIN_STEM_WIDTH, PIN_STEM_HEIGHT);
};

export type PeriodicMarkerProps = {
  /** Length (in ms) of the interval. */
  duration: number;
  /** Start of the interval in ms. Defaults to `0`. */
  origin?: number;
};

/** Renders pin marker at every interval boundary visible in the viewport. */
export const PeriodicMarker = ({ duration, origin = 0 }: PeriodicMarkerProps) => {
  const positions = useIntervalPositions(duration, origin);

  const draw = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, { height, captionSize }) => {
      ctx.fillStyle = MARKER_COLOR;
      const yBase = height - captionSize;
      for (const x of positions) {
        // Top pin: circle + stem hanging down from TOP_CAPTION_HEIGHT
        drawPin(ctx, x, TOP_CAPTION_HEIGHT + PIN_RADIUS, TOP_CAPTION_HEIGHT + PIN_STEM_START);
        // Bottom pin (rotate(180deg) equivalent): stem + circle pointing up toward captionSize boundary
        drawPin(ctx, x, yBase - PIN_RADIUS, yBase - PIN_STEM_START - PIN_STEM_HEIGHT);
      }
    },
    [positions]
  );

  // 'captions' layer: must run after TimeCaptions fills the opaque top/bottom strips
  useDraw(SpaceTimeChartCanvasContext, 'captions', draw);

  return null;
};
