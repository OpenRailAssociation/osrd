import { drawOccupancyZonesTexts } from './drawOccupancyZonesTexts';
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

type DrawZone = {
  ctx: CanvasRenderingContext2D;
  arrivalTimePixel: number;
  departureTimePixel: number;
  yPosition: number;
};

const drawDefaultZone = ({ ctx, arrivalTimePixel, departureTimePixel, yPosition }: DrawZone) => {
  ctx.beginPath();
  ctx.rect(
    arrivalTimePixel,
    yPosition,
    departureTimePixel - arrivalTimePixel,
    OCCUPANCY_ZONE_HEIGHT
  );
  ctx.fill();
  ctx.stroke();
};

const ARROW_OFFSET_X = 1;
const ARROW_OFFSET_Y = 1.5;
const ARROW_WIDTH = 4.5;
const ARROW_TOP_Y = 3.5;
const ARROW_BOTTOM_Y = 6.5;

const drawThroughTrain = ({
  ctx,
  arrivalTimePixel,
}: Omit<DrawZone, 'departureTimePixel' | 'yPosition'>) => {
  // Through trains are materialized by converging arrows like the following ones
  //  ___
  //  \_/
  //  / \
  //  ‾‾‾
  ctx.beginPath();
  // draw the upper part
  ctx.moveTo(arrivalTimePixel - ARROW_OFFSET_X, OCCUPANCY_ZONE_Y_START + ARROW_OFFSET_Y);
  ctx.lineTo(arrivalTimePixel - ARROW_WIDTH, OCCUPANCY_ZONE_Y_START - ARROW_TOP_Y);
  ctx.lineTo(arrivalTimePixel + ARROW_WIDTH, OCCUPANCY_ZONE_Y_START - ARROW_TOP_Y);
  ctx.lineTo(arrivalTimePixel + ARROW_OFFSET_X, OCCUPANCY_ZONE_Y_START + ARROW_OFFSET_Y);
  // draw the lower part
  ctx.lineTo(arrivalTimePixel + ARROW_WIDTH, OCCUPANCY_ZONE_Y_START + ARROW_BOTTOM_Y);
  ctx.lineTo(arrivalTimePixel - ARROW_WIDTH, OCCUPANCY_ZONE_Y_START + ARROW_BOTTOM_Y);
  ctx.lineTo(arrivalTimePixel - ARROW_OFFSET_X, OCCUPANCY_ZONE_Y_START + ARROW_OFFSET_Y);
  ctx.fill();
  // draw the white separator in the middle
  ctx.moveTo(arrivalTimePixel - ARROW_OFFSET_X, OCCUPANCY_ZONE_Y_START + ARROW_OFFSET_Y);
  ctx.lineTo(arrivalTimePixel + ARROW_OFFSET_X, OCCUPANCY_ZONE_Y_START + ARROW_OFFSET_Y);
  ctx.stroke();
};

type DrawRemainingTrainsBox = {
  ctx: CanvasRenderingContext2D;
  remainingTrainsNb: number;
  xPosition: number;
};

