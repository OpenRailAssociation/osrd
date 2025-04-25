import { drawOccupancyZonesTexts } from './drawOccupancyZonesTexts';
import type { SpaceTimeChartContextType } from '../../../../spaceTimeChart';
import {
  TRACK_HEIGHT_CONTAINER,
  CANVAS_PADDING,
  OCCUPANCY_ZONE_Y_START,
  OCCUPANCY_ZONE_HEIGHT,
  FONTS,
  COLORS,
} from '../../consts';
import type { OccupancyZone, Track } from '../../types';

const { SANS } = FONTS;
const { REMAINING_TRAINS_BACKGROUND, WHITE_100, SELECTION_20 } = COLORS;
const REMAINING_TRAINS_WIDTH = 70;
const REMAINING_TRAINS_HEIGHT = 24;
const REMAINING_TEXT_OFFSET = 12;
const Y_OFFSET_INCREMENT = 4;
const MAX_ZONES = 9;
const X_BACKGROUND_PADDING = 4;
const X_TROUGHTRAIN_BACKGROUND_PADDING = 8;
const BACKGROUND_HEIGHT = 40;
const SELECTED_TRAIN_ID_GRADIANT = 2;

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

const drawRemainingTrainsBox = ({
  ctx,
  remainingTrainsNb,
  xPosition,
  yPosition,
}: {
  ctx: CanvasRenderingContext2D;
  remainingTrainsNb: number;
  xPosition: number;
  yPosition: number;
}) => {
  const textY = yPosition + OCCUPANCY_ZONE_Y_START - REMAINING_TEXT_OFFSET;

  ctx.fillStyle = REMAINING_TRAINS_BACKGROUND;
  ctx.beginPath();
  ctx.rect(xPosition, textY, REMAINING_TRAINS_WIDTH, REMAINING_TRAINS_HEIGHT);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = WHITE_100;
  ctx.font = SANS;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `+${remainingTrainsNb} trains`,
    xPosition + REMAINING_TRAINS_WIDTH / 2,
    textY + REMAINING_TRAINS_HEIGHT / 2
  );
};

