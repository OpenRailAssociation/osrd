import type {
  DrawFunctionParams,
  SpeedLimitTagsLayerDrawFunctionParams,
  tooltipInfos,
} from '../../../types';
import {
  COLOR_DICTIONARY,
  LINEAR_LAYER_SEPARATOR_HEIGHT,
  LINEAR_LAYERS_BACKGROUND_COLOR,
  LINEAR_LAYERS_HEIGHTS,
  MARGINS,
  WHITE,
} from '../../const';
import {
  clearCanvas,
  drawLinearLayerBackground,
  drawRoundedRect,
  drawSeparatorLinearLayer,
  drawSvgImageWithColor,
  maxPositionValue,
  positionOnGraphScale,
} from '../../utils';

const RECT_HEIGHT = 17;
const Y_POSITION = 12;
const RECTANGLE_SPACING = 1;
const TEXT_LEFT_PADDING = 4;
const TEXT_RIGHT_PADDING = 8;
const FIRST_TAG_LEFT_PADDING = 8;
const ICON_WIDTH = 16;
const ICON_HEIGHT = 16;
const ICON_OFFSET = 4;
const TEXT_PADDING_TOP = 1;
const ICON_BACKGROUND_WIDTH = 24;
const ICON_BACKGROUND_HEIGHT = 24;

export const drawSpeedLimitTags = ({
  ctx,
  width,
  height: marginTop,
  store,
  images,
}: SpeedLimitTagsLayerDrawFunctionParams) => {
  const {
    speedLimitTags,
    ratioX,
    leftOffset,
    layersDisplay: { electricalProfiles, powerRestrictions },
  } = store;

  const { MARGIN_BOTTOM, MARGIN_LEFT, MARGIN_RIGHT } = MARGINS;

  clearCanvas(ctx, width, LINEAR_LAYERS_HEIGHTS.SPEED_LIMIT_TAGS_HEIGHT);

  ctx.save();
  ctx.translate(leftOffset, 0);

  const maxPosition = maxPositionValue(store.speeds);

  let speedLimitTagsBackgroundColor = LINEAR_LAYERS_BACKGROUND_COLOR.FIRST;

  if (electricalProfiles && powerRestrictions) {
    speedLimitTagsBackgroundColor = LINEAR_LAYERS_BACKGROUND_COLOR.THIRD;
  } else if (electricalProfiles || powerRestrictions) {
    speedLimitTagsBackgroundColor = LINEAR_LAYERS_BACKGROUND_COLOR.SECOND;
  }

  drawSeparatorLinearLayer(ctx, 'rgba(0,0,0,0.1)', MARGINS, width, LINEAR_LAYER_SEPARATOR_HEIGHT);
  drawLinearLayerBackground(
    ctx,
    speedLimitTagsBackgroundColor,
    MARGINS,
    width,
    MARGIN_BOTTOM,
    LINEAR_LAYERS_HEIGHTS.SPEED_LIMIT_TAGS_HEIGHT - LINEAR_LAYER_SEPARATOR_HEIGHT
  );

  if (!speedLimitTags) return;

  speedLimitTags.forEach(({ position, value }, index) => {
    const { tag, color } = value;
    const x = positionOnGraphScale(position.start, maxPosition, width, ratioX, MARGINS);
    const nextBoundary = positionOnGraphScale(position.end!, maxPosition, width, ratioX, MARGINS);

    if (nextBoundary !== undefined) {
      const tagWidth = nextBoundary - x - RECTANGLE_SPACING;

      const secondaryColor = COLOR_DICTIONARY[color] || color;

      ctx.fillStyle = color;
      ctx.strokeStyle = tag === 'UU' ? '#494641' : color;
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.fillRect(x, Y_POSITION, tagWidth - RECTANGLE_SPACING, RECT_HEIGHT);

      ctx.fillStyle = secondaryColor;

      const textWidth =
        ctx.measureText(tag).width +
        TEXT_RIGHT_PADDING +
        (index === 0 ? FIRST_TAG_LEFT_PADDING : 0);

      ctx.fillRect(x + 1 + textWidth, Y_POSITION, tagWidth - textWidth - 2, RECT_HEIGHT);
      ctx.rect(x + textWidth, Y_POSITION, tagWidth - RECTANGLE_SPACING - textWidth, RECT_HEIGHT);
      ctx.strokeRect(x + 1, Y_POSITION, tagWidth - RECTANGLE_SPACING, RECT_HEIGHT);
      ctx.closePath();

      if (tag === 'UU') {
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x + textWidth + 2, Y_POSITION);
        ctx.lineTo(x + textWidth + 2, Y_POSITION + RECT_HEIGHT);
        ctx.closePath();
        ctx.stroke();
      }

      if (tag === 'incompatible' || tag === 'missing_from_train') {
        const image = tag === 'incompatible' ? images.alertFillImage : images.questionImage;

        ctx.fillStyle = color;

        const iconXPosition = x + (tagWidth - ICON_BACKGROUND_WIDTH) / 2;
        const iconYPosition = Y_POSITION - ICON_OFFSET;
        const cornerRadius = 4;

        drawRoundedRect(
          ctx,
          iconXPosition,
          iconYPosition,
          ICON_BACKGROUND_WIDTH,
          ICON_BACKGROUND_HEIGHT,
          cornerRadius
        );
        if (image !== null)
          drawSvgImageWithColor(
            ctx,
            image,
            iconXPosition + ICON_OFFSET,
            iconYPosition + ICON_OFFSET,
            ICON_WIDTH,
            ICON_HEIGHT,
            WHITE.hex()
          );
      } else {
        ctx.fillStyle = 'white';
        ctx.font = '600 12px "IBM Plex Sans"';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const textPosition = x + TEXT_LEFT_PADDING;
        ctx.fillText(tag, textPosition, Y_POSITION + TEXT_PADDING_TOP + RECT_HEIGHT / 2);
      }
    }
  });

  drawSeparatorLinearLayer(ctx, 'rgba(0,0,0,0.1)', MARGINS, width, marginTop);
  ctx.restore();

  // prevent overlapping with margins left and right
  ctx.clearRect(0, 0, MARGIN_LEFT, LINEAR_LAYERS_HEIGHTS.SPEED_LIMIT_TAGS_HEIGHT);
  ctx.clearRect(width - MARGIN_RIGHT, 0, width, LINEAR_LAYERS_HEIGHTS.SPEED_LIMIT_TAGS_HEIGHT);
};

