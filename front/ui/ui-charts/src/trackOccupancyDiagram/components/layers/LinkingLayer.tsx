import { useCallback, useMemo } from 'react';

import { hexToRgb, indexToColor } from '../../../common/helpers/colors';
import { drawAliasedRect } from '../../../common/helpers/utils';
import { useDraw, usePicking } from '../../../common/hooks/useCanvas';
import type {
  DrawingFunction,
  PickingDrawingFunction,
  PickingElement,
} from '../../../common/types';
import {
  SpaceTimeChartCanvasContext,
  type SpaceTimeChartContextType,
} from '../../../spaceTimeChart';
import {
  CANVAS_PADDING,
  OCCUPANCY_ZONE_HEIGHT,
  OCCUPANCY_ZONE_Y_START,
  TRACK_HEIGHT_CONTAINER,
} from '../../lib/consts';
import type { Linking, LinkingPickingElement, Track } from '../../lib/types';
import { drawLinking } from '../helpers/drawElements/drawLinkings';
import { getOccupancyZonesY } from '../helpers/drawElements/drawOccupancyZones';

const PICKING_MARGIN = 6;

export function isLinkingPickingElement(element: PickingElement): element is LinkingPickingElement {
  return element.type === 'linking';
}

const LinkingLayer = ({
  tracks,
  linkings,
  position,
  topPadding,
}: {
  tracks: Track[];
  linkings: Linking[];
  position: number;
  topPadding: number;
}) => {
  const linkingsToDraw = useMemo(() => {
    const trackIndexById = new Map(tracks.map((track, index) => [track.id, index]));

    return linkings.map((linking) => {
      const trackIndex = trackIndexById.get(linking.trackId);
      if (trackIndex === undefined) {
        throw new Error(`Linking "${linking.id}" references unknown track "${linking.trackId}"`);
      }
      const yOffset =
        topPadding + CANVAS_PADDING + trackIndex * TRACK_HEIGHT_CONTAINER + OCCUPANCY_ZONE_Y_START;
      return { linking, yOffset };
    });
  }, [linkings, topPadding, tracks]);

  const drawingFunction = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, stcContext) => {
      linkingsToDraw.forEach(({ linking, yOffset }) => {
        drawLinking(ctx, stcContext, { linking, position, yOffset });
      });
    },
    [position, linkingsToDraw]
  );

  const pickingFunction = useCallback<PickingDrawingFunction<SpaceTimeChartContextType>>(
    (imageData, { registerPickingElement, getTimePixel, getSpacePixel }, scalingRatio) => {
      linkingsToDraw.forEach(({ linking, yOffset }) => {
        const x = getTimePixel(linking.startTime);
        const y = getOccupancyZonesY({ getSpacePixel }, position) + yOffset;
        const width = getTimePixel(linking.endTime) - x;

        const pickingElement: LinkingPickingElement = {
          type: 'linking',
          linkingId: linking.id,
        };
        const pickingIndex = registerPickingElement(pickingElement);
        const color = hexToRgb(indexToColor(pickingIndex));

        drawAliasedRect(
          imageData,
          { x: x - PICKING_MARGIN, y: y - PICKING_MARGIN },
          width + 2 * PICKING_MARGIN,
          OCCUPANCY_ZONE_HEIGHT + 2 * PICKING_MARGIN,
          color,
          scalingRatio
        );
      });
    },
    [position, linkingsToDraw]
  );

  usePicking(SpaceTimeChartCanvasContext, 'paths', pickingFunction);
  useDraw(SpaceTimeChartCanvasContext, 'paths', drawingFunction);

  return null;
};

export default LinkingLayer;
