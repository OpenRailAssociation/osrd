import React, { useContext, useMemo, useEffect } from 'react';

import { X } from '@osrd-project/ui-icons';

import { SpaceTimeChartContext } from '../../spaceTimeChart';
import { MouseContext } from '../../spaceTimeChart/lib/context';
import { CANVAS_PADDING, TRACK_HEIGHT_CONTAINER } from '../lib/consts';
import type { OccupancyZone, Track } from '../lib/types';
import DraggingOccupancyZonesLayer from './layers/DraggingOccupancyZonesLayer';
import OccupancyZonesLayer from './layers/OccupancyZonesLayer';
import TracksLayer from './layers/TracksLayer';

/** Distance in pixels to snap to a track while dragging an occupancy zone */
const DROP_SNAP_DISTANCE = 16;

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
  onClose,
  onDragOver,
  topPadding = 0,
  hideBorders = false,
}: {
  position: number;
  tracks: Track[];
  occupancyZones: OccupancyZone[];
  draggingOccupancyZones?: OccupancyZone[];
  onClose?: () => void;
  onDragOver?: (trackId: string | undefined) => void;
  topPadding?: number;
  hideBorders?: boolean;
}) => {
  const { getSpacePixel } = useContext(SpaceTimeChartContext);
  const mouseContext = useContext(MouseContext);

  const highlightedTrackId = useMemo(() => {
    if (!draggingOccupancyZones?.length) {
      return undefined;
    }
    if (isNaN(mouseContext.position.y)) {
      return undefined; // mouse is outside of the canvas
    }
    // Vertical position relative to the middle of the first track
    const y =
      mouseContext.position.y -
      getSpacePixel(position) -
      topPadding -
      CANVAS_PADDING -
      TRACK_HEIGHT_CONTAINER / 2;
    // Each track is vertically centered in a container with a fixed height, we
    // can divide by that height to find the closest track index
    const index = Math.round(y / TRACK_HEIGHT_CONTAINER);
    // If the mouse is close enough to a track, snap to that track
    if (
      index < 0 ||
      index >= tracks.length ||
      Math.abs(y - index * TRACK_HEIGHT_CONTAINER) > DROP_SNAP_DISTANCE
    ) {
      return undefined;
    }
    return tracks[index].id;
  }, [
    mouseContext.position.y,
    draggingOccupancyZones,
    position,
    tracks,
    topPadding,
    getSpacePixel,
  ]);

  useEffect(() => {
    if (onDragOver) onDragOver(highlightedTrackId);
  }, [onDragOver, highlightedTrackId]);

  return (
    <>
      <TracksLayer
        position={position}
        tracks={tracks}
        topPadding={topPadding}
        drawBorders={!hideBorders}
        highlightedTrackId={highlightedTrackId}
        showTicks={!draggingOccupancyZones?.length}
      />
      <OccupancyZonesLayer
        tracks={tracks}
        position={position}
        topPadding={topPadding}
        occupancyZones={occupancyZones}
      />
      {draggingOccupancyZones && (
        <DraggingOccupancyZonesLayer occupancyZones={draggingOccupancyZones} />
      )}
      {onClose && <CloseButton position={position} onClose={onClose} />}
    </>
  );
};

export default TrackOccupancyCanvas;
