import { useCallback, useEffect, useMemo, useState } from 'react';

import { indexToColor } from '../../../common/helpers/colors';
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
import type { BrokenLinking, BrokenLinkingPickingElement, Track } from '../../lib/types';
import {
  BADGE_FONT,
  drawBrokenLinking,
  getBadgeName,
  getBrokenLinkingBadgeGeometry,
} from '../helpers/drawElements/drawBrokenLinkings';
import { getOccupancyZonesY } from '../helpers/drawElements/drawOccupancyZones';

const PICKING_MARGIN = 6;

export function isBrokenLinkingPickingElement(
  element: PickingElement
): element is BrokenLinkingPickingElement {
  return element.type === 'brokenLinking';
}

const BrokenLinkingLayer = ({
  tracks,
  brokenLinkings,
  position,
  topPadding,
  deleteIconUrl,
}: {
  tracks: Track[];
  brokenLinkings: BrokenLinking[];
  position: number;
  topPadding: number;
  deleteIconUrl?: string;
}) => {
  const [imageElement, setImageElement] = useState<HTMLImageElement>();
  // TODO: extract this image loading into a shared ui-charts hook (same as WorkScheduleLayer)
  useEffect(() => {
    if (deleteIconUrl) {
      const newImage = new Image();
      newImage.src = deleteIconUrl;
      newImage.onload = () => {
        setImageElement(newImage);
      };
    }
  }, [deleteIconUrl]);

  // Offscreen context to measure the name width outside of a draw call (needed to
  // size the picking area, which has no 2D context).
  const measureContext = useMemo(() => {
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = BADGE_FONT;
    return context;
  }, []);

  const badges = useMemo(() => {
    const trackIndexById = new Map(tracks.map((track, index) => [track.id, index]));

    return brokenLinkings.map((brokenLinking) => {
      const trackIndex = trackIndexById.get(brokenLinking.trackId);
      if (trackIndex === undefined) {
        throw new Error(
          `Broken linking "${brokenLinking.id}" references unknown track "${brokenLinking.trackId}"`
        );
      }
      const yOffset =
        topPadding + CANVAS_PADDING + trackIndex * TRACK_HEIGHT_CONTAINER + OCCUPANCY_ZONE_Y_START;
      const nameWidth = measureContext.measureText(
        getBadgeName(measureContext, brokenLinking.name)
      ).width;
      return { brokenLinking, yOffset, nameWidth };
    });
  }, [brokenLinkings, topPadding, tracks, measureContext]);

  const hoveredLinkingId = brokenLinkings.find(({ hover }) => hover)?.id;

  const drawingFunction = useCallback<DrawingFunction<SpaceTimeChartContextType>>(
    (ctx, stcContext) => {
      badges.forEach(({ brokenLinking, yOffset }) => {
        const x = stcContext.getTimePixel(brokenLinking.time);
        const yCenter =
          getOccupancyZonesY(stcContext, position) + yOffset + OCCUPANCY_ZONE_HEIGHT / 2;
        const highlighted = brokenLinking.id === hoveredLinkingId;
        // only the hovered badge shows the delete icon
        const showDelete = !!brokenLinking.hover;

        drawBrokenLinking(ctx, {
          x,
          yCenter,
          brokenLinking,
          highlighted,
          icon: showDelete ? imageElement : undefined,
        });
      });
    },
    [badges, position, hoveredLinkingId, imageElement]
  );

  const pickingFunction = useCallback<PickingDrawingFunction<SpaceTimeChartContextType>>(
    (imageData, { registerPickingElement, getTimePixel, getSpacePixel }, scalingRatio) => {
      badges.forEach(({ brokenLinking, yOffset, nameWidth }) => {
        const x = getTimePixel(brokenLinking.time);
        const yCenter =
          getOccupancyZonesY({ getSpacePixel }, position) + yOffset + OCCUPANCY_ZONE_HEIGHT / 2;
        const { boxLeft, boxTop, boxWidth, boxHeight } = getBrokenLinkingBadgeGeometry({
          x,
          yCenter,
          direction: brokenLinking.direction,
          highlighted: false,
          showDelete: false,
          nameWidth,
        });

        const pickingElement: BrokenLinkingPickingElement = {
          type: 'brokenLinking',
          brokenLinkingId: brokenLinking.id,
          direction: brokenLinking.direction,
        };
        const pickingIndex = registerPickingElement(pickingElement);
        const color = indexToColor(pickingIndex);

        drawAliasedRect(
          imageData,
          { x: boxLeft - PICKING_MARGIN, y: boxTop - PICKING_MARGIN },
          boxWidth + 2 * PICKING_MARGIN,
          boxHeight + 2 * PICKING_MARGIN,
          color,
          scalingRatio
        );
      });
    },
    [badges, position]
  );

  usePicking(SpaceTimeChartCanvasContext, 'paths', pickingFunction);
  useDraw(SpaceTimeChartCanvasContext, 'paths', drawingFunction);

  return null;
};

export default BrokenLinkingLayer;
