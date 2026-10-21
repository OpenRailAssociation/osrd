import { useCallback, useMemo } from 'react';

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
import type { Linking, LinkingPickingElement, Track } from '../../lib/types';
import { drawLinking, getLinkingXRange } from '../helpers/drawElements/drawLinkings';
import { getOccupancyZonesY } from '../helpers/drawElements/drawOccupancyZones';

const PICKING_MARGIN = 6;

export function isLinkingPickingElement(element: PickingElement): element is LinkingPickingElement {
  return element.type === 'linking';
}

const LinkingLayer = ({
  tracks,
  linkings,
  top,
  topPadding,
}: {
  tracks: Track[];
  linkings: Linking[];
  top: number;
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

  const drawingFunction = useCallback<DrawingFunction<TimeChartContextType>>(
    (ctx, tcContext) => {
      linkingsToDraw.forEach(({ linking, yOffset }) => {
        drawLinking(ctx, tcContext, { linking, top, yOffset });
      });
    },
    [top, linkingsToDraw]
  );

  const pickingFunction = useCallback<PickingDrawingFunction<TimeChartContextType>>(
    (imageData, { registerPickingElement, getTimePixel }, scalingRatio) => {
      linkingsToDraw.forEach(({ linking, yOffset }) => {
        const { x1, x2 } = getLinkingXRange({ getTimePixel }, linking);
        const y = getOccupancyZonesY(top) + yOffset;
        const width = x2 - x1;

        const pickingElement: LinkingPickingElement = {
          type: 'linking',
          linkingId: linking.id,
        };
        const pickingIndex = registerPickingElement(pickingElement);
        const color = indexToColor(pickingIndex);

        drawAliasedRect(
          imageData,
          { x: x1 - PICKING_MARGIN, y: y - PICKING_MARGIN },
          width + 2 * PICKING_MARGIN,
          OCCUPANCY_ZONE_HEIGHT + 2 * PICKING_MARGIN,
          color,
          scalingRatio
        );
      });
    },
    [top, linkingsToDraw]
  );

  usePicking(TimeChartCanvasContext, 'paths', pickingFunction);
  useDraw(TimeChartCanvasContext, 'paths', drawingFunction);

  return null;
};

export default LinkingLayer;
