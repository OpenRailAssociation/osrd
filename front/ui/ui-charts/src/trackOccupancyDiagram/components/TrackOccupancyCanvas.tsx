import React from 'react';

import OccupancyZonesLayer from './layers/OccupancyZonesLayer';
import TracksLayer from './layers/TracksLayer';
import { type TrackOccupancyCanvasProps } from './types';

const TrackOccupancyCanvas = ({
  opId,
  useDraw,
  setCanvasesRoot,
  selectedTrainId,
  setSelectedTrainId,
  mousePosition,
}: TrackOccupancyCanvasProps) => (
  <div
    id={`track-occupancy-canvas-${opId}`}
    className="bg-white-100 canvas-container"
    ref={setCanvasesRoot}
  >
    <TracksLayer useDraw={useDraw} />
    <OccupancyZonesLayer
      useDraw={useDraw}
      selectedTrainId={selectedTrainId}
      setSelectedTrainId={setSelectedTrainId}
      mousePosition={mousePosition}
    />
  </div>
);

export default TrackOccupancyCanvas;
