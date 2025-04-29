import React, { useContext } from 'react';

import { X } from '@osrd-project/ui-icons';

import OccupancyZonesLayer from './layers/OccupancyZonesLayer';
import TracksLayer from './layers/TracksLayer';
import type { OccupancyZone, Track } from './types';
import { SpaceTimeChartContext } from '../../spaceTimeChart';

const CloseButton = ({ position, onClose }: { position: number; onClose: () => void }) => {
  const { getSpacePixel } = useContext(SpaceTimeChartContext);

  return (
    <button
      className="close-track-occupancy-panel"
      onClick={() => onClose()}
      style={{
        top: getSpacePixel(position),
      }}
    >
      <span>
        <X />
      </span>
    </button>
  );
};

const TrackOccupancyCanvas = ({
  position,
  tracks,
  occupancyZones,
  selectedTrainId,
  onClose,
  topPadding = 0,
  hideBorders = false,
}: {
  position: number;
  tracks: Track[];
  occupancyZones: OccupancyZone[];
  selectedTrainId?: string;
  onClose?: () => void;
  topPadding?: number;
  hideBorders?: boolean;
}) => (
  <>
    <TracksLayer
      position={position}
      tracks={tracks}
      topPadding={topPadding}
      drawBorders={!hideBorders}
    />
    <OccupancyZonesLayer
      tracks={tracks}
      position={position}
      topPadding={topPadding}
      occupancyZones={occupancyZones}
      selectedTrainId={selectedTrainId}
    />
    {onClose && <CloseButton position={position} onClose={onClose} />}
  </>
);

export default TrackOccupancyCanvas;
