import { drawOccupancyZonesTexts } from './drawOccupancyZonesTexts';
import { PATH_COLOR_DEFAULT } from '../../../../manchette/consts';
import { getCrispLineCoordinate, type SpaceTimeChartContextType } from '../../../../spaceTimeChart';
import { OCCUPANCY_ZONE_Y_START, OCCUPANCY_ZONE_HEIGHT, FONTS, COLORS } from '../../consts';
import type { OccupancyZone } from '../../types';

const { SANS } = FONTS;
const { REMAINING_TRAINS_BACKGROUND, WHITE_100, SELECTION_20 } = COLORS;
const REMAINING_TRAINS_WIDTH = 70;
const REMAINING_TRAINS_HEIGHT = 24;
const REMAINING_TEXT_OFFSET = 12;
const X_BACKGROUND_PADDING = 4;
const X_TROUGHTRAIN_BACKGROUND_PADDING = 8;
const BACKGROUND_HEIGHT = 40;
const SELECTED_TRAIN_ID_GRADIANT = 2;
const PATH_SIZE_DEFAULT = 1;

const drawDefaultZone = (
  ctx: CanvasRenderingContext2D,
  { x, y, width }: { x: number; y: number; width: number }
) => {
  ctx.beginPath();
  ctx.rect(x, y, width, OCCUPANCY_ZONE_HEIGHT);
  ctx.fill();
  ctx.stroke();
};

const ARROW_OFFSET_X = 1;
const ARROW_OFFSET_Y = 1.5;
const ARROW_WIDTH = 4.5;
const ARROW_TOP_Y = 3.5;
const ARROW_BOTTOM_Y = 6.5;

const drawThroughTrain = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
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
    isSelected,
  }: {
    zone: OccupancyZone;
    yOffset: number;
    position: number;
    isSelected?: boolean;
  }
) => {
  const size = zone.size || PATH_SIZE_DEFAULT;
  const color = zone.color || PATH_COLOR_DEFAULT;
  const isThroughTrain = zone.startTime === zone.endTime;

  ctx.fillStyle = color;
  ctx.strokeStyle = WHITE_100;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.font = '400 10px IBM Plex Mono';

  const { getTimePixel, getSpacePixel } = stcContext;
  const yStart = getCrispLineCoordinate(getSpacePixel(position), BACKGROUND_HEIGHT);
  const y = yStart + yOffset;
  const yEnd = getSpacePixel(position, true);
  const arrivalTimePixel = getTimePixel(zone.startTime);
  const departureTimePixel = getTimePixel(zone.endTime);

  if (isSelected) {
    const extraWidth = isThroughTrain ? X_TROUGHTRAIN_BACKGROUND_PADDING : X_BACKGROUND_PADDING;
    const originTextLength = ctx.measureText(zone.originStation || '--').width;
    const destinationTextLength = ctx.measureText(zone.destinationStation || '--').width;

    ctx.fillStyle = SELECTION_20;
    ctx.beginPath();
    ctx.roundRect(
      arrivalTimePixel - originTextLength - extraWidth,
      y - BACKGROUND_HEIGHT / 2,
      departureTimePixel -
        arrivalTimePixel +
        originTextLength +
        destinationTextLength +
        extraWidth * 2,
      BACKGROUND_HEIGHT,
      SELECTED_TRAIN_ID_GRADIANT
    );
    ctx.fill();
  }

  ctx.fillStyle = color;
  if (isThroughTrain) {
    drawThroughTrain(ctx, arrivalTimePixel, y);
  } else {
    drawDefaultZone(ctx, {
      x: arrivalTimePixel,
      y,
      width: departureTimePixel - arrivalTimePixel,
    });
  }

  // Draw dashed lines linking trains tracks occupancy to their paths on the SpaceTimeChart (when relevant):
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
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
    isSelected,
  });
};