const drawOccupationZone = (
  ctx: CanvasRenderingContext2D,
  stcContext: SpaceTimeChartContextType,
  {
    zone,
    position,
    yZone,
    selectedTrainId,
  }: {
    zone: OccupancyZone;
    position: number;
    yZone: number;
    selectedTrainId?: string;
  }
) => {
  const isThroughTrain = zone.arrivalTime === zone.departureTime;

  ctx.fillStyle = zone.color;
  ctx.strokeStyle = WHITE_100;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.font = '400 10px IBM Plex Mono';

  const { getTimePixel, getSpacePixel } = stcContext;
  const yStart = getSpacePixel(position);
  const yEnd = getSpacePixel(position, true);
  const arrivalTimePixel = getTimePixel(zone.arrivalTime);
  const departureTimePixel = getTimePixel(zone.departureTime);

  if (selectedTrainId === zone.trainId) {
    const extraWidth = isThroughTrain ? X_TROUGHTRAIN_BACKGROUND_PADDING : X_BACKGROUND_PADDING;
    const originTextLength = ctx.measureText(zone.originStation || '--').width;
    const destinationTextLength = ctx.measureText(zone.destinationStation || '--').width;

    ctx.fillStyle = SELECTION_20;
    ctx.beginPath();
    ctx.roundRect(
      arrivalTimePixel - originTextLength - extraWidth,
      yZone - BACKGROUND_HEIGHT / 2,
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

  if (isThroughTrain) {
    drawThroughTrain(ctx, arrivalTimePixel, yZone);
  } else {
    drawDefaultZone(ctx, {
      x: arrivalTimePixel,
      y: yZone,
      width: departureTimePixel - arrivalTimePixel,
    });
  }

  // Draw trains:
  ctx.strokeStyle = zone.color;
  ctx.lineWidth = 1;
  ctx.setLineDash([1, 4]);
  if (zone.arrivalDirection) {
    ctx.beginPath();
    ctx.moveTo(arrivalTimePixel, yZone);
    ctx.lineTo(arrivalTimePixel, zone.arrivalDirection === 'up' ? yStart : yEnd);
    ctx.stroke();
  }
  if (zone.departureDirection) {
    ctx.beginPath();
    ctx.moveTo(departureTimePixel, yZone);
    ctx.lineTo(departureTimePixel, zone.departureDirection === 'up' ? yStart : yEnd);
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
    selectedTrainId,
    yPosition: yZone,
  });
};

export const drawOccupancyZones = (
  ctx: CanvasRenderingContext2D,
  stcContext: SpaceTimeChartContextType,
  {
    occupancyZones,
    tracks,
    position,
    selectedTrainId,
  }: {
    occupancyZones: OccupancyZone[];
    tracks: Track[];
    position: number;
    selectedTrainId?: string;
  }
) => {
  if (!tracks || !occupancyZones || occupancyZones.length === 0) return;

  const { getTimePixel, getSpacePixel } = stcContext;
  const baseY = getSpacePixel(position);

  const sortedOccupancyZones = occupancyZones.sort((a, b) => a.arrivalTime - b.arrivalTime);

  tracks.forEach((track, index) => {
    const trackY = baseY + CANVAS_PADDING + index * TRACK_HEIGHT_CONTAINER;

    const filteredOccupancyZones = sortedOccupancyZones.filter((zone) => zone.trackId === track.id);

    let primaryArrivalTime = 0;
    let primaryDepartureTime = 0;
    let lastDepartureTime = primaryDepartureTime;
    let yPosition = OCCUPANCY_ZONE_Y_START;
    let yOffset = Y_OFFSET_INCREMENT;
    let zoneCounter = 0;
    let zoneIndex = 0;

    while (zoneIndex < filteredOccupancyZones.length) {
      const zone = filteredOccupancyZones[zoneIndex];
      const { arrivalTime, departureTime } = zone;

      // * if the zone is not overlapping with any previous one, draw it in the center of the track
      // * and reset the primary values
      // *
      // * if the zone is overlapping with the previous one, draw it below or above the previous one
      // * depending on the overlapping counter
      // *
      // * if the zone is overlapping with the previous one and the counter is higher than the max zones
      // * draw the remaining trains box
      // *
      if (arrivalTime > lastDepartureTime) {
        // reset to initial value if the zone is not overlapping
        yPosition = OCCUPANCY_ZONE_Y_START;
        primaryArrivalTime = arrivalTime;
        primaryDepartureTime = departureTime;
        lastDepartureTime = departureTime;
        yOffset = Y_OFFSET_INCREMENT;
        zoneCounter = 1;

        drawOccupationZone(ctx, stcContext, {
          zone,
          position,
          selectedTrainId,
          yZone: trackY + yPosition,
        });

        zoneIndex++;

        continue;
      }

      if (zoneCounter < MAX_ZONES) {
        // if so and it's an even index, move it to the bottom, if it's an odd index, move it to the top
        if (arrivalTime >= primaryArrivalTime) {
          if (zoneCounter % 2 === 0) {
            yPosition -= yOffset;
          } else {
            yPosition += yOffset;
          }
        }

        // update the last departure time if the current zone is longer
        if (departureTime >= lastDepartureTime) lastDepartureTime = departureTime;

        drawOccupationZone(ctx, stcContext, {
          zone,
          position,
          yZone: trackY + yPosition,
          selectedTrainId,
        });

        zoneCounter++;
        yOffset += Y_OFFSET_INCREMENT;
        zoneIndex++;

        continue;
      }

      const nextIndex = filteredOccupancyZones.findIndex(
        (filteredZone, i) => i > zoneIndex && filteredZone.arrivalTime >= lastDepartureTime
      );

      const remainingTrainsNb = nextIndex - zoneIndex;

      const xPosition =
        getTimePixel((primaryArrivalTime + lastDepartureTime) / 2) - REMAINING_TRAINS_WIDTH / 2;

      drawRemainingTrainsBox({ ctx, remainingTrainsNb, xPosition, yPosition: trackY });

      zoneIndex += remainingTrainsNb;
    }
  });
};
