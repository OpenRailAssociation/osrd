import React from 'react';

import OccupancyZonesLayer from './layers/OccupancyZonesLayer';
import TracksLayer from './layers/TracksLayer';
import type { OccupancyZone, Track } from './types';

const TrackOccupancyCanvas = ({
  position,
  tracks,
  occupancyZones,
  selectedTrainId,
}: {
  position: number;
  tracks: Track[];
  occupancyZones: OccupancyZone[];
  selectedTrainId?: string;
}) => (
  <>
    <TracksLayer position={position} tracks={tracks} />
    <OccupancyZonesLayer
      tracks={tracks}
      position={position}
      occupancyZones={occupancyZones}
      selectedTrainId={selectedTrainId}
    />
  </>
);

export default TrackOccupancyCanvas;
