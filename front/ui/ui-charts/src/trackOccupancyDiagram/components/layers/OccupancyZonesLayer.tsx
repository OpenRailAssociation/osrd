import { useCallback, useMemo } from 'react';

import { sortBy } from 'lodash';

import {
  useDraw,
  type DrawingFunction,
  type PickingDrawingFunction,
  usePicking,
  type PickingElement,
} from '../../../spaceTimeChart';
import { drawAliasedRect } from '../../../spaceTimeChart/utils/canvas';
import { hexToRgb, indexToColor } from '../../../spaceTimeChart/utils/colors';
import {
  CANVAS_PADDING,
  OCCUPANCY_ZONE_HEIGHT,
  OCCUPANCY_ZONE_Y_START,
  TRACK_HEIGHT_CONTAINER,
} from '../consts';
import {
  drawOccupationZone,
  drawRemainingTrainsBox,
} from '../helpers/drawElements/drawOccupancyZones';
import type { OccupancyZone, OccupancyZonePickingElement, Track } from '../types';

type RenderingInstruction =
  | {
      type: 'occupancyZone';
      zone: OccupancyZone;
      isSelected: boolean;
      offsetY: number;
    }
  | {
      type: 'remainingTrains';
      amount: number;
      time: number;
      offsetY: number;
    };

const Y_OFFSET_INCREMENT = 4;
const MAX_ZONES = 9;

export function isOccupancyPickingElement(
  element: PickingElement
): element is OccupancyZonePickingElement {
  return element.type === 'occupancyZone';
}

