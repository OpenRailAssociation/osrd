import { useCallback } from 'react';

import { useDraw, type DrawingFunction } from '../../../spaceTimeChart';
import { drawOccupancyZones } from '../helpers/drawElements/drawOccupancyZones';
import type { OccupancyZone, Track } from '../types';

const OccupancyZonesLayer = ({
  tracks,
  occupancyZones,
  position,
  selectedTrainId,
}: {
  tracks: Track[];
  occupancyZones: OccupancyZone[];
  position: number;
  selectedTrainId?: string;
}) => {
  const drawingFunction = useCallback<DrawingFunction>(
    (ctx, stcContext) => {
      drawOccupancyZones(ctx, stcContext, {
        tracks,
        occupancyZones,
        selectedTrainId,
        position,
      });
    },
    [occupancyZones, position, selectedTrainId, tracks]
  );

  useDraw('overlay', drawingFunction);

  return null;
};

export default OccupancyZonesLayer;
