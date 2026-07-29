import { FONT } from '../../../../common/consts';
import { getCrispLineCoordinate } from '../../../../common/helpers/time';
import type { SpaceTimeChartContextType } from '../../../../spaceTimeChart';
import { OCCUPANCY_ZONE_Y_START, OCCUPANCY_ZONE_HEIGHT, FONTS, COLORS } from '../../../lib/consts';
import type { OccupancyZone } from '../../../lib/types';
import { drawOccupancyZonesTexts } from './drawOccupancyZonesTexts';

const { SANS, MONO } = FONTS;
const { REMAINING_TRAINS_BACKGROUND, WHITE_100 } = COLORS;
const REMAINING_TRAINS_WIDTH = 70;
const REMAINING_TRAINS_HEIGHT = 24;
const REMAINING_TEXT_OFFSET = 12;
const BACKGROUND_HEIGHT = 40;
const PATH_SIZE_DEFAULT = 1;
const LABEL_OFFSET_X = 10;
const LABEL_OFFSET_Y = 50;
const OCCUPANCY_OUTLINE_THICKNESS = 4;
const OCCUPANCY_OUTLINE_X_PADDING = 3;
const OCCUPANCY_OUTLINE_OPACITY = 0.15;

const ARROW_OFFSET_X = 1;
const ARROW_OFFSET_Y = 1.5;
const ARROW_WIDTH = 4.5;
const ARROW_TOP_Y = 3.5;
const ARROW_BOTTOM_Y = 6.5;

export const drawThroughTrain = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  // Through trains are materialized by converging arrows like the following ones
  //  ___
  //  \_/
  //  / \
  //  ‾‾‾
  ctx.beginPath();
  // draw the upper part
  ctx.moveTo(x - ARROW_OFFSET_X, y + ARROW_OFFSET_Y);
  ctx.lineTo(x - ARROW_WIDTH, y - ARROW_TOP_Y);
  ctx.lineTo(x + ARROW_WIDTH, y - ARROW_TOP_Y);
  ctx.lineTo(x + ARROW_OFFSET_X, y + ARROW_OFFSET_Y);
  // draw the lower part
  ctx.lineTo(x + ARROW_WIDTH, y + ARROW_BOTTOM_Y);
  ctx.lineTo(x - ARROW_WIDTH, y + ARROW_BOTTOM_Y);
  ctx.lineTo(x - ARROW_OFFSET_X, y + ARROW_OFFSET_Y);
  ctx.fill();
  // draw the white separator in the middle
  ctx.moveTo(x - ARROW_OFFSET_X, y + ARROW_OFFSET_Y);
  ctx.lineTo(x + ARROW_OFFSET_X, y + ARROW_OFFSET_Y);
  ctx.stroke();
};

export const drawRemainingTrainsBox = (
  ctx: CanvasRenderingContext2D,
  { getTimePixel, getSpacePixel }: SpaceTimeChartContextType,
  {
    time,
    position,
    yOffset,
    remainingTrainsNb,
  }: {
    time: number;
    position: number;
    yOffset: number;
    remainingTrainsNb: number;
  }
) => {
  const x = getTimePixel(time);
  const y = getSpacePixel(position) + yOffset;
  const textY = y + OCCUPANCY_ZONE_Y_START - REMAINING_TEXT_OFFSET;

  ctx.fillStyle = REMAINING_TRAINS_BACKGROUND;
  ctx.beginPath();
  ctx.rect(x - REMAINING_TRAINS_WIDTH / 2, textY, REMAINING_TRAINS_WIDTH, REMAINING_TRAINS_HEIGHT);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = WHITE_100;
  ctx.font = SANS;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`+${remainingTrainsNb} trains`, x, textY + REMAINING_TRAINS_HEIGHT / 2);
};