const OccupancyZonesLayer = ({
  tracks,
  occupancyZones,
  position,
  topPadding,
  selectedTrainId,
}: {
  tracks: Track[];
  occupancyZones: OccupancyZone[];
  position: number;
  topPadding: number;
  selectedTrainId?: string;
}) => {
  const instructionsToDraw = useMemo(() => {
    const instructions: RenderingInstruction[] = [];

    if (!tracks || !occupancyZones || occupancyZones.length === 0) return instructions;

    const sortedOccupancyZones = occupancyZones.sort((a, b) => a.startTime - b.startTime);

    tracks.forEach((track, index) => {
      const trackY = topPadding + CANVAS_PADDING + index * TRACK_HEIGHT_CONTAINER;

      const filteredOccupancyZones = sortedOccupancyZones.filter(
        (zone) => zone.trackId === track.id
      );

      let primaryStartTime = 0;
      let lastEndTime = 0;
      let yPosition = OCCUPANCY_ZONE_Y_START;
      let yOffset = Y_OFFSET_INCREMENT;
      let zoneCounter = 0;
      let zoneIndex = 0;

      while (zoneIndex < filteredOccupancyZones.length) {
        const zone = filteredOccupancyZones[zoneIndex];
        const { startTime, endTime } = zone;

        // * if the zone is not overlapping with any previous one, draw it in the center of the track
        // * and reset the primary values
        // *
        // * if the zone is overlapping with the previous one, draw it below or above the previous one
        // * depending on the overlapping counter
        // *
        // * if the zone is overlapping with the previous one and the counter is higher than the max zones
        // * draw the remaining trains box
        // *
        if (startTime > lastEndTime) {
          // reset to initial value if the zone is not overlapping
          yPosition = OCCUPANCY_ZONE_Y_START;
          primaryStartTime = startTime;
          lastEndTime = endTime;
          yOffset = Y_OFFSET_INCREMENT;
          zoneCounter = 1;

          instructions.push({
            type: 'occupancyZone',
            zone,
            offsetY: trackY + yPosition,
            isSelected: zone.trainId === selectedTrainId,
          });

          zoneIndex++;
        }

        // if so and it's an even index, move it to the bottom, if it's an odd index, move it to the top
        else if (zoneCounter < MAX_ZONES) {
          if (startTime >= primaryStartTime) {
            if (zoneCounter % 2 === 0) {
              yPosition -= yOffset;
            } else {
              yPosition += yOffset;
            }
          }

          // update the last departure time if the current zone is longer
          if (endTime >= lastEndTime) lastEndTime = endTime;

          instructions.push({
            type: 'occupancyZone',
            zone,
            offsetY: trackY + yPosition,
            isSelected: zone.trainId === selectedTrainId,
          });

          zoneCounter++;
          yOffset += Y_OFFSET_INCREMENT;
          zoneIndex++;
        }

        // else, if there are too much trains:
        else {
          const nextIndex = filteredOccupancyZones.findIndex(
            (filteredZone, i) => i > zoneIndex && filteredZone.startTime >= lastEndTime
          );

          const remainingTrainsNb = nextIndex - zoneIndex;

          instructions.push({
            type: 'remainingTrains',
            amount: remainingTrainsNb,
            time: (startTime + endTime) / 2,
            offsetY: trackY,
          });

          zoneIndex += remainingTrainsNb;
        }
      }
    });

    return sortBy(instructions, (instruction) =>
      instruction.type === 'occupancyZone' && instruction.isSelected ? 0 : 1
    );
  }, [occupancyZones, selectedTrainId, topPadding, tracks]);

  const drawingFunction = useCallback<DrawingFunction>(
    (ctx, stcContext) => {
      instructionsToDraw.forEach((instruction) => {
        switch (instruction.type) {
          case 'occupancyZone':
            drawOccupationZone(ctx, stcContext, {
              zone: instruction.zone,
              position,
              yOffset: instruction.offsetY,
              isSelected: instruction.isSelected,
            });
            break;
          case 'remainingTrains':
            drawRemainingTrainsBox(ctx, stcContext, {
              position,
              time: instruction.time,
              yOffset: instruction.offsetY,
              remainingTrainsNb: instruction.amount,
            });
            break;
        }
      });
    },
    [position, instructionsToDraw]
  );

  const pickingFunction = useCallback<PickingDrawingFunction>(
    (imageData, { registerPickingElement, getTimePixel, getSpacePixel }, scalingRatio) => {
      const flatStepOffsetY = getSpacePixel(position);
      const flatStepEndY = getSpacePixel(position, true);

      instructionsToDraw.forEach((instruction) => {
        if (instruction.type === 'occupancyZone') {
          const x = getTimePixel(instruction.zone.startTime);
          const y = instruction.offsetY + flatStepOffsetY;
          const width = getTimePixel(instruction.zone.endTime) - x;
          const height = OCCUPANCY_ZONE_HEIGHT;
          const margin = 6;

          const pickingElement: OccupancyZonePickingElement = {
            type: 'occupancyZone',
            pathId: instruction.zone.trainId,
          };
          const pickingIndex = registerPickingElement(pickingElement);
          const color = hexToRgb(indexToColor(pickingIndex));

          drawAliasedRect(
            imageData,
            { x: x - margin, y: y - margin },
            width + 2 * margin,
            height + 2 * margin,
            color,
            scalingRatio
          );

          if (instruction.zone.startDirection) {
            const yStart = instruction.zone.startDirection === 'up' ? flatStepOffsetY : y;
            const yStop = instruction.zone.startDirection === 'up' ? y : flatStepEndY;
            drawAliasedRect(
              imageData,
              { x: x - margin, y: yStart - margin },
              2 * margin,
              yStop - yStart + 2 * margin,
              color,
              scalingRatio
            );
          }
          if (instruction.zone.endDirection) {
            const yStart = instruction.zone.endDirection === 'up' ? flatStepOffsetY : y;
            const yStop = instruction.zone.endDirection === 'up' ? y : flatStepEndY;
            drawAliasedRect(
              imageData,
              { x: x + width - margin, y: yStart - margin },
              2 * margin,
              yStop - yStart + 2 * margin,
              color,
              scalingRatio
            );
          }
        }
      });
    },
    [position, instructionsToDraw]
  );

  usePicking('overlay', pickingFunction);
  useDraw('overlay', drawingFunction);

  return null;
};

export default OccupancyZonesLayer;
