import type { DrawFunctionParams } from '../../../types';
import { clearCanvas, getGraphWidth, maxPositionValue } from '../../utils';
import { MARGINS, ZOOM_CONFIG } from '../../consts';
import { BLACK_ALPHA_85, BLACK_ALPHA_25, BLACK_ALPHA_50 } from '../../../../common/helpers/colors';
import { FONT_SANS, FONT_SANS_REGULAR } from '../../../../common/consts';

const { MARGIN_LEFT, MARGIN_BOTTOM, CURVE_MARGIN_SIDES, RIGHT_TICK_MARGINS } = MARGINS;

const MIN_TICK_SPACE = 10; // Minimum space between two ticks
const TICK_WIDTH = 0.5;
const TICK_RADIUS = 1.0;
const MAJOR_TICK_HEIGHT = 8;
const MIDLE_TICK_HEIGHT = 6;
const SMALL_TICK_HEIGHT = 4;
const FADE_CURSOR_RADIUS = 20;
const FADE_SIDES_RADIUS = 10;
const SLIDER_WIDTH = ZOOM_CONFIG.SLIDER_WIDTH  + 21;

export const drawTickX = ({ ctx, width, height, store }: DrawFunctionParams) => {
  const { ratioX, leftOffset, cursor, layersDisplay } = store;

  clearCanvas(ctx, width, height);
  ctx.save();

  // Draw background
  const positionY = height - MARGIN_BOTTOM;
  const cursorHover = cursor.y !== null && cursor.y > height - MARGIN_BOTTOM;
  const backgroundColor = cursorHover ? 'white' : 'rgb(250, 249, 245)';
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, positionY, width, MARGIN_BOTTOM);

  ctx.translate(leftOffset, 0);

  // Define ticks level
  const fixedGraphWidth = getGraphWidth(width, store.layersDisplay.declivities) - CURVE_MARGIN_SIDES;
  const widthWithRatio = fixedGraphWidth * ratioX;
  const maxPosition = maxPositionValue(store.speeds) * 1000;
  const idealScale = maxPosition / widthWithRatio * MIN_TICK_SPACE;
  // We round it up to the closest 100 or 1000
  const roundScale = idealScale < 1000 ? 100 : 1000;
  const tickScale = Math.ceil(idealScale/roundScale) * roundScale;
  const nbTicks = Math.ceil(maxPosition / tickScale);
  const finalWidth = widthWithRatio / maxPosition * nbTicks * tickScale;

  // Draw ticks
  ctx.strokeStyle = BLACK_ALPHA_50;
  ctx.fillStyle = BLACK_ALPHA_50;

  ctx.beginPath();

  for (let i = 0; i <= nbTicks; i++) {
    const positionX = MARGIN_LEFT + CURVE_MARGIN_SIDES / 2 + i * finalWidth / nbTicks;

    let tickHeight = SMALL_TICK_HEIGHT;
    if (i % 10 === 0) {
      tickHeight = MAJOR_TICK_HEIGHT;
    } else if (i % 5 === 0) {
      tickHeight = MIDLE_TICK_HEIGHT;
    }

    ctx.roundRect(positionX - TICK_WIDTH / 2, positionY, TICK_WIDTH, tickHeight, [TICK_RADIUS]);
  }

  // Draw text
  const computeAlpha = (distance: number, fadeDistance: number) => Math.min(Math.max(distance / fadeDistance - 0.5, 0), 1);
  const cursorPositionX = cursor.x ? cursor.x - leftOffset : Infinity;
  const cursorOnGraph = cursor.y && cursor.y < positionY;
  ctx.font = FONT_SANS_REGULAR;
  for (let i = 0; i <= nbTicks; i += 10) {
    const text = (tickScale * i / 1000).toString();
    const textWidth = ctx.measureText(text).width;
    const positionX = MARGIN_LEFT + CURVE_MARGIN_SIDES / 2 + i * finalWidth / nbTicks;
    const textPositionX = positionX - textWidth / 2;
    // Fade for left margin
    const distanceMarginLeft = Math.max(0, positionX - MARGIN_LEFT + leftOffset);
    const alphaLeft = computeAlpha(distanceMarginLeft, FADE_SIDES_RADIUS);
    // Fade for right slider
    const distanceSlider = Math.max(0, width - (positionX + SLIDER_WIDTH + leftOffset));
    const alphaSlider = computeAlpha(distanceSlider, FADE_SIDES_RADIUS);
    // Fade for cursor
    const distanceCursor = cursorOnGraph ? Math.abs(positionX - cursorPositionX) : Infinity;
    const alphaCursor = computeAlpha(distanceCursor, FADE_CURSOR_RADIUS);

    const alpha = Math.min(alphaLeft, alphaSlider, alphaCursor);
    ctx.fillStyle = `rgba(121, 118, 113, ${alpha})`
    ctx.fillText(text, textPositionX, positionY + 20);
  }

  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  ctx.save();

  // prevent overlapping with slider and under margins
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, positionY, MARGIN_LEFT, MARGIN_BOTTOM);
  if (layersDisplay.declivities) {
    ctx.fillRect(width - RIGHT_TICK_MARGINS, positionY, RIGHT_TICK_MARGINS, MARGIN_BOTTOM);
  }

  // Draw separator line
  ctx.beginPath();
  ctx.strokeStyle = BLACK_ALPHA_25;
  ctx.lineWidth = 0.5;
  ctx.moveTo(0, positionY);
  ctx.lineTo(width, positionY);
  ctx.closePath();
  ctx.stroke();

  if (cursorHover) {
    const unitBoxWidth = 44;
    const unitBoxHeight = 32;
    const unitBoxOffset = 8;
    const unitBoxPostionX = (width - MARGIN_LEFT - CURVE_MARGIN_SIDES - unitBoxWidth) / 2;
    const unitBoxPositionY = height - MARGIN_BOTTOM - unitBoxOffset - unitBoxHeight; 
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
    ctx.fillText("km", unitBoxPostionX + unitBoxWidth / 2, unitBoxPositionY + unitBoxHeight / 2 + 4);
  }
  ctx.restore();
};