export const drawOccupationZone = (
  ctx: CanvasRenderingContext2D,
  stcContext: SpaceTimeChartContextType,
  {
    zone,
    yOffset,
    position,
  }: {
    zone: OccupancyZone;
    yOffset: number;
    position: number;
  }
) => {
  const { color: curveColor, outline, border, thickness } = zone.curveStyle;

  const curveWidth = zone.connectorStyle?.width ?? PATH_SIZE_DEFAULT;

  const isThroughTrain = zone.startTime === zone.endTime;

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.font = MONO;

  const { getTimePixel, getSpacePixel } = stcContext;
  const yStart = getCrispLineCoordinate(getSpacePixel(position), BACKGROUND_HEIGHT);
  const y = yStart + yOffset;
  const yEnd = getSpacePixel(position, true);
  const arrivalTimePixel = getTimePixel(zone.startTime);
  const departureTimePixel = getTimePixel(zone.endTime);

  if (isThroughTrain) {
    ctx.fillStyle = curveColor;
    ctx.strokeStyle = WHITE_100;
    ctx.lineWidth = 0.5;
    drawThroughTrain(ctx, arrivalTimePixel, y);
  } else {
    const zoneWidth = departureTimePixel - arrivalTimePixel;
    const yCenter = y + OCCUPANCY_ZONE_HEIGHT / 2;
    // Bar is 3px by default, raised to 5px for the active selection.
    const barHeight = thickness ?? OCCUPANCY_ZONE_HEIGHT;

    // Highlight halo behind the bar, only when selected.
    if (outline) {
      // Extend the occupancy by the halo thickness (outline.width) on both sides.
      const haloHeight = barHeight + (outline.width ?? OCCUPANCY_OUTLINE_THICKNESS) * 2;
      ctx.save();
      ctx.globalAlpha = outline.opacity ?? OCCUPANCY_OUTLINE_OPACITY;
      ctx.fillStyle = outline.color;
      ctx.beginPath();
      ctx.roundRect(
        arrivalTimePixel - OCCUPANCY_OUTLINE_X_PADDING,
        yCenter - haloHeight / 2,
        zoneWidth + OCCUPANCY_OUTLINE_X_PADDING * 2,
        haloHeight,
        2
      );
      ctx.fill();
      ctx.restore();
    }

    // Occupancy bar.
    ctx.fillStyle = curveColor;
    ctx.beginPath();
    ctx.rect(arrivalTimePixel, yCenter - barHeight / 2, zoneWidth, barHeight);
    ctx.fill();
    if (border) {
      // When hovering, add a border around the occupancy
      ctx.strokeStyle = border.color;
      ctx.lineWidth = border.width;
      ctx.stroke();
    } else if (!outline) {
      ctx.strokeStyle = WHITE_100;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  // Draw dashed lines linking trains tracks occupancy to their paths on the SpaceTimeChart (when relevant):
  ctx.strokeStyle = curveColor;
  ctx.lineWidth = curveWidth;
  ctx.setLineDash([1, 4]);
  if (zone.startDirection) {
    ctx.beginPath();
    ctx.moveTo(arrivalTimePixel, y);
    ctx.lineTo(arrivalTimePixel, zone.startDirection === 'up' ? yStart : yEnd);
    ctx.stroke();
  }
  if (zone.endDirection) {
    ctx.beginPath();
    ctx.moveTo(departureTimePixel, y);
    ctx.lineTo(departureTimePixel, zone.endDirection === 'up' ? yStart : yEnd);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Draw texts:
  drawOccupancyZonesTexts({
    ctx,
    zone,
    arrivalTimePixel,
    departureTimePixel,
    isThroughTrain,
    yPosition: y,
  });
};

export const drawZoneTrailingText = (
  ctx: CanvasRenderingContext2D,
  { getTimePixel, getSpacePixel }: SpaceTimeChartContextType,
  {
    zone,
    position,
    yOffset,
    trailingText,
  }: {
    zone: OccupancyZone;
    position: number;
    yOffset: number;
    trailingText: string;
  }
) => {
  const xEnd = getTimePixel(zone.endTime) + LABEL_OFFSET_X;
  const yCenter = getSpacePixel(position) + yOffset + OCCUPANCY_ZONE_Y_START - LABEL_OFFSET_Y;

  ctx.save();
  ctx.font = `600 12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const text = trailingText;
  const paddingX = 6;
  const textW = ctx.measureText(text).width;
  const boxW = textW + paddingX * 2;
  const boxH = 18;
  const radius = 3;
  const x = xEnd;
  const yTop = yCenter - boxH / 2;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(x, yTop, boxW, boxH, radius);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(trailingText, x + paddingX, yCenter + 0.5);
  ctx.restore();
};
