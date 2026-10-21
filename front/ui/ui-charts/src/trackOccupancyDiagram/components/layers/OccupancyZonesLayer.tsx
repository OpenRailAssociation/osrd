import { useCallback, useMemo } from 'react';

import { sortBy } from 'lodash';

import { TimeChartCanvasContext } from '../../../common/context';
import { indexToColor } from '../../../common/helpers/colors';
import { drawAliasedRect } from '../../../common/helpers/utils';
import { useDraw, usePicking } from '../../../common/hooks/useCanvas';
import type {
  DrawingFunction,
  PickingDrawingFunction,
  PickingElement,
  TimeChartContextType,
} from '../../../common/types';
import {
  CANVAS_PADDING,
  OCCUPANCY_ZONE_HEIGHT,
  OCCUPANCY_ZONE_Y_START,
  TRACK_HEIGHT_CONTAINER,
} from '../../lib/consts';
import type { OccupancyZone, OccupancyZonePickingElement, Track } from '../../lib/types';
import {
  drawOccupationZone,
  drawRemainingTrainsBox,
  drawZoneTrailingText,
} from '../helpers/drawElements/drawOccupancyZones';

type RenderingInstruction =
  | {
      type: 'occupancyZone';
      zone: OccupancyZone;
      offsetY: number;
      trailingText?: string;
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
  top,
  height,
  topPadding,
}: {
  tracks: Track[];
  occupancyZones: OccupancyZone[];
  top: number;
  height: number;
  topPadding: number;
}) => {
  const instructionsToDraw = useMemo(() => {
    const instructions: RenderingInstruction[] = [];

    if (!tracks || !occupancyZones || occupancyZones.length === 0) return instructions;

    const sortedOccupancyZones = occupancyZones.toSorted((a, b) => a.startTime - b.startTime);

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
        // a zone taking the track when the previous one leaves it is adjacent, not overlapping
        if (startTime >= lastEndTime) {
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
            trailingText: zone.trailingText,
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

          // nextIndex === -1 means all remaining zones overlap — skip to the end
          const endIndex = nextIndex === -1 ? filteredOccupancyZones.length : nextIndex;
          const remainingTrainsNb = endIndex - zoneIndex;

          instructions.push({
            type: 'remainingTrains',
            amount: remainingTrainsNb,
            time: (startTime + endTime) / 2,
            offsetY: trackY,
          });

          zoneIndex = endIndex;
        }
      }
    });

    return sortBy(instructions, (instruction) =>
      instruction.type === 'occupancyZone' && instruction.zone.curveStyle.outline ? 0 : 1
    );
  }, [occupancyZones, topPadding, tracks]);

  const drawingFunction = useCallback<DrawingFunction<TimeChartContextType>>(
    (ctx, tcContext) => {
      instructionsToDraw.forEach((instruction) => {
        switch (instruction.type) {
          case 'occupancyZone': {
            drawOccupationZone(ctx, tcContext, {
              zone: instruction.zone,
              top,
              height,
              yOffset: instruction.offsetY,
            });
            if (instruction.trailingText) {
              drawZoneTrailingText(ctx, tcContext, {
                zone: instruction.zone,
                top,
                yOffset: instruction.offsetY,
                trailingText: instruction.trailingText,
              });
            }
            break;
          }
          case 'remainingTrains':
            drawRemainingTrainsBox(ctx, tcContext, {
              top,
              time: instruction.time,
              yOffset: instruction.offsetY,
              remainingTrainsNb: instruction.amount,
            });
            break;
        }
      });
    },
    [top, height, instructionsToDraw]
  );

  const pickingFunction = useCallback<PickingDrawingFunction<TimeChartContextType>>(
    (imageData, { registerPickingElement, getTimePixel }, scalingRatio) => {
      const flatStepOffsetY = top;
      const flatStepEndY = top + height;

      instructionsToDraw.forEach((instruction) => {
        if (instruction.type === 'occupancyZone') {
          const x = getTimePixel(instruction.zone.startTime);
          const y = instruction.offsetY + flatStepOffsetY;
          const zoneWidth = getTimePixel(instruction.zone.endTime) - x;
          const zoneHeight = OCCUPANCY_ZONE_HEIGHT;
          const margin = 6;

          const pickingElement: OccupancyZonePickingElement = {
            type: 'occupancyZone',
            pathId: instruction.zone.pathId,
          };
          const pickingIndex = registerPickingElement(pickingElement);
          const color = indexToColor(pickingIndex);

          drawAliasedRect(
            imageData,
            { x: x - margin, y: y - margin },
            zoneWidth + 2 * margin,
            zoneHeight + 2 * margin,
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
              { x: x + zoneWidth - margin, y: yStart - margin },
              2 * margin,
              yStop - yStart + 2 * margin,
              color,
              scalingRatio
            );
          }
        }
      });
    },
    [top, height, instructionsToDraw]
  );

  usePicking(TimeChartCanvasContext, 'paths', pickingFunction);
  useDraw(TimeChartCanvasContext, 'paths', drawingFunction);

  return null;
};

export default OccupancyZonesLayer;