export const computeTooltip = ({
  width,
  height: marginTop,
  store,
}: DrawFunctionParams): tooltipInfos | null => {
  const { speedLimitTags, ratioX, leftOffset, cursor } = store;

  const { MARGIN_TOP, MARGIN_LEFT } = MARGINS;

  const maxPosition = maxPositionValue(store.speeds);

  if (!speedLimitTags) return null;

  for (const { position, value } of speedLimitTags) {
    const tooltipTextMap: Record<string, string> = {
      incompatible: 'Incompatible with the infrastructure',
    };

    const { tag } = value;
    if (!(tag in tooltipTextMap)) continue;
    const potentialTooltipText = tooltipTextMap[tag];

    if (position.end === undefined || cursor.x === null || cursor.y === null) continue;

    const x = positionOnGraphScale(position.start, maxPosition, width, ratioX, MARGINS);
    const nextBoundary = positionOnGraphScale(position.end, maxPosition, width, ratioX, MARGINS);

    const tagWidth = nextBoundary - x - RECTANGLE_SPACING;
    if (
      cursor.x >= x - MARGIN_LEFT + leftOffset &&
      cursor.x <= x - MARGIN_LEFT + leftOffset + tagWidth &&
      cursor.y >= marginTop - MARGIN_TOP + Y_POSITION - 2 &&
      cursor.y <= marginTop - MARGIN_TOP + Y_POSITION - 1 + RECT_HEIGHT
    ) {
      return {
        cursorX: cursor.x + MARGIN_LEFT,
        cursorY: Y_POSITION,
        text: potentialTooltipText,
      };
    }
  }
  return null;
};
