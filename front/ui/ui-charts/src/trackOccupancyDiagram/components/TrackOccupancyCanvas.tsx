import React, { useContext } from 'react';

import { X } from '@osrd-project/ui-icons';

import { SpaceTimeChartContext } from '../../spaceTimeChart';
import type { OccupancyZone, Track } from '../lib/types';
import DraggingOccupancyZonesLayer from './layers/DraggingOccupancyZonesLayer';
import OccupancyZonesLayer from './layers/OccupancyZonesLayer';
import TracksLayer from './layers/TracksLayer';

const CloseButton = ({ position, onClose }: { position: number; onClose: () => void }) => {
  const { getSpacePixel } = useContext(SpaceTimeChartContext);

  return (
    <button
      data-testid="close-track-occupancy-panel"
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
  draggingOccupancyZones,
  selectedTrainId,
  onClose,
  topPadding = 0,
  hideBorders = false,
}: {
  position: number;
  tracks: Track[];
  occupancyZones: OccupancyZone[];
  draggingOccupancyZones?: OccupancyZone[];
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
    {draggingOccupancyZones && (
      <DraggingOccupancyZonesLayer occupancyZones={draggingOccupancyZones} />
    )}
    {onClose && <CloseButton position={position} onClose={onClose} />}
  </>
);

export default TrackOccupancyCanvas;
