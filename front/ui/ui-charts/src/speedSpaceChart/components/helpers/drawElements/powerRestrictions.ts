import type { DrawFunctionParams } from '../../../types';
import {
  LINEAR_LAYERS_BACKGROUND_COLOR,
  LINEAR_LAYERS_HEIGHTS,
  LINEAR_LAYER_SEPARATOR_HEIGHT,
  MARGINS,
} from '../../const';
import {
  clearCanvas,
  drawLinearLayerBackground,
  drawSeparatorLinearLayer,
  maxPositionValue,
  positionOnGraphScale,
} from '../../utils';

const { MARGIN_LEFT, MARGIN_RIGHT } = MARGINS;
const LEFT_VERTICAL_LINE_HEIGHT = 24;
const LEFT_VERTICAL_LINE_PADDING_TOP = 8;
const RIGHT_VERTICAL_LINE_HEIGHT = 12;
const RIGHT_VERTICAL_LINE_PADDING_TOP = 14;
const RIGHT_VERTICAL_LINE_PADDING_RIGHT = 2;
const HORIZONTAL_LINE_PADDING_TOP = 11;
const TEXT_PADDING_HORIZONTAL = 2;
const TEXT_DISPLAY_MARGIN = 4;

export const drawPowerRestrictions = ({
  ctx,
  width,
  height: marginTop,
  store,
}: DrawFunctionParams) => {
  const {
    powerRestrictions,
    ratioX,
    leftOffset,
    layersDisplay: { electricalProfiles },
  } = store;

  if (!powerRestrictions) return;
  clearCanvas(ctx, width, LINEAR_LAYERS_HEIGHTS.POWER_RESTRICTIONS_HEIGHT);

  ctx.save();
  ctx.translate(leftOffset, 0);

  const maxPosition = maxPositionValue(store.speeds);

  ctx.font = 'normal 12px IBM Plex Sans';
  ctx.fillStyle = 'rgb(121, 118, 113)';
  ctx.strokeStyle = 'rgb(121, 118, 113)';
  ctx.lineWidth = 1;
  ctx.textAlign = 'center';

  let powerRestrictionsBackgroundColor = LINEAR_LAYERS_BACKGROUND_COLOR.FIRST;

  // Power restrictions linear can either be the first layer
  // if electrical profiles aren't displayed or second if they are
  if (electricalProfiles) {
    powerRestrictionsBackgroundColor = LINEAR_LAYERS_BACKGROUND_COLOR.SECOND;
  }

  drawSeparatorLinearLayer(
    ctx,
    'rgba(0,0,0,0.1)',
    MARGINS,
    width,
    marginTop - LINEAR_LAYERS_HEIGHTS.POWER_RESTRICTIONS_HEIGHT + LINEAR_LAYER_SEPARATOR_HEIGHT
  );

  drawLinearLayerBackground(
    ctx,
    powerRestrictionsBackgroundColor,
    MARGINS,
    width,
    marginTop,
    LINEAR_LAYERS_HEIGHTS.POWER_RESTRICTIONS_HEIGHT - LINEAR_LAYER_SEPARATOR_HEIGHT
  );

  powerRestrictions.forEach(({ position, value }, i) => {
    if (value.handled) {
      ctx.strokeStyle = 'rgb(121, 118, 113)';
      ctx.fillStyle = 'rgb(121, 118, 113)';
    } else {
      ctx.strokeStyle = 'rgb(217, 28, 28)';
      ctx.fillStyle = 'rgb(217, 28, 28)';
    }
    // Draw vertical line
    const startX = positionOnGraphScale(position.start, maxPosition, width, ratioX, MARGINS);
    const verticalStartY = LEFT_VERTICAL_LINE_PADDING_TOP;
    ctx.beginPath();
    ctx.moveTo(startX, verticalStartY);
    ctx.lineTo(startX, verticalStartY + LEFT_VERTICAL_LINE_HEIGHT);

    // Draw horizontal line around text
    const textWidth = Math.floor(ctx.measureText(value.powerRestriction).width);
    let horizontalEndX = positionOnGraphScale(position.end!, maxPosition, width, ratioX, MARGINS);
    if (i === powerRestrictions.length - 1) {
      horizontalEndX -= MARGINS.CURVE_MARGIN_SIDES / 2;
    }
    const horizontalY = verticalStartY + HORIZONTAL_LINE_PADDING_TOP;

    if (horizontalEndX - startX < textWidth + TEXT_PADDING_HORIZONTAL * 2 + TEXT_DISPLAY_MARGIN) {
      // Hide text if line is too short
      ctx.moveTo(startX, horizontalY);
      ctx.lineTo(horizontalEndX - 2, horizontalY);
    } else {
      const textStartX = (startX + horizontalEndX) / 2 - textWidth / 2 - TEXT_PADDING_HORIZONTAL;
      const textEndX = (startX + horizontalEndX) / 2 + textWidth / 2 + TEXT_PADDING_HORIZONTAL;

      ctx.moveTo(startX, horizontalY);
      ctx.lineTo(textStartX - TEXT_PADDING_HORIZONTAL, horizontalY);
      ctx.moveTo(textEndX + TEXT_PADDING_HORIZONTAL, horizontalY);
      ctx.lineTo(horizontalEndX - 2, horizontalY);

      const textX = (startX + horizontalEndX) / 2;
      ctx.textBaseline = 'middle';
      ctx.fillText(value.powerRestriction, textX, horizontalY + ctx.lineWidth / 2);
    }

    // Draw vertical line
    const verticalEndY = RIGHT_VERTICAL_LINE_PADDING_TOP;
    ctx.moveTo(horizontalEndX - RIGHT_VERTICAL_LINE_PADDING_RIGHT, verticalEndY);
    ctx.lineTo(
      horizontalEndX - RIGHT_VERTICAL_LINE_PADDING_RIGHT,
      verticalEndY + RIGHT_VERTICAL_LINE_HEIGHT
    );

    ctx.stroke();
  });

  ctx.restore();

  // prevent overlapping with margins left and right
  ctx.clearRect(0, 0, MARGIN_LEFT, LINEAR_LAYERS_HEIGHTS.POWER_RESTRICTIONS_HEIGHT);
  ctx.clearRect(
    width - MARGIN_RIGHT,
    0,
    MARGIN_RIGHT,
    LINEAR_LAYERS_HEIGHTS.POWER_RESTRICTIONS_HEIGHT
  );
};
