import { FONT_SANS } from '../../../../common/consts';
import { BLACK_ALPHA_25, BLACK_ALPHA_85 } from '../../../../common/helpers/colors';
import type { DrawFunctionParams } from '../../../types';
import { MARGINS } from '../../consts';
import { clearCanvas, maxSpeedValue } from '../../utils';

const { MARGIN_LEFT, CURVE_MARGIN_TOP } = MARGINS;
const TICK_WIDTH = 6;
const TEXT_POSITION_X = MARGIN_LEFT - TICK_WIDTH - 6;

export const drawAxisY = ({ ctx, width, height, store }: DrawFunctionParams) => {
  const maxSpeed = maxSpeedValue(store);
  const { cursor } = store;

  clearCanvas(ctx, width, height);
  ctx.save();

  // Draw background
  const cursorHover = cursor.x !== null && cursor.y !== null && cursor.x < MARGIN_LEFT && cursor.y < height;
  ctx.fillStyle = cursorHover ? 'white' : 'rgb(247, 246, 238)';
  ctx.fillRect(0, 0, MARGIN_LEFT, height);

  // Draw separator line
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 0.5;
  ctx.moveTo(MARGIN_LEFT, 0);
  ctx.lineTo(MARGIN_LEFT, height);
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = 'rgb(121, 118, 113)';
  ctx.lineWidth = 0.5;
  ctx.font = 'normal 12px IBM Plex Sans';
  ctx.fillStyle = 'rgb(182, 178, 175)';

  // Define the tick scale depending on the max speed
  let tickScale = 5;
  if (maxSpeed > 250) {
    tickScale = 50;
  } else if (maxSpeed > 130) {
    tickScale = 30;
  } else if (maxSpeed > 60) {
    tickScale = 15;
  }

  const nbTicks = Math.ceil(maxSpeed / tickScale);
  const maxTickSpeed = nbTicks * tickScale;
  const ratioRoundPositions = maxTickSpeed / maxSpeed;
  const ticksOffset =
    ((height - CURVE_MARGIN_TOP) * ratioRoundPositions) / nbTicks;

  // Draw ticks with text
  ctx.beginPath();
  for (let i = 1; i <= nbTicks; i++) {
    const positionY = height - ticksOffset * i;
    ctx.moveTo(MARGIN_LEFT - TICK_WIDTH, positionY);
    ctx.lineTo(MARGIN_LEFT, positionY);
    ctx.textAlign = 'right';
    const text = (i * tickScale).toString();
    const textPositionY = positionY + 4;

    ctx.fillStyle = `rgb(121, 118, 113)`;
    ctx.fillText(text, TEXT_POSITION_X, textPositionY);
  }
  ctx.stroke();

  // Draw lines
  ctx.strokeStyle = 'rgba(33, 112, 185, 0.75)';
  ctx.beginPath();
  ctx.lineWidth = 0.5;
  for (let i = 1; i <= nbTicks; i++) {
    const positionY = height - ticksOffset * i;
    ctx.moveTo(MARGIN_LEFT, positionY);
    ctx.lineTo(width, positionY);
  }
  ctx.stroke();


  if (cursorHover) {
    const unitBoxWidth = 57;
    const unitBoxHeight = 32;
    const unitBoxOffset = 8;
    const unitBoxPostionX = MARGIN_LEFT + unitBoxOffset;
    const unitBoxPositionY = (height - unitBoxHeight) / 2;

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
    ctx.fillText("km/h", unitBoxPostionX + unitBoxWidth / 2, unitBoxPositionY + unitBoxHeight / 2 + 4);
  }

  ctx.restore();
};
