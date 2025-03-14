import type { DrawFunctionParams } from '../../../types';
import { MARGINS, TICK_TITLE_MARGINS, RIGHT_TICK_HEIGHT_OFFSET } from '../../const';
import { clearCanvas, slopesValues } from '../../utils';

const { MARGIN_LEFT, MARGIN_TOP, MARGIN_BOTTOM, RIGHT_TICK_MARGINS } = MARGINS;
const { Y_RIGHT_VERTICAL, Y_RIGHT_HORIZONTAL } = TICK_TITLE_MARGINS;

export const drawTickYRight = ({ ctx, width, height, store }: DrawFunctionParams) => {
  clearCanvas(ctx, width, height);

  const { minGradient, maxGradient } = slopesValues(store);

  // Calculate total height available for ticks excluding the margins
  const availableHeight = height - MARGIN_TOP - MARGIN_BOTTOM - RIGHT_TICK_MARGINS;

  const tickSpacing = availableHeight / 12; // 12 intervals for 13 ticks

  // Calculate the vertical center of the chart
  const centerY =
    MARGIN_TOP + RIGHT_TICK_MARGINS / 2 + availableHeight / 2 + RIGHT_TICK_HEIGHT_OFFSET;

  const textOffsetX = width - MARGIN_LEFT + 10;
  const tickWidth = 6;

  ctx.font = 'normal 12px IBM Plex Sans';
  ctx.lineWidth = 0.5;

  // Calculate gradient step to avoid decimals
  const maxAbsGradient = Math.max(maxGradient, minGradient);
  const roundedMaxAbsGradient = Math.ceil(maxAbsGradient / 6) * 6;
  const gradientStep = roundedMaxAbsGradient / 6;

  ctx.beginPath();
  for (let i = -6; i <= 6; i++) {
    const tickValue = i * gradientStep;
    const tickY = centerY - i * tickSpacing;

    ctx.moveTo(width - MARGIN_LEFT - tickWidth, tickY);
    ctx.lineTo(width - MARGIN_LEFT, tickY);
    ctx.strokeStyle = 'rgb(121, 118, 113)';

    ctx.textAlign = 'left';
    const text = tickValue.toString();
    const textPositionYRight = tickY + 4;
    const opacity = 1;

    ctx.fillStyle = `rgba(182, 179, 175, ${opacity})`;
    ctx.fillText(text, textOffsetX, textPositionYRight);

    ctx.fillText('‰', width - Y_RIGHT_HORIZONTAL, Y_RIGHT_VERTICAL);
  }
  ctx.stroke();

  // prevent overlapping with margin top
  ctx.clearRect(0, 0, width, MARGIN_TOP);
  ctx.clearRect(width - MARGIN_LEFT, height - MARGIN_BOTTOM, width, MARGIN_BOTTOM);
  ctx.clearRect(0, height - MARGIN_BOTTOM + 6, width - MARGIN_LEFT, MARGIN_BOTTOM);
};
