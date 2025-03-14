import { useCallback } from 'react';

import { type LayerType, type DrawingFunction } from '../../../spaceTimeChart/lib/types';
import { drawTracks } from '../helpers/drawElements/drawTracks';

const TracksLayer = ({ useDraw }: { useDraw: (layer: LayerType, fn: DrawingFunction) => void }) => {
  const drawingFunction = useCallback<DrawingFunction>(
    (
      ctx,
      {
        timeOrigin,
        timePixelOffset,
        getTimePixel,
        tracks,
        trackOccupancyWidth,
        trackOccupancyHeight,
        timeScale,
        theme: { timeRanges, breakpoints },
      }
    ) => {
      if (trackOccupancyHeight && trackOccupancyWidth)
        drawTracks({
          ctx,
          width: trackOccupancyWidth,
          height: trackOccupancyHeight,
          tracks,
          timeOrigin,
          timePixelOffset,
          getTimePixel,
          timeRanges,
          breakpoints,
          timeScale,
        });
    },
    []
  );

  useDraw('background', drawingFunction);

  return null;
};

export default TracksLayer;
