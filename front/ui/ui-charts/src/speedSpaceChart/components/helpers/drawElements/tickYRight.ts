import { FONT_SANS } from '../../../../common/consts';
import { BLACK_ALPHA_25, BLACK_ALPHA_85 } from '../../../../common/helpers/colors';
import type { DrawFunctionParams } from '../../../types';
import { MARGINS } from '../../consts';
import { clearCanvas, slopesValues } from '../../utils';

const { RIGHT_TICK_MARGINS, CURVE_MARGIN_TOP } = MARGINS;
const TICK_WIDTH = 6; // Width of the tick mark on the right Y-axis
const NB_TICKS = 6; // Half number of ticks to draw on the right Y-axis

export const computeCenterY = (availableHeight: number) => {
  return availableHeight / 2 + CURVE_MARGIN_TOP;;
}

export const computeRoundedMaxAbsGradient = (minGradient: number, maxGradient: number) => {
  const maxAbsGradient = Math.max(Math.abs(maxGradient), Math.abs(minGradient));
  return Math.ceil(maxAbsGradient / NB_TICKS) * NB_TICKS;
}

export const drawTickYRight = ({ ctx, width, height, store }: DrawFunctionParams) => {
  const { cursor } = store;

  const { minGradient, maxGradient } = slopesValues(store);

  // Calculate total height available for ticks excluding the margins
  const availableHeight = height - CURVE_MARGIN_TOP * 2;

  const tickSpacing = availableHeight / (NB_TICKS * 2); 

  // Calculate the vertical center of the chart
  const centerY = computeCenterY(availableHeight);

  const tickX = width - RIGHT_TICK_MARGINS;
  const textOffsetX = tickX + TICK_WIDTH + 5; 


  clearCanvas(ctx, width, height);
  ctx.save();

  // Draw background
  const cursorHover = cursor.x !== null && cursor.y !== null && cursor.x > tickX && cursor.y < height;
  ctx.fillStyle = cursorHover ? 'white' : 'rgb(247, 246, 238)';
  ctx.fillRect(tickX, 0, RIGHT_TICK_MARGINS, height);

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 0.5;
  ctx.moveTo(tickX, 0);
  ctx.lineTo(tickX, height);
  ctx.closePath();
  ctx.stroke();

  ctx.font = 'normal 12px IBM Plex Sans';
  ctx.lineWidth = 0.5;

  // Calculate gradient step to avoid decimals
  const roundedMaxAbsGradient = computeRoundedMaxAbsGradient(minGradient, maxGradient);
  const gradientStep = roundedMaxAbsGradient / NB_TICKS;

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.textAlign = 'left';
  ctx.fillStyle = `rgb(121, 118, 113)`;
  for (let i = -NB_TICKS; i <= NB_TICKS; i++) {
    const tickValue = i * gradientStep;
    const tickY = centerY - i * tickSpacing;

    ctx.moveTo(tickX, tickY);
    ctx.lineTo(tickX + TICK_WIDTH, tickY);
    const text = tickValue > 0 ? `+${tickValue}` : tickValue.toString();
    const textPositionYRight = tickY + 4;

    ctx.fillText(text, textOffsetX, textPositionYRight);
  }
  ctx.stroke();
  ctx.restore();
  ctx.save();

  if (cursorHover) {
    const unitBoxWidth = 43;
    const unitBoxHeight = 32;
    const unitBoxOffset = 8;
    const unitBoxPostionX = tickX - unitBoxOffset - unitBoxWidth;
    const unitBoxPositionY = centerY - unitBoxHeight / 2;

    ctx.fillStyle = BLACK_ALPHA_85;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.shadowBlur = 6;
    ctx.shadowColor = BLACK_ALPHA_25;
    ctx.beginPath();
    ctx.roundRect(unitBoxPostionX, unitBoxPositionY, unitBoxWidth, unitBoxHeight, 4);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    ctx.font = `normal 14px ${FONT_SANS}`;
    ctx.fillText("‰", unitBoxPostionX + unitBoxWidth / 2, unitBoxPositionY + unitBoxHeight / 2 + 4);
  }
  ctx.restore();
};
