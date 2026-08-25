import { useCallback } from 'react';

import chroma from 'chroma-js';

import { useDraw } from '../../common/hooks/useCanvas';
import type { DrawingFunction } from '../../common/types';
import { SpaceTimeChartCanvasContext } from '../lib/context';
import type { SpaceTimeChartContextType } from '../lib/types';
import { useIntervalPositions } from './useIntervalPositions';

const BAR_HEIGHT = 24;
const BAR_PADDING_LEFT = 8;
const BAR_PADDING_RIGHT = 4;
const BAR_BOTTOM_OFFSET = 17;
const BAR_RADIUS = 3;
const ELLIPSIS = '...';

export type TrainInfoBarColors = {
  /** Color shade 10, used as the bar background. */
  surface: string;
  /** Color shade 70, used as the bar border. */
  strong: string;
};

const getTrainInfoBarColors = ({ surface, strong }: TrainInfoBarColors) => ({
  fill: chroma(surface).alpha(0.3).css(),
  stroke: chroma(strong).alpha(0.3).css(),
});

const truncateText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  if (ctx.measureText(text).width <= maxWidth) return text;

  const ellipsisWidth = ctx.measureText(ELLIPSIS).width;
  let truncatedText = '';
  for (const character of text) {
    if (ctx.measureText(truncatedText + character).width + ellipsisWidth > maxWidth) break;
    truncatedText += character;
  }
  return `${truncatedText}${ELLIPSIS}`;
};

export type TrainInfoBarProps = {
  /** Length (in ms) of the train's time window. */
  duration: number;
  /** Start of the first time window in ms. Defaults to `0`. */
  origin?: number;
  /** Name of the selected train. */
  name: string;
  /** Formatted label of the interval duration (e.g. `2h 00min`). */
  intervalLabel: string;
  colors: TrainInfoBarColors;
};

/** Renders one info bar per visible interval of the selected train. */
export const TrainInfoBar = ({
  duration,
  origin = 0,
  name,
  intervalLabel,
  colors,
}: TrainInfoBarProps) => {
  const positions = useIntervalPositions(duration, origin);
  const barColors = getTrainInfoBarColors(colors);

  const draw = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, { height, captionSize }) => {
      if (positions.length < 2) return;

      const yTop = height - captionSize - BAR_BOTTOM_OFFSET - BAR_HEIGHT;
      ctx.font = '400 12px IBM Plex Sans';
      ctx.textBaseline = 'middle';
      const textY = yTop + BAR_HEIGHT / 2;

      for (let index = 0; index < positions.length - 1; index++) {
        const left = positions[index];
        const width = positions[index + 1] - left;
        if (width <= 0) continue;

        ctx.beginPath();
        ctx.roundRect(left, yTop, width, BAR_HEIGHT, BAR_RADIUS);
        ctx.fillStyle = barColors.fill;
        ctx.fill();
        ctx.strokeStyle = barColors.stroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Clip to bar interior to replicate overflow: hidden.
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          left + BAR_PADDING_LEFT,
          yTop,
          width - BAR_PADDING_LEFT - BAR_PADDING_RIGHT,
          BAR_HEIGHT
        );
        ctx.clip();
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        const text = `${name} | ${intervalLabel}`;
        const textWidth = width - BAR_PADDING_LEFT - BAR_PADDING_RIGHT;
        ctx.fillText(truncateText(ctx, text, textWidth), left + BAR_PADDING_LEFT, textY);
        ctx.restore();
      }
    },
    [name, intervalLabel, positions, barColors]
  );

  // 'captions' layer: must run after TimeCaptions fills the opaque bottom strip
  useDraw(SpaceTimeChartCanvasContext, 'captions', draw);

  return null;
};
