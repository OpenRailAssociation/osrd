import { useCallback } from 'react';

import { useDraw, type DrawingFunction } from '../../../spaceTimeChart';
import { drawOccupancyZones } from '../helpers/drawElements/drawOccupancyZones';
import type { OccupancyZone, Track } from '../types';

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
  const drawingFunction = useCallback<DrawingFunction>(
    (ctx, stcContext) => {
      drawOccupancyZones(ctx, stcContext, {
        tracks,
        occupancyZones,
        selectedTrainId,
        position,
        topPadding,
      });
    },
    [occupancyZones, position, selectedTrainId, topPadding, tracks]
  );

  useDraw('overlay', drawingFunction);

  return null;
};

export default OccupancyZonesLayer;
