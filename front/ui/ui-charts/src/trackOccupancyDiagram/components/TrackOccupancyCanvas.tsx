import React, { useContext, useMemo, useEffect } from 'react';

import { X } from '@osrd-project/ui-icons';

import { MouseContext } from '../../common';
import { SpaceTimeChartContext } from '../../spaceTimeChart';
import { CANVAS_PADDING, TRACK_HEIGHT_CONTAINER } from '../lib/consts';
import type { BrokenLinking, Linking, OccupancyZone, Track } from '../lib/types';
import BrokenLinkingLayer from './layers/BrokenLinkingLayer';
import DraggingOccupancyZonesLayer from './layers/DraggingOccupancyZonesLayer';
import LinkingLayer from './layers/LinkingLayer';
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
      // This button is nested inside the chart, which has its own click listener. We use
      // 'stopPropagation' because that listener would otherwise fire first and deselect the
      // train before onClose runs.
      onClickCapture={(e) => {
        e.stopPropagation();
        onClose();
      }}
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
  linkings,
  brokenLinkings,
  deleteIconUrl,
  onClose,
  onDragOver,
  topPadding = 0,
  hideBorders = false,
}: {
  position: number;
  tracks: Track[];
  occupancyZones: OccupancyZone[];
  draggingOccupancyZones?: OccupancyZone[];
  linkings?: Linking[];
  brokenLinkings?: BrokenLinking[];
  deleteIconUrl?: string;
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
      {linkings && (
        <LinkingLayer
          tracks={tracks}
          linkings={linkings}
          position={position}
          topPadding={topPadding}
        />
      )}
      {draggingOccupancyZones && (
        <DraggingOccupancyZonesLayer occupancyZones={draggingOccupancyZones} />
      )}
      {brokenLinkings && (
        <BrokenLinkingLayer
          tracks={tracks}
          brokenLinkings={brokenLinkings}
          position={position}
          topPadding={topPadding}
          deleteIconUrl={deleteIconUrl}
        />
      )}
      {onClose && <CloseButton position={position} onClose={onClose} />}
    </>
  );
};

export default TrackOccupancyCanvas;
