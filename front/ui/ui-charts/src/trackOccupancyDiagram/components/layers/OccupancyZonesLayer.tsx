import { useCallback } from 'react';

import { type LayerType, type DrawingFunction } from '../../../spaceTimeChart/lib/types';
import { drawOccupancyZones } from '../helpers/drawElements/drawOccupancyZones';

const OccupancyZonesLayer = ({
  useDraw,
  selectedTrainId,
  setSelectedTrainId,
  mousePosition,
}: {
  useDraw: (layer: LayerType, fn: DrawingFunction) => void;
  selectedTrainId: string;
  setSelectedTrainId: (id: string) => void;
  mousePosition: { x: number; y: number };
}) => {
  const drawingFunction = useCallback<DrawingFunction>(
    (ctx, { getTimePixel, tracks, occupancyZones, trackOccupancyWidth, trackOccupancyHeight }) => {
      if (trackOccupancyHeight && trackOccupancyWidth)
        drawOccupancyZones({
          ctx,
          width: trackOccupancyWidth,
          height: trackOccupancyHeight,
          tracks,
          occupancyZones,
          getTimePixel,
          selectedTrainId,
          setSelectedTrainId,
          mousePosition,
        });
    },
    [mousePosition, selectedTrainId, setSelectedTrainId]
  );

  useDraw('paths', drawingFunction);

  return null;
};

export default OccupancyZonesLayer;
