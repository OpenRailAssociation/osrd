import type { DrawFunctionParams } from '../../../types';
import { MARGINS, SLOPE_FILL_COLOR } from '../../consts';
import { clearCanvas, maxPositionValue, slopesValues } from '../../utils';
import { computeCenterY, computeRoundedMaxAbsGradient } from './tickYRight';

const { CURVE_MARGIN_SIDES, CURVE_MARGIN_TOP } = MARGINS;

export const drawDeclivity = ({ ctx, width, height, store }: DrawFunctionParams) => {
  const { slopes, ratioX, leftOffset } = store;

  const { minGradient, maxGradient } = slopesValues(store);
  const maxPosition = maxPositionValue(store.speeds);

  if (!slopes || slopes.length === 0) {
    console.error('Slopes data is missing or empty.');
    return;
  }

  clearCanvas(ctx, width, height);

  ctx.save();
  ctx.translate(leftOffset, 0);

  // Calculate total height available for drawing, excluding the margins
  const availableHeight = height - CURVE_MARGIN_TOP * 2;

  // Calculate the vertical center of the chart
  const centerY = computeCenterY(availableHeight);

  ctx.fillStyle = SLOPE_FILL_COLOR;

  const roundedMaxAbsGradient = computeRoundedMaxAbsGradient(minGradient, maxGradient);

  const coefX = ((width - CURVE_MARGIN_SIDES) / maxPosition) * ratioX;
  const coefY = availableHeight / (2 * roundedMaxAbsGradient);

  ctx.fillStyle = 'rgba(207, 221, 206, 0.51)';
  slopes.map(slope => {
    const {position: {start, end}, value} = slope;

    if (value !== 0.0 && end) {
      const startX = start * coefX + CURVE_MARGIN_SIDES / 2;
      const endX = end * coefX + CURVE_MARGIN_SIDES / 2;
      const rectWidth = endX - startX;
      const rectHeight = value * coefY;

      const startY = value > 0 ? centerY - rectHeight : centerY;

      ctx.fillRect(startX, startY, rectWidth, Math.abs(rectHeight));
    }
  });
  ctx.restore();
};