const drawRemainingTrainsBox = ({ ctx, remainingTrainsNb, xPosition }: DrawRemainingTrainsBox) => {
  const textY = OCCUPANCY_ZONE_Y_START - REMAINING_TEXT_OFFSET;

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

const drawOccupationZone = ({
  ctx,
  zone,
  tracks,
  arrivalTimePixel,
  departureTimePixel,
  yPosition,
  isThroughTrain,
  selectedTrainId,
  setSelectedTrainId,
  xMousePosition,
  yMousePosition,
  index,
}: {
  ctx: CanvasRenderingContext2D;
  zone: OccupancyZone;
  tracks: Track[];
  arrivalTimePixel: number;
  departureTimePixel: number;
  yPosition: number;
  isThroughTrain: boolean;
  selectedTrainId: string;
  setSelectedTrainId: (id: string) => void;
  index: number;
  xMousePosition: number;
  yMousePosition: number;
}) => {
  let currentSelectedTrainId = selectedTrainId;

  const trackN = CANVAS_PADDING + TRACK_HEIGHT_CONTAINER * index + yPosition;
  const canvasHeight = CANVAS_PADDING * 2 + TRACK_HEIGHT_CONTAINER * tracks.length;
  const trackPosition = canvasHeight - trackN;

  const arrowOffset = isThroughTrain ? 4 : 0;

  const xCheck =
    xMousePosition >= arrivalTimePixel - arrowOffset &&
    xMousePosition <= departureTimePixel + arrowOffset;

  const yCheck =
    Math.abs(yMousePosition) >= trackPosition - OCCUPANCY_ZONE_HEIGHT - 1 - arrowOffset &&
    Math.abs(yMousePosition) <= trackPosition + 1 + arrowOffset;

  if (xCheck && yCheck) {
    setSelectedTrainId(zone.id);
    currentSelectedTrainId = zone.id;
  }

  ctx.fillStyle = zone.color;
  ctx.strokeStyle = WHITE_100;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.font = '400 10px IBM Plex Mono';

  if (selectedTrainId === zone.id) {
    const extraWidth = isThroughTrain ? X_TROUGHTRAIN_BACKGROUND_PADDING : X_BACKGROUND_PADDING;
    const originTextLength = ctx.measureText(zone.originStation || '--').width;
    const destinationTextLength = ctx.measureText(zone.destinationStation || '--').width;

    ctx.save();
    ctx.fillStyle = SELECTION_20;
    ctx.beginPath();
    ctx.roundRect(
      arrivalTimePixel - originTextLength - extraWidth,
      yPosition - BACKGROUND_HEIGHT / 2,
      departureTimePixel -
        arrivalTimePixel +
        originTextLength +
        destinationTextLength +
        extraWidth * 2,
      BACKGROUND_HEIGHT,
      SELECTED_TRAIN_ID_GRADIANT
    );
    ctx.fill();
    ctx.restore();
  }

  if (isThroughTrain) {
    drawThroughTrain({ ctx, arrivalTimePixel });
  } else {
    drawDefaultZone({ ctx, arrivalTimePixel, departureTimePixel, yPosition });
  }

  drawOccupancyZonesTexts({
    ctx,
    zone,
    arrivalTimePixel,
    departureTimePixel,
    yPosition,
    isThroughTrain,
    selectedTrainId: currentSelectedTrainId,
  });
};

export const drawOccupancyZones = ({
  ctx,
  width,
  height,
  tracks,
  occupancyZones,
  getTimePixel,
  selectedTrainId,
  setSelectedTrainId,
  mousePosition,
}: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  tracks: Track[] | undefined;
  occupancyZones: OccupancyZone[] | undefined;
  getTimePixel: (time: number) => number;
  selectedTrainId: string;
  setSelectedTrainId: (id: string) => void;
  mousePosition: { x: number; y: number };
}) => {
  ctx.clearRect(0, 0, width, height);
  ctx.save();

  if (!tracks || !occupancyZones || occupancyZones.length === 0) return;

  const sortedOccupancyZones = occupancyZones.sort(
    (a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime()
  );

  tracks.forEach((track, index) => {
    const trackTranslate = index === 0 ? CANVAS_PADDING : TRACK_HEIGHT_CONTAINER;
    ctx.translate(0, trackTranslate);

    const { x: xMousePosition, y: yMousePosition } = mousePosition;

    const filteredOccupancyZones = sortedOccupancyZones.filter((zone) => zone.trackId === track.id);

    let primaryArrivalTimePixel = 0;
    let primaryDepartureTimePixel = 0;
    let lastDepartureTimePixel = primaryDepartureTimePixel;
    let yPosition = OCCUPANCY_ZONE_Y_START;
    let yOffset = Y_OFFSET_INCREMENT;
    let zoneCounter = 0;
    let zoneIndex = 0;

    while (zoneIndex < filteredOccupancyZones.length) {
      const zone = filteredOccupancyZones[zoneIndex];
      const arrivalTimePixel = getTimePixel(zone.arrivalTime.getTime());
      const departureTimePixel = getTimePixel(zone.departureTime.getTime());
      const isThroughTrain = arrivalTimePixel === departureTimePixel;

      // * if the zone is not overlapping with any previous one, draw it in the center of the track
      // * and reset the primary values
      // *
      // * if the zone is overlapping with the previous one, draw it below or above the previous one
      // * depending on the overlapping counter
      // *
      // * if the zone is overlapping with the previous one and the counter is higher than the max zones
      // * draw the remaining trains box
      // *
      if (arrivalTimePixel > lastDepartureTimePixel) {
        // reset to initial value if the zone is not overlapping
        yPosition = OCCUPANCY_ZONE_Y_START;
        primaryArrivalTimePixel = arrivalTimePixel;
        primaryDepartureTimePixel = departureTimePixel;
        lastDepartureTimePixel = departureTimePixel;
        yOffset = Y_OFFSET_INCREMENT;
        zoneCounter = 1;

        drawOccupationZone({
          ctx,
          zone,
          tracks,
          arrivalTimePixel,
          departureTimePixel,
          yPosition,
          isThroughTrain,
          selectedTrainId,
          setSelectedTrainId,
          index,
          xMousePosition,
          yMousePosition,
        });

        zoneIndex++;

        continue;
      }

      if (zoneCounter < MAX_ZONES) {
        // if so and it's an even index, move it to the bottom, if it's an odd index, move it to the top
        if (arrivalTimePixel >= primaryArrivalTimePixel) {
          if (zoneCounter % 2 === 0) {
            yPosition -= yOffset;
          } else {
            yPosition += yOffset;
          }
        }

        // update the last departure time if the current zone is longer
        if (departureTimePixel >= lastDepartureTimePixel)
          lastDepartureTimePixel = departureTimePixel;

        drawOccupationZone({
          ctx,
          zone,
          tracks,
          arrivalTimePixel,
          departureTimePixel,
          yPosition,
          isThroughTrain,
          selectedTrainId,
          setSelectedTrainId,
          index,
          xMousePosition,
          yMousePosition,
        });

        zoneCounter++;
        yOffset += Y_OFFSET_INCREMENT;
        zoneIndex++;

        continue;
      }

      const nextIndex = filteredOccupancyZones.findIndex(
        (filteredZone, i) =>
          i > zoneIndex &&
          getTimePixel(filteredZone.arrivalTime.getTime()) >= lastDepartureTimePixel
      );

      const remainingTrainsNb = nextIndex - zoneIndex;

      const xPosition =
        primaryArrivalTimePixel +
        (lastDepartureTimePixel - primaryArrivalTimePixel) / 2 -
        REMAINING_TRAINS_WIDTH / 2;

      drawRemainingTrainsBox({ ctx, remainingTrainsNb, xPosition });

      zoneIndex += remainingTrainsNb;
    }
  });
  ctx.restore();
};
